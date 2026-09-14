// Seeded random numbers (mulberry32) so a world seed always makes the same map.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

export const rand = Math.random;
export const range = (lo, hi, r = rand) => lo + r() * (hi - lo);
export const irange = (lo, hi, r = rand) => Math.floor(lo + r() * (hi - lo + 1));
export const pick = (arr, r = rand) => arr[Math.floor(r() * arr.length)];
export const chance = (p, r = rand) => r() < p;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** items: [{ weight, ... }] -> one item */
export function weighted(items, r = rand) {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  let roll = r() * total;
  for (const it of items) {
    roll -= Math.max(0, it.weight);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}
