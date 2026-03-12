import { PLAYER } from '../constants';
import { PowerUpType } from '../types';
import { Projectile } from './Projectile';
import { InputManager } from '../InputManager';

// Preload Owlbert sprite once, shared across instances
const owlbertImg = typeof window !== 'undefined' ? (() => {
  const img = new Image();
  img.src = '/owlbert.png';
  return img;
})() : null;

export class Player {
  x: number;
  y: number;
  readonly width = PLAYER.WIDTH * 2;   // render at 96px — Owlbert needs room
  readonly height = PLAYER.HEIGHT * 2;
  readonly speed = PLAYER.SPEED;
  lives: number = PLAYER.LIVES;

  invincibleUntil = 0;
  lastFired = 0;

  activePowerUp: PowerUpType | null = null;
  powerUpExpiresAt = 0;
  hasShield = false;

  // (no wing animation needed — Owlbert sprite handles visuals)

  constructor(canvasWidth: number, canvasHeight: number) {
    this.x = canvasWidth / 2;
    this.y = canvasHeight - PLAYER.START_Y_OFFSET;
  }

  update(dt: number, input: InputManager, canvasWidth: number, canvasHeight: number, now: number) {
    const left  = input.isDown('ArrowLeft')  || input.isDown('a') || input.isDown('A');
    const right = input.isDown('ArrowRight') || input.isDown('d') || input.isDown('D');
    const up    = input.isDown('ArrowUp')    || input.isDown('w') || input.isDown('W');
    const down  = input.isDown('ArrowDown')  || input.isDown('s') || input.isDown('S');
    const sprint = input.isDown('Shift');
    const moveSpeed = sprint ? PLAYER.SPRINT_SPEED : this.speed;

    if (left)  this.x -= moveSpeed * dt;
    if (right) this.x += moveSpeed * dt;
    if (up)    this.y -= moveSpeed * dt;
    if (down)  this.y += moveSpeed * dt;

    const hw = this.width / 2;
    const hh = this.height / 2;
    this.x = Math.max(hw, Math.min(canvasWidth - hw, this.x));
    this.y = Math.max(hh, Math.min(canvasHeight - hh, this.y));

    // Check power-up expiry
    if (this.activePowerUp && this.powerUpExpiresAt > 0 && now >= this.powerUpExpiresAt) {
      this.activePowerUp = null;
      this.powerUpExpiresAt = 0;
    }
  }

  tryShoot(now: number, godMode = false): Projectile | null {
    const rate = godMode
      ? PLAYER.GOD_FIRE_RATE
      : this.activePowerUp === 'autoDocs'
        ? PLAYER.RAPID_FIRE_RATE
        : PLAYER.FIRE_RATE;
    if (now - this.lastFired < rate) return null;
    this.lastFired = now;
    return new Projectile(this.x, this.y - this.height / 2 + 2);
  }

  activatePowerUp(type: PowerUpType, now: number) {
    this.activePowerUp = type;
    if (type === 'versionShield') {
      this.hasShield = true;
      this.powerUpExpiresAt = -1;
    } else if (type === 'autoDocs') {
      this.powerUpExpiresAt = now + 8000;
    }
  }

  isInvincible(now: number): boolean {
    return now < this.invincibleUntil;
  }

  // Returns true if a life was actually lost
  takeDamage(now: number): boolean {
    if (this.isInvincible(now)) return false;

    if (this.hasShield) {
      this.hasShield = false;
      this.activePowerUp = null;
      this.powerUpExpiresAt = 0;
      this.invincibleUntil = now + 800;
      return false;
    }

    this.lives--;
    this.invincibleUntil = now + PLAYER.INVINCIBILITY_MS;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y, width: W, height: H } = this;
    ctx.save();

    // Blink when invincible
    if (this.isInvincible(now) && Math.floor(now / 100) % 2 === 0) {
      ctx.globalAlpha = 0.2;
    }

    // Jet thruster glow beneath Owlbert (matches his in-image jets)
    const thrustY = y + H * 0.48;
    const flicker = 0.6 + Math.sin(now * 0.025) * 0.4;

    // Left thruster
    const ltg = ctx.createRadialGradient(x - W * 0.3, thrustY, 2, x - W * 0.3, thrustY, W * 0.28);
    ltg.addColorStop(0, `rgba(100, 220, 255, ${0.9 * flicker})`);
    ltg.addColorStop(1, 'rgba(0, 80, 255, 0)');
    ctx.fillStyle = ltg;
    ctx.beginPath();
    ctx.ellipse(x - W * 0.3, thrustY, W * 0.12, H * 0.2 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right thruster
    const rtg = ctx.createRadialGradient(x + W * 0.3, thrustY, 2, x + W * 0.3, thrustY, W * 0.28);
    rtg.addColorStop(0, `rgba(100, 220, 255, ${0.9 * flicker})`);
    rtg.addColorStop(1, 'rgba(0, 80, 255, 0)');
    ctx.fillStyle = rtg;
    ctx.beginPath();
    ctx.ellipse(x + W * 0.3, thrustY, W * 0.12, H * 0.2 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Owlbert sprite (centered on x, y)
    if (owlbertImg && owlbertImg.complete && owlbertImg.naturalWidth > 0) {
      // Gentle hover bob
      const bob = Math.sin(now * 0.003) * 3;
      ctx.drawImage(owlbertImg, x - W / 2, y - H / 2 + bob, W, H);
    } else {
      // Fallback circle if image hasn't loaded yet
      ctx.fillStyle = '#8B5E3C';
      ctx.beginPath();
      ctx.arc(x, y, W / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield ring
    if (this.hasShield) {
      const pulse = 0.75 + Math.sin(now * 0.006) * 0.25;
      ctx.strokeStyle = `rgba(80, 200, 255, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00AAFF';
      ctx.shadowBlur = 22 * pulse;
      ctx.beginPath();
      ctx.arc(x, y, W * 0.58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
