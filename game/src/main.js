// Boot and the one loop for AETHER CLASH: the renderer owns the canvas transform,
// input maps client pixels into the 1280x720 field, and game.step(dt) advances
// the clash timeline with real frame deltas (clamped to 50 ms so a stalled tab
// doesn't fast-forward a duel).
//
// ?seed=N fixes the shuffle and the rival's habits (default 20261122).
// ?shot=title|table|win|loss stages a deterministic scene instead of running
// interactively: it is drawn once, then the loop only idles the end/title
// screens — the table shot stays frozen so the captured frame is exact.

import { VIEW } from './config.js';
import { createGame, SCREEN } from './game.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { attachInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME_MS = 50;
const SHOT_STEP_MS = 16;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

canvas.setAttribute(
  'aria-label',
  'Aether Clash: a card duel against the rival Kael — pick one of five cards, ' +
  'watch the rival\'s answer flip over, and the rotating trump suit decides each clash',
);

// Size the backing store to the window at up to 2x density; the renderer's own
// resize listener recomputes the letterboxed view transform from this.
function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

const renderer = createRenderer(canvas);
const audio = createAudio();
const game = createGame(seed);

/** Client pixel -> virtual 1280x720 coordinate, matching the renderer's fit. */
function toVirtual(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = (clientX - rect.left) * dpr;
  const py = (clientY - rect.top) * dpr;
  const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  const offsetX = (canvas.width - VIEW.width * scale) / 2;
  const offsetY = (canvas.height - VIEW.height * scale) / 2;
  return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
}

if (shotName) {
  const staged = stageShot(shotName, game);
  // Idle screens keep animating (title float, victory particles); the table
  // shot must stay pixel-frozen, so it never steps.
  const idle = staged === 'title' || staged === 'win' || staged === 'loss';
  let painted = 0;
  function frame() {
    if (idle) game.step(SHOT_STEP_MS);
    renderer.draw(game);
    painted += 1;
    if (painted === 2) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} else {
  if (status) status.textContent = game.banner || 'Aether Clash. Press Enter or click to play.';
  attachInput(canvas, game, audio, toVirtual);

  let lastScreen = game.screen;
  let lastPhase = game.phase;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, MAX_FRAME_MS);
    last = now;
    game.step(dt);

    // One-shot cues for the moments the rules produce.
    if (game.phase === 'reveal' && lastPhase !== 'reveal') audio.flip();
    if (game.phase === 'banner' && lastPhase !== 'banner' && game.bannerKind !== 'tie') {
      audio.damage();
    }
    if (game.screen !== lastScreen) {
      if (game.screen === SCREEN.WIN) audio.win();
      else if (game.screen === SCREEN.LOSS) audio.lose();
    }
    lastScreen = game.screen;
    lastPhase = game.phase;

    renderer.draw(game);
  }
  requestAnimationFrame(frame);
}
