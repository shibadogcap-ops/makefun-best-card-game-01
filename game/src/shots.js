// Deterministic screenshot scenes behind ?shot=title|table|win|loss. Each scene
// drives the real rules forward with a fixed 16 ms step and a simple scripted
// policy, so the captured frame is one the game actually produces for the seed.
// End screens are reached honestly through clashes; the fallback only nudges a
// Life total and then lets the normal damage rule finish the match.

import { SCREEN } from './game.js';
import { effectiveValue } from './deck.js';
import { middleIndex } from './input.js';

const STEP_MS = 16;
const TABLE_CLASHES = 4;
const TABLE_STEP_CAP = 4000;
const END_STEP_CAP = 20000;
const FLORISH_STEPS = 30;

// Legacy shot names from earlier entries still resolve: start -> title,
// play -> table, end -> win. Unknown names fall back to the title scene.
const ALIASES = { start: 'title', play: 'table', end: 'win' };

function indexOfBest(hand, trumpSuit) {
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < hand.length; i += 1) {
    const value = effectiveValue(hand[i], trumpSuit);
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

function indexOfWorst(hand, trumpSuit) {
  let worst = 0;
  let worstValue = Infinity;
  for (let i = 0; i < hand.length; i += 1) {
    const value = effectiveValue(hand[i], trumpSuit);
    if (value < worstValue) {
      worstValue = value;
      worst = i;
    }
  }
  return worst;
}

/**
 * Play scripted clashes until `done(game)` is true, the match ends, or the step
 * cap is hit. `choose(game)` returns the player-hand index to commit whenever
 * the phase is 'pick'.
 */
function runClashes(game, choose, done, cap) {
  let steps = 0;
  while (steps < cap && game.screen === SCREEN.TABLE && !done(game)) {
    if (game.phase === 'pick' && game.playerHand.length > 0) {
      game.playCard(choose(game));
    }
    game.step(STEP_MS);
    steps += 1;
  }
}

/**
 * Stage the named scene on `game` (mutated in place) and return the shot name
 * that was staged. `game` is expected fresh from createGame(seed).
 */
export function stageShot(name, game) {
  const shot = ALIASES[name] || name;

  if (shot !== 'table' && shot !== 'win' && shot !== 'loss') {
    // Fresh title screen; step so the idle float/pulse animation has settled.
    for (let i = 0; i < 120; i += 1) game.step(STEP_MS);
    return 'title';
  }

  game.start();

  if (shot === 'table') {
    // Middle-card policy until four clashes have resolved and it is our pick
    // again; hands are full (5) at that point, Life bars are partly spent.
    runClashes(
      game,
      (g) => middleIndex(g.playerHand.length),
      (g) => g.clashCount >= TABLE_CLASHES && g.phase === 'pick',
      TABLE_STEP_CAP,
    );
    game.hoverIndex = game.playerHand.length > 0 ? middleIndex(game.playerHand.length) : null;
    return 'table';
  }

  const wantWin = shot === 'win';
  const wanted = wantWin ? SCREEN.WIN : SCREEN.LOSS;
  const choose = wantWin
    ? (g) => indexOfBest(g.playerHand, g.trumpSuit)
    : (g) => indexOfWorst(g.playerHand, g.trumpSuit);

  runClashes(game, choose, () => game.screen !== SCREEN.TABLE, END_STEP_CAP);

  // If the scripted policy never reached the wanted screen — the match ended
  // the other way, or the step cap hit mid-table — deal a fresh match, set the
  // relevant Life to 1, and let the real clash rules finish it.
  for (let attempt = 0; attempt < 8 && game.screen !== wanted; attempt += 1) {
    game.newMatch();
    if (wantWin) game.aiLife = 1;
    else game.playerLife = 1;
    runClashes(game, choose, () => game.screen !== SCREEN.TABLE, END_STEP_CAP);
  }

  // Let the end-screen flourish (particles, pulse) play a moment.
  for (let i = 0; i < FLORISH_STEPS && game.screen !== SCREEN.TABLE; i += 1) {
    game.step(STEP_MS);
  }
  return game.screen === SCREEN.WIN ? 'win' : 'loss';
}
