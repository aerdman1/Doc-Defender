'use client';

import { useEffect, useRef } from 'react';

// ─── Timeline (ms) ─────────────────────────────────────────────────────────────
const O = {
  FLASH_END:    700,   // Blue restoration flash
  PURGE_END:   2500,   // Bugs explode and vanish
  HEAL_END:    3900,   // Cracks shift blue → dissolve
  CLEAR_END:   5100,   // "SYSTEM RESTORED" banner + clean transition
  TITLE_START: 5300,   // Brief beat
  TITLE_HOLD:  7600,   // Title card hold
};
const TOTAL = O.TITLE_HOLD;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function inv(start: number, end: number, t: number) { return clamp01((t - start) / (end - start)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

// ─── Pixel bug sprite (mirrors IntroSequence) ─────────────────────────────────
function drawBug(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  s: number, color: string,
  now: number,
) {
  const leg = Math.sin(now * 9) * s * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(x - s,        y - s * 0.45, s * 2,    s);
  ctx.fillRect(x - s * 0.5,  y - s * 1.05, s,        s * 0.6);
  ctx.fillRect(x - s * 1.7,  y - s * 0.2 - leg, s * 0.55, s * 0.25);
  ctx.fillRect(x - s * 1.7,  y + s * 0.1 + leg, s * 0.55, s * 0.25);
  ctx.fillRect(x + s * 1.1,  y - s * 0.2 + leg, s * 0.55, s * 0.25);
  ctx.fillRect(x + s * 1.1,  y + s * 0.1 - leg, s * 0.55, s * 0.25);
  ctx.fillRect(x - s * 0.4,  y - s * 1.65, s * 0.18, s * 0.65);
  ctx.fillRect(x + s * 0.22, y - s * 1.65, s * 0.18, s * 0.65);
  ctx.fillStyle = '#FF2200';
  ctx.fillRect(x - s * 0.42, y - s * 0.92, s * 0.23, s * 0.23);
  ctx.fillRect(x + s * 0.18, y - s * 0.92, s * 0.23, s * 0.23);
}

// ─── Crack path generator (same as IntroSequence for visual continuity) ────────
function makeCrack(startX: number, startY: number, angle: number, len: number, segs: number) {
  const pts: [number, number][] = [[startX, startY]];
  let a = angle, x = startX, y = startY;
  for (let i = 0; i < segs; i++) {
    a += (Math.random() - 0.5) * 0.7;
    const step = len / segs;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
    if (Math.random() < 0.3) {
      const ba = a + (Math.random() > 0.5 ? 0.6 : -0.6);
      const blen = step * (2 + Math.random() * 2);
      const bx = x + Math.cos(ba) * blen;
      const by = y + Math.sin(ba) * blen;
      pts.push([x, y], [bx, by], [x, y]);
    }
  }
  return pts;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OutroSequence({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    // ── One-time data setup ───────────────────────────────────────────────────
    const bugColors = ['#22CC44', '#FF4422', '#0088FF', '#FF00FF', '#FFCC00'];
    interface Bug { x: number; y: number; vx: number; vy: number; s: number; color: string; dead: boolean; }
    const bugs: Bug[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.85 + h * 0.05,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
      s: 5 + Math.random() * 8,
      color: bugColors[Math.floor(Math.random() * 5)],
      dead: false,
    }));

    // Same crack geometry as intro for visual continuity
    const cracks = [
      makeCrack(w * 0.18, 0,      Math.PI * 0.55, h * 0.7, 12),
      makeCrack(w,        h * 0.28, Math.PI * 1.15, w * 0.6, 10),
      makeCrack(w * 0.55, 0,      Math.PI * 0.6,  h * 0.5, 9),
      makeCrack(0,        h * 0.6,  0,             w * 0.4, 8),
      makeCrack(w * 0.8,  h,      Math.PI * 1.7,  h * 0.4, 8),
    ];

    // Same ghost API endpoints + pages as intro
    const ghostEps = [
      { x: w*0.05,  y: h*0.13, method: 'GET',    color: '#22C55E', lw: [110, 150,  80] as [number,number,number] },
      { x: w*0.82,  y: h*0.19, method: 'POST',   color: '#3B82F6', lw: [ 90, 130, 110] as [number,number,number] },
      { x: w*0.09,  y: h*0.68, method: 'DELETE', color: '#EF4444', lw: [ 80, 120,  70] as [number,number,number] },
      { x: w*0.79,  y: h*0.63, method: 'PUT',    color: '#F59E0B', lw: [100, 110,  85] as [number,number,number] },
      { x: w*0.03,  y: h*0.41, method: 'PATCH',  color: '#8B5CF6', lw: [ 70, 100,  90] as [number,number,number] },
      { x: w*0.86,  y: h*0.45, method: '404',    color: '#22C55E', lw: [ 60,  90,  65] as [number,number,number] }, // 404 is now green — fixed!
    ];
    const ghostPgs = [
      { x: w*0.68, y: h*0.30, w: 190, h: 155 },
      { x: w*0.02, y: h*0.20, w: 155, h: 115 },
      { x: w*0.74, y: h*0.64, w: 140, h: 100 },
    ];

    // Live particle pool
    interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; }
    const particles: Particle[] = [];

    // ── Animation state ───────────────────────────────────────────────────────
    let done = false;
    let raf  = 0;
    const start  = performance.now();
    let prevTs   = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      onComplete();
    };

    const skip = (e: KeyboardEvent) => { if (e.type === 'keydown') finish(); };
    window.addEventListener('keydown', skip);

    // ── Main animation loop ───────────────────────────────────────────────────
    const animate = (ts: number) => {
      if (done) return;
      const dt = Math.min((ts - prevTs) / 1000, 0.05);
      prevTs = ts;
      const elapsed = ts - start;
      const t  = Math.min(elapsed, TOTAL);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Phase scalars
      const flashI  = inv(0,            O.FLASH_END,   t);
      const purgeI  = inv(O.FLASH_END,  O.PURGE_END,   t);
      const healI   = inv(O.PURGE_END,  O.HEAL_END,    t);
      const clearI  = inv(O.HEAL_END,   O.CLEAR_END,   t);
      const titleI  = inv(O.TITLE_START, O.TITLE_HOLD, t);

      // ── Background: red-corrupted → dark clean blue ──────────────────────
      const redness = clamp01(1 - flashI * 0.5 - purgeI * 0.5);
      const blueness = clamp01(healI * 0.6 + clearI * 0.4);
      const bgR = Math.floor(lerp(5  + redness * 30, 5,  blueness));
      const bgG = Math.floor(lerp(2  + redness * 5,  5,  blueness));
      const bgB = Math.floor(lerp(10 + redness * 5,  22, blueness));
      ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
      ctx.fillRect(0, 0, w, h);

      // Residual red tint that burns off during purge
      if (redness > 0) {
        ctx.fillStyle = `rgba(120,0,0,${redness * 0.35})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── RESTORATION FLASH: bright white → electric blue ──────────────────
      if (t < O.FLASH_END) {
        // White peak at ~12%, then sweeps to blue
        const peak    = flashI < 0.12 ? flashI / 0.12 : clamp01(1 - (flashI - 0.12) / 0.88);
        const blueSwp = clamp01((flashI - 0.25) / 0.75);
        ctx.fillStyle = `rgba(255,255,255,${peak * 0.88})`;
        ctx.fillRect(0, 0, w, h);
        if (blueSwp > 0) {
          ctx.fillStyle = `rgba(20,140,255,${blueSwp * 0.45})`;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // ── HEALTHY SCANLINES (subtle, appear as screen clears) ──────────────
      if (clearI > 0.2) {
        ctx.fillStyle = `rgba(0,60,180,${clamp01((clearI - 0.2) / 0.8) * 0.04})`;
        for (let ly = 0; ly < h; ly += 3) ctx.fillRect(0, ly, w, 1);
      }

      // ── BUG PURGE ─────────────────────────────────────────────────────────
      // Bugs visible from start of purge, explode one by one as purgeI rises
      if (purgeI > 0 && t < O.HEAL_END) {
        for (let i = 0; i < bugs.length; i++) {
          const b = bugs[i];
          if (b.dead) continue;

          // Each bug dies when purgeI crosses its kill threshold
          const killAt = (i + 1) / bugs.length;
          if (purgeI >= killAt) {
            b.dead = true;
            // Explosion particles
            const pCols = [b.color, '#FFFFFF', '#00FFFF', '#44FF88', '#FFFF44'];
            for (let p = 0; p < 14; p++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 100 + Math.random() * 240;
              particles.push({
                x: b.x, y: b.y,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
                life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
                color: pCols[Math.floor(Math.random() * pCols.length)],
                size: 2 + Math.random() * 5,
              });
            }
            // Bright flash ring
            particles.push({
              x: b.x, y: b.y, vx: 0, vy: 0,
              life: 0.18, maxLife: 0.18,
              color: '#FFFFFF', size: b.s * 4,
            });
            continue;
          }

          // Living bug: wander + jitter harder as purge intensifies
          b.x += b.vx * dt + (Math.random() - 0.5) * purgeI * 6;
          b.y += b.vy * dt + (Math.random() - 0.5) * purgeI * 6;
          b.x = Math.max(0, Math.min(w, b.x));
          b.y = Math.max(0, Math.min(h, b.y));

          // Flash white as kill threshold approaches
          const proximity = clamp01((purgeI - (killAt - 1 / bugs.length)) * bugs.length);
          const col = proximity > 0.65 ? '#FFFFFF' : b.color;
          const scale = 1 + proximity * 0.6;

          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.scale(scale, scale);
          drawBug(ctx, 0, 0, b.s, col, t * 0.001);
          ctx.restore();
        }
      }

      // ── PARTICLES (bug explosions + any other fx) ─────────────────────────
      let pi = 0;
      while (pi < particles.length) {
        const p = particles[pi];
        p.x   += p.vx * dt;
        p.y   += p.vy * dt;
        p.vy  += 180 * dt; // gentle gravity
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(pi, 1);
          continue;
        }
        const alpha = clamp01(p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
        pi++;
      }

      // ── CRACK HEALING ─────────────────────────────────────────────────────
      // Cracks appear at the start (echo of intro), shift red→blue, then dissolve
      if (purgeI > 0.2 || healI > 0) {
        const crackAppear = clamp01((purgeI - 0.2) / 0.4);
        const crackFade   = clamp01(healI * 1.8); // fades out during heal
        const visible     = crackAppear * (1 - crackFade);
        if (visible > 0.01) {
          // Color shifts red → cyan → gone
          const redC  = Math.floor(lerp(220, 20,  healI));
          const grnC  = Math.floor(lerp(20,  200, healI));
          const bluC  = Math.floor(lerp(20,  255, healI));

          for (const pts of cracks) {
            // Core crack line
            ctx.save();
            ctx.strokeStyle = `rgba(${redC},${grnC},${bluC},${visible * 0.75})`;
            ctx.lineWidth   = 1.2;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let pi2 = 1; pi2 < pts.length; pi2++) ctx.lineTo(pts[pi2][0], pts[pi2][1]);
            ctx.stroke();
            // Glow halo (healing beam)
            ctx.strokeStyle = `rgba(${redC},${grnC},${bluC},${visible * 0.22})`;
            ctx.lineWidth   = 5 + healI * 4;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let pi2 = 1; pi2 < pts.length; pi2++) ctx.lineTo(pts[pi2][0], pts[pi2][1]);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // ── RESTORATION CONSOLE TEXT ──────────────────────────────────────────
      if (purgeI > 0.4 && clearI < 0.9) {
        const textA = clamp01((purgeI - 0.4) / 0.4) * clamp01(1 - clearI * 2.5);
        const lines = [
          '> VIRUS_SWARM.exe  ::  TERMINATED',
          '> DOC_CORRUPTION   ::  REVERSED',
          '> PORTAL_INTEGRITY ::  RESTORED',
          '> STATUS           ::  NORMAL',
        ];
        ctx.font          = 'bold 13px monospace';
        ctx.textAlign     = 'left';
        ctx.textBaseline  = 'bottom';
        lines.forEach((line, i) => {
          const y2 = h - 8 - i * 18;
          ctx.fillStyle = `rgba(0,0,0,${textA * 0.55})`;
          ctx.fillText(line, 21, y2 + 1);
          // Last line is green, others are a dimmer green
          const g = i === 3 ? 255 : 190;
          const b2 = i === 3 ? 120 : 80;
          ctx.fillStyle = `rgba(30,${g},${b2},${textA * 0.95})`;
          ctx.fillText(line, 20, y2);
        });
      }

      // ── "SYSTEM RESTORED" BANNER ──────────────────────────────────────────
      if (clearI > 0.15 && clearI < 0.92) {
        const ba    = clamp01((clearI - 0.15) / 0.3);
        const fadeO = clamp01(1 - (clearI - 0.7) / 0.22);
        ctx.fillStyle = `rgba(0,50,200,${ba * fadeO * 0.72})`;
        ctx.fillRect(0, h / 2 - 44, w, 88);
        ctx.fillStyle   = '#FFFFFF';
        ctx.shadowColor = '#00AAFF';
        ctx.shadowBlur  = 14;
        ctx.font        = `bold ${Math.floor(w * 0.040)}px monospace`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦  SYSTEM RESTORED  ✦', w / 2, h / 2);
        ctx.shadowBlur = 0;
      }

      // ── TITLE CARD ────────────────────────────────────────────────────────
      if (t >= O.TITLE_START) {
        // Dark background slams in (mirrors intro)
        ctx.fillStyle = `rgba(5,5,16,${Math.min(1, titleI * 5)})`;
        ctx.fillRect(0, 0, w, h);

        const ta       = clamp01(titleI * 4);
        const fontSize = Math.min(96, Math.floor(w * 0.078));

        // ── Layer 1: Ghost "readme" logo watermark (same as intro) ──────────
        if (ta > 0) {
          ctx.save();
          ctx.globalAlpha = ta * 0.07;
          ctx.fillStyle   = '#1D4ED8';
          ctx.font        = `900 ${Math.floor(w * 0.23)}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.letterSpacing = '-0.02em';
          ctx.fillText('readme', w / 2, h * 0.46);
          ctx.letterSpacing = '0';
          ctx.restore();
        }

        // ── Layer 2: Healed cracks (ghost-blue, barely visible) ─────────────
        if (ta > 0) {
          ctx.save();
          ctx.globalAlpha = ta * 0.06;
          ctx.strokeStyle = '#4488FF';
          ctx.lineWidth   = 1;
          for (const pts of cracks) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let pi2 = 1; pi2 < pts.length; pi2++) ctx.lineTo(pts[pi2][0], pts[pi2][1]);
            ctx.stroke();
          }
          ctx.restore();
        }

        // ── Layer 3: Ghost API endpoints — healthy colors, brighter ─────────
        if (ta > 0.2) {
          const ghostA = clamp01((ta - 0.2) * 2.5) * 0.22;
          ctx.save();
          ctx.globalAlpha  = ghostA;
          ctx.textAlign    = 'left';
          ctx.textBaseline = 'middle';
          ctx.font         = 'bold 8px monospace';
          for (const ep of ghostEps) {
            ctx.fillStyle = ep.color;
            ctx.fillRect(ep.x, ep.y, 44, 18);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillText(ep.method, ep.x + 4, ep.y + 9);
            ctx.fillStyle = 'rgba(180,230,255,0.45)';
            ctx.fillRect(ep.x + 52, ep.y + 4, ep.lw[0], 10);
            ctx.fillStyle = 'rgba(150,210,255,0.30)';
            ctx.fillRect(ep.x, ep.y + 26, ep.lw[1], 7);
            ctx.fillRect(ep.x, ep.y + 38, ep.lw[2], 7);
            ctx.fillRect(ep.x, ep.y + 50, Math.floor(ep.lw[2] * 0.65), 7);
          }
          ctx.restore();
        }

        // ── Layer 4: Ghost docs pages — solid, healthy ───────────────────────
        if (ta > 0.15) {
          const pageA = clamp01((ta - 0.15) * 2.5) * 0.11;
          ctx.save();
          ctx.globalAlpha = pageA;
          for (const pg of ghostPgs) {
            ctx.strokeStyle = 'rgba(80,190,255,0.70)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(pg.x, pg.y, pg.w, pg.h);
            ctx.fillStyle = 'rgba(80,190,255,0.35)';
            ctx.fillRect(pg.x + 8, pg.y + 10, pg.w * 0.55, 9);
            ctx.fillStyle = 'rgba(100,200,255,0.25)';
            for (let ly = pg.y + 28; ly < pg.y + pg.h - 8; ly += 13) {
              const lw2 = pg.w * 0.88 * (0.52 + 0.44 * Math.abs(Math.sin(ly * 0.19)));
              ctx.fillRect(pg.x + 8, ly, lw2, 6);
            }
          }
          ctx.restore();
        }

        // ── Layer 5: Vignette ────────────────────────────────────────────────
        if (ta > 0) {
          const vg = ctx.createRadialGradient(w / 2, h * 0.40, h * 0.10, w / 2, h / 2, h * 0.72);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(1, `rgba(0,0,20,${ta * 0.60})`);
          ctx.fillStyle = vg;
          ctx.fillRect(0, 0, w, h);
        }

        // ── Layer 6: Main title block ─────────────────────────────────────────
        const titleCenterY = h * 0.385;
        const scale = lerp(1.18, 1.0, clamp01(titleI * 5));

        ctx.save();
        ctx.globalAlpha  = ta;
        ctx.translate(w / 2, titleCenterY);
        ctx.scale(scale, scale);

        // Eyebrow — restoration colour (cyan instead of amber)
        ctx.font         = `${Math.max(10, Math.floor(w * 0.010))}px monospace`;
        ctx.fillStyle    = 'rgba(80,200,255,0.90)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.35em';
        ctx.fillText('A  README  EXPERIENCE', 0, -fontSize * 0.73);
        ctx.letterSpacing = '0';

        // Thin line above title
        ctx.strokeStyle = 'rgba(60,180,255,0.22)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(-fontSize * 2.15, -fontSize * 0.55);
        ctx.lineTo( fontSize * 2.15, -fontSize * 0.55);
        ctx.stroke();

        // "DOCS DEFENDER" — same weight/size as intro, now with cyan glow
        ctx.shadowColor    = '#00C8FF';
        ctx.shadowBlur     = 55;
        ctx.fillStyle      = '#E8F6FF';
        ctx.font           = `900 ${fontSize}px monospace`;
        ctx.textAlign      = 'center';
        ctx.textBaseline   = 'middle';
        ctx.letterSpacing  = '0.12em';
        ctx.fillText('DOCS DEFENDER', 0, 0);
        ctx.shadowBlur     = 0;
        ctx.letterSpacing  = '0';

        // Separator line below title
        ctx.strokeStyle = 'rgba(0,200,255,0.30)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(-fontSize * 2.2, fontSize * 0.53);
        ctx.lineTo( fontSize * 2.2, fontSize * 0.53);
        ctx.stroke();

        // Subtitle — victory version (mirrors intro layout exactly)
        ctx.font         = `${Math.max(14, Math.floor(w * 0.016))}px monospace`;
        ctx.fillStyle    = 'rgba(80,255,170,0.92)';
        ctx.shadowColor  = '#00FF99';
        ctx.shadowBlur   = 12;
        ctx.fillText('Docs Restored  ·  Chaos Defeated', 0, fontSize * 0.77);
        ctx.shadowBlur   = 0;

        // Status line — fades in slightly after title settles (mirrors intro lore line)
        if (titleI > 0.45) {
          const statsA = clamp01((titleI - 0.45) * 5);
          ctx.save();
          ctx.globalAlpha  = ta * statsA * 0.80;
          ctx.font         = `${Math.max(9, Math.floor(w * 0.0088))}px monospace`;
          ctx.fillStyle    = 'rgba(100,255,160,0.90)';
          ctx.letterSpacing = '0.14em';
          ctx.fillText('DEPLOY  SUCCESSFUL  ✓    PORTAL  RESTORED  ✓    BUILD  STABILIZED  ✓', 0, fontSize * 1.12);
          ctx.letterSpacing = '0';
          ctx.restore();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // ── DONE ──────────────────────────────────────────────────────────────
      if (t >= TOTAL) {
        finish();
        return;
      }
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', skip);
    };
  }, [onComplete]);

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 200, background: '#050510', cursor: 'default' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        className="absolute inset-0 flex items-end justify-center pointer-events-none"
        style={{ paddingBottom: '28px' }}
      >
        <p className="text-white/20 font-mono text-xs tracking-widest">
          PRESS ANY KEY TO SKIP
        </p>
      </div>
    </div>
  );
}
