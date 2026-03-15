import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, POWERUP_TYPES, POWERUP, BOMB } from '../constants.js';

export class PowerupManager {
    constructor(scene) {
        this.scene = scene;
        this.lastDropTime = 0;

        // Build weighted pool
        this.pool = [];
        for (const [key, info] of Object.entries(POWERUP_TYPES)) {
            for (let i = 0; i < info.weight; i++) {
                this.pool.push(info.key);
            }
        }
    }

    tryDrop(enemy) {
        const now = this.scene.time.now;
        if (now - this.lastDropTime < POWERUP.DROP_COOLDOWN_MS) return;

        let dropChance = enemy.getData('dropChance') || 0.05;
        // Escalation bonus
        const levelBonus = Math.floor(this.scene.level / POWERUP.ESCALATION_INTERVAL) * POWERUP.ESCALATION_BONUS;
        dropChance += levelBonus;

        if (Math.random() < dropChance) {
            this.lastDropTime = now;
            this.spawnPowerup(enemy.x, enemy.y);
        }
    }

    spawnPowerup(x, y) {
        const typeKey = Phaser.Utils.Array.GetRandom(this.pool);
        const typeInfo = Object.values(POWERUP_TYPES).find(t => t.key === typeKey);
        if (!typeInfo) return;

        const powerup = this.scene.powerups.get(x, y, `powerup_${typeKey}`);
        if (!powerup) return;

        powerup.setActive(true).setVisible(true);
        powerup.setData('powerupType', typeKey);
        powerup.body.setVelocity(0, POWERUP.FALL_SPEED);
        powerup.setDepth(7);

        // Floating label that follows the powerup
        const label = this.scene.add.text(x, y + 20, typeInfo.label, {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
        }).setOrigin(0.5).setDepth(7);
        powerup.setData('label', label);

        // Pulsing glow + gentle rotation
        this.scene.tweens.add({
            targets: powerup,
            scaleX: 1.4,
            scaleY: 1.4,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    update(time, delta) {
        const player = this.scene.player.mainShip;
        if (!player.active) return;

        const magnetRadius = GAME_WIDTH * POWERUP.MAGNET_RADIUS_PCT;

        this.scene.powerups.getChildren().forEach(p => {
            if (!p.active) return;

            const label = p.getData('label');

            // Despawn if off screen
            if (p.y > GAME_HEIGHT + 30) {
                if (label) label.destroy();
                p.setData('label', null);
                p.setActive(false).setVisible(false);
                p.body.stop();
                return;
            }

            // Keep label following
            if (label && label.active) {
                label.setPosition(p.x, p.y + 22);
            }

            // Magnet pull
            const dist = Phaser.Math.Distance.Between(p.x, p.y, player.x, player.y);
            if (dist < magnetRadius) {
                const angle = Phaser.Math.Angle.Between(p.x, p.y, player.x, player.y);
                const strength = POWERUP.MAGNET_STRENGTH * (1 - dist / magnetRadius);
                p.body.velocity.x += Math.cos(angle) * strength * (delta / 1000) * 10;
                p.body.velocity.y += Math.sin(angle) * strength * (delta / 1000) * 10;
            }
        });
    }

    activate(typeKey) {
        const scene = this.scene;

        switch (typeKey) {
            case 'bomb':
                if (scene.bombs < BOMB.MAX_COUNT) {
                    scene.bombs++;
                }
                break;

            case 'dual_laser':
                scene.activateTimedPowerup('dual_laser', POWERUP_TYPES.DUAL_LASER.duration);
                break;

            case 'spread_blast':
                scene.activateTimedPowerup('spread_blast', POWERUP_TYPES.SPREAD_BLAST.duration);
                break;

            case 'force_field':
                scene.activateTimedPowerup('force_field', POWERUP_TYPES.FORCE_FIELD.duration);
                break;

            case 'ricochet':
                scene.activateTimedPowerup('ricochet', POWERUP_TYPES.RICOCHET.duration);
                break;

            case 'speed_boost':
                scene.activateTimedPowerup('speed_boost', POWERUP_TYPES.SPEED_BOOST.duration);
                break;

            case 'multi_ship':
                scene.player.activateMultiShip();
                break;

            case 'time_slow':
                scene.activateTimedPowerup('time_slow', POWERUP_TYPES.TIME_SLOW.duration);
                break;
        }
    }
}
