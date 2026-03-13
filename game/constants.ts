export const PLAYER = {
  WIDTH: 48,
  HEIGHT: 48,
  SPEED: 300,
  SPRINT_SPEED: 560,     // speed when holding Shift
  START_Y_OFFSET: 80,
  LIVES: 5,              // more lives for easier normal mode
  FIRE_RATE: 220,
  RAPID_FIRE_RATE: 90,
  INVINCIBILITY_MS: 2200, // longer grace period after hit
  GOD_FIRE_RATE: 60,     // ms between shots in god mode
} as const;

export const PROJECTILE = {
  WIDTH: 6,
  HEIGHT: 18,
  SPEED: 650,
  DAMAGE: 1,
} as const;

export const ENEMY = {
  meteor404: {
    width: 46,
    height: 46,
    baseSpeed: 80,
    health: 3,
    points: 100,
  },
  bugSwarm: {
    width: 52,
    height: 48,
    baseSpeed: 105,
    health: 2,
    points: 120,
  },
  warningTriangle: {
    width: 44,
    height: 40,
    baseSpeed: 145,
    health: 1,
    points: 80,
  },
  undefinedBlob: {
    width: 52,
    height: 52,
    baseSpeed: 55,
    health: 4,
    points: 180,
  },
  buildBot: {
    width: 44,
    height: 50,
    baseSpeed: 70,
    health: 5,
    points: 250,
  },
  glitchCube: {
    width: 42,
    height: 42,
    baseSpeed: 95,
    health: 3,
    points: 200,
  },
} as const;

export const POWERUP = {
  WIDTH: 28,
  HEIGHT: 28,
  FALL_SPEED: 65,
  autoDocs: {
    color: '#4488FF',
    icon: '⚡',
    label: 'AUTO DOCS',
    duration: 8000,
  },
  versionShield: {
    color: '#00BBFF',
    icon: '🛡',
    label: 'VERSION SHIELD',
    duration: -1,
  },
  deployBurst: {
    color: '#FF6600',
    icon: '💥',
    label: 'DEPLOY BURST',
    duration: 0,
  },
  knowledgeCore: {
    color: '#FFD700',
    icon: '⭐',
    label: '+500 KNOWLEDGE',
    duration: 0,
  },
} as const;

export const DIFFICULTY = {
  MAX_LEVEL: 5,
  MAX_ENEMIES: 16,
  SPEED_MULT_PER_LEVEL: 0.10,
  WAVE_SPAWN_INTERVAL: 0.55,   // seconds between individual enemy spawns in a wave
  WAVE_CLEAR_DELAY: 2.2,       // seconds between wave end and next wave start
  LEVEL_CLEAR_DELAY: 3.5,      // seconds between level end and next level start
} as const;

export const SCORE = {
  COMBO_WINDOW: 2.5,
  MAX_MULTIPLIER: 5,
  KILLS_PER_MULT: 3,
  EXTRA_LIFE_MILESTONES: [5000, 12000, 25000, 50000],
} as const;

export const PARTICLES = {
  POOL_SIZE: 300,
  EXPLOSION_COUNT: 14,
  SPARK_COUNT: 6,
} as const;

export const BG = {
  STAR_COUNT: 130,
  COLOR: '#050510',
  STAR_SPEED_MIN: 18,
  STAR_SPEED_MAX: 90,
} as const;

export const ENEMY_COLORS: Record<string, string> = {
  meteor404: '#8B5A2B',
  bugSwarm: '#22CC44',
  warningTriangle: '#FFCC00',
  undefinedBlob: '#9933FF',
  buildBot: '#CC3300',
  glitchCube: '#00CCFF',
};

export const POWERUP_COLORS: Record<string, string> = {
  autoDocs: '#4488FF',
  versionShield: '#00BBFF',
  deployBurst: '#FF6600',
  knowledgeCore: '#FFD700',
};

// ─── Environments ────────────────────────────────────────────────────────────

type EnvKey = 'space' | 'forest' | 'city' | 'ocean' | 'inferno' | 'chaos';

export const ENVIRONMENTS: Record<EnvKey, {
  name: string;
  bgTop: string;
  bgBottom: string;
  horizonColor: string;
  stars: boolean;
}> = {
  space:   { name: 'DEEP SPACE',     bgTop: '#020210', bgBottom: '#050520', horizonColor: '#0a0a30', stars: true  },
  forest:  { name: 'ANCIENT FOREST', bgTop: '#040D06', bgBottom: '#0B2212', horizonColor: '#0d3010', stars: false },
  city:    { name: 'NEON CITY',      bgTop: '#040418', bgBottom: '#0C0C28', horizonColor: '#14143a', stars: false },
  ocean:   { name: 'DEEP OCEAN',     bgTop: '#010A18', bgBottom: '#041828', horizonColor: '#082035', stars: false },
  inferno: { name: 'INFERNO CORE',   bgTop: '#1A0200', bgBottom: '#380500', horizonColor: '#600a00', stars: false },
  chaos:   { name: 'CHAOS DIMENSION', bgTop: '#0D0020', bgBottom: '#200010', horizonColor: '#330033', stars: false },
};

export function getEnvironment(level: number): EnvKey {
  if (level <= 1) return 'space';
  if (level <= 2) return 'forest';
  if (level <= 3) return 'city';
  if (level <= 4) return 'ocean';
  return 'inferno';
}

// ─── Level Wave Definitions ──────────────────────────────────────────────────

type WaveEntry = { type: string; count: number };

// BONUS_WAVES — 3 escalating chaos waves after level 5
export const BONUS_WAVES: WaveEntry[][] = [
  // Wave 1: The Welcome Party
  [{ type: 'bugSwarm', count: 10 }, { type: 'warningTriangle', count: 8 }, { type: 'meteor404', count: 6 }],
  // Wave 2: The Heavy Hitters
  [{ type: 'buildBot', count: 8 }, { type: 'glitchCube', count: 8 }, { type: 'undefinedBlob', count: 7 }],
  // Wave 3: EVERYTHING AT ONCE
  [{ type: 'meteor404', count: 7 }, { type: 'bugSwarm', count: 7 }, { type: 'warningTriangle', count: 6 },
   { type: 'undefinedBlob', count: 6 }, { type: 'buildBot', count: 6 }, { type: 'glitchCube', count: 6 }],
];

// LEVEL_WAVES[level-1][waveIndex] = array of WaveEntry
export const LEVEL_WAVES: WaveEntry[][][] = [
  // ── Level 1 · Deep Space ─────────────────────────────────────────────────
  [
    [{ type: 'meteor404', count: 6 }, { type: 'bugSwarm', count: 4 }],
    [{ type: 'bugSwarm', count: 6 }, { type: 'warningTriangle', count: 4 }, { type: 'undefinedBlob', count: 2 }],
    [{ type: 'meteor404', count: 6 }, { type: 'bugSwarm', count: 5 }, { type: 'undefinedBlob', count: 3 }],
  ],
  // ── Level 2 · Ancient Forest ─────────────────────────────────────────────
  [
    [{ type: 'undefinedBlob', count: 6 }, { type: 'buildBot', count: 4 }],
    [{ type: 'buildBot', count: 5 }, { type: 'bugSwarm', count: 6 }, { type: 'glitchCube', count: 3 }],
    [{ type: 'buildBot', count: 5 }, { type: 'undefinedBlob', count: 5 }, { type: 'glitchCube', count: 5 }],
  ],
  // ── Level 3 · Neon City ──────────────────────────────────────────────────
  [
    [{ type: 'buildBot', count: 7 }, { type: 'warningTriangle', count: 5 }, { type: 'glitchCube', count: 3 }],
    [{ type: 'glitchCube', count: 8 }, { type: 'undefinedBlob', count: 5 }],
    [{ type: 'bugSwarm', count: 9 }, { type: 'buildBot', count: 5 }, { type: 'warningTriangle', count: 3 }],
    [{ type: 'buildBot', count: 6 }, { type: 'glitchCube', count: 6 }, { type: 'undefinedBlob', count: 4 }],
  ],
  // ── Level 4 · Deep Ocean ─────────────────────────────────────────────────
  [
    [{ type: 'bugSwarm', count: 9 }, { type: 'undefinedBlob', count: 6 }, { type: 'buildBot', count: 4 }],
    [{ type: 'glitchCube', count: 8 }, { type: 'buildBot', count: 7 }],
    [{ type: 'warningTriangle', count: 10 }, { type: 'buildBot', count: 6 }, { type: 'glitchCube', count: 5 }],
    [{ type: 'buildBot', count: 7 }, { type: 'glitchCube', count: 7 }, { type: 'undefinedBlob', count: 5 }, { type: 'warningTriangle', count: 3 }],
  ],
  // ── Level 5 · Inferno Core ───────────────────────────────────────────────
  [
    [{ type: 'meteor404', count: 12 }, { type: 'buildBot', count: 8 }, { type: 'glitchCube', count: 6 }],
    [{ type: 'glitchCube', count: 10 }, { type: 'undefinedBlob', count: 8 }, { type: 'buildBot', count: 6 }],
    [{ type: 'bugSwarm', count: 14 }, { type: 'warningTriangle', count: 8 }, { type: 'buildBot', count: 7 }],
    [{ type: 'buildBot', count: 9 }, { type: 'glitchCube', count: 9 }, { type: 'undefinedBlob', count: 6 }, { type: 'warningTriangle', count: 5 }],
    [{ type: 'meteor404', count: 5 }, { type: 'buildBot', count: 6 }, { type: 'glitchCube', count: 6 }, { type: 'undefinedBlob', count: 6 }, { type: 'warningTriangle', count: 6 }, { type: 'bugSwarm', count: 5 }],
  ],
];
