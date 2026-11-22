// AETHER CLASH — game state machine.
// Owns the rules and flow only: hands, deck, Life, scores, trump rotation,
// clash resolution, and the phase timeline the renderer reads each frame.
// No drawing, no DOM.

import { HAND_SIZE, START_LIFE, SUITS, TIMING } from './config.js';
import { createRng } from './random.js';
import { effectiveValue, shuffledDeck, cardName } from './deck.js';
import { chooseAiCard } from './ai.js';

export const SCREEN = { TITLE: 'title', TABLE: 'table', WIN: 'win', LOSS: 'loss' };

/** Next suit in the SUITS rotation; the last wraps around to the first. */
function nextSuitId(currentId) {
  const i = SUITS.findIndex((s) => s.id === currentId);
  return SUITS[(i + 1) % SUITS.length].id;
}

function suitName(id) {
  return SUITS.find((s) => s.id === id).name;
}

/** Rank sum of every non-null card in `cards`. */
function rankSum(...cards) {
  return cards.reduce((sum, c) => sum + (c ? c.rank : 0), 0);
}

/**
 * Create a game. `seed` makes every shuffle and AI choice reproducible.
 * Returns the mutable game object; call `step(dtMs)` each frame to advance
 * animations and timed phases, and drive input via `start()` / `playCard(i)`.
 */
export function createGame(seed) {
  const rng = createRng(seed);

  const game = {
    rng,
    screen: SCREEN.TITLE,
    deck: [],
    playerHand: [],
    aiHand: [],
    playerLife: START_LIFE,
    aiLife: START_LIFE,
    playerScore: 0,
    aiScore: 0,
    trumpSuit: SUITS[0].id,
    spoils: [],
    playerCard: null,
    aiCard: null,
    aiFaceDown: false,
    phase: 'pick',
    banner: '',
    bannerKind: 'info',
    floaters: [],
    clashCount: 0,
    winner: null,
    hoverIndex: null,
    resolved: false,
    // Animation bookkeeping the renderer reads. Progress values run 0..1;
    // `now` is total elapsed ms so idle effects can be time-based.
    anim: { playerPlayT: 1, aiPlayT: 1, flipT: 1 },
    now: 0,

    /** Draw until `hand` holds HAND_SIZE cards, or the deck runs dry. */
    refill(hand) {
      while (hand.length < HAND_SIZE && game.deck.length > 0) {
        hand.push(game.deck.pop());
      }
    },

    /** Push a floating damage/heal number; `x`/`y` are view coordinates. */
    addFloater(x, y, text, color) {
      game.floaters.push({ x, y, text, color, age: 0 });
    },

    /**
     * End-of-match check. A Life <= 0 loses; on tied Life the higher score
     * wins, still tied goes to the AI. Returns true when the match is over.
     */
    finishMatch() {
      let winner = null;
      if (game.playerLife <= 0 && game.aiLife <= 0) {
        winner = game.playerScore >= game.aiScore ? 'player' : 'ai';
      } else if (game.playerLife <= 0) {
        winner = 'ai';
      } else if (game.aiLife <= 0) {
        winner = 'player';
      } else if (game.deck.length === 0 &&
                 (game.playerHand.length === 0 || game.aiHand.length === 0)) {
        if (game.playerLife !== game.aiLife) {
          winner = game.playerLife > game.aiLife ? 'player' : 'ai';
        } else if (game.playerScore !== game.aiScore) {
          winner = game.playerScore > game.aiScore ? 'player' : 'ai';
        } else {
          winner = 'ai';
        }
      }
      if (!winner) return false;
      game.winner = winner;
      game.screen = winner === 'player' ? SCREEN.WIN : SCREEN.LOSS;
      game.phase = 'pick';
      game.banner = winner === 'player'
        ? `Victory — ${game.playerLife} Life remain`
        : `Defeat — the rival stands at ${game.aiLife} Life`;
      game.bannerKind = winner === 'player' ? 'win' : 'lose';
      return true;
    },

    /** Resolve the clash once the AI card has fully flipped. */
    resolveClash() {
      const p = game.playerCard;
      const a = game.aiCard;
      const pEff = effectiveValue(p, game.trumpSuit);
      const aEff = effectiveValue(a, game.trumpSuit);

      if (pEff === aEff) {
        // Tie: both cards join the spoils pile; the next winner takes them all.
        game.spoils.push(p, a);
        game.banner = 'A tie — the spoils grow';
        game.bannerKind = 'tie';
      } else {
        const winnerIsPlayer = pEff > aEff;
        const winnerCard = winnerIsPlayer ? p : a;
        const loserCard = winnerIsPlayer ? a : p;
        const spoilsTaken = game.spoils.length > 0;
        const captured = [winnerCard, loserCard, ...game.spoils];
        game.spoils = [];

        // Damage is the printed-rank gap (minimum 1); Ember adds +1.
        let damage = Math.max(1, winnerCard.rank - loserCard.rank);
        let bannerLine = `${cardName(winnerCard)} takes the clash`;
        if (winnerCard.suit === 'ember') {
          damage += 1;
          bannerLine += ' — Ember burn +1';
        }
        if (winnerCard.suit === 'wave') {
          // Wave heals its owner instead of adding damage.
          if (winnerIsPlayer) {
            game.playerLife = Math.min(START_LIFE, game.playerLife + 1);
          } else {
            game.aiLife = Math.min(START_LIFE, game.aiLife + 1);
          }
          bannerLine += ' — Wave mends +1 Life';
          game.addFloater(winnerIsPlayer ? 320 : 960, 300, '+1', '#35c4dc');
        }

        if (winnerIsPlayer) {
          game.playerScore += rankSum(...captured);
          game.aiLife = Math.max(0, game.aiLife - damage);
          game.addFloater(960, 300, `-${damage}`, '#f2604c');
        } else {
          game.aiScore += rankSum(...captured);
          game.playerLife = Math.max(0, game.playerLife - damage);
          game.addFloater(320, 300, `-${damage}`, '#f2604c');
        }
        game.banner = `${bannerLine} — ${damage} damage${spoilsTaken ? ' (spoils claimed)' : ''}`;
        game.bannerKind = winnerIsPlayer ? 'win' : 'lose';
      }

      game.phase = 'banner';
      game.bannerT = 0;
      game.clashCount += 1;
    },

    /** Banner elapsed: clear the table, refill hands, rotate trump, end check. */
    settleClash() {
      game.playerCard = null;
      game.aiCard = null;
      game.aiFaceDown = false;
      game.anim.playerPlayT = 1;
      game.anim.aiPlayT = 1;
      game.anim.flipT = 1;
      game.trumpSuit = nextSuitId(game.trumpSuit);
      game.refill(game.playerHand);
      game.refill(game.aiHand);
      if (game.finishMatch()) return;
      game.phase = 'pick';
      game.banner = `Choose your card — trump is ${suitName(game.trumpSuit)}`;
      game.bannerKind = 'info';
    },

    /** TITLE -> a fresh match. */
    start() {
      game.newMatch();
    },

    /** Fresh match: lives, scores, spoils, clash counter, deck, trump, deal. */
    newMatch() {
      game.playerLife = START_LIFE;
      game.aiLife = START_LIFE;
      game.playerScore = 0;
      game.aiScore = 0;
      game.spoils = [];
      game.playerCard = null;
      game.aiCard = null;
      game.aiFaceDown = false;
      game.clashCount = 0;
      game.winner = null;
      game.hoverIndex = null;
      game.floaters = [];
      game.resolved = false;
      game.deck = shuffledDeck(rng);
      game.trumpSuit = rng.pick(SUITS).id;
      game.playerHand = [];
      game.aiHand = [];
      game.refill(game.playerHand);
      game.refill(game.aiHand);
      game.screen = SCREEN.TABLE;
      game.phase = 'pick';
      game.banner = `Choose your card — trump is ${suitName(game.trumpSuit)}`;
      game.bannerKind = 'info';
      game.anim = { playerPlayT: 1, aiPlayT: 1, flipT: 1 };
      game.bannerT = 0;
    },

    /**
     * Player commits hand[index]. Only valid in phase 'pick' on the table.
     * The AI answers via chooseAiCard; both cards move to the clash zone and
     * the reveal timeline begins.
     */
    playCard(index) {
      if (game.phase !== 'pick' || game.screen !== SCREEN.TABLE) return;
      const card = game.playerHand[index];
      if (!card) return;
      game.playerHand.splice(index, 1);
      game.playerCard = card;
      game.anim.playerPlayT = 0;

      const chosen = chooseAiCard(game.aiHand, card, game.trumpSuit, rng);
      const aiIndex = game.aiHand.indexOf(chosen);
      game.aiCard = game.aiHand.splice(aiIndex >= 0 ? aiIndex : 0, 1)[0];
      game.aiFaceDown = true;
      game.anim.aiPlayT = 0;
      game.anim.flipT = 0;
      game.phase = 'reveal';
    },

    /**
     * Advance the game by `dtMs` milliseconds.
     * Drives reveal/flip timing, clash resolution, the banner pause,
     * floater aging, and the renderer's idle clock.
     */
    step(dtMs) {
      game.now += dtMs;

      // Floaters rise and fade over ~900 ms, then drop away by 1600 ms.
      for (const f of game.floaters) f.age += dtMs;
      game.floaters = game.floaters.filter((f) => f.age < 1600);

      if (game.phase === 'reveal') {
        game.anim.flipT = Math.min(1, game.anim.flipT + dtMs / TIMING.REVEAL_MS);
        if (game.anim.flipT >= 0.5 && game.aiFaceDown) {
          game.aiFaceDown = false; // AI card turns face-up mid-flip
        }
        if (game.anim.flipT >= 1 && !game.resolved) {
          game.resolved = true;
          game.resolveClash();
        }
      } else if (game.phase === 'banner') {
        game.bannerT += dtMs;
        if (game.bannerT >= TIMING.BANNER_MS && game.screen === SCREEN.TABLE) {
          game.resolved = false;
          game.settleClash();
        }
      }
      // Cards slide from hand to clash over PLAY_MS regardless of phase.
      game.anim.playerPlayT = Math.min(1, game.anim.playerPlayT + dtMs / TIMING.PLAY_MS);
      game.anim.aiPlayT = Math.min(1, game.anim.aiPlayT + dtMs / TIMING.PLAY_MS);
    },
  };

  return game;
}
