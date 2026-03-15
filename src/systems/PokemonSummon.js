import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, POKEBALL } from '../constants.js';
import { audio } from './AudioManager.js';

/**
 * PokemonSummon — manages pokéball throws and Pokémon summons.
 * When a pokéball is launched, it flies to mid-screen, opens, and
 * a random Pokémon (Charmander, Bulbasaur, or Squirtle) appears
 * and auto-attacks enemies for POKEBALL.SUMMON_DURATION ms.
 */

const POKEMON = [
    {
        name: 'charmander',
        color: 0xff6600,
        projectileColor: 0xff4400,
        projectileKey: 'fire_proj',
        attackSound: 'pokemon_fire',
        projectileCount: 3, // spread fire
        projectileSpeed: 350,
        homing: false,
    },
    {
        name: 'bulbasaur',
        color: 0x44cc44,
        projectileColor: 0x44ff44,
        projectileKey: 'leaf_proj',
        attackSound: 'pokemon_leaf',
        projectileCount: 2,
        projectileSpeed: 300,
        homing: true, // razor leaves slightly home
    },
    {
        name: 'squirtle',
        color: 0x4488ff,
        projectileColor: 0x44aaff,
        projectileKey: 'water_proj',
        attackSound: 'pokemon_water',
        projectileCount: 1,
        projectileSpeed: 450, // fast straight shots
        homing: false,
    },
];

export class PokemonSummon {
    constructor(scene) {
        this.scene = scene;
        this.activePokemon = null; // Currently summoned pokemon sprite
        this.pokemonTimer = null;
        this.attackTimer = null;
        this.pokemonProjectiles = scene.physics.add.group({ maxSize: 30 });

        // Collisions — pokemon projectiles hit enemies
        scene.physics.add.overlap(
            this.pokemonProjectiles,
            scene.enemies,
            this.onProjectileHitEnemy,
            null,
            this
        );
    }

    launch() {
        const scene = this.scene;
        if (scene.pokeballs <= 0) return;
        if (this.activePokemon) return; // Only one summon at a time

        scene.pokeballs--;
        audio.play('pokeball_throw');

        // Create pokéball projectile
        const bx = scene.player.mainShip.x;
        const by = scene.player.mainShip.y - 10;
        const ball = scene.add.image(bx, by, 'pokeball').setDepth(40).setScale(0.8);

        // Target: center of screen
        const targetX = GAME_WIDTH / 2;
        const targetY = GAME_HEIGHT * 0.3;

        scene.tweens.add({
            targets: ball,
            x: targetX,
            y: targetY,
            duration: 600,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                ball.rotation += 0.15; // spin
            },
            onComplete: () => {
                ball.destroy();
                this.summonPokemon(targetX, targetY);
            },
        });
    }

    summonPokemon(x, y) {
        const scene = this.scene;
        const pokemon = Phaser.Utils.Array.GetRandom(POKEMON);

        // Flash effect
        scene.cameras.main.flash(200, 255, 255, 255);
        scene.spawnExplosion(x, y, 15, pokemon.color);
        audio.play('pokemon_summon');

        // Show pokemon name
        scene.showFloatingText(x, y - 30, pokemon.name.toUpperCase() + '!', '#ffffff', 20);

        // Create pokemon sprite
        const sprite = scene.add.image(x, y, `pokemon_${pokemon.name}`)
            .setDepth(40)
            .setScale(0);

        // Pop-in animation
        scene.tweens.add({
            targets: sprite,
            scale: 1.5,
            duration: 300,
            ease: 'Back.easeOut',
        });

        this.activePokemon = { sprite, data: pokemon, x, y };

        // Start attacking
        this.attackTimer = scene.time.addEvent({
            delay: POKEBALL.ATTACK_RATE,
            loop: true,
            callback: () => this.pokemonAttack(),
        });

        // Gentle bobbing motion
        scene.tweens.add({
            targets: sprite,
            y: y - 10,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Despawn after duration
        this.pokemonTimer = scene.time.delayedCall(POKEBALL.SUMMON_DURATION, () => {
            this.despawnPokemon();
        });
    }

    pokemonAttack() {
        if (!this.activePokemon) return;
        const scene = this.scene;
        const { sprite, data } = this.activePokemon;

        if (!sprite || !sprite.active) return;

        // Find active enemies to target
        const enemies = scene.enemies.getChildren().filter(e => e.active);
        if (enemies.length === 0) return;

        audio.play(data.attackSound);

        if (data.name === 'charmander') {
            // Fire spread — fan of fire projectiles
            const angles = [-20, 0, 20];
            angles.forEach(deg => {
                const target = Phaser.Utils.Array.GetRandom(enemies);
                const baseAngle = Phaser.Math.Angle.Between(sprite.x, sprite.y, target.x, target.y);
                const angle = baseAngle + Phaser.Math.DegToRad(deg);
                this.fireProjectile(sprite.x, sprite.y, angle, data);
            });
        } else if (data.name === 'bulbasaur') {
            // Razor leaves — 2 homing leaves
            for (let i = 0; i < 2; i++) {
                const target = enemies[i % enemies.length];
                const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, target.x, target.y);
                const proj = this.fireProjectile(sprite.x, sprite.y, angle, data);
                if (proj) {
                    // Setup homing behavior
                    this.setupHomingLeaf(proj, target);
                }
            }
        } else if (data.name === 'squirtle') {
            // Water blast — fast straight shot at nearest enemy
            let nearest = enemies[0];
            let nearestDist = Infinity;
            enemies.forEach(e => {
                const d = Phaser.Math.Distance.Between(sprite.x, sprite.y, e.x, e.y);
                if (d < nearestDist) { nearestDist = d; nearest = e; }
            });
            const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, nearest.x, nearest.y);
            this.fireProjectile(sprite.x, sprite.y, angle, data);
        }
    }

    fireProjectile(x, y, angle, data) {
        const proj = this.pokemonProjectiles.get(x, y, data.projectileKey);
        if (!proj) return null;

        proj.setActive(true).setVisible(true);
        proj.setData('damage', POKEBALL.DAMAGE);
        proj.setData('pokemonType', data.name);
        proj.body.setSize(8, 8);
        proj.setDepth(39);

        const speed = data.projectileSpeed;
        proj.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        // Rotation for leaves
        if (data.name === 'bulbasaur') {
            this.scene.tweens.add({
                targets: proj,
                rotation: Math.PI * 4,
                duration: 1000,
            });
        }

        return proj;
    }

    setupHomingLeaf(proj, target) {
        const scene = this.scene;
        const startTime = scene.time.now;
        const trackDuration = 1500;

        const updateHoming = () => {
            if (!proj.active) {
                scene.events.off('update', updateHoming);
                return;
            }
            const elapsed = scene.time.now - startTime;
            if (elapsed > trackDuration) {
                scene.events.off('update', updateHoming);
                return;
            }
            if (!target.active) return; // Target died, keep going straight

            const angle = Phaser.Math.Angle.Between(proj.x, proj.y, target.x, target.y);
            const currentAngle = Math.atan2(proj.body.velocity.y, proj.body.velocity.x);
            const turnRate = 0.05;
            const newAngle = currentAngle + Phaser.Math.Angle.Wrap(angle - currentAngle) * turnRate;
            const speed = 300;
            proj.body.setVelocity(
                Math.cos(newAngle) * speed,
                Math.sin(newAngle) * speed
            );
        };
        scene.events.on('update', updateHoming);
    }

    onProjectileHitEnemy(proj, enemy) {
        if (!proj.active || !enemy.active) return;

        proj.setActive(false).setVisible(false);
        proj.body.stop();

        const damage = proj.getData('damage') || 1;
        const hp = enemy.getData('hp') - damage;
        enemy.setData('hp', hp);

        // Hit flash
        enemy.setTintFill(0xffffff);
        const scene = this.scene;
        scene.time.delayedCall(60, () => {
            if (enemy.active) enemy.clearTint();
        });

        if (hp <= 0) {
            scene.killEnemy(enemy);
        } else if (enemy.getData('isBoss')) {
            audio.play('enemy_hit');
            scene.hud.showBossHP(hp, enemy.getData('maxHp'));
        } else {
            audio.play('enemy_hit');
        }
    }

    despawnPokemon() {
        if (!this.activePokemon) return;
        const scene = this.scene;
        const { sprite } = this.activePokemon;

        if (this.attackTimer) {
            this.attackTimer.remove();
            this.attackTimer = null;
        }

        // Sparkle fadeout
        if (sprite && sprite.active) {
            scene.spawnExplosion(sprite.x, sprite.y, 10, this.activePokemon.data.color);
            scene.tweens.add({
                targets: sprite,
                scale: 0,
                alpha: 0,
                duration: 500,
                ease: 'Back.easeIn',
                onComplete: () => sprite.destroy(),
            });
        }

        this.activePokemon = null;
    }

    update(time, delta) {
        // Clean off-screen pokemon projectiles
        this.pokemonProjectiles.getChildren().forEach(p => {
            if (p.active && (p.y < -30 || p.y > GAME_HEIGHT + 30 ||
                p.x < -30 || p.x > GAME_WIDTH + 30)) {
                p.setActive(false).setVisible(false);
                p.body.stop();
            }
        });
    }

    cleanup() {
        if (this.attackTimer) {
            this.attackTimer.remove();
            this.attackTimer = null;
        }
        if (this.pokemonTimer) {
            this.pokemonTimer.remove();
            this.pokemonTimer = null;
        }
        if (this.activePokemon?.sprite) {
            this.activePokemon.sprite.destroy();
        }
        this.activePokemon = null;
    }
}
