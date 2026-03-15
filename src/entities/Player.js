import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PLAYER } from '../constants.js';
import { audio } from '../systems/AudioManager.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.invulnerable = false;
        this.chargeTime = 0;
        this.charging = false;
        this.fireHeld = false;
        this.fireCooldown = 0;
        this.velocity = 0;

        // Ship group (for multi-ship)
        this.shipGroup = scene.physics.add.group();

        // Create main ship
        this.mainShip = this.createShip(GAME_WIDTH / 2, GAME_HEIGHT * (1 - PLAYER.BOTTOM_MARGIN));
        this.ships = [this.mainShip];

        // Charge indicator
        this.chargeBar = scene.add.rectangle(
            this.mainShip.x, this.mainShip.y + 22,
            0, 3, 0x00ffff
        ).setOrigin(0, 0.5).setDepth(15);
        this.chargeBarBg = scene.add.rectangle(
            this.mainShip.x - 16, this.mainShip.y + 22,
            32, 3, 0x333333
        ).setOrigin(0, 0.5).setDepth(14);

        // Shield visual
        this.shieldSprite = null;

        // Exhaust particles
        this.exhaustParticles = [];
        this.exhaustTimer = 0;
    }

    createShip(x, y) {
        const tierKey = this.scene.cosmeticTier > 0
            ? `player_ship_t${this.scene.cosmeticTier}`
            : 'player_ship';

        const ship = this.scene.physics.add.sprite(x, y, tierKey);
        ship.setDepth(10);
        ship.setCollideWorldBounds(true);
        ship.body.setSize(20, 24);
        this.shipGroup.add(ship);
        return ship;
    }

    updateCosmetic(tier) {
        const key = tier > 0 ? `player_ship_t${tier}` : 'player_ship';
        this.ships.forEach(s => {
            if (s.active) s.setTexture(key);
        });
    }

    update(time, delta, cursors, keys) {
        if (!this.mainShip.active) return;

        // Movement
        let moveDir = 0;
        if (cursors.left.isDown || keys.A.isDown) moveDir = -1;
        else if (cursors.right.isDown || keys.D.isDown) moveDir = 1;

        // Gamepad
        const pad = this.scene.input.gamepad.getPad(0);
        if (pad) {
            const axisH = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
            if (axisH < -0.3) moveDir = -1;
            else if (axisH > 0.3) moveDir = 1;
            if (pad.left) moveDir = -1;
            if (pad.right) moveDir = 1;
        }

        // Smooth acceleration
        const speed = PLAYER.SPEED * (this.scene.activePowerups.speed_boost ? 1.5 : 1);
        if (moveDir !== 0) {
            this.velocity = Phaser.Math.Clamp(
                this.velocity + moveDir * PLAYER.ACCELERATION * (delta / 1000),
                -speed, speed
            );
        } else {
            // Decelerate
            if (Math.abs(this.velocity) < 20) {
                this.velocity = 0;
            } else {
                this.velocity -= Math.sign(this.velocity) * PLAYER.DECELERATION * (delta / 1000);
            }
        }

        // Apply velocity to all ships
        this.ships.forEach(ship => {
            if (!ship.active) return;
            ship.x += this.velocity * (delta / 1000);
            ship.x = Phaser.Math.Clamp(ship.x, 16, GAME_WIDTH - 16);
        });

        // Firing
        const fireDown = keys.SPACE.isDown || keys.Z.isDown || (pad && (pad.A || pad.X));

        this.fireCooldown -= delta;

        if (fireDown) {
            if (!this.fireHeld) {
                // Just pressed — fire a normal shot immediately
                this.fire();
                this.fireHeld = true;
                this.chargeTime = 0;
                this.charging = false;
                this.chargeReady = false;
            } else {
                // Holding — accumulate charge time (cap at full)
                this.chargeTime = Math.min(this.chargeTime + delta, PLAYER.CHARGE_TIME_MS);

                if (this.chargeTime >= PLAYER.CHARGE_TIME_MS) {
                    this.chargeReady = true;
                }
                // NO normal shots while charging — hold = commit to charging
            }
        } else {
            if (this.fireHeld) {
                // Released — fire charged shot if fully charged
                if (this.chargeReady) {
                    this.fireCharged();
                }
                this.fireHeld = false;
                this.charging = false;
                this.chargeTime = 0;
                this.chargeReady = false;
            }
        }

        // Update charge bar position
        const barY = this.mainShip.y + 22;
        this.chargeBarBg.setPosition(this.mainShip.x - 16, barY);
        const chargePercent = this.fireHeld ? Math.min(this.chargeTime / PLAYER.CHARGE_TIME_MS, 1) : 0;
        this.chargeBar.setPosition(this.mainShip.x - 16, barY);
        this.chargeBar.width = 32 * chargePercent;

        if (this.chargeReady && this.fireHeld) {
            // Fully charged, waiting for release — bright pulsing "READY" state
            const pulse = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
            this.chargeBar.setFillStyle(0xffff00, pulse);
            this.mainShip.setTint(0xffff88);
        } else if (chargePercent >= 0.8 && this.fireHeld) {
            // Almost ready — pulsing yellow/white
            const pulse = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;
            this.chargeBar.setFillStyle(0xffff88, pulse);
            this.mainShip.setTint(0xaaffff);
        } else if (chargePercent > 0 && this.fireHeld) {
            // Charging — cyan bar growing
            this.chargeBar.setFillStyle(0x00ffff, 0.8);
        } else {
            this.chargeBar.setFillStyle(0x00ffff, 0);
            if (!this.invulnerable) this.mainShip.clearTint();
        }

        // Shield visual
        if (this.scene.activePowerups.force_field) {
            if (!this.shieldSprite) {
                this.shieldSprite = this.scene.add.image(this.mainShip.x, this.mainShip.y, 'shield')
                    .setDepth(11).setScale(1.2);
            }
            this.shieldSprite.setPosition(this.mainShip.x, this.mainShip.y);
            this.shieldSprite.rotation += 0.02;
        } else if (this.shieldSprite) {
            this.shieldSprite.destroy();
            this.shieldSprite = null;
        }

        // Invulnerability blink
        if (this.invulnerable) {
            this.mainShip.setAlpha(Math.sin(time * 0.01) > 0 ? 1 : 0.3);
        }

        // Engine exhaust particles
        this.exhaustTimer += delta;
        if (this.exhaustTimer > 60) { // spawn every ~60ms
            this.exhaustTimer = 0;
            this.ships.forEach(ship => {
                if (!ship.active) return;
                if (this.exhaustParticles.length >= 10) {
                    // Reuse oldest particle
                    const old = this.exhaustParticles.shift();
                    if (old && old.active !== false) old.destroy();
                }
                const px = ship.x + Phaser.Math.FloatBetween(-3, 3);
                const py = ship.y + 16;
                const p = this.scene.add.image(px, py, 'particle_sm')
                    .setTint(0x0088ff).setAlpha(0.6).setDepth(9);
                this.exhaustParticles.push(p);

                this.scene.tweens.add({
                    targets: p,
                    y: py + Phaser.Math.Between(12, 22),
                    alpha: 0,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    duration: Phaser.Math.Between(200, 350),
                    onComplete: () => {
                        const idx = this.exhaustParticles.indexOf(p);
                        if (idx > -1) this.exhaustParticles.splice(idx, 1);
                        p.destroy();
                    }
                });
            });

            // Tier 5 aura effect
            if (this.scene.cosmeticTier >= 5) {
                const ship = this.mainShip;
                if (ship.active && this.exhaustParticles.length < 10) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Phaser.Math.Between(10, 18);
                    const ax = ship.x + Math.cos(angle) * dist;
                    const ay = ship.y + Math.sin(angle) * dist;
                    const aura = this.scene.add.image(ax, ay, 'particle_sm')
                        .setTint(0x44ffff).setAlpha(0.3).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
                    this.exhaustParticles.push(aura);
                    this.scene.tweens.add({
                        targets: aura,
                        alpha: 0,
                        duration: Phaser.Math.Between(150, 300),
                        onComplete: () => {
                            const idx = this.exhaustParticles.indexOf(aura);
                            if (idx > -1) this.exhaustParticles.splice(idx, 1);
                            aura.destroy();
                        }
                    });
                }
            }
        }
    }

    fire() {
        if (this.fireCooldown > 0) return;
        this.fireCooldown = 150; // ms between shots
        audio.play('shoot');

        // Track shots fired
        if (this.scene.totalShotsFired !== undefined) {
            this.scene.totalShotsFired++;
        }

        const hasDual = !!this.scene.activePowerups.dual_laser;
        const hasSpread = !!this.scene.activePowerups.spread_blast;
        const hasRicochet = !!this.scene.activePowerups.ricochet;

        this.ships.forEach(ship => {
            if (!ship.active) return;

            if (hasSpread) {
                this.fireSpread(ship, hasRicochet);
            } else if (hasDual) {
                this.fireDual(ship, hasRicochet);
            } else {
                this.fireSingle(ship, hasRicochet);
            }
        });
    }

    fireSingle(ship, ricochet = false) {
        const bullet = this.scene.playerBullets.get(ship.x, ship.y - 18, 'bullet');
        if (!bullet) return;
        bullet.setActive(true).setVisible(true);
        bullet.setTexture('bullet');
        bullet.setScale(1);
        bullet.setData('damage', 1);
        bullet.setData('piercing', false);
        bullet.setData('ricochet', ricochet);
        bullet.setData('bounces', 0);
        bullet.body.setSize(4, 8);

        if (ricochet) {
            // Fire at a steep angle so it bounces aggressively across the screen
            const angle = Phaser.Math.FloatBetween(0.5, 0.8) * (Math.random() < 0.5 ? -1 : 1);
            bullet.body.setVelocity(
                Math.sin(angle) * PLAYER.SHOT_SPEED * 1.2,
                -PLAYER.SHOT_SPEED * 1.1
            );
            bullet.setTint(0xaaff00); // Green tint to show ricochet
            this.setupRicochet(bullet);
        } else {
            bullet.body.setVelocity(0, -PLAYER.SHOT_SPEED);
            bullet.setTint(0xffffff);
        }
        bullet.setDepth(8);
    }

    fireDual(ship, ricochet = false) {
        const offsets = ricochet ? [-6, 6] : [-6, 6];
        offsets.forEach((offset, i) => {
            const bullet = this.scene.playerBullets.get(ship.x + offset, ship.y - 18, 'bullet');
            if (!bullet) return;
            bullet.setActive(true).setVisible(true);
            bullet.setTexture('bullet');
            bullet.setScale(1);
            bullet.setData('damage', 1);
            bullet.setData('piercing', false);
            bullet.setData('ricochet', ricochet);
            bullet.setData('bounces', 0);
            bullet.body.setSize(4, 8);

            if (ricochet) {
                // Dual ricochet fires in a wide V pattern
                const angle = i === 0 ? -0.7 : 0.7;
                bullet.body.setVelocity(
                    Math.sin(angle) * PLAYER.SHOT_SPEED * 1.2,
                    -PLAYER.SHOT_SPEED * 1.1
                );
                bullet.setTint(0xaaff00);
                this.setupRicochet(bullet);
            } else {
                bullet.body.setVelocity(0, -PLAYER.SHOT_SPEED);
                bullet.setTint(0xffffff);
            }
            bullet.setDepth(8);
        });
    }

    fireSpread(ship, ricochet = false) {
        const angles = [-30, -15, 0, 15, 30];
        angles.forEach(deg => {
            const rad = Phaser.Math.DegToRad(deg - 90);
            const bullet = this.scene.playerBullets.get(ship.x, ship.y - 14, 'bullet');
            if (!bullet) return;
            bullet.setActive(true).setVisible(true);
            bullet.setTexture('bullet');
            bullet.setScale(1);
            bullet.setData('damage', 1);
            bullet.setData('piercing', false);
            bullet.setData('ricochet', ricochet);
            bullet.setData('bounces', 0);
            bullet.body.setSize(4, 8);
            bullet.body.setVelocity(
                Math.cos(rad) * PLAYER.SHOT_SPEED,
                Math.sin(rad) * PLAYER.SHOT_SPEED
            );
            bullet.setDepth(8);
            if (ricochet) {
                bullet.setTint(0xaaff00);
                this.setupRicochet(bullet);
            } else {
                bullet.setTint(0xffffff);
            }
        });
    }

    fireCharged() {
        audio.play('charged_shot');
        this.ships.forEach(ship => {
            if (!ship.active) return;
            const bullet = this.scene.playerBullets.get(ship.x, ship.y - 24, 'charged_shot');
            if (!bullet) return;
            bullet.setActive(true).setVisible(true);
            bullet.setTexture('charged_shot');
            bullet.setScale(2);
            bullet.setTint(0x88ffff);
            bullet.setData('damage', PLAYER.CHARGED_SHOT_DAMAGE);
            bullet.setData('piercing', true);
            bullet.setData('ricochet', false);
            bullet.body.setSize(24, 40);
            bullet.body.setVelocity(0, -PLAYER.SHOT_SPEED * 1.3);
            bullet.setDepth(9);
        });

        this.scene.cameras.main.shake(200, 0.01);
        this.scene.cameras.main.flash(100, 100, 255, 255, true);
    }

    setupRicochet(bullet) {
        // Check bounds each frame for ricochet
        const checkBounds = () => {
            if (!bullet.active) return;
            const bounces = bullet.getData('bounces') || 0;
            if (bounces >= 3) return;

            if (bullet.x <= 4 || bullet.x >= GAME_WIDTH - 4) {
                bullet.body.velocity.x *= -1;
                bullet.x = Phaser.Math.Clamp(bullet.x, 5, GAME_WIDTH - 5);
                bullet.setData('bounces', bounces + 1);
            }
        };
        // Use scene update event
        this.scene.events.on('update', checkBounds);
        // Clean up when bullet deactivated
        const origSetActive = bullet.setActive.bind(bullet);
        bullet.setActive = (value) => {
            if (!value) this.scene.events.off('update', checkBounds);
            return origSetActive(value);
        };
    }

    // Multi-ship support
    activateMultiShip() {
        if (this.ships.length >= 3) {
            // Repair destroyed ships
            while (this.ships.length < 3) {
                const offset = this.ships.length === 1 ? -PLAYER.SHIP_WIDTH * 1.5 : PLAYER.SHIP_WIDTH * 1.5;
                const newShip = this.createShip(this.mainShip.x + offset, this.mainShip.y);
                this.ships.push(newShip);
            }
            return;
        }

        // Spawn flanking ships
        const offsets = [-PLAYER.SHIP_WIDTH * 1.5, PLAYER.SHIP_WIDTH * 1.5];
        offsets.forEach(offset => {
            if (this.ships.length >= 3) return;
            const newShip = this.createShip(this.mainShip.x + offset, this.mainShip.y);
            this.ships.push(newShip);
        });
    }

    destroyShip(ship) {
        const idx = this.ships.indexOf(ship);
        if (idx > -1) {
            this.ships.splice(idx, 1);
            ship.setActive(false).setVisible(false);
            ship.body.enable = false;
        }

        // If main ship was destroyed, promote next
        if (ship === this.mainShip && this.ships.length > 0) {
            this.mainShip = this.ships[0];
        }
    }

    respawn() {
        this.mainShip.setPosition(GAME_WIDTH / 2, GAME_HEIGHT * (1 - PLAYER.BOTTOM_MARGIN));
        this.mainShip.setActive(true).setVisible(true);
        this.mainShip.body.enable = true;
        this.ships = [this.mainShip];
        this.invulnerable = true;
        this.velocity = 0;

        this.scene.time.delayedCall(PLAYER.RESPAWN_INVULN_MS, () => {
            this.invulnerable = false;
            this.mainShip.setAlpha(1);
            this.mainShip.clearTint();
        });
    }

    hide() {
        this.ships.forEach(s => {
            s.setActive(false).setVisible(false);
            s.body.enable = false;
        });
        this.chargeBar.setVisible(false);
        this.chargeBarBg.setVisible(false);
    }
}
