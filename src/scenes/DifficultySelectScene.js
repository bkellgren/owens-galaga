import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DIFFICULTY } from '../constants.js';
import { audio } from '../systems/AudioManager.js';

export class DifficultySelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DifficultySelectScene' });
    }

    create() {
        this.selectedIndex = 1; // Default to Normal

        // Background stars
        for (let i = 0; i < 60; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT);
            this.add.image(x, y, 'star').setAlpha(Phaser.Math.FloatBetween(0.2, 0.6));
        }

        this.add.text(GAME_WIDTH / 2, 120, 'SELECT DIFFICULTY', {
            fontFamily: 'monospace',
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5);

        const options = [
            { label: 'EASY', desc: 'Slower enemies, less aggressive', key: DIFFICULTY.EASY, color: '#44ff44' },
            { label: 'NORMAL', desc: 'The classic experience', key: DIFFICULTY.NORMAL, color: '#ffff00' },
            { label: 'HARD', desc: 'Faster, meaner, no mercy', key: DIFFICULTY.HARD, color: '#ff4444' },
        ];

        this.optionTexts = [];
        this.options = options;

        options.forEach((opt, i) => {
            const y = 280 + i * 100;
            const label = this.add.text(GAME_WIDTH / 2, y, opt.label, {
                fontFamily: 'monospace',
                fontSize: '28px',
                color: opt.color,
            }).setOrigin(0.5);

            const desc = this.add.text(GAME_WIDTH / 2, y + 30, opt.desc, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#888888',
            }).setOrigin(0.5);

            this.optionTexts.push({ label, desc });

            label.setInteractive({ useHandCursor: true });
            label.on('pointerover', () => {
                this.selectedIndex = i;
                this.updateSelection();
            });
            label.on('pointerdown', () => {
                this.selectDifficulty(opt.key);
            });
        });

        // Selection arrow
        this.arrow = this.add.text(0, 0, '►', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.updateSelection();

        // Keyboard
        this.input.keyboard.on('keydown-UP', () => {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateSelection();
        });
        this.input.keyboard.on('keydown-DOWN', () => {
            this.selectedIndex = Math.min(2, this.selectedIndex + 1);
            this.updateSelection();
        });
        this.input.keyboard.on('keydown-W', () => {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateSelection();
        });
        this.input.keyboard.on('keydown-S', () => {
            this.selectedIndex = Math.min(2, this.selectedIndex + 1);
            this.updateSelection();
        });
        this.input.keyboard.on('keydown-ENTER', () => {
            this.selectDifficulty(this.options[this.selectedIndex].key);
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            this.selectDifficulty(this.options[this.selectedIndex].key);
        });
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('MenuScene');
        });

        this.add.text(GAME_WIDTH / 2, 640, 'ESC TO GO BACK', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#555555',
        }).setOrigin(0.5);
    }

    updateSelection() {
        audio.play('menu_move');
        this.optionTexts.forEach((opt, i) => {
            const selected = i === this.selectedIndex;
            opt.label.setScale(selected ? 1.2 : 1.0);
            opt.label.setAlpha(selected ? 1.0 : 0.5);
            opt.desc.setAlpha(selected ? 1.0 : 0.4);
        });

        const y = 280 + this.selectedIndex * 100;
        this.arrow.setPosition(GAME_WIDTH / 2 - 100, y);
    }

    selectDifficulty(difficulty) {
        audio.play('menu_select');
        audio.stopMusic();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { difficulty });
        });
    }
}
