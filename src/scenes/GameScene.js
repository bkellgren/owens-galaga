import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, PLAYER, ENEMY_TYPES, POWERUP_TYPES,
    DIFFICULTY, DIFFICULTY_MODIFIERS, COMBO, POWERUP, BOMB, COLORS
} from '../constants.js';
import { Player } from '../entities/Player.js';
import { EnemyFormation } from '../systems/EnemyFormation.js';
import { PowerupManager } from '../systems/PowerupManager.js';
import { HUD } from '../systems/HUD.js';
import { StarField } from '../systems/StarField.js';
import { WaveGenerator } from '../systems/WaveGenerator.js';
import { EnvironmentalHazards } from '../systems/EnvironmentalHazards.js';
import { audio } from '../systems/AudioManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.difficulty = data.difficulty || DIFFICULTY.NORMAL;
        this.diffMod = DIFFICULTY_MODIFIERS[this.difficulty];
        this.returnFromBonus = data.returnFromBonus || false;
        this.initData = data;
    }

    create() {
        this.cameras.main.fadeIn(500);

        if (this.returnFromBonus) {
            // Returning from bonus round — restore state
            this.score = this.initData.score || 0;
            this.highScore = Math.max(this.getHighScore(), this.score);
            this.level = this.initData.level || 1;
            this.lives = this.initData.lives || PLAYER.STARTING_LIVES;
            this.bombs = this.initData.bombs || 0;
            this.cosmeticTier = this.initData.cosmeticTier || 0;
            this.nextExtraLife = this.initData.nextExtraLife || PLAYER.EXTRA_LIFE_SCORE;
        } else {
            // Fresh game
            this.score = 0;
            this.highScore = this.getHighScore();
            this.level = 1;
            this.lives = PLAYER.STARTING_LIVES;
            this.bombs = 0;
            this.cosmeticTier = 0;
            this.nextExtraLife = PLAYER.EXTRA_LIFE_SCORE;
        }

        this.activeBomb = null; // Currently flying bomb projectile
        this.paused = false;
        this.gameOver = false;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboMultiplier = 1;
        this.lastPowerupDropTime = 0;
        this.bossPhase = false;
        this.levelCleared = false;
        this.waveSpawning = false;
        this.timeSlow = false;
        this.timeSlowFactor = 1;

        // Stats tracking for Game Over screen
        this.totalKills = 0;
        this.totalShotsFired = 0;
        this.totalShotsHit = 0;
        this.maxCombo = 0;
        this.gameStartTime = Date.now();

        // Active timed powerups (restore from bonus or fresh)
        this.activePowerups = this.returnFromBonus ? (this.initData.activePowerups || {}) : {};

        // Starfield background
        this.starField = new StarField(this);

        // Physics groups
        this.playerBullets = this.physics.add.group({ maxSize: 30 });
        this.enemyBullets = this.physics.add.group({ maxSize: 60 });
        this.enemies = this.physics.add.group();
        this.powerups = this.physics.add.group();

        // Player
        this.player = new Player(this);

        // Enemy formation system
        this.formation = new EnemyFormation(this);

        // Wave generator
        this.waveGen = new WaveGenerator(this);

        // Powerup manager
        this.powerupManager = new PowerupManager(this);

        // HUD
        this.hud = new HUD(this);

        // Environmental Hazards
        this.hazards = new EnvironmentalHazards(this);

        // Collisions
        this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitEnemy, null, this);
        this.physics.add.overlap(this.player.shipGroup, this.enemies, this.onEnemyHitPlayer, null, this);
        this.physics.add.overlap(this.player.shipGroup, this.enemyBullets, this.onEnemyBulletHitPlayer, null, this);
        this.physics.add.overlap(this.player.shipGroup, this.powerups, this.onCollectPowerup, null, this);

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            A: this.input.keyboard.addKey('A'),
            D: this.input.keyboard.addKey('D'),
            W: this.input.keyboard.addKey('W'),
            S: this.input.keyboard.addKey('S'),
            SPACE: this.input.keyboard.addKey('SPACE'),
            Z: this.input.keyboard.addKey('Z'),
            X: this.input.keyboard.addKey('X'),
            B: this.input.keyboard.addKey('B'),
            P: this.input.keyboard.addKey('P'),
            M: this.input.keyboard.addKey('M'),
            ESC: this.input.keyboard.addKey('ESC'),
        };

        // Pause handler
        this.keys.ESC.on('down', () => this.togglePause());
        this.keys.P.on('down', () => this.togglePause());

        // Bomb handler — launch or detonate
        this.keys.X.on('down', () => this.bombAction());
        this.keys.B.on('down', () => this.bombAction());

        // Mute toggle
        this.keys.M.on('down', () => {
            audio.toggleAll();
            if (audio.enabled || audio.musicEnabled) {
                if (!audio.musicPlaying) audio.startMusic('game');
                this.showFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🔊 AUDIO ON', '#00ff88', 16);
            } else {
                this.showFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🔇 AUDIO OFF', '#ff4444', 16);
            }
        });

        // Pause overlay (hidden initially)
        this.pauseOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(100).setVisible(false);
        this.pauseText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'PAUSED', {
            fontFamily: 'monospace', fontSize: '36px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(101).setVisible(false);

        this.pauseResume = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'RESUME (ESC)', {
            fontFamily: 'monospace', fontSize: '16px', color: '#00ffff'
        }).setOrigin(0.5).setDepth(101).setVisible(false).setInteractive({ useHandCursor: true });
        this.pauseResume.on('pointerdown', () => this.togglePause());

        this.pauseRestart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, 'NEW GAME (R)', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ffff00'
        }).setOrigin(0.5).setDepth(101).setVisible(false).setInteractive({ useHandCursor: true });
        this.pauseRestart.on('pointerdown', () => {
            this.scene.start('DifficultySelectScene');
        });

        this.pauseQuit = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, 'QUIT TO MENU (Q)', {
            fontFamily: 'monospace', fontSize: '16px', color: '#ff4444'
        }).setOrigin(0.5).setDepth(101).setVisible(false).setInteractive({ useHandCursor: true });
        this.pauseQuit.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        // Pause menu keyboard shortcuts
        this.input.keyboard.on('keydown-R', () => {
            if (this.paused) this.scene.start('DifficultySelectScene');
        });
        this.input.keyboard.on('keydown-Q', () => {
            if (this.paused) this.scene.start('MenuScene');
        });

        // Start first wave
        this.startWave();

        // Drop boss reward powerups after returning from bonus round
        // (delayed so they arrive while the wave is setting up)
        if (this.returnFromBonus) {
            this.time.delayedCall(800, () => {
                const cx = GAME_WIDTH / 2;
                this.powerupManager.spawnPowerup(cx - 30, -10);
                this.powerupManager.spawnPowerup(cx + 30, -10);
            });
        }

        // Start game music
        audio.startMusic('game');
    }

    update(time, delta) {
        if (this.paused || this.gameOver) return;

        // Time slow
        const effectiveDelta = this.timeSlow ? delta * 0.5 : delta;

        // Starfield
        this.starField.update(delta);

        // Player update
        this.player.update(time, delta, this.cursors, this.keys);

        // Formation update
        this.formation.update(time, effectiveDelta);

        // Powerup magnet
        this.powerupManager.update(time, delta);

        // Combo timer
        if (this.comboCount > 0) {
            this.comboTimer -= delta;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.comboMultiplier = 1;
            }
        }

        // Timed powerup updates — only tick during active gameplay
        // (not during level transitions, wave spawning, or boss replays)
        if (!this.levelCleared && !this.waveSpawning) {
            this.updateTimedPowerups(delta);
        }

        // Clean off-screen bullets
        this.playerBullets.getChildren().forEach(b => {
            if (b.active && (b.y < -20 || b.y > GAME_HEIGHT + 20)) {
                b.setActive(false).setVisible(false);
                b.body.stop();
            }
        });
        this.enemyBullets.getChildren().forEach(b => {
            if (b.active && (b.y > GAME_HEIGHT + 20 || b.y < -20 || b.x < -20 || b.x > GAME_WIDTH + 20)) {
                b.setActive(false).setVisible(false);
                b.body.stop();
            }
        });

        // Cleanup: kill any non-boss enemies that are far off-screen and stuck
        this.enemies.getChildren().forEach(e => {
            if (!e.active) return;
            if (e.getData('isBoss')) return;
            if (e.x < -80 || e.x > GAME_WIDTH + 80 ||
                e.y < -80 || e.y > GAME_HEIGHT + 80) {
                e.setActive(false).setVisible(false);
                if (e.body) { e.body.stop(); e.body.enable = false; }
            }
        });

        // Check wave clear
        if (!this.waveSpawning && !this.bossPhase && !this.levelCleared) {
            const activeEnemies = this.enemies.getChildren().filter(e => e.active);
            if (activeEnemies.length === 0) {
                this.levelCleared = true;

                // Wave clear celebration
                const waveClearBonus = 500 * this.level;
                this.addScore(waveClearBonus);

                // Cyan/white flash
                this.cameras.main.flash(300, 100, 255, 255);

                // "WAVE CLEAR" floating text with bonus
                this.showFloatingText(
                    GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
                    `WAVE CLEAR!\n+${waveClearBonus.toLocaleString()}`,
                    '#00ffff', 22
                );

                this.time.delayedCall(1500, () => this.advanceLevel());
            }
        }

        // HUD
        this.hud.update(time, delta);

        // Environmental hazards
        this.hazards.update(effectiveDelta);

        // Extra life check
        if (this.score >= this.nextExtraLife && this.lives < PLAYER.MAX_LIVES) {
            this.lives++;
            this.nextExtraLife += PLAYER.EXTRA_LIFE_SCORE;
            this.showFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2, '1UP!', '#00ff00', 32);
            audio.play('extra_life');
        }
    }

    // --- Wave Management ---

    startWave() {
        this.levelCleared = false;
        this.waveSpawning = true;

        // Clear lingering bomber hazard zones from previous wave
        this.formation.clearAreaDenialZones();

        // Activate environmental hazards for this level
        this.hazards.activateForLevel(this.level);

        // Show level text
        audio.play('wave_start');
        const lvlText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `LEVEL ${this.level}`, {
            fontFamily: 'monospace', fontSize: '32px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: lvlText,
            alpha: 0,
            y: GAME_HEIGHT / 2 - 40,
            duration: 2000,
            onComplete: () => lvlText.destroy(),
        });

        // Generate and spawn wave after delay
        this.time.delayedCall(1500, () => {
            const waveData = this.waveGen.generateWave(this.level);
            this.formation.spawnWave(waveData, () => {
                this.waveSpawning = false;
            });
        });
    }

    advanceLevel() {
        // Boss check: after clearing levels 3, 6, 9, 12...
        if (this.level % 3 === 0) {
            this.startBossFight();
            return;
        }

        this.level++;
        this.startWave();
    }

    startBossFight() {
        this.bossPhase = true;
        const bossNumber = Math.floor(this.level / 3); // Level 3→1, 6→2, 9→3, etc.

        // Clear hazards for boss fight — boss arenas are clean
        this.hazards.cleanup();

        audio.play('boss_warning');
        audio.startMusic('boss');

        const bossText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `WARNING!\nBOSS APPROACHING`, {
            fontFamily: 'monospace', fontSize: '24px', color: '#ff4444', align: 'center',
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: bossText,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 2500,
            onComplete: () => {
                bossText.destroy();
                this.spawnBoss(bossNumber);
            },
        });
    }

    spawnBoss(bossNumber) {
        const bossConfigs = [
            { texture: 'boss_1', hp: 80, width: 80, height: 60 },
            { texture: 'boss_2', hp: 130, width: 100, height: 100 },
            { texture: 'boss_3', hp: 180, width: 90, height: 60 },
            { texture: 'boss_4', hp: 250, width: 80, height: 60 },
        ];

        const configIdx = Math.min(bossNumber - 1, bossConfigs.length - 1);
        const cfg = bossNumber <= bossConfigs.length
            ? bossConfigs[configIdx]
            : { texture: 'boss_generic', hp: 250 + (bossNumber - 4) * 60, width: 90, height: 70 };

        const hpScaled = Math.ceil(cfg.hp * this.diffMod.hpMult);

        const boss = this.physics.add.sprite(GAME_WIDTH / 2, -80, cfg.texture);
        boss.setData('hp', hpScaled);
        boss.setData('maxHp', hpScaled);
        boss.setData('isBoss', true);
        boss.setData('bossNumber', bossNumber);
        boss.setData('phase', 1); // Multi-phase tracking
        boss.body.setSize(cfg.width * 0.8, cfg.height * 0.8);
        this.enemies.add(boss);

        // Clear any lingering area-denial zones
        this.formation.clearAreaDenialZones();

        // Boss entrance
        this.tweens.add({
            targets: boss,
            y: 100,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.bossMovement(boss);
                this.bossAttack(boss);
            }
        });

        // Boss HP bar
        this.hud.showBossHP(hpScaled, hpScaled);
    }

    bossMovement(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const bossNum = boss.getData('bossNumber');

        if (bossNum === 4 || (bossNum > 4 && bossNum % 4 === 0)) {
            // Boss 4 — teleport movement
            this.boss4Teleport(boss);
        } else {
            // Standard weaving movement
            this.tweens.add({
                targets: boss,
                x: Phaser.Math.Between(80, GAME_WIDTH - 80),
                duration: Phaser.Math.Between(1500, 3000),
                ease: 'Sine.easeInOut',
                onComplete: () => this.bossMovement(boss),
            });
        }
    }

    boss4Teleport(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        // Teleport: fade out → reappear at random position
        this.tweens.add({
            targets: boss,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                if (!boss.active || boss.getData('defeated')) return;
                boss.x = Phaser.Math.Between(60, GAME_WIDTH - 60);
                boss.y = Phaser.Math.Between(60, 180);
                this.tweens.add({
                    targets: boss,
                    alpha: 1,
                    duration: 300,
                    onComplete: () => {
                        this.time.delayedCall(Phaser.Math.Between(1500, 3000), () => {
                            this.boss4Teleport(boss);
                        });
                    }
                });
            }
        });
    }

    bossAttack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const bossNum = boss.getData('bossNumber');
        const effectiveType = bossNum > 4 ? ((bossNum - 1) % 4) + 1 : bossNum;

        switch (effectiveType) {
            case 1: this.boss1Attack(boss); break;
            case 2: this.boss2Attack(boss); break;
            case 3: this.boss3Attack(boss); break;
            case 4: this.boss4Attack(boss); break;
            default: this.boss1Attack(boss); break;
        }
    }

    // --- Boss 1: Spread Shots ---
    boss1Attack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const hp = boss.getData('hp');
        const maxHp = boss.getData('maxHp');
        const hpPct = hp / maxHp;
        const phase = hpPct > 0.5 ? 1 : 2;
        boss.setData('phase', phase);

        // Grunt spawning only kicks in at higher levels (boss 5+, i.e. level 15+)
        const canSpawnGrunts = this.level >= 15;

        if (phase === 1) {
            // Phase 1: Spread shots
            this.bossFireSpread(boss, 3);

            if (canSpawnGrunts && Math.random() < 0.3) {
                this.time.delayedCall(500, () => {
                    if (!boss.active || boss.getData('defeated')) return;
                    for (let i = 0; i < 2; i++) {
                        const gx = boss.x + (i === 0 ? -30 : 30);
                        const grunt = this.formation.spawnSingleEnemy(ENEMY_TYPES.GRUNT, gx, boss.y);
                        if (grunt) {
                            grunt.body.setVelocity(
                                Phaser.Math.Between(-60, 60),
                                Phaser.Math.Between(60, 120)
                            );
                        }
                    }
                });
            }
        } else {
            // Phase 2: More aggressive spread shots
            this.bossFireSpread(boss, 5);
            if (canSpawnGrunts && Math.random() < 0.5) {
                this.time.delayedCall(400, () => {
                    if (!boss.active || boss.getData('defeated')) return;
                    for (let i = 0; i < 3; i++) {
                        const gx = boss.x + Phaser.Math.Between(-50, 50);
                        const grunt = this.formation.spawnSingleEnemy(ENEMY_TYPES.GRUNT, gx, boss.y + 20);
                        if (grunt) {
                            grunt.body.setVelocity(
                                Phaser.Math.Between(-80, 80),
                                Phaser.Math.Between(80, 150)
                            );
                        }
                    }
                });
            }
        }

        const nextDelay = (phase === 1 ? Phaser.Math.Between(1500, 2500) : Phaser.Math.Between(1000, 1800))
            / this.diffMod.diveFreqMult;
        this.time.delayedCall(nextDelay, () => this.bossAttack(boss));
    }

    // --- Boss 2: Rotating Shield + Homing Projectiles ---
    boss2Attack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const hp = boss.getData('hp');
        const maxHp = boss.getData('maxHp');
        const hpPct = hp / maxHp;
        const phase = hpPct > 0.5 ? 1 : 2;
        boss.setData('phase', phase);

        // Rotating shield — orbiting bullet blockers
        if (!boss.getData('shieldActive')) {
            this.boss2CreateShield(boss);
            boss.setData('shieldActive', true);
        }

        if (phase === 1) {
            // Phase 1: Aimed shots at player
            this.bossFireAimed(boss, 2);
        } else {
            // Phase 2: Homing projectiles
            if (Math.random() < 0.5) {
                this.boss2FireHoming(boss);
            } else {
                this.bossFireAimed(boss, 3);
            }
        }

        const nextDelay = (phase === 1 ? Phaser.Math.Between(1500, 2500) : Phaser.Math.Between(1000, 2000))
            / this.diffMod.diveFreqMult;
        this.time.delayedCall(nextDelay, () => this.bossAttack(boss));
    }

    boss2CreateShield(boss) {
        // Create 3 orbiting shield nodes that block player bullets
        const shieldNodes = [];
        for (let i = 0; i < 3; i++) {
            const node = this.add.circle(boss.x, boss.y, 8, 0x8844ff, 0.7).setDepth(6);
            shieldNodes.push(node);
        }
        boss.setData('shieldNodes', shieldNodes);

        // Update shield positions each frame
        const updateShield = () => {
            if (!boss.active || boss.getData('defeated')) {
                shieldNodes.forEach(n => n.destroy());
                this.events.off('update', updateShield);
                return;
            }
            const time = this.time.now * 0.002;
            shieldNodes.forEach((node, i) => {
                const angle = time + (i * Math.PI * 2 / 3);
                node.x = boss.x + Math.cos(angle) * 50;
                node.y = boss.y + Math.sin(angle) * 30;
            });

            // Shield nodes block player bullets
            this.playerBullets.getChildren().forEach(bullet => {
                if (!bullet.active) return;
                if (bullet.getData('piercing')) return; // Charged shots pierce shields
                for (const node of shieldNodes) {
                    const dist = Phaser.Math.Distance.Between(bullet.x, bullet.y, node.x, node.y);
                    if (dist < 14) {
                        bullet.setActive(false).setVisible(false);
                        bullet.body.stop();
                        // Shield hit flash
                        node.setFillStyle(0xffffff, 1);
                        this.time.delayedCall(80, () => {
                            if (node.active !== false) node.setFillStyle(0x8844ff, 0.7);
                        });
                        break;
                    }
                }
            });
        };
        this.events.on('update', updateShield);
    }

    boss2FireHoming(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const homing = this.enemyBullets.get(boss.x, boss.y + 30, 'enemy_bullet');
        if (!homing) return;
        homing.setActive(true).setVisible(true);
        homing.setTint(0xff44ff);
        homing.setScale(1.5);
        homing.setData('homing', true);
        homing.body.setVelocity(0, 80);

        // Homing update — track player for 3 seconds then go straight
        const startTime = this.time.now;
        const trackDuration = 3000;

        const updateHoming = () => {
            if (!homing.active) {
                this.events.off('update', updateHoming);
                return;
            }
            const elapsed = this.time.now - startTime;
            if (elapsed < trackDuration) {
                const target = this.player.mainShip;
                const angle = Phaser.Math.Angle.Between(homing.x, homing.y, target.x, target.y);
                const speed = (120 + this.level * 3) * this.diffMod.projectileSpeedMult;
                // Gradually steer toward player
                const currentAngle = Math.atan2(homing.body.velocity.y, homing.body.velocity.x);
                const turnRate = 0.03;
                const newAngle = currentAngle + Phaser.Math.Angle.Wrap(angle - currentAngle) * turnRate;
                homing.body.setVelocity(
                    Math.cos(newAngle) * speed,
                    Math.sin(newAngle) * speed
                );
            }
        };
        this.events.on('update', updateHoming);
    }

    // --- Boss 3: Splits into 2 at 50% HP ---
    boss3Attack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const hp = boss.getData('hp');
        const maxHp = boss.getData('maxHp');
        const hpPct = hp / maxHp;

        // Check for split at 50%
        if (hpPct <= 0.5 && !boss.getData('hasSplit')) {
            this.boss3Split(boss);
            return; // Split handles its own attack scheduling
        }

        // Normal attacks — alternating patterns
        if (Math.random() < 0.5) {
            this.bossFireSpread(boss, 4);
        } else {
            this.bossFireAimed(boss, 2);
        }

        const nextDelay = Phaser.Math.Between(1200, 2200) / this.diffMod.diveFreqMult;
        this.time.delayedCall(nextDelay, () => this.bossAttack(boss));
    }

    boss3Split(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        boss.setData('hasSplit', true);

        // Visual split effect
        this.cameras.main.shake(300, 0.02);
        this.spawnExplosion(boss.x, boss.y, 15, 0x22ff88);

        // Create two half-bosses
        const halfHp = Math.ceil(boss.getData('hp') / 2);

        // Hide original boss
        boss.setActive(false).setVisible(false);
        boss.body.enable = false;

        const halves = [];
        for (let i = 0; i < 2; i++) {
            const halfX = boss.x + (i === 0 ? -40 : 40);
            const half = this.physics.add.sprite(halfX, boss.y, 'boss_3_half');
            half.setData('hp', halfHp);
            half.setData('maxHp', boss.getData('maxHp'));
            half.setData('isBoss', true);
            half.setData('bossNumber', boss.getData('bossNumber'));
            half.setData('isBossHalf', true);
            half.setData('defeated', false);
            half.setData('phase', 2);
            half.setData('parentBoss', boss);
            half.body.setSize(36, 36);
            half.setDepth(5);
            this.enemies.add(half);
            halves.push(half);

            // Independent movement
            this.bossMovement(half);

            // Independent attacks — more aggressive
            const attackHalf = (h) => {
                if (!h.active || h.getData('defeated')) return;
                this.bossFireSpread(h, 3);
                const delay = Phaser.Math.Between(800, 1600) / this.diffMod.diveFreqMult;
                this.time.delayedCall(delay, () => attackHalf(h));
            };
            this.time.delayedCall(500 + i * 300, () => attackHalf(half));
        }

        // Track combined HP for the HP bar
        const trackHP = () => {
            const totalHp = halves.reduce((sum, h) => sum + (h.active ? h.getData('hp') : 0), 0);
            this.hud.showBossHP(Math.max(0, totalHp), boss.getData('maxHp'));
        };
        this.events.on('update', trackHP);

        // When both halves die, clean up
        const checkBothDead = () => {
            if (halves.every(h => !h.active)) {
                this.events.off('update', trackHP);
                this.events.off('update', checkBothDead);
                // Trigger boss defeated on original boss
                boss.setData('defeated', true);
                this.onBossDefeated(boss);
            }
        };
        this.events.on('update', checkBothDead);
    }

    // --- Boss 4: Teleport + Mines + Charge Attack ---
    boss4Attack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        const hp = boss.getData('hp');
        const maxHp = boss.getData('maxHp');
        const hpPct = hp / maxHp;
        const phase = hpPct > 0.5 ? 1 : 2;
        boss.setData('phase', phase);

        const roll = Math.random();

        if (phase === 1) {
            // Phase 1: Mines + aimed shots
            if (roll < 0.4) {
                this.boss4LayMines(boss, 3);
            } else {
                this.bossFireAimed(boss, 3);
            }
        } else {
            // Phase 2: More mines + charge attacks + faster shots
            if (roll < 0.3) {
                this.boss4LayMines(boss, 5);
            } else if (roll < 0.6) {
                this.boss4ChargeAttack(boss);
            } else {
                this.bossFireSpread(boss, 5);
            }
        }

        const nextDelay = (phase === 1 ? Phaser.Math.Between(1500, 2500) : Phaser.Math.Between(800, 1500))
            / this.diffMod.diveFreqMult;
        this.time.delayedCall(nextDelay, () => this.bossAttack(boss));
    }

    boss4LayMines(boss, count) {
        if (!boss.active || boss.getData('defeated')) return;

        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 200, () => {
                if (!boss.active || boss.getData('defeated')) return;

                const mx = Phaser.Math.Between(40, GAME_WIDTH - 40);
                const my = Phaser.Math.Between(GAME_HEIGHT * 0.3, GAME_HEIGHT * 0.75);

                const mine = this.add.image(boss.x, boss.y, 'mine').setDepth(5).setScale(0.5).setAlpha(0.5);

                // Mine flies to position
                this.tweens.add({
                    targets: mine,
                    x: mx, y: my,
                    scale: 1,
                    alpha: 1,
                    duration: 600,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        // Mine arms after arrival, pulsing
                        let armed = true;
                        const pulseTimer = this.time.addEvent({
                            delay: 100,
                            loop: true,
                            callback: () => {
                                if (!armed) return;
                                mine.setScale(0.9 + Math.sin(this.time.now * 0.01) * 0.15);
                            }
                        });

                        // Mine explodes after 4 seconds or on proximity
                        const mineLife = 4000;
                        const checkMine = () => {
                            if (!armed) return;
                            // Proximity check
                            if (!this.player.invulnerable && !this.activePowerups.force_field) {
                                for (const ship of this.player.ships) {
                                    if (!ship.active) continue;
                                    const dist = Phaser.Math.Distance.Between(mx, my, ship.x, ship.y);
                                    if (dist < 25) {
                                        // Mine detonates on player
                                        armed = false;
                                        this.playerHit(ship);
                                        this.spawnExplosion(mx, my, 10, 0xff6600);
                                        mine.destroy();
                                        pulseTimer.remove();
                                        this.events.off('update', checkMine);
                                        return;
                                    }
                                }
                            }
                        };
                        this.events.on('update', checkMine);

                        // Auto-explode after lifetime
                        this.time.delayedCall(mineLife, () => {
                            if (!armed) return;
                            armed = false;
                            this.spawnExplosion(mx, my, 8, 0xff4400);

                            // Explosion damages nearby player
                            if (!this.player.invulnerable && !this.activePowerups.force_field) {
                                for (const ship of this.player.ships) {
                                    if (!ship.active) continue;
                                    const dist = Phaser.Math.Distance.Between(mx, my, ship.x, ship.y);
                                    if (dist < 50) {
                                        this.playerHit(ship);
                                    }
                                }
                            }

                            mine.destroy();
                            pulseTimer.remove();
                            this.events.off('update', checkMine);
                        });
                    }
                });
            });
        }
    }

    boss4ChargeAttack(boss) {
        if (!boss.active || boss.getData('defeated')) return;

        // Warning — boss flashes and targets player position
        const targetX = this.player.mainShip.x;
        boss.setTint(0xff0000);

        // Warning line
        const warningLine = this.add.rectangle(
            targetX, GAME_HEIGHT / 2, 6, GAME_HEIGHT, 0xff0000, 0.3
        ).setDepth(3);

        this.time.delayedCall(800, () => {
            warningLine.destroy();
            if (!boss.active || boss.getData('defeated')) return;
            boss.clearTint();

            // Charge down at player's position
            const startY = boss.y;
            this.tweens.add({
                targets: boss,
                x: targetX,
                y: GAME_HEIGHT - 60,
                duration: 400,
                ease: 'Quad.easeIn',
                onUpdate: () => {
                    // Damage player if boss crosses their position
                    if (!this.player.invulnerable && !this.activePowerups.force_field) {
                        this.player.ships.forEach(ship => {
                            if (!ship.active) return;
                            const dist = Phaser.Math.Distance.Between(boss.x, boss.y, ship.x, ship.y);
                            if (dist < 35) {
                                this.playerHit(ship);
                            }
                        });
                    }
                },
                onComplete: () => {
                    // Return to top area
                    if (!boss.active || boss.getData('defeated')) return;
                    this.tweens.add({
                        targets: boss,
                        y: Phaser.Math.Between(60, 140),
                        x: Phaser.Math.Between(80, GAME_WIDTH - 80),
                        duration: 1000,
                        ease: 'Sine.easeOut',
                    });
                }
            });
        });
    }

    // --- Shared Boss Attack Helpers ---

    bossFireSpread(boss, bulletCount) {
        if (!boss.active || boss.getData('defeated')) return;

        const spread = Math.PI / 4;
        for (let i = 0; i < bulletCount; i++) {
            const angle = -Math.PI / 2 + spread * (i / (bulletCount - 1) - 0.5) + Math.PI;
            const bul = this.enemyBullets.get(boss.x, boss.y + 20, 'enemy_bullet');
            if (bul) {
                bul.setActive(true).setVisible(true);
                const speed = 200 * this.diffMod.projectileSpeedMult;
                bul.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }
        }
    }

    bossFireAimed(boss, count) {
        if (!boss.active || boss.getData('defeated')) return;

        const player = this.player.mainShip;
        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 150, () => {
                if (!boss.active || boss.getData('defeated')) return;
                const bul = this.enemyBullets.get(boss.x, boss.y + 20, 'enemy_bullet');
                if (bul) {
                    bul.setActive(true).setVisible(true);
                    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, player.x, player.y);
                    const spread = (i - (count - 1) / 2) * 0.1; // Slight spread between shots
                    const speed = (180 + this.level * 4) * this.diffMod.projectileSpeedMult;
                    bul.body.setVelocity(
                        Math.cos(angle + spread) * speed,
                        Math.sin(angle + spread) * speed
                    );
                }
            });
        }
    }

    // --- Collision Handlers ---

    onBulletHitEnemy(bullet, enemy) {
        if (!bullet.active || !enemy.active) return;

        // Track shots hit
        this.totalShotsHit++;

        // Deactivate bullet (unless piercing charged shot)
        const isPiercing = bullet.getData('piercing');
        if (!isPiercing) {
            bullet.setActive(false).setVisible(false);
            bullet.body.stop();
        }

        const damage = bullet.getData('damage') || 1;
        const hp = enemy.getData('hp') - damage;
        enemy.setData('hp', hp);

        // Hit flash
        enemy.setTintFill(0xffffff);
        this.time.delayedCall(60, () => {
            if (enemy.active) enemy.clearTint();
        });

        if (hp <= 0) {
            this.killEnemy(enemy);
        } else if (enemy.getData('isBoss')) {
            audio.play('enemy_hit');
            this.hud.showBossHP(hp, enemy.getData('maxHp'));
        } else {
            audio.play('enemy_hit');
        }
    }

    killEnemy(enemy) {
        const isBoss = enemy.getData('isBoss');
        const enemyType = enemy.getData('type');
        const points = enemy.getData('points') || 100;

        // Track stats
        this.totalKills++;

        // Explosion particles
        this.spawnExplosion(enemy.x, enemy.y, isBoss ? 30 : 10, enemy.getData('color') || 0xffaa44);
        audio.play(isBoss ? 'boss_kill' : 'enemy_kill');

        // Screen shake for bosses
        if (isBoss) {
            this.cameras.main.shake(400, 0.02);
        }

        // Combo
        this.comboCount++;
        this.comboTimer = COMBO.WINDOW_MS;
        this.comboMultiplier = Math.min(this.comboCount, COMBO.MAX_MULTIPLIER);
        if (this.comboMultiplier > this.maxCombo) {
            this.maxCombo = this.comboMultiplier;
        }

        // Score
        const earnedPoints = points * this.comboMultiplier;
        this.addScore(earnedPoints);

        if (this.comboMultiplier > 1) {
            this.showFloatingText(enemy.x, enemy.y - 20, `x${this.comboMultiplier}`, '#ffff00', 16);
            audio.play('combo');
        }

        // Powerup drop
        if (!isBoss) {
            this.powerupManager.tryDrop(enemy);
        }

        // Carrier spawns grunts
        if (enemyType === 'carrier') {
            this.spawnCarrierGrunts(enemy.x, enemy.y);
        }

        // Elite with captured ship — rescue it!
        if (enemyType === 'elite' && enemy.getData('hasCaptured')) {
            this.formation.rescueCapturedShip(enemy);
            audio.play('rescue');
        }

        // Boss defeated — keep visible for replay
        if (isBoss) {
            enemy.body.stop();
            if (enemy.body) enemy.body.enable = false;

            // Boss 3 halves: just die, the split tracker handles the full defeat
            if (enemy.getData('isBossHalf')) {
                enemy.setData('defeated', true);
                enemy.setActive(false).setVisible(false);
                return;
            }

            this.onBossDefeated(enemy);
            return; // Don't hide yet — replay will handle cleanup
        }

        enemy.setActive(false).setVisible(false);
        enemy.body.stop();
        if (enemy.body) {
            enemy.body.enable = false;
        }
    }

    spawnCarrierGrunts(x, y) {
        for (let i = 0; i < 2; i++) {
            const grunt = this.formation.spawnSingleEnemy(
                ENEMY_TYPES.GRUNT,
                x + (i === 0 ? -20 : 20),
                y,
            );
            if (grunt) {
                grunt.body.setVelocity(
                    Phaser.Math.Between(-50, 50),
                    Phaser.Math.Between(30, 80)
                );
            }
        }
    }

    onBossDefeated(boss) {
        this.bossPhase = false;
        this.hud.hideBossHP();

        // Stop boss from attacking/moving during replay
        boss.setData('defeated', true);

        // Clear ALL enemy bullets so the player can't die during the replay
        this.enemyBullets.getChildren().forEach(b => {
            if (b.active) {
                b.setActive(false).setVisible(false);
                b.body.stop();
            }
        });

        // Clear any lingering area-denial zones
        this.formation.clearAreaDenialZones();

        // --- Slow-motion boss kill replay ---
        const bossX = boss.x;
        const bossY = boss.y;

        // Freeze player input during replay
        this.paused = true;
        this.physics.world.isPaused = false;

        // Slow-mo time scale
        this.time.timeScale = 0.3;
        this.tweens.timeScale = 0.3;

        // Camera zoom toward boss
        this.cameras.main.zoomTo(1.4, 1500, 'Sine.easeInOut');
        this.cameras.main.pan(bossX, bossY, 1500, 'Sine.easeInOut');

        // Boss flashes and shakes as it breaks apart
        const colors = [0xff4400, 0xffaa00, 0xffffff, 0xff0000, 0xffff00];
        for (let wave = 0; wave < 5; wave++) {
            this.time.delayedCall(wave * 350, () => {
                if (boss.visible) {
                    // Flash the boss white
                    boss.setTintFill(0xffffff);
                    this.time.delayedCall(80, () => {
                        if (boss.visible) boss.clearTint();
                    });
                    // Boss shudders
                    boss.x = bossX + Phaser.Math.Between(-6, 6);
                    boss.y = bossY + Phaser.Math.Between(-4, 4);
                }
                // Explosions burst from the boss body
                const ox = Phaser.Math.Between(-25, 25);
                const oy = Phaser.Math.Between(-15, 15);
                this.spawnExplosion(bossX + ox, bossY + oy, 12, Phaser.Utils.Array.GetRandom(colors));
                this.cameras.main.shake(150, 0.012);
            });
        }

        // Final destruction — boss disappears in massive blast
        this.time.delayedCall(1800, () => {
            boss.setVisible(false);
            boss.setActive(false);
            this.spawnExplosion(bossX, bossY, 50, 0xffffff);
            this.spawnExplosion(bossX - 20, bossY, 20, 0xff4400);
            this.spawnExplosion(bossX + 20, bossY, 20, 0xffaa00);
            this.cameras.main.shake(500, 0.035);
            this.cameras.main.flash(400, 255, 200, 100);
        });

        // End replay — restore normal speed and camera
        this.time.delayedCall(2800, () => {
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            this.cameras.main.zoomTo(1, 800, 'Sine.easeInOut');
            this.cameras.main.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 800, 'Sine.easeInOut');
            this.paused = false;

            // Cosmetic tier upgrade
            this.cosmeticTier = Math.min(this.cosmeticTier + 1, 5);
            this.player.updateCosmetic(this.cosmeticTier);

            // Resume game music after boss
            audio.startMusic('game');

            // Boss kill bonus
            const bossNumber = boss.getData('bossNumber');
            const bonus = 2000 * bossNumber;
            this.addScore(bonus);
            this.showFloatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, `BOSS DEFEATED!\n+${bonus}`, '#ff8800', 24);

            // Advance level past the boss
            this.level++;

            // Launch bonus round after a brief delay
            this.time.delayedCall(2000, () => {
                this.scene.start('BonusRoundScene', {
                    score: this.score,
                    level: this.level,
                    difficulty: this.difficulty,
                    diffMod: this.diffMod,
                    lives: this.lives,
                    bombs: this.bombs,
                    cosmeticTier: this.cosmeticTier,
                    activePowerups: this.activePowerups,
                    highScore: this.highScore,
                    nextExtraLife: this.nextExtraLife,
                });
            });
        });
    }

    onEnemyHitPlayer(playerShip, enemy) {
        if (!playerShip.active || !enemy.active) return;
        if (this.player.invulnerable) return;
        if (this.activePowerups.force_field) return;

        // Kill the enemy too
        if (!enemy.getData('isBoss')) {
            this.killEnemy(enemy);
        }

        this.playerHit(playerShip);
    }

    onEnemyBulletHitPlayer(playerShip, bullet) {
        if (!playerShip.active || !bullet.active) return;
        if (this.player.invulnerable) return;
        if (this.activePowerups.force_field) return;

        bullet.setActive(false).setVisible(false);
        bullet.body.stop();

        this.playerHit(playerShip);
    }

    playerHit(ship) {
        audio.play('player_hit');
        // In multi-ship mode, only destroy the hit ship
        if (this.player.ships.length > 1) {
            this.player.destroyShip(ship);
            this.spawnExplosion(ship.x, ship.y, 12, 0x00ddff);
            this.cameras.main.shake(200, 0.015);
            return;
        }

        // Last ship — lose a life
        this.spawnExplosion(ship.x, ship.y, 15, 0x00ddff);
        this.cameras.main.shake(300, 0.02);
        this.lives--;

        if (this.lives <= 0) {
            this.doGameOver();
        } else {
            this.player.respawn();
        }
    }

    doGameOver() {
        this.gameOver = true;
        this.player.hide();
        this.hazards.cleanup();
        audio.stopMusic();
        audio.play('game_over');

        // Red flash for losing last life
        this.cameras.main.flash(400, 255, 30, 30);

        // Slow-motion death effect
        this.time.timeScale = 0.3;
        this.tweens.timeScale = 0.3;
        this.physics.world.timeScale = 3.33; // Inverse: slows physics

        // After ~1 second of slow-mo (scaled), restore and show GAME OVER
        this.time.delayedCall(350, () => {
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            this.physics.world.timeScale = 1;

            const goText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'GAME OVER', {
                fontFamily: 'monospace', fontSize: '36px', color: '#ff0000',
            }).setOrigin(0.5).setDepth(50).setAlpha(0);

            this.tweens.add({
                targets: goText,
                alpha: 1,
                duration: 500,
            });

            this.saveHighScore();

            this.time.delayedCall(3000, () => {
                this.scene.start('GameOverScene', {
                    score: this.score,
                    level: this.level,
                    difficulty: this.difficulty,
                    totalKills: this.totalKills || 0,
                    totalShotsFired: this.totalShotsFired || 0,
                    totalShotsHit: this.totalShotsHit || 0,
                    maxCombo: this.maxCombo || 0,
                    gameStartTime: this.gameStartTime || Date.now(),
                });
            });
        });
    }

    onCollectPowerup(playerShip, powerup) {
        if (!powerup.active) return;
        const type = powerup.getData('powerupType');

        // Clean up label
        const label = powerup.getData('label');
        if (label) label.destroy();
        powerup.setData('label', null);

        powerup.setActive(false).setVisible(false);
        powerup.body.stop();

        this.powerupManager.activate(type);
        audio.play('powerup');

        // Collect flash — find the type info by key
        const typeInfoMatch = Object.values(POWERUP_TYPES).find(t => t.key === type);
        this.showFloatingText(playerShip.x, playerShip.y - 30,
            typeInfoMatch?.label || type.toUpperCase(),
            '#ffffff', 18);
    }

    // --- Bomb ---

    bombAction() {
        if (this.gameOver || this.paused) return;

        // If a bomb is already in flight, detonate it early
        if (this.activeBomb && this.activeBomb.active) {
            this.detonateBomb(this.activeBomb.x, this.activeBomb.y);
            return;
        }

        // Otherwise launch a new bomb
        if (this.bombs <= 0) return;
        this.bombs--;

        // Create bomb projectile that flies upward
        const bx = this.player.mainShip.x;
        const by = this.player.mainShip.y - 10;
        const bomb = this.add.image(bx, by, 'bomb_blast').setScale(0.15).setDepth(40).setTint(0xff4400);
        bomb.setData('alive', true);
        this.activeBomb = bomb;

        // Target Y = formation area (top ~15% of screen)
        const targetY = 80;

        this.tweens.add({
            targets: bomb,
            y: targetY,
            duration: 800,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                // Pulsing glow while flying
                const pulse = 0.12 + Math.sin(Date.now() * 0.02) * 0.04;
                bomb.setScale(pulse);
            },
            onComplete: () => {
                // Auto-detonate at formation area
                if (bomb.getData('alive')) {
                    this.detonateBomb(bomb.x, bomb.y);
                }
            }
        });
    }

    detonateBomb(cx, cy) {
        audio.play('bomb');
        if (this.activeBomb) {
            this.activeBomb.setData('alive', false);
            this.activeBomb.destroy();
            this.activeBomb = null;
        }

        const radius = GAME_WIDTH * BOMB.BLAST_RADIUS_PCT;

        // Visual explosion
        const blast = this.add.image(cx, cy, 'bomb_blast').setScale(0.1).setDepth(40).setAlpha(0.9);
        this.tweens.add({
            targets: blast,
            scaleX: radius / 64,
            scaleY: radius / 64,
            alpha: 0,
            duration: 600,
            onComplete: () => blast.destroy(),
        });

        this.cameras.main.shake(400, 0.03);
        this.cameras.main.flash(200, 255, 200, 100);

        // Damage enemies in radius
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(cx, cy, enemy.x, enemy.y);
            if (dist <= radius) {
                if (enemy.getData('isBoss')) {
                    const maxHp = enemy.getData('maxHp');
                    const damage = Math.ceil(maxHp * BOMB.BOSS_DAMAGE_PCT);
                    const hp = enemy.getData('hp') - damage;
                    enemy.setData('hp', Math.max(hp, 0));
                    if (hp <= 0) this.killEnemy(enemy);
                    else this.hud.showBossHP(hp, maxHp);
                } else {
                    this.killEnemy(enemy);
                }
            }
        });

        // Clear enemy bullets in radius
        this.enemyBullets.getChildren().forEach(b => {
            if (!b.active) return;
            const dist = Phaser.Math.Distance.Between(cx, cy, b.x, b.y);
            if (dist <= radius) {
                b.setActive(false).setVisible(false);
                b.body.stop();
            }
        });
    }

    // --- Powerup Timers ---

    updateTimedPowerups(delta) {
        for (const [key, data] of Object.entries(this.activePowerups)) {
            if (data.duration > 0) {
                data.remaining -= delta;
                if (data.remaining <= 0) {
                    this.deactivatePowerup(key);
                }
            }
        }
    }

    activateTimedPowerup(key, duration) {
        if (this.activePowerups[key]) {
            this.activePowerups[key].remaining = duration;
        } else {
            this.activePowerups[key] = { duration, remaining: duration };
        }

        // Special effects
        if (key === 'time_slow') {
            this.timeSlow = true;
        }
    }

    deactivatePowerup(key) {
        delete this.activePowerups[key];

        if (key === 'time_slow') {
            this.timeSlow = false;
        }
    }

    // --- Pause ---

    togglePause() {
        if (this.gameOver) return;
        this.paused = !this.paused;
        audio.play('pause');
        this.pauseOverlay.setVisible(this.paused);
        this.pauseText.setVisible(this.paused);
        this.pauseResume.setVisible(this.paused);
        this.pauseRestart.setVisible(this.paused);
        this.pauseQuit.setVisible(this.paused);
        this.physics.world.isPaused = this.paused;
    }

    // --- Utility ---

    addScore(points) {
        this.score += points;
        if (this.score > this.highScore) {
            this.highScore = this.score;
        }
    }

    spawnExplosion(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const p = this.add.image(x, y, 'particle').setTint(color).setDepth(30);
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(40, 150);
            const life = Phaser.Math.Between(200, 500);
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

    showFloatingText(x, y, text, color, size) {
        const t = this.add.text(x, y, text, {
            fontFamily: 'monospace',
            fontSize: `${size}px`,
            color: color,
            align: 'center',
        }).setOrigin(0.5).setDepth(60);

        this.tweens.add({
            targets: t,
            y: y - 50,
            alpha: 0,
            duration: 1200,
            onComplete: () => t.destroy(),
        });
    }

    // --- High Scores ---

    getHighScore() {
        try {
            const scores = JSON.parse(localStorage.getItem('owens_galaga_scores') || '{}');
            return scores[this.difficulty]?.highScore || 0;
        } catch { return 0; }
    }

    saveHighScore() {
        try {
            const scores = JSON.parse(localStorage.getItem('owens_galaga_scores') || '{}');
            if (!scores[this.difficulty]) {
                scores[this.difficulty] = { highScore: 0, scores: [] };
            }
            if (this.score > scores[this.difficulty].highScore) {
                scores[this.difficulty].highScore = this.score;
            }
            scores[this.difficulty].scores.push({
                score: this.score,
                level: this.level,
                date: new Date().toISOString(),
            });
            scores[this.difficulty].scores.sort((a, b) => b.score - a.score);
            scores[this.difficulty].scores = scores[this.difficulty].scores.slice(0, 10);
            localStorage.setItem('owens_galaga_scores', JSON.stringify(scores));
        } catch (e) { console.warn('Could not save scores', e); }
    }
}
