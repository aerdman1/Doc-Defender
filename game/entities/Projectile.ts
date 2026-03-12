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
    style: ProjectileStyle = 'normal'
  ) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angleRad) * speed;
    this.vy = Math.sin(angleRad) * speed;
    this.damage = damage;
    this.style = style;

    if (style === 'plasma') {
      this.width = 14;
      this.height = 28;
    } else if (style === 'spread' || style === 'side') {
      this.width = 5;
      this.height = 14;
    } else if (style === 'rear') {
      this.width = 5;
      this.height = 14;
    } else {
      this.width = PROJECTILE.WIDTH;
      this.height = PROJECTILE.HEIGHT;
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

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height, style } = this;

    // Rotate to travel direction
    const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (style === 'plasma') {
      ctx.shadowColor = '#FF44FF';
      ctx.shadowBlur = 18;
      const g = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      g.addColorStop(0, 'rgba(255, 50, 255, 0)');
      g.addColorStop(0.4, '#FF44FF');
      g.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'side') {
      ctx.shadowColor = '#00FFAA';
      ctx.shadowBlur = 10;
      const g = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      g.addColorStop(0, 'rgba(0, 255, 170, 0)');
      g.addColorStop(0.5, '#00FFAA');
      g.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'spread') {
      ctx.shadowColor = '#FF8800';
      ctx.shadowBlur = 8;
      const g = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      g.addColorStop(0, 'rgba(255, 136, 0, 0)');
      g.addColorStop(0.5, '#FF8800');
      g.addColorStop(1, '#FFEEAA');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'rear') {
      ctx.shadowColor = '#FF3333';
      ctx.shadowBlur = 8;
      const g = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      g.addColorStop(0, 'rgba(255, 50, 50, 0)');
      g.addColorStop(0.5, '#FF3333');
      g.addColorStop(1, '#FFAAAA');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal gold shot
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 10;
      const g = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      g.addColorStop(0, 'rgba(255, 180, 0, 0)');
      g.addColorStop(0.35, '#FFD700');
      g.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
