// BootScene — generates all sprite textures procedurally (no external assets needed)
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENEMY_TYPES, POWERUP_TYPES } from '../constants.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        // Loading screen
        const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'LOADING...', {
            fontFamily: 'monospace', fontSize: '20px', color: '#00ffff',
        }).setOrigin(0.5);

        const barBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 200, 12, 0x222222).setOrigin(0.5);
        const barFill = this.add.rectangle(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2, 0, 12, 0x00ffff).setOrigin(0, 0.5);

        const statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#555555',
        }).setOrigin(0.5);

        // Title preview
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, "OWEN'S GALAGA", {
            fontFamily: 'monospace', fontSize: '28px', color: '#00ffff', alpha: 0.3,
            stroke: '#003344', strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0.3);

        // Generate textures in stages with progress
        const stages = [
            { label: 'SHIPS', fn: () => { this.generatePlayerShip(); this.generatePlayerShipTiers(); } },
            { label: 'BULLETS', fn: () => { this.generateBullet(); this.generateChargedShot(); this.generateEnemyBullet(); } },
            { label: 'ENEMIES', fn: () => { this.generateEnemies(); } },
            { label: 'POWERUPS', fn: () => { this.generatePowerups(); } },
            { label: 'EFFECTS', fn: () => { this.generateParticle(); this.generateStar(); this.generateBombBlast(); this.generateShield(); this.generateAreaDenial(); } },
            { label: 'BOSSES', fn: () => { this.generateBossBeam(); this.generateMine(); this.generateTractorBeam(); this.generateBossTextures(); } },
            { label: 'POKEMON', fn: () => { this.generatePokeball(); this.generatePokemonSprites(); this.generatePokemonProjectiles(); } },
        ];

        let currentStage = 0;
        const processStage = () => {
            if (currentStage >= stages.length) {
                // All done — brief flash and transition
                barFill.width = 200;
                statusText.setText('READY!');
                loadingText.setColor('#ffffff');
                this.cameras.main.flash(200, 0, 255, 255);
                this.time.delayedCall(400, () => {
                    this.scene.start('MenuScene');
                });
                return;
            }

            const stage = stages[currentStage];
            statusText.setText(stage.label);
            stage.fn();

            currentStage++;
            const pct = currentStage / stages.length;
            this.tweens.add({
                targets: barFill,
                width: 200 * pct,
                duration: 120,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.time.delayedCall(60, processStage);
                }
            });
        };

        // Start processing after a brief delay (so the loading screen renders)
        this.time.delayedCall(200, processStage);
    }

    generatePlayerShip() {
        const g = this.add.graphics();
        // Base ship — arrow/fighter shape
        g.fillStyle(0x00ddff, 1);
        // Main body
        g.fillRect(12, 8, 8, 20);
        // Nose
        g.fillTriangle(16, 2, 10, 10, 22, 10);
        // Wings
        g.fillTriangle(4, 28, 12, 14, 12, 28);
        g.fillTriangle(28, 28, 20, 14, 20, 28);
        // Engine glow
        g.fillStyle(0x0088ff, 1);
        g.fillRect(13, 26, 6, 4);
        g.fillStyle(0x44ccff, 1);
        g.fillRect(14, 28, 4, 3);
        g.generateTexture('player_ship', 32, 32);
        g.destroy();
    }

    generatePlayerShipTiers() {
        const tierColors = [
            { main: 0x00ddff, accent: 0x00ffaa, glow: 0x0088ff },
            { main: 0x00ffcc, accent: 0xffff00, glow: 0x00aa44 },
            { main: 0xffaa00, accent: 0xff4444, glow: 0xff6600 },
            { main: 0xff44ff, accent: 0xffffff, glow: 0xaa00ff },
            { main: 0xffffff, accent: 0x00ffff, glow: 0xffff00 },
        ];

        for (let tier = 1; tier <= 5; tier++) {
            const c = tierColors[tier - 1];
            const g = this.add.graphics();
            g.fillStyle(c.main, 1);
            g.fillRect(12, 8, 8, 20);
            g.fillTriangle(16, 2, 10, 10, 22, 10);
            g.fillTriangle(4, 28, 12, 14, 12, 28);
            g.fillTriangle(28, 28, 20, 14, 20, 28);
            // Accent stripes
            g.fillStyle(c.accent, 1);
            g.fillRect(14, 6, 4, 2);
            if (tier >= 2) {
                g.fillRect(6, 24, 2, 4);
                g.fillRect(24, 24, 2, 4);
            }
            if (tier >= 3) {
                g.fillTriangle(2, 30, 6, 20, 6, 30);
                g.fillTriangle(30, 30, 26, 20, 26, 30);
            }
            if (tier >= 4) {
                g.fillStyle(c.accent, 0.6);
                g.fillRect(10, 4, 2, 4);
                g.fillRect(20, 4, 2, 4);
            }
            // Engine glow
            g.fillStyle(c.glow, 1);
            g.fillRect(13, 26, 6, 4);
            g.fillStyle(c.glow, 0.7);
            g.fillRect(14, 28, 4, tier >= 3 ? 4 : 3);
            g.generateTexture(`player_ship_t${tier}`, 32, 32);
            g.destroy();
        }
    }

    generateBullet() {
        const g = this.add.graphics();
        g.fillStyle(0x00ffff, 1);
        g.fillRect(1, 0, 2, 8);
        g.fillStyle(0xffffff, 1);
        g.fillRect(1, 0, 2, 3);
        g.generateTexture('bullet', 4, 8);
        g.destroy();
    }

    generateChargedShot() {
        const g = this.add.graphics();
        const w = 24;
        const h = 40;
        // Outer glow
        g.fillStyle(0x00ffff, 0.3);
        g.fillRect(0, 4, w, h - 8);
        // Main beam — wide and bright
        g.fillStyle(0x44ffff, 0.8);
        g.fillRect(2, 2, w - 4, h - 4);
        // Core — white hot center
        g.fillStyle(0xffffff, 1);
        g.fillRect(6, 0, w - 12, h);
        // Bright tip
        g.fillStyle(0xffffff, 1);
        g.fillRect(4, 0, w - 8, 6);
        // Energy lines on sides
        g.fillStyle(0x88ffff, 0.6);
        g.fillRect(0, 8, 3, h - 16);
        g.fillRect(w - 3, 8, 3, h - 16);
        g.generateTexture('charged_shot', w, h);
        g.destroy();
    }

    generateEnemies() {
        for (const [key, info] of Object.entries(ENEMY_TYPES)) {
            const g = this.add.graphics();
            const w = info.width;
            const h = info.height;
            const color = info.color;

            g.fillStyle(color, 1);
            if (key === 'GRUNT') {
                // Simple invader shape
                g.fillRect(4, 4, w - 8, h - 8);
                g.fillRect(2, 8, 4, 8);
                g.fillRect(w - 6, 8, 4, 8);
                g.fillRect(6, h - 6, 4, 4);
                g.fillRect(w - 10, h - 6, 4, 4);
                // Eyes
                g.fillStyle(0x000000, 1);
                g.fillRect(8, 8, 4, 4);
                g.fillRect(w - 12, 8, 4, 4);
            } else if (key === 'SWOOPER') {
                // Sleek angular shape
                g.fillTriangle(w / 2, 2, 2, h - 2, w - 2, h - 2);
                g.fillStyle(0x000000, 1);
                g.fillRect(w / 2 - 3, h / 2, 2, 2);
                g.fillRect(w / 2 + 1, h / 2, 2, 2);
            } else if (key === 'TANK') {
                // Chunky hexagonal
                g.fillRect(6, 2, w - 12, h - 4);
                g.fillRect(2, 6, w - 4, h - 12);
                g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(30).color, 1);
                g.fillRect(8, 8, w - 16, h - 16);
            } else if (key === 'ELITE') {
                // Commanding shape with crown-like top
                g.fillRect(4, 6, w - 8, h - 8);
                g.fillTriangle(w / 2, 0, 6, 8, w - 6, 8);
                g.fillRect(2, 10, 4, h - 14);
                g.fillRect(w - 6, 10, 4, h - 14);
                g.fillStyle(0xffffff, 0.8);
                g.fillRect(w / 2 - 2, 2, 4, 4);
            } else if (key === 'BOMBER') {
                // Round with payload indicator
                g.fillCircle(w / 2, h / 2, w / 2 - 2);
                g.fillStyle(0x000000, 1);
                g.fillCircle(w / 2, h / 2, w / 4);
                g.fillStyle(0xff4400, 1);
                g.fillCircle(w / 2, h / 2, w / 6);
            } else if (key === 'CARRIER') {
                // Large ship shape
                g.fillRect(4, 4, w - 8, h - 8);
                g.fillRect(8, 2, w - 16, h - 4);
                g.fillRect(2, 8, w - 4, h - 16);
                g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(20).color, 1);
                g.fillRect(10, 10, 6, 6);
                g.fillRect(w - 16, 10, 6, 6);
            }

            g.generateTexture(`enemy_${info.key}`, w, h);
            g.destroy();
        }
    }

    generatePowerups() {
        // Powerups are 32x32 with a diamond/gem shape, clear color, icon letter, and pulsing border
        // They must look NOTHING like bullets (which are tiny 4px rectangles)
        const size = 32;
        const half = size / 2;

        for (const [key, info] of Object.entries(POWERUP_TYPES)) {
            const g = this.add.graphics();

            // Outer glow halo (makes them unmistakable)
            g.fillStyle(info.color, 0.15);
            g.fillCircle(half, half, half);

            // Diamond/gem shape background
            g.fillStyle(0x000000, 0.6);
            g.fillTriangle(half, 2, 2, half, half, size - 2);
            g.fillTriangle(half, 2, size - 2, half, half, size - 2);

            // Inner fill with powerup color
            g.fillStyle(info.color, 0.9);
            g.fillTriangle(half, 5, 5, half, half, size - 5);
            g.fillTriangle(half, 5, size - 5, half, half, size - 5);

            // Bright border outline
            g.lineStyle(2, info.color, 1);
            g.strokeTriangle(half, 2, 2, half, half, size - 2);
            g.strokeTriangle(half, 2, size - 2, half, half, size - 2);

            // White highlight stripe (makes it look like a gem)
            g.fillStyle(0xffffff, 0.4);
            g.fillTriangle(half, 6, 8, half - 2, half, half - 2);

            g.generateTexture(`powerup_${info.key}`, size, size);
            g.destroy();
        }
    }

    generateParticle() {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillRect(0, 0, 4, 4);
        g.generateTexture('particle', 4, 4);
        g.destroy();

        // Small particle
        const g2 = this.add.graphics();
        g2.fillStyle(0xffffff, 1);
        g2.fillRect(0, 0, 2, 2);
        g2.generateTexture('particle_sm', 2, 2);
        g2.destroy();
    }

    generateStar() {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        g.fillRect(0, 0, 2, 2);
        g.generateTexture('star', 2, 2);
        g.destroy();
    }

    generateBombBlast() {
        const g = this.add.graphics();
        const r = 64;
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(r, r, r);
        g.fillStyle(0xff8800, 0.6);
        g.fillCircle(r, r, r * 0.7);
        g.fillStyle(0xff0000, 0.4);
        g.fillCircle(r, r, r * 0.4);
        g.generateTexture('bomb_blast', r * 2, r * 2);
        g.destroy();
    }

    generateShield() {
        const g = this.add.graphics();
        g.lineStyle(2, 0x00aaff, 0.8);
        g.strokeCircle(20, 20, 18);
        g.lineStyle(1, 0x44ddff, 0.4);
        g.strokeCircle(20, 20, 16);
        g.generateTexture('shield', 40, 40);
        g.destroy();
    }

    generateEnemyBullet() {
        const g = this.add.graphics();
        // Bright red/orange hostile projectile — clearly different from powerups
        g.fillStyle(0xff2200, 1);
        g.fillRect(0, 0, 4, 8);
        g.fillStyle(0xffaa00, 1);
        g.fillRect(1, 1, 2, 3);
        g.generateTexture('enemy_bullet', 4, 8);
        g.destroy();
    }

    generateAreaDenial() {
        // Bomber area-denial zone — pulsing orange/red hazard circle
        const g = this.add.graphics();
        const r = 24;
        g.fillStyle(0xff4400, 0.3);
        g.fillCircle(r, r, r);
        g.fillStyle(0xff6600, 0.5);
        g.fillCircle(r, r, r * 0.6);
        g.fillStyle(0xff8800, 0.7);
        g.fillCircle(r, r, r * 0.3);
        g.lineStyle(1, 0xff4400, 0.6);
        g.strokeCircle(r, r, r - 1);
        g.generateTexture('area_denial', r * 2, r * 2);
        g.destroy();
    }

    generateBossBeam() {
        // Sweeping beam for Boss 1
        const g = this.add.graphics();
        const w = 16, h = GAME_HEIGHT;
        g.fillStyle(0xff2222, 0.3);
        g.fillRect(0, 0, w, h);
        g.fillStyle(0xff4444, 0.5);
        g.fillRect(3, 0, w - 6, h);
        g.fillStyle(0xff8888, 0.8);
        g.fillRect(6, 0, w - 12, h);
        g.generateTexture('boss_beam', w, h);
        g.destroy();
    }

    generateMine() {
        // Boss 4 mine — small spiked hazard
        const g = this.add.graphics();
        const s = 16;
        g.fillStyle(0xff4400, 1);
        g.fillCircle(s / 2, s / 2, 5);
        g.fillStyle(0xffaa00, 1);
        // Spikes
        g.fillTriangle(s / 2, 0, s / 2 - 2, 4, s / 2 + 2, 4);
        g.fillTriangle(s / 2, s, s / 2 - 2, s - 4, s / 2 + 2, s - 4);
        g.fillTriangle(0, s / 2, 4, s / 2 - 2, 4, s / 2 + 2);
        g.fillTriangle(s, s / 2, s - 4, s / 2 - 2, s - 4, s / 2 + 2);
        g.fillStyle(0xff0000, 1);
        g.fillCircle(s / 2, s / 2, 2);
        g.generateTexture('mine', s, s);
        g.destroy();
    }

    generateTractorBeam() {
        // Tractor beam — vertical cone/column effect
        const g = this.add.graphics();
        const w = 32, h = 120;
        // Outer glow
        g.fillStyle(0xff44ff, 0.15);
        g.fillTriangle(w / 2, 0, 0, h, w, h);
        // Inner beam
        g.fillStyle(0xff88ff, 0.25);
        g.fillTriangle(w / 2, 6, 6, h, w - 6, h);
        // Core
        g.fillStyle(0xffaaff, 0.35);
        g.fillTriangle(w / 2, 12, 10, h, w - 10, h);
        // Bright center line
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(w / 2 - 1, 10, 2, h - 10);
        g.generateTexture('tractor_beam', w, h);
        g.destroy();
    }


    generateBossTextures() {
        // Boss 1 — large menacing ship
        const g = this.add.graphics();
        const w = 80, h = 60;
        g.fillStyle(0xff2222, 1);
        g.fillRect(10, 10, w - 20, h - 20);
        g.fillTriangle(w / 2, 2, 10, 15, w - 10, 15);
        g.fillRect(4, 20, 8, 20);
        g.fillRect(w - 12, 20, 8, 20);
        g.fillStyle(0xff6644, 1);
        g.fillRect(20, 20, w - 40, h - 30);
        g.fillStyle(0xffff00, 1);
        g.fillCircle(28, 28, 4);
        g.fillCircle(w - 28, 28, 4);
        g.fillStyle(0x000000, 1);
        g.fillCircle(28, 28, 2);
        g.fillCircle(w - 28, 28, 2);
        g.generateTexture('boss_1', w, h);
        g.destroy();

        // Boss 2 — shield boss
        const g2 = this.add.graphics();
        g2.fillStyle(0x8844ff, 1);
        g2.fillCircle(50, 50, 40);
        g2.fillStyle(0x6622cc, 1);
        g2.fillCircle(50, 50, 30);
        g2.fillStyle(0xffff00, 1);
        g2.fillCircle(50, 50, 8);
        g2.generateTexture('boss_2', 100, 100);
        g2.destroy();

        // Boss 3 — splits
        const g3 = this.add.graphics();
        g3.fillStyle(0x22ff88, 1);
        g3.fillRect(10, 5, 70, 50);
        g3.fillTriangle(45, 0, 10, 10, 80, 10);
        g3.fillStyle(0x118844, 1);
        g3.fillRect(40, 15, 10, 30);
        g3.fillStyle(0xffffff, 1);
        g3.fillCircle(30, 25, 5);
        g3.fillCircle(60, 25, 5);
        g3.generateTexture('boss_3', 90, 60);
        g3.destroy();

        // Boss 3 half (when split)
        const g3h = this.add.graphics();
        g3h.fillStyle(0x22ff88, 1);
        g3h.fillRect(5, 5, 35, 35);
        g3h.fillStyle(0xffffff, 1);
        g3h.fillCircle(22, 18, 4);
        g3h.generateTexture('boss_3_half', 45, 45);
        g3h.destroy();

        // Boss 4 — teleporter
        const g4 = this.add.graphics();
        g4.fillStyle(0xff8800, 1);
        g4.fillTriangle(40, 0, 0, 60, 80, 60);
        g4.fillStyle(0xffaa44, 1);
        g4.fillTriangle(40, 15, 15, 55, 65, 55);
        g4.fillStyle(0xff0000, 1);
        g4.fillCircle(40, 35, 8);
        g4.generateTexture('boss_4', 80, 60);
        g4.destroy();

        // Generic boss for 5+
        const g5 = this.add.graphics();
        g5.fillStyle(0xcc00cc, 1);
        g5.fillRect(5, 5, 80, 60);
        g5.fillTriangle(45, 0, 5, 10, 85, 10);
        g5.fillRect(0, 20, 10, 30);
        g5.fillRect(80, 20, 10, 30);
        g5.fillStyle(0xff44ff, 1);
        g5.fillRect(20, 15, 50, 40);
        g5.fillStyle(0xffffff, 1);
        g5.fillCircle(35, 30, 6);
        g5.fillCircle(55, 30, 6);
        g5.fillStyle(0x000000, 1);
        g5.fillCircle(35, 30, 3);
        g5.fillCircle(55, 30, 3);
        g5.generateTexture('boss_generic', 90, 70);
        g5.destroy();
    }

    generatePokeball() {
        const g = this.add.graphics();
        const s = 24;
        const cx = s / 2, cy = s / 2, r = s / 2 - 1;

        // Step 1: Draw the full red circle (top half color)
        g.fillStyle(0xff0000, 1);
        g.fillCircle(cx, cy, r);

        // Step 2: Mask the bottom half white using a clipped semicircle
        // Draw a white circle the same size, but only the bottom shows because
        // we overlay it after filling a white rect clipped to lower half
        g.fillStyle(0xffffff, 1);
        // Fill bottom-half pixels row by row within the circle
        for (let py = cy; py <= cy + r; py++) {
            const dy = py - cy;
            const halfWidth = Math.sqrt(r * r - dy * dy);
            g.fillRect(cx - halfWidth, py, halfWidth * 2, 1);
        }

        // Step 3: Black dividing band across the middle
        g.fillStyle(0x222222, 1);
        g.fillRect(cx - r, cy - 1, r * 2, 3);

        // Step 4: Center button — white circle with dark ring
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx, cy, 4);
        g.lineStyle(2, 0x222222, 1);
        g.strokeCircle(cx, cy, 4);

        // Step 5: Outer border
        g.lineStyle(1.5, 0x222222, 1);
        g.strokeCircle(cx, cy, r);

        g.generateTexture('pokeball', s, s);
        g.destroy();
    }

    generatePokemonSprites() {
        // Charmander — orange/red lizard shape
        const gc = this.add.graphics();
        const s = 28;
        // Body
        gc.fillStyle(0xff6600, 1);
        gc.fillCircle(14, 16, 10); // body
        gc.fillCircle(14, 8, 6); // head
        // Belly
        gc.fillStyle(0xffcc66, 1);
        gc.fillCircle(14, 18, 6);
        // Eyes
        gc.fillStyle(0x000000, 1);
        gc.fillCircle(11, 7, 1.5);
        gc.fillCircle(17, 7, 1.5);
        // Tail flame
        gc.fillStyle(0xff4400, 1);
        gc.fillTriangle(22, 20, 26, 12, 20, 16);
        gc.fillStyle(0xffaa00, 1);
        gc.fillTriangle(23, 18, 26, 13, 21, 16);
        gc.generateTexture('pokemon_charmander', s, s);
        gc.destroy();

        // Bulbasaur — green/teal with bulb
        const gb = this.add.graphics();
        // Body
        gb.fillStyle(0x44aa88, 1);
        gb.fillCircle(14, 18, 10); // body
        gb.fillCircle(14, 10, 6); // head
        // Bulb on back
        gb.fillStyle(0x44cc44, 1);
        gb.fillCircle(14, 14, 7);
        gb.fillStyle(0x66ee66, 1);
        gb.fillTriangle(14, 4, 8, 14, 20, 14);
        // Eyes
        gb.fillStyle(0xff0000, 1);
        gb.fillCircle(11, 9, 1.5);
        gb.fillCircle(17, 9, 1.5);
        gb.generateTexture('pokemon_bulbasaur', s, s);
        gb.destroy();

        // Squirtle — blue turtle shape
        const gs = this.add.graphics();
        // Shell
        gs.fillStyle(0x886622, 1);
        gs.fillCircle(14, 18, 9);
        gs.fillStyle(0xcc9944, 1);
        gs.fillCircle(14, 18, 6);
        // Head
        gs.fillStyle(0x4488ff, 1);
        gs.fillCircle(14, 10, 7);
        // Eyes
        gs.fillStyle(0x000000, 1);
        gs.fillCircle(11, 9, 1.5);
        gs.fillCircle(17, 9, 1.5);
        // Tail
        gs.fillStyle(0x4488ff, 1);
        gs.fillTriangle(22, 22, 26, 18, 20, 18);
        gs.generateTexture('pokemon_squirtle', s, s);
        gs.destroy();
    }

    generatePokemonProjectiles() {
        // Fire projectile — orange/red flame
        const gf = this.add.graphics();
        gf.fillStyle(0xff4400, 1);
        gf.fillCircle(5, 5, 4);
        gf.fillStyle(0xffaa00, 1);
        gf.fillCircle(5, 5, 2);
        gf.generateTexture('fire_proj', 10, 10);
        gf.destroy();

        // Leaf projectile — green leaf
        const gl = this.add.graphics();
        gl.fillStyle(0x44ff44, 1);
        gl.fillTriangle(5, 0, 0, 10, 10, 10);
        gl.fillStyle(0x22cc22, 1);
        gl.fillRect(4, 3, 2, 6); // stem
        gl.generateTexture('leaf_proj', 10, 10);
        gl.destroy();

        // Water projectile — blue droplet
        const gw = this.add.graphics();
        gw.fillStyle(0x44aaff, 1);
        gw.fillCircle(5, 6, 4);
        gw.fillTriangle(5, 0, 2, 5, 8, 5);
        gw.fillStyle(0xaaddff, 1);
        gw.fillCircle(4, 5, 1.5);
        gw.generateTexture('water_proj', 10, 10);
        gw.destroy();
    }
}
