import { EnemyType } from '../types';
import { ENEMY } from '../constants';

// ─── Preload SVG sprites ──────────────────────────────────────────────────────

function preloadImg(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  const img = new Image();
  img.src = src;
  return img;
}

const SPRITES = {
  meteor404:      preloadImg('/enemies/404-ufo.svg'),
  bugSwarm:       preloadImg('/enemies/evil-bug-invader.svg'),
  warningTriangle:preloadImg('/enemies/angry-docs-page.svg'),
  undefinedBlob:  preloadImg('/enemies/broken-api-bot.svg'),
  buildBot:       preloadImg('/enemies/terminal-skull-ship.svg'),
  glitchCube:     null as HTMLImageElement | null,
  boss:           preloadImg('/boss.png'),
};

// ─── Base ─────────────────────────────────────────────────────────────────────

export abstract class Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  health: number;
  maxHealth: number;
  points: number;
  type: EnemyType;
  active = true;
  hitFlash = 0;

  constructor(x: number, y: number, type: EnemyType, speedMult: number, healthMult = 1) {
    const cfg = ENEMY[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = cfg.width;
    this.height = cfg.height;
    this.speed = cfg.baseSpeed * speedMult;
    const hp = Math.max(1, Math.round(cfg.health * healthMult));
    this.health = hp;
    this.maxHealth = hp;
    this.points = cfg.points;
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    this.hitFlash = 0.12;
    if (this.health <= 0) { this.active = false; return true; }
    return false;
  }

  isOffscreen(canvasHeight: number): boolean {
    return this.y - this.height / 2 > canvasHeight + 10;
  }

  abstract update(dt: number, px: number, py: number, cw: number, now: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, now: number): void;

  protected drawSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    fallbackDraw: () => void,
    rotation = 0
  ) {
    const { x, y, width: W, height: H } = this;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x, y);
      if (rotation !== 0) ctx.rotate(rotation);
      if (this.hitFlash > 0) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(img, -W / 2, -H / 2, W, H);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-W / 2, -H / 2, W, H);
      } else {
        ctx.drawImage(img, -W / 2, -H / 2, W, H);
      }
      ctx.restore();
    } else {
      fallbackDraw();
    }
  }

  protected drawHealthBar(ctx: CanvasRenderingContext2D) {
    if (this.health >= this.maxHealth) return;
    const bw = this.width * 0.88;
    const bx = this.x - bw / 2;
    const by = this.y - this.height / 2 - 9;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), 4);
  }
}

// ─── 1. Meteor 404 → 404 UFO ─────────────────────────────────────────────────

export class Meteor404 extends Enemy {
  private rotation = 0;
  private rotSpeed = (Math.random() - 0.5) * 2.2;

  constructor(x: number, speedMult: number, healthMult = 1) { super(x, -30, 'meteor404', speedMult, healthMult); }

  update(dt: number) {
    this.y += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawSprite(ctx, SPRITES.meteor404, () => {
      const { x, y, width } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#A29BFE';
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, width * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6C63FF';
      ctx.beginPath();
      ctx.ellipse(0, -4, width * 0.28, width * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }, this.rotation * 0.3);
    this.drawHealthBar(ctx);
  }
}

// ─── 2. Bug Swarm → Evil Bug Invader ─────────────────────────────────────────

export class BugSwarm extends Enemy {
  private swarmTime = Math.random() * Math.PI * 2;
  private amplitude = 55 + Math.random() * 45;
  private bobTime = Math.random() * Math.PI * 2;

  constructor(x: number, speedMult: number, healthMult = 1) { super(x, -30, 'bugSwarm', speedMult, healthMult); }

  update(dt: number, _px: number, _py: number, cw: number) {
    this.swarmTime += dt * 2.2;
    this.bobTime += dt * 3;
    this.y += this.speed * dt;
    this.x += Math.cos(this.swarmTime) * this.amplitude * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const bob = Math.sin(this.bobTime) * 3;
    const { x, y } = this;
    this.drawSprite(ctx, SPRITES.bugSwarm, () => {
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.fillStyle = this.hitFlash > 0 ? '#FFF' : '#9B59B6';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    this.drawHealthBar(ctx);
  }
}

// ─── 3. Warning Triangle → Angry Docs Page ───────────────────────────────────

export class WarningTriangle extends Enemy {
  private vx: number;
  private wobbleTime = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -30, 'warningTriangle', speedMult, healthMult);
    this.vx = (Math.random() > 0.5 ? 1 : -1) * this.speed * 0.6;
  }

  update(dt: number, _px: number, _py: number, cw: number) {
    this.y += this.speed * dt;
    this.x += this.vx * dt;
    this.wobbleTime += dt;
    if (this.x < this.width / 2 || this.x > cw - this.width / 2) this.vx *= -1;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const wobble = Math.sin(this.wobbleTime * 4) * 0.08;
    this.drawSprite(ctx, SPRITES.warningTriangle, () => {
      const { x, y, width, height } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = this.hitFlash > 0 ? '#FFF' : '#EAF2FF';
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    }, wobble);
    this.drawHealthBar(ctx);
  }
}

// ─── 4. Undefined Blob → Broken API Bot ──────────────────────────────────────

export class UndefinedBlob extends Enemy {
  private animTime = Math.random() * Math.PI * 2;
  private driftVx = 0;
  private driftTimer = 0;
  private floatTime = Math.random() * Math.PI * 2;

  constructor(x: number, speedMult: number, healthMult = 1) { super(x, -30, 'undefinedBlob', speedMult, healthMult); }

  update(dt: number, px: number, _py: number, cw: number) {
    this.animTime += dt;
    this.floatTime += dt * 1.8;
    this.y += this.speed * dt;
    this.x += (px - this.x) * 0.07 * dt;
    this.driftTimer -= dt;
    if (this.driftTimer <= 0) {
      this.driftVx = (Math.random() - 0.5) * 85;
      this.driftTimer = 0.4 + Math.random() * 0.6;
    }
    this.x += this.driftVx * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const floatOff = Math.sin(this.floatTime) * 4;
    const { x, y } = this;
    ctx.save();
    ctx.translate(0, floatOff);
    this.drawSprite(ctx, SPRITES.undefinedBlob, () => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = this.hitFlash > 0 ? '#FFF' : '#1F2937';
      ctx.fillRect(-22, -18, 44, 36);
      ctx.restore();
    });
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 5. Build Bot → Terminal Skull Ship ──────────────────────────────────────

export class BuildBot extends Enemy {
  private eyeTime = 0;
  private thrustTime = 0;

  constructor(x: number, speedMult: number, healthMult = 1) { super(x, -30, 'buildBot', speedMult, healthMult); }

  update(dt: number, px: number) {
    this.y += this.speed * dt;
    this.x += (px - this.x) * 0.55 * dt;
    this.eyeTime += dt;
    this.thrustTime += dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const tilt = Math.sin(this.thrustTime * 2.5) * 0.07;
    this.drawSprite(ctx, SPRITES.buildBot, () => {
      const { x, y, width, height } = this;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = this.hitFlash > 0 ? '#FFF' : '#0F172A';
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    }, tilt);
    this.drawHealthBar(ctx);
  }
}

// ─── 6. Glitch Cube — keep canvas-drawn (no SVG) ─────────────────────────────

export class GlitchCube extends Enemy {
  private teleportTimer = 1.4 + Math.random();
  private glitchIntensity = 0;

  constructor(x: number, speedMult: number, healthMult = 1) { super(x, -30, 'glitchCube', speedMult, healthMult); }

  update(dt: number, _px: number, _py: number, cw: number) {
    this.y += this.speed * dt;
    this.teleportTimer -= dt;
    if (this.teleportTimer <= 0) {
      this.x = this.width / 2 + Math.random() * (cw - this.width);
      this.teleportTimer = 1.1 + Math.random() * 1.6;
      this.glitchIntensity = 0.35;
    }
    if (this.glitchIntensity > 0) this.glitchIntensity -= dt * 2.2;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height } = this;
    const hw = width / 2, hh = height / 2;
    ctx.save();
    ctx.translate(x, y);

    const gi = this.glitchIntensity + (Math.random() < 0.04 ? 0.14 : 0);
    if (gi > 0.06) {
      const off = gi * 8;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#FF0033';
      ctx.fillRect(-hw - off, -hh, width, height);
      ctx.fillStyle = '#0033FF';
      ctx.fillRect(-hw + off, -hh, width, height);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#00CCFF';
    ctx.fillRect(-hw, -hh, width, height);

    if (this.hitFlash <= 0) {
      ctx.strokeStyle = '#003344';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const f = i / 4;
        ctx.beginPath();
        ctx.moveTo(-hw + width * f, -hh); ctx.lineTo(-hw + width * f, hh);
        ctx.moveTo(-hw, -hh + height * f); ctx.lineTo(hw, -hh + height * f);
        ctx.stroke();
      }
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw, -hh, width, height);
      ctx.fillStyle = '#003344';
      ctx.font = `bold ${Math.floor(hw * 0.48)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GLITCH', 0, 0);
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 7. Formation Bug → Space-Invader-style grid marcher ─────────────────────

export class FormationBug extends Enemy {
  /** x the bug oscillates around — set by spawnFormation() */
  centerX: number;

  constructor(x: number, y: number, centerX: number, speedMult: number, healthMult = 1) {
    super(x, y, 'formationBug', speedMult, healthMult);
    this.centerX = centerX;
    this.x = x;
    this.y = y;
  }

  update(dt: number, _px: number, _py: number, cw: number, now: number) {
    // All formation bugs share the same oscillation math so they march in sync
    const amp = Math.min(130, (cw - 80) / 2 - 40);
    this.x = this.centerX + Math.sin(now * 0.00072) * amp;
    this.y += this.speed * dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width: w, height: h } = this;
    ctx.save();
    ctx.translate(x, y);

    const c = this.hitFlash > 0 ? '#FFFFFF' : '#FF6B35';
    const dark = '#7A2800';

    // Body
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.38, -h * 0.28, w * 0.76, h * 0.56);

    // Head
    ctx.fillRect(-w * 0.22, -h * 0.5, w * 0.44, h * 0.24);

    // Antennae
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.18, -h * 0.62, w * 0.06, h * 0.14);
    ctx.fillRect( w * 0.12, -h * 0.62, w * 0.06, h * 0.14);

    // Legs (3 pairs, pixel style)
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.55, -h * 0.18, w * 0.18, h * 0.08);
    ctx.fillRect(-w * 0.55,  h * 0.04, w * 0.18, h * 0.08);
    ctx.fillRect( w * 0.37, -h * 0.18, w * 0.18, h * 0.08);
    ctx.fillRect( w * 0.37,  h * 0.04, w * 0.18, h * 0.08);
    ctx.fillRect(-w * 0.48,  h * 0.22, w * 0.14, h * 0.08);
    ctx.fillRect( w * 0.34,  h * 0.22, w * 0.14, h * 0.08);

    // Eyes
    ctx.fillStyle = dark;
    ctx.fillRect(-w * 0.14, -h * 0.44, w * 0.1, h * 0.1);
    ctx.fillRect( w * 0.04, -h * 0.44, w * 0.1, h * 0.1);

    // Pixel underbelly stripes
    if (this.hitFlash <= 0) {
      ctx.fillStyle = dark;
      ctx.fillRect(-w * 0.32, -h * 0.06, w * 0.64, h * 0.06);
      ctx.fillRect(-w * 0.26,  h * 0.1,  w * 0.52, h * 0.06);
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 8. Shooter Bug → fires aimed projectiles ────────────────────────────────

export interface EnemyBullet {
  x: number; y: number; vx: number; vy: number;
  active: boolean;
}

export class ShooterBug extends Enemy {
  private shootTimer: number;
  pendingShots: EnemyBullet[] = [];

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -30, 'shooterBug', speedMult, healthMult);
    // Stagger initial shot so not all fire at once
    this.shootTimer = 2.0 + Math.random() * 2.5;
  }

  update(dt: number, px: number, py: number, cw: number) {
    this.y += this.speed * dt;
    // Gentle drift toward player x
    this.x += (px - this.x) * 0.04 * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 2.8 + Math.random() * 2.0;
      const angle = Math.atan2(py - this.y, px - this.x);
      const speed = 175;
      this.pendingShots.push({
        x: this.x,
        y: this.y + this.height * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        active: true,
      });
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width: w, height: h } = this;
    ctx.save();
    ctx.translate(x, y);

    const c = this.hitFlash > 0 ? '#FFFFFF' : '#CC44FF';
    const dark = '#550080';

    // Rounded body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.42, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head / "visor"
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.24, w * 0.26, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eyes
    ctx.fillStyle = this.hitFlash > 0 ? '#FF0000' : '#FFCC00';
    ctx.fillRect(-w * 0.12, -h * 0.30, w * 0.08, h * 0.08);
    ctx.fillRect( w * 0.04, -h * 0.30, w * 0.08, h * 0.08);

    // Gun barrel pointing down
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.06, h * 0.28, w * 0.12, h * 0.2);
    ctx.fillStyle = '#FFCC00';
    ctx.fillRect(-w * 0.04, h * 0.42, w * 0.08, h * 0.06);

    // Wing stubs
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.52, -h * 0.08, w * 0.12, h * 0.22);
    ctx.fillRect( w * 0.40, -h * 0.08, w * 0.12, h * 0.22);

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 9. Turret Bug — slow descent, rotating barrel fires aimed bursts ────────

export class TurretBug extends Enemy {
  private barrelAngle = -Math.PI / 2;
  private shootTimer: number;
  private burstCount = 0;
  private burstTimer = 0;
  pendingShots: EnemyBullet[] = [];

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -30, 'turretBug', speedMult, healthMult);
    this.shootTimer = 2.0 + Math.random() * 2.0;
  }

  update(dt: number, px: number, py: number, cw: number) {
    this.y += this.speed * dt;

    // Barrel smoothly tracks toward player
    const target = Math.atan2(py - this.y, px - this.x);
    let da = target - this.barrelAngle;
    while (da >  Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.barrelAngle += da * Math.min(1, dt * 3);

    // Burst fire logic
    if (this.burstCount > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstCount--;
        this.burstTimer = 0.14;
        const speed = 195;
        const tipX = this.x + Math.cos(this.barrelAngle) * 24;
        const tipY = this.y + Math.sin(this.barrelAngle) * 24;
        this.pendingShots.push({
          x: tipX, y: tipY,
          vx: Math.cos(this.barrelAngle) * speed,
          vy: Math.sin(this.barrelAngle) * speed,
          active: true,
        });
      }
    } else {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 2.8 + Math.random() * 1.6;
        this.burstCount = 3;
        this.burstTimer = 0;
      }
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width: w, height: h } = this;
    ctx.save();
    ctx.translate(x, y);

    const c    = this.hitFlash > 0 ? '#FFFFFF' : '#AA4400';
    const dark = '#441800';

    // Tank treads
    ctx.fillStyle = dark;
    ctx.fillRect(-w * 0.5, h * 0.2, w, h * 0.32);
    if (this.hitFlash <= 0) {
      ctx.fillStyle = '#662200';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-w * 0.46 + i * w * 0.2, h * 0.22, w * 0.12, h * 0.08);
      }
    }

    // Body box
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.4, -h * 0.2, w * 0.8, h * 0.42);

    // Turret dome
    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#CC5500';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.06, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotating barrel — line pointing in barrelAngle direction
    ctx.strokeStyle = this.hitFlash > 0 ? '#FFFFFF' : dark;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(this.barrelAngle) * 24, Math.sin(this.barrelAngle) * 24);
    ctx.stroke();
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(this.barrelAngle) * 13, Math.sin(this.barrelAngle) * 13);
    ctx.lineTo(Math.cos(this.barrelAngle) * 24, Math.sin(this.barrelAngle) * 24);
    ctx.stroke();

    // Sensor eye
    ctx.fillStyle = this.hitFlash > 0 ? '#FF0000' : '#FFAA00';
    ctx.beginPath();
    ctx.arc(0, -h * 0.06, w * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 10. Shield Bot — regenerating hex shield must be broken before body ──────

export class ShieldBot extends Enemy {
  private shieldHp = 4;
  shieldActive = true;
  private shieldRegenTimer = 0;
  private shieldFlash = 0;
  private animTime = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -30, 'shieldBot', speedMult, healthMult);
  }

  takeDamage(amount: number): boolean {
    if (this.shieldActive) {
      this.shieldFlash = 0.18;
      this.shieldHp -= amount;
      if (this.shieldHp <= 0) {
        this.shieldActive = false;
        this.shieldRegenTimer = 4.5;
      }
      return false; // shield absorbed the hit, body untouched
    }
    return super.takeDamage(amount);
  }

  update(dt: number, px: number, _py: number, cw: number) {
    this.y += this.speed * dt;
    this.x += (px - this.x) * 0.05 * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
    this.animTime += dt;
    if (this.shieldFlash > 0) this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    if (!this.shieldActive) {
      this.shieldRegenTimer -= dt;
      if (this.shieldRegenTimer <= 0) {
        this.shieldActive = true;
        this.shieldHp = 4;
      }
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width: w, height: h } = this;
    ctx.save();
    ctx.translate(x, y);

    const c    = this.hitFlash > 0 ? '#FFFFFF' : '#4466CC';
    const dark = '#112244';

    // Bot body
    ctx.fillStyle = dark;
    ctx.fillRect(-w * 0.35, -h * 0.45, w * 0.7, h * 0.9);
    ctx.fillStyle = c;
    ctx.fillRect(-w * 0.38, -h * 0.3, w * 0.76, h * 0.6);

    // Chest panel
    if (this.hitFlash <= 0) {
      ctx.fillStyle = this.shieldActive ? '#2255AA' : '#221133';
      ctx.fillRect(-w * 0.24, -h * 0.2, w * 0.48, h * 0.36);
      // Shield HP indicator pips
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < this.shieldHp ? '#66AAFF' : '#112244';
        ctx.fillRect(-w * 0.20 + i * w * 0.11, h * 0.02, w * 0.08, h * 0.1);
      }
    }

    // Visor eyes
    ctx.fillStyle = this.hitFlash > 0 ? '#FF0000' : (this.shieldActive ? '#88CCFF' : '#FF4400');
    ctx.fillRect(-w * 0.22, -h * 0.36, w * 0.16, h * 0.1);
    ctx.fillRect( w * 0.06, -h * 0.36, w * 0.16, h * 0.1);

    // Shoulder plates
    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#3355AA';
    ctx.fillRect(-w * 0.5, -h * 0.28, w * 0.14, h * 0.28);
    ctx.fillRect( w * 0.36, -h * 0.28, w * 0.14, h * 0.28);

    // Hex shield ring
    if (this.shieldActive || this.shieldFlash > 0) {
      const pulse = 0.65 + Math.sin(this.animTime * 4) * 0.35;
      const alpha = this.shieldFlash > 0 ? 1.0 : pulse * 0.85;
      ctx.strokeStyle = this.shieldFlash > 0
        ? `rgba(255, 255, 255, ${alpha})`
        : `rgba(80, 160, 255, ${alpha})`;
      ctx.lineWidth = this.shieldFlash > 0 ? 4 : 2.5;
      ctx.shadowColor = '#4488FF';
      ctx.shadowBlur  = this.shieldFlash > 0 ? 24 : 12 * pulse;
      const sr = w * 0.65;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const vx = Math.cos(a) * sr, vy = Math.sin(a) * sr;
        i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── 11. Kamikaze Bug — locks on and dives at the player at high speed ────────

export class KamikazeBug extends Enemy {
  private diving = false;
  private diveAngle = -Math.PI / 2;
  private diveCooldown = 1.2 + Math.random() * 1.5; // min time before can dive
  private wobbleTime = Math.random() * Math.PI * 2;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -30, 'kamikazeBug', speedMult, healthMult);
  }

  update(dt: number, px: number, py: number, cw: number) {
    this.wobbleTime += dt;
    if (this.diveCooldown > 0) this.diveCooldown -= dt;

    if (!this.diving) {
      this.y += this.speed * dt;
      // Gentle drift toward player x
      this.x += (px - this.x) * 0.25 * dt;
      this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
      // Trigger dive when within vertical range and cooldown elapsed
      if (this.diveCooldown <= 0 && this.y > py - 260) {
        this.diving = true;
        this.diveAngle = Math.atan2(py - this.y, px - this.x);
      }
    } else {
      const diveSpeed = this.speed * 4.5;
      this.x += Math.cos(this.diveAngle) * diveSpeed * dt;
      this.y += Math.sin(this.diveAngle) * diveSpeed * dt;
      // Deactivate if way off horizontal bounds during dive
      if (this.x < -80 || this.x > cw + 80) this.active = false;
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width: w, height: h } = this;
    // Rotate so nose points in direction of travel
    // Nose is at (0, -h/2) in local space (pointing up = angle -PI/2)
    // rotation = travelAngle - (-PI/2) = travelAngle + PI/2
    const angle = this.diving
      ? this.diveAngle + Math.PI / 2
      : Math.PI + Math.sin(this.wobbleTime * 3) * 0.12; // nose points down when falling

    const c = this.hitFlash > 0 ? '#FFFFFF' : (this.diving ? '#FF1100' : '#FF6600');

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Flame trail when diving
    if (this.diving) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.random() * 0.3;
      ctx.fillStyle = '#FF8800';
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, h * 0.3);
      ctx.lineTo(0, h * 0.5 + h * (0.35 + Math.random() * 0.45));
      ctx.lineTo( w * 0.2, h * 0.3);
      ctx.fill();
      ctx.restore();
    }

    // Arrowhead body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0,          -h * 0.5);   // nose tip
    ctx.lineTo( w * 0.44,  h * 0.38);  // right wing tip
    ctx.lineTo( w * 0.14,  h * 0.18);  // right notch
    ctx.lineTo(0,           h * 0.48);  // tail center
    ctx.lineTo(-w * 0.14,  h * 0.18);  // left notch
    ctx.lineTo(-w * 0.44,  h * 0.38);  // left wing tip
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (this.hitFlash <= 0) {
      ctx.fillStyle = this.diving ? '#FFFF00' : '#FF0000';
      ctx.fillRect(-w * 0.14, -h * 0.1, w * 0.09, h * 0.1);
      ctx.fillRect( w * 0.05, -h * 0.1, w * 0.09, h * 0.1);
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─── Mini-Boss base ───────────────────────────────────────────────────────────

export interface MiniBossShot {
  x: number; y: number; vx: number; vy: number;
  active: boolean; width: number; height: number; color: string;
}

export abstract class MiniBossEnemy extends Enemy {
  shots: MiniBossShot[] = [];
  protected shootTimer = 2.0;
  isMini = true as const;

  protected fireAimed(px: number, py: number, speed: number, color: string, spread = 0) {
    const base = Math.atan2(py - this.y, px - this.x);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * spread;
      this.shots.push({ x: this.x, y: this.y + this.height * 0.3,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        active: true, width: 12, height: 12, color });
    }
  }

  protected fireCircle(count: number, speed: number, color: string) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.shots.push({ x: this.x, y: this.y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        active: true, width: 10, height: 10, color });
    }
  }

  updateShots(dt: number, canvasWidth: number, canvasHeight: number) {
    for (const s of this.shots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > canvasHeight + 20 || s.y < -20 || s.x < -20 || s.x > canvasWidth + 20) s.active = false;
    }
    this.shots = this.shots.filter(s => s.active);
  }

  drawShots(ctx: CanvasRenderingContext2D, now: number) {
    for (const s of this.shots) {
      if (!s.active) continue;
      ctx.save();
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  protected drawMiniBossHealthBar(ctx: CanvasRenderingContext2D, label: string, color: string) {
    const bw = Math.max(this.width * 1.1, 120);
    const bx = this.x - bw / 2;
    const by = this.y - this.height / 2 - 22;
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), 10);
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, this.x, by - 2);
  }
}

// ─── Mini-Boss 1: B.S.O.D. (Blue Screen of Death) ────────────────────────────

export class BsodBug extends MiniBossEnemy {
  private sweepVx: number;
  private crashTimer = 3.5;
  private crashed = false;
  private crashDuration = 0;
  private shakeX = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -50, 'bsodBug', speedMult, healthMult);
    this.sweepVx = 120 * (Math.random() > 0.5 ? 1 : -1);
  }

  update(dt: number, px: number, py: number, cw: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);

    const enraged = this.health < this.maxHealth * 0.5;

    // Crash state: freeze and flash
    if (this.crashed) {
      this.crashDuration -= dt;
      this.shakeX = (Math.random() - 0.5) * 5;
      if (this.crashDuration <= 0) {
        // Phase 2: fire radial burst on crash recovery
        if (enraged) this.fireCircle(8, 165, '#AACCFF');
        this.crashed = false;
      }
      return;
    }

    this.y += this.speed * 0.45 * dt;
    this.x += this.sweepVx * dt;
    if (this.x < this.width / 2 || this.x > cw - this.width / 2) {
      this.sweepVx *= -1;
      this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
    }
    // Cap vertical position
    this.y = Math.min(this.y, 220);

    // Crash periodically — more frequent in phase 2
    this.crashTimer -= dt;
    if (this.crashTimer <= 0) {
      this.crashed = true;
      this.crashDuration = 0.6;
      this.crashTimer = (enraged ? 1.8 : 3.0) + Math.random() * (enraged ? 0.8 : 2.0);
    }

    // Shoot — faster + harder in phase 2
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = (enraged ? 1.1 : 1.8) + Math.random() * 0.8;
      this.fireAimed(px, py, enraged ? 255 : 210, '#FFFFFF', enraged ? 0.30 : 0.22);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    const hw = W / 2, hh = H / 2;
    const sx = this.crashed ? this.shakeX : 0;

    ctx.save();
    ctx.translate(x + sx, y);

    // White flash on crash
    if (this.crashed && Math.floor(now / 80) % 2 === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-hw, -hh, W, H);
      ctx.restore();
      this.drawMiniBossHealthBar(ctx, '⚠ PIPELINE PHANTOM ⚠', '#0078D4');
      this.drawShots(ctx, now);
      return;
    }

    // Main blue body
    const hitCol = this.hitFlash > 0;
    ctx.fillStyle = hitCol ? '#88CCFF' : '#0078D4';
    ctx.fillRect(-hw, -hh, W, H);

    // Screen scanlines
    if (!hitCol) {
      ctx.strokeStyle = 'rgba(0,40,120,0.4)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(-hw, -hh + (H / 7) * i);
        ctx.lineTo(hw, -hh + (H / 7) * i);
        ctx.stroke();
      }
    }

    // Sad face
    const fy = -hh + H * 0.3;
    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(-12, fy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, fy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0055AA';
    ctx.beginPath(); ctx.arc(-12, fy + 1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, fy + 1, 3.5, 0, Math.PI * 2); ctx.fill();

    // Sad mouth (frown)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, fy + 14, 12, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(':(', 0, fy - 13);
    ctx.font = '6px monospace';
    ctx.fillText('FATAL_ERROR', 0, -hh + H * 0.65);
    ctx.fillText('0x000000BE', 0, -hh + H * 0.77);

    // Border glow
    ctx.strokeStyle = hitCol ? '#FFFFFF' : '#44AAFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, W, H);

    ctx.restore();
    const bsodEnraged = this.health < this.maxHealth * 0.5;
    this.drawMiniBossHealthBar(ctx, bsodEnraged ? '💀 PIPELINE PHANTOM [CRITICAL] 💀' : '⚠ PIPELINE PHANTOM ⚠', bsodEnraged ? '#4488FF' : '#0078D4');
    this.drawShots(ctx, now);
  }
}

// ─── Mini-Boss 2: LOOP-ZILLA (Infinite Loop Monster) ─────────────────────────

export class LoopZilla extends MiniBossEnemy {
  private loopTime = 0;
  private loopRadius = 0;
  private startX: number;
  private loopBurstTimer = 4.5;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -50, 'loopZilla', speedMult, healthMult);
    this.startX = x;
    this.loopRadius = 0;
  }

  update(dt: number, px: number, py: number, cw: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);

    // Slide in then loop
    if (this.y < 160) {
      this.y += this.speed * 0.8 * dt;
    } else {
      if (this.loopRadius < 130) this.loopRadius = Math.min(130, this.loopRadius + 200 * dt);
      this.loopTime += dt * 1.1;
      const hpFrac = this.health / this.maxHealth;
      const speedup = 1 + (1 - hpFrac) * 0.7;  // faster when hurt
      this.loopTime += dt * 0.4 * speedup;
      this.x = cw / 2 + Math.cos(this.loopTime) * this.loopRadius;
      this.y = 160 + Math.sin(this.loopTime) * 55;
    }

    const loopEnraged = this.health < this.maxHealth * 0.5;

    // Phase 2: radial burst on a timer
    if (loopEnraged && this.y >= 160) {
      this.loopBurstTimer -= dt;
      if (this.loopBurstTimer <= 0) {
        this.loopBurstTimer = 3.2 + Math.random();
        this.fireCircle(12, 172, '#AAFFAA');
      }
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = (loopEnraged ? 0.9 : 1.5) + Math.random();
      this.fireAimed(px, py, loopEnraged ? 235 : 200, '#44FF44', 0.18);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    const hw = W / 2, hh = H / 2;
    const t = now * 0.003;

    ctx.save();
    ctx.translate(x, y);

    // Spinning ∞ ring behind body
    ctx.save();
    ctx.rotate(t);
    ctx.strokeStyle = this.hitFlash > 0 ? '#FFFFFF' : 'rgba(80,255,80,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw + 10, hh * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(-t * 1.3);
    ctx.strokeStyle = this.hitFlash > 0 ? '#FFFFFF' : 'rgba(120,255,80,0.40)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw * 0.5, hh + 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Body — round green creature
    const hitCol = this.hitFlash > 0;
    const bodyGrad = ctx.createRadialGradient(-hw * 0.25, -hh * 0.25, 2, 0, 0, hw * 0.9);
    bodyGrad.addColorStop(0, hitCol ? '#FFFFFF' : '#88EE44');
    bodyGrad.addColorStop(0.6, hitCol ? '#DDDDDD' : '#33BB22');
    bodyGrad.addColorStop(1, hitCol ? '#AAAAAA' : '#1A6610');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw * 0.88, hh * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!hitCol) {
      // Googly eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(-14, -10, 9, 10, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(14, -10, 9, 10, 0.2, 0, Math.PI * 2); ctx.fill();
      const blink = Math.sin(now * 0.0018) > 0.9;
      if (!blink) {
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-13, -9, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(15, -9, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-11, -11, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(17, -11, 2, 0, Math.PI * 2); ctx.fill();
      }
      // Mouth — unhinged grin
      ctx.strokeStyle = '#1A6610';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 5, 14, 0.1, Math.PI - 0.1);
      ctx.stroke();
      // Teeth
      ctx.fillStyle = '#FFFFFF';
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 5 - 1, 8, 3, 5);
      }
      // while(true) label
      ctx.fillStyle = '#1A4410';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('while(true)', 0, hh * 0.88);
    }

    ctx.restore();
    const loopLabel = this.health < this.maxHealth * 0.5 ? '⚡ JWT JUGGERNAUT [OVERDRIVE] ⚡' : '⟳ JWT JUGGERNAUT ⟳';
    this.drawMiniBossHealthBar(ctx, loopLabel, this.health < this.maxHealth * 0.5 ? '#88FF44' : '#44DD22');
    this.drawShots(ctx, now);
  }
}

// ─── Mini-Boss 3: SYNTAX TERRORIZER ──────────────────────────────────────────

export class SyntaxTerror extends MiniBossEnemy {
  private teleportTimer = 2.2;
  private glitch = 0;
  private angle = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -50, 'syntaxTerror', speedMult, healthMult);
  }

  update(dt: number, px: number, py: number, cw: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.glitch > 0) this.glitch -= dt * 3;

    // Drift down to position then hold
    if (this.y < 170) this.y += this.speed * 0.6 * dt;

    // Slow horizontal menace
    this.angle += dt * 0.8;
    const tw = cw - this.width;
    this.x = this.width / 2 + (Math.sin(this.angle) * 0.5 + 0.5) * tw;

    const syntaxEnraged = this.health < this.maxHealth * 0.5;

    // Teleport-scream — more frequent and bigger burst in phase 2
    this.teleportTimer -= dt;
    if (this.teleportTimer <= 0) {
      this.x = this.width / 2 + Math.random() * (cw - this.width);
      this.teleportTimer = (syntaxEnraged ? 1.0 : 1.8) + Math.random() * (syntaxEnraged ? 0.7 : 1.5);
      this.glitch = 0.5;
      // Spread burst — 7 shots in phase 2, 5 in phase 1
      const burstCount = syntaxEnraged ? 7 : 5;
      for (let i = 0; i < burstCount; i++) {
        const a = Math.atan2(py - this.y, px - this.x) + (i - Math.floor(burstCount / 2)) * 0.26;
        const spd = (syntaxEnraged ? 215 : 195) + i * 15;
        this.shots.push({ x: this.x, y: this.y + 20,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          active: true, width: 11, height: 11, color: syntaxEnraged ? '#FF2222' : '#FF4444' });
      }
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = (syntaxEnraged ? 1.4 : 2.2) + Math.random();
      this.fireAimed(px, py, syntaxEnraged ? 225 : 185, '#FF6666', syntaxEnraged ? 0.22 : 0.15);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    const hw = W / 2, hh = H / 2;
    const hitCol = this.hitFlash > 0;
    const gi = this.glitch;

    ctx.save();
    ctx.translate(x, y);

    // Glitch offset layers
    if (gi > 0.1) {
      const off = gi * 14;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(-hw - off, -hh, W, H);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(-hw + off, -hh, W, H);
      ctx.globalAlpha = 1;
    }

    // Left bracket
    const bw = 22, bt = 10;
    ctx.fillStyle = hitCol ? '#FFFFFF' : '#CC1111';
    ctx.fillRect(-hw, -hh, bw, bt);          // top
    ctx.fillRect(-hw, -hh, bt, H);           // left bar
    ctx.fillRect(-hw, hh - bt, bw, bt);      // bottom

    // Right bracket
    ctx.fillRect(hw - bw, -hh, bw, bt);
    ctx.fillRect(hw - bt, -hh, bt, H);
    ctx.fillRect(hw - bw, hh - bt, bw, bt);

    // Inner face
    ctx.fillStyle = hitCol ? '#FF8888' : '#1A0000';
    ctx.fillRect(-hw + bt, -hh + bt, W - bt * 2, H - bt * 2);

    if (!hitCol) {
      // Angry eyes
      ctx.fillStyle = '#FF2222';
      ctx.beginPath(); ctx.ellipse(-18, -12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(18, -12, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      // Pupils
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(-18, -12, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, -12, 4, 0, Math.PI * 2); ctx.fill();
      // Eyebrows — angry V shape
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-28, -22); ctx.lineTo(-8, -18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28, -22); ctx.lineTo(8, -18); ctx.stroke();
      // Jagged teeth mouth
      ctx.fillStyle = '#FF2222';
      ctx.beginPath();
      ctx.moveTo(-22, 8);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(-22 + i * 7.5 + 3, i % 2 === 0 ? 20 : 8);
      }
      ctx.lineTo(22, 8);
      ctx.closePath();
      ctx.fill();
      // Error text
      ctx.fillStyle = '#FF8888';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('SyntaxError', 0, hh - bt - 2);
    }

    ctx.restore();
    const syntaxLabel = this.health < this.maxHealth * 0.5 ? '{ LEGACY LEVIATHAN [BERSERK] }' : '{ LEGACY LEVIATHAN }';
    this.drawMiniBossHealthBar(ctx, syntaxLabel, '#FF3333');
    this.drawShots(ctx, now);
  }
}

// ─── Mini-Boss 4: NULL PHANTOM ────────────────────────────────────────────────

export class NullPhantom extends MiniBossEnemy {
  private phaseTimer = 2.5;
  private phased = false;
  private phasedAlpha = 1;
  private driftVx = 0;
  private driftTimer = 0;
  private floatTime = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -50, 'nullPhantom', speedMult, healthMult);
    this.shootTimer = 2.5;
  }

  takeDamage(amount: number): boolean {
    // Phased takes half damage
    return super.takeDamage(this.phased ? amount * 0.5 : amount);
  }

  update(dt: number, px: number, py: number, cw: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.floatTime += dt;

    if (this.y < 180) this.y += this.speed * 0.5 * dt;

    const nullEnraged = this.health < this.maxHealth * 0.5;

    // Phase in/out — on un-phase in phase 2, fire a circle burst
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      const wasPhased = this.phased;
      this.phased = !this.phased;
      this.phaseTimer = this.phased ? (nullEnraged ? 1.4 : 1.8) : 2.2 + Math.random();
      if (wasPhased && !this.phased && nullEnraged) {
        this.fireCircle(10, 162, '#8899FF');
      }
    }
    const targetAlpha = this.phased ? 0.25 : 1.0;
    this.phasedAlpha += (targetAlpha - this.phasedAlpha) * dt * 4;

    // Erratic drift
    this.driftTimer -= dt;
    if (this.driftTimer <= 0) {
      this.driftVx = (Math.random() - 0.5) * 200;
      this.driftTimer = 0.4 + Math.random() * 0.6;
    }
    this.x += this.driftVx * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));

    // Float oscillation
    this.y += Math.sin(this.floatTime * 1.5) * 18 * dt;
    this.y = Math.max(120, Math.min(240, this.y));

    // Shoot only when not phased — faster in phase 2
    if (!this.phased) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = (nullEnraged ? 0.9 : 2.0) + Math.random();
        this.fireAimed(px, py, nullEnraged ? 205 : 175, '#88AAFF', 0.25);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    const hw = W / 2, hh = H / 2;
    const hitCol = this.hitFlash > 0;
    const t = now * 0.002;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = this.phasedAlpha * (hitCol ? 0.6 : 1);

    // Ghostly body — layered ellipses
    const g = ctx.createRadialGradient(0, -hh * 0.2, 4, 0, 0, hw);
    g.addColorStop(0, hitCol ? '#FFFFFF' : '#CCDDFF');
    g.addColorStop(0.5, hitCol ? '#AAAACC' : '#6688CC');
    g.addColorStop(1, 'rgba(30,40,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.1, hw * 0.9, hh * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wavy ghost tail
    if (!hitCol) {
      ctx.fillStyle = 'rgba(100,130,220,0.55)';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.75, hh * 0.2);
      const tailY = hh * 0.85;
      const waveFreq = 3;
      for (let i = 0; i <= 8; i++) {
        const tx = -hw * 0.75 + (i / 8) * W * 1.5;
        const ty = tailY + Math.sin(t * 2 + i * waveFreq) * 10;
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(hw * 0.75, hh * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    // Hollow eyes
    ctx.fillStyle = hitCol ? '#FF6666' : 'rgba(20,30,80,0.85)';
    ctx.beginPath(); ctx.ellipse(-16, -14, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -14, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    // Eerie glow pupils
    if (!hitCol) {
      ctx.fillStyle = `rgba(150,170,255,${0.6 + Math.sin(t * 3) * 0.4})`;
      ctx.beginPath(); ctx.arc(-16, -14, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16, -14, 4, 0, Math.PI * 2); ctx.fill();
    }
    // NULL text on forehead
    if (!hitCol) {
      ctx.fillStyle = 'rgba(60,80,180,0.9)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('null', 0, -hh * 0.55);
    }
    // Spooky mouth ooOOO
    ctx.strokeStyle = hitCol ? '#FF8888' : 'rgba(80,100,200,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 10, 7, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();

    // Phase indicator
    if (this.phased) {
      ctx.save();
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = 'rgba(140,160,255,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('PHASED', x, y + hh + 4);
      ctx.restore();
    }

    const nullLabel = this.health < this.maxHealth * 0.5 ? '🐉 DEPLOY DRAGON [UNBOUND]' : '🐉 DEPLOY DRAGON';
    this.drawMiniBossHealthBar(ctx, nullLabel, this.health < this.maxHealth * 0.5 ? '#CC99FF' : '#AABBFF');
    this.drawShots(ctx, now);
  }
}

// ─── Mini-Boss 5: STACK TITAN ─────────────────────────────────────────────────

export class StackTitan extends MiniBossEnemy {
  private sweepVx: number;
  private rageMode = false;
  private dashTimer = 3.0;
  private dashActive = false;
  private dashDx = 0;
  private flameTime = 0;

  constructor(x: number, speedMult: number, healthMult = 1) {
    super(x, -60, 'stackTitan', speedMult, healthMult);
    this.sweepVx = 110 * (Math.random() > 0.5 ? 1 : -1);
    this.shootTimer = 2.0;
  }

  update(dt: number, px: number, py: number, cw: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.flameTime += dt;

    if (this.y < 190) { this.y += this.speed * 0.55 * dt; return; }

    this.rageMode = this.health < this.maxHealth * 0.4;
    const titanPhase2 = this.health < this.maxHealth * 0.6 && !this.rageMode;

    if (this.dashActive) {
      this.x += this.dashDx * dt;
      if (this.x < this.width / 2 || this.x > cw - this.width / 2) {
        this.dashDx *= -1;
        this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
        this.dashActive = false;
      }
    } else {
      this.x += this.sweepVx * (this.rageMode ? 1.5 : titanPhase2 ? 1.28 : 1) * dt;
      if (this.x < this.width / 2 || this.x > cw - this.width / 2) {
        this.sweepVx *= -1;
        this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
      }
    }

    this.dashTimer -= dt;
    if (this.dashTimer <= 0) {
      this.dashActive = true;
      this.dashDx = (px > this.x ? 1 : -1) * (this.rageMode ? 520 : 480);
      this.dashTimer = this.rageMode ? 1.8 : titanPhase2 ? 2.2 : 2.8 + Math.random();
      // Rage burst fire
      if (this.rageMode) this.fireCircle(8, 180, '#FF4400');
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = (this.rageMode ? 0.8 : 1.6) + Math.random() * 0.6;
      this.fireAimed(px, py, 220, '#FF6600', 0.2);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    const hw = W / 2, hh = H / 2;
    const hitCol = this.hitFlash > 0;
    const t = this.flameTime;

    ctx.save();
    ctx.translate(x, y);

    // Flame aura (bottom)
    if (!hitCol) {
      for (let i = 0; i < 5; i++) {
        const fx = (i - 2) * 16;
        const fh = 18 + Math.sin(t * 4 + i) * 8;
        const fg = ctx.createLinearGradient(fx, hh, fx, hh + fh);
        fg.addColorStop(0, this.rageMode ? 'rgba(255,50,0,0.9)' : 'rgba(255,120,0,0.7)');
        fg.addColorStop(1, 'rgba(255,200,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(fx, hh + fh * 0.3, 8, fh * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stack of blocks (the body)
    const blockH = H / 4;
    const blockColors = hitCol
      ? ['#FFFFFF', '#DDDDDD', '#BBBBBB', '#999999']
      : this.rageMode
      ? ['#FF2200', '#FF4400', '#FF6600', '#FF8800']
      : ['#CC3300', '#DD4400', '#EE5500', '#FF6600'];

    for (let i = 0; i < 4; i++) {
      const bY = -hh + i * blockH;
      const wobble = Math.sin(t * 3 + i * 1.2) * (i * 1.5);
      ctx.fillStyle = blockColors[i];
      ctx.fillRect(-hw + wobble, bY, W - Math.abs(wobble) * 2, blockH - 2);
      // Block outline
      ctx.strokeStyle = hitCol ? '#AAAAAA' : 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-hw + wobble, bY, W - Math.abs(wobble) * 2, blockH - 2);
    }

    if (!hitCol) {
      // Angry face on top block
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath(); ctx.arc(-18, -hh + blockH * 0.45, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, -hh + blockH * 0.45, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-18, -hh + blockH * 0.45, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, -hh + blockH * 0.45, 4, 0, Math.PI * 2); ctx.fill();

      // Labels on blocks
      const labels = ['OVER', 'FLOW', 'STACK', this.rageMode ? '!!!!' : '...'];
      for (let i = 0; i < 4; i++) {
        const by = -hh + i * blockH + blockH * 0.5;
        if (i === 0) continue; // face on block 0
        ctx.fillStyle = 'rgba(255,220,180,0.9)';
        ctx.font = `bold ${i === 3 ? 8 : 9}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[i], 0, by);
      }
    }

    ctx.restore();
    const titanP2 = this.health < this.maxHealth * 0.6 && !this.rageMode;
    const titanLabel = this.rageMode ? '🩹 PATCH HYDRA [RAGE] 🩹' : titanP2 ? '⚠ PATCH HYDRA [UNSTABLE] ⚠' : '🩹 PATCH HYDRA';
    const titanBarColor = this.rageMode ? '#FF2200' : titanP2 ? '#FF8800' : '#FF6600';
    this.drawMiniBossHealthBar(ctx, titanLabel, titanBarColor);
    this.drawShots(ctx, now);
  }
}

// ─── Boss ─────────────────────────────────────────────────────────────────────

export interface BossShot {
  x: number; y: number; vx: number; vy: number;
  active: boolean; width: number; height: number;
}

export class BossEnemy {
  x: number;
  y: number;
  readonly width = 160;
  readonly height = 160;
  health: number;
  readonly maxHealth = 160;
  active = true;
  hitFlash = 0;

  private shootTimer = 2.2;
  private sweepTime = 0;
  private entryDone = false;
  private chargeDx = 0;
  private chargeDy = 0;
  private chargeTimer = 0;
  private chargePhase = false;
  private chargeReady = 4.5; // seconds until first charge
  private deathTimer = 0;
  dying = false;
  deathComplete = false;
  private deathPhase = 0;
  private deathFlashTimer = 0;
  private laughTimer = 0;
  laughing = false;
  private phase2Triggered = false;
  private phase3Triggered = false;

  shots: BossShot[] = [];

  constructor(canvasWidth: number) {
    this.health = this.maxHealth;
    this.x = canvasWidth / 2;
    this.y = -120;
  }

  takeDamage(amount: number): boolean {
    if (this.dying) return false;
    this.health -= amount;
    this.hitFlash = 0.12;
    if (this.health <= 0) {
      this.health = 0;
      this.dying = true;
      this.deathTimer = 0;
      this.deathPhase = 0;
      return true;
    }
    // Laugh when hit to 50% health for the first time
    if (this.health <= this.maxHealth * 0.5 && !this.laughing && this.health > 0) {
      this.laughing = true;
      this.laughTimer = 3.2;
    }
    return false;
  }

  update(dt: number, px: number, canvasWidth: number, canvasHeight: number, now: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.laughTimer > 0) this.laughTimer = Math.max(0, this.laughTimer - dt);

    // ── Death sequence ──────────────────────────────────────────────────────
    if (this.dying) {
      this.deathTimer += dt;
      this.y += 0.5 * dt; // drift slightly
      // Shake wildly
      this.x += (Math.random() - 0.5) * 6;
      if (this.deathTimer > 5.0) this.deathComplete = true;
      return;
    }

    // ── Entry slide-in ──────────────────────────────────────────────────────
    const targetY = 130;
    if (!this.entryDone) {
      this.y += (targetY - this.y) * 4 * dt;
      if (Math.abs(this.y - targetY) < 2) { this.y = targetY; this.entryDone = true; }
      return;
    }

    // ── Phase transitions ────────────────────────────────────────────────────
    if (!this.phase2Triggered && this.health <= this.maxHealth * 0.5) {
      this.phase2Triggered = true;
      // Circle burst + accelerate next charge
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.shots.push({ x: this.x, y: this.y + 50,
          vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
          active: true, width: 14, height: 14 });
      }
      this.chargeReady = Math.min(this.chargeReady, 1.5);
    }
    if (!this.phase3Triggered && this.health <= this.maxHealth * 0.25) {
      this.phase3Triggered = true;
      // Bigger circle burst + very fast next charge
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.shots.push({ x: this.x, y: this.y + 50,
          vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
          active: true, width: 14, height: 14 });
      }
      this.chargeReady = Math.min(this.chargeReady, 0.8);
    }

    // ── Charge behavior ─────────────────────────────────────────────────────
    this.chargeReady -= dt;
    if (this.chargePhase) {
      this.x += this.chargeDx * dt;
      this.y += this.chargeDy * dt;
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargePhase = false;
        this.chargeReady = this.phase3Triggered ? 1.8 : this.phase2Triggered ? 2.5 : 3.5;
        // Slide back to top
        this.chargeDy = -140;
        this.chargeDx = (canvasWidth / 2 - this.x) * 1.2;
      }
      // Clamp back
      this.x = Math.max(this.width / 2 + 10, Math.min(canvasWidth - this.width / 2 - 10, this.x));
      this.y = Math.max(60, Math.min(canvasHeight * 0.55, this.y));
    } else if (this.chargeDy !== 0) {
      // Return-to-position glide
      this.x += this.chargeDx * dt;
      this.y += this.chargeDy * dt;
      if (this.y <= targetY + 5) {
        this.y = targetY;
        this.chargeDx = 0;
        this.chargeDy = 0;
      }
    } else {
      // Normal sweep
      this.sweepTime += dt * 0.7;
      const targetX = canvasWidth / 2 + Math.sin(this.sweepTime) * (canvasWidth * 0.35);
      this.x += (targetX - this.x) * 1.8 * dt;

      // Trigger charge
      if (this.chargeReady <= 0 && !this.chargePhase) {
        this.chargePhase = true;
        this.chargeTimer = 0.55;
        const dx = px - this.x;
        const dy = canvasHeight * 0.6 - this.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        this.chargeDx = (dx / len) * 620;
        this.chargeDy = (dy / len) * 620;
      }
    }

    // ── Shoot ───────────────────────────────────────────────────────────────
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && !this.chargePhase) {
      this.shootTimer = 1.8 + Math.random();
      this.fireAtPlayer(px, canvasHeight);
    }

    // ── Move shots ──────────────────────────────────────────────────────────
    for (const s of this.shots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > canvasHeight + 20) s.active = false;
    }
    this.shots = this.shots.filter(s => s.active);
  }

  private fireAtPlayer(px: number, canvasHeight: number) {
    const spreadCount = this.health < this.maxHealth * 0.4 ? 5 : 3;
    for (let i = 0; i < spreadCount; i++) {
      const spreadAngle = ((i - Math.floor(spreadCount / 2)) / Math.floor(spreadCount / 2 + 0.5)) * 0.45;
      const baseAngle = Math.atan2(canvasHeight * 0.6 - this.y, px - this.x);
      const angle = baseAngle + spreadAngle;
      const speed = 240;
      this.shots.push({
        x: this.x, y: this.y + 60,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        active: true, width: 14, height: 14,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y } = this;

    if (this.dying) {
      const t = this.deathTimer;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (t - 1.8) / 1.0);
      const scale = 1 + t * 0.15;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const bossImg = SPRITES.boss;
      if (bossImg && bossImg.complete && bossImg.naturalWidth > 0) {
        ctx.drawImage(bossImg, -80, -80, 160, 160);
      }
      ctx.restore();
      return;
    }

    // ── Body ────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(x, y);

    // Wobble when hit
    if (this.hitFlash > 0) {
      ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    }

    // Pulse scale
    const pulse = 1 + Math.sin(now * 0.004) * 0.03;
    ctx.scale(pulse, pulse);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 80, 70, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw boss image
    const bossImg = SPRITES.boss;
    if (bossImg && bossImg.complete && bossImg.naturalWidth > 0) {
      if (this.hitFlash > 0) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(bossImg, -80, -80, 160, 160);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(-80, -80, 160, 160);
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(bossImg, -80, -80, 160, 160);
      }
    } else {
      // Fallback circle
      ctx.fillStyle = this.hitFlash > 0 ? '#FF4444' : '#CC3300';
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
    }

    // Laugh speech bubble
    if (this.laughTimer > 0 && this.laughTimer > 0.2) {
      ctx.globalAlpha = Math.min(1, this.laughTimer);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(28, -105, 138, 44, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(50, -61); ctx.lineTo(40, -48); ctx.lineTo(64, -61);
      ctx.fill();
      ctx.fillStyle = '#CC0000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOCS ARE', 97, -91);
      ctx.fillText('CORRUPTED!', 97, -74);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ── Health bar (top of screen) ──────────────────────────────────────────
    const bw = 320;
    const bx = x - bw / 2;
    const by = y - 90;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#FF2222';
    ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), 10);
    // Glow on low health
    if (this.health < this.maxHealth * 0.3) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 10);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gregLabel = this.phase3Triggered ? 'THE CORRUPTED BUILD [DESPERATE] ☠'
      : this.phase2Triggered ? 'THE CORRUPTED BUILD [ENRAGED] 💀'
      : 'THE CORRUPTED BUILD';
    ctx.fillText(gregLabel, x, by - 9);

    // ── Draw boss shots ─────────────────────────────────────────────────────
    for (const s of this.shots) {
      if (!s.active) continue;
      ctx.save();
      const bHue = (now * 0.15 + s.x * 0.5) % 360;
      ctx.fillStyle = `hsl(${bHue}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BUG', s.x, s.y);
      ctx.restore();
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// HP scales up steeply by level — level 1 enemies die in 1-2 shots
const HEALTH_MULTS = [0.4, 0.65, 1.0, 1.35, 1.8];

export function createEnemy(type: EnemyType, canvasWidth: number, level: number): Enemy {
  const x = 50 + Math.random() * (canvasWidth - 100);
  const speedMult = 1 + (level - 1) * 0.08;
  const healthMult = HEALTH_MULTS[Math.min(level - 1, HEALTH_MULTS.length - 1)];
  switch (type) {
    case 'meteor404':       return new Meteor404(x, speedMult, healthMult);
    case 'bugSwarm':        return new BugSwarm(x, speedMult, healthMult);
    case 'warningTriangle': return new WarningTriangle(x, speedMult, healthMult);
    case 'undefinedBlob':   return new UndefinedBlob(x, speedMult, healthMult);
    case 'buildBot':        return new BuildBot(x, speedMult, healthMult);
    case 'glitchCube':      return new GlitchCube(x, speedMult, healthMult);
    case 'shooterBug':      return new ShooterBug(x, speedMult, healthMult);
    case 'turretBug':       return new TurretBug(x, speedMult, healthMult);
    case 'shieldBot':       return new ShieldBot(x, speedMult, healthMult);
    case 'kamikazeBug':     return new KamikazeBug(x, speedMult, healthMult);
    // formationBug is spawned in a batch via spawnFormation() — fallback to solo
    case 'formationBug':    return new FormationBug(x, -30, x, speedMult, healthMult);
    // Mini-bosses — always spawn centered
    case 'bsodBug':        return new BsodBug(canvasWidth / 2, speedMult, healthMult);
    case 'loopZilla':      return new LoopZilla(canvasWidth / 2, speedMult, healthMult);
    case 'syntaxTerror':   return new SyntaxTerror(canvasWidth / 2, speedMult, healthMult);
    case 'nullPhantom':    return new NullPhantom(canvasWidth / 2, speedMult, healthMult);
    case 'stackTitan':     return new StackTitan(canvasWidth / 2, speedMult, healthMult);
  }
}

export function getAvailableTypes(level: number): EnemyType[] {
  const types: EnemyType[] = ['meteor404', 'bugSwarm'];
  if (level >= 2) types.push('warningTriangle');
  if (level >= 3) types.push('undefinedBlob');
  if (level >= 4) types.push('buildBot');
  if (level >= 5) types.push('glitchCube');
  return types;
}

export function isMiniBosstType(type: EnemyType): boolean {
  return type === 'bsodBug' || type === 'loopZilla' || type === 'syntaxTerror'
      || type === 'nullPhantom' || type === 'stackTitan';
}
