// ─── Chaos Build Environmental Hazards ───────────────────────────────────────
// Active ONLY during the bonus / Chaos Build level.
// Adds three short hazard types that make Owlbert navigate a corrupted digital
// space — without changing core gameplay mechanics or affecting other levels.

const PANEL_LABELS = [
  '404 NOT FOUND',
  'UNDEFINED IS NOT A FUNCTION',
  'MODULE NOT FOUND',
  'UNHANDLED REJECTION',
  'DEPRECATED API ENDPOINT',
  'NPM AUDIT: CRITICAL',
  'NULL REFERENCE EXCEPTION',
  'BUILD FAILED',
  'FATAL: CANNOT READ DOCS',
  'MEMORY LEAK DETECTED',
];

const GATE_LABELS = [
  'FIREWALL: ACCESS DENIED',
  'CORP FILTER ACTIVE',
  'SECURITY POLICY ENFORCED',
  'RATE LIMIT EXCEEDED',
  'PROXY REJECTION: 403',
];

const WALL_LABELS = [
  'CORRUPTED SECTOR',
  'MEMORY FRAGMENTED',
  'RESTRICTED ZONE',
  'SYSTEM BREACH DETECTED',
];

interface BonusObstacle {
  kind: 'floatingPanel' | 'firewallGate' | 'glitchWalls';
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  active: boolean;
  opacity: number;    // 0-1, managed by fade envelope
  life: number;       // seconds remaining
  maxLife: number;
  color: string;
  accentColor: string;
  label: string;
  // firewallGate: the safe passage gap
  gapX: number;
  gapW: number;
  // glitchWalls: side wall widths and corridor position
  leftW: number;
  rightW: number;
  corridorX: number;
  corridorW: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class ChaosObstacleManager {
  private obstacles: BonusObstacle[] = [];
  private spawnTimer = 7;
  private cycle = 0;

  reset(cw: number, ch: number) {
    this.obstacles = [];
    this.spawnTimer = 7;   // first obstacle appears after 7 s
    this.cycle = 0;
    void cw; void ch;      // stored per-update since canvas can resize
  }

  update(dt: number, cw: number, ch: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnNext(cw, ch);
      this.spawnTimer = 12 + Math.random() * 6;  // 12–18 s apart
    }

    for (const obs of this.obstacles) {
      if (!obs.active) continue;

      obs.life -= dt;
      if (obs.life <= 0) { obs.active = false; continue; }

      // Opacity envelope: 0.4 s fade-in, 0.7 s fade-out
      const elapsed = obs.maxLife - obs.life;
      if (elapsed < 0.4) {
        obs.opacity = elapsed / 0.4;
      } else if (obs.life < 0.7) {
        obs.opacity = obs.life / 0.7;
      } else {
        obs.opacity = 1;
      }

      obs.y += obs.vy * dt;
      obs.x += obs.vx * dt;

      // Remove scrolling obstacles once fully past bottom
      if (obs.vy > 0 && obs.y > ch + 120) obs.active = false;
    }

    this.obstacles = this.obstacles.filter(o => o.active);
  }

  private spawnNext(cw: number, ch: number) {
    const kinds: Array<BonusObstacle['kind']> = ['floatingPanel', 'firewallGate', 'glitchWalls'];
    const kind = kinds[this.cycle % 3];
    this.cycle++;
    if      (kind === 'floatingPanel') this.spawnPanel(cw, ch);
    else if (kind === 'firewallGate')  this.spawnGate(cw, ch);
    else                               this.spawnWalls(cw, ch);
  }

  // ── Floating corrupted UI panel (modal / nav bar / 404 block) ────────────────
  private spawnPanel(cw: number, ch: number) {
    const w = 210 + Math.random() * 130;
    const h = 62 + Math.random() * 32;
    const x = 40 + Math.random() * Math.max(10, cw - w - 80);
    const vy = 82 + Math.random() * 45;
    const vx = (Math.random() - 0.5) * 28;
    const maxLife = (ch + h + 80) / vy + 0.5;
    const ci = Math.floor(Math.random() * 3);
    const colors  = ['rgba(55,0,95,0.9)',  'rgba(0,18,75,0.9)',  'rgba(75,8,0,0.9)'];
    const accents = ['#CC44FF',            '#00CCFF',            '#FF4422'];
    this.obstacles.push({
      kind: 'floatingPanel', x, y: -h - 10, w, h, vx, vy,
      active: true, opacity: 0, life: maxLife, maxLife,
      color: colors[ci], accentColor: accents[ci],
      label: pick(PANEL_LABELS),
      gapX: 0, gapW: 0, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
    });
  }

  // ── Firewall barrier with a single fly-through gap ───────────────────────────
  private spawnGate(cw: number, ch: number) {
    const h = 48 + Math.random() * 18;
    const gapW = 155 + Math.random() * 45;   // wide enough to be fair
    const gapX = 55 + Math.random() * Math.max(10, cw - gapW - 110);
    const vy = 72 + Math.random() * 28;
    const maxLife = (ch + h + 80) / vy + 0.5;
    this.obstacles.push({
      kind: 'firewallGate', x: 0, y: -h - 10, w: cw, h, vx: 0, vy,
      active: true, opacity: 0, life: maxLife, maxLife,
      color: 'rgba(135,28,0,0.92)', accentColor: '#FF6600',
      label: pick(GATE_LABELS),
      gapX, gapW, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
    });
  }

  // ── Glitch walls that close in, leaving a safe corridor ──────────────────────
  private spawnWalls(cw: number, ch: number) {
    const corridorW = 215 + Math.random() * 85;
    const corridorX = Math.max(25, Math.min(cw - corridorW - 25,
      (cw - corridorW) / 2 + (Math.random() - 0.5) * 110));
    const maxLife = 4.5 + Math.random() * 2;
    this.obstacles.push({
      kind: 'glitchWalls', x: 0, y: 0, w: cw, h: ch, vx: 0, vy: 0,
      active: true, opacity: 0, life: maxLife, maxLife,
      color: 'rgba(28,0,65,0.82)', accentColor: '#AA44FF',
      label: pick(WALL_LABELS),
      gapX: 0, gapW: 0,
      leftW: corridorX,
      rightW: cw - corridorX - corridorW,
      corridorX, corridorW,
    });
  }

  // ── Collision ─────────────────────────────────────────────────────────────────
  // Returns true if the player center (px, py) is inside a solid obstacle area.
  // Only active once opacity > 0.35 so collisions never occur during fade-in/out.
  checkPlayerCollision(px: number, py: number): boolean {
    const R = 17;
    for (const obs of this.obstacles) {
      if (!obs.active || obs.opacity < 0.35) continue;

      if (obs.kind === 'floatingPanel') {
        if (px + R > obs.x && px - R < obs.x + obs.w &&
            py + R > obs.y && py - R < obs.y + obs.h) return true;

      } else if (obs.kind === 'firewallGate') {
        if (py + R > obs.y && py - R < obs.y + obs.h) {
          // Solid unless the player is clearly inside the gap (+10 px padding)
          const inGap = px > obs.gapX - 10 && px < obs.gapX + obs.gapW + 10;
          if (!inGap) return true;
        }

      } else if (obs.kind === 'glitchWalls' && obs.opacity > 0.45) {
        if (obs.leftW  > 0 && px - R < obs.leftW)          return true;
        if (obs.rightW > 0 && px + R > obs.w - obs.rightW) return true;
      }
    }
    return false;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────
  draw(ctx: CanvasRenderingContext2D, now: number) {
    for (const obs of this.obstacles) {
      if (!obs.active || obs.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = obs.opacity;
      if      (obs.kind === 'floatingPanel') this.drawPanel(ctx, obs, now);
      else if (obs.kind === 'firewallGate')  this.drawGate(ctx, obs, now);
      else                                   this.drawWalls(ctx, obs, now);
      ctx.restore();
    }
  }

  private drawPanel(ctx: CanvasRenderingContext2D, obs: BonusObstacle, now: number) {
    const { x, y, w, h, color, accentColor, label } = obs;
    // Occasional 1-frame pixel glitch displacement for corrupted feel
    const glitch = Math.sin(now * 0.011 + x * 0.013) > 0.88 ? (Math.random() - 0.5) * 5 : 0;
    const gx = x + glitch;

    // Panel body
    ctx.fillStyle = color;
    ctx.fillRect(gx, y, w, h);

    // Scanlines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let sy = y + 20; sy < y + h - 1; sy += 4) {
      ctx.beginPath(); ctx.moveTo(gx, sy); ctx.lineTo(gx + w, sy); ctx.stroke();
    }

    // Title bar
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = accentColor;
    ctx.fillRect(gx, y, w, 18);
    ctx.restore();

    // Window control dots
    (['#FF5555', '#FFBB33', '#44CC44'] as const).forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(gx + 10 + i * 14, y + 9, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Label text
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, gx + w / 2, y + h * 0.65);
    ctx.shadowBlur = 0;

    // Border glow
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 14;
    ctx.strokeRect(gx, y, w, h);
    ctx.shadowBlur = 0;
  }

  private drawGate(ctx: CanvasRenderingContext2D, obs: BonusObstacle, now: number) {
    const { y, w, h, accentColor, label, gapX, gapW } = obs;
    const gapEnd = gapX + gapW;
    const pulse = 0.6 + Math.sin(now * 0.008) * 0.4;

    // Draw one solid block (left or right of gap)
    const fillBlock = (bx: number, bw: number) => {
      if (bw <= 0) return;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(200,48,0,0.95)');
      g.addColorStop(1, 'rgba(100,14,0,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(bx, y, bw, h);
      // Warning diagonal stripes
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, y, bw, h); ctx.clip();
      ctx.strokeStyle = 'rgba(255,110,0,0.22)';
      ctx.lineWidth = 10;
      for (let i = -h; i < bw + h; i += 28) {
        ctx.beginPath();
        ctx.moveTo(bx + i, y); ctx.lineTo(bx + i + h, y + h);
        ctx.stroke();
      }
      ctx.restore();
    };

    fillBlock(0, gapX);
    fillBlock(gapEnd, w - gapEnd);

    // Glowing edges
    ctx.strokeStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Top & bottom edges (solid sections only)
    if (gapX > 0)    { ctx.moveTo(0, y);      ctx.lineTo(gapX,  y);      }
    if (gapEnd < w)  { ctx.moveTo(gapEnd, y);  ctx.lineTo(w,     y);      }
    if (gapX > 0)    { ctx.moveTo(0, y + h);   ctx.lineTo(gapX,  y + h);  }
    if (gapEnd < w)  { ctx.moveTo(gapEnd, y + h); ctx.lineTo(w,  y + h);  }
    // Gap edge verticals
    if (gapX > 0)    { ctx.moveTo(gapX,    y); ctx.lineTo(gapX,    y + h); }
    if (gapEnd < w)  { ctx.moveTo(gapEnd,  y); ctx.lineTo(gapEnd,  y + h); }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gap interior glow
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    const gg = ctx.createLinearGradient(gapX, 0, gapEnd, 0);
    gg.addColorStop(0,   'rgba(255,160,0,0.6)');
    gg.addColorStop(0.5, 'rgba(255,255,80,0.2)');
    gg.addColorStop(1,   'rgba(255,160,0,0.6)');
    ctx.fillStyle = gg;
    ctx.fillRect(gapX, y, gapW, h);
    ctx.restore();

    // "FLY THROUGH" indicator inside gap
    ctx.fillStyle = `rgba(255,210,60,${0.9 * pulse})`;
    ctx.shadowColor = '#FF8800';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓ FLY THROUGH ↓', gapX + gapW / 2, y + h / 2);
    ctx.shadowBlur = 0;

    // Label above gate
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(label, w / 2, y - 8);
  }

  private drawWalls(ctx: CanvasRenderingContext2D, obs: BonusObstacle, now: number) {
    const { w, h, leftW, rightW, corridorX, corridorW, accentColor, label } = obs;
    const pulse = 0.65 + Math.sin(now * 0.007) * 0.35;

    const drawOneSide = (wx: number, ww: number, innerEdge: number) => {
      if (ww <= 0) return;
      const g = ctx.createLinearGradient(wx, 0, wx + ww, 0);
      // Gradient: darker at outer edge, brighter at inner (corridor) edge
      const [c0, c1] = innerEdge > wx
        ? ['rgba(25,0,60,0.80)', 'rgba(80,0,155,0.90)']
        : ['rgba(80,0,155,0.90)', 'rgba(25,0,60,0.80)'];
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(wx, 0, ww, h);

      // Scanlines
      ctx.strokeStyle = `rgba(130,50,210,${0.13 * pulse})`;
      ctx.lineWidth = 2;
      for (let sy = 0; sy < h; sy += 14) {
        ctx.beginPath(); ctx.moveTo(wx, sy); ctx.lineTo(wx + ww, sy); ctx.stroke();
      }

      // Occasional glitch slice — deterministic enough to not flicker wildly
      const slicePhase = Math.sin(now * 0.003 + wx * 0.01);
      if (slicePhase > 0.82) {
        const sliceY = ((Math.sin(now * 2.1 + wx) * 0.5 + 0.5)) * (h - 20);
        ctx.fillStyle = 'rgba(150,70,255,0.14)';
        ctx.fillRect(wx, sliceY, ww, 6 + Math.abs(Math.sin(now * 3.7)) * 5);
      }

      // Bright inner edge glow line
      ctx.strokeStyle = `rgba(170,80,255,${0.9 * pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#AA44FF';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(innerEdge, 0); ctx.lineTo(innerEdge, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawOneSide(0, leftW, leftW);
    drawOneSide(w - rightW, rightW, w - rightW);

    // Corridor label and safe-zone hint
    const cx = corridorX + corridorW / 2;
    ctx.fillStyle = `rgba(210,150,255,${0.8 * pulse})`;
    ctx.shadowColor = '#AA44FF';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx, 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(220,185,255,${0.6 * pulse})`;
    ctx.font = '11px monospace';
    ctx.fillText('◄─ SAFE ZONE ─►', cx, 26);
  }
}
