import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENEMY_TYPES } from '../constants.js';

// Mulberry32 — fast, deterministic 32-bit PRNG
function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class WaveGenerator {
    constructor(scene) {
        this.scene = scene;
    }

    generateWave(level) {
        // Seed the RNG with the level number — same level always produces the same wave
        const rng = mulberry32(level * 7919 + 31337);

        const enemies = [];
        const cols = Math.min(8, 4 + Math.floor(level / 3));
        const rows = Math.min(5, 2 + Math.floor(level / 4));
        const spacingX = 44;
        const spacingY = 40;
        const offsetX = (GAME_WIDTH - (cols - 1) * spacingX) / 2;
        const offsetY = 60;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const type = this.pickEnemyType(level, row, rng);
                const formX = offsetX + col * spacingX;
                const formY = offsetY + row * spacingY;

                // Entry position — deterministic spread from center
                const side = (col + row) % 2 === 0 ? -1 : 1;
                const startX = GAME_WIDTH / 2 + side * (50 + rng() * 150);

                // Alternate path types based on position
                const pathTypes = ['arc', 'straight', 'spiral'];
                const pathType = pathTypes[(row + col) % pathTypes.length];

                enemies.push({
                    type,
                    formX,
                    formY,
                    startX,
                    pathType: level <= 2 ? 'straight' : pathType,
                });
            }
        }

        return { enemies };
    }

    pickEnemyType(level, row, rng) {
        // Front rows get weaker enemies, back rows stronger
        // Higher levels introduce tougher types

        if (row === 0) {
            // Back row — elites and tanks at higher levels
            if (level >= 5 && rng() < 0.3) return ENEMY_TYPES.ELITE;
            if (level >= 6 && rng() < 0.2) return ENEMY_TYPES.TANK;
            if (level >= 7 && rng() < 0.15) return ENEMY_TYPES.CARRIER;
            return ENEMY_TYPES.GRUNT;
        }

        if (row === 1) {
            if (level >= 4 && rng() < 0.25) return ENEMY_TYPES.BOMBER;
            if (level >= 3 && rng() < 0.3) return ENEMY_TYPES.SWOOPER;
            return ENEMY_TYPES.GRUNT;
        }

        // Front rows
        if (level >= 3 && rng() < 0.3) return ENEMY_TYPES.SWOOPER;
        return ENEMY_TYPES.GRUNT;
    }
}
