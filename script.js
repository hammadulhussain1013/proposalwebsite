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
  updateYesReaction();
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

   Architecture: YES and NO live in a normal flex row (.yn-row), so their
   base position is guaranteed to be fully inside the viewport — there is
   no hardcoded left/right math that could push either one off-screen.
   A separate draggable heart element is the ONLY thing the user actually
   grabs; YES and NO have no click/tap behavior of their own. NO watches
   the heart's live position (not the raw pointer) and flees from it with
   a transform layered on top of its flex position; YES stays completely
   stationary and only reacts visually (glow/scale) as the heart nears it.
   ========================================================================== */
const stage = document.getElementById("proposal-stage");
const yesBtn = document.getElementById("btn-yes");
const noBtn = document.getElementById("btn-no");
const heart = document.getElementById("heart-cursor");

const NO_PHRASES = ["NO", "Nice try", "Too slow", "Not happening", "Try YES"];

let hasProposed = false;

/* ---------- Geometry caches (re-measured on resize / screen show) ---------- */
// "Home" = natural position with transform reset to none. All movement is
// expressed as a transform offset from this home point, and every offset is
// clamped against the live viewport so nothing can ever leave the screen.
let heartHome = { x: 0, y: 0 };     // center point, viewport coords
let noHome = { x: 0, y: 0, w: 0, h: 0 };
let yesHome = { x: 0, y: 0, w: 0, h: 0 };

function measureFinalGeometry() {
  heart.style.transform = "translate(0px, 0px)";
  noBtn.style.transform = "translate(0px, 0px)";

  const hr = heart.getBoundingClientRect();
  heartHome = { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 };

  const nr = noBtn.getBoundingClientRect();
  noHome = { x: nr.left, y: nr.top, w: nr.width, h: nr.height };

  const yr = yesBtn.getBoundingClientRect();
  yesHome = {
    x: yr.left + yr.width / 2,
    y: yr.top + yr.height / 2,
    w: yr.width, h: yr.height,
  };

  heartPos = { ...heartHome };
  noOffset = { x: 0, y: 0 };
  noTargetOffset = { x: 0, y: 0 };
}

/* ---------- Heart state ---------- */
let heartPos = { x: 0, y: 0 };      // current live center, viewport coords
let heartDragging = false;
let heartPointerId = null;

/* ---------- NO state ---------- */
let noOffset = { x: 0, y: 0 };
let noTargetOffset = { x: 0, y: 0 };
let cornerTimer = 0;
let noPhraseIndex = 0;

function viewportSafeBounds() {
  const pad = 10;
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
  return {
    left: pad,
    top: pad + safeTop,
    right: window.innerWidth - pad,
    bottom: window.innerHeight - pad,
  };
}

function setNoPhrase(text) {
  noBtn.textContent = text;
}

function jumpNoToSafeSpot(fleeFromX, fleeFromY) {
  const b = viewportSafeBounds();
  const w = noHome.w, h = noHome.h;
  let best = null, bestScore = -1;

  // Sample a handful of candidate positions and keep the one farthest from
  // both the heart and YES, so the jump always reads as an escape.
  for (let i = 0; i < 10; i++) {
    const cx = rand(b.left + w / 2, b.right - w / 2);
    const cy = rand(b.top + h / 2, Math.min(b.bottom - h / 2, yesHome.y - yesHome.h));
    const score = dist(cx, cy, fleeFromX, fleeFromY) + dist(cx, cy, yesHome.x, yesHome.y) * 0.3;
    if (score > bestScore) { bestScore = score; best = { cx, cy }; }
  }

  noTargetOffset = { x: best.cx - (noHome.x + w / 2), y: best.cy - (noHome.y + h / 2) };
  noPhraseIndex = (noPhraseIndex + 1) % NO_PHRASES.length;
  setNoPhrase(NO_PHRASES[noPhraseIndex]);
  vibrate(6);
}

// Called every animation frame from masterLoop.
function updateNoButton() {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  if (!noHome.w) return;

  const w = noHome.w, h = noHome.h;
  const centerX = noHome.x + w / 2 + noOffset.x;
  const centerY = noHome.y + h / 2 + noOffset.y;

  // Distance from the HEART (not the raw pointer) drives repulsion.
  const d = dist(heartPos.x, heartPos.y, centerX, centerY);
  const FIELD_RADIUS = Math.max(window.innerWidth, window.innerHeight) * 0.32;

  if (d < FIELD_RADIUS) {
    noBtn.classList.add("wary");
    const strength = clamp(1 - d / FIELD_RADIUS, 0, 1);
    const angle = Math.atan2(centerY - heartPos.y, centerX - heartPos.x);
    const pushDist = strength * strength * 95;

    const b = viewportSafeBounds();
    let targetCx = clamp(centerX + Math.cos(angle) * pushDist, b.left + w / 2, b.right - w / 2);
    let targetCy = clamp(
      centerY + Math.sin(angle) * pushDist,
      b.top + h / 2,
      Math.min(b.bottom - h / 2, yesHome.y - yesHome.h)
    );

    const atEdge =
      targetCx <= b.left + w / 2 + 1 || targetCx >= b.right - w / 2 - 1 ||
      targetCy <= b.top + h / 2 + 1;

    if (d < FIELD_RADIUS * 0.3 && atEdge) {
      cornerTimer += 1;
    } else {
      cornerTimer = Math.max(0, cornerTimer - 1);
    }

    if (cornerTimer > 9) {
      jumpNoToSafeSpot(heartPos.x, heartPos.y);
      cornerTimer = 0;
    } else {
      noTargetOffset = { x: targetCx - (noHome.x + w / 2), y: targetCy - (noHome.y + h / 2) };
    }
  } else {
    noBtn.classList.remove("wary");
    cornerTimer = 0;
    // Drift back toward its home slot when the heart is far away.
    noTargetOffset = { x: 0, y: 0 };
  }

  const ease = 0.16;
  noOffset.x = lerp(noOffset.x, noTargetOffset.x, ease);
  noOffset.y = lerp(noOffset.y, noTargetOffset.y, ease);
  noBtn.style.transform = `translate(${noOffset.x}px, ${noOffset.y}px)`;
}

/* ---------- YES magnetic reaction ---------- */
const YES_ATTRACT_RADIUS = 130;
const YES_HIT_RADIUS = 95; // generous — no need to drop precisely on the button

function updateYesReaction() {
  if (!screens.final.classList.contains("active") || hasProposed) return;
  const d = dist(heartPos.x, heartPos.y, yesHome.x, yesHome.y);
  yesBtn.classList.toggle("attract", d < YES_ATTRACT_RADIUS);
}

/* ---------- Heart drag handling ---------- */
function placeHeart() {
  heart.style.transform = `translate(${heartPos.x - heartHome.x}px, ${heartPos.y - heartHome.y}px)`;
}

function clampHeartToViewport(x, y) {
  const b = viewportSafeBounds();
  return { x: clamp(x, b.left, b.right), y: clamp(y, b.top, b.bottom) };
}

heart.addEventListener("pointerdown", (e) => {
  if (hasProposed) return;
  heartDragging = true;
  heartPointerId = e.pointerId;
  heart.setPointerCapture?.(e.pointerId);
  heart.classList.remove("snap-back", "flying");
  heart.classList.add("grabbed");
  e.preventDefault();
});

window.addEventListener("pointermove", (e) => {
  if (!heartDragging || e.pointerId !== heartPointerId || hasProposed) return;

  let { x, y } = clampHeartToViewport(e.clientX, e.clientY);

  // Magnetic snap toward YES as the heart enters its attraction radius.
  const dToYes = dist(x, y, yesHome.x, yesHome.y);
  if (dToYes < YES_ATTRACT_RADIUS) {
    const pull = clamp(1 - dToYes / YES_ATTRACT_RADIUS, 0, 1) * 0.35;
    x = lerp(x, yesHome.x, pull);
    y = lerp(y, yesHome.y, pull);
  }

  heartPos = { x, y };
  placeHeart();
  spawnFirefly(x, y);
});

function releaseHeart(e) {
  if (!heartDragging || (e && e.pointerId !== heartPointerId)) return;
  heartDragging = false;
  heart.classList.remove("grabbed");

  const dToYes = dist(heartPos.x, heartPos.y, yesHome.x, yesHome.y);
  if (dToYes < YES_HIT_RADIUS) {
    triggerYes();
  } else {
    // Spring back to its resting spot, ready to try again.
    heart.classList.add("snap-back");
    heartPos = { ...heartHome };
    placeHeart();
    setTimeout(() => heart.classList.remove("snap-back"), 600);
  }
}
window.addEventListener("pointerup", releaseHeart);
window.addEventListener("pointercancel", releaseHeart);

function triggerYes() {
  if (hasProposed) return;
  hasProposed = true;
  vibrate([10, 40, 10]);

  // Heart flies the rest of the way into YES, then the button pops.
  heart.classList.add("flying");
  heartPos = { ...yesHome };
  placeHeart();
  yesBtn.classList.add("attract");

  setTimeout(() => {
    yesBtn.classList.add("pop");
    const r = yesBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    spawnConfettiBurst(cx, cy, prefersReducedMotion ? 20 : 110);
    fireworksShow();
    playCelebrationSound();
  }, 200);

  setTimeout(() => goToScreen("celebrate"), 1100);
}

// YES and NO intentionally have no click behavior — a tap does nothing.
// Guarded explicitly so a stray synthetic click can never complete either
// answer; only the heart-drag path above can call triggerYes().
yesBtn.addEventListener("click", (e) => e.preventDefault());
noBtn.addEventListener("click", (e) => e.preventDefault());

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
// Re-measure heart/YES/NO home positions whenever the final screen becomes
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
