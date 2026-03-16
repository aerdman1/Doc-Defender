import { PLAYER } from '../constants';
import { PowerUpType } from '../types';
import { Projectile } from './Projectile';
import { InputManager } from '../InputManager';

// Cache of skin images keyed by src — loaded on demand, shared across instances
const skinCache = new Map<string, HTMLImageElement>();

function getSkinImg(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  if (!skinCache.has(src)) {
    const img = new Image();
    img.src = src;
    skinCache.set(src, img);
  }
  return skinCache.get(src)!;
}

/** Call early to start buffering a skin image before the game starts */
export function preloadSkin(src: string) {
  getSkinImg(src);
}

export class Player {
  x: number;
  y: number;
  readonly width = PLAYER.WIDTH * 2;   // render at 96px — Owlbert needs room
  readonly height = PLAYER.HEIGHT * 2;
  readonly speed = PLAYER.SPEED;
  lives: number = PLAYER.LIVES;
  skinSrc: string = '/owlbert.png';
  activeWeapons: Set<string> = new Set();

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

  tryShoot(now: number, godMode = false, normalFireRate?: number): boolean {
    const rate = godMode
      ? PLAYER.GOD_FIRE_RATE
      : this.activePowerUp === 'autoDocs'
        ? PLAYER.RAPID_FIRE_RATE
        : normalFireRate ?? PLAYER.FIRE_RATE;
    if (now - this.lastFired < rate) return false;
    this.lastFired = now;
    return true;
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

  /** Top-down walking owlbert for the bonus round */
  drawWalking(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y } = this;
    ctx.save();

    if (this.isInvincible(now) && Math.floor(now / 100) % 2 === 0) ctx.globalAlpha = 0.2;

    ctx.translate(x, y);

    const bob   = Math.sin(now * 0.008) * 2;
    const swing = Math.sin(now * 0.012);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 16 + bob, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cape (behind body, billowing)
    const capeFlap = Math.sin(now * 0.006) * 0.18;
    ctx.save();
    ctx.rotate(capeFlap);
    ctx.fillStyle = '#6B0F1A';
    ctx.beginPath();
    ctx.moveTo(-17, -2);
    ctx.bezierCurveTo(-28, 14, -14, 28, 0, 30);
    ctx.bezierCurveTo(14, 28, 28, 14, 17, -2);
    ctx.closePath();
    ctx.fill();
    // Cape highlight strip
    ctx.fillStyle = '#8B1A28';
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.bezierCurveTo(-10, 10, -4, 22, 0, 24);
    ctx.bezierCurveTo(4, 22, 10, 10, 8, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Feet (walking animation)
    ctx.fillStyle = '#BF7A20';
    // Left foot
    ctx.beginPath();
    ctx.ellipse(-9 + swing * 4, 18 + bob, 7, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Right foot
    ctx.beginPath();
    ctx.ellipse(9 - swing * 4, 18 + bob, 7, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Talons
    ctx.strokeStyle = '#8B5E10';
    ctx.lineWidth = 1.5;
    for (const [fx, fy, dir] of [[-9 + swing * 4, 20 + bob, -1], [9 - swing * 4, 20 + bob, 1]] as [number, number, number][]) {
      for (let t = -1; t <= 1; t++) {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + dir * (4 + t * 2), fy + 5);
        ctx.stroke();
      }
    }

    // Body (round, feathered, top-down)
    const bodyGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 23);
    bodyGrad.addColorStop(0, '#C4813A');
    bodyGrad.addColorStop(0.55, '#8B5A2B');
    bodyGrad.addColorStop(1, '#5C3A18');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();

    // Feather texture rings
    ctx.strokeStyle = 'rgba(60,30,10,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();

    // Belly patch
    ctx.fillStyle = '#E8C870';
    ctx.beginPath();
    ctx.ellipse(0, 7, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ear tufts (pointing upward = toward enemies)
    ctx.fillStyle = '#5C3A18';
    ctx.beginPath();
    ctx.moveTo(-15, -13); ctx.lineTo(-9, -32); ctx.lineTo(-3, -14); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, -14); ctx.lineTo(9, -32); ctx.lineTo(15, -13); ctx.closePath(); ctx.fill();
    // Tuft highlight
    ctx.fillStyle = '#7A4D20';
    ctx.beginPath();
    ctx.moveTo(-12, -15); ctx.lineTo(-9, -29); ctx.lineTo(-6, -15); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -15); ctx.lineTo(9, -29); ctx.lineTo(12, -15); ctx.closePath(); ctx.fill();

    // Eyes (large, facing up toward enemies)
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(-8, -6, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -6, 7.5, 0, Math.PI * 2); ctx.fill();
    // Eye rings
    ctx.strokeStyle = '#CC9900'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-8, -6, 7.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(8, -6, 7.5, 0, Math.PI * 2); ctx.stroke();
    // Pupils
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-8, -7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -7, 4, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(-5.5, -9, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10.5, -9, 1.8, 0, Math.PI * 2); ctx.fill();

    // Beak
    ctx.fillStyle = '#E8A830';
    ctx.beginPath();
    ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#C08020'; ctx.lineWidth = 0.8; ctx.stroke();

    // Wings (holding blaster on right)
    ctx.fillStyle = '#7A4D20';
    ctx.beginPath(); ctx.ellipse(-22, 2, 9, 6, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, 0, 9, 6, 0.4, 0, Math.PI * 2); ctx.fill();

    // Blaster (right wing, pointing up)
    ctx.fillStyle = '#333';
    ctx.fillRect(16, -26, 7, 22);   // barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(13, -6, 13, 9);    // grip block
    ctx.fillStyle = '#222';
    ctx.fillRect(15, -4, 9, 5);     // detail
    // Muzzle glow
    const muzzlePulse = 0.6 + Math.sin(now * 0.02) * 0.4;
    ctx.fillStyle = `rgba(100,220,255,${0.7 * muzzlePulse})`;
    ctx.beginPath();
    ctx.arc(19.5, -27, 4 * muzzlePulse, 0, Math.PI * 2);
    ctx.fill();

    // Shield ring
    if (this.hasShield) {
      const pulse = 0.75 + Math.sin(now * 0.006) * 0.25;
      ctx.strokeStyle = `rgba(80,200,255,${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00AAFF';
      ctx.shadowBlur = 22 * pulse;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
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
    const skinImg = getSkinImg(this.skinSrc);
    if (skinImg && skinImg.complete && skinImg.naturalWidth > 0) {
      // Gentle hover bob
      const bob = Math.sin(now * 0.003) * 3;
      ctx.drawImage(skinImg, x - W / 2, y - H / 2 + bob, W, H);
    } else {
      // Fallback circle if image hasn't loaded yet
      ctx.fillStyle = '#8B5E3C';
      ctx.beginPath();
      ctx.arc(x, y, W / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weapon attachment modules (drawn over sprite so they look bolted on)
    this.drawWeaponModules(ctx, now);

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

  private drawWeaponModules(ctx: CanvasRenderingContext2D, now: number) {
    const { x, y } = this;
    const aw = this.activeWeapons;

    // ── Spread gun — two small orange angled barrels at front-left/right ────
    if (aw.has('spread')) {
      const pulse = 0.7 + Math.sin(now * 0.009) * 0.3;
      ctx.save();
      ctx.shadowColor = '#FF8800';
      ctx.shadowBlur = 8 * pulse;
      ctx.fillStyle = '#995500';
      // Left barrel
      ctx.save();
      ctx.translate(x - 22, y - 30);
      ctx.rotate(-0.32);
      ctx.fillRect(-3, -10, 6, 18);
      ctx.restore();
      // Right barrel
      ctx.save();
      ctx.translate(x + 22, y - 30);
      ctx.rotate(0.32);
      ctx.fillRect(-3, -10, 6, 18);
      ctx.restore();
      // Muzzle glows
      ctx.fillStyle = `rgba(255, 140, 0, ${0.85 * pulse})`;
      ctx.beginPath(); ctx.arc(x - 22 + Math.sin(-0.32) * 10, y - 30 - Math.cos(0.32) * 10, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 22 + Math.sin(0.32)  * 10, y - 30 - Math.cos(0.32) * 10, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Side cannons — teal gun pods on the wing tips ────────────────────────
    if (aw.has('side')) {
      const pulse = 0.6 + Math.sin(now * 0.007 + 1) * 0.4;
      ctx.save();
      ctx.shadowColor = '#00FFAA';
      ctx.shadowBlur = 10 * pulse;
      for (const side of [-1, 1]) {
        const px = x + side * 52;
        const py = y - 6;
        // Pod body
        ctx.fillStyle = '#007755';
        ctx.beginPath(); ctx.ellipse(px, py, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        // Pod detail stripe
        ctx.fillStyle = '#004433';
        ctx.beginPath(); ctx.ellipse(px, py, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        // Barrel extending outward
        ctx.fillStyle = '#00AA77';
        ctx.fillRect(px + side * 12, py - 3, side * 8, 6);
        // Muzzle glow
        ctx.fillStyle = `rgba(0, 255, 170, ${0.75 * pulse})`;
        ctx.beginPath(); ctx.arc(px + side * 21, py, 4.5 * pulse, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Plasma cannon — magenta charged emitter at the ship nose ─────────────
    if (aw.has('plasma')) {
      const pulse = 0.6 + Math.sin(now * 0.011) * 0.4;
      const ny = y - 44;
      ctx.save();
      ctx.shadowColor = '#FF44FF';
      ctx.shadowBlur = 20 * pulse;
      // Mounting ring
      ctx.strokeStyle = '#AA00AA';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, ny, 8, 0, Math.PI * 2); ctx.stroke();
      // Glowing core
      const g = ctx.createRadialGradient(x, ny, 0, x, ny, 9);
      g.addColorStop(0,   `rgba(255, 220, 255, ${pulse})`);
      g.addColorStop(0.5, `rgba(255,  50, 255, ${0.9 * pulse})`);
      g.addColorStop(1,   `rgba(160,   0, 160, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, ny, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Rear launcher — red barrel below ship ────────────────────────────────
    if (aw.has('rear')) {
      const pulse = 0.5 + Math.sin(now * 0.013 + 2) * 0.5;
      const ry = y + 42;
      ctx.save();
      ctx.shadowColor = '#FF3333';
      ctx.shadowBlur = 10 * pulse;
      // Barrel housing
      ctx.fillStyle = '#771111';
      ctx.fillRect(x - 6, ry, 12, 14);
      // Top flange
      ctx.fillStyle = '#993333';
      ctx.fillRect(x - 8, ry, 16, 5);
      // Muzzle glow
      ctx.fillStyle = `rgba(255, 60, 60, ${0.85 * pulse})`;
      ctx.beginPath(); ctx.arc(x, ry + 15, 5 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}
