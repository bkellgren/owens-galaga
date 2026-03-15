import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DIFFICULTY_MODIFIERS, POWERUP_TYPES } from '../constants.js';

export class HUD {
    constructor(scene) {
        this.scene = scene;

        const style = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' };
        const smallStyle = { fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa' };

        // Score
        this.scoreText = scene.add.text(10, 8, 'SCORE: 0', {
            ...style, color: '#ffff00'
        }).setDepth(80);

        // High score
        this.highScoreText = scene.add.text(GAME_WIDTH / 2, 8, 'HI: 0', {
            ...style, color: '#888888'
        }).setOrigin(0.5, 0).setDepth(80);

        // Level
        this.levelText = scene.add.text(GAME_WIDTH - 10, 8, 'LVL 1', {
            ...style, color: '#00ffff'
        }).setOrigin(1, 0).setDepth(80);

        // Difficulty
        this.diffText = scene.add.text(GAME_WIDTH - 10, 24, DIFFICULTY_MODIFIERS[scene.difficulty].label, {
            ...smallStyle, fontSize: '9px',
        }).setOrigin(1, 0).setDepth(80);

        // Lives (bottom left)
        this.livesIcons = [];
        for (let i = 0; i < 5; i++) {
            const icon = scene.add.image(16 + i * 22, GAME_HEIGHT - 16, 'player_ship')
                .setScale(0.6).setDepth(80).setAlpha(0.8);
            this.livesIcons.push(icon);
        }

        // Bombs (bottom right)
        this.bombTexts = scene.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 22, '', {
            ...style, color: '#ff4444', fontSize: '12px',
        }).setOrigin(1, 0).setDepth(80);

        // Pokéballs (bottom right, above bombs) — use sprite icons
        this.pokeballIcons = [];
        for (let i = 0; i < 2; i++) { // max 2 pokéballs
            const icon = scene.add.image(
                GAME_WIDTH - 16 - i * 22,
                GAME_HEIGHT - 38,
                'pokeball'
            ).setScale(0.8).setDepth(80).setAlpha(0).setVisible(false);
            this.pokeballIcons.push(icon);
        }

        // Fullscreen button (top right corner)
        this.fullscreenBtn = scene.add.text(GAME_WIDTH - 10, 42, '⛶', {
            fontFamily: 'monospace', fontSize: '16px', color: '#555555',
        }).setOrigin(1, 0).setDepth(80).setInteractive({ useHandCursor: true });
        this.fullscreenBtn.on('pointerover', () => this.fullscreenBtn.setColor('#ffffff'));
        this.fullscreenBtn.on('pointerout', () => this.fullscreenBtn.setColor('#555555'));
        this.fullscreenBtn.on('pointerdown', () => scene.scale.toggleFullscreen());

        // Active powerups display — visual bars
        this.powerupBars = [];
        this.powerupBarContainer = { y: GAME_HEIGHT - 80 };

        // Boss HP bar (hidden by default)
        this.bossHPBg = scene.add.rectangle(GAME_WIDTH / 2, 36, 200, 10, 0x333333)
            .setDepth(80).setVisible(false);
        this.bossHPBar = scene.add.rectangle(GAME_WIDTH / 2 - 100, 36, 200, 10, 0xff0000)
            .setOrigin(0, 0.5).setDepth(81).setVisible(false);
        this.bossHPText = scene.add.text(GAME_WIDTH / 2, 48, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ff4444',
        }).setOrigin(0.5, 0).setDepth(80).setVisible(false);

        // Combo display
        this.comboText = scene.add.text(GAME_WIDTH / 2, 60, '', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffff00',
        }).setOrigin(0.5, 0).setDepth(80).setAlpha(0);
    }

    update(time, delta) {
        const scene = this.scene;

        this.scoreText.setText(`SCORE: ${scene.score.toLocaleString()}`);
        this.highScoreText.setText(`HI: ${scene.highScore.toLocaleString()}`);
        this.levelText.setText(`LVL ${scene.level}`);

        // Lives
        this.livesIcons.forEach((icon, i) => {
            icon.setVisible(i < scene.lives);
        });

        // Bombs
        const bombStr = '💣'.repeat(scene.bombs);
        this.bombTexts.setText(bombStr || '');

        // Pokéballs — show/hide sprite icons
        this.pokeballIcons.forEach((icon, i) => {
            const show = i < scene.pokeballs;
            icon.setVisible(show);
            icon.setAlpha(show ? 0.9 : 0);
        });

        // Active powerups — visual timer bars
        // Clean up old bars
        this.powerupBars.forEach(bar => {
            bar.bg.destroy();
            bar.fill.destroy();
            bar.label.destroy();
        });
        this.powerupBars = [];

        let barIndex = 0;
        for (const [key, data] of Object.entries(scene.activePowerups)) {
            if (data.duration > 0 && data.remaining > 0) {
                const info = Object.values(POWERUP_TYPES).find(t => t.key === key);
                const barY = this.powerupBarContainer.y - barIndex * 18;
                const barWidth = 80;
                const pct = Math.max(0, data.remaining / data.duration);
                const secs = Math.ceil(data.remaining / 1000);
                const color = info?.color || 0x00ff88;

                // Label
                const label = scene.add.text(10, barY - 5, `${info?.label || key} ${secs}s`, {
                    fontFamily: 'monospace', fontSize: '9px', color: '#ffffff',
                }).setDepth(80);

                // Background bar
                const bg = scene.add.rectangle(10, barY + 8, barWidth, 4, 0x333333)
                    .setOrigin(0, 0.5).setDepth(80);

                // Fill bar
                const fill = scene.add.rectangle(10, barY + 8, barWidth * pct, 4, color)
                    .setOrigin(0, 0.5).setDepth(81);

                // Flash when nearly expired
                if (secs <= 3) {
                    fill.setAlpha(Math.sin(Date.now() * 0.01) > 0 ? 1 : 0.4);
                }

                this.powerupBars.push({ bg, fill, label });
                barIndex++;
            }
        }

        // Combo
        if (scene.comboMultiplier > 1) {
            this.comboText.setText(`COMBO x${scene.comboMultiplier}`);
            this.comboText.setAlpha(1);
        } else {
            this.comboText.setAlpha(Math.max(0, this.comboText.alpha - delta * 0.003));
        }
    }

    showBossHP(current, max) {
        this.bossHPBg.setVisible(true);
        this.bossHPBar.setVisible(true);
        this.bossHPText.setVisible(true);

        const pct = Math.max(0, current / max);
        this.bossHPBar.width = 200 * pct;
        this.bossHPBar.setFillStyle(
            pct > 0.5 ? 0xff0000 : pct > 0.25 ? 0xff8800 : 0xffff00
        );
        this.bossHPText.setText(`BOSS HP: ${current}/${max}`);
    }

    hideBossHP() {
        this.bossHPBg.setVisible(false);
        this.bossHPBar.setVisible(false);
        this.bossHPText.setVisible(false);
    }
}
