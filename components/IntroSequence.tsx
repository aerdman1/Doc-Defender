'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Timeline (ms) ────────────────────────────────────────────────────────────
const T = {
  FADEIN_END:    600,
  CLEAN_END:    1700,
  GLITCH_END:   2900,
  CORRUPT_END:  4600,
  CRITICAL_END: 5500,
  FLASH_END:    6100,
  TITLE_START:  6200,
  TITLE_HOLD:   7600,
};
const TOTAL = T.TITLE_HOLD;

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function inv(start: number, end: number, t: number) { return clamp01((t - start) / (end - start)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

// ─── Pixel bug sprite ─────────────────────────────────────────────────────────
function drawBug(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  s: number, color: string,
  now: number,
) {
  const leg = Math.sin(now * 9) * s * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(x - s,       y - s * 0.45, s * 2,    s);
  ctx.fillRect(x - s * 0.5, y - s * 1.05, s,        s * 0.6);
  ctx.fillRect(x - s * 1.7, y - s * 0.2 - leg, s * 0.55, s * 0.25);
  ctx.fillRect(x - s * 1.7, y + s * 0.1 + leg, s * 0.55, s * 0.25);
  ctx.fillRect(x + s * 1.1, y - s * 0.2 + leg, s * 0.55, s * 0.25);
  ctx.fillRect(x + s * 1.1, y + s * 0.1 - leg, s * 0.55, s * 0.25);
  ctx.fillRect(x - s * 0.4, y - s * 1.65, s * 0.18, s * 0.65);
  ctx.fillRect(x + s * 0.22,y - s * 1.65, s * 0.18, s * 0.65);
  ctx.fillStyle = '#FF2200';
  ctx.fillRect(x - s * 0.42, y - s * 0.92, s * 0.23, s * 0.23);
  ctx.fillRect(x + s * 0.18, y - s * 0.92, s * 0.23, s * 0.23);
}

interface Bug { x: number; y: number; vx: number; vy: number; s: number; color: string; }

// ─── Crack path generator ─────────────────────────────────────────────────────
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

// Ghost element types
interface GhostEp   { x: number; y: number; method: string; color: string; lw: [number, number, number]; }
interface GhostPage { x: number; y: number; w: number; h: number; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const pageRef      = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);
  const startRef     = useRef<number>(0);
  const prevTsRef    = useRef<number>(0);
  const bugsRef      = useRef<Bug[]>([]);
  const cracksRef    = useRef<[number,number][][]>([]);
  const ghostEpsRef  = useRef<GhostEp[]>([]);
  const ghostPgsRef  = useRef<GhostPage[]>([]);
  const titleDoneRef = useRef(false);
  const [started, setStarted]       = useState(false);
  const [showButton, setShowButton] = useState(false);

  // ── One-time setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    // Bugs
    const bugColors = ['#22CC44','#FF4422','#0088FF','#FF00FF','#FFCC00'];
    bugsRef.current = Array.from({ length: 40 }, () => {
      const edge = Math.floor(Math.random() * 4);
      const spd  = 60 + Math.random() * 100;
      let x = 0, y = 0, vx = 0, vy = 0;
      if (edge === 0) { x = Math.random() * w; y = -24; vx = (Math.random()-.5)*50; vy =  spd; }
      else if (edge === 1) { x = w+24; y = Math.random()*h; vx = -spd; vy = (Math.random()-.5)*50; }
      else if (edge === 2) { x = Math.random()*w; y = h+24; vx = (Math.random()-.5)*50; vy = -spd; }
      else  { x = -24; y = Math.random()*h; vx =  spd; vy = (Math.random()-.5)*50; }
      return { x, y, vx, vy, s: 5 + Math.random()*8, color: bugColors[Math.floor(Math.random()*5)] };
    });

    // Cracks
    cracksRef.current = [
      makeCrack(w*0.18, 0,      Math.PI*0.55, h*0.7, 12),
      makeCrack(w,      h*0.28, Math.PI*1.15, w*0.6, 10),
      makeCrack(w*0.55, 0,      Math.PI*0.6,  h*0.5, 9),
      makeCrack(0,      h*0.6,  0,            w*0.4, 8),
      makeCrack(w*0.8,  h,      Math.PI*1.7,  h*0.4, 8),
    ];

    // Ghost API endpoint shapes — deterministic positions, no random on draw
    ghostEpsRef.current = [
      { x: w*0.05,  y: h*0.13, method: 'GET',    color: '#22C55E', lw: [110, 150,  80] },
      { x: w*0.82,  y: h*0.19, method: 'POST',   color: '#3B82F6', lw: [ 90, 130, 110] },
      { x: w*0.09,  y: h*0.68, method: 'DELETE', color: '#EF4444', lw: [ 80, 120,  70] },
      { x: w*0.79,  y: h*0.63, method: 'PUT',    color: '#F59E0B', lw: [100, 110,  85] },
      { x: w*0.03,  y: h*0.41, method: 'PATCH',  color: '#8B5CF6', lw: [ 70, 100,  90] },
      { x: w*0.86,  y: h*0.45, method: '404',    color: '#DC2626', lw: [ 60,  90,  65] },
    ];

    // Ghost docs page wireframes — subtle page-like outlines in corners
    ghostPgsRef.current = [
      { x: w*0.68, y: h*0.30, w: 190, h: 155 },
      { x: w*0.02, y: h*0.20, w: 155, h: 115 },
      { x: w*0.74, y: h*0.64, w: 140, h: 100 },
    ];
  }, []);

  // ── Animation ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    startRef.current = performance.now() - T.CLEAN_END;
    prevTsRef.current = performance.now();

    const skip = () => {
      if (titleDoneRef.current) return;
      cancelAnimationFrame(rafRef.current);
      onComplete();
    };
    window.addEventListener('keydown', skip);

    const animate = (ts: number) => {
      const dt = Math.min((ts - prevTsRef.current) / 1000, 0.05);
      prevTsRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed, TOTAL);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // ── Phase scalars ──────────────────────────────────────────────────────
      const fadeIn    = inv(0,             T.FADEIN_END,   t);
      const glitchI   = inv(T.CLEAN_END,  T.GLITCH_END,   t);
      const corruptI  = inv(T.GLITCH_END, T.CORRUPT_END,  t);
      const critI     = inv(T.CORRUPT_END,T.CRITICAL_END, t);
      const flashI    = inv(T.CRITICAL_END,T.FLASH_END,   t);
      const titleI    = inv(T.TITLE_START, T.TITLE_HOLD,  t);
      const intensity = glitchI*0.25 + corruptI*0.65 + critI*1.0;

      // ── Page CSS effects ───────────────────────────────────────────────────
      if (pageRef.current) {
        const sx = intensity > 0 ? (Math.random()-.5) * intensity * 22 : 0;
        const sy = intensity > 0 ? (Math.random()-.5) * intensity * 12 : 0;
        const hue = corruptI * 35 + critI * 80;
        const sat = 1 + corruptI * 0.6;
        const bri = t < T.CRITICAL_END
          ? 1
          : t < T.FLASH_END
          ? lerp(1, 8, flashI)
          : 0;
        pageRef.current.style.opacity = t < T.TITLE_START ? '1' : '0';
        pageRef.current.style.transform = `translate(${sx}px, ${sy}px)`;
        pageRef.current.style.filter =
          `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bri})`;
      }

      // ── Opening black fade-in ──────────────────────────────────────────────
      if (fadeIn < 1) {
        ctx.fillStyle = `rgba(5,5,16,${1 - fadeIn})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Scanlines ─────────────────────────────────────────────────────────
      if (glitchI > 0) {
        ctx.fillStyle = `rgba(0,0,0,${glitchI * 0.07 + corruptI * 0.06})`;
        for (let ly = 0; ly < h; ly += 3) ctx.fillRect(0, ly, w, 1);
      }

      // ── Chromatic aberration ───────────────────────────────────────────────
      if (corruptI > 0) {
        const off = corruptI * 14 + critI * 22;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255,0,0,${corruptI * 0.07})`;
        ctx.fillRect(-off, 0, w + off * 2, h);
        ctx.fillStyle = `rgba(0,0,255,${corruptI * 0.07})`;
        ctx.fillRect(off, 0, w + off * 2, h);
        ctx.restore();
      }

      // ── Glitch blocks ─────────────────────────────────────────────────────
      const numBlocks = Math.floor(glitchI*5 + corruptI*18 + critI*35);
      for (let i = 0; i < numBlocks; i++) {
        const bx = Math.random() * w;
        const by = Math.random() * h;
        const bw = 20 + Math.random() * (w * 0.22);
        const bh = 2 + Math.random() * 20;
        const r  = Math.random() < 0.5 ? 0 : 255;
        ctx.fillStyle = `rgba(${r},${Math.floor(Math.random()*80)},${Math.floor(Math.random()*255)},${0.12 + Math.random()*0.35})`;
        ctx.fillRect(bx, by, bw, bh);
      }

      // ── Horizontal tears ──────────────────────────────────────────────────
      if (corruptI > 0.2) {
        const tears = Math.floor((corruptI - 0.2) * 12);
        for (let i = 0; i < tears; i++) {
          const ty   = Math.random() * h;
          const th   = 4 + Math.random() * 14;
          const disp = (Math.random() - 0.5) * corruptI * 60;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, ty, w, th);
          ctx.clip();
          ctx.translate(disp, 0);
          ctx.fillStyle = `rgba(${Math.floor(Math.random()*80)},0,${Math.floor(Math.random()*200)},0.4)`;
          ctx.fillRect(-Math.abs(disp), ty, w + Math.abs(disp)*2, th);
          ctx.restore();
        }
      }

      // ── Pixel-art bugs ────────────────────────────────────────────────────
      if (glitchI > 0) {
        const numBugs = Math.floor(glitchI * 6 + corruptI * 24 + critI * 10);
        for (let i = 0; i < Math.min(numBugs, bugsRef.current.length); i++) {
          const b = bugsRef.current[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          drawBug(ctx, b.x, b.y, b.s, b.color, t * 0.001);
        }
      }

      // ── Crack lines ───────────────────────────────────────────────────────
      if (corruptI > 0.25) {
        const crackAlpha = (corruptI - 0.25) * 0.9 + critI * 0.8;
        const numCracks = Math.min(cracksRef.current.length,
          Math.floor((corruptI - 0.25) * 6 + critI * 5));
        for (let ci = 0; ci < numCracks; ci++) {
          const pts = cracksRef.current[ci];
          ctx.strokeStyle = `rgba(220,20,20,${crackAlpha})`;
          ctx.lineWidth = 1.2 + critI;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi][0], pts[pi][1]);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,80,80,${crackAlpha * 0.4})`;
          ctx.lineWidth = 3 + critI * 2;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi][0], pts[pi][1]);
          ctx.stroke();
        }
      }

      // ── Red corruption vignette ────────────────────────────────────────────
      if (corruptI > 0) {
        const vg = ctx.createRadialGradient(w/2, h/2, h*0.25, w/2, h/2, h*0.85);
        vg.addColorStop(0, 'rgba(180,0,0,0)');
        vg.addColorStop(1, `rgba(180,0,0,${corruptI * 0.45 + critI * 0.35})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Critical pixel noise ───────────────────────────────────────────────
      if (critI > 0) {
        const noise = critI * 2200;
        for (let i = 0; i < noise; i++) {
          const px = Math.random() * w;
          const py = Math.random() * h;
          const ps = Math.random() * 4 + 1;
          ctx.fillStyle = `rgba(${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${0.4 + Math.random() * 0.5})`;
          ctx.fillRect(px, py, ps, ps);
        }
      }

      // ── Error console text ─────────────────────────────────────────────────
      if (corruptI > 0.45) {
        const ea = clamp01((corruptI - 0.45) * 2.5) * (Math.sin(t * 0.018) * 0.25 + 0.75);
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const lines = [
          'CRITICAL_ERROR :: SYSTEM BREACH DETECTED',
          'VIRUS_SWARM.exe :: 127 instances running',
          'DOC_CORRUPTION :: readme.com/api [INFECTED]',
          'INITIATING DOCS DEFENDER PROTOCOL...',
        ];
        lines.forEach((line, i) => {
          const y2 = h - 8 - i * 18;
          ctx.fillStyle = `rgba(0,0,0,${ea * 0.6})`;
          ctx.fillText(line, 21, y2 + 1);
          ctx.fillStyle = `rgba(255,${i===3?220:60},${i===3?60:60},${ea * 0.9})`;
          ctx.fillText(line, 20, y2);
        });
      }

      // ── SYSTEM COMPROMISED banner ──────────────────────────────────────────
      if (critI > 0.1) {
        const ba = clamp01((critI - 0.1) * 2) * (Math.floor(t / 120) % 2 === 0 ? 1 : 0.4);
        ctx.fillStyle = `rgba(200,0,0,${ba * 0.88})`;
        ctx.fillRect(0, h/2 - 44, w, 88);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(w * 0.045)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠  SYSTEM COMPROMISED  ⚠', w/2, h/2);
      }

      // ── Explosion white flash ──────────────────────────────────────────────
      if (t >= T.CRITICAL_END && t < T.TITLE_START) {
        const flashPeak = flashI < 0.5 ? flashI * 2 : (1 - flashI) * 2;
        ctx.fillStyle = `rgba(255,255,255,${flashPeak})`;
        ctx.fillRect(0, 0, w, h);
        if (flashI > 0.6) {
          ctx.fillStyle = `rgba(255,200,100,${(flashI - 0.6) * 2})`;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // ── TITLE CARD ────────────────────────────────────────────────────────
      if (t >= T.TITLE_START) {
        // Dark background slams in
        ctx.fillStyle = `rgba(5,5,16,${Math.min(1, titleI * 5)})`;
        ctx.fillRect(0, 0, w, h);

        const ta       = clamp01(titleI * 4);
        const fontSize = Math.min(96, Math.floor(w * 0.078));

        // ── Layer 1: Ghost "readme" logo watermark ─────────────────────────
        if (ta > 0) {
          ctx.save();
          ctx.globalAlpha = ta * 0.055;
          ctx.fillStyle = '#1D4ED8';
          // Large wordmark centered at ~46% of screen height
          ctx.font = `900 ${Math.floor(w * 0.23)}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.letterSpacing = '-0.02em';
          ctx.fillText('readme', w / 2, h * 0.46);
          ctx.letterSpacing = '0';
          ctx.restore();
        }

        // ── Layer 2: Crack remnants — war-torn backdrop ────────────────────
        if (ta > 0 && cracksRef.current.length > 0) {
          ctx.save();
          ctx.globalAlpha = ta * 0.09;
          ctx.strokeStyle = '#BB1515';
          ctx.lineWidth = 1.2;
          for (const pts of cracksRef.current) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let pi = 1; pi < pts.length; pi++) ctx.lineTo(pts[pi][0], pts[pi][1]);
            ctx.stroke();
          }
          ctx.restore();
        }

        // ── Layer 3: Ghost API endpoint shapes at screen edges ─────────────
        if (ta > 0.2) {
          const ghostA = clamp01((ta - 0.2) * 2.5) * 0.15;
          ctx.save();
          ctx.globalAlpha = ghostA;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 8px monospace';
          for (const ep of ghostEpsRef.current) {
            // Colored method badge
            ctx.fillStyle = ep.color;
            ctx.fillRect(ep.x, ep.y, 44, 18);
            // Method label
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            ctx.fillText(ep.method, ep.x + 4, ep.y + 9);
            // URL line
            ctx.fillStyle = 'rgba(180,205,255,0.32)';
            ctx.fillRect(ep.x + 52, ep.y + 4, ep.lw[0], 10);
            // Body content lines
            ctx.fillStyle = 'rgba(150,170,220,0.20)';
            ctx.fillRect(ep.x, ep.y + 26, ep.lw[1], 7);
            ctx.fillRect(ep.x, ep.y + 38, ep.lw[2], 7);
            ctx.fillRect(ep.x, ep.y + 50, Math.floor(ep.lw[2] * 0.65), 7);
          }
          ctx.restore();
        }

        // ── Layer 4: Ghost docs page wireframes ────────────────────────────
        if (ta > 0.15) {
          const pageA = clamp01((ta - 0.15) * 2.5) * 0.07;
          ctx.save();
          ctx.globalAlpha = pageA;
          for (const pg of ghostPgsRef.current) {
            // Page chrome/border
            ctx.strokeStyle = 'rgba(100,145,255,0.55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(pg.x, pg.y, pg.w, pg.h);
            // Title block
            ctx.fillStyle = 'rgba(100,145,255,0.30)';
            ctx.fillRect(pg.x + 8, pg.y + 10, pg.w * 0.55, 9);
            // Body lines — deterministic lengths via sin
            ctx.fillStyle = 'rgba(120,155,255,0.22)';
            for (let ly = pg.y + 28; ly < pg.y + pg.h - 8; ly += 13) {
              const lw2 = pg.w * 0.88 * (0.52 + 0.44 * Math.abs(Math.sin(ly * 0.19)));
              ctx.fillRect(pg.x + 8, ly, lw2, 6);
            }
          }
          ctx.restore();
        }

        // ── Layer 5: Focused dark vignette (draws eye to title center) ─────
        if (ta > 0) {
          const vg = ctx.createRadialGradient(w / 2, h * 0.40, h * 0.10, w / 2, h / 2, h * 0.72);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(1, `rgba(0,0,10,${ta * 0.60})`);
          ctx.fillStyle = vg;
          ctx.fillRect(0, 0, w, h);
        }

        // ── Layer 6: Main title block ──────────────────────────────────────
        // Positioned at 38.5% of screen height — well above center,
        // leaving room for the CTA button below without wasted space at top.
        const titleCenterY = h * 0.385;
        const scale = lerp(1.18, 1.0, clamp01(titleI * 5));

        ctx.save();
        ctx.globalAlpha = ta;
        ctx.translate(w / 2, titleCenterY);
        ctx.scale(scale, scale);

        // Eyebrow: "A README EXPERIENCE"
        ctx.font = `${Math.max(10, Math.floor(w * 0.010))}px monospace`;
        ctx.fillStyle = 'rgba(205,145,60,0.90)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.35em';
        ctx.fillText('A  README  EXPERIENCE', 0, -fontSize * 0.73);
        ctx.letterSpacing = '0';

        // Thin line above title
        ctx.strokeStyle = 'rgba(200,140,55,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-fontSize * 2.15, -fontSize * 0.55);
        ctx.lineTo( fontSize * 2.15, -fontSize * 0.55);
        ctx.stroke();

        // "DOCS DEFENDER" — main title with gold glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur  = 55;
        ctx.fillStyle   = '#F5E6C8';
        ctx.font        = `900 ${fontSize}px monospace`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.12em';
        ctx.fillText('DOCS DEFENDER', 0, 0);
        ctx.shadowBlur = 0;
        ctx.letterSpacing = '0';

        // Separator line below title
        ctx.strokeStyle = 'rgba(255,215,0,0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-fontSize * 2.2, fontSize * 0.53);
        ctx.lineTo( fontSize * 2.2, fontSize * 0.53);
        ctx.stroke();

        // Subtitle
        ctx.font = `${Math.max(14, Math.floor(w * 0.016))}px monospace`;
        ctx.fillStyle   = 'rgba(160,200,255,0.88)';
        ctx.shadowColor = '#4488FF';
        ctx.shadowBlur  = 12;
        ctx.fillText('Protect the Docs  ·  Destroy the Bugs', 0, fontSize * 0.77);
        ctx.shadowBlur = 0;

        // Stats / lore line — fades in slightly after the main title settles
        if (titleI > 0.45) {
          const statsA = clamp01((titleI - 0.45) * 5);
          ctx.save();
          ctx.globalAlpha = ta * statsA * 0.65;
          ctx.font = `${Math.max(9, Math.floor(w * 0.0088))}px monospace`;
          ctx.fillStyle = 'rgba(140,165,220,0.90)';
          ctx.letterSpacing = '0.18em';
          ctx.fillText('6  LEVELS  ·  6  BOSSES  ·  CHAOS  BUILD  AWAITS', 0, fontSize * 1.12);
          ctx.letterSpacing = '0';
          ctx.restore();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // ── Done ──────────────────────────────────────────────────────────────
      if (t >= TOTAL) {
        titleDoneRef.current = true;
        setShowButton(true);
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', skip);
    };
  }, [started, onComplete]);

  return (
    <div className="absolute inset-0" style={{ zIndex: 200, background: '#050510', cursor: 'default' }}>

      {/* ── ReadMe homepage mockup ── */}
      <div
        ref={pageRef}
        className="absolute inset-0 overflow-hidden select-none"
        style={{ transformOrigin: 'center center', transition: 'none' }}
      >
        <ReadMeHomepage />
      </div>

      {/* ── Effects canvas ── */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* ── LET'S GO! — shown on clean page before corruption ── */}
      {!started && (
        <div
          className="absolute inset-0 flex items-end justify-center z-50 pointer-events-none"
          style={{ paddingBottom: '12vh' }}
        >
          <button
            onClick={() => setStarted(true)}
            className="pointer-events-auto font-mono font-black uppercase tracking-widest
                       animate-[fadeSlideUp_0.5s_ease_forwards]"
            style={{
              fontSize: 'clamp(14px, 2vw, 20px)',
              letterSpacing: '0.18em',
              padding: '18px 52px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 0 36px rgba(34,197,94,0.5), 0 4px 24px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 56px rgba(34,197,94,0.75), 0 4px 32px rgba(0,0,0,0.35)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 36px rgba(34,197,94,0.5), 0 4px 24px rgba(0,0,0,0.25)';
            }}
          >
            ⚡ LET&apos;S GO!
          </button>
        </div>
      )}

      {/* ── SKIP — during corruption, before title card ── */}
      {started && !showButton && (
        <button
          onClick={() => { cancelAnimationFrame(rafRef.current); onComplete(); }}
          className="absolute bottom-5 right-5 z-50 text-[11px] font-mono tracking-widest uppercase
                     px-3 py-1.5 rounded transition-opacity opacity-30 hover:opacity-80"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
        >
          SKIP ›
        </button>
      )}

      {/* ── JOIN THE FIGHT — positioned at 63 vh so it sits below the title   ──
              block (~38 % center + text height ≈ 50 %) with breathing room.    ── */}
      {showButton && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ top: '63vh', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
        >
          <button
            onClick={onComplete}
            className="pointer-events-auto font-mono font-black uppercase tracking-widest
                       animate-[fadeSlideUp_0.5s_ease_forwards]"
            style={{
              fontSize: 'clamp(14px, 2vw, 20px)',
              letterSpacing: '0.18em',
              padding: '18px 52px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
              color: '#050510',
              border: 'none',
              boxShadow: '0 0 40px rgba(255,200,0,0.55), 0 4px 24px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 60px rgba(255,200,0,0.8), 0 4px 32px rgba(0,0,0,0.7)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(255,200,0,0.55), 0 4px 24px rgba(0,0,0,0.6)';
            }}
          >
            ⚔ JOIN THE FIGHT
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ReadMe Homepage recreation ───────────────────────────────────────────────

function ReadMeHomepage() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(145deg,#eaecf8 0%,#f3e8f8 22%,#faf0ec 45%,#ebf8f4 70%,#e8edf8 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Soft gradient blobs */}
      <div style={{ position:'absolute', top:'-15%', right:'8%',  width:'42%', height:'60%', background:'radial-gradient(ellipse,rgba(210,195,255,0.38) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-8%',left:'12%', width:'38%', height:'48%', background:'radial-gradient(ellipse,rgba(195,240,220,0.32) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'35%',  left:'-4%',  width:'32%', height:'38%', background:'radial-gradient(ellipse,rgba(195,218,255,0.28) 0%,transparent 70%)', pointerEvents:'none' }} />

      {/* ── Navbar ── */}
      <div style={{ padding:'14px 40px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{
          background:'rgba(255,255,255,0.92)', borderRadius:14, padding:'9px 22px',
          display:'flex', alignItems:'center', gap:28,
          boxShadow:'0 2px 20px rgba(0,0,40,0.08)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/readme-blue.svg" alt="ReadMe" style={{ height:22 }} />
          </div>
          {['Features ›','AI','Docs','Blog','Pricing','About ›'].map(n => (
            <span key={n} style={{ color:'#374151', fontSize:14, fontWeight:500 }}>{n}</span>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#374151', fontSize:14, fontWeight:500 }}>Contact Sales</span>
          <div style={{ border:'1px solid #D1D5DB', borderRadius:8, padding:'6px 16px', fontSize:14, fontWeight:600, color:'#111827', background:'white' }}>Log In</div>
          <div style={{ background:'#2563EB', borderRadius:8, padding:'6px 16px', fontSize:14, fontWeight:600, color:'white' }}>Sign Up</div>
        </div>
      </div>

      {/* ── Hero section ── */}
      <div style={{ textAlign:'center', paddingTop:'5vh', paddingBottom:'3vh' }}>
        <h1 style={{
          fontSize:'clamp(2.6rem, 5.5vw, 5.2rem)', fontWeight:900, color:'#0F172A',
          lineHeight:1.08, letterSpacing:'-0.02em', margin:'0 auto', maxWidth:'78vw',
        }}>
          Team up with AI to<br/>build great docs.
        </h1>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:16, marginTop:'3vh',
          background:'rgba(255,255,255,0.7)', borderRadius:16, padding:'14px 22px',
          boxShadow:'0 4px 24px rgba(0,0,40,0.1)', border:'1px solid rgba(0,0,0,0.06)',
        }}>
          <div style={{ border:'2px solid #2563EB', borderRadius:10, padding:'9px 22px', color:'#2563EB', fontWeight:700, fontSize:16 }}>Get Started</div>
          <span style={{ color:'#9CA3AF', fontSize:15 }}>or</span>
          <span style={{ color:'#2563EB', fontWeight:700, fontSize:16 }}>View Our Docs</span>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:28, marginTop:'2.5vh', flexWrap:'wrap' }}>
          {[
            { icon:'🗂', label:'MCP Server',  color:'#6366F1' },
            { icon:'🤖', label:'AI Agent',    color:'#10B981' },
            { icon:'✨', label:'Ask AI',      color:'#F59E0B' },
            { icon:'📋', label:'Docs Audit',  color:'#EC4899' },
            { icon:'🔍', label:'AI Linter',   color:'#8B5CF6' },
          ].map(p => (
            <div key={p.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, color:p.color, fontWeight:600 }}>
              <span style={{ fontSize:15 }}>{p.icon}</span>
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── API Docs UI mockup ── */}
      <div style={{
        margin:'0 auto', width:'min(880px, 88vw)',
        background:'white', borderRadius:'14px 14px 0 0',
        boxShadow:'0 -4px 40px rgba(0,0,40,0.12)',
        overflow:'hidden', border:'1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Tabs bar */}
        <div style={{ display:'flex', alignItems:'center', gap:0, borderBottom:'1px solid #E5E7EB', padding:'0 16px', background:'#F9FAFB' }}>
          <div style={{ padding:'10px 12px 10px 4px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/readme-blue.svg" alt="" style={{ height:16, opacity:0.7 }} />
          </div>
          {[
            { label:'Home',        icon:'🏠', active:false },
            { label:'Guides',      icon:'📖', active:false },
            { label:'Recipes',     icon:'📋', active:false },
            { label:'API Reference',icon:'⚡', active:true  },
            { label:'Changelog',   icon:'📝', active:false },
          ].map(tab => (
            <div key={tab.label} style={{
              padding:'10px 14px', fontSize:13, fontWeight: tab.active ? 600 : 400,
              color: tab.active ? '#2563EB' : '#6B7280',
              borderBottom: tab.active ? '2px solid #2563EB' : '2px solid transparent',
              display:'flex', alignItems:'center', gap:5,
            }}>
              <span style={{ fontSize:12 }}>{tab.icon}</span>{tab.label}
            </div>
          ))}
          <div style={{ marginLeft:'auto', padding:'10px 14px', fontSize:13, color:'#6B7280', display:'flex', alignItems:'center', gap:4 }}>
            ✨ Ask AI
          </div>
        </div>

        {/* Content area */}
        <div style={{ display:'flex', minHeight:'min(38vh, 300px)' }}>
          {/* Left sidebar */}
          <div style={{ width:200, borderRight:'1px solid #E5E7EB', padding:'16px 12px', flexShrink:0, background:'#FAFAFA' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', letterSpacing:'0.06em', marginBottom:8 }}>JUMP TO</div>
            {['Getting Started','Authentication','My Requests','Examples','About Owl APIs','Limiting API Results','API Updates','Owl Facts'].map((item, i) => (
              <div key={item} style={{
                fontSize:12.5, color: i === 0 ? '#2563EB' : '#374151', padding:'4px 6px', borderRadius:5,
                marginBottom:2, display:'flex', alignItems:'center', gap:5,
                background: i === 0 ? 'rgba(37,99,235,0.07)' : 'transparent',
                fontWeight: i === 0 || i === 4 ? 600 : 400,
              }}>
                {i < 3 && <span style={{ fontSize:10 }}>{['□','⚙','✓'][i]}</span>}{item}
              </div>
            ))}
          </div>

          {/* Center content */}
          <div style={{ flex:1, padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ background:'#22C55E', color:'white', fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:4 }}>POST</span>
              <h2 style={{ fontSize:20, fontWeight:800, color:'#111827', margin:0 }}>Get owl fact</h2>
              <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:6 }}>https://owlstore.readme.com/v3/facts</span>
            </div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:10 }}>Example Owl Facts</h3>
            {[
              'The tiniest owl, the Elf Owl, is only 5 inches tall.',
              'A group of owls is called a parliament.',
              "Owls can turn their heads as much as 270 degrees. They're owlways watching you.",
            ].map(fact => (
              <div key={fact} style={{
                borderLeft:'3px solid #E5E7EB', paddingLeft:12, marginBottom:10,
                fontSize:13.5, color:'#374151', lineHeight:1.5,
              }}>
                {fact}
              </div>
            ))}
          </div>

          {/* Right Ask AI panel */}
          <div style={{ width:210, borderLeft:'1px solid #E5E7EB', padding:'16px', flexShrink:0, background:'#F9FAFB' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#111827', marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
              ✨ Ask AI
            </div>
            <div style={{ background:'white', borderRadius:10, padding:'8px 11px', border:'1px solid #E5E7EB', fontSize:12.5, color:'#374151', marginBottom:8 }}>
              What is ReadMe?
            </div>
            <div style={{ fontSize:12, color:'#374151', lineHeight:1.55 }}>
              ReadMe makes it easy to create and publish beautiful, interactive API documentation.
              <br /><br />
              Whether you want to work in our WYSIWYG editor or check-in your docs as you code, you can always keep docs in sync.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
