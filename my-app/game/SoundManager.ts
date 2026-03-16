// ─── Music track sources (real audio files in /public/music/) ────────────────
// Tracks by Oblidivm — CC-BY 3.0 — https://opengameart.org/content/space-shooter-music
// Attribution: "MUSIC BY OBLIDIVM http://oblidivmmusic.blogspot.com.es/"

const TRACK_SRCS: Record<string, string> = {
  menu:     '/music/menu.ogg',      // SkyFire (Title Screen)
  gameplay: '/music/gameplay.ogg',  // Battle in the Stars
  boss:     '/music/boss.ogg',      // DeathMatch (Boss Theme)
};

export type MusicTrack = 'menu' | 'gameplay' | 'boss';
export type ShootType = 'normal' | 'rapid' | 'spread' | 'side' | 'rear' | 'god';

export class SoundManager {
  // ─── Web Audio (SFX only) ─────────────────────────────────────────────────
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;

  // ─── HTML Audio (background music) ───────────────────────────────────────
  private audioEls: Partial<Record<MusicTrack, HTMLAudioElement>> = {};
  private currentEl: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── State ────────────────────────────────────────────────────────────────
  private _muted = false;
  private _volume = 1.0;      // master volume 0–1 (independent of mute)
  private _sfxVol = 0.55;
  private _musicVol = 0.30;   // real music can be a bit louder
  private _sfxReady = false;

  // SFX rate limiting
  private lastShootMs = 0;
  private lastHitMs = 0;

  // ─── Init ─────────────────────────────────────────────────────────────────

  /**
   * Pre-create HTML Audio elements immediately so the browser starts
   * buffering them. Call this as early as possible (no user gesture needed
   * for creation — only .play() requires a gesture).
   */
  preload() {
    if (typeof window === 'undefined') return;
    for (const [key, src] of Object.entries(TRACK_SRCS)) {
      if (this.audioEls[key as MusicTrack]) continue;
      const el = new Audio(src);
      el.loop = true;
      el.volume = this._muted ? 0 : this._musicVol * this._volume;
      el.preload = 'auto';
      this.audioEls[key as MusicTrack] = el;
    }
  }

  /**
   * Init Web Audio context for SFX — must be called from a user-gesture
   * handler (click / keydown).
   */
  init() {
    this.preload(); // ensure audio elements exist

    if (this._sfxReady) {
      this.ctx?.resume();
      return;
    }
    this._sfxReady = true;

    try {
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVol;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate 1-second white noise buffer (reused for all noise SFX)
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sr; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      // AudioContext blocked — SFX unavailable, music still works
    }
  }

  // ─── Mute / Volume ────────────────────────────────────────────────────────

  get isMuted() { return this._muted; }
  get volume() { return this._volume; }

  toggleMute(): boolean {
    this._muted = !this._muted;
    this._applyVolume();
    return this._muted;
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this._muted = this._volume === 0;
    this._applyVolume();
  }

  private _applyVolume() {
    const effective = this._muted ? 0 : this._volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.05);
    }
    if (this.currentEl) {
      this.currentEl.volume = this._musicVol * effective;
    }
  }

  // ─── Background music ─────────────────────────────────────────────────────

  playTrack(track: MusicTrack) {
    if (this.currentTrack === track) return;
    this._fadeOutCurrent(() => this._startTrack(track));
  }

  stopMusic() {
    this._fadeOutCurrent(null);
    this.currentTrack = null;
  }

  private _startTrack(track: MusicTrack) {
    this.currentTrack = track;
    const el = this.audioEls[track];
    if (!el) return;
    el.volume = this._muted ? 0 : this._musicVol * this._volume;
    el.currentTime = 0;
    el.play().catch(() => { /* autoplay blocked — gesture listener will retry */ });
    this.currentEl = el;
  }

  private _fadeOutCurrent(then: (() => void) | null) {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    const el = this.currentEl;
    if (!el) {
      then?.();
      return;
    }

    // Fade out over 400ms in 10 steps
    const startVol = el.volume;
    const steps = 10;
    const stepMs = 40;
    let step = 0;
    const tick = () => {
      step++;
      el.volume = Math.max(0, startVol * (1 - step / steps));
      if (step < steps) {
        this.fadeTimer = setTimeout(tick, stepMs);
      } else {
        el.pause();
        el.currentTime = 0;
        el.volume = this._muted ? 0 : this._musicVol * this._volume;
        this.currentEl = null;
        then?.();
      }
    };
    this.fadeTimer = setTimeout(tick, stepMs);
  }

  // ─── Sound effects ────────────────────────────────────────────────────────

  playShoot(type: ShootType = 'normal') {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastShootMs < 55) return;
    this.lastShootMs = now;

    const t = this.ctx.currentTime;
    type TupleConfig = [number, number, OscillatorType, number];
    const configs: Record<ShootType, TupleConfig> = {
      normal: [780, 175, 'sawtooth', 0.22],
      rapid:  [960, 270, 'sawtooth', 0.15],
      spread: [640, 155, 'sawtooth', 0.19],
      side:   [700, 195, 'square',   0.17],
      rear:   [500, 125, 'sawtooth', 0.17],
      god:    [850, 200, 'sawtooth', 0.20],
    };
    const [startF, endF, wave, vol] = configs[type] ?? configs.normal;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(endF, t + 0.09);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playEnemyHit() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastHitMs < 40) return;
    this.lastHitMs = now;
    this._noiseAt(this.ctx.currentTime, 0.07, 0.032, this.sfxGain, 5000, 1.0);
  }

  playExplosion(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = big ? 0.65 : 0.28;
    const vol = big ? 0.44 : 0.28;

    this._noiseAt(t, dur, vol, this.sfxGain, 1800, 0.4);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(big ? 85 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(big ? 22 : 38, t + dur);
    g.gain.setValueAtTime(big ? 0.50 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  playPlayerDamage() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
    this._noiseAt(t, 0.10, 0.09, this.sfxGain, 2000, 0.6);
  }

  playPlayerDeath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.3);
    g.gain.setValueAtTime(0.42, t);
    g.gain.setValueAtTime(0.42, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.4);
    this._noiseAt(t, 0.45, 0.28, this.sfxGain, 1200, 0.4);
  }

  playPowerUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      this._osc(freq, t + i * 0.07, 0.11, 'triangle', 0.26, this.sfxGain);
    });
  }

  playDeployBurst() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseAt(t, 0.55, 0.48, this.sfxGain, 1200, 0.35);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    g.gain.setValueAtTime(0.48, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  playComboUp(mult: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 523.25 * Math.pow(1.26, mult - 2);
    this._osc(freq, t, 0.13, 'triangle', 0.22, this.sfxGain);
    this._osc(freq * 2, t + 0.06, 0.09, 'triangle', 0.13, this.sfxGain);
  }

  playExtraLife() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392.00, 523.25, 659.25].forEach((freq, i) => {
      this._osc(freq, t + i * 0.13, 0.20, 'triangle', 0.30, this.sfxGain);
    });
  }

  playWaveStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392.00, 523.25].forEach((freq, i) => {
      this._osc(freq, t + i * 0.11, 0.09, 'square', 0.16, this.sfxGain);
    });
  }

  playLevelUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
      this._osc(freq, t + i * 0.1, 0.14, 'square', 0.20, this.sfxGain);
    });
  }

  playBossEnter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(38, t);
    osc.frequency.linearRampToValueAtTime(78, t + 1.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.48, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 3.0);
    [[220, 0.6], [330, 1.0], [220, 1.4]].forEach(([freq, delay]) => {
      this._osc(freq, t + delay, 0.15, 'square', 0.18, this.sfxGain);
    });
  }

  playBossHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseAt(t, 0.09, 0.20, this.sfxGain, 4000, 0.8);
    this._osc(220, t, 0.07, 'square', 0.16, this.sfxGain);
  }

  playVictory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
      this._osc(freq, t + i * 0.11, 0.17, 'triangle', 0.26, this.sfxGain);
    });
    [523.25, 659.25, 783.99].forEach(freq => {
      this._osc(freq, t + 0.80, 0.55, 'triangle', 0.18, this.sfxGain);
    });
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    this.stopMusic();
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    for (const el of Object.values(this.audioEls)) el?.pause();
    this.audioEls = {};
    this.ctx?.close();
    this.ctx = null;
    this.noiseBuffer = null;
  }

  // ─── Private Web Audio helpers ────────────────────────────────────────────

  private _osc(
    freq: number, start: number, dur: number,
    type: OscillatorType, vol: number, dest: GainNode
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.005);
    g.gain.setValueAtTime(vol, start + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  private _noiseAt(
    start: number, dur: number, vol: number,
    dest: GainNode, filterFreq = 3000, filterQ = 0.7
  ) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq;
    filt.Q.value = filterQ;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.01);
  }
}
