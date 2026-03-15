import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DIFFICULTY_MODIFIERS } from '../constants.js';
import { audio } from '../systems/AudioManager.js';

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.finalLevel = data.level || 1;
        this.difficulty = data.difficulty || 'normal';
        this.totalKills = data.totalKills || 0;
        this.totalShotsFired = data.totalShotsFired || 0;
        this.totalShotsHit = data.totalShotsHit || 0;
        this.maxCombo = data.maxCombo || 0;
        this.gameStartTime = data.gameStartTime || Date.now();
    }

    create() {
        // Background
        for (let i = 0; i < 60; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT);
            this.add.image(x, y, 'star').setAlpha(Phaser.Math.FloatBetween(0.1, 0.4));
        }

        this.add.text(GAME_WIDTH / 2, 60, 'GAME OVER', {
            fontFamily: 'monospace', fontSize: '40px', color: '#ff4444',
            stroke: '#440000', strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 130, `SCORE: ${this.finalScore.toLocaleString()}`, {
            fontFamily: 'monospace', fontSize: '24px', color: '#ffff00',
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 165, `LEVEL: ${this.finalLevel}`, {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 190, `DIFFICULTY: ${DIFFICULTY_MODIFIERS[this.difficulty].label}`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#888888',
        }).setOrigin(0.5);

        // --- Animated Statistics ---
        this.showAnimatedStats();

        // High scores
        this.showHighScores();

        // --- Share Score Screenshot button ---
        const shareBtn = this.add.text(GAME_WIDTH / 2, 555, '📸 SHARE SCORE', {
            fontFamily: 'monospace', fontSize: '14px', color: '#00ffff',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        shareBtn.on('pointerover', () => shareBtn.setColor('#ffffff'));
        shareBtn.on('pointerout', () => shareBtn.setColor('#00ffff'));
        shareBtn.on('pointerdown', () => this.shareScore());

        // Share status text (hidden until used)
        this.shareStatus = this.add.text(GAME_WIDTH / 2, 578, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#44ff44',
        }).setOrigin(0.5);

        // Restart prompt
        const restartText = this.add.text(GAME_WIDTH / 2, 610, 'PRESS ENTER TO PLAY AGAIN', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: restartText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        this.add.text(GAME_WIDTH / 2, 650, 'ESC FOR MENU', {
            fontFamily: 'monospace', fontSize: '12px', color: '#555555',
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('DifficultySelectScene');
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            this.scene.start('DifficultySelectScene');
        });
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('MenuScene');
        });
    }

    showAnimatedStats() {
        const survivalMs = Date.now() - this.gameStartTime;
        const survivalSecs = Math.floor(survivalMs / 1000);
        const mins = Math.floor(survivalSecs / 60);
        const secs = survivalSecs % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        const accuracy = this.totalShotsFired > 0
            ? Math.round((this.totalShotsHit / this.totalShotsFired) * 100) : 0;

        this.add.text(GAME_WIDTH / 2, 228, '— BATTLE STATS —', {
            fontFamily: 'monospace', fontSize: '13px', color: '#00ffff',
        }).setOrigin(0.5);

        const stats = [
            { label: 'ENEMIES DESTROYED', value: this.totalKills, color: '#ff8844' },
            { label: 'ACCURACY', value: `${accuracy}%`, color: '#44ff44' },
            { label: 'HIGHEST COMBO', value: `x${this.maxCombo}`, color: '#ffff00' },
            { label: 'TIME SURVIVED', value: timeStr, color: '#8888ff' },
        ];

        stats.forEach((stat, i) => {
            const y = 258 + i * 28;

            const label = this.add.text(GAME_WIDTH / 2 - 10, y, stat.label, {
                fontFamily: 'monospace', fontSize: '11px', color: '#888888',
            }).setOrigin(1, 0.5).setAlpha(0);

            const value = this.add.text(GAME_WIDTH / 2 + 10, y, `${stat.value}`, {
                fontFamily: 'monospace', fontSize: '13px', color: stat.color,
            }).setOrigin(0, 0.5).setAlpha(0);

            // Staggered reveal animation
            this.tweens.add({
                targets: [label, value],
                alpha: 1,
                x: { from: label.x + (label === label ? -20 : 20), to: label.x },
                duration: 400,
                delay: 300 + i * 200,
                ease: 'Back.easeOut',
            });
            this.tweens.add({
                targets: value,
                alpha: 1,
                duration: 400,
                delay: 300 + i * 200,
                ease: 'Back.easeOut',
            });
        });
    }

    showHighScores() {
        try {
            const scores = JSON.parse(localStorage.getItem('owens_galaga_scores') || '{}');
            const diffScores = scores[this.difficulty]?.scores || [];

            this.add.text(GAME_WIDTH / 2, 380, '— HIGH SCORES —', {
                fontFamily: 'monospace', fontSize: '16px', color: '#00ffff',
            }).setOrigin(0.5);

            if (diffScores.length === 0) {
                this.add.text(GAME_WIDTH / 2, 420, 'No scores yet', {
                    fontFamily: 'monospace', fontSize: '12px', color: '#666666',
                }).setOrigin(0.5);
            } else {
                diffScores.slice(0, 5).forEach((entry, i) => {
                    const isNew = entry.score === this.finalScore;
                    this.add.text(GAME_WIDTH / 2, 410 + i * 28,
                        `${i + 1}. ${entry.score.toLocaleString().padStart(10)} LVL ${entry.level}`, {
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        color: isNew ? '#ffff00' : '#aaaaaa',
                    }).setOrigin(0.5);
                });
            }
        } catch { /* ignore */ }
    }

    async shareScore() {
        try {
            this.shareStatus.setText('Capturing...');

            // Capture the canvas as an image
            const canvas = this.game.canvas;
            const dataUrl = canvas.toDataURL('image/png');

            // Try Web Share API first (mobile-friendly)
            if (navigator.share && navigator.canShare) {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], 'owens-galaga-score.png', { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: "Owen's Galaga Score",
                        text: `I scored ${this.finalScore.toLocaleString()} on Level ${this.finalLevel} in Owen's Galaga! (${DIFFICULTY_MODIFIERS[this.difficulty].label} mode)`,
                        files: [file],
                    });
                    this.shareStatus.setText('Shared!');
                    return;
                }
            }

            // Fallback: try clipboard
            if (navigator.clipboard && window.ClipboardItem) {
                const blob = await (await fetch(dataUrl)).blob();
                try {
                    await navigator.clipboard.write([
                        new window.ClipboardItem({ 'image/png': blob })
                    ]);
                    this.shareStatus.setText('Screenshot copied to clipboard!');
                    return;
                } catch {
                    // Clipboard write failed, fall through to download
                }
            }

            // Final fallback: download the image
            const link = document.createElement('a');
            link.download = `owens-galaga-${this.finalScore}-lvl${this.finalLevel}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.shareStatus.setText('Screenshot downloaded!');

        } catch (err) {
            console.warn('Share failed:', err);
            this.shareStatus.setText('Could not share - try again');
        }

        // Clear status after 3 seconds
        this.time.delayedCall(3000, () => {
            if (this.shareStatus) this.shareStatus.setText('');
        });
    }
}
