'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, GitBranch, Layers, Rocket, Activity, Swords, Flame, type LucideIcon } from 'lucide-react';
import IntroSequence from './IntroSequence';
import OutroSequence from './OutroSequence';
import { GameEngine } from '@/game/GameEngine';
import { GamePhase, PowerUpType, ActiveGuns, DEFAULT_GUNS } from '@/game/types';
import { POWERUP, LEVEL_WAVES, BONUS_WAVES } from '@/game/constants';

// ─── Skins data ───────────────────────────────────────────────────────────────

export const SKINS = [
  { id: 'default',    src: '/owlbert.png',          label: 'Robot',      icon: '🤖' },
  { id: 'astronaut',  src: '/skins/astronaut.png',  label: 'Astronaut',  icon: '🚀' },
  { id: 'wizard',     src: '/skins/wizard.png',     label: 'Wizard',     icon: '🪄' },
  { id: 'zeus',       src: '/skins/zeus.png',       label: 'Zeus',       icon: '⚡' },
  { id: 'classy',     src: '/skins/classy.png',     label: 'Classy',     icon: '🍸' },
  { id: 'liberty',    src: '/skins/liberty.png',    label: 'Liberty',    icon: '🗽' },
  { id: 'scout',      src: '/skins/scout.png',      label: 'Scout',      icon: '🏕️' },
  { id: 'scientist',  src: '/skins/scientist.png',  label: 'Scientist',  icon: '🧪' },
];

// ─── Level select data ────────────────────────────────────────────────────────

const LEVEL_INFO: Array<{ level: number; env: string; Icon: LucideIcon; color: string }> = [
  { level: 1, env: 'DISCOVERY DRIFT',     Icon: Compass,    color: '#4488FF' },
  { level: 2, env: 'INTEGRATION GRID',    Icon: GitBranch,  color: '#00CC99' },
  { level: 3, env: 'MIGRATION STORM',     Icon: Layers,     color: '#FFAA22' },
  { level: 4, env: 'LAUNCH SEQUENCE',     Icon: Rocket,     color: '#4488FF' },
  { level: 5, env: 'LIVE OPS RIFT',       Icon: Activity,   color: '#FF6600' },
  { level: 7, env: 'THE CORRUPTED BUILD', Icon: Swords,     color: '#FF2222' },
  { level: 6, env: 'CHAOS BUILD',         Icon: Flame,      color: '#CC44FF' },
];

// ─── Ability definitions ──────────────────────────────────────────────────────

const ABILITY_DEFS = [
  { key: 'aiAssist',      label: 'AI ASSIST',  icon: '🤖', color: '#00FFCC', cooldown: 25, hotkey: 'q', desc: 'Support ship' },
  { key: 'firewallSweep', label: 'FIREWALL',   icon: '🔥', color: '#FF8800', cooldown: 20, hotkey: 'e', desc: 'Screen sweep' },
  { key: 'accessControl', label: 'SHIELD',     icon: '🛡', color: '#4488FF', cooldown: 28, hotkey: 'r', desc: 'Absorb shots' },
  { key: 'debugMode',     label: 'DEBUG',      icon: '⏸', color: '#AA88FF', cooldown: 22, hotkey: 'f', desc: 'Slow enemies' },
];

// ─── HUD ─────────────────────────────────────────────────────────────────────

const GUN_DEFS: { key: keyof ActiveGuns; label: string; icon: string; color: string }[] = [
  { key: 'plasma', label: 'PLASMA', icon: '💥', color: '#FF69B4' },
  { key: 'spread', label: 'SPREAD', icon: '🌊', color: '#FF8C00' },
  { key: 'side',   label: 'SIDE',   icon: '⚡', color: '#00FF88' },
  { key: 'rear',   label: 'REAR',   icon: '🔴', color: '#FF4444' },
];

function HUD({
  score, highScore, lives, level, multiplier, activePowerUp, godMode, activeGuns, onToggleGun, bonusRound, volume, onVolumeChange, abilityCooldownEnds, onActivateAbility, tick
}: {
  score: number;
  highScore: number;
  lives: number;
  level: number;
  multiplier: number;
  activePowerUp: PowerUpType | null;
  godMode: boolean;
  activeGuns: ActiveGuns;
  onToggleGun: (key: keyof ActiveGuns) => void;
  bonusRound: boolean;
  volume: number;
  onVolumeChange: (v: number) => void;
  abilityCooldownEnds: Record<string, number>;
  onActivateAbility: (key: string) => void;
  tick: number; // used to drive cooldown re-renders
}) {
  void tick; // intentional — forces re-render so cooldown countdowns stay live
  return (
    <div className="absolute inset-0 pointer-events-none select-none p-3 font-mono">
      {/* Top left: score */}
      <div className="absolute top-3 left-4">
        <div className="text-amber-400 text-xl font-bold leading-none tracking-wider">
          {score.toLocaleString().padStart(6, '0')}
        </div>
        <div className="text-gray-500 text-xs mt-0.5">
          BEST {highScore.toLocaleString()}
        </div>
      </div>

      {/* Top right: life bar + level */}
      <div className="absolute top-3 right-4 text-right">
        <div className="text-xs text-gray-400 tracking-widest mb-1">LIFE</div>
        <div className="w-32 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)', boxShadow: '0 0 4px rgba(0,0,0,0.6)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(0, lives) / 5 * 100}%`,
              background: lives > 3
                ? 'linear-gradient(to right, #22c55e, #86efac)'
                : lives > 1
                ? 'linear-gradient(to right, #eab308, #fde047)'
                : 'linear-gradient(to right, #ef4444, #f87171)',
              boxShadow: lives > 3
                ? '0 0 8px rgba(34,197,94,0.7)'
                : lives > 1
                ? '0 0 8px rgba(234,179,8,0.7)'
                : '0 0 8px rgba(239,68,68,0.8)',
            }}
          />
        </div>
        <div className="text-cyan-400 text-xs mt-1 tracking-widest">
          LEVEL {level}
        </div>
      </div>

      {/* God Mode badge */}
      {godMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none" style={{ opacity: 0.04 }}>
          <div className="text-7xl font-black font-mono tracking-widest text-yellow-300 whitespace-nowrap">
            GOD MODE
          </div>
        </div>
      )}

      {/* Top-center badge stack — stacks vertically so god mode + bonus round never overlap */}
      {(godMode || bonusRound) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none select-none">
          {bonusRound && (
            <div
              className="font-black font-mono text-sm tracking-widest px-3 py-1 rounded-full animate-pulse whitespace-nowrap"
              style={{
                background: 'linear-gradient(90deg, #FF00FF, #00FFFF, #FF00FF)',
                backgroundSize: '200%',
                color: '#000',
                boxShadow: '0 0 16px #FF00FF, 0 0 32px #00FFFF',
              }}
            >
              ⭐ BONUS ROUND · CHAOS DIMENSION ⭐
            </div>
          )}
          {godMode && (
            <div
              className="font-black font-mono text-sm tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
              style={{
                background: 'linear-gradient(90deg, #FFD700, #FF8C00)',
                color: '#000',
                boxShadow: '0 0 12px #FFD700',
              }}
            >
              👑 GOD MODE ACTIVE
            </div>
          )}
        </div>
      )}

      {/* Multiplier badge */}
      {multiplier > 1 && (
        <div className="absolute top-16 left-4">
          <div
            className="text-yellow-300 font-black text-lg leading-none tracking-wide"
            style={{ textShadow: '0 0 8px #FFD700' }}
          >
            ×{multiplier} COMBO
          </div>
        </div>
      )}

      {/* God mode gun toggles — bottom right */}
      {godMode && (
        <div className="absolute bottom-3 right-4 pointer-events-auto" onClick={e => e.stopPropagation()}>
          {/* Header label — pulses gold when no extras are on */}
          {(() => {
            const anyOn = Object.values(activeGuns).some(Boolean);
            return (
              <div
                className={`text-right mb-1.5 text-xs font-black tracking-widest uppercase${anyOn ? '' : ' animate-pulse'}`}
                style={{
                  color: anyOn ? 'rgba(255,255,255,0.3)' : '#FFD700',
                  textShadow: anyOn ? 'none' : '0 0 10px rgba(255,215,0,0.8)',
                }}
              >
                {anyOn ? 'GUNS' : '★ ALL GUNS — toggle below!'}
              </div>
            );
          })()}
          <div className="flex gap-1.5 items-center">
            {GUN_DEFS.map((g, i) => {
              const on = activeGuns[g.key];
              return (
                <button
                  key={g.key}
                  onClick={() => onToggleGun(g.key)}
                  title={`[${i + 1}] ${g.label}`}
                  className="flex flex-col items-center px-2 py-1 rounded text-xs font-black font-mono tracking-wide transition-all active:scale-95 select-none"
                  style={{
                    background: on ? `${g.color}22` : 'rgba(10,10,30,0.7)',
                    border: `1px solid ${on ? g.color : 'rgba(255,215,0,0.4)'}`,
                    color: on ? g.color : 'rgba(255,215,0,0.5)',
                    boxShadow: on ? `0 0 8px ${g.color}66` : '0 0 6px rgba(255,215,0,0.2)',
                    opacity: on ? 1 : 0.75,
                  }}
                >
                  <span className="text-base leading-none">{g.icon}</span>
                  <span className="mt-0.5">{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Normal mode: show unlocked guns as non-interactive loadout display */}
      {!godMode && GUN_DEFS.some(g => activeGuns[g.key]) && (
        <div className="absolute bottom-3 right-4 pointer-events-none select-none">
          <div className="flex gap-1.5 items-end">
            {GUN_DEFS.filter(g => activeGuns[g.key]).map(g => (
              <div
                key={g.key}
                className="flex flex-col items-center px-2 py-1 rounded text-xs font-black font-mono"
                style={{
                  background: `${g.color}18`,
                  border: `1px solid ${g.color}88`,
                  color: g.color,
                  boxShadow: `0 0 6px ${g.color}44`,
                }}
              >
                <span className="text-base leading-none">{g.icon}</span>
              </div>
            ))}
          </div>
          <div className="text-center text-xs font-mono mt-0.5 opacity-30 tracking-widest">LOADOUT</div>
        </div>
      )}

      {/* ── Abilities tray — bottom left ── */}
      <div className="absolute bottom-10 left-3 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="text-xs font-black tracking-[0.25em] uppercase mb-1.5 px-0.5" style={{ color: 'rgba(180,200,255,0.45)' }}>
          ABILITIES
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ABILITY_DEFS.map(a => {
            const now = Date.now();
            const cdLeft = Math.max(0, Math.ceil((abilityCooldownEnds[a.key] - now) / 1000));
            const ready = cdLeft === 0;
            return (
              <button
                key={a.key}
                onClick={() => ready && onActivateAbility(a.key)}
                title={`[${a.hotkey.toUpperCase()}] ${a.label} — ${a.desc}${!ready ? ` (${cdLeft}s)` : ''}`}
                className="relative flex flex-col items-center px-2 py-1.5 rounded text-xs font-black font-mono tracking-wide transition-all active:scale-95 select-none overflow-hidden"
                style={{
                  background: ready ? `${a.color}18` : 'rgba(10,10,30,0.6)',
                  border: `1px solid ${ready ? a.color : 'rgba(255,255,255,0.1)'}`,
                  color: ready ? a.color : 'rgba(255,255,255,0.3)',
                  boxShadow: ready ? `0 0 8px ${a.color}44` : 'none',
                  cursor: ready ? 'pointer' : 'not-allowed',
                  minWidth: '52px',
                }}
              >
                {/* Cooldown fill overlay */}
                {!ready && (
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: `${((abilityCooldownEnds[a.key] - now) / (a.cooldown * 1000)) * 100}%`,
                      background: `${a.color}12`,
                      transition: 'height 0.25s linear',
                    }}
                  />
                )}
                <span className="text-base leading-none relative z-10">{a.icon}</span>
                <span className="mt-0.5 relative z-10" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>{a.label}</span>
                <span className="relative z-10" style={{ fontSize: '9px', color: ready ? `${a.color}99` : 'rgba(255,255,255,0.2)' }}>
                  {ready ? a.hotkey.toUpperCase() : `${cdLeft}s`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* README logo — bottom left */}
      <div className="absolute bottom-3 left-4 opacity-30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/readme-white.svg" alt="ReadMe" className="h-5" />
      </div>

      {/* Active power-up (bottom center) */}
      {activePowerUp && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold tracking-wider"
            style={{
              background: 'rgba(5,5,20,0.85)',
              border: `1px solid ${POWERUP[activePowerUp].color}`,
              color: POWERUP[activePowerUp].color,
              boxShadow: `0 0 12px ${POWERUP[activePowerUp].color}55`,
            }}
          >
            <span>{POWERUP[activePowerUp].icon}</span>
            <span>{POWERUP[activePowerUp].label} ACTIVE</span>
          </div>
        </div>
      )}

      {/* Volume control — top right below lives */}
      <div className="absolute top-20 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
          className="text-base leading-none opacity-60 hover:opacity-100 transition-opacity select-none"
          title={volume === 0 ? 'Unmute' : 'Mute'}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          className="w-20 h-1 cursor-pointer accent-cyan-400 opacity-60 hover:opacity-100 transition-opacity"
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  );
}

// ─── Start screen ─────────────────────────────────────────────────────────────

function StartScreen({
  highScore, selectedLevel, onSelectLevel, onStart, onGodMode, selectedSkin, onSelectSkin, volume, onVolumeChange, onBonusStage
}: {
  highScore: number;
  selectedLevel: number;
  onSelectLevel: (level: number) => void;
  onStart: () => void;
  onGodMode: () => void;
  selectedSkin: string;
  onSelectSkin: (id: string) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  onBonusStage: () => void;
}) {
  const [showSkins, setShowSkins] = useState(false);
  const info = LEVEL_INFO[selectedLevel - 1];
  const activeSkin = SKINS.find(s => s.id === selectedSkin) ?? SKINS[0];

  return (
    <div
      className="absolute inset-0 select-none overflow-hidden"
      onClick={e => e.stopPropagation()}
      style={{ fontFamily: 'monospace' }}
    >
      {/* Dark vignette — heavy at edges, lighter in center so planet shows */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 70% at 30% 45%, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.88) 100%)',
      }} />
      {/* Bottom fog — grounds the UI */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(0,0,8,0.96) 0%, rgba(0,0,8,0.7) 50%, transparent 100%)',
      }} />
      {/* Left fog — keeps text readable against planet */}
      <div className="absolute top-0 bottom-0 left-0 w-96 pointer-events-none" style={{
        background: 'linear-gradient(to right, rgba(0,0,8,0.82) 0%, rgba(0,0,8,0.4) 60%, transparent 100%)',
      }} />

      {/* ── Top-left: ReadMe logo + Owlbert ── */}
      <div className="absolute top-8 left-10 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/owlbert.png" alt="Robot" className="h-14 drop-shadow-[0_0_18px_rgba(255,180,80,0.7)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/readme-white.svg" alt="ReadMe" className="h-5 opacity-60" />
      </div>

      {/* ── Center-left: Main title block ── */}
      <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px" style={{ background: 'rgba(200,130,50,0.7)' }} />
          <span className="text-xs tracking-[0.4em] uppercase" style={{ color: 'rgba(200,140,60,0.85)' }}>
            A  ReadMe  Experience
          </span>
        </div>

        {/* Main title — cinematic letter-spacing */}
        <h1
          className="font-black uppercase leading-none mb-1"
          style={{
            fontSize: 'clamp(2.8rem, 5.5vw, 4.8rem)',
            letterSpacing: '0.18em',
            color: '#F5E6C8',
            textShadow: '0 0 40px rgba(200,120,40,0.6), 0 0 80px rgba(200,100,30,0.25), 0 2px 0 rgba(0,0,0,0.8)',
          }}
        >
          DOCS
        </h1>
        <h1
          className="font-black uppercase leading-none"
          style={{
            fontSize: 'clamp(2.8rem, 5.5vw, 4.8rem)',
            letterSpacing: '0.18em',
            color: '#E8C070',
            textShadow: '0 0 50px rgba(220,160,40,0.7), 0 0 100px rgba(200,120,30,0.3), 0 2px 0 rgba(0,0,0,0.8)',
          }}
        >
          DEFENDER
        </h1>

        {/* Tagline */}
        <p className="mt-4 text-sm tracking-widest uppercase" style={{ color: 'rgba(180,200,255,0.7)', letterSpacing: '0.25em' }}>
          Protect the Docs &nbsp;·&nbsp; Destroy the Bugs
        </p>

        {highScore > 0 && (
          <p className="mt-2 text-xs tracking-widest" style={{ color: 'rgba(255,210,80,0.6)' }}>
            ⭐ &nbsp;Best:&nbsp; {highScore.toLocaleString()}
          </p>
        )}

        {/* Starting level pill */}
        <div className="mt-6 flex items-center gap-2">
          <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Starting at</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded tracking-wider"
            style={selectedLevel === 6
              ? { background: 'rgba(255,0,255,0.12)', border: '1px solid rgba(255,0,255,0.5)', color: '#FF88FF' }
              : selectedLevel === 7
              ? { background: 'rgba(255,34,34,0.12)', border: '1px solid rgba(255,34,34,0.5)', color: '#FF6666' }
              : { background: `${info.color}14`, border: `1px solid ${info.color}66`, color: info.color }}
          >
            {selectedLevel === 6 ? 'CHAOS BUILD · BONUS ROUND'
             : selectedLevel === 7 ? 'THE CORRUPTED BUILD · BOSS FIGHT'
             : `LEVEL ${selectedLevel} · ${info.env}`}
          </span>
        </div>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-col gap-2 w-60">
          <button
            onClick={onStart}
            className="w-full font-black tracking-widest uppercase py-3 text-base rounded transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff',
              boxShadow: '0 0 24px rgba(34,197,94,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
              letterSpacing: '0.2em',
            }}
          >
            ▶  START GAME
          </button>
          {/* Skin picker toggle */}
          <button
            onClick={() => setShowSkins(v => !v)}
            className="w-full font-black tracking-widest uppercase py-2 text-sm rounded transition-all active:scale-95 flex items-center justify-between px-3"
            style={{
              background: showSkins ? 'rgba(160,100,255,0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showSkins ? 'rgba(160,100,255,0.7)' : 'rgba(255,255,255,0.12)'}`,
              color: showSkins ? '#CC88FF' : 'rgba(255,255,255,0.45)',
              boxShadow: showSkins ? '0 0 12px rgba(160,100,255,0.35)' : 'none',
              letterSpacing: '0.18em',
            }}
          >
            <span>🎨  SKINS</span>
            <span className="flex items-center gap-1.5 text-xs opacity-70" suppressHydrationWarning>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeSkin.src} alt={activeSkin.label} className="w-6 h-6 object-contain rounded" suppressHydrationWarning />
              {activeSkin.label}
            </span>
          </button>
        </div>

      </div>

      {/* ── Skins modal overlay ── */}
      {showSkins && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,8,0.88)', backdropFilter: 'blur(6px)', zIndex: 50 }}
          onClick={() => setShowSkins(false)}
        >
          <div
            className="relative rounded-2xl p-8 flex flex-col items-center"
            style={{
              background: 'linear-gradient(160deg, rgba(20,8,50,0.98) 0%, rgba(8,4,24,0.99) 100%)',
              border: '1px solid rgba(160,100,255,0.4)',
              boxShadow: '0 0 60px rgba(120,60,220,0.35), 0 0 120px rgba(80,30,180,0.15)',
              maxWidth: 740,
              width: '90vw',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between w-full mb-6">
              <div>
                <h2
                  className="font-black uppercase tracking-[0.25em] text-2xl"
                  style={{ color: '#CC88FF', textShadow: '0 0 20px rgba(160,100,255,0.6)' }}
                >
                  🎨 Choose Your Skin
                </h2>
                <p className="text-xs tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Select your Owlbert character
                </p>
              </div>
              <button
                onClick={() => setShowSkins(false)}
                className="text-2xl leading-none transition-opacity hover:opacity-100 opacity-40"
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Skin grid */}
            <div className="grid grid-cols-4 gap-4 w-full">
              {SKINS.map(skin => {
                const isActive = skin.id === selectedSkin;
                return (
                  <button
                    key={skin.id}
                    onClick={() => { onSelectSkin(skin.id); setShowSkins(false); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all active:scale-95 hover:scale-105"
                    style={{
                      background: isActive ? 'rgba(160,100,255,0.18)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isActive ? 'rgba(160,100,255,0.9)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: isActive ? '0 0 20px rgba(160,100,255,0.5), inset 0 0 20px rgba(160,100,255,0.08)' : 'none',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={skin.src}
                      alt={skin.label}
                      className="w-28 h-28 object-contain"
                      style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(160,100,255,0.9))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
                    />
                    <span
                      className="text-xs font-black tracking-widest uppercase"
                      style={{ color: isActive ? '#CC88FF' : 'rgba(255,255,255,0.5)' }}
                    >
                      {skin.label}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(160,100,255,0.3)', color: '#EE99FF', border: '1px solid rgba(160,100,255,0.5)' }}>
                        EQUIPPED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom-left: controls ── */}
      <div className="absolute bottom-8 left-10" style={{ color: 'rgba(255,255,255,0.28)' }}>
        <p className="text-xs tracking-widest uppercase mb-0.5">Arrows / WASD — Move &nbsp;·&nbsp; Shift — Sprint</p>
        <p className="text-xs tracking-widest uppercase">Space / Click — Shoot &nbsp;·&nbsp; ESC — Pause</p>
      </div>

      {/* ── Right: level select panel ── */}
      <div
        className="absolute top-0 right-0 bottom-0 w-60 flex flex-col py-8 px-3"
        style={{ background: 'linear-gradient(to left, rgba(0,0,8,0.88) 0%, rgba(0,0,8,0.55) 100%)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Volume control */}
        <div className="mb-5 px-1">
          <div className="text-xs font-bold tracking-[0.3em] uppercase mb-2" style={{ color: 'rgba(180,200,255,0.5)' }}>
            Volume
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
              className="text-base leading-none transition-opacity hover:opacity-100 opacity-60"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              className="flex-1 h-1 cursor-pointer accent-cyan-400"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
            <span className="text-xs w-8 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase mb-3 px-1" style={{ color: 'rgba(180,200,255,0.35)' }}>
          Select Mission
        </h3>
        <div className="flex-1 overflow-y-auto pr-0.5">
          {LEVEL_INFO.map((li) => {
            const isBonus    = li.level === 6;
            const isBoss     = li.level === 7;
            const waves      = isBonus ? BONUS_WAVES.length : isBoss ? 1 : LEVEL_WAVES[li.level - 1].length;
            const isSelected = li.level === selectedLevel;
            const accent     = li.color;
            const sublabel   = isBoss ? 'boss fight' : isBonus ? `${waves} waves · bonus` : `${waves} waves`;
            return (
              <button
                key={li.level}
                onClick={() => onSelectLevel(li.level)}
                className="w-full text-left transition-all active:scale-95 relative overflow-hidden"
                style={{
                  background: isSelected ? `${accent}0D` : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                  background: isSelected ? accent : 'rgba(255,255,255,0.06)',
                  boxShadow: isSelected ? `0 0 10px ${accent}66` : 'none',
                }} />

                <div className="flex items-center gap-3 pl-4 pr-3 py-2.5">
                  <li.Icon
                    size={14}
                    strokeWidth={1.6}
                    style={{ color: isSelected ? accent : 'rgba(255,255,255,0.22)', flexShrink: 0 }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[11px] font-bold tracking-[0.1em] truncate leading-none"
                      style={{ color: isSelected ? accent : 'rgba(255,255,255,0.42)' }}
                    >
                      {li.env}
                    </div>
                    <div className="text-[10px] mt-1 tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {sublabel}
                    </div>
                  </div>
                  {!isBoss && !isBonus && (
                    <span
                      className="text-[9px] font-mono tabular-nums flex-shrink-0"
                      style={{ color: isSelected ? `${accent}BB` : 'rgba(255,255,255,0.14)' }}
                    >
                      L{li.level}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onBonusStage}
          className="w-full font-black tracking-widest uppercase py-2 text-xs rounded transition-all active:scale-95 mt-3"
          style={{
            background: 'rgba(204,68,255,0.10)',
            border: '1px solid rgba(204,68,255,0.45)',
            color: '#CC44FF',
            boxShadow: '0 0 10px rgba(204,68,255,0.2)',
            letterSpacing: '0.18em',
          }}
        >
          ★  BONUS STAGE
        </button>
        <button
          onClick={onGodMode}
          className="w-full font-black tracking-widest uppercase py-2.5 text-sm rounded transition-all active:scale-95 mt-3"
          style={{
            background: 'linear-gradient(135deg, #ca8a04, #b45309)',
            color: '#fff',
            boxShadow: '0 0 16px rgba(202,138,4,0.40), inset 0 1px 0 rgba(255,255,255,0.12)',
            letterSpacing: '0.2em',
          }}
        >
          👑  GOD MODE
        </button>
        <p className="text-xs mt-2 px-1 tracking-widest" style={{ color: 'rgba(255,255,255,0.18)' }}>
          2 guns max · invincible
        </p>
      </div>
    </div>
  );
}

// ─── Pause screen ─────────────────────────────────────────────────────────────

function PauseScreen({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
      <div
        className="text-center px-8 py-6 rounded-xl"
        style={{ background: 'rgba(5,5,20,0.92)', border: '1px solid rgba(100,200,255,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          className="text-4xl font-black font-mono tracking-widest text-cyan-300 mb-4"
          style={{ textShadow: '0 0 15px #00FFFF44' }}
        >
          ⏸ PAUSED
        </h2>
        <p className="text-gray-400 font-mono text-sm mb-5">Press ESC or click RESUME</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onResume}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-black font-mono
                       px-8 py-2 text-base tracking-widest rounded transition-all active:scale-95"
          >
            RESUME
          </button>
          <button
            onClick={onExit}
            className="bg-transparent hover:bg-red-900/30 text-red-500 hover:text-red-400 font-black font-mono
                       px-8 py-2 text-sm tracking-widest rounded border border-red-800/50
                       hover:border-red-600/60 transition-all active:scale-95"
          >
            EXIT TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Game over screen ─────────────────────────────────────────────────────────

function GameOverScreen({
  score, highScore, isNewHighScore, onRestart
}: {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  onRestart: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm select-none">
      <div className="text-center px-8">
        <div className="text-5xl mb-3">💀</div>
        <h1
          className="text-6xl font-black font-mono tracking-widest text-red-500 mb-4"
          style={{ textShadow: '0 0 20px #FF0000, 0 0 40px #FF000055' }}
        >
          GAME OVER
        </h1>

        {isNewHighScore && (
          <div
            className="text-yellow-300 font-mono font-bold text-lg mb-3 animate-pulse"
            style={{ textShadow: '0 0 10px #FFD700' }}
          >
            ⭐ NEW HIGH SCORE! ⭐
          </div>
        )}

        <div className="mb-1">
          <span className="text-white font-mono text-3xl font-bold">
            {score.toLocaleString()}
          </span>
        </div>
        <div className="text-gray-400 font-mono text-sm mb-8">
          BEST: {highScore.toLocaleString()}
        </div>

        <button
          onClick={onRestart}
          className="bg-red-600 hover:bg-red-500 text-white font-black font-mono
                     px-10 py-3 text-xl tracking-widest rounded transition-all
                     hover:shadow-[0_0_20px_#FF0000] active:scale-95"
        >
          PRESS SPACE TO RETRY
        </button>

        <p className="text-gray-600 font-mono text-xs mt-4">
          The docs were not protected. 🦉
        </p>
      </div>
    </div>
  );
}

// ─── Victory screen ───────────────────────────────────────────────────────────

function VictoryScreen({
  score, highScore, isNewHighScore, onRestart
}: {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  onRestart: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm select-none">
      <div className="text-center px-8">
        <div className="text-6xl mb-3">🏆</div>
        <h1
          className="text-5xl font-black font-mono tracking-widest text-yellow-300 mb-2"
          style={{ textShadow: '0 0 30px #FFD700, 0 0 60px #FFD70055' }}
        >
          VICTORY!
        </h1>
        <p className="text-cyan-400 font-mono text-lg mb-1">The docs are protected. 🦉</p>
        <p className="text-gray-500 font-mono text-sm mb-6">5 levels + the Chaos Dimension conquered!</p>

        {isNewHighScore && (
          <div
            className="text-yellow-300 font-mono font-bold text-lg mb-4 animate-pulse"
            style={{ textShadow: '0 0 10px #FFD700' }}
          >
            ⭐ NEW HIGH SCORE! ⭐
          </div>
        )}

        <div className="mb-1">
          <span className="text-white font-mono text-3xl font-bold">
            {score.toLocaleString()}
          </span>
        </div>
        <div className="text-gray-400 font-mono text-sm mb-8">
          BEST: {highScore.toLocaleString()}
        </div>

        <button
          onClick={onRestart}
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-black font-mono
                     px-10 py-3 text-xl tracking-widest rounded transition-all
                     hover:shadow-[0_0_20px_#FFD700] active:scale-95"
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

// ─── Main Game component ─────────────────────────────────────────────────────

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const phaseRef = useRef<GamePhase>('idle');

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [activeGuns, setActiveGuns] = useState<ActiveGuns>({ ...DEFAULT_GUNS });
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [bonusRound, setBonusRound] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const handleIntroComplete = useCallback(() => setShowIntro(false), []);
  const [outroDone, setOutroDone] = useState(false);
  const handleOutroComplete = useCallback(() => setOutroDone(true), []);
  const [volume, setVolume] = useState(1);
  // ─── Abilities ────────────────────────────────────────────────────────────
  const abilityCooldownEnds = useRef<Record<string, number>>({ aiAssist: 0, firewallSweep: 0, accessControl: 0, debugMode: 0 });
  const [abilityTick, setAbilityTick] = useState(0);

  const [selectedSkin, setSelectedSkin] = useState<string>(() => {
    try { return localStorage.getItem('docsDefenderSkin') ?? 'default'; } catch { return 'default'; }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      engineRef.current?.resize(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas, {
      onPhaseChange: (p) => {
        phaseRef.current = p;
        setPhase(p);
        if (p === 'gameover') setIsNewHighScore(false);
        if (p === 'victory')  setOutroDone(false);
      },
      onScoreChange: setScore,
      onHighScoreChange: setHighScore,
      onLivesChange: setLives,
      onLevelChange: setLevel,
      onMultiplierChange: setMultiplier,
      onPowerUpChange: (type) => setActivePowerUp(type),
      onNewHighScore: () => {
        if (phaseRef.current === 'playing') setIsNewHighScore(true);
      },
      onGunsChange: (guns) => setActiveGuns({ ...guns }),
      onBonusRound: () => setBonusRound(true),
    });

    engineRef.current = engine;
    engine.previewLevel(1);
    // Apply persisted skin on startup
    const savedSkin = SKINS.find(s => {
      try { return s.id === localStorage.getItem('docsDefenderSkin'); } catch { return false; }
    }) ?? SKINS[0];
    engine.setSkin(savedSkin.src);

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
    };
  }, []);

  const handleStart = () => {
    setGodMode(false);
    setActiveGuns({ ...DEFAULT_GUNS });
    if (selectedLevel === 7) {
      setBonusRound(false);
      engineRef.current?.startBossGame(performance.now(), false);
    } else if (selectedLevel === 6) {
      setBonusRound(true);
      engineRef.current?.startBonusGame(performance.now(), false);
    } else {
      setBonusRound(false);
      engineRef.current?.startGame(performance.now(), false, selectedLevel);
    }
  };

  const handleGodMode = () => {
    setGodMode(true);
    setActiveGuns({ plasma: false, spread: false, side: false, rear: false });
    if (selectedLevel === 7) {
      setBonusRound(false);
      engineRef.current?.startBossGame(performance.now(), true);
    } else if (selectedLevel === 6) {
      setBonusRound(true);
      engineRef.current?.startBonusGame(performance.now(), true);
    } else {
      setBonusRound(false);
      engineRef.current?.startGame(performance.now(), true, selectedLevel);
    }
  };

  const handleSelectSkin = (id: string) => {
    setSelectedSkin(id);
    try { localStorage.setItem('docsDefenderSkin', id); } catch { /* ignore */ }
    const skin = SKINS.find(s => s.id === id) ?? SKINS[0];
    engineRef.current?.setSkin(skin.src);
  };

  const handleVolumeChange = (v: number) => {
    engineRef.current?.getSoundManager().setVolume(v);
    setVolume(v);
  };

  // ─── Abilities ────────────────────────────────────────────────────────────
  const handleActivateAbility = useCallback((key: string) => {
    const def = ABILITY_DEFS.find(a => a.key === key);
    if (!def) return;
    const now = Date.now();
    if (now < abilityCooldownEnds.current[key]) return;
    engineRef.current?.activateAbility(key);
    abilityCooldownEnds.current[key] = now + def.cooldown * 1000;
    setAbilityTick(t => t + 1);
  }, []);

  // Tick the ability tray every 250ms so cooldowns count down live
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setAbilityTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, [phase]);

  // Keyboard hotkeys for abilities (Q/E/R/F)
  useEffect(() => {
    if (phase !== 'playing') return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'q') handleActivateAbility('aiAssist');
      else if (k === 'e') handleActivateAbility('firewallSweep');
      else if (k === 'r') handleActivateAbility('accessControl');
      else if (k === 'f') handleActivateAbility('debugMode');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, handleActivateAbility]);

  const handleToggleGun = (key: keyof ActiveGuns) => {
    setActiveGuns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      engineRef.current?.setActiveGuns(next);
      return next;
    });
  };

  const handleResume = () => {
    engineRef.current?.resumeGame(performance.now());
  };

  const handleExit = () => {
    engineRef.current?.exitToMenu();
  };

  const handleRestart = () => {
    setIsNewHighScore(false);
    setGodMode(false);
    setBonusRound(false);
    setOutroDone(false);
    setActiveGuns({ ...DEFAULT_GUNS });
    engineRef.current?.startGame(performance.now(), false, 1);
  };

  const handleContainerClick = () => {
    const p = phaseRef.current;
    if (p === 'gameover') handleRestart();
  };

  const handleWatchOutro = () => {
    phaseRef.current = 'victory';
    setOutroDone(false);
    setPhase('victory');
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden cursor-crosshair"
      style={{ background: '#050510' }}
      onClick={handleContainerClick}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {phase === 'playing' && (
        <HUD
          score={score}
          highScore={highScore}
          lives={lives}
          level={level}
          multiplier={multiplier}
          activePowerUp={activePowerUp}
          godMode={godMode}
          activeGuns={activeGuns}
          onToggleGun={handleToggleGun}
          bonusRound={bonusRound}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          abilityCooldownEnds={abilityCooldownEnds.current}
          onActivateAbility={handleActivateAbility}
          tick={abilityTick}
        />
      )}

      {phase === 'idle' && (
        <StartScreen
          highScore={highScore}
          selectedLevel={selectedLevel}
          onSelectLevel={(lvl) => { setSelectedLevel(lvl); engineRef.current?.previewLevel(lvl); }}
          onStart={handleStart}
          onGodMode={handleGodMode}
          selectedSkin={selectedSkin}
          onSelectSkin={handleSelectSkin}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onBonusStage={() => engineRef.current?.startSideScroller()}
        />
      )}

      {phase === 'paused' && (
        <PauseScreen onResume={handleResume} onExit={handleExit} />
      )}

      {phase === 'gameover' && (
        <GameOverScreen
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRestart={handleRestart}
        />
      )}

      {phase === 'victory' && !outroDone && (
        <OutroSequence onComplete={handleOutroComplete} />
      )}

      {phase === 'victory' && outroDone && (
        <VictoryScreen
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRestart={handleRestart}
        />
      )}

      {phase === 'idle' && (
        <button
          onClick={handleWatchOutro}
          className="absolute bottom-3 right-4 font-mono text-xs text-white/25 hover:text-white/60 transition-colors underline underline-offset-2"
        >
          watch ending
        </button>
      )}

      {showIntro && (
        <IntroSequence onComplete={handleIntroComplete} />
      )}
    </div>
  );
}
