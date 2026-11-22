// The rival's brain. It answers after the player commits a card, so it always knows
// what it has to beat. The habits below are deliberately simple and commented so a
// human can read (and predict) how the rival plays.

import { effectiveValue } from './deck.js';

/**
 * Pick the rival's card from `hand` in response to `playerCard`.
 * `trumpSuit` is the suit id currently boosted by TRUMP_BONUS, `rng` a seeded rng.
 * Returns the chosen card object; the caller removes it from the hand.
 */
export function chooseAiCard(hand, playerCard, trumpSuit, rng) {
  const target = effectiveValue(playerCard, trumpSuit);
  const cost = (card) => effectiveValue(card, trumpSuit);
  const isTrump = (card) => card.suit === trumpSuit;

  // Cheapest first; on equal cost prefer a non-trump card so trumps are conserved.
  const byCost = (a, b) => cost(a) - cost(b) || Number(isTrump(a)) - Number(isTrump(b));

  // The weakest card worth dumping: lowest cost, non-trump preferred.
  const dumpCard =
    [...hand].sort(byCost).find((card) => !isTrump(card)) ??
    [...hand].sort(byCost)[0];

  // Cards that actually beat the player's effective value, cheapest first.
  const winners = hand.filter((card) => cost(card) > target).sort(byCost);

  if (winners.length === 0) {
    // Nothing can win — shed the cheapest card.
    return dumpCard;
  }

  const playerWeak = target <= 5;
  const holdsMuchStronger = hand.some((card) => cost(card) >= target + 5);

  // Habit: against a weak play the rival sometimes (~30%) just cashes the cheapest
  // win instead of conserving its stronger cards for later tricks.
  if (playerWeak && holdsMuchStronger && rng.next() < 0.3) {
    return winners[0];
  }

  // Habit: it usually (~75%) answers with the cheapest winning card...
  if (rng.next() < 0.75) {
    return winners[0];
  }

  // ...and otherwise throws its cheapest card away to save the good ones.
  return dumpCard;
}
