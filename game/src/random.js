// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes replays and screenshot scenes repeatable.

function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded RNG. `next()` is a float in [0,1), `int(n)` an integer in [0,n),
 * `pick(array)` a random element, and `shuffle(array)` an in-place Fisher-Yates.
 */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int(n) {
      return Math.floor(next() * n);
    },
    pick(array) {
      return array[this.int(array.length)];
    },
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = this.int(i + 1);
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
      }
      return array;
    },
  };
}

// Compatibility with the older call sites that want a bare random() function.
export function createRandom(seed) {
  return createRng(seed).next;
}
