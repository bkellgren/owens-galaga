import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants.js';
import { audio } from '../systems/AudioManager.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        // Initialize audio on scene entry (will create AudioContext on first call)
        audio.init();

        // Start menu music
        audio.startMusic('menu');
        // Starfield background
        for (let i = 0; i < 100; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.8);
            const star = this.add.image(x, y, 'star').setAlpha(alpha);
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.3 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1
            });
        }

        // Title
        const title = this.add.text(GAME_WIDTH / 2, 160, "OWEN'S\nGALAGA", {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#00ffff',
            align: 'center',
            stroke: '#003344',
            strokeThickness: 4,
        }).setOrigin(0.5);

        // Pulsing title
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Subtitle
        this.add.text(GAME_WIDTH / 2, 280, 'A SPACE SHOOTER', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#888888',
        }).setOrigin(0.5);

        // Start prompt
        const startText = this.add.text(GAME_WIDTH / 2, 420, 'PRESS ENTER TO START', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: startText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // High scores button
        const hsText = this.add.text(GAME_WIDTH / 2, 500, 'HIGH SCORES', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ffff00',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        hsText.on('pointerover', () => hsText.setColor('#ffffff'));
        hsText.on('pointerout', () => hsText.setColor('#ffff00'));
        hsText.on('pointerdown', () => this.showHighScoresOverlay());

        // Controls hint
        this.add.text(GAME_WIDTH / 2, 620, 'ARROWS/WASD: MOVE  |  SPACE: FIRE\nX: BOMB  |  C: POKÉBALL  |  ESC: PAUSE\nM: MUTE  |  F: FULLSCREEN', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#555555',
            align: 'center',
        }).setOrigin(0.5);

        // Fullscreen button
        const fsBtn = this.add.text(GAME_WIDTH - 16, 16, '⛶', {
            fontFamily: 'monospace', fontSize: '20px', color: '#555555',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        fsBtn.on('pointerover', () => fsBtn.setColor('#ffffff'));
        fsBtn.on('pointerout', () => fsBtn.setColor('#555555'));
        fsBtn.on('pointerdown', () => this.scale.toggleFullscreen());

        // F key for fullscreen
        this.input.keyboard.on('keydown-F', () => this.scale.toggleFullscreen());

        // Decorative ship
        const ship = this.add.image(GAME_WIDTH / 2, 350, 'player_ship').setScale(2);
        this.tweens.add({
            targets: ship,
            y: 360,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Input
        this.input.keyboard.on('keydown-ENTER', () => {
            audio.resume();
            audio.play('menu_select');
            this.scene.start('DifficultySelectScene');
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            audio.resume();
            audio.play('menu_select');
            this.scene.start('DifficultySelectScene');
        });

        // Gamepad
        this.input.gamepad.on('connected', (pad) => {
            pad.on('down', (index) => {
                if (index === 0 || index === 9) { // A or Start
                    this.scene.start('DifficultySelectScene');
                }
            });
        });
    }

    showHighScoresOverlay() {
        if (this.hsOverlay) return; // Already showing

        audio.play('menu_select');

        // Overlay background
        this.hsOverlay = this.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
        ).setDepth(200).setInteractive();

        // Title
        this.add.text(GAME_WIDTH / 2, 50, '★ HIGH SCORES ★', {
            fontFamily: 'monospace', fontSize: '24px', color: '#00ffff',
            stroke: '#003344', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(201).setData('hsElement', true);

        // Read scores from localStorage
        let allScores = {};
        try {
            allScores = JSON.parse(localStorage.getItem('owens_galaga_scores') || '{}');
        } catch { /* ignore */ }

        const difficulties = [
            { key: 'easy', label: 'EASY', color: '#44ff44', colorHex: 0x44ff44 },
            { key: 'normal', label: 'NORMAL', color: '#ffff00', colorHex: 0xffff00 },
            { key: 'hard', label: 'HARD', color: '#ff4444', colorHex: 0xff4444 },
        ];

        const colWidth = GAME_WIDTH / 3;

        difficulties.forEach((diff, col) => {
            const cx = colWidth * col + colWidth / 2;

            // Column header
            this.add.text(cx, 100, diff.label, {
                fontFamily: 'monospace', fontSize: '14px', color: diff.color,
            }).setOrigin(0.5).setDepth(201).setData('hsElement', true);

            // Separator line
            const sep = this.add.rectangle(cx, 118, colWidth - 20, 1, diff.colorHex, 0.5)
                .setDepth(201).setData('hsElement', true);

            const entries = allScores[diff.key]?.scores || [];

            if (entries.length === 0) {
                this.add.text(cx, 150, '---', {
                    fontFamily: 'monospace', fontSize: '10px', color: '#444444',
                }).setOrigin(0.5).setDepth(201).setData('hsElement', true);
            } else {
                entries.slice(0, 10).forEach((entry, i) => {
                    const y = 140 + i * 38;
                    // Rank + Score
                    const rankColor = i === 0 ? '#ffffff' : i < 3 ? '#cccccc' : '#888888';
                    this.add.text(cx, y, `${(i + 1).toString().padStart(2)}. ${entry.score.toLocaleString()}`, {
                        fontFamily: 'monospace', fontSize: '11px', color: rankColor,
                    }).setOrigin(0.5).setDepth(201).setData('hsElement', true);
                    // Level + Date
                    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : '';
                    this.add.text(cx, y + 15, `LVL ${entry.level}  ${dateStr}`, {
                        fontFamily: 'monospace', fontSize: '8px', color: '#555555',
                    }).setOrigin(0.5).setDepth(201).setData('hsElement', true);
                });
            }
        });

        // Close button
        const closeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '[ CLOSE (ESC) ]', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ff4444',
        }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true })
            .setData('hsElement', true);

        closeText.on('pointerover', () => closeText.setColor('#ffffff'));
        closeText.on('pointerout', () => closeText.setColor('#ff4444'));
        closeText.on('pointerdown', () => this.closeHighScoresOverlay());

        // ESC to close
        this.hsEscKey = this.input.keyboard.on('keydown-ESC', () => {
            this.closeHighScoresOverlay();
        });
    }

    closeHighScoresOverlay() {
        if (!this.hsOverlay) return;

        // Destroy all HS elements
        this.children.list.filter(c => c.getData && c.getData('hsElement')).forEach(c => c.destroy());
        this.hsOverlay.destroy();
        this.hsOverlay = null;
        this.input.keyboard.off('keydown-ESC');
    }
}
