/* ==========================================================================
   CONFIGURATION
   Edit these values freely — nothing else in this file needs to change.
   ========================================================================== */
const CONFIG = {
  girlfriendName: "Layba",
  yourName: "Hammad",
  finalMessage:
    "I know this was a little silly, but I wanted to ask you in a way you'd " +
    "actually smile at. Thank you for saying yes to me — today, and every " +
    "day after this one. I love you.",
  accentColor: "#e8a1b0",
  // Set to a same-folder audio file path (e.g. "celebrate.mp3") to enable a
  // celebration sound. Leave as null to skip audio entirely.
  celebrationSoundUrl: null,
};

// Apply the accent color as a CSS variable so the whole design follows it.
document.documentElement.style.setProperty("--accent", CONFIG.accentColor);

/* ==========================================================================
   SMALL UTILITIES
   ========================================================================== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const rand = (min, max) => min + Math.random() * (max - min);
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) { /* no-op */ }
  }
}

function announce(text) {
  const el = document.getElementById("sr-live");
  if (el) el.textContent = text;
}

/* ==========================================================================
   PERSONALIZATION — fill in name slots / signature line
   ========================================================================== */
document.getElementById("name-slot-intro").textContent = CONFIG.girlfriendName
  ? `, ${CONFIG.girlfriendName},`
  : "";
document.getElementById("signed-by").textContent = CONFIG.yourName
  ? `— ${CONFIG.yourName}`
  : "";
document.getElementById("final-message").textContent = CONFIG.finalMessage;

/* ==========================================================================
   STATE / SCREEN MANAGEMENT
   ========================================================================== */
const SCREEN_ORDER = ["intro", "final", "celebrate"];
const screens = {};
SCREEN_ORDER.forEach((name) => {
  screens[name] = document.getElementById(`screen-${name}`);
});

function goToScreen(name) {
  SCREEN_ORDER.forEach((s) => screens[s].classList.toggle("active", s === name));
  announce(`Screen: ${name}`);
}

/* ==========================================================================
   BACKGROUND STARFIELD (ambient canvas, independent of interaction canvas)
   ========================================================================== */
const starsCanvas = document.getElementById("stars-canvas");
const starsCtx = starsCanvas.getContext("2d");
let stars = [];

function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildStars() {
  const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
  stars = Array.from({ length: count }, () => ({
    x: rand(0, window.innerWidth),
    y: rand(0, window.innerHeight),
    r: rand(0.4, 1.6),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.4, 1.2),
  }));
}

function drawStars(t) {
  starsCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  starsCtx.fillStyle = "#ffffff";
  for (const s of stars) {
    const twinkle = prefersReducedMotion
      ? 0.6
      : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 * s.speed + s.phase));
    starsCtx.globalAlpha = twinkle;
    starsCtx.beginPath();
    starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    starsCtx.fill();
  }
  starsCtx.globalAlpha = 1;
}

/* ==========================================================================
   FX CANVAS — pointer trail ("fireflies"), confetti, fireworks
   All effect particles share one canvas + one animation loop for performance.
   ========================================================================== */
const fxCanvas = document.getElementById("fx-canvas");
const fxCtx = fxCanvas.getContext("2d");

let fireflies = [];   // ambient trail particles that follow the pointer
let confettiBits = []; // celebration confetti
let fireworkParticles = []; // celebration firework sparks
let glassShards = []; // NO button shatter fragments

function spawnFirefly(x, y) {
  if (prefersReducedMotion) return;
  fireflies.push({
    x, y,
    vx: rand(-0.3, 0.3),
    vy: rand(-0.6, -0.1),
    r: rand(1, 2.6),
    life: 1,
    decay: rand(0.012, 0.022),
    hue: rand(-10, 10),
  });
  // Keep the list bounded for performance.
  if (fireflies.length > 120) fireflies.splice(0, fireflies.length - 120);
}

// Small quick burst used for wall-impact feedback while a button is bouncing.
function spawnImpactSparks(x, y, count = 4) {
  if (prefersReducedMotion) return;
  for (let i = 0; i < count; i++) {
    spawnFirefly(x + rand(-6, 6), y + rand(-6, 6));
  }
}

function spawnConfettiBurst(cx, cy, count = 90) {
  const colors = [CONFIG.accentColor, "#ffd9e0", "#ffffff", "#c9a7ff"];
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(2, 8);
    confettiBits.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: rand(4, 8),
      color: colors[Math.floor(rand(0, colors.length))],
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2),
      life: 1,
      decay: rand(0.006, 0.012),
      gravity: 0.12,
    });
  }
}

// Glass-break fragments — flies outward from the NO button's last position,
// inherits its approximate size/glassy tint, falls under gravity, fades out.
function spawnGlassShatter(cx, cy, w, h) {
  const count = prefersReducedMotion ? 10 : 24;
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(3, 11);
    glassShards.push({
      x: cx + rand(-w / 2, w / 2),
      y: cy + rand(-h / 2, h / 2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(1, 4), // slight upward pop, then gravity takes over
      size: rand(4, 11),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.35, 0.35),
      life: 1,
      decay: rand(0.01, 0.018),
      gravity: 0.28,
    });
  }
}

function spawnFirework(cx, cy) {
  const count = 46;
  const hue = rand(0, 1) > 0.5 ? CONFIG.accentColor : "#ffe3ea";
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.05, 0.05);
    const speed = rand(2.5, 6.5);
    fireworkParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: hue,
      life: 1,
      decay: rand(0.014, 0.02),
      gravity: 0.05,
    });
  }
}

function fireworksShow() {
  if (prefersReducedMotion) {
    // Single gentle burst instead of a full show.
    spawnFirework(window.innerWidth / 2, window.innerHeight * 0.35);
    return;
  }
  const spots = [
    [0.3, 0.3], [0.7, 0.25], [0.5, 0.4], [0.22, 0.5], [0.78, 0.45],
  ];
  spots.forEach(([fx, fy], i) => {
    setTimeout(() => {
      spawnFirework(window.innerWidth * fx, window.innerHeight * fy);
    }, i * 380);
  });
}

function updateAndDrawFx() {
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Fireflies
  for (let i = fireflies.length - 1; i >= 0; i--) {
    const p = fireflies[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) { fireflies.splice(i, 1); continue; }
    fxCtx.globalAlpha = clamp(p.life, 0, 1) * 0.9;
    fxCtx.fillStyle = CONFIG.accentColor;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    fxCtx.shadowBlur = 8;
    fxCtx.shadowColor = CONFIG.accentColor;
    fxCtx.fill();
    fxCtx.shadowBlur = 0;
  }

  // Confetti
  for (let i = confettiBits.length - 1; i >= 0; i--) {
    const c = confettiBits[i];
    c.vy += c.gravity;
    c.x += c.vx;
    c.y += c.vy;
    c.rot += c.vr;
    c.life -= c.decay;
    if (c.life <= 0 || c.y > window.innerHeight + 40) { confettiBits.splice(i, 1); continue; }
    fxCtx.save();
    fxCtx.globalAlpha = clamp(c.life, 0, 1);
    fxCtx.translate(c.x, c.y);
    fxCtx.rotate(c.rot);
    fxCtx.fillStyle = c.color;
    fxCtx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
    fxCtx.restore();
  }

  // Fireworks
  for (let i = fireworkParticles.length - 1; i >= 0; i--) {
    const f = fireworkParticles[i];
    f.vy += f.gravity;
    f.x += f.vx;
    f.y += f.vy;
    f.life -= f.decay;
    if (f.life <= 0) { fireworkParticles.splice(i, 1); continue; }
    fxCtx.globalAlpha = clamp(f.life, 0, 1);
    fxCtx.fillStyle = f.color;
    fxCtx.beginPath();
    fxCtx.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
    fxCtx.shadowBlur = 10;
    fxCtx.shadowColor = f.color;
    fxCtx.fill();
    fxCtx.shadowBlur = 0;
  }

  // Glass shards (NO button shatter)
  for (let i = glassShards.length - 1; i >= 0; i--) {
    const g = glassShards[i];
    g.vy += g.gravity;
    g.x += g.vx;
    g.y += g.vy;
    g.rot += g.vr;
    g.life -= g.decay;
    if (g.life <= 0) { glassShards.splice(i, 1); continue; }
    fxCtx.save();
    fxCtx.globalAlpha = clamp(g.life, 0, 1) * 0.85;
    fxCtx.translate(g.x, g.y);
    fxCtx.rotate(g.rot);
    // Glassy translucent shard with a soft light-catch edge.
    fxCtx.fillStyle = "rgba(255,255,255,0.35)";
    fxCtx.strokeStyle = CONFIG.accentColor;
    fxCtx.lineWidth = 0.6;
    fxCtx.beginPath();
    fxCtx.moveTo(-g.size / 2, -g.size / 3);
    fxCtx.lineTo(g.size / 2, -g.size / 4);
    fxCtx.lineTo(g.size / 3, g.size / 2);
    fxCtx.lineTo(-g.size / 3, g.size / 3);
    fxCtx.closePath();
    fxCtx.fill();
    fxCtx.stroke();
    fxCtx.restore();
  }

  fxCtx.globalAlpha = 1;
}

/* ==========================================================================
   MASTER ANIMATION LOOP
   ========================================================================== */
function masterLoop(t) {
  drawStars(t);
  updateAndDrawFx();
  updateNoButton();
  requestAnimationFrame(masterLoop);
}

function handleResize() {
  sizeCanvas(starsCanvas);
  sizeCanvas(fxCanvas);
  buildStars();
}
window.addEventListener("resize", handleResize);
handleResize();
requestAnimationFrame(masterLoop);

/* ==========================================================================
   GENERIC "DRAG THRESHOLD" POINTER TRACKER
   Used by both the intro drag-to-start control and the final YES/NO stage.
   Prevents a simple tap from being mistaken for an intentional drag.
   ========================================================================== */
function createDragTracker({ onMove, onEnd, threshold = 24, captureEl = null }) {
  let active = false;
  let startX = 0, startY = 0;
  let dragDistance = 0;
  let pointerId = null;

  function down(e) {
    active = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dragDistance = 0;
    e.preventDefault();
    // Always capture on the intended drag handle (captureEl), never on
    // whatever inner element the touch happened to land on — capturing on
    // a nested child can silently break retargeted pointermove delivery
    // on some WebKit versions.
    const el = captureEl || e.currentTarget;
    el.setPointerCapture?.(pointerId);
  }

  function move(e) {
    if (!active || e.pointerId !== pointerId) return;
    dragDistance = dist(startX, startY, e.clientX, e.clientY);
    onMove?.(e, dragDistance, dragDistance >= threshold);
    spawnFirefly(e.clientX, e.clientY);
  }

  function up(e) {
    if (!active || e.pointerId !== pointerId) return;
    active = false;
    onEnd?.(e, dragDistance, dragDistance >= threshold);
  }

  return { down, move, up };
}

/* ==========================================================================
   SCREEN 1 — DRAG-TO-START
   ========================================================================== */
(function setupStartDrag() {
  const track = document.getElementById("start-zone").querySelector(".drag-track");
  const puck = document.getElementById("start-puck");
  const hint = document.getElementById("start-hint");

  let trackRect, puckSize, maxX;

  function measure() {
    trackRect = track.getBoundingClientRect();
    puckSize = puck.offsetWidth;
    maxX = trackRect.width - puckSize - 12; // 6px padding each side
  }
  measure();
  window.addEventListener("resize", measure);

  let currentX = 0;
  let completed = false;

  const tracker = createDragTracker({
    captureEl: puck,
    // Position-based: complete once the puck itself has actually been
    // dragged most of the way to the end, rather than relying on raw
    // cumulative pointer displacement (more forgiving of imprecise drags).
    threshold: maxX * 0.78,
    onMove: (e, d, passed) => {
      const localX = clamp(e.clientX - trackRect.left - puckSize / 2, 0, maxX);
      currentX = localX;
      puck.style.transform = `translateX(${localX}px)`;
      hint.style.opacity = localX > 10 ? "0" : "1";
      track.classList.toggle("filled", currentX >= maxX * 0.78);
    },
    onEnd: (e, d, passed) => {
      const madeItAcrossTrack = currentX >= maxX * 0.78;
      if ((passed || madeItAcrossTrack) && !completed) {
        completed = true;
        vibrate(12);
        puck.style.transform = `translateX(${maxX}px)`;
        setTimeout(() => goToScreen("final"), 320);
      } else {
        // Snap back — didn't drag far enough.
        puck.style.transform = "translateX(0px)";
        hint.style.opacity = "1";
        track.classList.remove("filled");
      }
    },
  });

  puck.addEventListener("pointerdown", tracker.down);
  window.addEventListener("pointermove", tracker.move);
  window.addEventListener("pointerup", tracker.up);
  window.addEventListener("pointercancel", tracker.up);

  // Re-measure right before first interaction in case fonts/layout shifted
  // dimensions after the initial script run (e.g. web font swap).
  requestAnimationFrame(measure);
})();

/* ==========================================================================
   SCREEN 2 — FINAL PROPOSAL (the core interaction)

   Architecture: YES and NO both start in a normal flex row (.yn-row), so
   their base position is guaranteed to be fully inside the viewport — no
   hardcoded left/right math that could push either one off-screen.

   Both buttons run on the SAME generic 2D physics engine (one function,
   shared state shape) — the only thing that differs between them is
   configuration and a bit of game state, not duplicated code.

   YES: launches at very high speed on tap, bounces off all four walls,
   and gets progressively slower/easier with each genuine attempt until it
   stops moving entirely and becomes a normal clickable button.

   NO: has three stages. Attempts 1–2 are super-bouncy (attempt 2 more
   chaotic than attempt 1). Attempt 3 triggers a glass-shatter sequence —
   the button cracks, breaks into fragments that fly outward with gravity,
   and is permanently removed. It never becomes selectable.
   ========================================================================== */
const stage = document.getElementById("proposal-stage");
const yesBtn = document.getElementById("btn-yes");
const noBtn = document.getElementById("btn-no");
const feedbackEl = document.getElementById("game-feedback");

// ---- Easy-to-tune game configuration ----
const GAME_CONFIG = {
  yesAttemptsToUnlock: 5,   // genuine taps on YES before it stops fleeing
  yesStartingSpeed: 35,     // launch speed on the very first YES attempt — same as NO's first hit
  yesSpeedReduction: 0.78,  // multiplier applied to speed after each attempt

  noSpeed: 35,              // launch speed on NO's first attempt
  noSpeedGrowth: 1.22,      // how much crazier NO's second attempt gets
  noAttemptsBeforeShatter: 3, // which attempt triggers the glass break

  friction: 0.985,
  restitution: 0.95,
  maxVelocity: 60,
  edgeMargin: 16,
  settleThreshold: 0.4,
  cooldownMs: 380,          // minimum time between successive escapes, per button
};

const YES_ATTEMPT_MESSAGES = ["Too slow…", "Almost…", "You're getting closer…", "Okay, you're persistent…", "So close…"];
const YES_READY_MESSAGE = "Okay… you got me ❤️";
const NO_ELIMINATED_MESSAGE = "Okay… NO has officially been eliminated. ❤️";

let hasProposed = false;
let yesAttempts = 0;
let noAttempts = 0;
let yesCatchable = false;
let noEliminated = false;

/* ---------- Generic ball state shape, one instance per button ---------- */
function createBall(el) {
  return {
    el,
    home: { x: 0, y: 0, w: 0, h: 0 },
    bounds: { minDx: 0, maxDx: 0, minDy: 0, maxDy: 0 },
    offset: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    rot: 0,
    rotVel: 0,
    squash: 1,
    stretch: 1,
    moving: false,
    currentFriction: GAME_CONFIG.friction,
    lastEscapeAt: 0,
  };
}
const yesBall = createBall(yesBtn);
const noBall = createBall(noBtn);

/* ---------- Geometry ----------
   "Home" = a button's natural flex-row position with transform reset to
   none. All motion is a transform offset from that point, clamped every
   frame against the live viewport (using the button's real dimensions),
   so neither button can ever end up off-screen, clipped, or half-hidden. */
function computeBounds(home) {
  const m = GAME_CONFIG.edgeMargin;
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
  const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 0;
  const stageR = stage.getBoundingClientRect();

  const areaTop = Math.max(safeTop + m, stageR.top);
  const areaBottom = window.innerHeight - safeBottom - m;
  const areaLeft = m;
  const areaRight = window.innerWidth - m;

  return {
    minDx: areaLeft - home.x,
    maxDx: areaRight - home.w - home.x,
    minDy: areaTop - home.y,
    maxDy: areaBottom - home.h - home.y,
  };
}

function measureFinalGeometry() {
  [yesBall, noBall].forEach((ball) => {
    if (ball === noBall && noEliminated) return;
    ball.el.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg) scale(1, 1)";
    const r = ball.el.getBoundingClientRect();
    ball.home = { x: r.left, y: r.top, w: r.width, h: r.height };
    ball.bounds = computeBounds(ball.home);
    ball.offset = { x: 0, y: 0 };
    ball.vel = { x: 0, y: 0 };
  });
}

function withinRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/* ---------- Shared launch impulse — instant, high-speed, away from touch ---------- */
function launchBall(ball, touchX, touchY, speed, friction) {
  const now = performance.now();
  if (now - ball.lastEscapeAt < GAME_CONFIG.cooldownMs) return false;
  ball.lastEscapeAt = now;

  const centerX = ball.home.x + ball.home.w / 2 + ball.offset.x;
  const centerY = ball.home.y + ball.home.h / 2 + ball.offset.y;

  let dx = centerX - touchX;
  let dy = centerY - touchY;
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag; dy /= mag;

  // Small random spread so repeated attempts don't fly the exact same way.
  const spread = rand(-0.4, 0.4);
  const cos = Math.cos(spread), sin = Math.sin(spread);
  const rdx = dx * cos - dy * sin;
  const rdy = dx * sin + dy * cos;

  ball.vel.x = rdx * speed;
  ball.vel.y = rdy * speed;
  ball.rotVel = rand(-14, 14);
  ball.moving = true;
  ball.currentFriction = friction;

  ball.stretch = 1.1;
  ball.squash = 0.92;

  flashImpact(ball);
  spawnImpactSparks(touchX, touchY, 5);
  vibrate(14);
  return true;
}

function flashImpact(ball) {
  ball.el.classList.remove("settled");
  ball.el.classList.add("impact");
  clearTimeout(ball._impactTimer);
  ball._impactTimer = setTimeout(() => ball.el.classList.remove("impact"), 180);
}

/* ---------- Shared physics step — real velocity + wall collisions ---------- */
function stepBall(ball) {
  if (!ball.home.w) return;

  if (ball.moving) {
    ball.vel.x = clamp(ball.vel.x, -GAME_CONFIG.maxVelocity, GAME_CONFIG.maxVelocity);
    ball.vel.y = clamp(ball.vel.y, -GAME_CONFIG.maxVelocity, GAME_CONFIG.maxVelocity);

    ball.offset.x += ball.vel.x;
    ball.offset.y += ball.vel.y;

    const b = ball.bounds;
    let bounced = false;
    if (ball.offset.x < b.minDx) {
      ball.offset.x = b.minDx; ball.vel.x *= -GAME_CONFIG.restitution;
      ball.stretch = 1.1; ball.squash = 0.92; bounced = true;
    } else if (ball.offset.x > b.maxDx) {
      ball.offset.x = b.maxDx; ball.vel.x *= -GAME_CONFIG.restitution;
      ball.stretch = 1.1; ball.squash = 0.92; bounced = true;
    }
    if (ball.offset.y < b.minDy) {
      ball.offset.y = b.minDy; ball.vel.y *= -GAME_CONFIG.restitution;
      ball.stretch = 0.92; ball.squash = 1.1; bounced = true;
    } else if (ball.offset.y > b.maxDy) {
      ball.offset.y = b.maxDy; ball.vel.y *= -GAME_CONFIG.restitution;
      ball.stretch = 0.92; ball.squash = 1.1; bounced = true;
    }

    if (bounced) {
      flashImpact(ball);
      const cx = ball.home.x + ball.home.w / 2 + ball.offset.x;
      const cy = ball.home.y + ball.home.h / 2 + ball.offset.y;
      spawnImpactSparks(cx, cy, 4);
      ball.rotVel += rand(-6, 6);
    }

    ball.vel.x *= ball.currentFriction;
    ball.vel.y *= ball.currentFriction;
    ball.rotVel *= 0.985;
    ball.rot += ball.rotVel;

    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    if (speed < GAME_CONFIG.settleThreshold) {
      ball.moving = false;
      ball.vel.x = 0; ball.vel.y = 0;
      ball.el.classList.add("settled");
      setTimeout(() => ball.el.classList.remove("settled"), 400);
    }
  }

  ball.squash = lerp(ball.squash, 1, 0.4);
  ball.stretch = lerp(ball.stretch, 1, 0.4);

  ball.el.style.transform =
    `translate3d(${ball.offset.x}px, ${ball.offset.y}px, 0) rotate(${ball.rot}deg) scale(${ball.stretch}, ${ball.squash})`;
}

// Called every animation frame from masterLoop.
function updateNoButton() {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  if (!noEliminated) stepBall(noBall);
  if (!yesCatchable) stepBall(yesBall);
}

/* ---------- Feedback line ---------- */
let feedbackTimer = null;
function showFeedback(text, persist = false) {
  feedbackEl.textContent = text;
  feedbackEl.classList.add("show");
  if (feedbackTimer) clearTimeout(feedbackTimer);
  if (!persist) {
    feedbackTimer = setTimeout(() => feedbackEl.classList.remove("show"), 1600);
  }
}

/* ==========================================================================
   NO — three stages: bounce, crazier bounce, then shatter forever
   ========================================================================== */
function attemptNo(x, y) {
  if (hasProposed || noEliminated) return;

  const now = performance.now();
  if (now - noBall.lastEscapeAt < GAME_CONFIG.cooldownMs) return;

  noAttempts += 1;

  if (noAttempts >= GAME_CONFIG.noAttemptsBeforeShatter) {
    // Lock out further attempts immediately so a fast second touch during
    // the freeze/crack sequence can't double-trigger anything.
    noEliminated = true;
    crackAndShatterNo();
    return;
  }

  const speed = noAttempts === 1 ? GAME_CONFIG.noSpeed : GAME_CONFIG.noSpeed * GAME_CONFIG.noSpeedGrowth;
  launchBall(noBall, x, y, speed, GAME_CONFIG.friction);
}

/* ---------- Glass-break sequence ---------- */
function crackAndShatterNo() {
  noBall.moving = false;
  noBall.vel = { x: 0, y: 0 };
  vibrate([8, 30, 8, 30, 20]);

  const r = noBtn.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  // Freeze briefly, then a few crack lines fan out from the center in
  // quick succession before the button breaks apart.
  noBtn.classList.add("frozen");

  const crackLayer = document.createElement("div");
  crackLayer.className = "crack-layer";
  crackLayer.style.left = `${cx}px`;
  crackLayer.style.top = `${cy}px`;
  document.body.appendChild(crackLayer);

  const lineCount = prefersReducedMotion ? 0 : 7;
  for (let i = 0; i < lineCount; i++) {
    const line = document.createElement("div");
    line.className = "crack-line";
    line.style.transform = `rotate(${rand(0, 360)}deg)`;
    line.style.animationDelay = `${i * 22}ms`;
    crackLayer.appendChild(line);
  }

  setTimeout(() => {
    // Swap the real button for physics-driven glass fragments in the same
    // spot, so the transition reads as the button itself breaking apart.
    spawnGlassShatter(cx, cy, r.width, r.height);
    noBtn.style.display = "none";
    crackLayer.remove();

    document.getElementById("proposal-stage").querySelector(".yn-row").classList.add("no-eliminated");
    showFeedback(NO_ELIMINATED_MESSAGE, true);
  }, prefersReducedMotion ? 60 : 260);
}

noBtn.addEventListener("pointerdown", (e) => {
  attemptNo(e.clientX, e.clientY);
  e.preventDefault();
});
noBtn.addEventListener("click", (e) => e.preventDefault()); // never selectable

/* ==========================================================================
   YES — extremely fast at first, gets progressively easier, then locks in
   ========================================================================== */
function becomeCatchable() {
  yesCatchable = true;
  yesBall.moving = false;
  yesBall.vel = { x: 0, y: 0 };
  yesBall.offset = { x: 0, y: 0 };
  yesBall.rot = 0;
  yesBtn.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg) scale(1, 1)";
  yesBtn.classList.add("ready");
  showFeedback(YES_READY_MESSAGE, true);
}

function attemptYes(x, y) {
  if (hasProposed || yesCatchable) return; // catchable → let the normal click through

  const now = performance.now();
  if (now - yesBall.lastEscapeAt < GAME_CONFIG.cooldownMs) return;

  yesAttempts += 1;

  if (yesAttempts >= GAME_CONFIG.yesAttemptsToUnlock) {
    // The final "attempt" doesn't escape — it's caught right here.
    becomeCatchable();
    return;
  }

  // Speed decays geometrically with each attempt: 100% → 78% → 61% → 47%…
  const speed = GAME_CONFIG.yesStartingSpeed * Math.pow(GAME_CONFIG.yesSpeedReduction, yesAttempts - 1);
  const progress = (yesAttempts - 1) / Math.max(1, GAME_CONFIG.yesAttemptsToUnlock - 1);
  const friction = lerp(GAME_CONFIG.friction, 0.90, progress);

  const launched = launchBall(yesBall, x, y, speed, friction);
  if (launched) {
    const msg = YES_ATTEMPT_MESSAGES[Math.min(yesAttempts - 1, YES_ATTEMPT_MESSAGES.length - 1)];
    showFeedback(msg);
  }
}

yesBtn.addEventListener("pointerdown", (e) => {
  if (yesCatchable) return; // let the tap register normally
  attemptYes(e.clientX, e.clientY);
  e.preventDefault();
});

// Dragging onto either button counts the same as pressing it directly —
// but only while it's genuinely still in its escaping state.
window.addEventListener("pointermove", (e) => {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  if (e.buttons === 0 && e.pointerType === "mouse") return; // only chase while actively pressed/dragging (mouse)

  if (!noEliminated) {
    const nr = noBtn.getBoundingClientRect();
    if (withinRect(e.clientX, e.clientY, nr)) attemptNo(e.clientX, e.clientY);
  }
  if (!yesCatchable) {
    const yr = yesBtn.getBoundingClientRect();
    if (withinRect(e.clientX, e.clientY, yr)) attemptYes(e.clientX, e.clientY);
  }
});

function triggerYes() {
  if (hasProposed || !yesCatchable) return;
  hasProposed = true;
  vibrate([10, 40, 10]);
  yesBtn.classList.remove("ready");
  yesBtn.classList.add("pop");
  feedbackEl.classList.remove("show");

  const r = yesBtn.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  spawnConfettiBurst(cx, cy, prefersReducedMotion ? 20 : 110);
  fireworksShow();
  playCelebrationSound();

  setTimeout(() => goToScreen("celebrate"), 900);
}

yesBtn.addEventListener("click", () => triggerYes());

/* ==========================================================================
   CELEBRATION SOUND (optional, muted by default until user opts in)
   ========================================================================== */
let audioEl = null;
let soundEnabled = false;
const muteBtn = document.getElementById("mute-btn");
const muteIcon = document.getElementById("mute-icon");

function playCelebrationSound() {
  if (!CONFIG.celebrationSoundUrl) return;
  audioEl = new Audio(CONFIG.celebrationSoundUrl);
  audioEl.volume = 0.6;
  audioEl.play().then(() => { soundEnabled = true; updateMuteUI(); }).catch(() => {
    // Autoplay blocked — that's fine, the mute button lets them opt in.
  });
}

function updateMuteUI() {
  muteIcon.textContent = soundEnabled ? "🔊" : "🔇";
  muteBtn.setAttribute("aria-pressed", String(!soundEnabled));
}

muteBtn.addEventListener("click", () => {
  if (!CONFIG.celebrationSoundUrl) return;
  soundEnabled = !soundEnabled;
  if (audioEl) audioEl.muted = !soundEnabled;
  else if (soundEnabled) playCelebrationSound();
  updateMuteUI();
});
if (!CONFIG.celebrationSoundUrl) {
  muteBtn.style.display = "none";
}

/* ==========================================================================
   INITIAL SETUP
   ========================================================================== */
// Re-measure NO/YES home positions and play-area bounds whenever the final screen becomes
// visible (layout may have shifted since last time) and on resize/orientation
// change, so nothing can ever be measured against a stale viewport.
window.addEventListener("resize", () => {
  if (screens.final.classList.contains("active")) measureFinalGeometry();
});
const finalObserver = new MutationObserver(() => {
  if (screens.final.classList.contains("active")) {
    // Wait a frame so the screen's opacity/transform transition has
    // actually applied final layout before we measure it.
    requestAnimationFrame(() => requestAnimationFrame(measureFinalGeometry));
  }
});
finalObserver.observe(screens.final, { attributes: true, attributeFilter: ["class"] });

goToScreen("intro");
