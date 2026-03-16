// @ts-nocheck
import { GamePhase, GameCallbacks, EnemyType, PowerUpType, ActiveGuns, DEFAULT_GUNS, EnvironmentId } from './types';
import { ENEMY, PLAYER, PROJECTILE, DIFFICULTY, SCORE, BG, PARTICLES, POWERUP, ENVIRONMENTS, ENEMY_COLORS, LEVEL_WAVES, BONUS_WAVES, getEnvironment, POWERUP_COLORS } from './constants';
import { InputManager } from './InputManager';
import { Player } from './entities/Player';
import { Projectile } from './entities/Projectile';
import { Enemy, EnemyBullet, createEnemy, FormationBug, ShooterBug, TurretBug, BossEnemy, MiniBossEnemy, isMiniBosstType } from './entities/Enemy';
import { PowerUp, createPowerUp } from './entities/PowerUp';
import { ParticleSystem } from './entities/Particle';
import { SoundManager } from './SoundManager';
import { ChaosObstacleManager } from './ChaosObstacles';
import { LevelObstacleManager } from './LevelObstacles';
import { SideScrollerEngine } from './SideScroller';

const MAX_PROJECTILES = 80;
export class GameEngine {
    handleGlobalInput(now) {
        const spaceOrEnter = this.input.wasPressed(" ") || this.input.wasPressed("Enter");
        const escOrP = this.input.wasPressed("Escape") || this.input.wasPressed("p") || this.input.wasPressed("P");
        if (spaceOrEnter) {
            if (this.phase === "idle") this.startGame(now);
            else if (this.phase === "gameover") this.startGame(now);
        }
        if (escOrP) {
            if (this.phase === "playing") this.pauseGame();
            else if (this.phase === "paused") this.resumeGame(now);
        }
        // Gun toggles (god mode only, keys 1-4) — route through setActiveGuns for cap enforcement
        if (this.godMode && this.phase === "playing") {
            const toggled = (key)=>{
                this.setActiveGuns({
                    ...this.activeGuns,
                    [key]: !this.activeGuns[key]
                });
            };
            if (this.input.wasPressed("1")) toggled("plasma");
            if (this.input.wasPressed("2")) toggled("spread");
            if (this.input.wasPressed("3")) toggled("side");
            if (this.input.wasPressed("4")) toggled("rear");
        }
    }
    // ─── Update ─────────────────────────────────────────────────────────────────
    updateGame(dt, now) {
        const shooting = this.input.isDown(" ") || this.input.isDown("z") || this.input.isDown("Z");
        this.player.update(dt, this.input, this.canvas.width, this.canvas.height, now);
        // Debug mode slows enemies and enemy projectiles, not the player
        const debugDt = this.abilityDebug.active ? dt * 0.2 : dt;
        // Sync power-up state to React when it changes or expires
        if (this.player.activePowerUp !== this.lastReportedPowerUp) {
            this.lastReportedPowerUp = this.player.activePowerUp;
            this.callbacks.onPowerUpChange(this.player.activePowerUp, this.player.powerUpExpiresAt);
        }
        const wantShoot = this.godMode || shooting || this.mouseHeld;
        if (wantShoot && this.projectiles.length < MAX_PROJECTILES) {
            const normalRate = Math.max(100, Math.round(PLAYER.FIRE_RATE * this.bulletFireRateMult));
            const canFire = this.player.tryShoot(now, this.godMode, this.godMode ? undefined : normalRate);
            if (canFire) {
                // Play shoot sound based on active mode
                if (this.godMode) {
                    this.sound.playShoot("god");
                } else if (this.player.activePowerUp === "autoDocs") {
                    this.sound.playShoot("rapid");
                } else {
                    this.sound.playShoot("normal");
                }
                const { x, y, width: W, height: H } = this.player;
                const muzzle = y - H / 2;
                // Mouse aim: angle from player center toward cursor (default: straight up)
                const aimAngle = Math.atan2(this.mouseY - y, this.mouseX - x);
                const push = (p)=>{
                    if (this.projectiles.length < MAX_PROJECTILES) this.projectiles.push(p);
                };
                if (this.godMode) {
                    // ── GOD MODE: fire only toggled guns (cap at MAX_PROJECTILES) ────
                    const g = this.activeGuns;
                    if (g.plasma) push(new Projectile(x, muzzle, aimAngle, 700, 3, "plasma"));
                    if (g.spread) {
                        for(let i = -2; i <= 2; i++){
                            if (i === 0 && g.plasma) continue;
                            push(new Projectile(x, muzzle, aimAngle + i * 0.25, 600, 1, "spread"));
                        }
                    }
                    if (g.side) {
                        push(new Projectile(x, y, -Math.PI / 2 - 0.72, 550, 2, "side"));
                        push(new Projectile(x, y, -Math.PI / 2 + 0.72, 550, 2, "side"));
                    }
                    if (g.rear) {
                        push(new Projectile(x, y + H / 2, Math.PI / 2, 500, 1, "rear"));
                    }
                    if (!g.plasma && !g.spread && !g.side && !g.rear) {
                        push(new Projectile(x, muzzle, aimAngle));
                    }
                } else {
                    // ── Normal mode: fire all unlocked guns with upgrades applied ────
                    const bwm = this.bulletWidthMult;
                    const dmg = PROJECTILE.DAMAGE + this.bulletDamageBonus;
                    if (this.normalGunSet.has("plasma")) {
                        push(new Projectile(x, muzzle, aimAngle, 700, dmg + 2, "plasma", bwm));
                    } else {
                        push(new Projectile(x, muzzle, aimAngle, PROJECTILE.SPEED, dmg, "normal", bwm));
                    }
                    if (this.normalGunSet.has("spread")) {
                        for (const a of [
                            -0.30,
                            0.30
                        ]){
                            push(new Projectile(x, muzzle, aimAngle + a, 600, dmg, "spread", bwm));
                        }
                    }
                    if (this.normalGunSet.has("side")) {
                        push(new Projectile(x, y, -Math.PI / 2 - 0.72, 550, dmg, "side", bwm));
                        push(new Projectile(x, y, -Math.PI / 2 + 0.72, 550, dmg, "side", bwm));
                    }
                    if (this.normalGunSet.has("rear")) {
                        push(new Projectile(x, y + H / 2, Math.PI / 2, 500, dmg, "rear", bwm));
                    }
                }
            }
        }
        this.projectiles.forEach((p)=>p.update(dt, this.canvas.width, this.canvas.height));
        this.enemies.forEach((e)=>{
            e.update(debugDt, this.player.x, this.player.y, this.canvas.width, now);
            // Collect shooter bug bullets
            if ((e instanceof ShooterBug || e instanceof TurretBug) && e.pendingShots.length > 0) {
                for (const s of e.pendingShots)this.enemyBullets.push(s);
                e.pendingShots = [];
            }
            // Mini-boss shot updates + player collision
            if (e instanceof MiniBossEnemy) {
                e.updateShots(debugDt, this.canvas.width, this.canvas.height);
                if (!this.player.isInvincible(now)) {
                    for (const s of e.shots){
                        if (!s.active) continue;
                        const dx = s.x - this.player.x;
                        const dy = s.y - this.player.y;
                        const dist2 = dx * dx + dy * dy;
                        if (this.abilityShield.active && dist2 < 60 * 60) {
                            s.active = false;
                            if (--this.abilityShield.absorbLeft <= 0) this.abilityShield.active = false;
                            continue;
                        }
                        if (dist2 < 26 * 26) {
                            s.active = false;
                            this.doPlayerHit(now);
                        }
                    }
                }
            }
        });
        // Update enemy bullets + check player collision
        const cw = this.canvas.width, ch = this.canvas.height;
        for (const b of this.enemyBullets){
            if (!b.active) continue;
            b.x += b.vx * debugDt;
            b.y += b.vy * debugDt;
            if (b.x < -20 || b.x > cw + 20 || b.y < -20 || b.y > ch + 20) {
                b.active = false;
                continue;
            }
            const dx = b.x - this.player.x;
            const dy = b.y - this.player.y;
            const dist2 = dx * dx + dy * dy;
            // Shield absorbs bullet before it reaches the player
            if (this.abilityShield.active && dist2 < 60 * 60) {
                b.active = false;
                if (--this.abilityShield.absorbLeft <= 0) this.abilityShield.active = false;
                continue;
            }
            if (!this.player.isInvincible(now) && dist2 < 22 * 22) {
                b.active = false;
                this.doPlayerHit(now);
            }
        }
        this.enemyBullets = this.enemyBullets.filter((b)=>b.active);
        this.powerUps.forEach((p)=>p.update(dt));
        this.particles.update(dt);
        this.scorePopups.forEach((sp)=>{
            sp.life -= dt * 1.6;
            sp.y -= 38 * dt;
        });
        if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);
        if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.updateMultiplier();
            }
        }
        // Bonus-only: update environmental obstacles + check player collision
        if (this.bonusRound && this.chaosObstacles) {
            this.chaosObstacles.update(dt, this.canvas.width, this.canvas.height);
            if (!this.player.isInvincible(now) && this.chaosObstacles.checkPlayerCollision(this.player.x, this.player.y)) {
                this.doPlayerHit(now);
            }
        }
        // Level-specific environmental obstacles (Levels 1–5, not during boss or bonus)
        if (!this.bonusRound && !this.bossPhase && this.levelObstacles) {
            this.levelObstacles.update(dt, this.canvas.width, this.canvas.height);
            if (!this.player.isInvincible(now) && this.levelObstacles.checkPlayerCollision(this.player.x, this.player.y)) {
                this.doPlayerHit(now);
            }
        }
        this.updateAbilities(dt, now);
        this.checkCollisions(now);
        // Enemies that reach the bottom just disappear — only direct hits hurt the player
        for (const e of this.enemies){
            if (!e.active) continue;
            if (e.isOffscreen(this.canvas.height)) {
                e.active = false;
            }
        }
        // Cleanup inactive entities BEFORE wave update so enemies.length is accurate
        this.projectiles = this.projectiles.filter((p)=>p.active);
        this.enemies = this.enemies.filter((e)=>e.active);
        this.powerUps = this.powerUps.filter((p)=>p.active && !p.isOffscreen(this.canvas.height));
        this.scorePopups = this.scorePopups.filter((sp)=>sp.life > 0);
        this.updateEnvParticles(dt);
        if (this.bossPhase) {
            this.updateBoss(dt, now);
        } else {
            this.updateWaves(dt);
        }
    }
    updateBoss(dt, now) {
        if (!this.boss) return;
        this.boss.update(dt, this.player.x, this.canvas.width, this.canvas.height, now);
        // Boss shots hit player
        if (!this.player.isInvincible(now)) {
            for (const s of this.boss.shots){
                if (!s.active) continue;
                const dx = s.x - this.player.x;
                const dy = s.y - this.player.y;
                if (dx * dx + dy * dy < 28 * 28) {
                    s.active = false;
                    this.doPlayerHit(now);
                }
            }
        }
        // Player shots hit boss
        for (const proj of this.projectiles){
            if (!proj.active) continue;
            const b = this.boss;
            if (Math.abs(proj.x - b.x) < b.width / 2 + 4 && Math.abs(proj.y - b.y) < b.height / 2 + 4) {
                const died = b.takeDamage(proj.damage);
                proj.active = false;
                this.particles.emitSparks(proj.x, proj.y, "#FF4444");
                if (died) {
                    this.onBossKilled(now);
                } else {
                    this.sound.playBossHit();
                }
                break;
            }
        }
        this.projectiles = this.projectiles.filter((p)=>p.active);
        // Boss death sequence
        if (this.boss.dying) {
            this.bossDeathTimer += dt;
            this.bossDeathExplosionTimer -= dt;
            if (this.bossDeathExplosionTimer <= 0) {
                this.bossDeathExplosionTimer = 0.12;
                const bx = this.boss.x + (Math.random() - 0.5) * 120;
                const by = this.boss.y + (Math.random() - 0.5) * 120;
                const colors = [
                    "#FF4444",
                    "#FF8800",
                    "#FFD700",
                    "#FF00FF",
                    "#00FFFF"
                ];
                this.particles.emitExplosion(bx, by, colors[Math.floor(Math.random() * colors.length)], 10);
                this.shakeTimer = 0.2;
                this.shakeIntensity = 8;
                this.flashTimer = 0.08;
                this.flashColor = "rgba(255,200,50,0.25)";
            }
            if (this.boss.deathComplete) {
                // Massive final explosion
                this.sound.playExplosion(true);
                for(let i = 0; i < 8; i++){
                    const bx = this.boss.x + (Math.random() - 0.5) * 160;
                    const by = this.boss.y + (Math.random() - 0.5) * 160;
                    this.particles.emitExplosion(bx, by, "#FFD700", 18);
                }
                this.addScore(5000);
                this.scorePopups.push({
                    x: this.canvas.width / 2,
                    y: this.canvas.height / 2 - 40,
                    text: "BOSS DEFEATED! +5000",
                    life: 1.5,
                    color: "#FFD700"
                });
                this.shakeTimer = 0.8;
                this.shakeIntensity = 14;
                this.flashTimer = 0.8;
                this.flashColor = "rgba(255,220,50,0.5)";
                this.boss = null;
                this.bossPhase = false;
                // Transition to bonus round
                this.startBonusRoundAfterBoss(performance.now());
            }
        }
    }
    onBossKilled(now) {
        if (!this.boss) return;
        this.bossDeathTimer = 0;
        this.bossDeathExplosionTimer = 0;
        this.addScore(2000);
        this.scorePopups.push({
            x: this.boss.x,
            y: this.boss.y,
            text: "THE DOCS WIN! +2000",
            life: 1.2,
            color: "#FFD700"
        });
    }
    startBonusRoundAfterBoss(now) {
        var _this_callbacks_onBonusRound, _this_callbacks;
        this.bonusRound = true;
        this.chaosObstacles = new ChaosObstacleManager();
        this.chaosObstacles.reset(this.canvas.width, this.canvas.height);
        this.envId = "chaos";
        this.initEnvParticles();
        this.waveIndex = 0;
        this.waveState = "transitioning";
        this.waveTransitionTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
        this.bannerText = "⭐ BONUS ROUND ⭐";
        this.bannerSubtext = "CHAOS BUILD";
        this.bannerTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
        this.flashTimer = 0.6;
        this.flashColor = "rgba(200,0,255,0.3)";
        (_this_callbacks_onBonusRound = (_this_callbacks = this.callbacks).onBonusRound) === null || _this_callbacks_onBonusRound === void 0 ? void 0 : _this_callbacks_onBonusRound.call(_this_callbacks);
    }
    checkCollisions(now) {
        // Projectiles vs enemies
        for (const proj of this.projectiles){
            if (!proj.active) continue;
            for (const enemy of this.enemies){
                if (!enemy.active) continue;
                if (this.aabb(proj, enemy)) {
                    const died = enemy.takeDamage(proj.damage);
                    proj.active = false;
                    var _ENEMY_COLORS_enemy_type;
                    this.particles.emitSparks(enemy.x, enemy.y, (_ENEMY_COLORS_enemy_type = ENEMY_COLORS[enemy.type]) !== null && _ENEMY_COLORS_enemy_type !== void 0 ? _ENEMY_COLORS_enemy_type : "#ffff00");
                    if (died) {
                        this.onEnemyKilled(enemy, now);
                    } else {
                        this.sound.playEnemyHit();
                    }
                    break;
                }
            }
        }
        // Enemies vs player (body contact)
        if (!this.player.isInvincible(now)) {
            for (const enemy of this.enemies){
                if (!enemy.active) continue;
                if (this.circleOverlap(this.player, enemy, 22)) {
                    enemy.active = false;
                    this.particles.emitExplosion(enemy.x, enemy.y, "#FF4444", 8);
                    this.doPlayerHit(now);
                }
            }
        }
        // Power-ups vs player
        for (const pu of this.powerUps){
            if (!pu.active) continue;
            if (this.circleOverlap(this.player, pu, 30)) {
                pu.active = false;
                this.onPowerUpCollected(pu.type, pu.x, pu.y, now);
            }
        }
    }
    aabb(a, b) {
        return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
    }
    circleOverlap(a, b, radius) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy < radius * radius;
    }
    onEnemyKilled(enemy, now) {
        var _ENEMY_COLORS_enemy_type;
        this.particles.emitExplosion(enemy.x, enemy.y, (_ENEMY_COLORS_enemy_type = ENEMY_COLORS[enemy.type]) !== null && _ENEMY_COLORS_enemy_type !== void 0 ? _ENEMY_COLORS_enemy_type : "#FFAA00", PARTICLES.EXPLOSION_COUNT);
        this.sound.playExplosion(false);
        const pts = Math.round(enemy.points * this.multiplier);
        this.addScore(pts);
        this.combo++;
        this.comboTimer = SCORE.COMBO_WINDOW;
        this.updateMultiplier();
        this.scorePopups.push({
            x: enemy.x,
            y: enemy.y,
            text: "+".concat(pts),
            life: 1,
            color: pts >= 400 ? "#FFD700" : "#FFFFFF"
        });
        // 7% power-up drop chance, scattered to avoid clustering
        if (Math.random() < 0.07) {
            const scatter = (Math.random() - 0.5) * 160;
            const dropX = Math.max(30, Math.min(this.canvas.width - 30, enemy.x + scatter));
            this.powerUps.push((0,createPowerUp)(dropX));
        }
        // Extra life milestones
        for (const milestone of SCORE.EXTRA_LIFE_MILESTONES){
            if (this.score - pts < milestone && this.score >= milestone && this.player.lives < 5) {
                this.player.lives++;
                this.callbacks.onLivesChange(this.player.lives);
                this.scorePopups.push({
                    x: this.canvas.width / 2,
                    y: this.canvas.height / 2 + 30,
                    text: "1-UP! \uD83E\uDD89",
                    life: 1,
                    color: "#FF88AA"
                });
                this.sound.playExtraLife();
            }
        }
    }
    doPlayerHit(now) {
        if (this.godMode) return; // god mode: completely immune
        const lost = this.player.takeDamage(now);
        if (!lost) return;
        this.particles.emitFeathers(this.player.x, this.player.y);
        this.shakeTimer = 0.4;
        this.shakeIntensity = 7;
        this.flashTimer = 0.45;
        this.flashColor = "rgba(255, 30, 30, 0.35)";
        this.combo = 0;
        this.updateMultiplier();
        this.callbacks.onLivesChange(this.player.lives);
        if (this.player.lives <= 0) {
            this.sound.playPlayerDeath();
            this.sound.stopMusic();
            this.endGame();
        } else {
            this.sound.playPlayerDamage();
        }
    }
    onPowerUpCollected(type, x, y, now) {
        var _POWERUP_COLORS_type;
        this.particles.emitPowerUpCollect(x, y, (_POWERUP_COLORS_type = POWERUP_COLORS[type]) !== null && _POWERUP_COLORS_type !== void 0 ? _POWERUP_COLORS_type : "#FFFFFF");
        this.flashTimer = 0.2;
        var _POWERUP_COLORS_type1;
        this.flashColor = "rgba(".concat(hexToRgb((_POWERUP_COLORS_type1 = POWERUP_COLORS[type]) !== null && _POWERUP_COLORS_type1 !== void 0 ? _POWERUP_COLORS_type1 : "#FFFFFF"), ", 0.2)");
        if (type === "deployBurst") {
            this.sound.playDeployBurst();
            this.enemies.forEach((e)=>{
                if (!e.active) return;
                e.takeDamage(999);
                this.particles.emitExplosion(e.x, e.y, ENEMY_COLORS[e.type], 8);
            });
            this.enemies = this.enemies.filter((e)=>e.active);
            this.shakeTimer = 0.5;
            this.shakeIntensity = 10;
            this.flashTimer = 0.5;
            this.flashColor = "rgba(255, 140, 40, 0.4)";
            this.addScore(500);
            this.scorePopups.push({
                x,
                y,
                text: "DEPLOY BURST! +500",
                life: 1,
                color: "#FF8800"
            });
        } else if (type === "knowledgeCore") {
            this.sound.playPowerUp();
            this.addScore(500);
            this.scorePopups.push({
                x,
                y,
                text: "+500 KNOWLEDGE!",
                life: 1,
                color: "#FFD700"
            });
        } else {
            this.sound.playPowerUp();
            this.player.activatePowerUp(type, now);
            const expiry = type === "versionShield" ? -1 : now + 8000;
            this.callbacks.onPowerUpChange(type, expiry);
        }
    }
    addScore(points) {
        this.score += points;
        this.callbacks.onScoreChange(this.score);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.callbacks.onHighScoreChange(this.highScore);
            this.callbacks.onNewHighScore();
            try {
                localStorage.setItem("docsDefenderHighScore", String(this.highScore));
            } catch (e) {}
        }
    }
    updateMultiplier() {
        const m = Math.min(SCORE.MAX_MULTIPLIER, 1 + Math.floor(this.combo / SCORE.KILLS_PER_MULT));
        if (m !== this.multiplier) {
            const increased = m > this.multiplier;
            this.multiplier = m;
            this.callbacks.onMultiplierChange(m);
            if (increased) this.sound.playComboUp(m);
        }
    }
    // ─── Wave System ─────────────────────────────────────────────────────────────
    updateWaves(dt) {
        // Power-ups still spawn independently
        this.powerUpTimer -= dt;
        if (this.powerUpTimer <= 0) {
            const x = 60 + Math.random() * (this.canvas.width - 120);
            this.powerUps.push((0,createPowerUp)(x));
            this.powerUpTimer = 18 + Math.random() * 12;
        }
        // Transition delay between waves/levels
        if (this.waveState === "transitioning") {
            this.waveTransitionTimer -= dt;
            if (this.waveTransitionTimer <= 0) {
                this.beginWave();
            }
            return;
        }
        // Spawn next queued enemy
        if (this.waveQueue.length > 0 && this.enemies.length < DIFFICULTY.MAX_ENEMIES) {
            this.waveSpawnTimer -= dt;
            if (this.waveSpawnTimer <= 0) {
                if (this.waveQueue[0] === "formationBug") {
                    // Spawn one block of up to MAX_GROUP bugs — remaining stay queued for next block
                    const MAX_GROUP = 12;
                    const allFormation = this.waveQueue.filter((t)=>t === "formationBug");
                    const groupCount = Math.min(MAX_GROUP, allFormation.length);
                    let removed = 0;
                    this.waveQueue = this.waveQueue.filter((t)=>{
                        if (t === "formationBug" && removed < groupCount) { removed++; return false; }
                        return true;
                    });
                    this.spawnFormation(groupCount);
                    // Give a longer gap between formation blocks so they don't pile up
                    this.waveSpawnTimer = 3.5 + Math.random() * 1.5;
                    return;
                } else {
                    const type = this.waveQueue.shift();
                    this.enemies.push((0,createEnemy)(type, this.canvas.width, this.level));
                }
                this.waveSpawnTimer = DIFFICULTY.WAVE_SPAWN_INTERVAL * (0.7 + Math.random() * 0.6);
            }
        }
        // Wave complete: queue empty AND no enemies left
        if (this.waveQueue.length === 0 && this.enemies.length === 0) {
            this.onWaveComplete();
        }
    }
    spawnFormation(count) {
        const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(count))));
        const rows = Math.ceil(count / cols);
        const spacingX = 58;
        const spacingY = 52;
        const cw = this.canvas.width;
        const speedMult = 1 + (this.level - 1) * 0.08;
        const healthMults = [
            0.4,
            0.65,
            1.0,
            1.35,
            1.8
        ];
        const healthMult = healthMults[Math.min(this.level - 1, healthMults.length - 1)];
        // Centre the grid horizontally; start above screen
        const gridW = (cols - 1) * spacingX;
        const baseX = cw / 2 - gridW / 2;
        const baseY = -rows * spacingY - 20;
        let i = 0;
        for(let row = 0; row < rows && i < count; row++){
            for(let col = 0; col < cols && i < count; col++){
                const cx = baseX + col * spacingX;
                const y = baseY + row * spacingY;
                this.enemies.push(new FormationBug(cx, y, cx, speedMult, healthMult));
                i++;
            }
        }
    }
    // ─── Upgrade helpers ─────────────────────────────────────────────────────────
    applyWaveUpgrade() {
        const cycle = this.waveUpgradeIndex % 3;
        this.waveUpgradeIndex++;
        switch(cycle){
            case 0:
                this.bulletWidthMult = Math.min(2.5, this.bulletWidthMult + 0.35);
                return "⊕ BULLETS WIDER";
            case 1:
                this.bulletDamageBonus++;
                return "⚔ DAMAGE +".concat(this.bulletDamageBonus);
            case 2:
                this.bulletFireRateMult = Math.max(0.55, this.bulletFireRateMult - 0.12);
                return "⚡ FASTER FIRE";
        }
        return "";
    }
    initNormalGuns(startLevel) {
        this.normalGunSet = new Set([
            "normal"
        ]);
        if (startLevel >= 2) this.normalGunSet.add("spread");
        if (startLevel >= 3) this.normalGunSet.add("side");
        if (startLevel >= 4) this.normalGunSet.add("plasma");
        if (startLevel >= 5) this.normalGunSet.add("rear");
        this.reportNormalGuns();
    }
    reportNormalGuns() {
        var _this_callbacks_onGunsChange, _this_callbacks;
        const guns = {
            plasma: this.normalGunSet.has("plasma"),
            spread: this.normalGunSet.has("spread"),
            side: this.normalGunSet.has("side"),
            rear: this.normalGunSet.has("rear")
        };
        (_this_callbacks_onGunsChange = (_this_callbacks = this.callbacks).onGunsChange) === null || _this_callbacks_onGunsChange === void 0 ? void 0 : _this_callbacks_onGunsChange.call(_this_callbacks, guns);
        // Sync weapon visuals on the player sprite
        if (this.player) this.player.activeWeapons = new Set(this.normalGunSet);
    }
    onWaveComplete() {
        const waves = this.bonusRound ? BONUS_WAVES : LEVEL_WAVES[this.level - 1];
        if (this.waveIndex < waves.length - 1) {
            // More waves in this level / bonus round — apply a passive upgrade
            this.waveIndex++;
            this.waveState = "transitioning";
            this.waveTransitionTimer = DIFFICULTY.WAVE_CLEAR_DELAY;
            const upgradeMsg = this.applyWaveUpgrade();
            this.showBanner("WAVE ".concat(this.waveIndex + 1, " of ").concat(waves.length), upgradeMsg);
        } else if (this.bonusRound) {
            // Bonus round complete → SIDE-SCROLLER BONUS STAGE
            this.sound.stopMusic();
            this.startSideScroller();
        } else if (this.level < DIFFICULTY.MAX_LEVEL) {
            // Next level — unlock a new gun in normal mode
            this.level++;
            this.sound.playLevelUp();
            this.callbacks.onLevelChange(this.level);
            this.waveIndex = 0;
            this.waveState = "transitioning";
            this.waveTransitionTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
            const newEnv = (0,getEnvironment)(this.level);
            if (newEnv !== this.envId) {
                this.envId = newEnv;
                this.initEnvParticles();
            }
            // Reinit level obstacles for the new level
            this.levelObstacles = new LevelObstacleManager(this.level);
            this.levelObstacles.reset(this.canvas.width, this.canvas.height);
            const GUN_UNLOCKS = {
                2: {
                    key: "spread",
                    label: "\uD83C\uDF0A SPREAD SHOT UNLOCKED"
                },
                3: {
                    key: "side",
                    label: "⚡ SIDE CANNONS UNLOCKED"
                },
                4: {
                    key: "plasma",
                    label: "\uD83D\uDCA5 PLASMA CANNON UNLOCKED"
                },
                5: {
                    key: "rear",
                    label: "\uD83D\uDD34 REAR LAUNCHER UNLOCKED"
                }
            };
            const unlock = GUN_UNLOCKS[this.level];
            if (unlock && !this.godMode && !this.normalGunSet.has(unlock.key)) {
                this.normalGunSet.add(unlock.key);
                this.reportNormalGuns();
                this.showBanner("LEVEL ".concat(this.level, " \xb7 ").concat(ENVIRONMENTS[newEnv].name), unlock.label);
            } else {
                this.showBanner("LEVEL ".concat(this.level), ENVIRONMENTS[newEnv].name);
            }
        } else {
            // Level 5 done → BOSS FIGHT!
            this.levelObstacles = null;   // no hazards during final boss
            this.sound.playTrack("boss");
            this.sound.playBossEnter();
            this.bossPhase = true;
            this.bossDeathTimer = 0;
            this.bossDeathExplosionTimer = 0;
            this.enemies = [];
            this.boss = new BossEnemy(this.canvas.width);
            this.bannerText = "⚠ FINAL BOSS ⚠";
            this.bannerSubtext = "THE CORRUPTED BUILD";
            this.bannerTimer = 3.5;
            this.flashTimer = 0.6;
            this.flashColor = "rgba(255,40,40,0.35)";
            this.shakeTimer = 0.5;
            this.shakeIntensity = 8;
        }
    }
    beginWave() {
        this.sound.playWaveStart();
        const waves = this.bonusRound ? BONUS_WAVES : LEVEL_WAVES[this.level - 1];
        const wave = waves[this.waveIndex];
        // Check if this is a mini-boss wave
        const isMiniBossWave = wave.length === 1 && (0,isMiniBosstType)(wave[0].type);
        if (isMiniBossWave) {
            const miniBossNames = {
                bsodBug: "⚠ PIPELINE PHANTOM ⚠",
                loopZilla: "⟳ JWT JUGGERNAUT ⟳",
                syntaxTerror: "{ LEGACY LEVIATHAN }",
                nullPhantom: "🐉 DEPLOY DRAGON RISES",
                stackTitan: "🩹 PATCH HYDRA UNLEASHED"
            };
            const subNames = {
                bsodBug: "Your pipeline is broken...",
                loopZilla: "Token expired. Again.",
                syntaxTerror: "Deprecated since forever",
                nullPhantom: "Deployment failed: UNKNOWN",
                stackTitan: "Patch released... 47 more incoming"
            };
            const bossType = wave[0].type;
            var _miniBossNames_bossType, _subNames_bossType;
            this.showBanner((_miniBossNames_bossType = miniBossNames[bossType]) !== null && _miniBossNames_bossType !== void 0 ? _miniBossNames_bossType : "⚠ MINI-BOSS", (_subNames_bossType = subNames[bossType]) !== null && _subNames_bossType !== void 0 ? _subNames_bossType : "");
            this.sound.playBossEnter();
        }
        // Flatten into queue (no shuffle for mini-boss — it's a single enemy)
        const flat = wave.flatMap((e)=>Array(e.count).fill(e.type));
        if (!isMiniBossWave) {
            for(let i = flat.length - 1; i > 0; i--){
                const j = Math.floor(Math.random() * (i + 1));
                [flat[i], flat[j]] = [
                    flat[j],
                    flat[i]
                ];
            }
        }
        this.waveQueue = flat;
        this.waveSpawnTimer = isMiniBossWave ? 1.5 : 0.3;
        this.waveState = "active";
    }
    showBanner(text, subtext) {
        this.bannerText = text;
        this.bannerSubtext = subtext;
        this.bannerTimer = DIFFICULTY.WAVE_CLEAR_DELAY;
    }
    // ─── Environment ─────────────────────────────────────────────────────────────
    initEnvParticles() {
        const count = this.envId === "space" ? 0 : this.envId === "forest" ? 30 : this.envId === "city" ? 50 : this.envId === "ocean" ? 35 : this.envId === "chaos" ? 80 : 60;
        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;
        this.envParticles = Array.from({
            length: count
        }, ()=>this.spawnEnvParticle(w, h, true));
        // Procedural geometry (deterministic using level as seed)
        const rng = (seed)=>{
            const x = Math.sin(seed) * 43758.5453;
            return x - Math.floor(x);
        };
        const nodes = [];
        for(let i = 0; i < 40; i++)nodes.push(rng(this.level * 31.7 + i * 13.3));
        this.envGeometry = {
            nodes
        };
        this.envScrollX = 0;
    }
    spawnEnvParticle(w, h) {
        let anywhere = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
        const x = Math.random() * w;
        const y = anywhere ? Math.random() * h : -10;
        switch(this.envId){
            case "forest":
                {
                    const green = Math.floor(100 + Math.random() * 80);
                    return {
                        x,
                        y,
                        vx: -20 + Math.random() * 40,
                        vy: 40 + Math.random() * 60,
                        size: 4 + Math.random() * 5,
                        alpha: 0.4 + Math.random() * 0.5,
                        life: Math.random(),
                        color: "rgb(20,".concat(green, ",20)")
                    };
                }
            case "city":
                {
                    return {
                        x,
                        y,
                        vx: -15 + Math.random() * 30,
                        vy: 200 + Math.random() * 200,
                        size: 1 + Math.random() * 1.5,
                        alpha: 0.2 + Math.random() * 0.4,
                        life: Math.random(),
                        color: "#8899CC"
                    };
                }
            case "ocean":
                {
                    const startY = anywhere ? Math.random() * h : h + 10;
                    return {
                        x,
                        y: startY,
                        vx: -10 + Math.random() * 20,
                        vy: -(20 + Math.random() * 50),
                        size: 2 + Math.random() * 4,
                        alpha: 0.2 + Math.random() * 0.4,
                        life: Math.random(),
                        color: "#44AADD"
                    };
                }
            case "inferno":
                {
                    const startY = anywhere ? Math.random() * h : h + 10;
                    return {
                        x,
                        y: startY,
                        vx: -30 + Math.random() * 60,
                        vy: -(60 + Math.random() * 120),
                        size: 2 + Math.random() * 4,
                        alpha: 0.5 + Math.random() * 0.5,
                        life: Math.random(),
                        color: Math.random() < 0.5 ? "#FF6600" : "#FF3300"
                    };
                }
            case "chaos":
                {
                    const angle = Math.random() * Math.PI * 2;
                    const spd = 40 + Math.random() * 100;
                    const hue = Math.floor(Math.random() * 360);
                    const cx = anywhere ? Math.random() * w : w / 2 + (Math.random() - 0.5) * 200;
                    const cy = anywhere ? Math.random() * h : h / 2 + (Math.random() - 0.5) * 200;
                    return {
                        x: cx,
                        y: cy,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        size: 2 + Math.random() * 4,
                        alpha: 0.7 + Math.random() * 0.3,
                        life: Math.random(),
                        color: "hsl(".concat(hue, ",100%,65%)")
                    };
                }
            default:
                return {
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    size: 0,
                    alpha: 0,
                    life: 1,
                    color: "#fff"
                };
        }
    }
    updateEnvParticles(dt) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.envScrollX += 90 * dt;
        for (const p of this.envParticles){
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * (this.envId === "city" ? 1.5 : 0.4);
            const offscreen = this.envId === "chaos" ? p.y < -20 || p.y > h + 20 // chaos: any vertical edge (x handled below)
             : this.envId === "ocean" || this.envId === "inferno" ? p.y < -20 : p.y > h + 20;
            if (p.life <= 0 || offscreen || p.x < -30 || p.x > w + 30) {
                Object.assign(p, this.spawnEnvParticle(w, h, false));
                p.life = 1;
            }
        }
    }
    drawEnvironment(ctx, now) {
        const { canvas } = this;
        const env = ENVIRONMENTS[this.envId];
        const w = canvas.width;
        const h = canvas.height;
        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, env.bgTop);
        grad.addColorStop(1, env.bgBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(-20, -20, w + 40, h + 40);
        if (this.envId === "space") {
            // Stars
            this.drawStars();
            return;
        }
        const nodes = this.envGeometry.nodes;
        if (this.envId === "forest") {
            const TILE = 1600;
            // Ground
            ctx.fillStyle = "#071A09";
            ctx.fillRect(0, h - 50, w, 50);
            // Layer 1 — distant trees (slow)
            ctx.fillStyle = "#030D05";
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.28 % TILE;
                for(let i = 0; i < 9; i++){
                    const tx = nodes[i] * TILE - offset + pass * TILE;
                    if(tx < -80 || tx > w + 80) continue;
                    const th = 55 + nodes[i + 9] * 75;
                    const tw = 20 + nodes[i + 18] * 18;
                    ctx.fillRect(tx - tw * 0.12, h - 50 - th * 0.3, tw * 0.24, th * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(tx, h - 50 - th);
                    ctx.lineTo(tx - tw / 2, h - 50 - th * 0.3);
                    ctx.lineTo(tx + tw / 2, h - 50 - th * 0.3);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            // Layer 2 — midground trees (medium)
            ctx.fillStyle = "#051208";
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.62 % TILE;
                for(let i = 0; i < 11; i++){
                    const tx = nodes[(i + 9) % 40] * TILE - offset + pass * TILE;
                    if(tx < -100 || tx > w + 100) continue;
                    const th = 80 + nodes[(i + 20) % 40] * 130;
                    const tw = 30 + nodes[(i + 30) % 40] * 38;
                    ctx.fillRect(tx - tw * 0.12, h - 50 - th * 0.3, tw * 0.24, th * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(tx, h - 50 - th);
                    ctx.lineTo(tx - tw / 2, h - 50 - th * 0.25);
                    ctx.lineTo(tx + tw / 2, h - 50 - th * 0.25);
                    ctx.closePath();
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(tx, h - 50 - th * 0.7);
                    ctx.lineTo(tx - tw * 0.65, h - 50 - th * 0.15);
                    ctx.lineTo(tx + tw * 0.65, h - 50 - th * 0.15);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            // Layer 3 — near ground bushes (fast)
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 1.25 % TILE;
                for(let i = 0; i < 9; i++){
                    const tx = nodes[(i + 22) % 40] * TILE - offset + pass * TILE;
                    if(tx < -70 || tx > w + 70) continue;
                    const bh = 18 + nodes[(i + 31) % 40] * 28;
                    const bw = 38 + nodes[(i + 37) % 40] * 52;
                    ctx.fillStyle = "#071A09";
                    ctx.beginPath();
                    ctx.ellipse(tx, h - 50, bw / 2, bh / 2, 0, Math.PI, 0);
                    ctx.fill();
                }
            }
            // Glowing moss on ground
            ctx.fillStyle = "rgba(20, 120, 30, 0.15)";
            ctx.fillRect(0, h - 52, w, 4);
            // Env particles (leaves)
            for (const p of this.envParticles){
                ctx.save();
                ctx.globalAlpha = p.alpha * Math.max(0, p.life);
                ctx.translate(p.x, p.y);
                ctx.rotate(now * 0.001 * (p.vx > 0 ? 1 : -1));
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }
        } else if (this.envId === "city") {
            const TILE = 1800;
            // Layer 1 — distant small buildings (slow)
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.22 % TILE;
                for(let i = 0; i < 10; i++){
                    const bx = nodes[i] * TILE - offset + pass * TILE;
                    if(bx < -80 || bx > w + 80) continue;
                    const bw = 32 + nodes[i + 10] * 38;
                    const bh = 55 + nodes[i + 20] * 130;
                    const r = Math.floor(nodes[i] * 12);
                    const g = Math.floor(nodes[(i + 5) % 40] * 12);
                    const b = Math.floor(25 + nodes[(i + 10) % 40] * 35);
                    ctx.fillStyle = "rgb(".concat(r, ",").concat(g, ",").concat(b, ")");
                    ctx.fillRect(bx, h - bh, bw, bh);
                    for(let wy = h - bh + 8; wy < h - 8; wy += 16){
                        for(let wx = bx + 5; wx < bx + bw - 5; wx += 11){
                            if(nodes[Math.floor((wx + wy) / 11) % 40] > 0.45){
                                ctx.fillStyle = "rgba(60,100,180,0.45)";
                                ctx.fillRect(wx, wy, 6, 8);
                            }
                        }
                    }
                }
            }
            // Layer 2 — midground main skyline (medium)
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.55 % TILE;
                for(let i = 0; i < 13; i++){
                    const bx = nodes[(i + 14) % 40] * TILE - offset + pass * TILE;
                    if(bx < -100 || bx > w + 100) continue;
                    const bw = 44 + nodes[(i + 24) % 40] * 54;
                    const bh = 100 + nodes[(i + 34) % 40] * 230;
                    const r = Math.floor(nodes[(i + 2) % 40] * 20);
                    const g = Math.floor(nodes[(i + 7) % 40] * 20);
                    const b = Math.floor(50 + nodes[(i + 12) % 40] * 65);
                    ctx.fillStyle = "rgb(".concat(r, ",").concat(g, ",").concat(b, ")");
                    ctx.fillRect(bx, h - bh, bw, bh);
                    for(let wy = h - bh + 10; wy < h - 10; wy += 18){
                        for(let wx = bx + 6; wx < bx + bw - 6; wx += 14){
                            if(nodes[Math.floor(wx / 14 + wy / 18) % 40] > 0.35){
                                const brightness = 0.4 + nodes[Math.floor((wx + wy) / 7) % 40] * 0.6;
                                const cr = Math.floor(100 * brightness), cg = Math.floor(150 * brightness), cb = Math.floor(255 * brightness);
                                ctx.fillStyle = "rgba(".concat(cr, ",").concat(cg, ",").concat(cb, ",0.75)");
                                ctx.fillRect(wx, wy, 8, 10);
                            }
                        }
                    }
                }
            }
            // Ground / road
            ctx.fillStyle = "#0a0a18";
            ctx.fillRect(0, h - 30, w, 30);
            // Scrolling neon road dashes
            const dashOffset = this.envScrollX * 1.4 % 35;
            ctx.strokeStyle = "rgba(80, 80, 255, 0.35)";
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 15]);
            ctx.lineDashOffset = -dashOffset;
            ctx.beginPath();
            ctx.moveTo(0, h - 15);
            ctx.lineTo(w, h - 15);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            // Rain particles
            for (const p of this.envParticles){
                ctx.save();
                ctx.globalAlpha = p.alpha * Math.max(0, p.life);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04);
                ctx.stroke();
                ctx.restore();
            }
        } else if (this.envId === "ocean") {
            const TILE = 1400;
            // Deep ocean floor
            ctx.fillStyle = "#020D1E";
            ctx.fillRect(0, h - 45, w, 45);
            // Animated wave layers (background depth)
            for(let wave = 0; wave < 4; wave++){
                const wy = h * 0.25 + wave * 80;
                const alpha = 0.12 + wave * 0.04;
                ctx.strokeStyle = "rgba(30, 100, 180, ".concat(alpha, ")");
                ctx.lineWidth = 2 + wave * 0.5;
                ctx.beginPath();
                for(let x2 = 0; x2 <= w; x2 += 6){
                    const scrollShift = this.envScrollX * (0.3 + wave * 0.15);
                    const y2 = wy + Math.sin((x2 + scrollShift) / w * Math.PI * 7 + now * 0.0006 + wave * 1.4) * (8 + wave * 4);
                    x2 === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
                }
                ctx.stroke();
            }
            // Layer 1 — far coral/rocks (slow)
            ctx.fillStyle = "#071828";
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.38 % TILE;
                for(let i = 0; i < 12; i++){
                    const rx = nodes[i] * TILE - offset + pass * TILE;
                    if(rx < -60 || rx > w + 60) continue;
                    const rh = 20 + nodes[i + 10] * 50;
                    const rw = 15 + nodes[i + 20] * 35;
                    ctx.beginPath();
                    ctx.ellipse(rx, h - 45, rw / 2, rh / 2, 0, Math.PI, 0);
                    ctx.fill();
                }
            }
            // Layer 2 — near kelp strands (fast, animated sway)
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 1.05 % TILE;
                for(let i = 0; i < 9; i++){
                    const kx = nodes[(i + 25) % 40] * TILE - offset + pass * TILE;
                    if(kx < -30 || kx > w + 30) continue;
                    const kh = 35 + nodes[(i + 32) % 40] * 55;
                    const green = Math.floor(100 + nodes[(i + 15) % 40] * 80);
                    ctx.strokeStyle = "rgba(0,".concat(green, ",70,0.65)");
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(kx, h - 45);
                    for(let seg = 1; seg <= 5; seg++){
                        const segy = h - 45 - seg * (kh / 5);
                        const segx = kx + Math.sin(now * 0.0009 + seg * 0.9 + i * 2.1) * 9;
                        ctx.lineTo(segx, segy);
                    }
                    ctx.stroke();
                }
            }
            // Bioluminescent glow at bottom
            const glow = ctx.createLinearGradient(0, h - 60, 0, h);
            glow.addColorStop(0, "rgba(0, 80, 160, 0)");
            glow.addColorStop(1, "rgba(0, 120, 200, 0.2)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, h - 60, w, 60);
            // Bubble particles
            for (const p of this.envParticles){
                ctx.save();
                ctx.globalAlpha = p.alpha * Math.max(0, p.life);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else if (this.envId === "inferno") {
            const TILE = 1400;
            // Lava floor
            const lavaGrad = ctx.createLinearGradient(0, h - 80, 0, h);
            lavaGrad.addColorStop(0, "rgba(200, 30, 0, 0)");
            lavaGrad.addColorStop(0.5, "rgba(240, 80, 0, 0.55)");
            lavaGrad.addColorStop(1, "rgba(255, 120, 0, 0.85)");
            ctx.fillStyle = lavaGrad;
            ctx.fillRect(0, h - 80, w, 80);
            // Lava surface waves (scroll-driven)
            for(let lw = 0; lw < 2; lw++){
                ctx.strokeStyle = lw === 0 ? "rgba(255, 140, 0, 0.5)" : "rgba(255, 60, 0, 0.3)";
                ctx.lineWidth = 3 - lw;
                ctx.beginPath();
                for(let x2 = 0; x2 <= w; x2 += 6){
                    const shift = this.envScrollX * (0.8 + lw * 0.4);
                    const y2 = h - 80 + lw * 12 + Math.sin((x2 + shift) / 80 + now * 0.002 + lw * 1.5) * 10;
                    x2 === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
                }
                ctx.stroke();
            }
            // Layer 1 — far dark rocks (slow)
            ctx.fillStyle = "#0F0100";
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.32 % TILE;
                for(let i = 0; i < 9; i++){
                    const rx = nodes[i] * TILE - offset + pass * TILE;
                    if(rx < -70 || rx > w + 70) continue;
                    const rh = 22 + nodes[i + 9] * 42;
                    const rw = 26 + nodes[i + 18] * 44;
                    ctx.beginPath();
                    ctx.moveTo(rx - rw / 2, h);
                    ctx.lineTo(rx - rw * 0.1, h - rh);
                    ctx.lineTo(rx + rw * 0.1, h - rh);
                    ctx.lineTo(rx + rw / 2, h);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            // Layer 2 — near rocks (fast, lava-lit edges)
            for(let pass = 0; pass < 2; pass++){
                const offset = this.envScrollX * 0.92 % TILE;
                for(let i = 0; i < 11; i++){
                    const rx = nodes[(i + 20) % 40] * TILE - offset + pass * TILE;
                    if(rx < -80 || rx > w + 80) continue;
                    const rh = 30 + nodes[(i + 28) % 40] * 65;
                    const rw = 24 + nodes[(i + 38) % 40] * 48;
                    ctx.fillStyle = "#1A0100";
                    ctx.beginPath();
                    ctx.moveTo(rx - rw / 2, h);
                    ctx.lineTo(rx, h - rh);
                    ctx.lineTo(rx + rw / 2, h);
                    ctx.closePath();
                    ctx.fill();
                    // Lava glow at rock base
                    const glowGrad = ctx.createRadialGradient(rx, h - 5, 0, rx, h - 5, rw * 0.6);
                    glowGrad.addColorStop(0, "rgba(255, 80, 0, 0.22)");
                    glowGrad.addColorStop(1, "rgba(255, 80, 0, 0)");
                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.ellipse(rx, h - 5, rw * 0.6, 14, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Ember particles
            for (const p of this.envParticles){
                ctx.save();
                ctx.globalAlpha = p.alpha * Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        } else if (this.envId === "chaos") {
            // ── CHAOS DIMENSION ──────────────────────────────────────────────────
            // Shifting rainbow gradient background
            const hue = now * 0.04 % 360;
            const grad2 = ctx.createLinearGradient(0, 0, w, h);
            grad2.addColorStop(0, "hsl(".concat(hue, ",80%,5%)"));
            grad2.addColorStop(0.5, "hsl(".concat((hue + 130) % 360, ",80%,4%)"));
            grad2.addColorStop(1, "hsl(".concat((hue + 260) % 360, ",80%,5%)"));
            ctx.fillStyle = grad2;
            ctx.fillRect(-20, -20, w + 40, h + 40);
            // Animated neon grid
            const gridSize = 58;
            const gridAlpha = 0.10 + Math.sin(now * 0.003) * 0.05;
            ctx.lineWidth = 1;
            for(let gx = 0; gx < w + gridSize; gx += gridSize){
                const lh = (hue + gx * 0.5) % 360;
                ctx.strokeStyle = "hsla(".concat(lh, ",100%,60%,").concat(gridAlpha, ")");
                ctx.beginPath();
                ctx.moveTo(gx, 0);
                ctx.lineTo(gx, h);
                ctx.stroke();
            }
            for(let gy = 0; gy < h + gridSize; gy += gridSize){
                const lh = (hue + gy * 0.5 + 180) % 360;
                ctx.strokeStyle = "hsla(".concat(lh, ",100%,60%,").concat(gridAlpha, ")");
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(w, gy);
                ctx.stroke();
            }
            // Pulsing concentric rings expanding from center
            const cx2 = w / 2, cy2 = h / 2;
            for(let ring = 0; ring < 6; ring++){
                const r = (now * 0.07 + ring * 70) % 420;
                const ra = Math.max(0, 0.35 - r / 420 * 0.35);
                const rh = (hue + ring * 55) % 360;
                ctx.strokeStyle = "hsla(".concat(rh, ",100%,70%,").concat(ra, ")");
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
                ctx.stroke();
            }
            // Diagonal rainbow streaks across screen
            ctx.lineWidth = 1.5;
            for(let s = 0; s < 5; s++){
                const offset = (now * 60 + s * 200) % (w + h);
                const sh = (hue + s * 72) % 360;
                ctx.strokeStyle = "hsla(".concat(sh, ",100%,65%,0.12)");
                ctx.beginPath();
                ctx.moveTo(offset - h, 0);
                ctx.lineTo(offset, h);
                ctx.stroke();
            }
            // Floor checkerboard pattern (bottom third)
            const tileSize = 40;
            const floorY = h * 0.72;
            for(let tx = 0; tx < w; tx += tileSize){
                for(let ty = floorY; ty < h; ty += tileSize){
                    const idx = Math.floor(tx / tileSize) + Math.floor(ty / tileSize) + Math.floor(now / 400);
                    if (idx % 2 === 0) {
                        const th = (hue + tx * 0.3 + ty * 0.2) % 360;
                        ctx.fillStyle = "hsla(".concat(th, ",80%,18%,0.5)");
                        ctx.fillRect(tx, ty, tileSize, tileSize);
                    }
                }
            }
            // Rainbow sparkle particles
            for (const p of this.envParticles){
                ctx.save();
                const life = Math.max(0, p.life);
                ctx.globalAlpha = p.alpha * life;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * life, 0, Math.PI * 2);
                ctx.fill();
                // Star cross
                ctx.lineWidth = 1;
                ctx.strokeStyle = p.color;
                ctx.beginPath();
                ctx.moveTo(p.x - p.size * 2 * life, p.y);
                ctx.lineTo(p.x + p.size * 2 * life, p.y);
                ctx.moveTo(p.x, p.y - p.size * 2 * life);
                ctx.lineTo(p.x, p.y + p.size * 2 * life);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        }
    }
    // ─── Idle planet ────────────────────────────────────────────────────────────
    drawIdlePlanet(ctx, now) {
        const { canvas } = this;
        const w = canvas.width;
        const h = canvas.height;
        // Planet sits lower-right, large radius, partially clipped by screen edge
        const pr = Math.min(w, h) * 0.62;
        const px = w * 0.72;
        const py = h * 0.78;
        const drift = now * 0.000025;
        // ── Per-environment planet appearance ──
        const envId = this.envId;
        if (envId === "chaos") {
            // CHAOS DIMENSION — shifting rainbow sphere
            const hueShift = now * 0.02 % 360;
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.25, pr * 0.05, px, py, pr);
            base.addColorStop(0, "hsl(".concat(hueShift, ",100%,55%)"));
            base.addColorStop(0.35, "hsl(".concat((hueShift + 80) % 360, ",100%,35%)"));
            base.addColorStop(0.7, "hsl(".concat((hueShift + 160) % 360, ",100%,20%)"));
            base.addColorStop(1, "hsl(".concat((hueShift + 240) % 360, ",100%,10%)"));
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            // Chaos bands
            for(let i = 0; i < 5; i++){
                const by = py + (-0.4 + i * 0.2) * pr;
                const bh = 0.08 * pr;
                const bHue = (hueShift + i * 60) % 360;
                const xOff = Math.sin(drift * 2 + i * 3.7) * pr * 0.06;
                const bg = ctx.createLinearGradient(0, by - bh, 0, by + bh);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, "hsla(".concat(bHue, ",100%,65%,0.45)"));
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh, pr * 2, bh * 2);
            }
            ctx.restore();
            // Rainbow atmosphere halo
            const atmoHue = (hueShift + 30) % 360;
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.22);
            atmo.addColorStop(0, "hsla(".concat(atmoHue, ",100%,65%,0.6)"));
            atmo.addColorStop(0.5, "hsla(".concat((atmoHue + 60) % 360, ",100%,50%,0.2)"));
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.22, 0, Math.PI * 2);
            ctx.fill();
        } else if (envId === "inferno") {
            // INFERNO CORE — lava world
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.25, pr * 0.05, px, py, pr);
            base.addColorStop(0, "#FF6020");
            base.addColorStop(0.3, "#CC2800");
            base.addColorStop(0.65, "#7A0A00");
            base.addColorStop(1, "#200000");
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            // Lava cracks / flow bands
            const lavaBands = [
                {
                    y: -0.35,
                    h: 0.06,
                    color: "rgba(255,120,0,0.40)"
                },
                {
                    y: -0.1,
                    h: 0.05,
                    color: "rgba(255,80,0,0.35)"
                },
                {
                    y: 0.12,
                    h: 0.08,
                    color: "rgba(255,150,20,0.30)"
                },
                {
                    y: 0.32,
                    h: 0.05,
                    color: "rgba(255,60,0,0.38)"
                }
            ];
            for (const b of lavaBands){
                const by = py + b.y * pr;
                const bh = b.h * pr;
                const xOff = Math.sin(drift * 1.5 + b.y * 9) * pr * 0.05;
                const bg = ctx.createLinearGradient(0, by - bh, 0, by + bh);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, b.color);
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh, pr * 2, bh * 2);
            }
            // Glowing hot spot
            const hotT = now * 0.0002;
            const hx = px + Math.cos(hotT) * pr * 0.2;
            const hy = py - pr * 0.08;
            const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, pr * 0.18);
            hot.addColorStop(0, "rgba(255,200,80,0.55)");
            hot.addColorStop(0.4, "rgba(255,80,0,0.25)");
            hot.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = hot;
            ctx.beginPath();
            ctx.ellipse(hx, hy, pr * 0.18, pr * 0.1, hotT * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // Fire atmosphere
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.20);
            atmo.addColorStop(0, "rgba(255,80,0,0.65)");
            atmo.addColorStop(0.4, "rgba(180,30,0,0.28)");
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.20, 0, Math.PI * 2);
            ctx.fill();
        } else if (envId === "ocean") {
            // DEEP OCEAN — water world
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.25, py - pr * 0.3, pr * 0.05, px, py, pr);
            base.addColorStop(0, "#2080CC");
            base.addColorStop(0.35, "#0A4A88");
            base.addColorStop(0.7, "#042050");
            base.addColorStop(1, "#010818");
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            // Cloud swirls
            const cloudBands = [
                {
                    y: -0.40,
                    h: 0.09,
                    color: "rgba(200,230,255,0.30)"
                },
                {
                    y: -0.15,
                    h: 0.07,
                    color: "rgba(180,215,255,0.22)"
                },
                {
                    y: 0.08,
                    h: 0.10,
                    color: "rgba(210,235,255,0.18)"
                },
                {
                    y: 0.30,
                    h: 0.06,
                    color: "rgba(190,220,255,0.25)"
                }
            ];
            for (const b of cloudBands){
                const by = py + b.y * pr;
                const bh = b.h * pr;
                const xOff = Math.sin(drift + b.y * 8) * pr * 0.05;
                const bg = ctx.createLinearGradient(0, by - bh, 0, by + bh);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, b.color);
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh, pr * 2, bh * 2);
            }
            ctx.restore();
            // Blue atmosphere
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.18);
            atmo.addColorStop(0, "rgba(60,160,255,0.55)");
            atmo.addColorStop(0.4, "rgba(20,80,180,0.22)");
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.18, 0, Math.PI * 2);
            ctx.fill();
        } else if (envId === "city") {
            // NEON CITY — dark world with glowing city lights
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.2, py - pr * 0.25, pr * 0.05, px, py, pr);
            base.addColorStop(0, "#1A1035");
            base.addColorStop(0.4, "#0A0820");
            base.addColorStop(1, "#020108");
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            // Neon city light bands — bright streaks
            const neonBands = [
                {
                    y: -0.30,
                    h: 0.04,
                    color: "rgba(180,80,255,0.50)"
                },
                {
                    y: -0.10,
                    h: 0.03,
                    color: "rgba(0,200,255,0.45)"
                },
                {
                    y: 0.05,
                    h: 0.05,
                    color: "rgba(255,50,200,0.40)"
                },
                {
                    y: 0.22,
                    h: 0.03,
                    color: "rgba(100,255,200,0.35)"
                },
                {
                    y: 0.36,
                    h: 0.04,
                    color: "rgba(200,100,255,0.42)"
                }
            ];
            for (const b of neonBands){
                const by = py + b.y * pr;
                const bh = b.h * pr;
                const xOff = Math.sin(drift * 0.8 + b.y * 10) * pr * 0.03;
                const bg = ctx.createLinearGradient(0, by - bh, 0, by + bh);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, b.color);
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh, pr * 2, bh * 2);
            }
            ctx.restore();
            // Purple atmosphere glow
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.18);
            atmo.addColorStop(0, "rgba(140,60,255,0.50)");
            atmo.addColorStop(0.4, "rgba(80,20,180,0.20)");
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.18, 0, Math.PI * 2);
            ctx.fill();
        } else if (envId === "forest") {
            // ANCIENT FOREST — green terrestrial planet
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.28, py - pr * 0.3, pr * 0.05, px, py, pr);
            base.addColorStop(0, "#3AAA50");
            base.addColorStop(0.3, "#1A6630");
            base.addColorStop(0.65, "#0A3A18");
            base.addColorStop(1, "#020E06");
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            // Ocean patches (dark blue blobs using ellipses)
            ctx.fillStyle = "rgba(20,60,140,0.55)";
            ctx.beginPath();
            ctx.ellipse(px + pr * 0.22, py - pr * 0.18, pr * 0.28, pr * 0.18, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(px - pr * 0.15, py + pr * 0.25, pr * 0.20, pr * 0.14, -0.3, 0, Math.PI * 2);
            ctx.fill();
            // White cloud bands
            const cloudBands = [
                {
                    y: -0.28,
                    h: 0.06,
                    color: "rgba(230,245,230,0.28)"
                },
                {
                    y: 0.10,
                    h: 0.07,
                    color: "rgba(220,240,220,0.22)"
                },
                {
                    y: 0.35,
                    h: 0.05,
                    color: "rgba(210,235,210,0.20)"
                }
            ];
            for (const b of cloudBands){
                const by = py + b.y * pr;
                const bh = b.h * pr;
                const xOff = Math.sin(drift + b.y * 7) * pr * 0.04;
                const bg = ctx.createLinearGradient(0, by - bh, 0, by + bh);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, b.color);
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh, pr * 2, bh * 2);
            }
            ctx.restore();
            // Green atmosphere
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.18);
            atmo.addColorStop(0, "rgba(60,200,90,0.50)");
            atmo.addColorStop(0.4, "rgba(20,120,50,0.20)");
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // DEEP SPACE (default) — amber gas giant
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.clip();
            const base = ctx.createRadialGradient(px - pr * 0.28, py - pr * 0.3, pr * 0.05, px, py, pr);
            base.addColorStop(0, "#C87941");
            base.addColorStop(0.3, "#A05A28");
            base.addColorStop(0.65, "#7A3A14");
            base.addColorStop(1, "#3D1808");
            ctx.fillStyle = base;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
            const bands = [
                {
                    y: -0.38,
                    h: 0.07,
                    color: "rgba(200,130,60,0.35)"
                },
                {
                    y: -0.18,
                    h: 0.09,
                    color: "rgba(255,160,70,0.22)"
                },
                {
                    y: 0.02,
                    h: 0.06,
                    color: "rgba(160,80,30,0.30)"
                },
                {
                    y: 0.20,
                    h: 0.10,
                    color: "rgba(210,120,50,0.28)"
                },
                {
                    y: 0.38,
                    h: 0.05,
                    color: "rgba(240,170,80,0.18)"
                }
            ];
            for (const b of bands){
                const by = py + b.y * pr;
                const bh = b.h * pr;
                const xOff = Math.sin(drift + b.y * 12) * pr * 0.04;
                const bg = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
                bg.addColorStop(0, "rgba(0,0,0,0)");
                bg.addColorStop(0.5, b.color);
                bg.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bg;
                ctx.fillRect(px - pr + xOff, by - bh / 2, pr * 2, bh);
            }
            const stormT = now * 0.00015;
            const sx = px + Math.cos(stormT) * pr * 0.25;
            const sy = py - pr * 0.1;
            const storm = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 0.12);
            storm.addColorStop(0, "rgba(255,140,50,0.30)");
            storm.addColorStop(0.5, "rgba(200,90,30,0.15)");
            storm.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = storm;
            ctx.beginPath();
            ctx.ellipse(sx, sy, pr * 0.12, pr * 0.07, stormT * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            const atmo = ctx.createRadialGradient(px, py, pr * 0.88, px, py, pr * 1.18);
            atmo.addColorStop(0, "rgba(200,110,40,0.55)");
            atmo.addColorStop(0.4, "rgba(160,70,20,0.25)");
            atmo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = atmo;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.18, 0, Math.PI * 2);
            ctx.fill();
        }
        // Shared: rim highlight (light from upper-left) + night-side terminator
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();
        const rim = ctx.createRadialGradient(px - pr * 0.72, py - pr * 0.55, pr * 0.3, px - pr * 0.72, py - pr * 0.55, pr * 1.1);
        rim.addColorStop(0, "rgba(255,255,255,0.22)");
        rim.addColorStop(0.3, "rgba(255,255,255,0.07)");
        rim.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rim;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        const term = ctx.createRadialGradient(px + pr * 0.45, py + pr * 0.35, pr * 0.1, px + pr * 0.45, py + pr * 0.35, pr * 1.2);
        term.addColorStop(0, "rgba(0,0,0,0.72)");
        term.addColorStop(0.6, "rgba(0,0,0,0.18)");
        term.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = term;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        ctx.restore();
    }
    // ─── Rendering ──────────────────────────────────────────────────────────────
    render(now) {
        const { ctx, canvas } = this;
        // Side-scroller bonus stage: draw on clean background, skip normal render
        if (this.phase === "sidescroller" && this.sideScroller) {
            ctx.save();
            ctx.fillStyle = '#080d1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.drawStars();
            this.sideScroller.draw(ctx, now);
            ctx.restore();
            return;
        }
        ctx.save();
        // Screen shake
        if (this.shakeTimer > 0) {
            const mag = this.shakeTimer / 0.4 * this.shakeIntensity;
            ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
        }
        // Background + environment
        this.drawEnvironment(ctx, now);
        if (this.phase === "idle") {
            this.drawIdlePlanet(ctx, now);
        }
        if (this.phase === "playing" || this.phase === "paused") {
            // Draw entities in z-order
            this.powerUps.forEach((p)=>p.draw(ctx));
            this.enemies.forEach((e)=>e.draw(ctx, now));
            if (this.boss) this.boss.draw(ctx, now);
            // Bonus-only: draw environmental obstacles in front of enemies
            if (this.bonusRound && this.chaosObstacles) {
                this.chaosObstacles.draw(ctx, now);
            }
            // Level-specific obstacles (Levels 1–5, not during boss or bonus)
            if (!this.bonusRound && !this.bossPhase && this.levelObstacles) {
                this.levelObstacles.draw(ctx, now);
            }
            Projectile.drawBatch(ctx, this.projectiles);
            // Draw enemy bullets (purple orbs)
            for (const b of this.enemyBullets){
                if (!b.active) continue;
                ctx.save();
                ctx.fillStyle = "#FF44FF";
                ctx.shadowColor = "#CC44FF";
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            this.particles.draw(ctx);
            // God mode: pulsing golden aura behind Owlbert
            if (this.godMode) {
                const { x, y, width: PW, height: PH } = this.player;
                const pulse = 0.7 + Math.sin(now * 0.005) * 0.3;
                const aura = ctx.createRadialGradient(x, y, PW * 0.2, x, y, PW * 0.85);
                aura.addColorStop(0, "rgba(255, 220, 50, ".concat(0.45 * pulse, ")"));
                aura.addColorStop(0.6, "rgba(255, 150, 0, ".concat(0.25 * pulse, ")"));
                aura.addColorStop(1, "rgba(255, 100, 0, 0)");
                ctx.fillStyle = aura;
                ctx.beginPath();
                ctx.ellipse(x, y, PW * 0.85, PH * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.bonusRound) {
                this.player.drawWalking(ctx, now);
            } else {
                this.player.draw(ctx, now);
            }
            this.drawAbilities(ctx, now);
            // Aim reticle at mouse cursor (subtle crosshair)
            if (!this.bonusRound) {
                const rx = this.mouseX, ry = this.mouseY;
                const pulse = 0.6 + Math.sin(now * 0.008) * 0.4;
                ctx.save();
                ctx.strokeStyle = `rgba(100, 220, 255, ${0.7 * pulse})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#00AAFF';
                ctx.shadowBlur = 6;
                // Outer ring
                ctx.beginPath(); ctx.arc(rx, ry, 10, 0, Math.PI * 2); ctx.stroke();
                // Cross hairs (4 short lines, gap in center)
                const gap = 5, len = 7;
                ctx.beginPath();
                ctx.moveTo(rx - gap - len, ry); ctx.lineTo(rx - gap, ry);
                ctx.moveTo(rx + gap, ry);       ctx.lineTo(rx + gap + len, ry);
                ctx.moveTo(rx, ry - gap - len); ctx.lineTo(rx, ry - gap);
                ctx.moveTo(rx, ry + gap);       ctx.lineTo(rx, ry + gap + len);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
            // Score popups
            for (const sp of this.scorePopups){
                ctx.save();
                ctx.globalAlpha = Math.max(0, sp.life);
                ctx.fillStyle = sp.color;
                ctx.font = "bold ".concat(Math.floor(13 + (1 - sp.life) * 5), "px monospace");
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(sp.text, sp.x, sp.y);
                ctx.restore();
            }
            // Pause dim overlay
            if (this.phase === "paused") {
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
            }
        }
        ctx.restore();
        // Wave/level banner
        if (this.bannerTimer > 0 && this.phase === "playing") {
            const delayRef = this.envId === "inferno" || this.envId === "chaos" ? DIFFICULTY.LEVEL_CLEAR_DELAY : DIFFICULTY.WAVE_CLEAR_DELAY;
            const alpha = Math.min(1, this.bannerTimer * 3) * Math.min(1, this.bannerTimer / delayRef * 4);
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const cx = canvas.width / 2;
            const cy = canvas.height / 2 - 20;
            if (this.envId === "chaos") {
                // Rainbow cycling banner for bonus round
                const bHue = now * 0.12 % 360;
                ctx.font = "bold 54px monospace";
                ctx.shadowColor = "hsl(".concat(bHue, ",100%,70%)");
                ctx.shadowBlur = 32;
                ctx.fillStyle = "hsl(".concat(bHue, ",100%,72%)");
                ctx.fillText(this.bannerText, cx, cy);
                ctx.shadowBlur = 0;
                ctx.font = "bold 22px monospace";
                ctx.fillStyle = "hsl(".concat((bHue + 120) % 360, ",100%,75%)");
                ctx.fillText(this.bannerSubtext, cx, cy + 50);
            } else {
                ctx.font = "bold 52px monospace";
                ctx.shadowColor = "#00FFFF";
                ctx.shadowBlur = 24;
                ctx.fillStyle = "#00FFFF";
                ctx.fillText(this.bannerText, cx, cy);
                ctx.shadowBlur = 0;
                ctx.font = "bold 20px monospace";
                ctx.fillStyle = "#AADDFF";
                ctx.fillText(this.bannerSubtext, cx, cy + 44);
            }
            ctx.restore();
        }
        // Flash effect (drawn AFTER restore so it doesn't shake)
        if (this.flashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = this.flashTimer;
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    }
    // ─── Stars ──────────────────────────────────────────────────────────────────
    initStars() {
        const w = this.canvas.width || 800;
        const h = this.canvas.height || 600;
        this.stars = Array.from({
            length: BG.STAR_COUNT
        }, ()=>({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.5 + Math.random() * 1.8,
                speed: BG.STAR_SPEED_MIN + Math.random() * (BG.STAR_SPEED_MAX - BG.STAR_SPEED_MIN),
                alpha: 0.18 + Math.random() * 0.82
            }));
    }
    updateStars(dt) {
        const h = this.canvas.height;
        for (const s of this.stars){
            s.y += s.speed * dt;
            if (s.y > h + 2) {
                s.y = -2;
                s.x = Math.random() * this.canvas.width;
            }
        }
    }
    drawStars() {
        const { ctx } = this;
        for (const s of this.stars){
            ctx.save();
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    // ─── Public API ─────────────────────────────────────────────────────────────
    startGame(now: number, godMode: boolean = false, startLevel: number = 1) {
        this.godMode = godMode;
        this.bonusRound = false;
        this.bossPhase = false;
        this.boss = null;
        this.chaosObstacles = null;
        this.levelObstacles = null;
        this.sideScroller = null;
        this.gunOrder = [];
        this.activeGuns = godMode
            ? { plasma: false, spread: false, side: false, rear: false }
            : { ...DEFAULT_GUNS };
        this.resetAbilities();
        this.score = 0;
        this.level = startLevel;
        this.combo = 0;
        this.multiplier = 1;
        this.powerUpTimer = 20;
        this.enemies = [];
        this.projectiles = [];
        this.powerUps = [];
        this.scorePopups = [];
        // Wave init
        this.waveIndex = 0;
        this.waveQueue = [];
        this.waveState = "transitioning";
        this.waveTransitionTimer = 1.2;
        this.bannerText = "WAVE 1";
        this.bannerSubtext = "of ".concat(LEVEL_WAVES[startLevel - 1].length);
        this.bannerTimer = 1.2;
        // Environment
        this.envId = (0,getEnvironment)(startLevel);
        this.initEnvParticles();
        // Level obstacles (main levels only)
        this.levelObstacles = new LevelObstacleManager(startLevel);
        this.levelObstacles.reset(this.canvas.width, this.canvas.height);
        // Reset upgrades for new game
        this.bulletWidthMult = 1;
        this.bulletDamageBonus = 0;
        this.bulletFireRateMult = 1;
        this.waveUpgradeIndex = 0;
        // God mode starts with just the basic gun and earns upgrades through waves like normal
        this.initNormalGuns(godMode ? 1 : startLevel);
        this.player = new Player(this.canvas.width, this.canvas.height);
        this.player.skinSrc = this.skinSrc;
        this.player.activeWeapons = new Set(this.normalGunSet);
        this.phase = "playing";
        this.callbacks.onPhaseChange("playing");
        this.callbacks.onScoreChange(0);
        this.callbacks.onLivesChange(PLAYER.LIVES);
        this.callbacks.onLevelChange(startLevel);
        this.callbacks.onMultiplierChange(1);
        this.callbacks.onPowerUpChange(null, 0);
        this.sound.init();
        this.sound.playTrack("gameplay");
    }
    pauseGame() {
        this.sound.stopMusic();
        this.phase = "paused";
        this.callbacks.onPhaseChange("paused");
    }
    resumeGame(now) {
        this.lastTime = now;
        this.phase = "playing";
        this.callbacks.onPhaseChange("playing");
        this.sound.playTrack(this.bossPhase ? "boss" : "gameplay");
    }
    endGame() {
        this.phase = "gameover";
        this.callbacks.onPhaseChange("gameover");
    }
    setActiveGuns(guns) {
        var _this_callbacks_onGunsChange, _this_callbacks;
        // Enforce max 2 active guns
        const keys = Object.keys(guns);
        const nowOn = keys.filter((k)=>guns[k]);
        if (nowOn.length > 2) {
            // Find which gun was just toggled on (not in previous activeGuns)
            const newOn = nowOn.find((k)=>!this.activeGuns[k]);
            if (newOn) {
                // Turn off the oldest that's on (not the new one)
                const toOff = this.gunOrder.find((k)=>guns[k] && k !== newOn);
                if (toOff) guns = {
                    ...guns,
                    [toOff]: false
                };
                // Update order
                this.gunOrder = this.gunOrder.filter((k)=>k !== newOn);
                this.gunOrder.push(newOn);
                this.gunOrder = this.gunOrder.filter((k)=>guns[k]);
            }
        } else {
            // Track order of activation
            const newOn = keys.filter((k)=>guns[k] && !this.activeGuns[k]);
            for (const k of newOn){
                this.gunOrder = this.gunOrder.filter((x)=>x !== k);
                this.gunOrder.push(k);
            }
            this.gunOrder = this.gunOrder.filter((k)=>guns[k]);
        }
        this.activeGuns = {
            ...guns
        };
        (_this_callbacks_onGunsChange = (_this_callbacks = this.callbacks).onGunsChange) === null || _this_callbacks_onGunsChange === void 0 ? void 0 : _this_callbacks_onGunsChange.call(_this_callbacks, {
            ...this.activeGuns
        });
    }
    resize(width, height) {
        if (this.player) {
            this.player.x = Math.min(this.player.x, width - this.player.width / 2);
            this.player.y = height - PLAYER.START_Y_OFFSET;
        }
        this.initStars();
        this.initEnvParticles();
    }
    startBonusGame(now: number, godMode: boolean = false) {
        var _this_callbacks_onBonusRound, _this_callbacks;
        this.godMode = godMode;
        this.bonusRound = true;
        this.bossPhase = false;
        this.boss = null;
        this.gunOrder = [];
        this.activeGuns = godMode
            ? { plasma: false, spread: false, side: false, rear: false }
            : { ...DEFAULT_GUNS };
        this.resetAbilities();
        this.score = 0;
        this.level = 5;
        this.combo = 0;
        this.multiplier = 1;
        this.powerUpTimer = 20;
        this.enemies = [];
        this.projectiles = [];
        this.powerUps = [];
        this.scorePopups = [];
        this.waveIndex = 0;
        this.waveQueue = [];
        this.waveState = "transitioning";
        this.waveTransitionTimer = 1.5;
        this.bannerText = "⭐ BONUS ROUND ⭐";
        this.bannerSubtext = "CHAOS BUILD";
        this.bannerTimer = DIFFICULTY.LEVEL_CLEAR_DELAY;
        this.envId = "chaos";
        this.levelObstacles = null;
        this.sideScroller = null;
        this.chaosObstacles = new ChaosObstacleManager();
        this.chaosObstacles.reset(this.canvas.width, this.canvas.height);
        this.initEnvParticles();
        this.player = new Player(this.canvas.width, this.canvas.height);
        this.player.skinSrc = this.skinSrc;
        this.phase = "playing";
        this.callbacks.onPhaseChange("playing");
        this.callbacks.onScoreChange(0);
        this.callbacks.onLivesChange(PLAYER.LIVES);
        this.callbacks.onLevelChange(5);
        this.callbacks.onMultiplierChange(1);
        this.bulletWidthMult = 1;
        this.bulletDamageBonus = 0;
        this.bulletFireRateMult = 1;
        this.waveUpgradeIndex = 0;
        this.initNormalGuns(5);
        this.callbacks.onPowerUpChange(null, 0);
        (_this_callbacks_onBonusRound = (_this_callbacks = this.callbacks).onBonusRound) === null || _this_callbacks_onBonusRound === void 0 ? void 0 : _this_callbacks_onBonusRound.call(_this_callbacks);
        this.sound.init();
        this.sound.playTrack("gameplay");
    }
    startBossGame(now: number, godMode: boolean = false) {
        this.godMode = godMode;
        this.bonusRound = false;
        this.bossPhase = true;
        this.boss = new BossEnemy(this.canvas.width);
        this.bossDeathTimer = 0;
        this.bossDeathExplosionTimer = 0;
        this.gunOrder = [];
        this.activeGuns = godMode
            ? { plasma: false, spread: false, side: false, rear: false }
            : { ...DEFAULT_GUNS };
        this.resetAbilities();
        this.score = 0;
        this.level = 5;
        this.combo = 0;
        this.multiplier = 1;
        this.powerUpTimer = 999;
        this.enemies = [];
        this.projectiles = [];
        this.powerUps = [];
        this.scorePopups = [];
        this.levelObstacles = null;
        this.sideScroller = null;
        this.envId = "inferno";
        this.initEnvParticles();
        this.player = new Player(this.canvas.width, this.canvas.height);
        this.player.skinSrc = this.skinSrc;
        this.phase = "playing";
        this.callbacks.onPhaseChange("playing");
        this.callbacks.onScoreChange(0);
        this.callbacks.onLivesChange(PLAYER.LIVES);
        this.callbacks.onLevelChange(5);
        this.callbacks.onMultiplierChange(1);
        this.callbacks.onPowerUpChange(null, 0);
        this.bulletWidthMult = 1;
        this.bulletDamageBonus = 0;
        this.bulletFireRateMult = 1;
        this.waveUpgradeIndex = 0;
        this.initNormalGuns(5);
        this.bannerText = "⚠ FINAL BOSS ⚠";
        this.bannerSubtext = "GREG — THE LAST BUG";
        this.bannerTimer = 3.5;
        this.flashTimer = 0.6;
        this.flashColor = "rgba(255,40,40,0.35)";
        this.shakeTimer = 0.4;
        this.shakeIntensity = 8;
        this.sound.init();
        this.sound.playTrack("boss");
        this.sound.playBossEnter();
    }
    startSideScroller() {
        this.bonusRound = false;
        this.bossPhase = false;
        this.chaosObstacles = null;
        this.enemies = [];
        this.projectiles = [];
        this.powerUps = [];
        this.phase = "sidescroller";
        this.callbacks.onPhaseChange("sidescroller");
        if (this.sideScroller) {
            this.sideScroller.destroy();
        }
        this.sideScroller = new SideScrollerEngine(
            this.canvas,
            () => {
                // Stage complete → true victory
                this.sideScroller = null;
                this.sound.playVictory();
                this.phase = "victory";
                this.callbacks.onPhaseChange("victory");
            },
            (pts) => {
                this.score += pts;
                this.callbacks.onScoreChange(this.score);
            },
            this.skinSrc,
            this.godMode
        );
    }
    exitToMenu() {
        this.bossPhase = false;
        this.boss = null;
        this.bonusRound = false;
        if (this.sideScroller) { this.sideScroller.destroy(); this.sideScroller = null; }
        this.phase = "idle";
        this.callbacks.onPhaseChange("idle");
        this.sound.playTrack("menu");
    }
    getSoundManager() {
        return this.sound;
    }
    setSkin(src) {
        this.skinSrc = src;
        (0,_entities_Player__WEBPACK_IMPORTED_MODULE_3__.preloadSkin)(src);
        // Apply immediately if a game is already running
        if (this.player) this.player.skinSrc = src;
    }
    /** Preview a level's environment on the title screen without starting a game */ previewLevel(level) {
        if (this.phase !== "idle") return;
        if (level === 6) {
            this.envId = "chaos";
        } else if (level === 7) {
            this.envId = "inferno";
        } else {
            this.envId = (0,getEnvironment)(level);
        }
        this.level = level;
        this.initEnvParticles();
    }
    destroy() {
        cancelAnimationFrame(this.rafId);
        this.input.destroy();
        this.sound.destroy();
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        window.removeEventListener("mouseup", this.onMouseUp);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        if (this.onFirstGesture) {
            window.removeEventListener("keydown", this.onFirstGesture);
            window.removeEventListener("mousedown", this.onFirstGesture);
            this.onFirstGesture = null;
        }
    }
    // ─── Special Abilities ───────────────────────────────────────────────────────

    resetAbilities() {
        this.abilityAiAssist = { active: false, timer: 0, fireTimer: 0 };
        this.abilityFirewall = { active: false, timer: 0, sweepX: 0, hitEnemies: new Set() };
        this.abilityShield   = { active: false, timer: 0, absorbLeft: 0 };
        this.abilityDebug    = { active: false, timer: 0 };
    }

    activateAbility(key) {
        switch (key) {
            case 'aiAssist':
                this.abilityAiAssist.active = true;
                this.abilityAiAssist.timer = 8;
                this.abilityAiAssist.fireTimer = 0;
                break;
            case 'firewallSweep':
                this.abilityFirewall.active = true;
                this.abilityFirewall.timer = 1.8;
                this.abilityFirewall.sweepX = -30;
                this.abilityFirewall.hitEnemies = new Set();
                break;
            case 'accessControl':
                this.abilityShield.active = true;
                this.abilityShield.timer = 5;
                this.abilityShield.absorbLeft = 10;
                break;
            case 'debugMode':
                this.abilityDebug.active = true;
                this.abilityDebug.timer = 5;
                break;
        }
        this.sound.playPowerUp();
        this.flashTimer = 0.12;
        this.flashColor = 'rgba(100,200,255,0.15)';
    }

    updateAbilities(dt, now) {
        // ── AI Assist ────────────────────────────────────────────────────────────
        if (this.abilityAiAssist.active) {
            this.abilityAiAssist.timer -= dt;
            if (this.abilityAiAssist.timer <= 0) {
                this.abilityAiAssist.active = false;
            } else {
                this.abilityAiAssist.fireTimer -= dt;
                if (this.abilityAiAssist.fireTimer <= 0) {
                    this.abilityAiAssist.fireTimer = 0.18;
                    const ax = this.player.x + 58;
                    const ay = this.player.y - 8;
                    // Aim at nearest enemy or boss, else straight up
                    let angle = -Math.PI / 2;
                    let nearDist = Infinity;
                    for (const e of this.enemies) {
                        if (!e.active) continue;
                        const d = (e.x - ax) * (e.x - ax) + (e.y - ay) * (e.y - ay);
                        if (d < nearDist) { nearDist = d; angle = Math.atan2(e.y - ay, e.x - ax); }
                    }
                    if (this.boss && nearDist === Infinity) {
                        angle = Math.atan2(this.boss.y - ay, this.boss.x - ax);
                    }
                    if (this.projectiles.length < MAX_PROJECTILES) {
                        this.projectiles.push(new Projectile(ax, ay, angle, 660, 1, 'normal'));
                    }
                }
            }
        }

        // ── Firewall Sweep ───────────────────────────────────────────────────────
        if (this.abilityFirewall.active) {
            this.abilityFirewall.timer -= dt;
            if (this.abilityFirewall.timer <= 0) {
                this.abilityFirewall.active = false;
            } else {
                const sweepSpeed = (this.canvas.width + 60) / 1.8;
                this.abilityFirewall.sweepX += sweepSpeed * dt;
                const bw = 30;
                for (const e of this.enemies) {
                    if (!e.active) continue;
                    if (this.abilityFirewall.hitEnemies.has(e)) continue;
                    if (Math.abs(e.x - this.abilityFirewall.sweepX) < bw + e.width / 2) {
                        this.abilityFirewall.hitEnemies.add(e);
                        const died = e.takeDamage(15);
                        if (died) {
                            this.onEnemyKilled(e, now);
                        } else {
                            this.particles.emitSparks(e.x, e.y, '#FF8800');
                            this.sound.playEnemyHit();
                        }
                    }
                }
                if (this.boss) {
                    const key = this.boss;
                    if (!this.abilityFirewall.hitEnemies.has(key) &&
                        Math.abs(this.boss.x - this.abilityFirewall.sweepX) < bw + this.boss.width / 2) {
                        this.abilityFirewall.hitEnemies.add(key);
                        this.boss.takeDamage(20);
                        this.particles.emitSparks(this.boss.x, this.boss.y, '#FF8800');
                        this.sound.playBossHit();
                    }
                }
            }
        }

        // ── Access Control Shield ────────────────────────────────────────────────
        if (this.abilityShield.active) {
            this.abilityShield.timer -= dt;
            if (this.abilityShield.timer <= 0 || this.abilityShield.absorbLeft <= 0) {
                this.abilityShield.active = false;
            }
        }

        // ── Debug Mode ───────────────────────────────────────────────────────────
        if (this.abilityDebug.active) {
            this.abilityDebug.timer -= dt;
            if (this.abilityDebug.timer <= 0) {
                this.abilityDebug.active = false;
            }
        }
    }

    drawAbilities(ctx, now) {
        // ── AI Assist ship ───────────────────────────────────────────────────────
        if (this.abilityAiAssist.active) {
            const ax = this.player.x + 58;
            const ay = this.player.y - 8;
            const pulse = 0.75 + Math.sin(now * 0.007) * 0.25;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#00FFCC';
            ctx.fillStyle = 'rgba(0, 255, 204, 0.18)';
            ctx.shadowColor = '#00FFCC';
            ctx.shadowBlur = 14;
            ctx.lineWidth = 1.5;
            // Small triangular ship pointing up
            ctx.beginPath();
            ctx.moveTo(ax, ay - 13);
            ctx.lineTo(ax + 9, ay + 9);
            ctx.lineTo(ax, ay + 4);
            ctx.lineTo(ax - 9, ay + 9);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Thruster flame
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(0,255,200,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ax - 4, ay + 6);
            ctx.lineTo(ax, ay + 14 + Math.sin(now * 0.015) * 3);
            ctx.lineTo(ax + 4, ay + 6);
            ctx.stroke();
            // Duration bar
            const barW = 24;
            const frac = this.abilityAiAssist.timer / 8;
            ctx.globalAlpha = 0.7;
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(ax - barW / 2, ay - 22, barW, 3);
            ctx.fillStyle = '#00FFCC';
            ctx.fillRect(ax - barW / 2, ay - 22, barW * Math.max(0, frac), 3);
            ctx.restore();
        }

        // ── Firewall Sweep beam ──────────────────────────────────────────────────
        if (this.abilityFirewall.active) {
            const bx = this.abilityFirewall.sweepX;
            const bw = 30;
            ctx.save();
            const grad = ctx.createLinearGradient(bx - bw * 2, 0, bx + bw * 2, 0);
            grad.addColorStop(0,   'rgba(255, 80,  0, 0)');
            grad.addColorStop(0.35,'rgba(255,140,  0, 0.8)');
            grad.addColorStop(0.5, 'rgba(255,220, 80, 1.0)');
            grad.addColorStop(0.65,'rgba(255,140,  0, 0.8)');
            grad.addColorStop(1,   'rgba(255, 80,  0, 0)');
            ctx.fillStyle = grad;
            ctx.shadowColor = '#FF8800';
            ctx.shadowBlur = 28;
            ctx.fillRect(bx - bw * 2, 0, bw * 4, this.canvas.height);
            ctx.restore();
        }

        // ── Access Control shield bubble ─────────────────────────────────────────
        if (this.abilityShield.active) {
            const { x, y } = this.player;
            const r = 60;
            const pulse = 0.55 + Math.sin(now * 0.009) * 0.45;
            ctx.save();
            // Glow fill
            const sg = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
            sg.addColorStop(0,   'rgba(68,136,255,0)');
            sg.addColorStop(0.65,'rgba(68,136,255,' + (0.10 * pulse) + ')');
            sg.addColorStop(1,   'rgba(100,180,255,' + (0.55 * pulse) + ')');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            // Rim
            ctx.strokeStyle = 'rgba(120,200,255,' + (0.85 * pulse) + ')';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#4488FF';
            ctx.shadowBlur = 18;
            ctx.stroke();
            // Absorb counter
            ctx.globalAlpha = 0.8;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#88CCFF';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(this.abilityShield.absorbLeft), x, y - r - 8);
            ctx.restore();
        }

        // ── Debug Mode overlay ───────────────────────────────────────────────────
        if (this.abilityDebug.active) {
            ctx.save();
            const alpha = 0.06 + Math.sin(now * 0.005) * 0.03;
            ctx.fillStyle = 'rgba(80,120,255,' + alpha + ')';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }
    }

    constructor(canvas, callbacks){
        this.skinSrc = "/owlbert.png";
        this.projectiles = [];
        this.enemies = [];
        this.enemyBullets = [];
        this.powerUps = [];
        this.stars = [];
        this.scorePopups = [];
        // Game state
        this.phase = "idle";
        this.godMode = false;
        this.activeGuns = {
            ...DEFAULT_GUNS
        };
        this.score = 0;
        this.highScore = 0;
        this.level = 1;
        this.combo = 0;
        this.multiplier = 1;
        this.comboTimer = 0;
        // Timing
        this.rafId = 0;
        this.lastTime = 0;
        this.powerUpTimer = 20;
        // Wave state
        this.waveIndex = 0;
        this.waveQueue = [];
        this.waveSpawnTimer = 0;
        this.waveState = "active";
        this.waveTransitionTimer = 0;
        // Environment
        this.envId = "space";
        this.envParticles = [];
        this.envGeometry = {
            nodes: []
        };
        // Bonus round
        this.bonusRound = false;
        this.chaosObstacles = null;
        this.levelObstacles = null;
        this.sideScroller = null;
        // Boss
        this.boss = null;
        this.bossPhase = false;
        this.bossDeathTimer = 0;
        this.bossDeathExplosionTimer = 0;
        // Gun activation order (for cap enforcement)
        this.gunOrder = [];
        // Progressive upgrade system (normal mode)
        this.normalGunSet = new Set([
            "normal"
        ]);
        this.bulletWidthMult = 1;
        this.bulletDamageBonus = 0;
        this.bulletFireRateMult = 1 // < 1 = faster
        ;
        this.waveUpgradeIndex = 0 // cycles through upgrade types
        ;
        // Banner
        this.bannerText = "";
        this.bannerSubtext = "";
        this.bannerTimer = 0;
        // Mouse shooting + aim tracking
        this.mouseHeld = false;
        this.mouseX = canvas.width / 2;  // default → aim straight up
        this.mouseY = 0;
        this.onMouseDown = (e)=>{
            if (e.button === 0) this.mouseHeld = true;
        };
        this.onMouseUp = (e)=>{
            if (e.button === 0) this.mouseHeld = false;
        };
        this.onMouseMove = (e)=>{
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width  / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            this.mouseY = (e.clientY - rect.top)  * scaleY;
        };
        this.onFirstGesture = null;
        // Track last reported power-up so we can notify React when it expires
        this.lastReportedPowerUp = null;
        // Effects
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.flashTimer = 0;
        this.flashColor = "rgba(255, 40, 40, 0.35)";
        // ─── Special abilities ───────────────────────────────────────────────────────
        this.abilityAiAssist = { active: false, timer: 0, fireTimer: 0 };
        this.abilityFirewall = { active: false, timer: 0, sweepX: 0, hitEnemies: new Set() };
        this.abilityShield   = { active: false, timer: 0, absorbLeft: 0 };
        this.abilityDebug    = { active: false, timer: 0 };
        // ─── Game loop ──────────────────────────────────────────────────────────────
        this.loop = (ts)=>{
            const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
            this.lastTime = ts;
            this.updateStars(dt);
            if (this.phase === "playing") {
                this.updateGame(dt, ts);
            } else if (this.phase === "sidescroller" && this.sideScroller) {
                this.sideScroller.update(dt, ts);
            }
            this.handleGlobalInput(ts);
            this.render(ts);
            this.input.flush();
            this.rafId = requestAnimationFrame(this.loop);
        };
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.callbacks = callbacks;
        this.input = new InputManager();
        this.particles = new ParticleSystem();
        this.sound = new SoundManager();
        this.sound.preload(); // start buffering music files immediately
        // Start music on first user gesture — stored on `this` so destroy() can clean it up
        this.onFirstGesture = ()=>{
            this.sound.init();
            this.sound.playTrack("menu");
            window.removeEventListener("keydown", this.onFirstGesture);
            window.removeEventListener("mousedown", this.onFirstGesture);
            this.onFirstGesture = null;
        };
        window.addEventListener("keydown", this.onFirstGesture);
        window.addEventListener("mousedown", this.onFirstGesture);
        try {
            const saved = localStorage.getItem("docsDefenderHighScore");
            this.highScore = saved ? parseInt(saved, 10) : 0;
            callbacks.onHighScoreChange(this.highScore);
        } catch (e) {}
        this.initStars();
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
        canvas.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mouseup", this.onMouseUp);
        canvas.addEventListener("mousemove", this.onMouseMove);
    }
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "".concat(r, ", ").concat(g, ", ").concat(b);
}


;
    // Wrapped in an IIFE to avoid polluting the global scope
    ;
    (function () {
        var _a, _b;
        // Legacy CSS implementations will `eval` browser code in a Node.js context
        // to extract CSS. For backwards compatibility, we need to check we're in a
        // browser context before continuing.
        if (typeof self !== 'undefined' &&
            // AMP / No-JS mode does not inject these helpers:
            '$RefreshHelpers$' in self) {
            // @ts-ignore __webpack_module__ is global
            var currentExports = module.exports;
            // @ts-ignore __webpack_module__ is global
            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;
            // This cannot happen in MainTemplate because the exports mismatch between
            // templating and execution.
            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);
            // A module can be accepted automatically based on its exports, e.g. when
            // it is a Refresh Boundary.
            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {
                // Save the previous exports signature on update so we can compare the boundary
                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)
                module.hot.dispose(function (data) {
                    data.prevSignature =
                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);
                });
                // Unconditionally accept an update to this module, we'll check if it's
                // still a Refresh Boundary later.
                // @ts-ignore importMeta is replaced in the loader
                module.hot.accept();
                // This field is set when the previous version of this module was a
                // Refresh Boundary, letting us know we need to check for invalidation or
                // enqueue an update.
                if (prevSignature !== null) {
                    // A boundary can become ineligible if its exports are incompatible
                    // with the previous exports.
                    //
                    // For example, if you add/remove/change exports, we'll want to
                    // re-execute the importing modules, and force those components to
                    // re-render. Similarly, if you convert a class component to a
                    // function, we want to invalidate the boundary.
                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {
                        module.hot.invalidate();
                    }
                    else {
                        self.$RefreshHelpers$.scheduleUpdate();
                    }
                }
            }
            else {
                // Since we just executed the code for the module, it's possible that the
                // new exports made it ineligible for being a boundary.
                // We only care about the case when we were _previously_ a boundary,
                // because we already accepted this update (accidental side effect).
                var isNoLongerABoundary = prevSignature !== null;
                if (isNoLongerABoundary) {
                    module.hot.invalidate();
                }
            }
        }
    })();
