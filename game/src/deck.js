// Deck construction and card helpers. Cards are plain objects { suit, rank } where
// suit is a suit id from config.js ('sun', 'moon', 'wave', 'ember') and rank is an
// integer in [RANKS.min, RANKS.max].

import { RANKS, SUITS, TRUMP_BONUS } from './config.js';

/** All 40 cards (every suit x every rank), in a fixed unshuffled order. */
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = RANKS.min; rank <= RANKS.max; rank += 1) {
      deck.push({ suit: suit.id, rank });
    }
  }
  return deck;
}

/** A fresh shuffled deck; `rng` is an object with a shuffle(array) method. */
export function shuffledDeck(rng) {
  return rng.shuffle(buildDeck());
}

/** Display name for a card, e.g. "Sun 7". */
export function cardName(card) {
  const suit = SUITS.find((s) => s.id === card.suit);
  return `${suit ? suit.name : card.suit} ${card.rank}`;
}

/** Rank plus TRUMP_BONUS when the card's suit is the trump suit, else plain rank. */
export function effectiveValue(card, trumpSuit) {
  return card.rank + (card.suit === trumpSuit ? TRUMP_BONUS : 0);
}
