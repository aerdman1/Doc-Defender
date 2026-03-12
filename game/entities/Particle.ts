import { PARTICLES } from '../constants';

interface Slot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;   // 1 → 0
  decay: number;  // life units lost per second
  size: number;
  color: string;
  gravity: number;
  active: boolean;
}

export class ParticleSystem {
  private pool: Slot[];

  constructor() {
    this.pool = Array.from({ length: PARTICLES.POOL_SIZE }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 1,
      size: 3, color: '#fff', gravity: 0, active: false,
    }));
  }

  private spawn(data: Partial<Slot>) {
    const slot = this.pool.find(p => !p.active);
    if (!slot) return;
    Object.assign(slot, { active: true, life: 1, ...data });
  }

  emitExplosion(x: number, y: number, color: string, count: number = PARTICLES.EXPLOSION_COUNT) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 190;
      this.spawn({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        decay: 1.3 + Math.random() * 0.9,
        size: 2 + Math.random() * 4,
        color,
        gravity: 75,
      });
    }
  }

  emitSparks(x: number, y: number, color: string) {
    for (let i = 0; i < PARTICLES.SPARK_COUNT; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 35 + Math.random() * 90;
      this.spawn({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        decay: 3.5 + Math.random(),
        size: 1.5 + Math.random() * 2,
        color,
        gravity: 0,
      });
    }
  }

  emitPowerUpCollect(x: number, y: number, color: string) {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const speed = 45 + Math.random() * 110;
      this.spawn({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        decay: 1.4,
        size: 3 + Math.random() * 3,
        color,
        gravity: 0,
      });
    }
  }

  emitFeathers(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      this.spawn({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        decay: 1.0,
        size: 3 + Math.random() * 3,
        color: '#D4A620',
        gravity: 65,
      });
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) p.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.pool) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
