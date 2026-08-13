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
const SCREEN_ORDER = ["intro", "q1", "q2", "final", "celebrate"];
const screens = {};
SCREEN_ORDER.forEach((name) => {
  screens[name] = document.getElementById(`screen-${name}`);
});

const progressEl = document.getElementById("progress");
const progressLabel = document.getElementById("progress-label");
const progressFill = document.getElementById("progress-fill");

// Steps 2 and 3 (q1, q2) are the "1 / 3" and "2 / 3" of the mini journey;
// step 3 of 3 is the final question itself.
const PROGRESS_MAP = { q1: 1, q2: 2, final: 3 };

function goToScreen(name) {
  SCREEN_ORDER.forEach((s) => screens[s].classList.toggle("active", s === name));

  if (PROGRESS_MAP[name]) {
    progressEl.classList.add("show");
    progressLabel.textContent = `${PROGRESS_MAP[name]} / 3`;
    progressFill.style.width = `${(PROGRESS_MAP[name] / 3) * 100}%`;
  } else {
    progressEl.classList.remove("show");
  }

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
        setTimeout(() => goToScreen("q1"), 320);
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
   SCREENS 2 & 3 — PLAYFUL CHOICES
   ========================================================================== */
function setupChoiceScreen(screenId, replyId, nextScreen, delay = 900) {
  const container = document.getElementById(screenId);
  const replyEl = document.getElementById(replyId);
  container.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      container.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));
      btn.classList.add("chosen");
      replyEl.textContent = btn.dataset.reply;
      replyEl.classList.add("show");
      vibrate(8);
      setTimeout(() => {
        goToScreen(nextScreen);
        // Reset for potential revisits (e.g. back navigation isn't exposed,
        // but this keeps state clean if the script is reused).
        container.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = false));
        replyEl.classList.remove("show");
      }, delay);
    });
  });
}
setupChoiceScreen("q1-choices", "q1-reply", "q2");
setupChoiceScreen("q2-choices", "q2-reply", "final");

/* ==========================================================================
   SCREEN 4 — FINAL PROPOSAL (the core interaction)

   Architecture: YES and NO both start in a normal flex row (.yn-row), so
   their base position is guaranteed to be fully inside the viewport — no
   hardcoded left/right math that could push either one off-screen.

   YES is a completely normal button: it glows a little as the pointer
   nears it, and a tap answers "yes" directly.

   NO is a simple 2D physics object. It sits still until actually touched —
   pressed, or dragged onto — at which point it launches away from the
   touch point, bounces off the screen edges with restitution + friction,
   and settles somewhere new. It never has functioning click behavior, so
   there is no way to ever select "no".
   ========================================================================== */
const stage = document.getElementById("proposal-stage");
const yesBtn = document.getElementById("btn-yes");
const noBtn = document.getElementById("btn-no");

// Tunable physics — adjust freely.
const NO_PHYSICS = {
  bounceForce: 30,      // impulse strength applied away from the touch point
  friction: 0.983,      // velocity multiplier applied every frame
  restitution: 0.8,     // fraction of speed kept after bouncing off an edge
  maxVelocity: 46,       // hard cap on px/frame, so it can never rocket off-screen
  edgeMargin: 12,        // safe margin kept from the usable screen edges
  settleThreshold: 0.35, // speed below which the ball is considered "at rest"
  cooldownMs: 500,       // minimum time between successive escapes
};

const NO_PHRASES = ["NO", "NOPE", "Nice try", "Too slow", "Not happening", "Try YES ❤️", "Still no", "You can't catch me"];

let hasProposed = false;

/* ---------- Geometry ---------- */
// "Home" = NO's natural flex-row position with transform reset to none.
// All motion is expressed as a transform offset from this point, and the
// allowed offset range is clamped every frame against the live viewport,
// so NO can never end up off-screen or clipped.
let noHome = { x: 0, y: 0, w: 0, h: 0 };
let yesHome = { x: 0, y: 0 };
let playBounds = { minDx: 0, maxDx: 0, minDy: 0, maxDy: 0 };

function measureFinalGeometry() {
  noBtn.style.transform = "translate(0px, 0px) rotate(0deg)";

  const nr = noBtn.getBoundingClientRect();
  noHome = { x: nr.left, y: nr.top, w: nr.width, h: nr.height };

  const yr = yesBtn.getBoundingClientRect();
  yesHome = { x: yr.left + yr.width / 2, y: yr.top + yr.height / 2 };

  const m = NO_PHYSICS.edgeMargin;
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
  const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 0;

  // Usable play area: full viewport width, and vertically from just below
  // the question text down to just above the bottom safe area.
  const stageR = stage.getBoundingClientRect();
  const areaTop = Math.max(safeTop + m, stageR.top);
  const areaBottom = window.innerHeight - safeBottom - m;
  const areaLeft = m;
  const areaRight = window.innerWidth - m;

  playBounds = {
    minDx: areaLeft - noHome.x,
    maxDx: areaRight - noHome.w - noHome.x,
    minDy: areaTop - noHome.y,
    maxDy: areaBottom - noHome.h - noHome.y,
  };
}

/* ---------- NO physics state ---------- */
let noOffset = { x: 0, y: 0 };
let noVel = { x: 0, y: 0 };
let noRot = 0;
let noSquash = 1;    // scaleY on impact, springs back to 1
let noStretch = 1;   // scaleX on impact, springs back to 1
let noMoving = false;
let noPhraseIndex = 0;
let lastEscapeAt = 0;

function cycleNoPhrase() {
  noPhraseIndex = (noPhraseIndex + 1) % NO_PHRASES.length;
  noBtn.textContent = NO_PHRASES[noPhraseIndex];
}

function launchNoFrom(touchX, touchY) {
  const now = performance.now();
  if (now - lastEscapeAt < NO_PHYSICS.cooldownMs) return;
  lastEscapeAt = now;

  const centerX = noHome.x + noHome.w / 2 + noOffset.x;
  const centerY = noHome.y + noHome.h / 2 + noOffset.y;

  let dx = centerX - touchX;
  let dy = centerY - touchY;
  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag; dy /= mag;

  // Small random spread so repeated attempts don't all fly the same way.
  const spread = rand(-0.35, 0.35);
  const cos = Math.cos(spread), sin = Math.sin(spread);
  const rdx = dx * cos - dy * sin;
  const rdy = dx * sin + dy * cos;

  noVel.x += rdx * NO_PHYSICS.bounceForce;
  noVel.y += rdy * NO_PHYSICS.bounceForce;
  noMoving = true;

  // Impact squash/stretch, aligned to the launch direction.
  noStretch = 1.28;
  noSquash = 0.74;

  noBtn.classList.remove("settled");
  noBtn.classList.add("impact");
  setTimeout(() => noBtn.classList.remove("impact"), 220);

  spawnFirefly(touchX, touchY);
  spawnFirefly(touchX + rand(-8, 8), touchY + rand(-8, 8));
  cycleNoPhrase();
  vibrate(10);
}

function withinRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// Physics step — runs every animation frame while the final screen is active.
function updateNoButton() {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  if (!noHome.w) return;

  if (noMoving) {
    noVel.x = clamp(noVel.x, -NO_PHYSICS.maxVelocity, NO_PHYSICS.maxVelocity);
    noVel.y = clamp(noVel.y, -NO_PHYSICS.maxVelocity, NO_PHYSICS.maxVelocity);

    noOffset.x += noVel.x;
    noOffset.y += noVel.y;

    // Bounce off the play-area boundaries like a rubber ball.
    if (noOffset.x < playBounds.minDx) {
      noOffset.x = playBounds.minDx;
      noVel.x *= -NO_PHYSICS.restitution;
      noStretch = 1.2; noSquash = 0.8;
    } else if (noOffset.x > playBounds.maxDx) {
      noOffset.x = playBounds.maxDx;
      noVel.x *= -NO_PHYSICS.restitution;
      noStretch = 1.2; noSquash = 0.8;
    }
    if (noOffset.y < playBounds.minDy) {
      noOffset.y = playBounds.minDy;
      noVel.y *= -NO_PHYSICS.restitution;
      noStretch = 0.82; noSquash = 1.22;
    } else if (noOffset.y > playBounds.maxDy) {
      noOffset.y = playBounds.maxDy;
      noVel.y *= -NO_PHYSICS.restitution;
      noStretch = 0.82; noSquash = 1.22;
    }

    noVel.x *= NO_PHYSICS.friction;
    noVel.y *= NO_PHYSICS.friction;
    noRot += noVel.x * 0.6;

    const speed = Math.hypot(noVel.x, noVel.y);
    if (speed < NO_PHYSICS.settleThreshold) {
      noMoving = false;
      noVel.x = 0; noVel.y = 0;
      noBtn.classList.add("settled");
      setTimeout(() => noBtn.classList.remove("settled"), 400);
    }
  }

  // Squash/stretch spring back toward neutral every frame.
  noSquash = lerp(noSquash, 1, 0.15);
  noStretch = lerp(noStretch, 1, 0.15);

  noBtn.style.transform =
    `translate(${noOffset.x}px, ${noOffset.y}px) rotate(${noRot}deg) scale(${noStretch}, ${noSquash})`;
}

/* ---------- Catching NO: press it, or drag your finger onto it ---------- */
noBtn.addEventListener("pointerdown", (e) => {
  if (hasProposed) return;
  launchNoFrom(e.clientX, e.clientY);
  e.preventDefault();
});

// A drag that merely passes over NO should also make it flee — this is
// what makes it feel chase-able rather than a single dodge-and-done.
window.addEventListener("pointermove", (e) => {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  if (e.buttons === 0 && e.pointerType === "mouse") return; // only chase while actively pressed/dragging (mouse)
  const r = noBtn.getBoundingClientRect();
  if (withinRect(e.clientX, e.clientY, r)) {
    launchNoFrom(e.clientX, e.clientY);
  }
});

// NO intentionally has no functioning click behavior — guarded explicitly
// so a stray synthetic click can never register a "no" answer.
noBtn.addEventListener("click", (e) => e.preventDefault());

/* ---------- YES: stationary, magnetic glow, works on a normal tap ---------- */
const YES_ATTRACT_RADIUS = 130;

window.addEventListener("pointermove", (e) => {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  const d = dist(e.clientX, e.clientY, yesHome.x, yesHome.y);
  yesBtn.classList.toggle("attract", d < YES_ATTRACT_RADIUS);
});

function triggerYes() {
  if (hasProposed) return;
  hasProposed = true;
  vibrate([10, 40, 10]);
  yesBtn.classList.add("pop");

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
