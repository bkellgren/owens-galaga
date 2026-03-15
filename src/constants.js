// Game-wide constants and configuration
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

export const DIFFICULTY = {
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard'
};

export const DIFFICULTY_MODIFIERS = {
    [DIFFICULTY.EASY]: {
        enemySpeedMult: 0.75,
        diveFreqMult: 0.6,
        projectileSpeedMult: 0.7,
        hpMult: 1.0,
        label: 'EASY'
    },
    [DIFFICULTY.NORMAL]: {
        enemySpeedMult: 1.0,
        diveFreqMult: 1.0,
        projectileSpeedMult: 1.0,
        hpMult: 1.0,
        label: 'NORMAL'
    },
    [DIFFICULTY.HARD]: {
        enemySpeedMult: 1.3,
        diveFreqMult: 1.5,
        projectileSpeedMult: 1.3,
        hpMult: 1.5,
        label: 'HARD'
    }
};

export const PLAYER = {
    SPEED: 280,
    ACCELERATION: 1200,
    DECELERATION: 800,
    SHOT_SPEED: 500,
    MAX_SHOTS: 2,
    RESPAWN_INVULN_MS: 2000,
    CHARGE_TIME_MS: 1500,
    CHARGED_SHOT_DAMAGE: 3,
    CHARGED_SHOT_WIDTH: 12,
    STARTING_LIVES: 3,
    MAX_LIVES: 5,
    EXTRA_LIFE_SCORE: 50000,
    SHIP_WIDTH: 32,
    SHIP_HEIGHT: 32,
    BOTTOM_MARGIN: 0.1, // 10% from bottom
};

export const ENEMY_TYPES = {
    GRUNT: {
        key: 'grunt',
        hp: 1,
        dropChance: 0.05,
        points: 100,
        speed: 100,
        color: 0x44ff44,
        width: 28,
        height: 28,
    },
    SWOOPER: {
        key: 'swooper',
        hp: 1,
        dropChance: 0.08,
        points: 150,
        speed: 140,
        color: 0xffff44,
        width: 26,
        height: 26,
    },
    TANK: {
        key: 'tank',
        hp: 3,
        dropChance: 0.20,
        points: 300,
        speed: 60,
        color: 0xff4444,
        width: 34,
        height: 34,
    },
    ELITE: {
        key: 'elite',
        hp: 2,
        dropChance: 0.15,
        points: 250,
        speed: 100,
        color: 0xff44ff,
        width: 30,
        height: 30,
    },
    BOMBER: {
        key: 'bomber',
        hp: 2,
        dropChance: 0.18,
        points: 250,
        speed: 80,
        color: 0xff8844,
        width: 30,
        height: 30,
    },
    CARRIER: {
        key: 'carrier',
        hp: 4,
        dropChance: 0.30,
        points: 400,
        speed: 50,
        color: 0x4488ff,
        width: 38,
        height: 38,
    },
};

export const POWERUP_TYPES = {
    DUAL_LASER: { key: 'dual_laser', weight: 22, duration: 15000, color: 0x00ffff, label: 'DUAL' },
    BOMB: { key: 'bomb', weight: 18, duration: 0, color: 0xff0000, label: 'BOMB' },
    FORCE_FIELD: { key: 'force_field', weight: 15, duration: 8000, color: 0x00aaff, label: 'SHLD' },
    SPREAD_BLAST: { key: 'spread_blast', weight: 10, duration: 10000, color: 0xffaa00, label: 'SPRD' },
    RICOCHET: { key: 'ricochet', weight: 10, duration: 12000, color: 0xaaff00, label: 'RICOCHET' },
    SPEED_BOOST: { key: 'speed_boost', weight: 10, duration: 10000, color: 0xffff00, label: 'SPD' },
    MULTI_SHIP: { key: 'multi_ship', weight: 5, duration: 0, color: 0xff00ff, label: 'MULTI' },
    TIME_SLOW: { key: 'time_slow', weight: 5, duration: 5000, color: 0x8888ff, label: 'SLOW' },
};

export const BOMB = {
    MAX_COUNT: 3,
    BLAST_RADIUS_PCT: 0.5, // 50% of screen width
    BOSS_DAMAGE_PCT: 0.27, // ~27% of boss max HP
};

export const COMBO = {
    WINDOW_MS: 1500,
    MAX_MULTIPLIER: 10,
};

export const POWERUP = {
    DROP_COOLDOWN_MS: 8000,
    MAGNET_RADIUS_PCT: 0.25, // 25% of screen width
    MAGNET_STRENGTH: 150,
    FALL_SPEED: 100,
    ESCALATION_INTERVAL: 5, // every 5 levels
    ESCALATION_BONUS: 0.025, // +2.5% drop chance
};

export const COLORS = {
    BACKGROUND: 0x0a0a1a,
    STARS_DIM: 0x333355,
    STARS_BRIGHT: 0x8888cc,
    HUD_TEXT: '#ffffff',
    HUD_SCORE: '#ffff00',
    HUD_HIGHLIGHT: '#00ffff',
};

export const GAME_STATES = {
    MENU: 'MenuScene',
    DIFFICULTY_SELECT: 'DifficultySelectScene',
    PLAYING: 'GameScene',
    BOSS_FIGHT: 'boss_fight',
    BOSS_REPLAY: 'boss_replay',
    BONUS_ROUND: 'BonusRoundScene',
    GAME_OVER: 'GameOverScene',
};
