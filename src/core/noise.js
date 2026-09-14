import { makeRng } from './rng.js';

// Smooth value noise with octaves, good enough for island terrain.
export function makeNoise(seed) {
  const r = makeRng(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const vals = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];

  const lattice = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  const fade = t => t * t * (3 - 2 * t);

  function value(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = fade(x - xi), fy = fade(y - yi);
    const a = lattice(xi, yi), b = lattice(xi + 1, yi);
    const c = lattice(xi, yi + 1), d = lattice(xi + 1, yi + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }

  return function fbm(x, y, octaves = 4) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += value(x * freq, y * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };
}
