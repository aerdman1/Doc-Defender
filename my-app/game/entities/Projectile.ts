import { PROJECTILE } from '../constants';

export type ProjectileStyle = 'normal' | 'plasma' | 'spread' | 'side' | 'rear';

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  active = true;
  style: ProjectileStyle;

  constructor(
    x: number,
    y: number,
    angleRad = -Math.PI / 2,
    speed: number = PROJECTILE.SPEED,
    damage: number = PROJECTILE.DAMAGE,
    style: ProjectileStyle = 'normal',
    widthMult = 1
  ) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angleRad) * speed;
    this.vy = Math.sin(angleRad) * speed;
    this.damage = damage;
    this.style = style;

    if (style === 'plasma') {
      this.width = Math.round(12 * widthMult); this.height = 24;
    } else {
      this.width = Math.round(5 * widthMult); this.height = 13;
    }
  }

  update(dt: number, canvasWidth: number, canvasHeight: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (
      this.y + this.height < 0 ||
      this.y - this.height > canvasHeight ||
      this.x < -60 ||
      this.x > canvasWidth + 60
    ) {
      this.active = false;
    }
  }

  // Static batch draw — call once with all projectiles to minimize ctx state changes
  static drawBatch(ctx: CanvasRenderingContext2D, projectiles: Projectile[]) {
    // Group by style for minimal state switching
    const byStyle: Record<ProjectileStyle, Projectile[]> = {
      normal: [], plasma: [], spread: [], side: [], rear: [],
    };
    for (const p of projectiles) {
      if (p.active) byStyle[p.style].push(p);
    }

    // Normal — gold pill
    if (byStyle.normal.length) {
      ctx.fillStyle = '#FFD700';
      for (const p of byStyle.normal) {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Plasma — magenta fat bolt
    if (byStyle.plasma.length) {
      ctx.fillStyle = '#FF44FF';
      for (const p of byStyle.plasma) {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Simple bright center
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 4, p.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Spread — orange
    if (byStyle.spread.length) {
      ctx.fillStyle = '#FF8800';
      for (const p of byStyle.spread) {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Side — teal
    if (byStyle.side.length) {
      ctx.fillStyle = '#00FFAA';
      for (const p of byStyle.side) {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Rear — red
    if (byStyle.rear.length) {
      ctx.fillStyle = '#FF3333';
      for (const p of byStyle.rear) {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Legacy single draw (kept for compatibility)
  draw(ctx: CanvasRenderingContext2D) {
    Projectile.drawBatch(ctx, [this]);
  }
}
