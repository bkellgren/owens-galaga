import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants.js';

export class StarField {
    constructor(scene) {
        this.scene = scene;
        this.layers = [];

        // 3 parallax layers
        const layerConfigs = [
            { count: 40, speed: 15, alpha: 0.3, size: 1 },
            { count: 30, speed: 30, alpha: 0.5, size: 1 },
            { count: 15, speed: 50, alpha: 0.8, size: 2 },
        ];

        layerConfigs.forEach(cfg => {
            const stars = [];
            for (let i = 0; i < cfg.count; i++) {
                const star = scene.add.rectangle(
                    Phaser.Math.Between(0, GAME_WIDTH),
                    Phaser.Math.Between(0, GAME_HEIGHT),
                    cfg.size, cfg.size,
                    0xaaaacc, cfg.alpha
                ).setDepth(0);
                stars.push({ sprite: star, speed: cfg.speed });
            }
            this.layers.push(stars);
        });
    }

    update(delta) {
        this.layers.forEach(layer => {
            layer.forEach(star => {
                star.sprite.y += star.speed * (delta / 1000);
                if (star.sprite.y > GAME_HEIGHT + 5) {
                    star.sprite.y = -5;
                    star.sprite.x = Phaser.Math.Between(0, GAME_WIDTH);
                }
            });
        });
    }
}
