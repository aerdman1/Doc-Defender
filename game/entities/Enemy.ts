import { EnemyType } from '../types';
import { ENEMY } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Base class
// ─────────────────────────────────────────────────────────────────────────────

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
  hitFlash = 0; // seconds remaining

  constructor(x: number, y: number, type: EnemyType, speedMult: number) {
    const cfg = ENEMY[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = cfg.width;
    this.height = cfg.height;
    this.speed = cfg.baseSpeed * speedMult;
    this.health = cfg.health;
    this.maxHealth = cfg.health;
    this.points = cfg.points;
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    this.hitFlash = 0.1;
    if (this.health <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  isOffscreen(canvasHeight: number): boolean {
    return this.y - this.height / 2 > canvasHeight + 10;
  }

  abstract update(dt: number, px: number, py: number, cw: number, now: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, now: number): void;

  protected drawHealthBar(ctx: CanvasRenderingContext2D) {
    if (this.health >= this.maxHealth) return;
    const bw = this.width * 0.88;
    const bh = 4;
    const bx = this.x - bw / 2;
    const by = this.y - this.height / 2 - 9;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), bh);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Meteor 404 — straight down, slow rotation
// ─────────────────────────────────────────────────────────────────────────────

export class Meteor404 extends Enemy {
  private rotation = 0;
  private rotSpeed = (Math.random() - 0.5) * 3;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'meteor404', speedMult);
  }

  update(dt: number) {
    this.y += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width } = this;
    const r = width / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);

    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#5C4A2E';
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const wobble = r * (0.72 + ((i * 37 % 5) / 5 - 0.22) * 0.36);
      const px = Math.cos(angle) * wobble;
      const py = Math.sin(angle) * wobble;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    if (this.hitFlash <= 0) {
      ctx.fillStyle = '#3D2F1A';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.12, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.28, r * 0.22, r * 0.13, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = '#FF3333';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#FF4444';
      ctx.font = `bold ${Math.floor(r * 0.62)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('404', 0, 0);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Bug Swarm — sine wave horizontal drift
// ─────────────────────────────────────────────────────────────────────────────

export class BugSwarm extends Enemy {
  private swarmTime = Math.random() * Math.PI * 2;
  private amplitude = 55 + Math.random() * 45;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'bugSwarm', speedMult);
  }

  update(dt: number, _px: number, _py: number, cw: number) {
    this.swarmTime += dt * 2.2;
    this.y += this.speed * dt;
    this.x += Math.cos(this.swarmTime) * this.amplitude * dt;
    this.x = Math.max(this.width / 2, Math.min(cw - this.width / 2, this.x));
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width } = this;
    const r = width / 2;
    const sa = now * 0.003;
    ctx.save();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + sa;
      const dist = r * 0.44;
      const bx = x + Math.cos(angle) * dist;
      const by = y + Math.sin(angle) * dist;
      const br = r * 0.18;

      ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#22CC44';
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.4, br * 0.9, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + Math.cos(angle) * br * 1.2, by + Math.sin(angle) * br * 1.2, br * 0.7, 0, Math.PI * 2);
      ctx.fill();

      if (this.hitFlash <= 0) {
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(bx + Math.cos(angle) * br * 1.65, by + Math.sin(angle) * br * 1.65, br * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#007722';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Warning Triangle — fast, diagonal, bounces off walls
// ─────────────────────────────────────────────────────────────────────────────

export class WarningTriangle extends Enemy {
  private vx: number;
  private pulseTime = 0;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'warningTriangle', speedMult);
    this.vx = (Math.random() > 0.5 ? 1 : -1) * this.speed * 0.6;
  }

  update(dt: number, _px: number, _py: number, cw: number) {
    this.y += this.speed * dt;
    this.x += this.vx * dt;
    this.pulseTime += dt;

    if (this.x < this.width / 2 || this.x > cw - this.width / 2) {
      this.vx *= -1;
    }
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height } = this;
    const hw = width / 2;
    const hh = height / 2;
    const pulse = 0.55 + Math.sin(this.pulseTime * 5.5) * 0.45;

    ctx.save();
    ctx.shadowColor = '#FFCC00';
    ctx.shadowBlur = 16 * pulse;

    ctx.fillStyle = this.hitFlash > 0 ? '#FFFFFF' : '#FFCC00';
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y + hh);
    ctx.lineTo(x - hw, y + hh);
    ctx.closePath();
    ctx.fill();

    if (this.hitFlash <= 0) {
      ctx.strokeStyle = '#FF8800';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#1a1a00';
      ctx.font = `bold ${Math.floor(hh * 1.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y + hh * 0.1);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Undefined Blob — drifts + gentle player homing
// ─────────────────────────────────────────────────────────────────────────────

export class UndefinedBlob extends Enemy {
  private animTime = Math.random() * Math.PI * 2;
  private driftVx = 0;
  private driftTimer = 0;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'undefinedBlob', speedMult);
  }

  update(dt: number, px: number, _py: number, cw: number) {
    this.animTime += dt;
    this.y += this.speed * dt;

    // Gentle homing
    this.x += (px - this.x) * 0.07 * dt;

    // Random drift
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
    const { x, y, width } = this;
    const r = width / 2;
    const t = this.animTime;

    ctx.save();

    const grd = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.1);
    grd.addColorStop(0, this.hitFlash > 0 ? '#FFFFFF' : '#CC66FF');
    grd.addColorStop(0.6, this.hitFlash > 0 ? '#DDDDFF' : '#7722AA');
    grd.addColorStop(1, 'rgba(40, 0, 80, 0)');

    ctx.shadowColor = '#9933FF';
    ctx.shadowBlur = 18;
    ctx.fillStyle = grd;
    ctx.beginPath();
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const wobble = r * (0.76 + Math.sin(t * 2.5 + i * 1.31) * 0.24);
      const px2 = x + Math.cos(angle) * wobble;
      const py = y + Math.sin(angle) * wobble;
      if (i === 0) ctx.moveTo(px2, py); else ctx.lineTo(px2, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.hitFlash <= 0) {
      ctx.fillStyle = 'rgba(220, 180, 255, 0.85)';
      ctx.font = `${Math.floor(r * 0.36)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('undefined', x, y);
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Build Bot — straight down, slowly tracks player x
// ─────────────────────────────────────────────────────────────────────────────

export class BuildBot extends Enemy {
  private eyeTime = 0;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'buildBot', speedMult);
  }

  update(dt: number, px: number) {
    this.y += this.speed * dt;
    this.x += (px - this.x) * 0.55 * dt;
    this.eyeTime += dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height } = this;
    const hw = width / 2;
    const hh = height / 2;

    ctx.save();
    ctx.translate(x, y);

    const base = this.hitFlash > 0 ? '#FFFFFF' : '#CC3300';
    const dark = this.hitFlash > 0 ? '#FFFFFF' : '#991100';

    ctx.fillStyle = base;
    ctx.fillRect(-hw, -hh, width, height);

    ctx.fillStyle = dark;
    ctx.fillRect(-hw + 4, -hh + 4, (width - 8) * 0.52, height - 8);

    if (this.hitFlash <= 0) {
      const eFlicker = 0.65 + Math.sin(this.eyeTime * 9) * 0.35;
      ctx.fillStyle = '#FF2200';
      ctx.shadowColor = '#FF0000';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = eFlicker;
      ctx.fillRect(-hw + 7, -hh + 8, 11, 7);
      ctx.fillRect(hw - 18, -hh + 8, 11, 7);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#FF5500';
      ctx.lineWidth = 1.5;
      const rl = hw * 0.35;
      ctx.beginPath();
      ctx.arc(0, hh * 0.1, rl, 0, Math.PI * 2);
      ctx.moveTo(0, -hh * 0.28); ctx.lineTo(0, hh * 0.28);
      ctx.moveTo(-hw * 0.28, hh * 0.1); ctx.lineTo(hw * 0.28, hh * 0.1);
      ctx.stroke();

      ctx.fillStyle = '#FF5500';
      ctx.font = `bold ${Math.floor(hw * 0.42)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BUILD', 0, hh * 0.48);
      ctx.fillText('FAIL', 0, hh * 0.75);
    }

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Glitch Cube — falls + random x teleports
// ─────────────────────────────────────────────────────────────────────────────

export class GlitchCube extends Enemy {
  private teleportTimer = 1.4 + Math.random();
  private glitchIntensity = 0;

  constructor(x: number, speedMult: number) {
    super(x, -30, 'glitchCube', speedMult);
  }

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
    const hw = width / 2;
    const hh = height / 2;

    ctx.save();
    ctx.translate(x, y);

    const gi = this.glitchIntensity + (Math.random() < 0.04 ? 0.14 : 0);
    if (gi > 0.06) {
      const off = gi * 8;
      ctx.globalAlpha = 0.55;
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
        ctx.moveTo(-hw + width * f, -hh);
        ctx.lineTo(-hw + width * f, hh);
        ctx.moveTo(-hw, -hh + height * f);
        ctx.lineTo(hw, -hh + height * f);
        ctx.stroke();
      }

      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00FFFF';
      ctx.shadowBlur = 10;
      ctx.strokeRect(-hw, -hh, width, height);
      ctx.shadowBlur = 0;

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

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createEnemy(type: EnemyType, canvasWidth: number, level: number): Enemy {
  const x = 50 + Math.random() * (canvasWidth - 100);
  const speedMult = 1 + (level - 1) * 0.08;
  switch (type) {
    case 'meteor404':      return new Meteor404(x, speedMult);
    case 'bugSwarm':       return new BugSwarm(x, speedMult);
    case 'warningTriangle': return new WarningTriangle(x, speedMult);
    case 'undefinedBlob':  return new UndefinedBlob(x, speedMult);
    case 'buildBot':       return new BuildBot(x, speedMult);
    case 'glitchCube':     return new GlitchCube(x, speedMult);
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
