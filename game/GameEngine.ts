import { GamePhase, GameCallbacks, EnemyType, PowerUpType, ActiveGuns, DEFAULT_GUNS, EnvironmentId } from './types';
import {
  PLAYER, DIFFICULTY, SCORE, BG, PARTICLES,
  ENEMY_COLORS, POWERUP_COLORS, ENVIRONMENTS, LEVEL_WAVES, BONUS_WAVES, getEnvironment
} from './constants';
import { InputManager } from './InputManager';
import { Player } from './entities/Player';
import { Projectile } from './entities/Projectile';
import { Enemy, createEnemy } from './entities/Enemy';
import { PowerUp, createPowerUp } from './entities/PowerUp';
import { ParticleSystem } from './entities/Particle';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  life: number; // 1 → 0
  color: string;
}

interface EnvParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;   // 0 to 1, resets when < 0
  color: string;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;

  private input: InputManager;
  private particles: ParticleSystem;

  // Entity arrays
  private player!: Player;
  private projectiles: Projectile[] = [];
  private enemies: Enemy[] = [];
  private powerUps: PowerUp[] = [];
  private stars: Star[] = [];
  private scorePopups: ScorePopup[] = [];

  // Game state
  private phase: GamePhase = 'idle';
  private godMode = false;
  private activeGuns: ActiveGuns = { ...DEFAULT_GUNS };
  private score = 0;
  private highScore = 0;
  private level = 1;
  private combo = 0;
  private multiplier = 1;
  private comboTimer = 0;

  // Timing
  private rafId = 0;
  private lastTime = 0;
  private powerUpTimer = 20;

  // Wave state
  private waveIndex = 0;
  private waveQueue: EnemyType[] = [];
  private waveSpawnTimer = 0;
  private waveState: 'active' | 'transitioning' = 'active';
  private waveTransitionTimer = 0;

  // Environment
  private envId: EnvironmentId = 'space';
  private envParticles: EnvParticle[] = [];
  private envGeometry: { nodes: number[] } = { nodes: [] };

  // Bonus round
  private bonusRound = false;

  // Banner
  private bannerText = '';
  private bannerSubtext = '';
  private bannerTimer = 0;

  // Mouse shooting
  private mouseHeld = false;
  private onMouseDown = (e: MouseEvent) => { if (e.button === 0) this.mouseHeld = true; };
  private onMouseUp   = (e: MouseEvent) => { if (e.button === 0) this.mouseHeld = false; };

  // Track last reported power-up so we can notify React when it expires
  private lastReportedPowerUp: PowerUpType | null = null;

  // Effects
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private flashTimer = 0;
  private flashColor = 'rgba(255, 40, 40, 0.35)';

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    this.input = new InputManager();
    this.particles = new ParticleSystem();

    try {
      const saved = localStorage.getItem('docsDefenderHighScore');
      this.highScore = saved ? parseInt(saved, 10) : 0;
      callbacks.onHighScoreChange(this.highScore);
    } catch { /* localStorage not available */ }

    this.initStars();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);

    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  // ─── Game loop ──────────────────────────────────────────────────────────────

  private loop = (ts: number) => {
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;

    this.updateStars(dt);

    if (this.phase === 'playing') {
      this.updateGame(dt, ts);
    }

    this.handleGlobalInput(ts);
    this.render(ts);
    this.input.flush();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleGlobalInput(now: number) {
    const spaceOrEnter = this.input.wasPressed(' ') || this.input.wasPressed('Enter');
    const escOrP = this.input.wasPressed('Escape') || this.input.wasPressed('p') || this.input.wasPressed('P');

    if (spaceOrEnter) {
      if (this.phase === 'idle') this.startGame(now);
      else if (this.phase === 'gameover') this.startGame(now);
    }
    if (escOrP) {
      if (this.phase === 'playing') this.pauseGame();
      else if (this.phase === 'paused') this.resumeGame(now);
    }

    // Gun toggles (god mode only, keys 1-4)
    if (this.godMode && this.phase === 'playing') {
      if (this.input.wasPressed('1')) { this.activeGuns.plasma = !this.activeGuns.plasma; this.callbacks.onGunsChange?.({ ...this.activeGuns }); }
      if (this.input.wasPressed('2')) { this.activeGuns.spread = !this.activeGuns.spread; this.callbacks.onGunsChange?.({ ...this.activeGuns }); }
      if (this.input.wasPressed('3')) { this.activeGuns.side   = !this.activeGuns.side;   this.callbacks.onGunsChange?.({ ...this.activeGuns }); }
      if (this.input.wasPressed('4')) { this.activeGuns.rear   = !this.activeGuns.rear;   this.callbacks.onGunsChange?.({ ...this.activeGuns }); }
    }
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  private updateGame(dt: number, now: number) {
    const shooting = this.input.isDown(' ') || this.input.isDown('z') || this.input.isDown('Z');

    this.player.update(dt, this.input, this.canvas.width, this.canvas.height, now);

    // Sync power-up state to React when it changes or expires
    if (this.player.activePowerUp !== this.lastReportedPowerUp) {
      this.lastReportedPowerUp = this.player.activePowerUp;
      this.callbacks.onPowerUpChange(this.player.activePowerUp, this.player.powerUpExpiresAt);
    }

    const wantShoot = this.godMode || shooting || this.mouseHeld;
    if (wantShoot) {
      const canFire = this.player.tryShoot(now, this.godMode);
      if (canFire) {
        const { x, y, width: W, height: H } = this.player;
        const muzzle = y - H / 2;

        if (this.godMode) {
          // ── GOD MODE: fire only the toggled guns ─────────────
          const g = this.activeGuns;
          if (g.plasma) {
            this.projectiles.push(new Projectile(x, muzzle, -Math.PI / 2, 700, 3, 'plasma'));
          }
          if (g.spread) {
            for (let i = -3; i <= 3; i++) {
              if (i === 0 && g.plasma) continue; // plasma covers center
              const a = -Math.PI / 2 + i * 0.22;
              this.projectiles.push(new Projectile(x, muzzle, a, 600, 1, 'spread'));
            }
          }
          if (g.side) {
            this.projectiles.push(new Projectile(x, y, -Math.PI / 2 - 0.72, 550, 2, 'side'));
            this.projectiles.push(new Projectile(x, y, -Math.PI / 2 + 0.72, 550, 2, 'side'));
          }
          if (g.rear) {
            this.projectiles.push(new Projectile(x, y + H / 2, Math.PI / 2, 500, 1, 'rear'));
          }
          // If every gun is off, fall back to a basic shot so you still fire something
          if (!g.plasma && !g.spread && !g.side && !g.rear) {
            this.projectiles.push(new Projectile(x, muzzle));
          }
        } else {
          // ── Normal single shot ──────────────────────────────
          this.projectiles.push(new Projectile(x, muzzle));
        }
      }
    }

    this.projectiles.forEach(p => p.update(dt, this.canvas.width, this.canvas.height));
    this.enemies.forEach(e => e.update(dt, this.player.x, this.player.y, this.canvas.width, now));
    this.powerUps.forEach(p => p.update(dt));
    this.particles.update(dt);

    this.scorePopups.forEach(sp => {
      sp.life -= dt * 1.6;
      sp.y -= 38 * dt;
    });

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.updateMultiplier();
      }
    }

    this.checkCollisions(now);

    // Enemies reaching the bottom cost a life
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.isOffscreen(this.canvas.height)) {
        e.active = false;
        this.doPlayerHit(now);
      }
    }

    // Cleanup inactive entities BEFORE wave update so enemies.length is accurate
    this.projectiles = this.projectiles.filter(p => p.active);
    this.enemies = this.enemies.filter(e => e.active);
    this.powerUps = this.powerUps.filter(p => p.active && !p.isOffscreen(this.canvas.height));
    this.scorePopups = this.scorePopups.filter(sp => sp.life > 0);

    this.updateEnvParticles(dt);
    this.updateWaves(dt);
  }

  private checkCollisions(now: number) {
    // Projectiles vs enemies
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        if (this.aabb(proj, enemy)) {
          const died = enemy.takeDamage(proj.damage);
          proj.active = false;
          this.particles.emitSparks(enemy.x, enemy.y, ENEMY_COLORS[enemy.type] ?? '#ffff00');
          if (died) this.onEnemyKilled(enemy, now);
          break;
        }
      }
    }

    // Enemies vs player (body contact)
    if (!this.player.isInvincible(now)) {
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        if (this.circleOverlap(this.player, enemy, 22)) {
          enemy.active = false;
          this.particles.emitExplosion(enemy.x, enemy.y, '#FF4444', 8);
          this.doPlayerHit(now);
        }
      }
    }

    // Power-ups vs player
    for (const pu of this.powerUps) {
      if (!pu.active) continue;
      if (this.circleOverlap(this.player, pu, 30)) {
        pu.active = false;
        this.onPowerUpCollected(pu.type, pu.x, pu.y, now);
      }
    }
  }

  private aabb(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
      Math.abs(a.y - b.y) < (a.height + b.height) / 2
    );
  }

  private circleOverlap(
    a: { x: number; y: number },
    b: { x: number; y: number },
    radius: number
  ): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy < radius * radius;
  }

  private onEnemyKilled(enemy: Enemy, now: number) {
    this.particles.emitExplosion(enemy.x, enemy.y, ENEMY_COLORS[enemy.type] ?? '#FFAA00', PARTICLES.EXPLOSION_COUNT);

    const pts = Math.round(enemy.points * this.multiplier);
    this.addScore(pts);

    this.combo++;
    this.comboTimer = SCORE.COMBO_WINDOW;
    this.updateMultiplier();

    this.scorePopups.push({
      x: enemy.x,
      y: enemy.y,
      text: `+${pts}`,
      life: 1,
      color: pts >= 400 ? '#FFD700' : '#FFFFFF',
    });

    // 20% power-up drop chance
    if (Math.random() < 0.2) {
      this.powerUps.push(createPowerUp(enemy.x));
    }

    // Extra life milestones
    for (const milestone of SCORE.EXTRA_LIFE_MILESTONES) {
      if (this.score - pts < milestone && this.score >= milestone && this.player.lives < 5) {
        this.player.lives++;
        this.callbacks.onLivesChange(this.player.lives);
        this.scorePopups.push({
          x: this.canvas.width / 2,
          y: this.canvas.height / 2 + 30,
          text: '1-UP! 🦉',
          life: 1,
          color: '#FF88AA',
        });
      }
    }
  }

  private doPlayerHit(now: number) {
    if (this.godMode) return; // god mode: completely immune
    const lost = this.player.takeDamage(now);
    if (!lost) return;

    this.particles.emitFeathers(this.player.x, this.player.y);
    this.shakeTimer = 0.4;
    this.shakeIntensity = 7;
    this.flashTimer = 0.45;
    this.flashColor = 'rgba(255, 30, 30, 0.35)';

    this.combo = 0;
    this.updateMultiplier();
    this.callbacks.onLivesChange(this.player.lives);

    if (this.player.lives <= 0) this.endGame();
  }

  private onPowerUpCollected(type: PowerUpType, x: number, y: number, now: number) {
    this.particles.emitPowerUpCollect(x, y, POWERUP_COLORS[type] ?? '#FFFFFF');
    this.flashTimer = 0.2;
    this.flashColor = `rgba(${hexToRgb(POWERUP_COLORS[type] ?? '#FFFFFF')}, 0.2)`;

    if (type === 'deployBurst') {
      this.enemies.forEach(e => {
        if (!e.active) return;
        e.takeDamage(999);
        this.particles.emitExplosion(e.x, e.y, ENEMY_COLORS[e.type], 8);
      });
      this.enemies = this.enemies.filter(e => e.active);
      this.shakeTimer = 0.5;
      this.shakeIntensity = 10;
      this.flashTimer = 0.5;
      this.flashColor = 'rgba(255, 140, 40, 0.4)';
      this.addScore(500);
      this.scorePopups.push({ x, y, text: 'DEPLOY BURST! +500', life: 1, color: '#FF8800' });
    } else if (type === 'knowledgeCore') {
      this.addScore(500);
      this.scorePopups.push({ x, y, text: '+500 KNOWLEDGE!', life: 1, color: '#FFD700' });
    } else {
      this.player.activatePowerUp(type, now);
      const expiry = type === 'versionShield' ? -1 : now + 8000;
      this.callbacks.onPowerUpChange(type, expiry);
    }
  }

  private addScore(points: number) {
    this.score += points;
    this.callbacks.onScoreChange(this.score);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.callbacks.onHighScoreChange(this.highScore);
      this.callbacks.onNewHighScore();
      try { localStorage.setItem('docsDefenderHighScore', String(this.highScore)); } catch { /* noop */ }
    }
  }

  private updateMultiplier() {
    const m = Math.min(SCORE.MAX_MULTIPLIER, 1 + Math.floor(this.combo / SCORE.KILLS_PER_MULT));
    if (m !== this.multiplier) {
      this.multiplier = m;
      this.callbacks.onMultiplierChange(m);
    }
  }

  // ─── Wave System ─────────────────────────────────────────────────────────────

  private updateWaves(dt: number) {
    // Power-ups still spawn independently
    this.powerUpTimer -= dt;
    if (this.powerUpTimer <= 0) {
      const x = 60 + Math.random() * (this.canvas.width - 120);
      this.powerUps.push(createPowerUp(x));
      this.powerUpTimer = 18 + Math.random() * 12;
    }

    // Transition delay between waves/levels
    if (this.waveState === 'transitioning') {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        this.beginWave();
      }
      return;
    }

    // Spawn next queued enemy
    if (this.waveQueue.length > 0 && this.enemies.length < DIFFICULTY.MAX_ENEMIES) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        const type = this.waveQueue.shift()!;
        this.enemies.push(createEnemy(type, this.canvas.width, this.level));
        this.waveSpawnTimer = DIFFICULTY.WAVE_SPAWN_INTERVAL * (0.7 + Math.random() * 0.6);
      }
    }

    // Wave complete: queue empty AND no enemies left
    if (this.waveQueue.length === 0 && this.enemies.length === 0) {
      this.onWaveComplete();
    }
  }

  private onWaveComplete() {
    const waves = this.bonusRound ? BONUS_WAVES : LEVEL_WAVES[this.level - 1];
    if (this.waveIndex < waves.length - 1) {
      // More waves in this level / bonus round
      this.waveIndex++;
      this.waveState = 'transitioning';
      this.waveTransitionTimer = DIFFICULTY.WAVE_CLEAR_DELAY;
      this.showBanner(`WAVE ${this.waveIndex + 1}`, `of ${waves.length}`);
    } else if (this.bonusRound) {
      // Bonus round complete → TRUE VICTORY
      this.phase = 'victory';
      this.callbacks.onPhaseChange('victory');
    } else if (this.level < DIFFICULTY.MAX_LEVEL) {
      // Next level
      this.level++;
      this.callbacks.onLevelChange(this.level);
      this.waveIndex = 0;
      this.waveState = 'transitioning';
      this.waveTransitionTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
      const newEnv = getEnvironment(this.level);
      if (newEnv !== this.envId) {
        this.envId = newEnv;
        this.initEnvParticles();
      }
      this.showBanner(`LEVEL ${this.level}`, ENVIRONMENTS[newEnv].name);
    } else {
      // Level 5 done → BONUS ROUND!
      this.bonusRound = true;
      this.envId = 'chaos';
      this.initEnvParticles();
      this.waveIndex = 0;
      this.waveState = 'transitioning';
      this.waveTransitionTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
      this.bannerText = '⭐ BONUS ROUND ⭐';
      this.bannerSubtext = 'CHAOS DIMENSION';
      this.bannerTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
      this.flashTimer = 0.6;
      this.flashColor = 'rgba(200,0,255,0.3)';
      this.callbacks.onBonusRound?.();
    }
  }

  private beginWave() {
    const waves = this.bonusRound ? BONUS_WAVES : LEVEL_WAVES[this.level - 1];
    const wave = waves[this.waveIndex];
    // Flatten into queue and shuffle
    const flat: EnemyType[] = wave.flatMap(e => Array(e.count).fill(e.type)) as EnemyType[];
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    this.waveQueue = flat;
    this.waveSpawnTimer = 0.3;
    this.waveState = 'active';
  }

  private showBanner(text: string, subtext: string) {
    this.bannerText = text;
    this.bannerSubtext = subtext;
    this.bannerTimer = DIFFICULTY.WAVE_CLEAR_DELAY;
  }

  // ─── Environment ─────────────────────────────────────────────────────────────

  private initEnvParticles() {
    const count = this.envId === 'space' ? 0 : this.envId === 'forest' ? 30 : this.envId === 'city' ? 50 : this.envId === 'ocean' ? 35 : this.envId === 'chaos' ? 80 : 60;
    const w = this.canvas.width || 800;
    const h = this.canvas.height || 600;

    this.envParticles = Array.from({ length: count }, () => this.spawnEnvParticle(w, h, true));

    // Procedural geometry (deterministic using level as seed)
    const rng = (seed: number) => {
      const x = Math.sin(seed) * 43758.5453;
      return x - Math.floor(x);
    };
    const nodes: number[] = [];
    for (let i = 0; i < 40; i++) nodes.push(rng(this.level * 31.7 + i * 13.3));
    this.envGeometry = { nodes };
  }

  private spawnEnvParticle(w: number, h: number, anywhere = false): EnvParticle {
    const x = Math.random() * w;
    const y = anywhere ? Math.random() * h : -10;
    switch (this.envId) {
      case 'forest': {
        const green = Math.floor(100 + Math.random() * 80);
        return { x, y, vx: -20 + Math.random() * 40, vy: 40 + Math.random() * 60, size: 4 + Math.random() * 5, alpha: 0.4 + Math.random() * 0.5, life: Math.random(), color: `rgb(20,${green},20)` };
      }
      case 'city': {
        return { x, y, vx: -15 + Math.random() * 30, vy: 200 + Math.random() * 200, size: 1 + Math.random() * 1.5, alpha: 0.2 + Math.random() * 0.4, life: Math.random(), color: '#8899CC' };
      }
      case 'ocean': {
        const startY = anywhere ? Math.random() * h : h + 10;
        return { x, y: startY, vx: -10 + Math.random() * 20, vy: -(20 + Math.random() * 50), size: 2 + Math.random() * 4, alpha: 0.2 + Math.random() * 0.4, life: Math.random(), color: '#44AADD' };
      }
      case 'inferno': {
        const startY = anywhere ? Math.random() * h : h + 10;
        return { x, y: startY, vx: -30 + Math.random() * 60, vy: -(60 + Math.random() * 120), size: 2 + Math.random() * 4, alpha: 0.5 + Math.random() * 0.5, life: Math.random(), color: Math.random() < 0.5 ? '#FF6600' : '#FF3300' };
      }
      case 'chaos': {
        const angle = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 100;
        const hue = Math.floor(Math.random() * 360);
        const cx = anywhere ? Math.random() * w : w / 2 + (Math.random() - 0.5) * 200;
        const cy = anywhere ? Math.random() * h : h / 2 + (Math.random() - 0.5) * 200;
        return { x: cx, y: cy, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          size: 2 + Math.random() * 4, alpha: 0.7 + Math.random() * 0.3,
          life: Math.random(), color: `hsl(${hue},100%,65%)` };
      }
      default: return { x, y, vx: 0, vy: 0, size: 0, alpha: 0, life: 1, color: '#fff' };
    }
  }

  private updateEnvParticles(dt: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    for (const p of this.envParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * (this.envId === 'city' ? 1.5 : 0.4);

      const offscreen = this.envId === 'chaos'
        ? p.y < -20 || p.y > h + 20  // chaos: any vertical edge (x handled below)
        : this.envId === 'ocean' || this.envId === 'inferno'
          ? p.y < -20
          : p.y > h + 20;

      if (p.life <= 0 || offscreen || p.x < -30 || p.x > w + 30) {
        Object.assign(p, this.spawnEnvParticle(w, h, false));
        p.life = 1;
      }
    }
  }

  private drawEnvironment(ctx: CanvasRenderingContext2D, now: number) {
    const { canvas } = this;
    const env = ENVIRONMENTS[this.envId];
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, env.bgTop);
    grad.addColorStop(1, env.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    if (this.envId === 'space') {
      // Stars
      this.drawStars();
      return;
    }

    const nodes = this.envGeometry.nodes;

    if (this.envId === 'forest') {
      // Ground
      ctx.fillStyle = '#071A09';
      ctx.fillRect(0, h - 50, w, 50);
      // Trees
      ctx.fillStyle = '#051208';
      for (let i = 0; i < 12; i++) {
        const tx = nodes[i] * w;
        const th = 80 + nodes[i + 12] * 140;
        const tw = 30 + nodes[i + 24] * 40;
        // Trunk
        ctx.fillRect(tx - tw * 0.12, h - 50 - th * 0.3, tw * 0.24, th * 0.3);
        // Canopy - triangle
        ctx.beginPath();
        ctx.moveTo(tx, h - 50 - th);
        ctx.lineTo(tx - tw / 2, h - 50 - th * 0.25);
        ctx.lineTo(tx + tw / 2, h - 50 - th * 0.25);
        ctx.closePath();
        ctx.fill();
        // Second tier
        ctx.beginPath();
        ctx.moveTo(tx, h - 50 - th * 0.7);
        ctx.lineTo(tx - tw * 0.65, h - 50 - th * 0.15);
        ctx.lineTo(tx + tw * 0.65, h - 50 - th * 0.15);
        ctx.closePath();
        ctx.fill();
      }
      // Glowing moss on ground
      ctx.fillStyle = 'rgba(20, 120, 30, 0.15)';
      ctx.fillRect(0, h - 52, w, 4);

      // Env particles (leaves)
      for (const p of this.envParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha * Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(now * 0.001 * (p.vx > 0 ? 1 : -1));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

    } else if (this.envId === 'city') {
      // City skyline
      for (let i = 0; i < 14; i++) {
        const bx = (i / 14) * w - 10 + nodes[i] * 20;
        const bw = 40 + nodes[i + 14] * 50;
        const bh = 80 + nodes[i + 28 % 40] * 220;
        // Building body
        const r = Math.floor(nodes[i] * 20);
        const g = Math.floor(nodes[(i + 5) % 40] * 20);
        const b = Math.floor(50 + nodes[(i + 10) % 40] * 60);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(bx, h - bh, bw, bh);
        // Windows
        ctx.fillStyle = Math.random() < 0.02 ? '#FFFF88' : (Math.random() < 0.3 ? '#88AAFF' : 'rgba(100,150,255,0.6)');
        for (let wy = h - bh + 10; wy < h - 10; wy += 18) {
          for (let wx = bx + 6; wx < bx + bw - 6; wx += 14) {
            if (nodes[(Math.floor(wx / 14 + wy / 18)) % 40] > 0.35) {
              const brightness = 0.4 + nodes[(Math.floor(wx + wy)) % 40] * 0.6;
              const cr = Math.floor(100 * brightness), cg = Math.floor(150 * brightness), cb = Math.floor(255 * brightness);
              ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`;
              ctx.fillRect(wx, wy, 8, 10);
            }
          }
        }
      }
      // Ground / road
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(0, h - 30, w, 30);
      // Neon road lines
      ctx.strokeStyle = 'rgba(80, 80, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 15]);
      ctx.beginPath(); ctx.moveTo(0, h - 15); ctx.lineTo(w, h - 15); ctx.stroke();
      ctx.setLineDash([]);

      // Rain particles
      for (const p of this.envParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha * Math.max(0, p.life);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04);
        ctx.stroke();
        ctx.restore();
      }

    } else if (this.envId === 'ocean') {
      // Deep ocean floor hints
      ctx.fillStyle = '#020D1E';
      ctx.fillRect(0, h - 45, w, 45);

      // Coral/rocks silhouettes
      ctx.fillStyle = '#071828';
      for (let i = 0; i < 10; i++) {
        const rx = nodes[i] * w;
        const rh = 20 + nodes[i + 10] * 50;
        const rw = 15 + nodes[i + 20] * 35;
        ctx.beginPath();
        ctx.ellipse(rx, h - 45, rw / 2, rh / 2, 0, Math.PI, 0);
        ctx.fill();
      }

      // Animated wave line
      ctx.strokeStyle = 'rgba(30, 100, 180, 0.25)';
      ctx.lineWidth = 3;
      for (let wave = 0; wave < 3; wave++) {
        const wy = h * 0.3 + wave * 90;
        ctx.beginPath();
        for (let x2 = 0; x2 <= w; x2 += 8) {
          const y2 = wy + Math.sin((x2 / w) * Math.PI * 6 + now * 0.0008 + wave * 1.2) * 12;
          x2 === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
        }
        ctx.stroke();
      }

      // Bioluminescent glow at bottom
      const glow = ctx.createLinearGradient(0, h - 60, 0, h);
      glow.addColorStop(0, 'rgba(0, 80, 160, 0)');
      glow.addColorStop(1, 'rgba(0, 120, 200, 0.18)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, h - 60, w, 60);

      // Bubble particles
      for (const p of this.envParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha * Math.max(0, p.life);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

    } else if (this.envId === 'inferno') {
      // Lava floor
      const lavaGrad = ctx.createLinearGradient(0, h - 80, 0, h);
      lavaGrad.addColorStop(0, 'rgba(200, 30, 0, 0)');
      lavaGrad.addColorStop(0.5, 'rgba(240, 80, 0, 0.55)');
      lavaGrad.addColorStop(1, 'rgba(255, 120, 0, 0.85)');
      ctx.fillStyle = lavaGrad;
      ctx.fillRect(0, h - 80, w, 80);

      // Lava surface waves
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x2 = 0; x2 <= w; x2 += 6) {
        const y2 = h - 80 + Math.sin((x2 / w) * Math.PI * 8 + now * 0.002) * 10;
        x2 === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Rocky ground silhouettes
      ctx.fillStyle = '#1A0100';
      for (let i = 0; i < 10; i++) {
        const rx = nodes[i] * w;
        const rh = 25 + nodes[i + 10] * 55;
        const rw = 20 + nodes[i + 20] * 40;
        ctx.beginPath();
        ctx.moveTo(rx - rw / 2, h);
        ctx.lineTo(rx, h - rh);
        ctx.lineTo(rx + rw / 2, h);
        ctx.closePath();
        ctx.fill();
      }

      // Ember particles
      for (const p of this.envParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha * Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

    } else if (this.envId === 'chaos') {
      // ── CHAOS DIMENSION ──────────────────────────────────────────────────

      // Shifting rainbow gradient background
      const hue = (now * 0.04) % 360;
      const grad2 = ctx.createLinearGradient(0, 0, w, h);
      grad2.addColorStop(0, `hsl(${hue},80%,5%)`);
      grad2.addColorStop(0.5, `hsl(${(hue+130)%360},80%,4%)`);
      grad2.addColorStop(1, `hsl(${(hue+260)%360},80%,5%)`);
      ctx.fillStyle = grad2;
      ctx.fillRect(-20, -20, w + 40, h + 40);

      // Animated neon grid
      const gridSize = 58;
      const gridAlpha = 0.10 + Math.sin(now * 0.003) * 0.05;
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w + gridSize; gx += gridSize) {
        const lh = (hue + gx * 0.5) % 360;
        ctx.strokeStyle = `hsla(${lh},100%,60%,${gridAlpha})`;
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = 0; gy < h + gridSize; gy += gridSize) {
        const lh = (hue + gy * 0.5 + 180) % 360;
        ctx.strokeStyle = `hsla(${lh},100%,60%,${gridAlpha})`;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // Pulsing concentric rings expanding from center
      const cx2 = w / 2, cy2 = h / 2;
      for (let ring = 0; ring < 6; ring++) {
        const r = ((now * 0.07 + ring * 70) % 420);
        const ra = Math.max(0, 0.35 - r / 420 * 0.35);
        const rh = (hue + ring * 55) % 360;
        ctx.strokeStyle = `hsla(${rh},100%,70%,${ra})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.stroke();
      }

      // Diagonal rainbow streaks across screen
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 5; s++) {
        const offset = ((now * 60 + s * 200) % (w + h));
        const sh = (hue + s * 72) % 360;
        ctx.strokeStyle = `hsla(${sh},100%,65%,0.12)`;
        ctx.beginPath();
        ctx.moveTo(offset - h, 0);
        ctx.lineTo(offset, h);
        ctx.stroke();
      }

      // Floor checkerboard pattern (bottom third)
      const tileSize = 40;
      const floorY = h * 0.72;
      for (let tx = 0; tx < w; tx += tileSize) {
        for (let ty = floorY; ty < h; ty += tileSize) {
          const idx = Math.floor(tx / tileSize) + Math.floor(ty / tileSize) + Math.floor(now / 400);
          if (idx % 2 === 0) {
            const th = (hue + tx * 0.3 + ty * 0.2) % 360;
            ctx.fillStyle = `hsla(${th},80%,18%,0.5)`;
            ctx.fillRect(tx, ty, tileSize, tileSize);
          }
        }
      }

      // Rainbow sparkle particles
      for (const p of this.envParticles) {
        ctx.save();
        const life = Math.max(0, p.life);
        ctx.globalAlpha = p.alpha * life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * life, 0, Math.PI * 2); ctx.fill();
        // Star cross
        ctx.lineWidth = 1;
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x - p.size * 2 * life, p.y);
        ctx.lineTo(p.x + p.size * 2 * life, p.y);
        ctx.moveTo(p.x, p.y - p.size * 2 * life);
        ctx.lineTo(p.x, p.y + p.size * 2 * life);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private render(now: number) {
    const { ctx, canvas } = this;
    ctx.save();

    // Screen shake
    if (this.shakeTimer > 0) {
      const mag = (this.shakeTimer / 0.4) * this.shakeIntensity;
      ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
    }

    // Background + environment
    this.drawEnvironment(ctx, now);

    if (this.phase === 'playing' || this.phase === 'paused') {
      // Draw entities in z-order
      this.powerUps.forEach(p => p.draw(ctx));
      this.enemies.forEach(e => e.draw(ctx, now));
      this.projectiles.forEach(p => p.draw(ctx));
      this.particles.draw(ctx);
      // God mode: pulsing golden aura behind Owlbert
      if (this.godMode) {
        const { x, y, width: PW, height: PH } = this.player;
        const pulse = 0.7 + Math.sin(now * 0.005) * 0.3;
        const aura = ctx.createRadialGradient(x, y, PW * 0.2, x, y, PW * 0.85);
        aura.addColorStop(0, `rgba(255, 220, 50, ${0.45 * pulse})`);
        aura.addColorStop(0.6, `rgba(255, 150, 0, ${0.25 * pulse})`);
        aura.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(x, y, PW * 0.85, PH * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.bonusRound) {
        this.player.drawWalking(ctx, now);
      } else {
        this.player.draw(ctx, now);
      }

      // Score popups
      for (const sp of this.scorePopups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.life);
        ctx.fillStyle = sp.color;
        ctx.font = `bold ${Math.floor(13 + (1 - sp.life) * 5)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sp.text, sp.x, sp.y);
        ctx.restore();
      }

      // Pause dim overlay
      if (this.phase === 'paused') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
      }
    }

    ctx.restore();

    // Wave/level banner
    if (this.bannerTimer > 0 && this.phase === 'playing') {
      const delayRef = (this.envId === 'inferno' || this.envId === 'chaos') ? DIFFICULTY.LEVEL_CLEAR_DELAY : DIFFICULTY.WAVE_CLEAR_DELAY;
      const alpha = Math.min(1, this.bannerTimer * 3) * Math.min(1, (this.bannerTimer / delayRef) * 4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 - 20;
      if (this.envId === 'chaos') {
        // Rainbow cycling banner for bonus round
        const bHue = (now * 0.12) % 360;
        ctx.font = 'bold 54px monospace';
        ctx.shadowColor = `hsl(${bHue},100%,70%)`;
        ctx.shadowBlur = 32;
        ctx.fillStyle = `hsl(${bHue},100%,72%)`;
        ctx.fillText(this.bannerText, cx, cy);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = `hsl(${(bHue+120)%360},100%,75%)`;
        ctx.fillText(this.bannerSubtext, cx, cy + 50);
      } else {
        ctx.font = 'bold 52px monospace';
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#00FFFF';
        ctx.fillText(this.bannerText, cx, cy);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#AADDFF';
        ctx.fillText(this.bannerSubtext, cx, cy + 44);
      }
      ctx.restore();
    }

    // Flash effect (drawn AFTER restore so it doesn't shake)
    if (this.flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashTimer;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // ─── Stars ──────────────────────────────────────────────────────────────────

  private initStars() {
    const w = this.canvas.width || 800;
    const h = this.canvas.height || 600;
    this.stars = Array.from({ length: BG.STAR_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 0.5 + Math.random() * 1.8,
      speed: BG.STAR_SPEED_MIN + Math.random() * (BG.STAR_SPEED_MAX - BG.STAR_SPEED_MIN),
      alpha: 0.18 + Math.random() * 0.82,
    }));
  }

  private updateStars(dt: number) {
    const h = this.canvas.height;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > h + 2) {
        s.y = -2;
        s.x = Math.random() * this.canvas.width;
      }
    }
  }

  private drawStars() {
    const { ctx } = this;
    for (const s of this.stars) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  startGame(now: number, godMode = false, startLevel = 1) {
    this.godMode = godMode;
    this.bonusRound = false;
    this.activeGuns = { ...DEFAULT_GUNS };
    this.score = 0;
    this.level = startLevel;
    this.combo = 0;
    this.multiplier = 1;
    this.powerUpTimer = 20;
    this.enemies = [];
    this.projectiles = [];
    this.powerUps = [];
    this.scorePopups = [];

    // Wave init
    this.waveIndex = 0;
    this.waveQueue = [];
    this.waveState = 'transitioning';
    this.waveTransitionTimer = 1.2;
    this.bannerText = 'WAVE 1';
    this.bannerSubtext = `of ${LEVEL_WAVES[startLevel - 1].length}`;
    this.bannerTimer = 1.2;

    // Environment
    this.envId = getEnvironment(startLevel);
    this.initEnvParticles();

    this.player = new Player(this.canvas.width, this.canvas.height);
    this.phase = 'playing';
    this.callbacks.onPhaseChange('playing');
    this.callbacks.onScoreChange(0);
    this.callbacks.onLivesChange(PLAYER.LIVES);
    this.callbacks.onLevelChange(startLevel);
    this.callbacks.onMultiplierChange(1);
    this.callbacks.onPowerUpChange(null, 0);
  }

  pauseGame() {
    this.phase = 'paused';
    this.callbacks.onPhaseChange('paused');
  }

  resumeGame(now: number) {
    this.lastTime = now;
    this.phase = 'playing';
    this.callbacks.onPhaseChange('playing');
  }

  private endGame() {
    this.phase = 'gameover';
    this.callbacks.onPhaseChange('gameover');
  }

  setActiveGuns(guns: ActiveGuns) {
    this.activeGuns = { ...guns };
  }

  resize(width: number, height: number) {
    if (this.player) {
      this.player.x = Math.min(this.player.x, width - this.player.width / 2);
      this.player.y = height - PLAYER.START_Y_OFFSET;
    }
    this.initStars();
    this.initEnvParticles();
  }

  exitToMenu() {
    this.phase = 'idle';
    this.callbacks.onPhaseChange('idle');
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.input.destroy();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
