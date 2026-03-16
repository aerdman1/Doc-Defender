// ─── Level Environmental Hazards (Levels 1–5) ────────────────────────────────
// Adds 2 themed environmental hazard types per main level.
// Architecture mirrors ChaosObstacles.ts — isolated, low coupling, additive.
// Activated ONLY during the matching level; disabled during boss phase.

// ── Label pools ───────────────────────────────────────────────────────────────

// Level 1 · Discovery Drift
const CLOUD_LABELS = [
  'SCOPE CREEP DETECTED',
  'NEW REQUIREMENT ADDED',
  'STAKEHOLDER PING',
  'OUT OF SCOPE',
  'CAN YOU JUST ADD...',
  'UNDOCUMENTED ASSUMPTION',
  'TIMELINE UNSTABLE',
];
const DEADLINE_LABELS = [
  'DEADLINE: YESTERDAY',
  'Q4 SCOPE FREEZE',
  'SPRINT ENDS TODAY',
  'HARD DEADLINE ACTIVE',
  'TIMELINE COLLAPSED',
];

// Level 2 · Integration Grid
const AUTH_LABELS = [
  'AUTHENTICATION REQUIRED',
  'TOKEN EXPIRED: 401',
  'INVALID API KEY',
  'SCOPE DENIED: 403',
  'OAUTH FLOW FAILED',
];
const CONFIG_LABELS = [
  'CONFIG MISMATCH',
  'ENV VAR UNDEFINED',
  'MISSING: .env.local',
  'SECRET ROTATION ACTIVE',
];

// Level 3 · Migration Storm
const TABLE_LABELS = [
  'LEGACY TABLE DETECTED',
  'DEPRECATED SCHEMA',
  'MIGRATION PENDING',
  'BREAKING CHANGE: TABLE',
  'FOREIGN KEY VIOLATION',
];
const IMAGE_LABELS = [
  '404 · IMAGE NOT FOUND',
  'BROKEN IMPORT',
  'ASSET MISSING',
  'CDN UNREACHABLE',
  'SRC=UNDEFINED',
];

// Level 4 · Launch Sequence
const REDIRECT_LABELS = [
  '301 MOVED PERMANENTLY',
  '302 FOUND: REDIRECTING',
  '308 PERMANENT REDIRECT',
  'REDIRECT LOOP DETECTED',
  'PROXY PASS ACTIVE',
];
const QA_LABELS = [
  'QA SWEEP IN PROGRESS',
  'AUTOMATED TEST RUNNING',
  'COVERAGE CHECK ACTIVE',
  'LINT ERROR DETECTED',
  'BUILD VALIDATION',
];

// Level 5 · Live Ops Rift
const FOG_LABELS = [
  'STALE CONTENT ZONE',
  'LAST UPDATED: NEVER',
  'OUTDATED DEPENDENCY',
  'DEPRECATED: NO SUPPORT',
];
const TICKET_LABELS = [
  'P0: DOCS ARE DOWN',
  'P1: SEARCH BROKEN',
  'REGRESSED: BUILD 4.1.2',
  'INCIDENT: LIVE OPS',
  'HOTFIX REQUIRED',
  'CUSTOMER IMPACTED',
  'SLA BREACH: T-10MIN',
];

type ObstacleKind =
  | 'requirementCloud' | 'deadlineBar'    // L1
  | 'authGate'         | 'configWall'     // L2
  | 'imageFrame'       | 'brokenTable'    // L3
  | 'redirectGate'     | 'qaWall'         // L4
  | 'ticketPanel'      | 'staleFog';      // L5

interface LevelObstacle {
  kind: ObstacleKind;
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  active: boolean;
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
  accentColor: string;
  label: string;
  // gate variant: safe passage gap
  gapX: number; gapW: number;
  // wall variant: corridor geometry
  leftW: number; rightW: number; corridorX: number; corridorW: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Convert 6-digit hex to "r,g,b" for rgba() strings
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export class LevelObstacleManager {
  private level: number;
  private obstacles: LevelObstacle[] = [];
  private spawnTimer = 4;    // first obstacle after 4 s
  private cycle = 0;

  constructor(level: number) {
    this.level = level;
  }

  reset(cw: number, ch: number) {
    this.obstacles = [];
    this.spawnTimer = 4;
    this.cycle = 0;
    void cw; void ch;
  }

  update(dt: number, cw: number, ch: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnNext(cw, ch);
      // Scales with level: L1 ~7-10 s, L5 ~4-6 s
      const base = Math.max(4, 8 - this.level * 0.8);
      this.spawnTimer = base + Math.random() * 3;
    }

    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      obs.life -= dt;
      if (obs.life <= 0) { obs.active = false; continue; }

      // Opacity envelope: 0.5 s fade-in, 0.8 s fade-out
      const elapsed = obs.maxLife - obs.life;
      if (elapsed < 0.5)     obs.opacity = elapsed / 0.5;
      else if (obs.life < 0.8) obs.opacity = obs.life / 0.8;
      else                    obs.opacity = 1;

      obs.y += obs.vy * dt;
      obs.x += obs.vx * dt;
      if (obs.vy > 0 && obs.y > ch + 120) obs.active = false;
    }

    this.obstacles = this.obstacles.filter(o => o.active);
  }

  private spawnNext(cw: number, ch: number) {
    switch (this.level) {
      case 1: this.spawnLevel1(cw, ch); break;
      case 2: this.spawnLevel2(cw, ch); break;
      case 3: this.spawnLevel3(cw, ch); break;
      case 4: this.spawnLevel4(cw, ch); break;
      case 5: this.spawnLevel5(cw, ch); break;
    }
    this.cycle++;
  }

  // ── Level 1 · Discovery Drift ─────────────────────────────────────────────────
  // requirementCloud (floating panel) ↔ deadlineBar (gate)
  private spawnLevel1(cw: number, ch: number) {
    if (this.cycle % 2 === 0) {
      const w = 190 + Math.random() * 110;
      const h = 56 + Math.random() * 28;
      const x = 40 + Math.random() * Math.max(10, cw - w - 80);
      const vy = 70 + Math.random() * 35;
      const vx = (Math.random() - 0.5) * 22;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'requirementCloud', x, y: -h - 10, w, h, vx, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(12,20,80,0.85)', accentColor: '#6699FF',
        label: pick(CLOUD_LABELS),
        gapX: 0, gapW: 0, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    } else {
      const h = 44 + Math.random() * 16;
      const gapW = 160 + Math.random() * 50;
      const gapX = 55 + Math.random() * Math.max(10, cw - gapW - 110);
      const vy = 65 + Math.random() * 25;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'deadlineBar', x: 0, y: -h - 10, w: cw, h, vx: 0, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(90,45,0,0.90)', accentColor: '#FFAA22',
        label: pick(DEADLINE_LABELS),
        gapX, gapW, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    }
  }

  // ── Level 2 · Integration Grid ────────────────────────────────────────────────
  // authGate (gate) ↔ configWall (wall)
  private spawnLevel2(cw: number, ch: number) {
    if (this.cycle % 2 === 0) {
      const h = 50 + Math.random() * 18;
      const gapW = 155 + Math.random() * 45;
      const gapX = 55 + Math.random() * Math.max(10, cw - gapW - 110);
      const vy = 68 + Math.random() * 24;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'authGate', x: 0, y: -h - 10, w: cw, h, vx: 0, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(0,50,70,0.92)', accentColor: '#00DDCC',
        label: pick(AUTH_LABELS),
        gapX, gapW, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    } else {
      const corridorW = 220 + Math.random() * 80;
      const corridorX = Math.max(25, Math.min(cw - corridorW - 25,
        (cw - corridorW) / 2 + (Math.random() - 0.5) * 100));
      const maxLife = 4.5 + Math.random() * 2;
      this.obstacles.push({
        kind: 'configWall', x: 0, y: 0, w: cw, h: ch, vx: 0, vy: 0,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(0,35,10,0.82)', accentColor: '#22DD88',
        label: pick(CONFIG_LABELS),
        gapX: 0, gapW: 0,
        leftW: corridorX, rightW: cw - corridorX - corridorW,
        corridorX, corridorW,
      });
    }
  }

  // ── Level 3 · Migration Storm ─────────────────────────────────────────────────
  // imageFrame (floating panel) ↔ brokenTable (gate)
  private spawnLevel3(cw: number, ch: number) {
    if (this.cycle % 2 === 0) {
      const w = 180 + Math.random() * 120;
      const h = 60 + Math.random() * 30;
      const x = 40 + Math.random() * Math.max(10, cw - w - 80);
      const vy = 75 + Math.random() * 40;
      const vx = (Math.random() - 0.5) * 26;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'imageFrame', x, y: -h - 10, w, h, vx, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(28,22,10,0.88)', accentColor: '#AA8844',
        label: pick(IMAGE_LABELS),
        gapX: 0, gapW: 0, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    } else {
      const h = 52 + Math.random() * 20;
      const gapW = 158 + Math.random() * 48;
      const gapX = 55 + Math.random() * Math.max(10, cw - gapW - 110);
      const vy = 70 + Math.random() * 28;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'brokenTable', x: 0, y: -h - 10, w: cw, h, vx: 0, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(42,28,0,0.90)', accentColor: '#CC9922',
        label: pick(TABLE_LABELS),
        gapX, gapW, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    }
  }

  // ── Level 4 · Launch Sequence ─────────────────────────────────────────────────
  // redirectGate (gate) ↔ qaWall (wall)
  private spawnLevel4(cw: number, ch: number) {
    if (this.cycle % 2 === 0) {
      const h = 48 + Math.random() * 18;
      const gapW = 160 + Math.random() * 44;
      const gapX = 55 + Math.random() * Math.max(10, cw - gapW - 110);
      const vy = 74 + Math.random() * 28;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'redirectGate', x: 0, y: -h - 10, w: cw, h, vx: 0, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(0,30,50,0.92)', accentColor: '#00AAFF',
        label: pick(REDIRECT_LABELS),
        gapX, gapW, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    } else {
      const corridorW = 225 + Math.random() * 75;
      const corridorX = Math.max(25, Math.min(cw - corridorW - 25,
        (cw - corridorW) / 2 + (Math.random() - 0.5) * 105));
      const maxLife = 4.5 + Math.random() * 2;
      this.obstacles.push({
        kind: 'qaWall', x: 0, y: 0, w: cw, h: ch, vx: 0, vy: 0,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(55,20,0,0.80)', accentColor: '#FF8800',
        label: pick(QA_LABELS),
        gapX: 0, gapW: 0,
        leftW: corridorX, rightW: cw - corridorX - corridorW,
        corridorX, corridorW,
      });
    }
  }

  // ── Level 5 · Live Ops Rift ───────────────────────────────────────────────────
  // ticketPanel (floating panel) ↔ staleFog (wall)
  private spawnLevel5(cw: number, ch: number) {
    if (this.cycle % 2 === 0) {
      const w = 200 + Math.random() * 120;
      const h = 64 + Math.random() * 32;
      const x = 40 + Math.random() * Math.max(10, cw - w - 80);
      const vy = 78 + Math.random() * 42;
      const vx = (Math.random() - 0.5) * 24;
      const maxLife = (ch + h + 80) / vy + 0.5;
      this.obstacles.push({
        kind: 'ticketPanel', x, y: -h - 10, w, h, vx, vy,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(10,14,40,0.90)', accentColor: '#FF6644',
        label: pick(TICKET_LABELS),
        gapX: 0, gapW: 0, leftW: 0, rightW: 0, corridorX: 0, corridorW: 0,
      });
    } else {
      const corridorW = 220 + Math.random() * 80;
      const corridorX = Math.max(25, Math.min(cw - corridorW - 25,
        (cw - corridorW) / 2 + (Math.random() - 0.5) * 100));
      const maxLife = 5 + Math.random() * 2.5;
      this.obstacles.push({
        kind: 'staleFog', x: 0, y: 0, w: cw, h: ch, vx: 0, vy: 0,
        active: true, opacity: 0, life: maxLife, maxLife,
        color: 'rgba(18,22,35,0.80)', accentColor: '#8899BB',
        label: pick(FOG_LABELS),
        gapX: 0, gapW: 0,
        leftW: corridorX, rightW: cw - corridorX - corridorW,
        corridorX, corridorW,
      });
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────────
  // Returns true if player center (px, py) touches a solid area.
  // Only active once opacity > 0.35 to avoid surprise hits during fade.
  checkPlayerCollision(px: number, py: number): boolean {
    const R = 17;
    for (const obs of this.obstacles) {
      if (!obs.active || obs.opacity < 0.35) continue;

      const isPanel = obs.kind === 'requirementCloud' || obs.kind === 'imageFrame' || obs.kind === 'ticketPanel';
      const isGate  = obs.kind === 'deadlineBar' || obs.kind === 'authGate' || obs.kind === 'brokenTable' || obs.kind === 'redirectGate';
      const isWall  = obs.kind === 'configWall'  || obs.kind === 'qaWall'   || obs.kind === 'staleFog';

      if (isPanel) {
        if (px + R > obs.x && px - R < obs.x + obs.w &&
            py + R > obs.y && py - R < obs.y + obs.h) return true;

      } else if (isGate) {
        if (py + R > obs.y && py - R < obs.y + obs.h) {
          const inGap = px > obs.gapX - 10 && px < obs.gapX + obs.gapW + 10;
          if (!inGap) return true;
        }

      } else if (isWall && obs.opacity > 0.45) {
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

      const isPanel = obs.kind === 'requirementCloud' || obs.kind === 'imageFrame' || obs.kind === 'ticketPanel';
      const isGate  = obs.kind === 'deadlineBar' || obs.kind === 'authGate' || obs.kind === 'brokenTable' || obs.kind === 'redirectGate';

      if (isPanel) this.drawPanel(ctx, obs, now);
      else if (isGate) this.drawGate(ctx, obs, now);
      else this.drawWall(ctx, obs, now);

      ctx.restore();
    }
  }

  // ── Panel (floating obstacles) ────────────────────────────────────────────────
  private drawPanel(ctx: CanvasRenderingContext2D, obs: LevelObstacle, now: number) {
    const { x, y, w, h, color, accentColor, label, kind } = obs;

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    if (kind === 'requirementCloud') {
      // Soft cloud bumps along top edge
      ctx.fillStyle = 'rgba(100,150,255,0.10)';
      for (let bx = x + 14; bx < x + w - 14; bx += 22) {
        ctx.beginPath();
        ctx.arc(bx, y + 2, 9, Math.PI, 0);
        ctx.fill();
      }
      // Inner shimmer
      ctx.strokeStyle = 'rgba(100,150,255,0.18)';
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

    } else if (kind === 'imageFrame') {
      // Dashed border like a broken <img> placeholder
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.setLineDash([]);
      // Broken mountain icon top-left
      const ix = x + 12, iy = y + h * 0.25;
      ctx.strokeStyle = `rgba(170,136,68,0.45)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(ix, iy, 22, 16); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ix + 3,  iy + 13); ctx.lineTo(ix + 8,  iy + 7);
      ctx.lineTo(ix + 13, iy + 13); ctx.lineTo(ix + 17, iy + 9);
      ctx.lineTo(ix + 22, iy + 13);
      ctx.stroke();

    } else if (kind === 'ticketPanel') {
      // Priority badge
      ctx.fillStyle = accentColor;
      ctx.fillRect(x, y, 32, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('P0', x + 6, y + 9);
      // Faint ticket body lines
      ctx.fillStyle = 'rgba(255,100,68,0.12)';
      ctx.fillRect(x + 38, y + 5,  w - 48, 8);
      ctx.fillRect(x + 38, y + 18, (w - 48) * 0.65, 6);
    }

    // Centered label
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h * 0.65);
    ctx.shadowBlur = 0;

    // Border glow
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  // ── Gate (horizontal barrier with gap) ───────────────────────────────────────
  private drawGate(ctx: CanvasRenderingContext2D, obs: LevelObstacle, now: number) {
    const { y, w, h, color, accentColor, label, gapX, gapW, kind } = obs;
    const gapEnd = gapX + gapW;
    const pulse = 0.6 + Math.sin(now * 0.008) * 0.4;

    const fillBlock = (bx: number, bw: number) => {
      if (bw <= 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(bx, y, bw, h);

      ctx.save();
      ctx.beginPath(); ctx.rect(bx, y, bw, h); ctx.clip();

      if (kind === 'deadlineBar') {
        // Diagonal amber warning stripes
        ctx.strokeStyle = 'rgba(255,170,34,0.18)';
        ctx.lineWidth = 10;
        for (let i = -h; i < bw + h; i += 28) {
          ctx.beginPath(); ctx.moveTo(bx + i, y); ctx.lineTo(bx + i + h, y + h); ctx.stroke();
        }
      } else if (kind === 'authGate') {
        // Vertical scan lines — matrix / data feel
        ctx.strokeStyle = 'rgba(0,221,204,0.12)';
        ctx.lineWidth = 1;
        for (let lx = bx; lx < bx + bw; lx += 8) {
          ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx, y + h); ctx.stroke();
        }
      } else if (kind === 'brokenTable') {
        // Table cell grid — legacy HTML table feel
        ctx.strokeStyle = 'rgba(204,153,34,0.22)';
        ctx.lineWidth = 1;
        for (let lx = bx; lx < bx + bw; lx += 32) {
          ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx, y + h); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(bx, y + h / 2); ctx.lineTo(bx + bw, y + h / 2); ctx.stroke();
      } else if (kind === 'redirectGate') {
        // Arrow shapes pointing right — redirect / HTTP feel
        ctx.fillStyle = 'rgba(0,180,255,0.10)';
        for (let ax = bx + 10; ax < bx + bw - 24; ax += 38) {
          ctx.beginPath();
          ctx.moveTo(ax,      y + h * 0.25); ctx.lineTo(ax + 14, y + h * 0.50);
          ctx.lineTo(ax,      y + h * 0.75); ctx.lineTo(ax + 10, y + h * 0.75);
          ctx.lineTo(ax + 24, y + h * 0.50); ctx.lineTo(ax + 10, y + h * 0.25);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    };

    fillBlock(0, gapX);
    fillBlock(gapEnd, w - gapEnd);

    // Glowing edges
    ctx.strokeStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (gapX > 0)   { ctx.moveTo(0,      y);     ctx.lineTo(gapX,   y);     }
    if (gapEnd < w) { ctx.moveTo(gapEnd, y);     ctx.lineTo(w,      y);     }
    if (gapX > 0)   { ctx.moveTo(0,      y + h); ctx.lineTo(gapX,   y + h); }
    if (gapEnd < w) { ctx.moveTo(gapEnd, y + h); ctx.lineTo(w,      y + h); }
    if (gapX > 0)   { ctx.moveTo(gapX,   y);     ctx.lineTo(gapX,   y + h); }
    if (gapEnd < w) { ctx.moveTo(gapEnd, y);     ctx.lineTo(gapEnd, y + h); }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gap interior glow
    ctx.save();
    ctx.globalAlpha = 0.28 * pulse;
    const gg = ctx.createLinearGradient(gapX, 0, gapEnd, 0);
    gg.addColorStop(0,   `rgba(${hexToRgb(accentColor)},0.6)`);
    gg.addColorStop(0.5, `rgba(${hexToRgb(accentColor)},0.15)`);
    gg.addColorStop(1,   `rgba(${hexToRgb(accentColor)},0.6)`);
    ctx.fillStyle = gg;
    ctx.fillRect(gapX, y, gapW, h);
    ctx.restore();

    // "FLY THROUGH" indicator
    ctx.fillStyle = `rgba(255,255,255,${0.8 * pulse})`;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓ FLY THROUGH ↓', gapX + gapW / 2, y + h / 2);
    ctx.shadowBlur = 0;

    // Label above gate
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(label, w / 2, y - 8);
  }

  // ── Wall (side corridor hazard) ───────────────────────────────────────────────
  private drawWall(ctx: CanvasRenderingContext2D, obs: LevelObstacle, now: number) {
    const { w, h, leftW, rightW, corridorX, corridorW, accentColor, label, kind } = obs;
    const pulse = 0.65 + Math.sin(now * 0.007) * 0.35;

    const drawOneSide = (wx: number, ww: number, innerEdge: number) => {
      if (ww <= 0) return;
      const towardInner = innerEdge > wx;

      if (kind === 'configWall') {
        // Matrix green — data streams
        const g = ctx.createLinearGradient(wx, 0, wx + ww, 0);
        g.addColorStop(0, towardInner ? 'rgba(0,25,8,0.75)'  : 'rgba(0,60,20,0.85)');
        g.addColorStop(1, towardInner ? 'rgba(0,60,20,0.85)' : 'rgba(0,25,8,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(wx, 0, ww, h);
        // Falling characters
        ctx.save();
        ctx.beginPath(); ctx.rect(wx, 0, ww, h); ctx.clip();
        ctx.fillStyle = `rgba(34,221,136,${0.16 * pulse})`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        const chars = ['0', '1', '$', '#', '@'];
        for (let col = wx + 8; col < wx + ww - 4; col += 14) {
          const charY = (now * 0.08 + col * 0.7) % h;
          ctx.fillText(chars[Math.floor(col * 0.1) % 5], col, charY);
          ctx.fillText(chars[Math.floor(col * 0.3) % 5], col, (charY + h * 0.45) % h);
        }
        ctx.restore();

      } else if (kind === 'qaWall') {
        // Orange scan zone
        const g = ctx.createLinearGradient(wx, 0, wx + ww, 0);
        g.addColorStop(0, towardInner ? 'rgba(40,15,0,0.75)'  : 'rgba(90,35,0,0.85)');
        g.addColorStop(1, towardInner ? 'rgba(90,35,0,0.85)'  : 'rgba(40,15,0,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(wx, 0, ww, h);
        // Horizontal scan beam
        const scanY = (now * 0.08) % h;
        ctx.fillStyle = `rgba(255,136,0,${0.12 * pulse})`;
        ctx.fillRect(wx, scanY, ww, 18);
        ctx.fillRect(wx, (scanY + h * 0.5) % h, ww, 10);

      } else if (kind === 'staleFog') {
        // Grey static fog
        const g = ctx.createLinearGradient(wx, 0, wx + ww, 0);
        g.addColorStop(0, towardInner ? 'rgba(18,22,35,0.55)'  : 'rgba(60,70,95,0.70)');
        g.addColorStop(1, towardInner ? 'rgba(60,70,95,0.70)'  : 'rgba(18,22,35,0.55)');
        ctx.fillStyle = g;
        ctx.fillRect(wx, 0, ww, h);
        // Noise stipple
        ctx.fillStyle = `rgba(136,153,187,${0.055 * pulse})`;
        for (let ny = 0; ny < h; ny += 6) {
          for (let nx = wx; nx < wx + ww; nx += 6) {
            if (Math.sin(nx * 0.31 + ny * 0.17 + now * 0.002) > 0.5) {
              ctx.fillRect(nx, ny, 2, 2);
            }
          }
        }
      }

      // Bright inner edge glow
      ctx.strokeStyle = `rgba(${hexToRgb(accentColor)},${0.9 * pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(innerEdge, 0); ctx.lineTo(innerEdge, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawOneSide(0,            leftW,  leftW);
    drawOneSide(w - rightW,   rightW, w - rightW);

    // Corridor safe-zone label
    const cx = corridorX + corridorW / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.65 * pulse})`;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx, 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(220,220,255,${0.50 * pulse})`;
    ctx.font = '11px monospace';
    ctx.fillText('◄─ SAFE ZONE ─►', cx, 26);
  }
}
