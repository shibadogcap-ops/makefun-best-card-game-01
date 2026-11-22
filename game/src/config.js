// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

/** The virtual playfield every screen coordinate and layout is expressed in. */
export const VIEW = { width: 1280, height: 720 };

/**
 * The four suits, in rotation order. The first suit after the round-end suit becomes trump.
 * `color` is the suit's glow/ink tone, `dark` a deeper shade for card art and shading.
 */
export const SUITS = [
  { id: 'sun',   name: 'Sun',   color: '#f2b33d', dark: '#8a5a14' },
  { id: 'moon',  name: 'Moon',  color: '#a685ff', dark: '#4a3580' },
  { id: 'wave',  name: 'Wave',  color: '#35c4dc', dark: '#146a78' },
  { id: 'ember', name: 'Ember', color: '#f2604c', dark: '#7e2418' },
];

/** Lowest and highest rank a card can carry (ranks are plain integers, inclusive). */
export const RANKS = { min: 1, max: 10 };

/** Cards drawn into the duelist's hand at the start of every round. */
export const HAND_SIZE = 5;

/** Life each duelist starts a match with; reaching 0 ends it. */
export const START_LIFE = 20;

/** Flat rank bonus added to an Ember card's rank during a clash. */
export const TRUMP_BONUS = 3;

/** Card dimensions in view pixels and the corner radius used when drawing. */
export const CARD = { width: 112, height: 156, radius: 12 };

export const COLORS = {
  // Table felt: a deep-indigo radial wash, brightest at the centre line.
  feltStops: ['#2c1d5e', '#241752', '#1b1038'],
  ink: '#17102e',
  // Card face parchment and the ink used for ranks, suit pips and labels.
  parchment: '#f7f1e3',
  parchmentEdge: '#e6dcc4',
  // Colours woven into the card back pattern and its border.
  cardBack: '#2a1a55',
  cardBackPattern: '#4b2f8f',
  cardBackLine: '#e8c268',
  // Gold used for accents: trump banners, spoils markers, emphasis.
  gold: '#e8c268',
  // Text tones: main, dimmed, and the Life/spoils counters.
  text: '#f4efe4',
  textDim: '#b9aed6',
  textFaint: '#7d709c',
};

export const TIMING = {
  /** Milliseconds for a played card to flip over and reveal its face. */
  REVEAL_MS: 650,
  /** Milliseconds a result banner ("Ember surge!", "Tie — spoils!") stays up. */
  BANNER_MS: 1250,
  /** Milliseconds for a card to slide from hand to the clash zone. */
  PLAY_MS: 350,
  /** Milliseconds for the spoils pile / Life counter updates to settle. */
  SETTLE_MS: 400,
};
