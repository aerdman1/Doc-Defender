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
  // ── Formation & shooter enemies ────────────────────────────────────────────
  formationBug: {       // slow grid invader — spawned in clusters
    width: 36,
    height: 32,
    baseSpeed: 22,
    health: 2,
    points: 90,
  },
  shooterBug: {         // fires aimed projectiles at the player
    width: 44,
    height: 44,
    baseSpeed: 60,
    health: 2,
    points: 160,
  },
  turretBug: {          // descends slowly, rotating barrel fires aimed bursts
    width: 46,
    height: 46,
    baseSpeed: 30,
    health: 4,
    points: 220,
  },
  shieldBot: {          // regenerating hex shield absorbs hits before body
    width: 48,
    height: 48,
    baseSpeed: 50,
    health: 5,
    points: 280,
  },
  kamikazeBug: {        // locks on and dives at the player at high speed
    width: 36,
    height: 36,
    baseSpeed: 80,
    health: 2,
    points: 150,
  },
  // ── Level mini-bosses ──────────────────────────────────────────────────────
  bsodBug: {       // Level 1 — Blue Screen of Death
    width: 80,
    height: 70,
    baseSpeed: 55,
    health: 120,
    points: 1500,
  },
  loopZilla: {     // Level 2 — Infinite Loop Monster
    width: 78,
    height: 78,
    baseSpeed: 65,
    health: 200,
    points: 2000,
  },
  syntaxTerror: {  // Level 3 — Syntax Error Terrorizer
    width: 84,
    height: 80,
    baseSpeed: 70,
    health: 300,
    points: 2500,
  },
  nullPhantom: {   // Level 4 — Null Pointer Phantom
    width: 76,
    height: 82,
    baseSpeed: 60,
    health: 420,
    points: 3000,
  },
  stackTitan: {    // Level 5 — Stack Overflow Titan
    width: 90,
    height: 96,
    baseSpeed: 80,
    health: 600,
    points: 4000,
  },
} as const;

export const POWERUP = {
  WIDTH: 48,
  HEIGHT: 48,
  FALL_SPEED: 55,
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
  MAX_ENEMIES: 22,
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
  formationBug: '#FF6B35',
  shooterBug: '#CC44FF',
  turretBug: '#AA4400',
  shieldBot: '#4488FF',
  kamikazeBug: '#FF2200',
  bsodBug: '#0078D4',
  loopZilla: '#44DD22',
  syntaxTerror: '#FF3333',
  nullPhantom: '#AABBFF',
  stackTitan: '#FF6600',
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
  space:   { name: 'DISCOVERY DRIFT',  bgTop: '#04041A', bgBottom: '#080828', horizonColor: '#0e0e40', stars: true  },
  forest:  { name: 'INTEGRATION GRID', bgTop: '#030D10', bgBottom: '#081E20', horizonColor: '#0a2828', stars: false },
  city:    { name: 'MIGRATION STORM',  bgTop: '#0D0A04', bgBottom: '#1E1408', horizonColor: '#2a1e0a', stars: false },
  ocean:   { name: 'LAUNCH SEQUENCE',  bgTop: '#010818', bgBottom: '#030E28', horizonColor: '#050e2e', stars: false },
  inferno: { name: 'LIVE OPS RIFT',    bgTop: '#1A0200', bgBottom: '#380500', horizonColor: '#600a00', stars: false },
  chaos:   { name: 'CHAOS BUILD',      bgTop: '#0D0020', bgBottom: '#200010', horizonColor: '#330033', stars: false },
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

// BONUS_WAVES — 2 escalating chaos waves after level 5
export const BONUS_WAVES: WaveEntry[][] = [
  // Wave 1: The Welcome Party — formations + full chaos
  [{ type: 'formationBug', count: 36 }, { type: 'shooterBug', count: 14 }, { type: 'buildBot', count: 12 }, { type: 'bugSwarm', count: 12 }, { type: 'glitchCube', count: 10 }, { type: 'warningTriangle', count: 8 }, { type: 'meteor404', count: 8 }, { type: 'kamikazeBug', count: 6 }, { type: 'turretBug', count: 5 }, { type: 'shieldBot', count: 4 }],
  // Wave 2: EVERYTHING AT ONCE — four formation blocks + all types at max
  [{ type: 'formationBug', count: 48 }, { type: 'shooterBug', count: 16 }, { type: 'buildBot', count: 14 }, { type: 'glitchCube', count: 12 }, { type: 'bugSwarm', count: 12 }, { type: 'undefinedBlob', count: 10 }, { type: 'meteor404', count: 8 }, { type: 'warningTriangle', count: 8 }, { type: 'kamikazeBug', count: 8 }, { type: 'turretBug', count: 6 }, { type: 'shieldBot', count: 5 }],
];

// LEVEL_WAVES[level-1][waveIndex] = array of WaveEntry
// Formation counts above 12 automatically split into multiple successive blocks (capped at 12/group)
export const LEVEL_WAVES: WaveEntry[][][] = [
  // ── Level 1 · Discovery Drift ────────────────────────────────────────────
  [
    // Wave 1: formation blocks + scattered bugs
    [{ type: 'formationBug', count: 24 }, { type: 'meteor404', count: 10 }, { type: 'bugSwarm', count: 8 }, { type: 'warningTriangle', count: 5 }, { type: 'shooterBug', count: 4 }],
    [{ type: 'bsodBug', count: 1 }],  // ⚠️ MINI-BOSS: PIPELINE PHANTOM
  ],
  // ── Level 2 · Integration Grid ───────────────────────────────────────────
  [
    // Wave 1: formations + heavies + shooters
    [{ type: 'formationBug', count: 36 }, { type: 'undefinedBlob', count: 8 }, { type: 'buildBot', count: 7 }, { type: 'glitchCube', count: 6 }, { type: 'shooterBug', count: 6 }, { type: 'kamikazeBug', count: 3 }],
    [{ type: 'loopZilla', count: 1 }],  // ⚠️ MINI-BOSS: JWT JUGGERNAUT
  ],
  // ── Level 3 · Migration Storm ────────────────────────────────────────────
  [
    // Wave 1: triple formation + full mix
    [{ type: 'formationBug', count: 36 }, { type: 'bugSwarm', count: 12 }, { type: 'glitchCube', count: 10 }, { type: 'buildBot', count: 8 }, { type: 'shooterBug', count: 8 }, { type: 'warningTriangle', count: 5 }, { type: 'kamikazeBug', count: 4 }, { type: 'turretBug', count: 3 }],
    [{ type: 'syntaxTerror', count: 1 }],  // ⚠️ MINI-BOSS: LEGACY LEVIATHAN
  ],
  // ── Level 4 · Launch Sequence ────────────────────────────────────────────
  [
    // Wave 1: triple formation + elite mix
    [{ type: 'formationBug', count: 36 }, { type: 'shooterBug', count: 12 }, { type: 'buildBot', count: 10 }, { type: 'glitchCube', count: 10 }, { type: 'undefinedBlob', count: 8 }, { type: 'warningTriangle', count: 6 }, { type: 'kamikazeBug', count: 4 }, { type: 'turretBug', count: 4 }, { type: 'shieldBot', count: 3 }],
    [{ type: 'nullPhantom', count: 1 }],  // ⚠️ MINI-BOSS: DEPLOY DRAGON
  ],
  // ── Level 5 · Live Ops Rift ──────────────────────────────────────────────
  [
    // Wave 1: four formation blocks + everything
    [{ type: 'formationBug', count: 48 }, { type: 'shooterBug', count: 14 }, { type: 'buildBot', count: 12 }, { type: 'glitchCube', count: 12 }, { type: 'bugSwarm', count: 10 }, { type: 'undefinedBlob', count: 8 }, { type: 'warningTriangle', count: 6 }, { type: 'kamikazeBug', count: 5 }, { type: 'turretBug', count: 5 }, { type: 'shieldBot', count: 4 }],
    [{ type: 'stackTitan', count: 1 }],  // ⚠️ MINI-BOSS: PATCH HYDRA
  ],
];
