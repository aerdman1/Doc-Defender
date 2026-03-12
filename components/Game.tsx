'use client';

import { useState, useEffect, useRef } from 'react';
import { GameEngine } from '@/game/GameEngine';
import { GamePhase, PowerUpType, ActiveGuns, DEFAULT_GUNS } from '@/game/types';
import { POWERUP } from '@/game/constants';

// ─── HUD ─────────────────────────────────────────────────────────────────────

const GUN_DEFS: { key: keyof ActiveGuns; label: string; icon: string; color: string }[] = [
  { key: 'plasma', label: 'PLASMA', icon: '💥', color: '#FF69B4' },
  { key: 'spread', label: 'SPREAD', icon: '🌊', color: '#FF8C00' },
  { key: 'side',   label: 'SIDE',   icon: '⚡', color: '#00FF88' },
  { key: 'rear',   label: 'REAR',   icon: '🔴', color: '#FF4444' },
];

function HUD({
  score, highScore, lives, level, multiplier, activePowerUp, godMode, activeGuns, onToggleGun
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
}) {
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

      {/* Top right: lives + level */}
      <div className="absolute top-3 right-4 text-right">
        <div className="text-2xl leading-none">
          {'🦉'.repeat(Math.max(0, lives))}
        </div>
        <div className="text-cyan-400 text-xs mt-1 tracking-widest">
          LEVEL {level}
        </div>
      </div>

      {/* God Mode badge */}
      {godMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none opacity-20">
          <div className="text-7xl font-black font-mono tracking-widest text-yellow-300 whitespace-nowrap"
               style={{ textShadow: '0 0 30px #FFD700' }}>
            GOD MODE
          </div>
        </div>
      )}

      {/* God Mode top badge */}
      {godMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <div
            className="font-black font-mono text-sm tracking-widest px-3 py-1 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #FFD700, #FF8C00)',
              color: '#000',
              boxShadow: '0 0 12px #FFD700',
            }}
          >
            👑 GOD MODE ACTIVE
          </div>
        </div>
      )}

      {/* Multiplier badge (below score when active) */}
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
                    border: `1px solid ${on ? g.color : '#333'}`,
                    color: on ? g.color : '#555',
                    boxShadow: on ? `0 0 8px ${g.color}66` : 'none',
                    opacity: on ? 1 : 0.5,
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
    </div>
  );
}

// ─── Start screen ─────────────────────────────────────────────────────────────

function StartScreen({ highScore, onStart, onGodMode }: { highScore: number; onStart: () => void; onGodMode: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm select-none">
      <div className="text-center px-6 max-w-md">
        {/* README logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/readme-white.svg" alt="ReadMe" className="h-8 mx-auto mb-4 opacity-80" />

        {/* Owlbert */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/owlbert.png" alt="Owlbert" className="h-36 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(100,180,255,0.6)]" />

        <h1
          className="text-5xl font-black tracking-widest text-amber-400 font-mono mb-2"
          style={{ textShadow: '0 0 20px #D4A620, 0 0 40px #D4A62055' }}
        >
          OWL DEFENDER
        </h1>
        <p className="text-cyan-400 font-mono text-base mb-1">
          Protect the Docs. Destroy the Bugs.
        </p>
        <p className="text-gray-500 font-mono text-xs mb-6">
          A ReadMe Arcade Experience
        </p>

        {highScore > 0 && (
          <div className="mb-5 py-2 px-4 rounded border border-yellow-700/40 bg-yellow-900/10">
            <span className="text-yellow-300 font-mono text-sm">
              ⭐ HIGH SCORE: {highScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="text-gray-400 font-mono text-xs mb-7 space-y-1">
          <div className="flex justify-center gap-6">
            <span>← → / A D — Move</span>
            <span>SPACE — Shoot</span>
          </div>
          <div className="flex justify-center gap-6">
            <span>ESC — Pause</span>
            <span>Collect power-ups!</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={onStart}
            className="bg-amber-400 hover:bg-amber-300 text-black font-black font-mono
                       px-10 py-3 text-xl tracking-widest rounded transition-all
                       hover:shadow-[0_0_20px_#D4A620] active:scale-95"
          >
            PRESS SPACE TO START
          </button>
          <button
            onClick={onGodMode}
            className="font-black font-mono px-10 py-3 text-xl tracking-widest rounded transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FFD700, #FF8C00)',
              color: '#000',
              boxShadow: '0 0 20px #FFD70066',
            }}
          >
            👑 GOD MODE
          </button>
          <p className="text-gray-500 font-mono text-xs">
            God Mode: invincible · all guns · auto-fire
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Pause screen ─────────────────────────────────────────────────────────────

function PauseScreen({ onResume }: { onResume: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
      <div
        className="text-center px-8 py-6 rounded-xl"
        style={{ background: 'rgba(5,5,20,0.88)', border: '1px solid rgba(100,200,255,0.3)' }}
      >
        <h2
          className="text-4xl font-black font-mono tracking-widest text-cyan-300 mb-4"
          style={{ textShadow: '0 0 15px #00FFFF44' }}
        >
          ⏸ PAUSED
        </h2>
        <p className="text-gray-400 font-mono text-sm mb-5">
          Press ESC or click to resume
        </p>
        <button
          onClick={onResume}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-black font-mono
                     px-8 py-2 text-base tracking-widest rounded transition-all active:scale-95"
        >
          RESUME
        </button>
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
        <p className="text-gray-500 font-mono text-sm mb-6">All 10 levels complete!</p>

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
    });

    engineRef.current = engine;

    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
    };
  }, []);

  const handleStart = () => {
    setGodMode(false);
    setActiveGuns({ ...DEFAULT_GUNS });
    engineRef.current?.startGame(performance.now(), false);
  };

  const handleGodMode = () => {
    setGodMode(true);
    setActiveGuns({ ...DEFAULT_GUNS });
    engineRef.current?.startGame(performance.now(), true);
  };

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

  const handleRestart = () => {
    setIsNewHighScore(false);
    setGodMode(false);
    setActiveGuns({ ...DEFAULT_GUNS });
    engineRef.current?.startGame(performance.now(), false);
  };

  const handleContainerClick = () => {
    const p = phaseRef.current;
    if (p === 'idle') handleStart();
    else if (p === 'paused') handleResume();
    else if (p === 'gameover') handleRestart();
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
        />
      )}

      {phase === 'idle' && (
        <StartScreen highScore={highScore} onStart={handleStart} onGodMode={handleGodMode} />
      )}

      {phase === 'paused' && (
        <PauseScreen onResume={handleResume} />
      )}

      {phase === 'gameover' && (
        <GameOverScreen
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRestart={handleRestart}
        />
      )}

      {phase === 'victory' && (
        <VictoryScreen
          score={score}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
