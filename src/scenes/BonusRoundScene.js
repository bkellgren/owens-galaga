import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENEMY_TYPES, COLORS } from '../constants.js';
import { StarField } from '../systems/StarField.js';
import { audio } from '../systems/AudioManager.js';

export class BonusRoundScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BonusRoundScene' });
    }

    init(data) {
        this.score = data.score || 0;
        this.level = data.level || 1;
        this.difficulty = data.difficulty;
        this.diffMod = data.diffMod;
        this.lives = data.lives;
        this.bombs = data.bombs;
        this.cosmeticTier = data.cosmeticTier || 0;
        this.activePowerups = data.activePowerups || {};
        this.highScore = data.highScore || 0;
        this.nextExtraLife = data.nextExtraLife || 50000;
    }

    create() {
        this.cameras.main.fadeIn(500);
        audio.startMusic('bonus');

        // Starfield
        this.starField = new StarField(this);

        // Physics group for bonus enemies (they don't shoot)
        this.enemies = this.physics.add.group();
        this.playerBullets = this.physics.add.group({ maxSize: 30 });

        // Player (simplified — just ship + shooting, no powerups)
        const tierKey = this.cosmeticTier > 0 ? `player_ship_t${this.cosmeticTier}` : 'player_ship';
        this.playerShip = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.9, tierKey);
        this.playerShip.setDepth(10);
        this.playerShip.setCollideWorldBounds(true);
        this.playerShip.body.setSize(20, 24);
        this.playerVelocity = 0;

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            A: this.input.keyboard.addKey('A'),
            D: this.input.keyboard.addKey('D'),
            SPACE: this.input.keyboard.addKey('SPACE'),
            Z: this.input.keyboard.addKey('Z'),
        };
        this.fireCooldown = 0;

        // Collision
        this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitEnemy, null, this);

        // Tracking
        this.totalEnemies = 0;
        this.killedEnemies = 0;
        this.roundOver = false;
        this.roundTimer = 0;
        this.roundDuration = 25000; // 25 seconds

        // HUD
        this.scoreText = this.add.text(16, 8, `SCORE: ${this.score.toLocaleString()}`, {
            fontFamily: 'monospace', fontSize: '14px', color: COLORS.HUD_SCORE,
        }).setDepth(50);

        this.bonusTitle = this.add.text(GAME_WIDTH / 2, 30, '★ BONUS ROUND ★', {
            fontFamily: 'monospace', fontSize: '20px', color: '#ffff00',
        }).setOrigin(0.5).setDepth(50);

        this.killCountText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, '', {
            fontFamily: 'monospace', fontSize: '14px', color: '#00ffff',
        }).setOrigin(0.5).setDepth(50);

        // Start spawning enemy waves after a brief delay
        this.time.delayedCall(1000, () => this.spawnBonusWaves());
    }

    spawnBonusWaves() {
        // Multiple waves of enemies in scripted patterns — they don't shoot
        const patterns = [
            { type: 'vFormation', delay: 0, count: 5 },
            { type: 'snakeHorizontal', delay: 3000, count: 6 },
            { type: 'circleLoop', delay: 6500, count: 8 },
            { type: 'zigzag', delay: 10000, count: 7 },
            { type: 'crossPattern', delay: 14000, count: 8 },
        ];

        patterns.forEach(p => {
            this.time.delayedCall(p.delay, () => {
                if (this.roundOver) return;
                this.spawnPattern(p.type, p.count);
            });
        });
    }

    spawnPattern(type, count) {
        this.totalEnemies += count;

        switch (type) {
            case 'vFormation':
                this.spawnVFormation(count);
                break;
            case 'snakeHorizontal':
                this.spawnSnakeHorizontal(count);
                break;
            case 'circleLoop':
                this.spawnCircleLoop(count);
                break;
            case 'zigzag':
                this.spawnZigzag(count);
                break;
            case 'crossPattern':
                this.spawnCrossPattern(count);
                break;
        }
    }

    createBonusEnemy(x, y) {
        const typePool = [ENEMY_TYPES.GRUNT, ENEMY_TYPES.SWOOPER];
        const typeInfo = Phaser.Utils.Array.GetRandom(typePool);
        const enemy = this.physics.add.sprite(x, y, `enemy_${typeInfo.key}`);
        enemy.setData('hp', 1); // Always 1 HP in bonus round
        enemy.setData('type', typeInfo.key);
        enemy.setData('points', typeInfo.points * 2); // Double points in bonus
        enemy.setData('color', typeInfo.color);
        enemy.body.setSize(typeInfo.width * 0.7, typeInfo.height * 0.7);
        enemy.setDepth(5);
        this.enemies.add(enemy);
        return enemy;
    }

    // --- Scripted Patterns ---

    spawnVFormation(count) {
        for (let i = 0; i < count; i++) {
            const enemy = this.createBonusEnemy(GAME_WIDTH / 2 - 100, -30 - i * 30);
            const offsetX = (i - Math.floor(count / 2)) * 40;
            const offsetY = Math.abs(i - Math.floor(count / 2)) * 20;

            this.time.delayedCall(i * 150, () => {
                if (!enemy.active) return;
                // V formation flies down, then curves off screen
                this.tweens.add({
                    targets: enemy,
                    x: GAME_WIDTH / 2 + offsetX,
                    y: GAME_HEIGHT * 0.4 + offsetY,
                    duration: 1500,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (!enemy.active) return;
                        this.tweens.add({
                            targets: enemy,
                            x: GAME_WIDTH + 50,
                            y: -50,
                            duration: 2000,
                            ease: 'Sine.easeIn',
                            onComplete: () => this.removeBonusEnemy(enemy),
                        });
                    }
                });
            });
        }
    }

    spawnSnakeHorizontal(count) {
        for (let i = 0; i < count; i++) {
            const enemy = this.createBonusEnemy(-30, 100);

            this.time.delayedCall(i * 200, () => {
                if (!enemy.active) return;
                // Snake across screen with sine wave
                const duration = 4000;
                this.tweens.add({
                    targets: enemy,
                    x: { from: -30, to: GAME_WIDTH + 30 },
                    duration,
                    ease: 'Linear',
                    onUpdate: (tween) => {
                        if (!enemy.active) return;
                        const progress = tween.progress;
                        enemy.y = 120 + i * 30 + Math.sin(progress * Math.PI * 3) * 60;
                    },
                    onComplete: () => this.removeBonusEnemy(enemy),
                });
            });
        }
    }

    spawnCircleLoop(count) {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT * 0.35;
        const radius = 100;

        for (let i = 0; i < count; i++) {
            const enemy = this.createBonusEnemy(cx, -30);

            this.time.delayedCall(i * 180, () => {
                if (!enemy.active) return;
                // Enter from top, loop in a circle, exit bottom
                const enterDuration = 800;
                this.tweens.add({
                    targets: enemy,
                    y: cy - radius,
                    duration: enterDuration,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (!enemy.active) return;
                        // Circle loop
                        const startAngle = -Math.PI / 2;
                        const loopDuration = 2500;
                        this.tweens.add({
                            targets: enemy,
                            angle: { from: 0, to: 360 },
                            duration: loopDuration,
                            ease: 'Linear',
                            onUpdate: (tween) => {
                                if (!enemy.active) return;
                                const a = startAngle + tween.progress * Math.PI * 2;
                                enemy.x = cx + Math.cos(a) * radius;
                                enemy.y = cy + Math.sin(a) * radius;
                            },
                            onComplete: () => {
                                if (!enemy.active) return;
                                // Exit off bottom
                                this.tweens.add({
                                    targets: enemy,
                                    y: GAME_HEIGHT + 50,
                                    duration: 1000,
                                    ease: 'Quad.easeIn',
                                    onComplete: () => this.removeBonusEnemy(enemy),
                                });
                            }
                        });
                    }
                });
            });
        }
    }

    spawnZigzag(count) {
        for (let i = 0; i < count; i++) {
            const startRight = i % 2 === 0;
            const enemy = this.createBonusEnemy(startRight ? GAME_WIDTH + 30 : -30, 80 + i * 25);

            this.time.delayedCall(i * 250, () => {
                if (!enemy.active) return;
                const duration = 3500;
                const segments = 4;

                const animateSegment = (seg) => {
                    if (!enemy.active || seg >= segments) {
                        this.removeBonusEnemy(enemy);
                        return;
                    }
                    const goRight = (startRight ? seg % 2 === 1 : seg % 2 === 0);
                    const targetX = goRight ? GAME_WIDTH - 40 : 40;
                    const targetY = enemy.y + 50;

                    this.tweens.add({
                        targets: enemy,
                        x: targetX,
                        y: targetY,
                        duration: duration / segments,
                        ease: 'Sine.easeInOut',
                        onComplete: () => animateSegment(seg + 1),
                    });
                };
                animateSegment(0);
            });
        }
    }

    spawnCrossPattern(count) {
        const half = Math.floor(count / 2);
        // Left-to-right diagonal group
        for (let i = 0; i < half; i++) {
            const enemy = this.createBonusEnemy(-30, -30 - i * 40);
            this.time.delayedCall(i * 200, () => {
                if (!enemy.active) return;
                this.tweens.add({
                    targets: enemy,
                    x: GAME_WIDTH + 30,
                    y: GAME_HEIGHT + 30,
                    duration: 3000,
                    ease: 'Linear',
                    onComplete: () => this.removeBonusEnemy(enemy),
                });
            });
        }
        // Right-to-left diagonal group
        for (let i = 0; i < count - half; i++) {
            const enemy = this.createBonusEnemy(GAME_WIDTH + 30, -30 - i * 40);
            this.time.delayedCall(i * 200 + 500, () => {
                if (!enemy.active) return;
                this.tweens.add({
                    targets: enemy,
                    x: -30,
                    y: GAME_HEIGHT + 30,
                    duration: 3000,
                    ease: 'Linear',
                    onComplete: () => this.removeBonusEnemy(enemy),
                });
            });
        }
    }

    removeBonusEnemy(enemy) {
        if (!enemy.active) return;
        enemy.setActive(false).setVisible(false);
        if (enemy.body) {
            enemy.body.stop();
            enemy.body.enable = false;
        }
    }

    // --- Update ---

    update(time, delta) {
        if (this.roundOver) return;

        this.starField.update(delta);

        // Player movement
        let moveDir = 0;
        if (this.cursors.left.isDown || this.keys.A.isDown) moveDir = -1;
        else if (this.cursors.right.isDown || this.keys.D.isDown) moveDir = 1;

        const pad = this.input.gamepad.getPad(0);
        if (pad) {
            const axisH = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
            if (axisH < -0.3) moveDir = -1;
            else if (axisH > 0.3) moveDir = 1;
        }

        const speed = 280;
        if (moveDir !== 0) {
            this.playerVelocity = Phaser.Math.Clamp(
                this.playerVelocity + moveDir * 1200 * (delta / 1000),
                -speed, speed
            );
        } else {
            if (Math.abs(this.playerVelocity) < 20) {
                this.playerVelocity = 0;
            } else {
                this.playerVelocity -= Math.sign(this.playerVelocity) * 800 * (delta / 1000);
            }
        }
        this.playerShip.x += this.playerVelocity * (delta / 1000);
        this.playerShip.x = Phaser.Math.Clamp(this.playerShip.x, 16, GAME_WIDTH - 16);

        // Firing
        this.fireCooldown -= delta;
        const fireDown = this.keys.SPACE.isDown || this.keys.Z.isDown || (pad && (pad.A || pad.X));
        if (fireDown && this.fireCooldown <= 0) {
            this.fireCooldown = 150;
            const bullet = this.playerBullets.get(this.playerShip.x, this.playerShip.y - 18, 'bullet');
            if (bullet) {
                bullet.setActive(true).setVisible(true);
                bullet.setTexture('bullet');
                bullet.body.setVelocity(0, -500);
                bullet.setDepth(8);
            }
        }

        // Clean off-screen bullets
        this.playerBullets.getChildren().forEach(b => {
            if (b.active && b.y < -20) {
                b.setActive(false).setVisible(false);
                b.body.stop();
            }
        });

        // Update kill count display
        this.killCountText.setText(`${this.killedEnemies} / ${this.totalEnemies}`);
        this.scoreText.setText(`SCORE: ${this.score.toLocaleString()}`);

        // Round timer
        this.roundTimer += delta;
        if (this.roundTimer >= this.roundDuration) {
            this.endRound();
        }
    }

    onBulletHitEnemy(bullet, enemy) {
        if (!bullet.active || !enemy.active) return;

        bullet.setActive(false).setVisible(false);
        bullet.body.stop();

        const points = enemy.getData('points') || 200;
        this.score += points;
        this.killedEnemies++;

        // Small explosion
        this.spawnExplosion(enemy.x, enemy.y, 6, enemy.getData('color') || 0xffaa44);

        enemy.setActive(false).setVisible(false);
        enemy.body.stop();
        if (enemy.body) enemy.body.enable = false;
    }

    endRound() {
        if (this.roundOver) return;
        this.roundOver = true;

        // Calculate bonus
        const isPerfect = this.killedEnemies >= this.totalEnemies && this.totalEnemies > 0;
        const hitRate = this.totalEnemies > 0 ? this.killedEnemies / this.totalEnemies : 0;
        const baseBonus = this.killedEnemies * 200;
        const perfectBonus = isPerfect ? 10000 : 0;
        const totalBonus = baseBonus + perfectBonus;

        this.score += totalBonus;

        // Show results
        const resultsY = GAME_HEIGHT / 2 - 60;

        this.add.text(GAME_WIDTH / 2, resultsY, 'BONUS ROUND COMPLETE', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(50);

        this.add.text(GAME_WIDTH / 2, resultsY + 35, `ENEMIES HIT: ${this.killedEnemies} / ${this.totalEnemies}`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#00ffff',
        }).setOrigin(0.5).setDepth(50);

        this.add.text(GAME_WIDTH / 2, resultsY + 60, `HIT RATE: ${Math.round(hitRate * 100)}%`, {
            fontFamily: 'monospace', fontSize: '14px', color: '#00ffff',
        }).setOrigin(0.5).setDepth(50);

        this.add.text(GAME_WIDTH / 2, resultsY + 90, `BONUS: +${totalBonus.toLocaleString()}`, {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffff00',
        }).setOrigin(0.5).setDepth(50);

        if (isPerfect) {
            const perfectText = this.add.text(GAME_WIDTH / 2, resultsY + 125, '★ PERFECT! ★', {
                fontFamily: 'monospace', fontSize: '24px', color: '#ff8800',
            }).setOrigin(0.5).setDepth(50);

            this.tweens.add({
                targets: perfectText,
                scale: { from: 1, to: 1.3 },
                duration: 500,
                yoyo: true,
                repeat: 3,
            });
        }

        // Return to game after showing results
        this.time.delayedCall(4000, () => {
            audio.stopMusic();
            this.scene.start('GameScene', {
                score: this.score,
                level: this.level,
                difficulty: this.difficulty,
                lives: this.lives,
                bombs: this.bombs,
                cosmeticTier: this.cosmeticTier,
                activePowerups: this.activePowerups,
                highScore: this.highScore,
                nextExtraLife: this.nextExtraLife,
                returnFromBonus: true,
            });
        });
    }

    spawnExplosion(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const p = this.add.image(x, y, 'particle').setTint(color).setDepth(30);
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(30, 100);
            const life = Phaser.Math.Between(200, 400);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0.5,
                duration: life,
                onComplete: () => p.destroy(),
            });
        }
    }
}
