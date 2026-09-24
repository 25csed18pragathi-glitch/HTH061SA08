/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 *
 * Produces deterministic, reproducible random sequences from an integer seed.
 * Running the same scenario + seed always yields the same vehicle arrivals,
 * making Fixed vs Adaptive comparisons fair and reproducible.
 *
 * Algorithm: Mulberry32 — fast 32-bit PRNG with good statistical properties.
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */

export function createSeededRandom(seed = Date.now()) {
  let state = Math.trunc(seed) | 0;

  /** Returns a float in [0, 1) — drop-in replacement for Math.random(). */
  function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] (inclusive). */
  function nextInt(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  /** Returns true with the given probability in [0, 1]. */
  function chance(probability) {
    return next() < probability;
  }

  /** Pick a random element from an array. */
  function pick(array) {
    return array[Math.floor(next() * array.length)];
  }

  /** Returns a float in [min, max). */
  function nextFloat(min, max) {
    return next() * (max - min) + min;
  }

  /** Reset to the same seed for exact replay. */
  function reset(newSeed) {
    state = Math.trunc(newSeed ?? seed) | 0;
  }

  /** Get the current seed value (for display/logging). */
  function getSeed() {
    return seed;
  }

  return Object.freeze({ next, nextInt, chance, pick, nextFloat, reset, getSeed });
}
