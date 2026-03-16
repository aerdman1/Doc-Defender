/**
 * SideScroller.ts — Contra-style bonus stage for Docs Defender
 * Free movement · mouse aim · Owlbert sprite · jetpack · multiple guns · god mode
 */

// ─── Types ────────────────────────────────────────────────────────────────────
type PlatformType = 'navTab' | 'loadingBar' | 'codeBlock' | 'card' | 'apiTunnel';
type SSEnemyType  = 'soldier' | 'charger' | 'flyer' | 'turret' | 'boss';
type GunType      = 'pistol' | 'shotgun' | 'rocket' | 'plasma';

interface SSPlatform {
  x: number; y: number; w: number; h: number;
  type: PlatformType; color: string; label: string;
}

interface SSEnemy {
  id: number;
  x: number; y: number; w: number; h: number;
  type: SSEnemyType;
  vx: number; vy: number;
  hp: number; maxHp: number;
  alive: boolean;
  facing: number;
  stateTimer: number;
  shootTimer: number;
  floatBase: number;
  floatOffset: number;
  spawnX: number;
  hitFlash: number;
  rushActive: boolean;
  onGround: boolean;
}

interface SSProjectile {
  x: number; y: number;
  vx: number; vy: number;
  fromPlayer: boolean;
  active: boolean;
  age: number;
  gunType: GunType;
}

interface SSParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface ScorePopup {
  x: number; y: number;
  text: string; color: string;
  life: number; maxLife: number;
}

interface SSCollectible {
  x: number; y: number;
  type: 'star' | 'hp' | 'ammo';
  gunType?: GunType;
  collected: boolean;
  anim: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SS_GRAVITY    = 1300;
const SS_JUMP_VY    = -650;
const SS_MAX_FALL   = 950;
const SS_WALK       = 210;
const SS_COYOTE     = 0.10;
const SS_JBUFFER    = 0.12;
const PW            = 36;
const PH            = 44;
const SS_BULLET_SPD = 750;
const SS_WORLD_W    = 7400;
const SS_FINISH_X   = 7100;
const SS_MAX_HP     = 6;

// Jetpack
const JET_THRUST    = 1400;
const JET_MAX_FUEL  = 1.0;
const JET_DRAIN     = 0.50;
const JET_RECHARGE  = 0.28;
const JET_AIR_RECH  = 0.07;

// Gun definitions
const GUN_STATS: Record<GunType, { rate: number; speed: number; color: string; label: string }> = {
  pistol:  { rate: 0.13, speed: 750, color: '#44FFEE', label: 'PISTOL'  },
  shotgun: { rate: 0.55, speed: 580, color: '#FF9933', label: 'SHOTGUN' },
  rocket:  { rate: 1.20, speed: 340, color: '#FF4400', label: 'ROCKET'  },
  plasma:  { rate: 0.06, speed: 980, color: '#CC44FF', label: 'PLASMA'  },
};
const GUN_ORDER: GunType[] = ['pistol', 'shotgun', 'rocket', 'plasma'];

const PLAT_COLOR: Record<PlatformType, string> = {
  navTab: '#3377EE', loadingBar: '#00BB88', codeBlock: '#EE9911',
  card: '#BB33EE', apiTunnel: '#EE5500',
};
const PLAT_LABEL: Record<PlatformType, string> = {
  navTab: 'NAV', loadingBar: 'LOAD', codeBlock: 'CODE', card: 'CARD', apiTunnel: 'API',
};

let _enemyId = 0;

// ─── SideScrollerEngine ──────────────────────────────────────────────────────
export class SideScrollerEngine {
  private canvas: HTMLCanvasElement;
  private onComplete: () => void;
  private onScoreBonus: (pts: number) => void;
  private godMode: boolean;

  // Player state
  private px = 100;
  private py = 0;
  private pvx = 0;
  private pvy = 0;
  private facing = 1;
  private onGround = false;
  private coyoteTimer = 0;
  private jumpBuffer = 0;
  private jumpQueued = false;
  private shootCooldown = 0;
  private invincibleTimer = 0;
  private hp = SS_MAX_HP;
  private kills = 0;

  // Jetpack
  private jetFuel = JET_MAX_FUEL;
  private jetActive = false;
  private jetParticleTimer = 0;

  // Gun
  private gunIndex = 0;
  private gunCycleDebounce = 0;

  // Player animation
  private runAnimT     = 0;
  private landSqzT     = 0;
  private shootRcl     = 0;
  private prevOnGround = false;
  private prevVY       = 0;
  private bossAlertShown = false;

  // Mouse / aim
  private mouseX = 0;
  private mouseY = 0;
  private mouseHeld = false;

  // Camera
  private camX = 0;

  // FX
  private shakeTimer = 0;
  private shakeAmt   = 0;
  private damageFlash = 0;
  private muzzleFlashTimer = 0;
  private muzzleAngle = 0;

  // Stage state
  private score = 0;
  private finished = false;
  private paused = false;
  private introTimer = 1.8;
  private outroTimer = 0;

  // Entities
  private platforms: SSPlatform[] = [];
  private enemies: SSEnemy[] = [];
  private projectiles: SSProjectile[] = [];
  private particles: SSParticle[] = [];
  private celebParticles: SSParticle[] = [];
  private collectibles: SSCollectible[] = [];
  private scorePopups: ScorePopup[] = [];

  private groundY = 0;

  // Owlbert skin
  private skinImg: HTMLImageElement | null = null;
  private skinLoaded = false;

  // Input
  private keys = new Set<string>();
  private _boundKeyDown!: (e: KeyboardEvent) => void;
  private _boundKeyUp!:   (e: KeyboardEvent) => void;
  private _boundMouseDown!: (e: MouseEvent) => void;
  private _boundMouseUp!:   (e: MouseEvent) => void;
  private _boundMouseMove!: (e: MouseEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onComplete: () => void,
    onScoreBonus: (pts: number) => void,
    skinSrc = '/owlbert.png',
    godMode = false,
  ) {
    this.canvas = canvas;
    this.onComplete = onComplete;
    this.onScoreBonus = onScoreBonus;
    this.godMode = godMode;
    this.groundY = canvas.height - 56;

    this.px = 80;
    this.py = this.groundY - PH;
    this.camX = 0;
    this.mouseX = canvas.width * 0.5;
    this.mouseY = canvas.height * 0.5;

    const img = new Image();
    img.onload = () => { this.skinLoaded = true; };
    img.src = skinSrc;
    this.skinImg = img;

    this.generateWorld();
    this.bindInput();
  }

  // ─── Input ──────────────────────────────────────────────────────────────────
  private bindInput() {
    this._boundKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (!this.finished && this.introTimer <= 0) this.paused = !this.paused;
        e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.jumpQueued = true;
        e.preventDefault();
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._boundKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    this._boundMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { this.mouseHeld = true; this.jumpQueued = true; }
    };
    this._boundMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouseHeld = false;
    };
    this._boundMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
      this.mouseY = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
    };
    window.addEventListener('keydown',   this._boundKeyDown,  { passive: false });
    window.addEventListener('keyup',     this._boundKeyUp);
    window.addEventListener('mousedown', this._boundMouseDown);
    window.addEventListener('mouseup',   this._boundMouseUp);
    window.addEventListener('mousemove', this._boundMouseMove);
  }

  destroy() {
    window.removeEventListener('keydown',   this._boundKeyDown);
    window.removeEventListener('keyup',     this._boundKeyUp);
    window.removeEventListener('mousedown', this._boundMouseDown);
    window.removeEventListener('mouseup',   this._boundMouseUp);
    window.removeEventListener('mousemove', this._boundMouseMove);
  }

  // ─── World Generation ───────────────────────────────────────────────────────
  private generateWorld() {
    const gY = this.groundY;

    const addP = (x: number, y: number, w: number, t: PlatformType) =>
      this.platforms.push({ x, y, w, h: 20, type: t, color: PLAT_COLOR[t], label: PLAT_LABEL[t] });

    const addE = (x: number, y: number, t: SSEnemyType) => {
      const dim: Record<SSEnemyType, [number, number]> = {
        soldier: [26, 34], charger: [30, 26], flyer: [32, 24], turret: [34, 40], boss: [84, 64],
      };
      const hpV: Record<SSEnemyType, number> = { soldier: 3, charger: 2, flyer: 2, turret: 6, boss: 25 };
      const [ew, eh] = dim[t];
      this.enemies.push({
        id: _enemyId++,
        x, y, w: ew, h: eh, type: t,
        vx: 0, vy: 0,
        hp: hpV[t], maxHp: hpV[t],
        alive: true,
        facing: -1,
        stateTimer: Math.random() * 1.5,
        shootTimer: 1.5 + Math.random() * 1.5,
        floatBase: y, floatOffset: Math.random() * Math.PI * 2,
        spawnX: x,
        hitFlash: 0, rushActive: false, onGround: true,
      });
    };

    const addC = (x: number, y: number, type: 'star' | 'hp' | 'ammo', gunType?: GunType) =>
      this.collectibles.push({ x, y, type, gunType, collected: false, anim: Math.random() * Math.PI * 2 });

    // ── Zone 0: Spawn safe zone ──────────────────────────────────────────────
    // nothing

    // ── Zone 1: BOOT SEQUENCE (x: 300–900) ──────────────────────────────────
    addE(450,  gY - 34, 'soldier');
    addE(650,  gY - 34, 'soldier');
    addE(820,  gY - 34, 'soldier');
    addC(560,  gY - 50, 'star');
    addC(720,  gY - 50, 'star');
    // Upper tier — jetpack area
    addP(380,  gY - 230, 130, 'navTab');
    addP(570,  gY - 320, 120, 'codeBlock');
    addP(740,  gY - 230, 130, 'navTab');
    addE(590,  gY - 320 - 34, 'soldier');
    addC(590,  gY - 370, 'ammo', 'shotgun');

    // ── Zone 2: NAV LAYER (x: 950–1750) ─────────────────────────────────────
    addP(980,  gY - 100, 200, 'navTab');
    addP(1240, gY - 170, 180, 'navTab');
    addP(1480, gY - 110, 220, 'navTab');
    addP(1700, gY - 55,  160, 'navTab');
    // Upper tier
    addP(990,  gY - 270, 150, 'codeBlock');
    addP(1200, gY - 360, 140, 'apiTunnel');
    addP(1430, gY - 280, 160, 'codeBlock');
    addP(1620, gY - 370, 130, 'card');
    // Enemies
    addE(1020, gY - 100 - 34, 'soldier');
    addE(1270, gY - 170 - 34, 'soldier');
    addE(1100, gY - 160,      'flyer');
    addE(1400, gY - 140,      'flyer');
    addE(1220, gY - 360 - 34, 'soldier');
    addE(1460, gY - 280 - 34, 'soldier');
    addC(1060, gY - 140, 'star');
    addC(1310, gY - 210, 'star');
    addC(1530, gY - 150, 'star');
    addC(1650, gY - 50,  'hp');
    addC(1220, gY - 405, 'ammo', 'rocket');
    addC(1640, gY - 415, 'star');

    // ── Zone 3: API WALL (x: 1850–2650) ─────────────────────────────────────
    addP(1870, gY - 30,  720, 'loadingBar');
    addP(1900, gY - 200, 220, 'apiTunnel');
    addP(2180, gY - 295, 180, 'card');
    addP(2430, gY - 200, 220, 'apiTunnel');
    addP(2310, gY - 385, 150, 'loadingBar');
    addE(1940, gY - 30  - 40, 'turret');
    addE(2150, gY - 30  - 40, 'turret');
    addE(2430, gY - 30  - 40, 'turret');
    addE(2000, gY - 30  - 26, 'charger');
    addE(2300, gY - 30  - 26, 'charger');
    addE(1950, gY - 200 - 34, 'soldier');
    addE(2210, gY - 295 - 34, 'soldier');
    addE(2460, gY - 200 - 26, 'charger');
    addC(2050, gY - 85,  'star');
    addC(2230, gY - 85,  'star');
    addC(2500, gY - 85,  'star');
    addC(2340, gY - 430, 'ammo', 'plasma');
    addC(2200, gY - 340, 'star');

    // ── Zone 4: COMPILE STORM (x: 2750–3600) ────────────────────────────────
    addP(2760, gY - 90,  160, 'codeBlock');
    addP(2980, gY - 155, 140, 'codeBlock');
    addP(3170, gY - 90,  180, 'codeBlock');
    addP(3410, gY - 170, 200, 'codeBlock');
    addP(2780, gY - 265, 150, 'navTab');
    addP(3000, gY - 355, 140, 'apiTunnel');
    addP(3220, gY - 275, 170, 'codeBlock');
    addP(3450, gY - 370, 140, 'card');
    addE(2790, gY - 90  - 34, 'soldier');
    addE(3010, gY - 155 - 34, 'soldier');
    addE(3200, gY - 90  - 26, 'charger');
    addE(3100, gY - 175,      'flyer');
    addE(3400, gY - 200,      'flyer');
    addE(2810, gY - 265 - 34, 'soldier');
    addE(3030, gY - 355 - 34, 'soldier');
    addC(2850, gY - 130, 'star');
    addC(3060, gY - 195, 'star');
    addC(3250, gY - 130, 'star');
    addC(3480, gY - 210, 'star');
    addC(3550, gY - 50,  'hp');
    addC(3020, gY - 395, 'star');
    addC(3470, gY - 415, 'hp');

    // ── Zone 5: FIREWALL BREACH (x: 3700–4600) ──────────────────────────────
    addP(3720, gY - 45,  500, 'card');
    addP(4280, gY - 130, 160, 'card');
    addP(4500, gY - 80,  240, 'card');
    addP(3740, gY - 240, 180, 'loadingBar');
    addP(3980, gY - 345, 160, 'navTab');
    addP(4240, gY - 265, 180, 'card');
    addP(4510, gY - 375, 150, 'codeBlock');
    addE(3780, gY - 45  - 40, 'turret');
    addE(4000, gY - 45  - 34, 'soldier');
    addE(4100, gY - 45  - 34, 'soldier');
    addE(4250, gY - 45  - 26, 'charger');
    addE(4310, gY - 130 - 40, 'turret');
    addE(3900, gY - 155,      'flyer');
    addE(4180, gY - 160,      'flyer');
    addE(3770, gY - 240 - 34, 'soldier');
    addE(4010, gY - 345 - 34, 'soldier');
    addE(4270, gY - 265 - 26, 'charger');
    addC(3830, gY - 85,  'star');
    addC(3980, gY - 85,  'star');
    addC(4150, gY - 85,  'star');
    addC(4360, gY - 170, 'star');
    addC(4580, gY - 120, 'star');
    addC(4010, gY - 390, 'ammo', 'shotgun');
    addC(4530, gY - 420, 'star');

    // ── Zone 6: SERVER ROOT (x: 4750–5700) ──────────────────────────────────
    addP(4760, gY - 110, 180, 'apiTunnel');
    addP(5000, gY - 180, 160, 'apiTunnel');
    addP(5230, gY - 110, 200, 'apiTunnel');
    addP(5500, gY - 55,  400, 'apiTunnel');
    addP(4780, gY - 285, 160, 'card');
    addP(5020, gY - 375, 150, 'codeBlock');
    addP(5260, gY - 285, 170, 'apiTunnel');
    addP(5520, gY - 235, 200, 'loadingBar');
    addP(5770, gY - 355, 140, 'navTab');
    addE(4790, gY - 110 - 34, 'soldier');
    addE(5020, gY - 180 - 34, 'soldier');
    addE(5260, gY - 110 - 26, 'charger');
    addE(5550, gY - 55  - 40, 'turret');
    addE(5720, gY - 55  - 40, 'turret');
    addE(4850, gY - 195,      'flyer');
    addE(5100, gY - 210,      'flyer');
    addE(5350, gY - 175,      'flyer');
    addE(5450, gY - 55  - 26, 'charger');
    addE(4810, gY - 285 - 34, 'soldier');
    addE(5050, gY - 375 - 34, 'soldier');
    addE(5550, gY - 235 - 40, 'turret');
    addC(4850, gY - 150, 'star');
    addC(5070, gY - 220, 'star');
    addC(5300, gY - 150, 'star');
    addC(5600, gY - 95,  'star');
    addC(5680, gY - 95,  'star');
    addC(5900, gY - 50,  'hp');
    addC(5040, gY - 420, 'ammo', 'rocket');
    addC(5790, gY - 400, 'star');

    // ── Zone 7: FINAL SPRINT (x: 5900–7100) ─────────────────────────────────
    for (let i = 0; i < 5; i++) addE(6000 + i * 220, gY - 34, 'soldier');
    addE(6100, gY - 170, 'flyer');
    addE(6350, gY - 170, 'flyer');
    addE(6600, gY - 170, 'flyer');
    addE(6200, gY - 34,  'charger');
    addE(6700, gY - 34,  'charger');
    addP(6150, gY - 90,  180, 'navTab');
    addP(6400, gY - 130, 140, 'codeBlock');
    addP(6650, gY - 90,  200, 'loadingBar');
    addP(6060, gY - 265, 160, 'card');
    addP(6290, gY - 355, 140, 'apiTunnel');
    addP(6530, gY - 275, 170, 'navTab');
    addP(6780, gY - 365, 140, 'codeBlock');
    addE(6090, gY - 265 - 34, 'soldier');
    addE(6320, gY - 355 - 34, 'soldier');
    addE(6560, gY - 275 - 26, 'charger');
    for (let i = 0; i < 8; i++) addC(6050 + i * 130, gY - 70, 'star');
    addC(6310, gY - 400, 'ammo', 'plasma');
    addC(6800, gY - 410, 'hp');

    // ── BOSS: CHAOS BUILD CORE (x: 6950) ─────────────────────────────────────
    addE(6950, gY - 64, 'boss');
    addC(6870, gY - 50, 'ammo', 'rocket');
    addC(6920, gY - 50, 'hp');
  }

  // ─── Update ─────────────────────────────────────────────────────────────────
  update(dt: number, now: number) {
    if (this.introTimer > 0) { this.introTimer -= dt; return; }
    if (this.outroTimer > 0) {
      this.updateParticles(dt);
      this.updateScorePopups(dt);
      this.outroTimer -= dt;
      if (this.outroTimer <= 0) this.onComplete();
      return;
    }
    if (this.finished) return;
    if (this.paused) return;

    // Decay FX timers
    if (this.shakeTimer       > 0) this.shakeTimer       = Math.max(0, this.shakeTimer - dt);
    if (this.damageFlash      > 0) this.damageFlash      = Math.max(0, this.damageFlash - dt * 3.5);
    if (this.muzzleFlashTimer > 0) this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt * 12);
    if (this.invincibleTimer  > 0) this.invincibleTimer -= dt;
    if (this.gunCycleDebounce > 0) this.gunCycleDebounce -= dt;
    if (this.landSqzT         > 0) this.landSqzT         = Math.max(0, this.landSqzT - dt * 5.5);
    if (this.shootRcl         > 0) this.shootRcl         = Math.max(0, this.shootRcl - dt * 7.0);

    this.prevOnGround = this.onGround;
    this.prevVY       = this.pvy;

    // ── Input ────────────────────────────────────────────────────────────────
    const left     = this.keys.has('ArrowLeft')  || this.keys.has('KeyA');
    const right    = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const jumpHeld = this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const shootHeld = this.mouseHeld
      || this.keys.has('KeyZ') || this.keys.has('KeyX')
      || this.keys.has('ControlLeft') || this.keys.has('ControlRight');

    // ── Gun cycling: Q / E ───────────────────────────────────────────────────
    if (this.gunCycleDebounce <= 0) {
      if (this.keys.has('KeyQ')) {
        this.gunIndex = (this.gunIndex - 1 + GUN_ORDER.length) % GUN_ORDER.length;
        this.gunCycleDebounce = 0.25;
        this.shootCooldown = 0;
      } else if (this.keys.has('KeyE')) {
        this.gunIndex = (this.gunIndex + 1) % GUN_ORDER.length;
        this.gunCycleDebounce = 0.25;
        this.shootCooldown = 0;
      }
    }

    // ── Player horizontal movement ───────────────────────────────────────────
    const accel = 14;
    if (right) {
      this.pvx = Math.min(SS_WALK, this.pvx + SS_WALK * accel * dt);
      this.facing = 1;
    } else if (left) {
      this.pvx = Math.max(-SS_WALK, this.pvx - SS_WALK * accel * dt);
      this.facing = -1;
    } else {
      const stopPow = this.onGround ? 14 : 4;
      this.pvx -= this.pvx * stopPow * dt;
      if (Math.abs(this.pvx) < 2) this.pvx = 0;
    }

    // Run animation timer
    if (this.onGround && (left || right)) this.runAnimT += dt;
    else this.runAnimT = 0;

    // ── Jump (coyote + buffer) ────────────────────────────────────────────────
    if (this.jumpQueued) { this.jumpBuffer = SS_JBUFFER; this.jumpQueued = false; }
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.onGround) { this.coyoteTimer = SS_COYOTE; }
    else if (this.coyoteTimer > 0) { this.coyoteTimer -= dt; }

    if (this.jumpBuffer > 0 && this.coyoteTimer > 0) {
      this.pvy = SS_JUMP_VY;
      this.jumpBuffer  = 0;
      this.coyoteTimer = 0;
    }

    // ── Jetpack ──────────────────────────────────────────────────────────────
    this.jetActive = false;
    if (jumpHeld && this.jetFuel > 0 && !this.onGround) {
      this.jetActive = true;
      this.pvy -= JET_THRUST * dt;
      this.pvy = Math.max(this.pvy, -560);  // cap upward speed
      this.jetFuel = Math.max(0, this.jetFuel - JET_DRAIN * dt);
      this.jetParticleTimer -= dt;
      if (this.jetParticleTimer <= 0) {
        this.jetParticleTimer = 0.025;
        this.spawnJetParticles();
      }
    } else {
      const rechRate = this.onGround ? JET_RECHARGE : JET_AIR_RECH;
      this.jetFuel = Math.min(JET_MAX_FUEL, this.jetFuel + rechRate * dt);
    }

    // ── Physics ──────────────────────────────────────────────────────────────
    this.pvy = Math.min(this.pvy + SS_GRAVITY * dt, SS_MAX_FALL);
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;

    this.px = Math.max(0, Math.min(this.px, SS_WORLD_W - PW));
    // Ceiling
    if (this.py < 18) { this.py = 18; if (this.pvy < 0) this.pvy = 0; }

    // Ground collision
    this.onGround = false;
    if (this.py + PH >= this.groundY) {
      this.py = this.groundY - PH;
      if (this.pvy > 0) this.pvy = 0;
      this.onGround = true;
    }
    // Platform collision (falling only)
    if (this.pvy > 0) {
      for (const p of this.platforms) {
        const prev = this.py + PH - this.pvy * dt;
        if (
          this.px + PW > p.x && this.px < p.x + p.w &&
          prev <= p.y + 2 &&
          this.py + PH >= p.y && this.py + PH <= p.y + p.h + 12
        ) {
          this.py = p.y - PH;
          this.pvy = 0;
          this.onGround = true;
        }
      }
    }
    if (this.onGround) this.coyoteTimer = SS_COYOTE;

    // Land squeeze
    if (this.onGround && !this.prevOnGround && this.prevVY > 120) {
      this.landSqzT = 1.0;
    }

    // Fall death
    if (this.py > this.canvas.height + 100) {
      if (!this.godMode) {
        this.hp = Math.max(0, this.hp - 1);
        this.invincibleTimer = 2.5;
        this.damageFlash = 1.0;
        this.startShake(12, 0.4);
        if (this.hp <= 0) { this.finished = true; this.outroTimer = 2.5; }
      }
      this.px  = Math.max(80, this.camX + this.canvas.width * 0.15);
      this.py  = this.groundY - PH;
      this.pvy = 0; this.pvx = 0;
    }

    // ── Camera ───────────────────────────────────────────────────────────────
    const lead = this.facing * 70;
    const targetCam  = this.px - this.canvas.width * 0.40 + lead;
    const clampedCam = Math.max(0, Math.min(targetCam, SS_WORLD_W - this.canvas.width));
    this.camX += (clampedCam - this.camX) * Math.min(1, dt * 7);

    // ── Shooting ─────────────────────────────────────────────────────────────
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    const gun = GUN_ORDER[this.gunIndex];
    if (shootHeld && this.shootCooldown <= 0) {
      this.fire(gun);
      this.shootCooldown = GUN_STATS[gun].rate;
    }

    this.updateEnemies(dt, now);
    this.updateProjectiles(dt);
    this.updateCollectibles();
    this.updateParticles(dt);
    this.updateScorePopups(dt);

    if (this.px + PW >= SS_FINISH_X && !this.finished) {
      this.finished = true;
      this.outroTimer = 3.5;
      this.spawnCelebration();
      this.startShake(8, 0.6);
    }
  }

  // ─── Fire ────────────────────────────────────────────────────────────────────
  private fire(gun: GunType) {
    const pivotX = this.px - this.camX + PW / 2;
    const pivotY = this.py + PH * 0.44;
    const dx = this.mouseX - pivotX;
    const dy = this.mouseY - pivotY;
    const ang = (Math.abs(dx) < 8 && Math.abs(dy) < 8)
      ? (this.facing > 0 ? 0 : Math.PI)
      : Math.atan2(dy, dx);
    this.muzzleAngle = ang;
    this.muzzleFlashTimer = 0.08;
    this.shootRcl = gun === 'rocket' ? 1.0 : gun === 'shotgun' ? 0.8 : 0.5;

    const spd = GUN_STATS[gun].speed;
    const ox  = this.px + PW / 2 + Math.cos(ang) * (PW * 0.5 + 2);
    const oy  = this.py + PH * 0.44 + Math.sin(ang) * (PW * 0.5 + 2);

    if (gun === 'shotgun') {
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.11 + (Math.random() - 0.5) * 0.06;
        this.projectiles.push({ x: ox, y: oy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, fromPlayer: true, active: true, age: 0, gunType: 'shotgun' });
      }
    } else {
      this.projectiles.push({ x: ox, y: oy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, fromPlayer: true, active: true, age: 0, gunType: gun });
    }
  }

  // ─── Enemy AI ────────────────────────────────────────────────────────────────
  private updateEnemies(dt: number, now: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 8);

      const dx   = this.px + PW / 2 - (e.x + e.w / 2);
      const dist = Math.abs(dx);

      if (e.type === 'soldier') {
        e.facing = dx < 0 ? -1 : 1;
        e.stateTimer -= dt;
        if (dist < 500) {
          e.vx = e.facing * 45;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = 2.4 + Math.random() * 1.4;
            this.enemyShoot(e, 0);
            setTimeout(() => { if (e.alive) this.enemyShoot(e, 0); }, 140);
          }
        } else {
          if (Math.abs(e.x - e.spawnX) > 100) e.vx = e.x < e.spawnX ? 50 : -50;
          else if (e.vx === 0) e.vx = 50;
          e.facing = e.vx > 0 ? 1 : -1;
        }
        e.x += e.vx * dt;
        e.x = Math.max(e.spawnX - 130, Math.min(e.spawnX + 130, e.x));

      } else if (e.type === 'charger') {
        if (dist < 360 && !e.rushActive) { e.rushActive = true; e.stateTimer = 2.5; }
        if (e.rushActive) {
          e.vx = e.facing * 210;
          e.facing = dx < 0 ? -1 : 1;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0 || dist > 500) { e.rushActive = false; e.stateTimer = 1.5 + Math.random(); }
        } else {
          e.vx = e.facing * 38;
          if (Math.abs(e.x - e.spawnX) > 80) e.vx = e.x < e.spawnX ? 38 : -38;
          e.facing = e.vx > 0 ? 1 : -1;
        }
        e.x += e.vx * dt;

      } else if (e.type === 'flyer') {
        e.floatOffset += dt * 2.2;
        e.y = e.floatBase + Math.sin(e.floatOffset) * 28;
        const targetX = this.px + PW / 2 - e.w / 2;
        if (e.x < targetX - 10) e.x += 70 * dt;
        else if (e.x > targetX + 10) e.x -= 70 * dt;
        e.facing = dx < 0 ? -1 : 1;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 450) {
          e.shootTimer = 1.6 + Math.random() * 1.0;
          this.enemyShoot(e, Math.PI / 2 + (Math.random() - 0.5) * 0.4);
        }

      } else if (e.type === 'turret') {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 650) {
          const burst = e.hp <= e.maxHp / 2 ? 3 : 2;
          e.shootTimer = (e.hp <= e.maxHp / 2 ? 1.6 : 2.2) + Math.random() * 0.8;
          for (let i = 0; i < burst; i++) {
            setTimeout(() => { if (e.alive) this.enemyShoot(e, (i - (burst - 1) / 2) * 0.18); }, i * 110);
          }
        }
        e.facing = dx < 0 ? -1 : 1;

      } else if (e.type === 'boss') {
        // Phase transition: phase2 = rushActive
        if (!e.rushActive && e.hp <= Math.floor(e.maxHp / 2)) {
          e.rushActive = true;
          this.startShake(18, 0.7);
          this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#FF4400', 40);
          this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#FFCC00', 20);
        }
        const phase2 = e.rushActive;
        e.facing = dx < 0 ? -1 : 1;

        // Walk toward player
        if (dist > 120) {
          const spd = phase2 ? 85 : 55;
          e.vx = e.facing * spd;
        } else {
          e.vx *= (1 - dt * 6);
        }
        e.x += e.vx * dt;
        e.x = Math.max(10, Math.min(SS_WORLD_W - e.w - 10, e.x));

        // Shoot: floatOffset = shoot timer (initialized > 0 from spawn)
        e.floatOffset -= dt;
        if (e.floatOffset <= 0 && dist < 900) {
          const numShots = phase2 ? 5 : 3;
          const interval = phase2 ? 1.3 : 2.0;
          e.floatOffset = interval + Math.random() * 0.5;
          for (let i = 0; i < numShots; i++) {
            const spread = 0.24;
            const offset = (i - (numShots - 1) / 2) * spread;
            setTimeout(() => { if (e.alive) this.enemyShoot(e, offset); }, i * 80);
          }
        }

        // Phase 2: rapid burst (stateTimer used for burst cooldown)
        if (phase2) {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0 && dist < 600) {
            e.stateTimer = 3.0 + Math.random() * 1.0;
            for (let i = 0; i < 3; i++) {
              setTimeout(() => { if (e.alive) this.enemyShoot(e, (Math.random() - 0.5) * 0.15); }, i * 120);
            }
          }
        }
      }

      // Contact damage
      if (!this.godMode && this.invincibleTimer <= 0 &&
          this.px < e.x + e.w && this.px + PW > e.x &&
          this.py < e.y + e.h && this.py + PH  > e.y) {
        this.takeDamage(e.x + e.w / 2, e.y + e.h / 2);
      }
    }
    // suppress unused warning
    void now;
  }

  private enemyShoot(e: SSEnemy, angleOffset: number) {
    const ex = e.x + e.w / 2, ey = e.y + e.h * 0.45;
    const ang = Math.atan2(this.py + PH * 0.45 - ey, this.px + PW / 2 - ex) + angleOffset;
    this.projectiles.push({ x: ex, y: ey, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220, fromPlayer: false, active: true, age: 0, gunType: 'pistol' });
  }

  private takeDamage(ox: number, oy: number) {
    if (this.godMode) return;
    this.hp = Math.max(0, this.hp - 1);
    this.invincibleTimer = 2.4;
    this.damageFlash = 1.0;
    this.startShake(10, 0.3);
    this.spawnParticles(ox, oy, '#FF3355', 12);
    if (this.hp <= 0) { this.finished = true; this.outroTimer = 2.5; }
  }

  // ─── Projectiles ─────────────────────────────────────────────────────────────
  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      if (p.x < this.camX - 80 || p.x > this.camX + this.canvas.width + 80 ||
          p.y < -100 || p.y > this.canvas.height + 100 || p.age > 3) {
        p.active = false; continue;
      }
      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
            const dmg = p.gunType === 'rocket' ? 4 : p.gunType === 'plasma' ? 2 : 1;
            e.hp -= dmg;
            e.hitFlash = 1.0;
            p.active = false;
            if (p.gunType === 'rocket') this.explode(p.x, p.y);
            if (e.hp <= 0) {
              e.alive = false;
              const col = e.type === 'soldier' ? '#FF3333' : e.type === 'charger' ? '#FF8800' : e.type === 'flyer' ? '#FFCC00' : e.type === 'boss' ? '#FF2200' : '#AA44FF';
              this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, col, e.type === 'boss' ? 60 : 16);
              this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#FFFFFF', e.type === 'boss' ? 20 : 6);
              if (e.type === 'boss') this.startShake(22, 1.2);
              const pts = e.type === 'boss' ? 2500 : e.type === 'turret' ? 300 : e.type === 'soldier' ? 150 : 100;
              this.score += pts; this.kills++;
              this.onScoreBonus(pts);
              this.scorePopups.push({ x: e.x + e.w / 2, y: e.y, text: `+${pts}`, color: col, life: e.type === 'boss' ? 2.5 : 1.2, maxLife: e.type === 'boss' ? 2.5 : 1.2 });
              this.startShake(e.type === 'boss' ? 22 : 4, e.type === 'boss' ? 1.2 : 0.15);
            } else {
              this.spawnHitSparks(p.x, p.y, p.vx, p.vy, '#FFDD88', 6);
            }
            break;
          }
        }
      } else {
        if (!this.godMode && this.invincibleTimer <= 0 &&
            p.x > this.px && p.x < this.px + PW &&
            p.y > this.py && p.y < this.py + PH) {
          p.active = false;
          this.takeDamage(p.x, p.y);
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.active);
  }

  private explode(x: number, y: number) {
    const radius = 90;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const edx = e.x + e.w / 2 - x, edy = e.y + e.h / 2 - y;
      if (Math.sqrt(edx * edx + edy * edy) < radius) {
        e.hp -= 2; e.hitFlash = 1.0;
        if (e.hp <= 0) {
          e.alive = false;
          this.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#FF8800', 20);
          const pts = e.type === 'turret' ? 300 : 150;
          this.score += pts; this.kills++; this.onScoreBonus(pts);
          this.scorePopups.push({ x: e.x + e.w / 2, y: e.y, text: `+${pts}`, color: '#FF8800', life: 1.2, maxLife: 1.2 });
        }
      }
    }
    this.spawnParticles(x, y, '#FF6600', 28);
    this.spawnParticles(x, y, '#FFCC44', 14);
    this.startShake(10, 0.35);
  }

  // ─── Collectibles ─────────────────────────────────────────────────────────────
  private updateCollectibles() {
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.anim += 0.05;
      const cx = c.x + 10, cy = c.y + 10;
      if (this.px < cx + 14 && this.px + PW > cx - 14 &&
          this.py < cy + 14 && this.py + PH  > cy - 14) {
        c.collected = true;
        if (c.type === 'star') {
          this.score += 50; this.onScoreBonus(50);
          this.spawnParticles(cx, cy, '#FFD700', 8);
          this.scorePopups.push({ x: cx, y: cy - 10, text: '+50', color: '#FFD700', life: 1.0, maxLife: 1.0 });
        } else if (c.type === 'hp') {
          this.hp = Math.min(SS_MAX_HP, this.hp + 1);
          this.spawnParticles(cx, cy, '#44FF88', 10);
          this.scorePopups.push({ x: cx, y: cy - 10, text: '+HP', color: '#44FF88', life: 1.0, maxLife: 1.0 });
        } else if (c.type === 'ammo' && c.gunType) {
          this.gunIndex = GUN_ORDER.indexOf(c.gunType);
          this.shootCooldown = 0;
          const col = GUN_STATS[c.gunType].color;
          this.spawnParticles(cx, cy, col, 14);
          this.scorePopups.push({ x: cx, y: cy - 10, text: GUN_STATS[c.gunType].label + '!', color: col, life: 1.4, maxLife: 1.4 });
          this.startShake(3, 0.12);
        }
      }
    }
  }

  // ─── Particles ───────────────────────────────────────────────────────────────
  private updateParticles(dt: number) {
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.celebParticles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
    this.celebParticles = this.celebParticles.filter(p => p.life > 0);
  }

  private updateScorePopups(dt: number) {
    for (const p of this.scorePopups) p.life -= dt;
    this.scorePopups = this.scorePopups.filter(p => p.life > 0);
  }

  private spawnParticles(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 70 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.45, maxLife: 0.8, color, size: 2.5 + Math.random() * 5 });
    }
  }

  private spawnHitSparks(x: number, y: number, bvx: number, bvy: number, color: string, n: number) {
    const len = Math.sqrt(bvx * bvx + bvy * bvy) || 1;
    const nx = bvx / len, ny = bvy / len;
    for (let i = 0; i < n; i++) {
      const fwd   = Math.random() * 120 + 60;  // forward bias
      const perp  = (Math.random() - 0.5) * 200;
      const vx    = nx * fwd - ny * perp + (Math.random() - 0.5) * 40;
      const vy    = ny * fwd + nx * perp + (Math.random() - 0.5) * 40;
      this.particles.push({
        x, y, vx, vy,
        life: 0.20 + Math.random() * 0.30, maxLife: 0.50,
        color: i < n * 0.4 ? '#FFFFFF' : color,
        size: 1.5 + Math.random() * 3.5,
      });
    }
  }

  private spawnJetParticles() {
    // Nozzle is at the bottom-back of the jetpack pack
    const packX = this.px + (this.facing > 0 ? 0 : PW - 2);
    const jx = packX + 5, jy = this.py + PH * 0.38 + 22;
    const colors = ['#FF6600', '#FF9900', '#FFCC44', '#FFFFFF', '#FF4400'];
    for (let i = 0; i < 4; i++) {
      const hot = i < 2;
      this.particles.push({
        x: jx + (Math.random() - 0.5) * 6, y: jy,
        vx: (Math.random() - 0.5) * 55, vy: 100 + Math.random() * 160,
        life: 0.12 + Math.random() * 0.20, maxLife: 0.32,
        color: hot ? '#FFFFFF' : colors[Math.floor(Math.random() * colors.length)],
        size: hot ? 2 + Math.random() * 2 : 3 + Math.random() * 6,
      });
    }
  }

  private spawnCelebration() {
    const colors = ['#FFD700','#FF6600','#00CCFF','#CC44FF','#00FF88','#FFFFFF'];
    for (let i = 0; i < 80; i++) {
      this.celebParticles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: this.canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 480, vy: -260 - Math.random() * 340,
        life: 1.5 + Math.random() * 1.0, maxLife: 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 8,
      });
    }
  }

  private startShake(amt: number, dur = 0.2) {
    this.shakeAmt   = Math.max(this.shakeAmt, amt);
    this.shakeTimer = Math.max(this.shakeTimer, dur);
  }

  // ─── Draw ────────────────────────────────────────────────────────────────────
  draw(ctx: CanvasRenderingContext2D, now: number) {
    const W = this.canvas.width, H = this.canvas.height, cx = this.camX;

    this.drawBackground(ctx, cx, W, H, now);

    ctx.save();
    if (this.shakeTimer > 0) {
      const s = (this.shakeTimer / 0.25) * this.shakeAmt;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // Ground — PCB-style
    const gY2 = this.groundY;
    ctx.fillStyle = '#0b1628'; ctx.fillRect(0, gY2, W, H - gY2);
    // Ground line glow
    ctx.strokeStyle = '#2255AA'; ctx.shadowColor = '#2255AA'; ctx.shadowBlur = 14; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, gY2); ctx.lineTo(W, gY2); ctx.stroke();
    ctx.shadowBlur = 0;
    // PCB traces
    const traceOff = (-(cx * 0.85) % 80 + 80) % 80;
    ctx.strokeStyle = 'rgba(30,90,220,0.22)'; ctx.lineWidth = 1;
    for (let gx = traceOff; gx < W; gx += 80) {
      ctx.beginPath(); ctx.moveTo(gx, gY2 + 10); ctx.lineTo(gx, gY2 + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx, gY2 + 20); ctx.lineTo(gx + 40, gY2 + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx + 40, gY2 + 20); ctx.lineTo(gx + 40, gY2 + 32); ctx.stroke();
      // Via pads
      ctx.fillStyle = 'rgba(0,100,255,0.20)';
      ctx.beginPath(); ctx.arc(gx, gY2 + 10, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gx + 40, gY2 + 32, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Finish line
    const finSX = SS_FINISH_X - cx;
    if (finSX > -60 && finSX < W + 60) {
      ctx.save();
      ctx.strokeStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 20; ctx.lineWidth = 4; ctx.setLineDash([14, 8]);
      ctx.beginPath(); ctx.moveTo(finSX, 0); ctx.lineTo(finSX, this.groundY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', finSX, 34);
      ctx.restore();
    }

    // Platforms
    for (const p of this.platforms) {
      const sx = p.x - cx;
      if (sx + p.w < 0 || sx > W) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 2, p.y + p.h, p.w, 6);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(sx, p.y, p.w, 3);
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(p.label, sx + p.w / 2, p.y + 13);
      ctx.restore();
    }

    // Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const sx = c.x - cx;
      if (sx < -24 || sx > W + 24) continue;
      const bob = Math.sin(c.anim) * 5;
      ctx.save();
      if (c.type === 'star') {
        ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(sx + 10, c.y + 10 + bob, 9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('★', sx + 10, c.y + 14 + bob);
      } else if (c.type === 'hp') {
        ctx.fillStyle = '#22CC66'; ctx.shadowColor = '#22CC66'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(sx + 10, c.y + 10 + bob, 10, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 10, c.y + 5 + bob); ctx.lineTo(sx + 10, c.y + 15 + bob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + 5,  c.y + 10 + bob); ctx.lineTo(sx + 15, c.y + 10 + bob); ctx.stroke();
      } else if (c.type === 'ammo' && c.gunType) {
        const col = GUN_STATS[c.gunType].color;
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.roundRect(sx, c.y + bob, 28, 20, 5); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#000'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillText(GUN_STATS[c.gunType].label.slice(0, 4), sx + 14, c.y + 13 + bob);
      }
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sx = e.x - cx;
      if (sx + e.w < -30 || sx > W + 30) continue;
      this.drawEnemy(ctx, e, sx, now);
    }

    // Projectiles
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const sx = p.x - cx;
      ctx.save();
      if (p.fromPlayer) {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.translate(sx, p.y); ctx.rotate(ang);
        if (p.gunType === 'rocket') {
          ctx.fillStyle = '#FF4400'; ctx.shadowColor = '#FF4400'; ctx.shadowBlur = 16; ctx.fillRect(-14, -5, 28, 10);
          ctx.fillStyle = '#FFCC44'; ctx.fillRect(-14, -3, 5, 6);
          ctx.globalAlpha = 0.6 + Math.random() * 0.4; ctx.fillStyle = '#FF8800';
          ctx.beginPath(); ctx.arc(-18, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
        } else if (p.gunType === 'shotgun') {
          ctx.fillStyle = '#FF9933'; ctx.shadowColor = '#FF9933'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        } else if (p.gunType === 'plasma') {
          ctx.fillStyle = '#CC44FF'; ctx.shadowColor = '#CC44FF'; ctx.shadowBlur = 18; ctx.fillRect(-8, -2, 16, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(6, 0, 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = '#44FFEE'; ctx.shadowColor = '#44FFEE'; ctx.shadowBlur = 12; ctx.fillRect(-10, -3, 20, 6);
          ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 0; ctx.fillRect(6, -2, 4, 4);
        }
      } else {
        ctx.fillStyle = '#FF3333'; ctx.shadowColor = '#FF3333'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(sx, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF8888'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(sx, p.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Particles (world-space)
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x - cx, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    this.drawPlayer(ctx, now);
    ctx.restore(); // end shake

    // Score popups
    for (const sp of this.scorePopups) {
      const alpha = sp.life / sp.maxLife;
      const floatY = sp.y - (1 - sp.life / sp.maxLife) * 45;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = sp.color; ctx.shadowColor = sp.color; ctx.shadowBlur = 8;
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sp.text, sp.x - cx, floatY);
      ctx.restore();
    }

    // Celebration particles
    for (const p of this.celebParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }

    this.drawHUD(ctx, now);

    if (this.damageFlash > 0) {
      ctx.save(); ctx.globalAlpha = this.damageFlash * 0.38;
      ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (this.introTimer > 0) this.drawIntroBanner(ctx);
    if (this.finished && this.outroTimer > 0) this.drawOutroBanner(ctx);
    if (this.paused) this.drawPauseBanner(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, cx: number, W: number, H: number, now: number) {
    // Base fill + scanlines
    ctx.fillStyle = '#070e1c'; ctx.fillRect(0, 0, W, H);
    const scanOffset = (now * 0.028 * 1000) % 90;
    ctx.strokeStyle = 'rgba(0,80,220,0.04)'; ctx.lineWidth = 1;
    for (let y = scanOffset; y < H; y += 90) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Layer 1: Server racks (parallax 0.04x) ──────────────────────────────
    const L1 = cx * 0.04;
    ctx.save();
    for (let bx = ((-L1 % 220) + 220) % 220; bx < W + 40; bx += 220) {
      const rH = 160 + (Math.sin(bx * 0.019) * 0.5 + 0.5) * 80;
      const rY = this.groundY - rH;
      ctx.fillStyle = 'rgba(8,18,45,0.85)';
      ctx.fillRect(bx - 16, rY, 36, rH);
      // rack dividers
      ctx.strokeStyle = 'rgba(20,60,130,0.4)'; ctx.lineWidth = 1;
      for (let ry = rY + 16; ry < this.groundY - 8; ry += 20) {
        ctx.beginPath(); ctx.moveTo(bx - 14, ry); ctx.lineTo(bx + 18, ry); ctx.stroke();
      }
      // blinking LEDs
      for (let li = 0; li < 5; li++) {
        const ledY = rY + 10 + li * 20;
        const blink = Math.sin(now * 0.002 * (1 + li * 0.7 + bx * 0.003)) > 0.3;
        const ledCol = [['#00FF88','#33FF44'],['#FF3344','#FF8888'],['#0088FF','#44CCFF'],['#FFAA00','#FFDD44'],['#CC44FF','#EE88FF']][li % 5];
        ctx.fillStyle = blink ? ledCol[1] : ledCol[0];
        ctx.shadowColor = blink ? ledCol[1] : 'transparent'; ctx.shadowBlur = blink ? 6 : 0;
        ctx.beginPath(); ctx.arc(bx + 2, ledY, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // ── Layer 2: Browser chrome (parallax 0.15x) ────────────────────────────
    const L2 = cx * 0.15;
    ctx.save(); ctx.globalAlpha = 0.22;
    for (let bx = ((-L2 % 380) + 380) % 380; bx < W + 80; bx += 380) {
      const wY = this.groundY - 260 - Math.sin(bx * 0.011) * 40;
      const wW = 110, wH = 80;
      ctx.fillStyle = 'rgba(10,24,60,0.9)'; ctx.fillRect(bx, wY, wW, wH);
      // title bar
      ctx.fillStyle = 'rgba(30,60,140,0.9)'; ctx.fillRect(bx, wY, wW, 18);
      // traffic lights
      ctx.fillStyle = '#FF5F56'; ctx.beginPath(); ctx.arc(bx + 8, wY + 9, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFBD2E'; ctx.beginPath(); ctx.arc(bx + 20, wY + 9, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27C93F'; ctx.beginPath(); ctx.arc(bx + 32, wY + 9, 4, 0, Math.PI * 2); ctx.fill();
      // address bar
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx + 8, wY + 22, wW - 16, 10);
      // content lines
      ctx.fillStyle = 'rgba(100,180,255,0.15)';
      for (let li = 0; li < 4; li++) ctx.fillRect(bx + 8, wY + 38 + li * 10, wW - 16 - li * 12, 5);
    }
    ctx.restore();

    // ── Layer 3: Code terminals (parallax 0.30x) ────────────────────────────
    const L3 = cx * 0.30;
    ctx.save(); ctx.globalAlpha = 0.28;
    for (let bx = ((-L3 % 310) + 310) % 310; bx < W + 60; bx += 310) {
      const tY = this.groundY - 200 + Math.sin(bx * 0.017) * 30;
      const tW = 90, tH = 70;
      ctx.fillStyle = 'rgba(0,8,20,0.95)'; ctx.fillRect(bx, tY, tW, tH);
      ctx.strokeStyle = 'rgba(0,200,100,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx, tY, tW, tH);
      // code lines
      const lineColors = ['rgba(0,220,120,0.45)','rgba(100,180,255,0.35)','rgba(255,200,50,0.3)','rgba(180,120,255,0.3)'];
      for (let li = 0; li < 5; li++) {
        const lw = 20 + (Math.sin(bx * 0.1 + li * 1.7) * 0.5 + 0.5) * 50;
        ctx.fillStyle = lineColors[li % lineColors.length];
        ctx.fillRect(bx + 6, tY + 10 + li * 11, lw, 4);
      }
      // blinking cursor
      if (Math.floor(now * 0.0015) % 2 === 0) {
        ctx.fillStyle = 'rgba(0,255,120,0.7)'; ctx.fillRect(bx + 8, tY + 60, 6, 7);
      }
    }
    ctx.restore();

    // ── Layer 4: Structural columns (parallax 0.65x) ────────────────────────
    const L4 = cx * 0.65;
    ctx.save();
    for (let bx = ((-L4 % 450) + 450) % 450; bx < W + 30; bx += 450) {
      const cW = 24;
      ctx.fillStyle = 'rgba(8,16,42,0.75)'; ctx.fillRect(bx, 0, cW, this.groundY);
      // Left edge glow
      ctx.fillStyle = 'rgba(0,80,220,0.18)'; ctx.fillRect(bx, 0, 3, this.groundY);
      ctx.fillStyle = 'rgba(0,80,220,0.10)'; ctx.fillRect(bx + cW - 3, 0, 3, this.groundY);
      // Horizontal bands
      ctx.strokeStyle = 'rgba(30,100,220,0.20)'; ctx.lineWidth = 1;
      for (let ry = 40; ry < this.groundY; ry += 50) {
        ctx.beginPath(); ctx.moveTo(bx, ry); ctx.lineTo(bx + cW, ry); ctx.stroke();
      }
    }
    ctx.restore();

    // ── Subtle grid overlay ──────────────────────────────────────────────────
    const gridOff = ((-cx * 0.06 % 80) + 80) % 80;
    ctx.strokeStyle = 'rgba(0,50,160,0.07)'; ctx.lineWidth = 1;
    for (let gx = gridOff; gx < W; gx += 80) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
  }

  private drawPlatform(ctx: CanvasRenderingContext2D, p: SSPlatform, sx: number, now: number) {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(sx + 3, p.y + p.h, p.w, 7);

    if (p.type === 'navTab') {
      // Browser nav-tab style: rounded pill top, address bar look
      ctx.fillStyle = '#1a3a7a';
      ctx.beginPath(); ctx.roundRect(sx, p.y, p.w, p.h, [6, 6, 0, 0]); ctx.fill();
      ctx.fillStyle = '#2a5aaa'; ctx.fillRect(sx, p.y + p.h - 4, p.w, 4);
      // URL dots
      ctx.fillStyle = 'rgba(100,180,255,0.45)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(sx + 8 + i * 7, p.y + 9, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + 30, p.y + 5, p.w - 38, 8);
      ctx.shadowColor = '#4488EE'; ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(60,120,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx, p.y, p.w, p.h, [6, 6, 0, 0]); ctx.stroke();

    } else if (p.type === 'loadingBar') {
      // Animated loading bar
      ctx.fillStyle = '#0a2a1a'; ctx.fillRect(sx, p.y, p.w, p.h);
      const fill = ((now * 0.0006 + sx * 0.003) % 1);
      const fillW = p.w * fill;
      ctx.fillStyle = '#00BB88';
      ctx.shadowColor = '#00EE99'; ctx.shadowBlur = 10;
      ctx.fillRect(sx, p.y, fillW, p.h);
      // Animated stripe overlay
      ctx.save();
      ctx.beginPath(); ctx.rect(sx, p.y, fillW, p.h); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 6;
      const stripeOff = (now * 0.06) % 12;
      for (let x = sx - 12 + stripeOff; x < sx + fillW + 12; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x + p.h * 0.8, p.y + p.h); ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,200,120,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(fill * 100)}%`, sx + p.w - 4, p.y + 13);

    } else if (p.type === 'codeBlock') {
      // Terminal-style dark block
      ctx.fillStyle = '#0d1520'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#1a2a10'; ctx.fillRect(sx, p.y, p.w, 6);
      // Code lines
      ctx.fillStyle = '#EE9911'; ctx.shadowColor = '#EE9911'; ctx.shadowBlur = 4;
      const lineW1 = 14 + (p.w * 0.4);
      ctx.fillRect(sx + 4, p.y + 8, Math.min(lineW1, p.w - 8), 3);
      ctx.fillStyle = 'rgba(100,200,80,0.6)'; ctx.shadowBlur = 0;
      ctx.fillRect(sx + 4, p.y + 13, Math.min(p.w * 0.6, p.w - 8), 2);
      // Blinking cursor
      if (Math.floor(now * 0.0013) % 2 === 0) {
        ctx.fillStyle = '#EE9911'; ctx.fillRect(sx + 4, p.y + 8, 5, 10);
      }
      ctx.strokeStyle = 'rgba(220,150,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(sx, p.y, p.w, p.h);

    } else if (p.type === 'card') {
      // Dark panel with purple accent
      ctx.fillStyle = '#12082a'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(180,60,255,0.25)'; ctx.fillRect(sx, p.y, 3, p.h);
      ctx.fillStyle = 'rgba(180,60,255,0.25)'; ctx.fillRect(sx + p.w - 3, p.y, 3, p.h);
      ctx.shadowColor = '#CC44FF'; ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(180,60,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx, p.y, p.w, 3);
      ctx.shadowBlur = 0;

    } else if (p.type === 'apiTunnel') {
      // Ribbed pipe with end caps
      ctx.fillStyle = '#2a1800'; ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.shadowColor = '#FF6600'; ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(255,120,0,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(sx, p.y, p.w, p.h);
      ctx.shadowBlur = 0;
      // Ribs
      ctx.strokeStyle = 'rgba(255,140,30,0.3)'; ctx.lineWidth = 1;
      for (let rx = sx + 8; rx < sx + p.w - 4; rx += 10) {
        ctx.beginPath(); ctx.moveTo(rx, p.y + 2); ctx.lineTo(rx, p.y + p.h - 2); ctx.stroke();
      }
      // End caps
      ctx.fillStyle = 'rgba(255,100,0,0.5)';
      ctx.fillRect(sx, p.y, 5, p.h); ctx.fillRect(sx + p.w - 5, p.y, 5, p.h);
      // Center glow pipe
      ctx.fillStyle = 'rgba(255,160,50,0.18)'; ctx.fillRect(sx + 5, p.y + 4, p.w - 10, p.h - 8);
    }

    // Top highlight
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx, p.y, p.w, 2);
    ctx.globalAlpha = 1.0;
    ctx.restore();
    void now;
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: SSEnemy, sx: number, now: number) {
    ctx.save();
    const flash = e.hitFlash > 0;
    if (e.type === 'soldier') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#CC2222'; ctx.shadowColor = flash ? '#FFFFFF' : '#FF0000'; ctx.shadowBlur = flash ? 16 : 8;
      ctx.fillRect(sx + 4, e.y + 8, e.w - 8, e.h - 16);
      ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + 7, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = flash ? '#FF8888' : '#FFFF00';
      ctx.beginPath(); ctx.arc(e.facing > 0 ? sx + e.w / 2 + 3 : sx + e.w / 2 - 3, e.y + 6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#888'; ctx.fillRect(sx + e.w / 2 + e.facing * 4, e.y + 14, e.facing * 14, 4);
      const leg = Math.sin(now * 0.014 + e.x * 0.1) * 6;
      ctx.fillStyle = flash ? '#FFFFFF' : '#991111';
      ctx.fillRect(sx + 5, e.y + e.h - 10, 6, 10 + leg);
      ctx.fillRect(sx + e.w - 11, e.y + e.h - 10, 6, 10 - leg);
      if (e.hp < e.maxHp) { ctx.shadowBlur = 0; ctx.fillStyle = '#222'; ctx.fillRect(sx, e.y - 8, e.w, 4); ctx.fillStyle = '#EE3333'; ctx.fillRect(sx, e.y - 8, e.w * (e.hp / e.maxHp), 4); }
    } else if (e.type === 'charger') {
      const rush = e.rushActive;
      ctx.fillStyle = flash ? '#FFFFFF' : (rush ? '#FFAA00' : '#FF6600'); ctx.shadowColor = rush ? '#FFCC00' : '#FF6600'; ctx.shadowBlur = rush ? 20 : 8;
      ctx.save(); ctx.translate(sx + e.w / 2, e.y + e.h / 2); ctx.rotate(e.facing * (rush ? 0.25 : 0.08)); ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h); ctx.restore();
      ctx.fillStyle = '#FFDD00'; ctx.shadowColor = '#FFDD00'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(e.facing > 0 ? sx + e.w * 0.7 : sx + e.w * 0.3, e.y + e.h * 0.35, 4, 0, Math.PI * 2); ctx.fill();
      if (e.hp < e.maxHp) { ctx.shadowBlur = 0; ctx.fillStyle = '#222'; ctx.fillRect(sx, e.y - 8, e.w, 4); ctx.fillStyle = '#FF8800'; ctx.fillRect(sx, e.y - 8, e.w * (e.hp / e.maxHp), 4); }
    } else if (e.type === 'flyer') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#CCAA00'; ctx.shadowColor = '#FFCC00'; ctx.shadowBlur = flash ? 18 : 12;
      const spin = now * 0.018;
      for (let r = 0; r < 2; r++) { ctx.save(); ctx.translate(sx + e.w / 2, e.y + e.h * 0.3); ctx.rotate(spin + r * Math.PI); ctx.fillRect(-18, -3, 36, 6); ctx.restore(); }
      ctx.beginPath(); ctx.ellipse(sx + e.w / 2, e.y + e.h / 2, e.w * 0.48, e.h * 0.44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#666'; ctx.shadowBlur = 0; ctx.fillRect(sx + e.w / 2 - 3, e.y + e.h - 2, 6, 10);
      ctx.fillStyle = '#FF8800'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + e.h * 0.42, 4, 0, Math.PI * 2); ctx.fill();
      if (e.hp < e.maxHp) { ctx.shadowBlur = 0; ctx.fillStyle = '#222'; ctx.fillRect(sx, e.y - 8, e.w, 4); ctx.fillStyle = '#CCAA00'; ctx.fillRect(sx, e.y - 8, e.w * (e.hp / e.maxHp), 4); }
    } else if (e.type === 'turret') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#661199'; ctx.shadowColor = '#AA44FF'; ctx.shadowBlur = flash ? 22 : 14;
      ctx.fillRect(sx, e.y + e.h * 0.5, e.w, e.h * 0.5);
      ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + e.h * 0.5, e.w * 0.46, Math.PI, Math.PI * 2); ctx.fill();
      const barrelAng = Math.atan2((this.py + PH * 0.45) - (e.y + e.h * 0.45), (this.px + PW / 2) - (e.x + e.w / 2));
      ctx.save(); ctx.translate(sx + e.w / 2, e.y + e.h * 0.45); ctx.rotate(barrelAng);
      ctx.fillStyle = flash ? '#FFFFFF' : '#9933CC'; ctx.fillRect(0, -5, 20, 10);
      ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 0; ctx.fillRect(16, -3, 4, 6); ctx.restore();
      const pulse = 0.45 + Math.sin(now * 0.009) * 0.45;
      ctx.fillStyle = `rgba(255,0,255,${pulse})`; ctx.shadowColor = '#FF00FF'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + e.h * 0.42, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#222'; ctx.fillRect(sx, e.y - 10, e.w, 5);
      ctx.fillStyle = e.hp > e.maxHp / 2 ? '#AA44FF' : '#FF4444'; ctx.fillRect(sx, e.y - 10, e.w * (e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, now: number) {
    const sx = this.px - this.camX, sy = this.py;
    if (this.invincibleTimer > 0 && Math.floor(now / 90) % 2 === 0) return;

    const pivotSX = sx + PW / 2, pivotSY = sy + PH * 0.44;
    const dx = this.mouseX - pivotSX, dy = this.mouseY - pivotSY;
    const aimAng = (Math.abs(dx) < 8 && Math.abs(dy) < 8) ? (this.facing > 0 ? 0 : Math.PI) : Math.atan2(dy, dx);

    ctx.save();
    if (this.godMode) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 28; }
    else              { ctx.shadowColor = '#4488FF'; ctx.shadowBlur = 12; }

    // Sprite
    if (this.skinLoaded && this.skinImg) {
      ctx.save();
      if (this.facing < 0) { ctx.translate(sx + PW, sy); ctx.scale(-1, 1); ctx.drawImage(this.skinImg, 0, 0, PW, PH); }
      else { ctx.drawImage(this.skinImg, sx, sy, PW, PH); }
      ctx.restore();
    } else {
      ctx.fillStyle = this.godMode ? '#FFD700' : '#4477CC';
      ctx.beginPath(); ctx.ellipse(sx + PW / 2, sy + PH * 0.6, PW * 0.4, PH * 0.33, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.godMode ? '#FFEE88' : '#6699EE';
      ctx.beginPath(); ctx.arc(sx + PW / 2, sy + PH * 0.24, PW * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(sx + PW / 2 + this.facing * 5, sy + PH * 0.2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + PW / 2 + this.facing * 6, sy + PH * 0.2, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Jetpack pack
    {
      const packX = sx + (this.facing > 0 ? -8 : PW - 2);
      ctx.save(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#445566'; ctx.fillRect(packX, sy + PH * 0.18, 10, 22);
      ctx.fillStyle = '#778899'; ctx.fillRect(packX + 2, sy + PH * 0.18 + 20, 6, 5);
      const fuelH = Math.max(0, 18 * this.jetFuel);
      ctx.fillStyle = this.jetFuel > 0.4 ? '#00CCFF' : this.jetFuel > 0.15 ? '#FFAA00' : '#FF4444';
      ctx.fillRect(packX + 3, sy + PH * 0.18 + (18 - fuelH), 4, fuelH);
      ctx.restore();
    }

    // Gun
    const gunType = GUN_ORDER[this.gunIndex];
    ctx.save(); ctx.translate(pivotSX, pivotSY); ctx.rotate(aimAng); ctx.shadowBlur = 0;
    ctx.fillStyle = '#556677'; ctx.fillRect(-2, 0, 6, 10);
    ctx.fillStyle = GUN_STATS[gunType].color;
    const barrelLen = gunType === 'rocket' ? 28 : 22;
    ctx.fillRect(0, -4, barrelLen, 8);
    ctx.fillStyle = '#CCDDEE'; ctx.fillRect(barrelLen - 4, -3, 4, 6);
    ctx.restore();

    // Muzzle flash
    if (this.muzzleFlashTimer > 0) {
      const mDist  = gunType === 'rocket' ? 34 : 28;
      const muzzleX = pivotSX + Math.cos(aimAng) * mDist;
      const muzzleY = pivotSY + Math.sin(aimAng) * mDist;
      const alpha   = this.muzzleFlashTimer / 0.08;
      const col     = GUN_STATS[gunType].color;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(muzzleX, muzzleY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(muzzleX, muzzleY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, now: number) {
    const W = this.canvas.width;

    // HP bar
    ctx.save();
    const hpBarW = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 8, hpBarW + 2, 14);
    const hpFrac  = this.godMode ? 1 : this.hp / SS_MAX_HP;
    const hpColor = this.godMode ? '#FFD700' : hpFrac > 0.5 ? '#22EE66' : hpFrac > 0.25 ? '#FFAA00' : '#FF2222';
    ctx.fillStyle = hpColor; ctx.shadowColor = hpColor; ctx.shadowBlur = 8;
    ctx.fillRect(11, 9, hpBarW * hpFrac, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.strokeRect(10, 8, hpBarW + 2, 14);
    ctx.fillStyle = '#FFFFFF'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(this.godMode ? 'GOD MODE' : `HP  ${this.hp}/${SS_MAX_HP}`, 14, 19);
    ctx.restore();

    // Jet fuel bar
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 26, 82, 10);
    const fuelColor = this.jetFuel > 0.4 ? '#00CCFF' : this.jetFuel > 0.15 ? '#FFAA00' : '#FF4444';
    ctx.fillStyle = fuelColor; ctx.shadowColor = fuelColor; ctx.shadowBlur = this.jetActive ? 10 : 3;
    ctx.fillRect(11, 27, 80 * this.jetFuel, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.strokeRect(10, 26, 82, 10);
    ctx.fillStyle = this.jetActive ? '#00FFFF' : 'rgba(255,255,255,0.4)'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
    ctx.fillText(this.jetActive ? 'JET ▲' : 'JET  [HOLD]', 14, 34);
    ctx.restore();

    // Gun selector
    ctx.save();
    const gun  = GUN_ORDER[this.gunIndex];
    const gCol = GUN_STATS[gun].color;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(10, 40, 110, 16);
    ctx.fillStyle = gCol + '44'; ctx.fillRect(10, 40, 110, 16);
    ctx.strokeStyle = gCol; ctx.lineWidth = 1; ctx.strokeRect(10, 40, 110, 16);
    ctx.fillStyle = gCol; ctx.shadowColor = gCol; ctx.shadowBlur = 6;
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`◄ ${GUN_STATS[gun].label} ► [Q/E]`, 65, 51);
    ctx.restore();

    // Kills + score
    ctx.save();
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 6; ctx.fillText(`+${this.score}`, W - 12, 20);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace'; ctx.fillText(`${this.kills} kills`, W - 12, 34);
    ctx.restore();

    // Progress bar
    const progress = Math.min(1, Math.max(0, this.px / SS_FINISH_X));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 140, 7, 280, 13);
    ctx.fillStyle = '#4488FF'; ctx.shadowColor = '#4488FF'; ctx.shadowBlur = 6; ctx.fillRect(W / 2 - 140, 7, 280 * progress, 13);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.strokeRect(W / 2 - 140, 7, 280, 13);
    ctx.fillStyle = '#FFFFFF'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText('BONUS STAGE', W / 2, 17);
    ctx.restore();

    // Controls hint
    if (this.introTimer > -3) {
      const alpha = Math.min(1, Math.max(0, (this.introTimer + 3) / 3)) * 0.4;
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#FFFFFF'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('A/D move  ·  TAP W/SPACE jump  ·  HOLD W/SPACE jetpack  ·  Q/E switch gun  ·  Z/X/CTRL or CLICK shoot', W / 2, this.canvas.height - 14);
      ctx.restore();
    }

    // God mode badge
    if (this.godMode) {
      const pulse = 0.7 + Math.sin(now * 0.006) * 0.3;
      ctx.save(); ctx.globalAlpha = pulse;
      ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16;
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText('✦ GOD MODE ✦', W - 12, 50);
      ctx.restore();
    }
  }

  private drawPauseBanner(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00CCFF'; ctx.shadowBlur = 24; ctx.fillStyle = '#00CCFF'; ctx.font = 'bold 36px monospace';
    ctx.fillText('PAUSED', W / 2, H / 2 + 8);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '12px monospace';
    ctx.fillText('Press ESC to resume', W / 2, H / 2 + 40);
    ctx.restore();
  }

  private drawIntroBanner(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width, H = this.canvas.height;
    const alpha = Math.min(1, this.introTimer);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, H / 2 - 95, W, 190);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#CC44FF'; ctx.shadowBlur = 26; ctx.fillStyle = '#CC44FF'; ctx.font = 'bold 40px monospace';
    ctx.fillText('BONUS STAGE', W / 2, H / 2 - 28);
    ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 6; ctx.fillStyle = '#FFFFFF'; ctx.font = '15px monospace';
    ctx.fillText('RUN · SHOOT · FLY · SURVIVE', W / 2, H / 2 + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace';
    ctx.fillText('A/D move  ·  TAP W/SPACE jump  ·  HOLD W/SPACE jetpack  ·  Q/E switch gun  ·  CLICK/Z shoot', W / 2, H / 2 + 44);
    ctx.restore();
  }

  private drawOutroBanner(ctx: CanvasRenderingContext2D) {
    const W = this.canvas.width, H = this.canvas.height;
    const alpha = Math.min(1, this.outroTimer);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, H / 2 - 80, W, 160);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 28; ctx.fillStyle = '#FFD700'; ctx.font = 'bold 44px monospace';
    ctx.fillText(this.hp > 0 ? 'STAGE CLEAR!' : 'STAGE COMPLETE', W / 2, H / 2 + 12);
    ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 6; ctx.fillStyle = '#FFFFFF'; ctx.font = '15px monospace';
    ctx.fillText(`BONUS  +${this.score} pts  ·  ${this.kills} kills`, W / 2, H / 2 + 48);
    ctx.restore();
  }
}
