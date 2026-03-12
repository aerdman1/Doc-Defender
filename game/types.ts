export type GamePhase = 'idle' | 'playing' | 'paused' | 'gameover' | 'victory';

export type EnvironmentId = 'space' | 'forest' | 'city' | 'ocean' | 'inferno';

export type EnemyType =
  | 'meteor404'
  | 'bugSwarm'
  | 'warningTriangle'
  | 'undefinedBlob'
  | 'buildBot'
  | 'glitchCube';

export type PowerUpType =
  | 'autoDocs'
  | 'versionShield'
  | 'deployBurst'
  | 'knowledgeCore';

export interface ActiveGuns {
  plasma: boolean;
  spread: boolean;
  side: boolean;
  rear: boolean;
}

export const DEFAULT_GUNS: ActiveGuns = {
  plasma: true,
  spread: true,
  side: true,
  rear: true,
};

export interface WaveSpawn {
  type: EnemyType;
  count: number;
}

export interface GameCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onScoreChange: (score: number) => void;
  onHighScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onMultiplierChange: (mult: number) => void;
  onPowerUpChange: (type: PowerUpType | null, expiresAt: number) => void;
  onNewHighScore: () => void;
  onGunsChange?: (guns: ActiveGuns) => void;
}
