import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

/**
 * Environmental Hazards System
 *
 * Two hazard types from the Game Design Spec §7:
 *
 * 1. Nebula Zones (Level 10+): Reduced visibility — a fog-of-war effect that
 *    darkens the play area except around the player's ship. ~30% of eligible levels.
 *
 * 2. Gravity Wells (Level 13+): Bend projectile (and powerup) trajectories.
 *    Visible vortex points that pull nearby objects. ~25% of eligible levels.
 *
 * Both can appear simultaneously at Level 20+.
 */
export class EnvironmentalHazards {
    constructor(scene) {
        this.scene = scene;
        this.nebulaActive = false;
        this.gravityWellsActive = false;
        this.gravityWells = [];

        // Nebula visuals
        this.nebulaOverlay = null;
        this.nebulaMask = null;
        this.nebulaGradient = null;

        // HUD indicator
        this.hazardIndicator = null;
    }

    /**
     * Determine which hazards to activate for the given level.
     * Uses deterministic seeded randomness so the same level always
     * produces the same hazard configuration.
     */
    activateForLevel(level) {
        this.cleanup();

        // Deterministic RNG for hazard selection (same level = same result)
        const seed = level * 4931 + 8737;
        let s = seed | 0;
        const rng = () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        const canNebula = level >= 10;
        const canGravity = level >= 13;
        const canBoth = level >= 20;

        // Roll for each hazard independently
        let doNebula = canNebula && rng() < 0.30;
        let doGravity = canGravity && rng() < 0.25;

        // Before level 20, only one hazard at a time
        if (!canBoth && doNebula && doGravity) {
            // Pick one — prefer the one that rolled first in the seed
            if (rng() < 0.5) doGravity = false;
            else doNebula = false;
        }

        if (doNebula) this.startNebula();
        if (doGravity) this.startGravityWells(level, rng);

        this.updateIndicator();
    }

    // ─── Nebula Zone ───────────────────────────────────────────────

    startNebula() {
        this.nebulaActive = true;
        const scene = this.scene;

        // Dark overlay covering the entire screen
        this.nebulaOverlay = scene.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            0x0a0820, 0.85
        ).setDepth(70).setScrollFactor(0);

        // Create a radial gradient texture for the visibility mask
        const maskSize = 320;
        const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
        const steps = 24;
        // Draw filled circles from largest (outer, full alpha) to smallest (center, also full alpha)
        // We want CENTER = opaque white (mask ON → hides overlay → player can see)
        // EDGES = nothing drawn (mask OFF → overlay visible → dark)
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const radius = (maskSize / 2) * (1 - t);
            // Alpha fades from soft at outer edge to bright at center
            const alpha = 0.3 + t * 0.7;
            gfx.fillStyle(0xffffff, alpha);
            gfx.fillCircle(maskSize / 2, maskSize / 2, radius);
        }

        this.nebulaGradient = gfx;

        // BitmapMask with invertAlpha:
        //   Where mask is opaque → overlay is HIDDEN (player can see the game)
        //   Where mask is transparent → overlay is VISIBLE (dark nebula fog)
        const mask = gfx.createBitmapMask();
        mask.invertAlpha = true;
        this.nebulaOverlay.setMask(mask);
        this.nebulaMask = mask;

        // Ambient nebula particles — wisps drifting across
        this.nebulaParticles = [];
        for (let i = 0; i < 12; i++) {
            const wisp = scene.add.circle(
                Phaser.Math.Between(0, GAME_WIDTH),
                Phaser.Math.Between(0, GAME_HEIGHT),
                Phaser.Math.Between(30, 80),
                0x2244aa,
                Phaser.Math.FloatBetween(0.03, 0.08)
            ).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
            this.nebulaParticles.push({
                sprite: wisp,
                vx: Phaser.Math.FloatBetween(-8, 8),
                vy: Phaser.Math.FloatBetween(5, 20),
            });
        }

        // Entry announcement
        scene.showFloatingText(
            GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80,
            '⚠ NEBULA ZONE', '#6688ff', 20
        );
    }

    updateNebula() {
        if (!this.nebulaActive) return;
        const scene = this.scene;
        const player = scene.player;
        if (!player || !player.mainShip) return;

        // Move the gradient mask to track the player
        const px = player.mainShip.x;
        const py = player.mainShip.y;
        this.nebulaGradient.setPosition(px - 140, py - 140);

        // Drift nebula wisps
        const dt = scene.game.loop.delta / 1000;
        for (const wisp of this.nebulaParticles) {
            wisp.sprite.x += wisp.vx * dt;
            wisp.sprite.y += wisp.vy * dt;
            if (wisp.sprite.y > GAME_HEIGHT + 100) {
                wisp.sprite.y = -100;
                wisp.sprite.x = Phaser.Math.Between(0, GAME_WIDTH);
            }
            if (wisp.sprite.x < -100) wisp.sprite.x = GAME_WIDTH + 100;
            if (wisp.sprite.x > GAME_WIDTH + 100) wisp.sprite.x = -100;
        }
    }

    // ─── Gravity Wells ─────────────────────────────────────────────

    startGravityWells(level, rng) {
        this.gravityWellsActive = true;
        const scene = this.scene;

        // Number of wells scales with level
        const wellCount = level >= 20 ? 3 : level >= 16 ? 2 : 1;

        for (let i = 0; i < wellCount; i++) {
            const wx = 60 + rng() * (GAME_WIDTH - 120);
            const wy = GAME_HEIGHT * 0.25 + rng() * (GAME_HEIGHT * 0.45);
            const strength = 150 + (level - 13) * 10 + rng() * 60;
            const radius = 140 + rng() * 60;

            const well = this.createGravityWell(wx, wy, strength, radius);
            this.gravityWells.push(well);
        }

        // Entry announcement
        scene.showFloatingText(
            GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60,
            '⚠ GRAVITY ANOMALY', '#aa44ff', 20
        );
    }

    createGravityWell(x, y, strength, radius) {
        const scene = this.scene;

        // Visual — rotating vortex rings
        const container = scene.add.container(x, y).setDepth(2);

        // Outer ring — visible enough for players to read the danger zone
        const outerRing = scene.add.circle(0, 0, radius, 0x6622cc, 0.1);
        container.add(outerRing);

        // Mid ring
        const midRing = scene.add.circle(0, 0, radius * 0.6, 0x8844ff, 0.15);
        container.add(midRing);

        // Inner core
        const innerCore = scene.add.circle(0, 0, 12, 0xcc88ff, 0.4);
        container.add(innerCore);

        // Center bright dot
        const center = scene.add.circle(0, 0, 4, 0xffffff, 0.6);
        container.add(center);

        // Spiral arm particles
        const arms = [];
        for (let a = 0; a < 3; a++) {
            const baseAngle = (a / 3) * Math.PI * 2;
            for (let p = 0; p < 5; p++) {
                const dist = 20 + p * (radius * 0.15);
                const dot = scene.add.circle(0, 0, 2, 0xaa66ff, 0.3 + p * 0.05);
                container.add(dot);
                arms.push({ sprite: dot, baseAngle, dist, idx: p });
            }
        }

        return { x, y, strength, radius, container, outerRing, midRing, innerCore, center, arms, time: 0 };
    }

    updateGravityWells(delta) {
        if (!this.gravityWellsActive) return;
        const scene = this.scene;
        const dt = delta / 1000;

        for (const well of this.gravityWells) {
            well.time += dt;

            // Animate spiral arms
            for (const arm of well.arms) {
                const angle = arm.baseAngle + well.time * (1.5 - arm.idx * 0.1);
                arm.sprite.x = Math.cos(angle) * arm.dist;
                arm.sprite.y = Math.sin(angle) * arm.dist;
            }

            // Pulse the core
            const pulse = 0.4 + Math.sin(well.time * 3) * 0.15;
            well.innerCore.setAlpha(pulse);
            well.center.setAlpha(0.5 + Math.sin(well.time * 5) * 0.2);

            // Rotate outer ring visually (slight scale oscillation)
            const breathe = 1 + Math.sin(well.time * 0.8) * 0.05;
            well.outerRing.setScale(breathe);

            // ── Apply gravitational pull to projectiles ──

            // Player bullets
            scene.playerBullets.getChildren().forEach(bullet => {
                if (!bullet.active) return;
                this.applyGravityToBullet(bullet, well, dt);
            });

            // Enemy bullets
            scene.enemyBullets.getChildren().forEach(bullet => {
                if (!bullet.active) return;
                this.applyGravityToBullet(bullet, well, dt);
            });

            // Powerups
            scene.powerups.getChildren().forEach(powerup => {
                if (!powerup.active) return;
                this.applyGravityToBullet(powerup, well, dt, 0.6); // Weaker pull on powerups
            });

            // Diving enemies — get pulled off course
            scene.enemies.getChildren().forEach(enemy => {
                if (!enemy.active) return;
                if (enemy.getData('isBoss')) return;
                if (!enemy.getData('diving')) return;
                this.applyGravityToBullet(enemy, well, dt, 0.3);
            });
        }
    }

    applyGravityToBullet(obj, well, dt, multiplier = 1) {
        const dx = well.x - obj.x;
        const dy = well.y - obj.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist > well.radius || dist < 8) return;

        // Gravitational pull: stronger as you get closer
        // Needs to be STRONG enough to visibly bend fast-moving projectiles
        const falloff = 1 - (dist / well.radius);
        const force = well.strength * falloff * multiplier;

        // Normalize direction
        const nx = dx / dist;
        const ny = dy / dist;

        // Apply to velocity — multiply by large factor so bullets visibly curve
        if (obj.body) {
            obj.body.velocity.x += nx * force * 8 * dt;
            obj.body.velocity.y += ny * force * 8 * dt;
        }
    }

    // ─── HUD Indicator ────────────────────────────────────────────

    updateIndicator() {
        const scene = this.scene;
        const parts = [];
        if (this.nebulaActive) parts.push('☁ NEBULA');
        if (this.gravityWellsActive) parts.push('◎ GRAVITY');

        if (parts.length === 0) {
            if (this.hazardIndicator) {
                this.hazardIndicator.destroy();
                this.hazardIndicator = null;
            }
            return;
        }

        const text = parts.join('  ');
        if (!this.hazardIndicator) {
            this.hazardIndicator = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, text, {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#aa88ff',
                align: 'center',
            }).setOrigin(0.5).setDepth(80).setAlpha(0.7);
        } else {
            this.hazardIndicator.setText(text);
        }
    }

    // ─── Lifecycle ─────────────────────────────────────────────────

    update(delta) {
        this.updateNebula();
        this.updateGravityWells(delta);
    }

    cleanup() {
        // Remove nebula
        if (this.nebulaOverlay) {
            this.nebulaOverlay.clearMask(true);
            this.nebulaOverlay.destroy();
            this.nebulaOverlay = null;
        }
        if (this.nebulaGradient) {
            this.nebulaGradient.destroy();
            this.nebulaGradient = null;
        }
        if (this.nebulaMask) {
            this.nebulaMask.destroy();
            this.nebulaMask = null;
        }
        if (this.nebulaParticles) {
            this.nebulaParticles.forEach(w => w.sprite.destroy());
            this.nebulaParticles = [];
        }
        this.nebulaActive = false;

        // Remove gravity wells
        for (const well of this.gravityWells) {
            well.container.destroy();
        }
        this.gravityWells = [];
        this.gravityWellsActive = false;

        // Remove indicator
        if (this.hazardIndicator) {
            this.hazardIndicator.destroy();
            this.hazardIndicator = null;
        }
    }

    /** Whether any hazard is currently active */
    get isActive() {
        return this.nebulaActive || this.gravityWellsActive;
    }
}
