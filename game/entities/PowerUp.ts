import { PowerUpType } from '../types';
import { POWERUP } from '../constants';

export class PowerUp {
  x: number;
  y: number;
  readonly width = POWERUP.WIDTH;
  readonly height = POWERUP.HEIGHT;
  readonly type: PowerUpType;
  active = true;
  private bobTime: number;

  get color(): string { return POWERUP[this.type].color; }
  get icon(): string { return POWERUP[this.type].icon; }

  constructor(x: number, type: PowerUpType) {
    this.x = x;
    this.y = -20;
    this.type = type;
    this.bobTime = Math.random() * Math.PI * 2;
  }

  update(dt: number) {
    this.bobTime += dt * 3.2;
    this.y += POWERUP.FALL_SPEED * dt;
  }

  isOffscreen(canvasHeight: number): boolean {
    return this.y > canvasHeight + 30;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y } = this;
    const r = this.width / 2;
    const pulse = 0.82 + Math.sin(this.bobTime) * 0.18;
    const bobY = y + Math.sin(this.bobTime * 0.6) * 3;

    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 22 * pulse;

    ctx.fillStyle = 'rgba(5, 5, 20, 0.8)';
    ctx.beginPath();
    ctx.arc(x, bobY, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, bobY, r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.font = `${Math.floor(r * 1.15)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, x, bobY + 1);

    ctx.restore();
  }
}

const ALL_TYPES: PowerUpType[] = ['autoDocs', 'versionShield', 'deployBurst', 'knowledgeCore'];

export function createPowerUp(x: number): PowerUp {
  const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
  return new PowerUp(x, type);
}
