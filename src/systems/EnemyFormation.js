import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENEMY_TYPES, PLAYER } from '../constants.js';
import { audio } from '../systems/AudioManager.js';

export class EnemyFormation {
    constructor(scene) {
        this.scene = scene;
        this.formationEnemies = [];
        this.formationTime = 0;
        this.diveTimer = 0;
        this.diveInterval = 3000; // ms between dive attacks (decreases with level)
        this.areaDenialZones = []; // Active bomber hazard zones
    }

    spawnWave(waveData, onComplete) {
        this.formationEnemies = [];
        const entries = waveData.enemies;
        const totalDelay = entries.length * 150;

        entries.forEach((entry, i) => {
            this.scene.time.delayedCall(i * 150, () => {
                const enemy = this.spawnFromEntry(entry);
                if (enemy) {
                    this.formationEnemies.push(enemy);
                }
            });
        });

        this.scene.time.delayedCall(totalDelay + 500, () => {
            this.formationEnemies.forEach(e => {
                if (e.active) e.setData('inFormation', true);
            });
            if (onComplete) onComplete();
        });

        // Adjust dive interval based on level — Galaga-style: dives are uncommon events
        // Base interval is long; slowly ramps up but never becomes a constant barrage
        this.diveInterval = Math.max(2500, 6000 - this.scene.level * 150);
        this.diveTimer = this.diveInterval;
    }

    spawnFromEntry(entry) {
        const typeInfo = entry.type;
        const startX = entry.startX || Phaser.Math.Between(40, GAME_WIDTH - 40);
        const startY = -40;
        const targetX = entry.formX;
        const targetY = entry.formY;

        return this.spawnWithEntryPath(typeInfo, startX, startY, targetX, targetY, entry.pathType || 'arc');
    }

    spawnWithEntryPath(typeInfo, startX, startY, targetX, targetY, pathType) {
        const enemy = this.scene.physics.add.sprite(startX, startY, `enemy_${typeInfo.key}`);
        const hpMult = this.scene.diffMod.hpMult;
        enemy.setData('hp', Math.ceil(typeInfo.hp * hpMult));
        enemy.setData('type', typeInfo.key);
        enemy.setData('points', typeInfo.points);
        enemy.setData('dropChance', typeInfo.dropChance);
        enemy.setData('color', typeInfo.color);
        enemy.setData('inFormation', false);
        enemy.setData('formX', targetX);
        enemy.setData('formY', targetY);
        enemy.setData('diving', false);
        enemy.body.setSize(typeInfo.width * 0.7, typeInfo.height * 0.7);
        enemy.setDepth(5);
        this.scene.enemies.add(enemy);

        // Entry path animation
        const duration = Phaser.Math.Between(1500, 2500);

        if (pathType === 'arc') {
            // Arc entry
            const midX = (startX + targetX) / 2 + Phaser.Math.Between(-80, 80);
            const midY = (startY + targetY) / 2;

            this.scene.tweens.add({
                targets: enemy,
                x: { value: targetX, duration },
                y: { value: targetY, duration },
                ease: 'Sine.easeOut',
            });
        } else if (pathType === 'spiral') {
            // Spiral in — using chained tweens
            const steps = 8;

            const createStep = (stepIndex) => {
                if (!enemy.active) return;
                const t = (stepIndex + 1) / steps;
                const angle = t * Math.PI * 3;
                const radius = (1 - t) * 80;
                const ix = targetX + Math.cos(angle) * radius;
                const iy = Phaser.Math.Linear(startY, targetY, t) + Math.sin(angle) * radius * 0.5;

                this.scene.tweens.add({
                    targets: enemy,
                    x: ix, y: iy,
                    duration: duration / steps,
                    ease: 'Linear',
                    onComplete: () => {
                        if (stepIndex < steps - 1) {
                            createStep(stepIndex + 1);
                        } else {
                            // Final snap to formation position
                            this.scene.tweens.add({
                                targets: enemy,
                                x: targetX, y: targetY,
                                duration: 200,
                            });
                        }
                    }
                });
            };

            createStep(0);
        } else {
            // Straight drop
            this.scene.tweens.add({
                targets: enemy,
                x: targetX,
                y: targetY,
                duration,
                ease: 'Power2',
            });
        }

        return enemy;
    }

    spawnSingleEnemy(typeInfo, x, y) {
        const enemy = this.scene.physics.add.sprite(x, y, `enemy_${typeInfo.key}`);
        const hpMult = this.scene.diffMod.hpMult;
        enemy.setData('hp', Math.ceil(typeInfo.hp * hpMult));
        enemy.setData('type', typeInfo.key);
        enemy.setData('points', typeInfo.points);
        enemy.setData('dropChance', typeInfo.dropChance);
        enemy.setData('color', typeInfo.color);
        enemy.setData('inFormation', false);
        enemy.setData('diving', false);
        enemy.body.setSize(typeInfo.width * 0.7, typeInfo.height * 0.7);
        enemy.setDepth(5);
        this.scene.enemies.add(enemy);
        return enemy;
    }

    update(time, delta) {
        // Formation sway
        this.formationTime += delta * 0.001;
        const swayX = Math.sin(this.formationTime * 0.8) * 15;
        const swayY = Math.sin(this.formationTime * 1.2) * 5;

        this.formationEnemies.forEach(enemy => {
            if (!enemy.active) return;
            if (enemy.getData('inFormation') && !enemy.getData('diving')) {
                enemy.x = enemy.getData('formX') + swayX;
                enemy.y = enemy.getData('formY') + swayY;
            }

            // SAFETY: Force-return any enemy that has been diving too long
            if (enemy.getData('diving')) {
                const diveStart = enemy.getData('diveStartTime') || time;
                if (time - diveStart > 6000) {
                    // Been diving for 6+ seconds — force return
                    this.scene.tweens.killTweensOf(enemy);
                    this.returnToFormation(enemy);
                }
                // Also catch enemies that went off screen and got stuck
                if (enemy.x < -50 || enemy.x > GAME_WIDTH + 50 || enemy.y > GAME_HEIGHT + 80 || enemy.y < -60) {
                    this.scene.tweens.killTweensOf(enemy);
                    this.returnToFormation(enemy);
                }
            }
        });

        // Dive attacks
        this.diveTimer -= delta;
        if (this.diveTimer <= 0) {
            this.diveTimer = this.diveInterval / this.scene.diffMod.diveFreqMult;
            this.triggerDive();
        }

        // Enemy shooting (for types that fire)
        this.formationEnemies.forEach(enemy => {
            if (!enemy.active) return;
            if (!enemy.getData('inFormation')) return; // Only fire from formation
            const type = enemy.getData('type');
            if (!enemy.getData('lastShot')) enemy.setData('lastShot', time);

            if (type === 'tank' || type === 'elite') {
                // Tanks and elites fire frequently from formation
                const shootInterval = 2500 / this.scene.diffMod.diveFreqMult;
                if (time - enemy.getData('lastShot') > shootInterval) {
                    this.enemyFire(enemy);
                    enemy.setData('lastShot', time);
                }
            } else if (type === 'bomber') {
                // Bombers drop area-denial zones
                const dropInterval = 4000 / this.scene.diffMod.diveFreqMult;
                if (time - enemy.getData('lastShot') > dropInterval) {
                    this.bomberDropZone(enemy);
                    enemy.setData('lastShot', time);
                }
            } else if (type === 'grunt' || type === 'swooper') {
                // Grunts and swoopers occasionally fire from formation
                // — classic Galaga rain of bullets from the grid
                const shootInterval = (4500 - this.scene.level * 100) / this.scene.diffMod.diveFreqMult;
                const clampedInterval = Math.max(2000, shootInterval);
                if (time - enemy.getData('lastShot') > clampedInterval) {
                    // Not every grunt fires every cycle — ~40% chance
                    if (Math.random() < 0.4) {
                        this.enemyFire(enemy);
                    }
                    enemy.setData('lastShot', time);
                }
            }
        });

        // Update area-denial zones — check player collision and expire them
        this.updateAreaDenialZones(time, delta);

        // Update captured ship visuals
        this.updateCapturedShips();

        // Clean dead enemies from formation list
        this.formationEnemies = this.formationEnemies.filter(e => e.active);
    }

    // --- Bomber Area-Denial ---

    bomberDropZone(enemy) {
        if (!enemy.active) return;

        // Drop toward the player's horizontal position with some spread
        const playerX = this.scene.player.mainShip.x;
        const targetX = Phaser.Math.Clamp(
            playerX + Phaser.Math.Between(-60, 60),
            30, GAME_WIDTH - 30
        );
        const targetY = GAME_HEIGHT * Phaser.Math.FloatBetween(0.55, 0.85);

        // Create the projectile that falls into position
        const proj = this.scene.add.image(enemy.x, enemy.y, 'area_denial')
            .setScale(0.3)
            .setAlpha(0.8)
            .setDepth(4);

        this.scene.tweens.add({
            targets: proj,
            x: targetX,
            y: targetY,
            duration: 600,
            ease: 'Quad.easeIn',
            onComplete: () => {
                // Arrived — create the lingering hazard zone
                this.createDenialZone(targetX, targetY);
                proj.destroy();
            }
        });
    }

    createDenialZone(x, y) {
        const zone = this.scene.add.image(x, y, 'area_denial')
            .setScale(0.5)
            .setAlpha(0)
            .setDepth(4);

        // Expand in with a pop
        this.scene.tweens.add({
            targets: zone,
            scale: 1.2,
            alpha: 0.7,
            duration: 200,
            ease: 'Back.easeOut',
        });

        const zoneData = {
            sprite: zone,
            x, y,
            radius: 22, // collision radius
            createdAt: this.scene.time.now,
            lifetime: 3000, // lingers for 3 seconds
        };

        this.areaDenialZones.push(zoneData);
    }

    updateAreaDenialZones(time, delta) {
        for (let i = this.areaDenialZones.length - 1; i >= 0; i--) {
            const zone = this.areaDenialZones[i];
            const age = time - zone.createdAt;

            if (age >= zone.lifetime) {
                // Fade out and remove
                this.scene.tweens.add({
                    targets: zone.sprite,
                    alpha: 0,
                    scale: 0.3,
                    duration: 300,
                    onComplete: () => zone.sprite.destroy(),
                });
                this.areaDenialZones.splice(i, 1);
                continue;
            }

            // Pulsing effect while active
            const pulse = 0.5 + Math.sin(time * 0.008) * 0.2;
            zone.sprite.setAlpha(pulse);
            zone.sprite.rotation += 0.015;

            // Warn before expiry — flash faster in last second
            if (age > zone.lifetime - 1000) {
                const flash = Math.sin(time * 0.02) > 0 ? 0.8 : 0.2;
                zone.sprite.setAlpha(flash);
            }

            // Check collision with player ships
            if (this.scene.player.invulnerable) continue;
            if (this.scene.activePowerups.force_field) continue;

            this.scene.player.ships.forEach(ship => {
                if (!ship.active) return;
                const dist = Phaser.Math.Distance.Between(zone.x, zone.y, ship.x, ship.y);
                if (dist < zone.radius + 10) {
                    // Player touched the hazard zone
                    this.scene.playerHit(ship);
                    // Remove zone after hitting
                    zone.sprite.destroy();
                    this.areaDenialZones.splice(i, 1);
                }
            });
        }
    }

    // Clean up all zones (on wave clear, level advance, etc.)
    clearAreaDenialZones() {
        this.areaDenialZones.forEach(z => z.sprite.destroy());
        this.areaDenialZones = [];
    }

    triggerDive() {
        const available = this.formationEnemies.filter(
            e => e.active && e.getData('inFormation') && !e.getData('diving')
        );
        if (available.length === 0) return;

        // Classic Galaga style: usually 1 diver, occasionally 2 at higher levels
        // Never more than 2 at once to keep it manageable
        const alreadyDiving = this.formationEnemies.filter(
            e => e.active && e.getData('diving')
        ).length;

        // Cap total divers at 2 (3 on hard at very high levels)
        const maxDivers = this.scene.level >= 15 ? 3 : 2;
        if (alreadyDiving >= maxDivers) return;

        // Usually send 1, small chance of 2 at higher levels
        let count = 1;
        if (this.scene.level >= 5 && Math.random() < 0.25) count = 2;
        count = Math.min(count, maxDivers - alreadyDiving, available.length);

        for (let i = 0; i < count; i++) {
            const enemy = Phaser.Utils.Array.RemoveRandomElement(available);
            this.startDive(enemy);
        }
    }

    startDive(enemy) {
        enemy.setData('diving', true);
        enemy.setData('inFormation', false);
        enemy.setData('diveStartTime', this.scene.time.now);

        const playerX = this.scene.player.mainShip.x;
        const playerY = this.scene.player.mainShip.y;
        const speed = (ENEMY_TYPES[enemy.getData('type').toUpperCase()]?.speed || 100)
            * this.scene.diffMod.enemySpeedMult
            * (1 + this.scene.level * 0.03);

        const type = enemy.getData('type');

        if (type === 'swooper') {
            // Erratic swooping dive
            const midX = Phaser.Math.Between(40, GAME_WIDTH - 40);
            const midY = GAME_HEIGHT * 0.5;

            this.scene.tweens.add({
                targets: enemy,
                x: midX,
                y: midY,
                duration: 600 / (speed / 100),
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (!enemy.active) return;
                    const targetX = Phaser.Math.Clamp(playerX + Phaser.Math.Between(-60, 60), 20, GAME_WIDTH - 20);
                    this.scene.tweens.add({
                        targets: enemy,
                        x: targetX,
                        y: GAME_HEIGHT + 40,
                        duration: 800 / (speed / 100),
                        ease: 'Quad.easeIn',
                        onComplete: () => this.returnToFormation(enemy),
                    });
                }
            });
        } else if (type === 'bomber') {
            // Bomber dive — drops an area-denial zone mid-dive then retreats
            const midX = Phaser.Math.Clamp(playerX + Phaser.Math.Between(-40, 40), 30, GAME_WIDTH - 30);
            const midY = GAME_HEIGHT * 0.45;

            this.scene.tweens.add({
                targets: enemy,
                x: midX,
                y: midY,
                duration: 900 / (speed / 100),
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (!enemy.active) return;
                    // Drop zone at current position
                    this.createDenialZone(enemy.x, enemy.y + 20);
                    // Pull back up
                    this.returnToFormation(enemy);
                }
            });
        } else if (type === 'elite' && !enemy.getData('hasCaptured') && this.shouldAttemptCapture(enemy)) {
            // Elite tractor beam dive — hovers above player and deploys beam
            this.eliteTractorDive(enemy, playerX);
        } else {
            // Standard dive toward player
            const targetX = Phaser.Math.Clamp(playerX + Phaser.Math.Between(-30, 30), 20, GAME_WIDTH - 20);
            this.scene.tweens.add({
                targets: enemy,
                x: targetX,
                y: GAME_HEIGHT + 40,
                duration: 1500 / (speed / 100),
                ease: 'Quad.easeIn',
                onComplete: () => this.returnToFormation(enemy),
            });
        }

        // Fire during dive (bombers drop zones, elites doing tractor don't fire)
        if (type !== 'bomber' && !(type === 'elite' && enemy.getData('tractorActive'))) {
            this.scene.time.delayedCall(300, () => {
                if (enemy.active && enemy.getData('diving')) {
                    this.enemyFire(enemy);
                }
            });
        }
    }

    // --- Tractor Beam / Ship Capture ---

    shouldAttemptCapture(enemy) {
        // Only attempt capture sometimes, and only after level 5
        if (this.scene.level < 5) return false;
        // Don't capture if player is invulnerable or has force field
        if (this.scene.player.invulnerable || this.scene.activePowerups.force_field) return false;
        // Chance increases with level
        const chance = Math.min(0.15 + this.scene.level * 0.02, 0.4);
        return Math.random() < chance;
    }

    eliteTractorDive(enemy, playerX) {
        enemy.setData('tractorActive', true);

        // Dive to hover position above player
        const hoverY = GAME_HEIGHT * 0.55;
        const hoverX = Phaser.Math.Clamp(playerX, 30, GAME_WIDTH - 30);

        this.scene.tweens.add({
            targets: enemy,
            x: hoverX,
            y: hoverY,
            duration: 800,
            ease: 'Sine.easeOut',
            onComplete: () => {
                if (!enemy.active) return;
                this.deployTractorBeam(enemy);
            }
        });
    }

    deployTractorBeam(enemy) {
        if (!enemy.active) return;
        audio.play('tractor_beam');

        // Create the visual beam extending downward from the elite
        const beam = this.scene.add.image(enemy.x, enemy.y + 60, 'tractor_beam')
            .setOrigin(0.5, 0)
            .setDepth(4)
            .setAlpha(0);

        // Beam appears with a flash
        this.scene.tweens.add({
            targets: beam,
            alpha: 0.8,
            duration: 300,
            yoyo: false,
        });

        // Beam stays active for 2 seconds, pulsing
        let beamActive = true;
        let captured = false;
        const beamDuration = 2000;
        const beamStartTime = this.scene.time.now;

        const updateBeam = () => {
            if (!beamActive || !enemy.active) {
                beam.destroy();
                this.scene.events.off('update', updateBeam);
                if (!captured && enemy.active) {
                    // Failed to capture — retreat
                    enemy.setData('tractorActive', false);
                    this.returnToFormation(enemy);
                }
                return;
            }

            // Follow the enemy
            beam.setPosition(enemy.x, enemy.y + 20);
            beam.setAlpha(0.5 + Math.sin(this.scene.time.now * 0.01) * 0.3);

            // Check if beam duration expired
            if (this.scene.time.now - beamStartTime > beamDuration) {
                beamActive = false;
                return;
            }

            // Check collision with player ships
            if (this.scene.player.invulnerable || this.scene.activePowerups.force_field) return;

            const beamLeft = enemy.x - 14;
            const beamRight = enemy.x + 14;
            const beamTop = enemy.y + 20;
            const beamBottom = enemy.y + 140;

            this.scene.player.ships.forEach(ship => {
                if (!ship.active || captured) return;
                if (ship.x > beamLeft && ship.x < beamRight &&
                    ship.y > beamTop && ship.y < beamBottom) {
                    // CAPTURED!
                    captured = true;
                    beamActive = false;
                    this.captureShip(enemy, ship, beam);
                }
            });
        };

        this.scene.events.on('update', updateBeam);
    }

    captureShip(elite, ship, beam) {
        const scene = this.scene;

        // Flash effect
        scene.cameras.main.flash(200, 255, 100, 255);
        scene.showFloatingText(ship.x, ship.y, 'CAPTURED!', '#ff44ff', 20);

        // Animate ship being pulled up to the elite
        const shipTexture = ship.texture.key;
        const capturedSprite = scene.add.sprite(ship.x, ship.y, shipTexture)
            .setDepth(6)
            .setTint(0xff88ff);

        // Remove the ship from player control
        if (scene.player.ships.length > 1) {
            scene.player.destroyShip(ship);
        } else {
            // Last ship — costs a life
            scene.player.destroyShip(ship);
            scene.lives--;
            if (scene.lives <= 0) {
                beam.destroy();
                capturedSprite.destroy();
                elite.setData('tractorActive', false);
                scene.doGameOver();
                return;
            }
        }

        // Pull captured ship up to elite position
        scene.tweens.add({
            targets: capturedSprite,
            x: elite.x,
            y: elite.y,
            duration: 800,
            ease: 'Sine.easeIn',
            onComplete: () => {
                beam.destroy();

                if (!elite.active) {
                    // Elite died during capture animation — ship is lost
                    capturedSprite.destroy();
                    return;
                }

                // Park the captured ship next to the elite in formation
                elite.setData('hasCaptured', true);
                elite.setData('capturedShip', capturedSprite);
                elite.setData('capturedShipTexture', shipTexture);
                elite.setData('tractorActive', false);

                // Return elite to formation with captured ship alongside
                this.returnToFormation(elite);

                // Respawn player if they lost their ship
                if (scene.player.ships.length === 0) {
                    scene.player.respawn();
                }
            }
        });
    }

    updateCapturedShips() {
        // Move captured ship sprites alongside their elite captors
        this.formationEnemies.forEach(enemy => {
            if (!enemy.active || !enemy.getData('hasCaptured')) return;
            const capturedSprite = enemy.getData('capturedShip');
            if (capturedSprite) {
                capturedSprite.setPosition(enemy.x + 20, enemy.y);
                capturedSprite.rotation = Math.PI; // Upside down — fighting for enemy now
                // Pulse to draw attention
                capturedSprite.setAlpha(0.7 + Math.sin(this.scene.time.now * 0.005) * 0.3);
            }
        });
    }

    rescueCapturedShip(elite) {
        // Called when an elite with a captured ship is killed
        const capturedSprite = elite.getData('capturedShip');
        const shipTexture = elite.getData('capturedShipTexture');
        if (!capturedSprite) return;

        const scene = this.scene;
        scene.showFloatingText(elite.x, elite.y - 20, 'SHIP RESCUED!', '#00ff00', 18);
        scene.cameras.main.flash(200, 100, 255, 100);

        // Animate rescued ship flying down to rejoin player
        scene.tweens.add({
            targets: capturedSprite,
            x: scene.player.mainShip.x + PLAYER.SHIP_WIDTH * 1.5,
            y: scene.player.mainShip.y,
            rotation: 0,
            duration: 1000,
            ease: 'Sine.easeOut',
            onComplete: () => {
                capturedSprite.destroy();
                // Add a ship to the player formation (like a mini multi-ship)
                if (scene.player.ships.length < 3) {
                    const offset = scene.player.ships.length === 1
                        ? PLAYER.SHIP_WIDTH * 1.5
                        : -PLAYER.SHIP_WIDTH * 1.5;
                    const newShip = scene.player.createShip(
                        scene.player.mainShip.x + offset,
                        scene.player.mainShip.y
                    );
                    scene.player.ships.push(newShip);
                }
            }
        });
    }

    returnToFormation(enemy) {
        if (!enemy.active) return;

        // Come back from bottom or top
        enemy.setPosition(
            enemy.getData('formX'),
            -30
        );

        this.scene.tweens.add({
            targets: enemy,
            y: enemy.getData('formY'),
            duration: 1000,
            ease: 'Sine.easeOut',
            onComplete: () => {
                if (enemy.active) {
                    enemy.setData('diving', false);
                    enemy.setData('inFormation', true);
                }
            }
        });
    }

    enemyFire(enemy) {
        if (!enemy.active) return;

        const bullet = this.scene.enemyBullets.get(enemy.x, enemy.y + 15, 'enemy_bullet');
        if (!bullet) return;

        bullet.setActive(true).setVisible(true);
        bullet.setDepth(6);

        // Aim roughly toward player
        const player = this.scene.player.mainShip;
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        const speed = (150 + this.scene.level * 5) * this.scene.diffMod.projectileSpeedMult;

        bullet.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
    }
}
