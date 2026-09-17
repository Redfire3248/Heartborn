/*
 * The Heartborn emblem: a pixel-art heart made of fire. The heart is solid and glowing, and flames lick up from its top,
 * redrawn a few times a second so they flicker. Drawn on a tiny canvas and scaled up with crisp pixels.
 */
import { h } from './dom.js';

const W = 30, H = 38;
const OUTLINE = '#2a0c06';
const HEART = ['#fff4c2', '#ffe08a', '#ffc34d', '#ff9a2a', '#ff7a2a', '#e8521e', '#c2331a', '#8f2412'];   // top to bottom
const FLAME = ['#fff4c2', '#ffd76a', '#ff9a2a', '#e8521e', '#c2331a'];   // hot core to dark edge

/** A classic pixel heart (two round lobes), drawn at 2x inside the canvas. */
const HEART_MASK = [
  '..XXX...XXX..',
  '.XXXXX.XXXXX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '...XXXXXXX...',
  '....XXXXX....',
  '.....XXX.....',
  '......X......',
];
const HX = 2, HY = 15;   // where the heart sits in the canvas
function inHeart(x, y) {
  const mx = Math.floor((x - HX) / 2), my = Math.floor((y - HY) / 2);
  return HEART_MASK[my]?.[mx] === 'X';
}

/** Makes the animated emblem. `size` is its size in CSS pixels. Stops by itself once removed from the page. */
export function logoEmblem(size = 112) {
  const c = h('canvas.logo-emblem', { width: W, height: H });
  c.style.width = `${Math.round(size * W / H)}px`; c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  const heart = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inHeart(x, y)) heart.push([x, y]);
  const isHeart = new Set(heart.map(([x, y]) => `${x},${y}`));
  const heartTop = Math.min(...heart.map(p => p[1]));
  const heartBottom = Math.max(...heart.map(p => p[1]));

  let t = 0;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const cells = new Map();
    // flames: three tongues rising from the top of the heart, each wavering on its own
    const tongues = [[8.5, 12 + Math.sin(t * 1.7) * 2], [15, 15 + Math.sin(t * 2.3 + 1) * 2.5], [21.5, 12 + Math.sin(t * 1.9 + 2) * 2]];
    for (const [fx, height] of tongues) {
      const sway = Math.sin(t * 2.6 + fx) * 1.2;
      for (let dy = 0; dy < height; dy++) {
        const k = dy / height;                       // 0 at the base, 1 at the tip
        const half = Math.max(0, (1 - k) * 4.2 - 0.3 + Math.sin(t * 5 + dy + fx) * 0.35);
        const cx = fx + sway * k;
        const y = heartTop + 5 - dy;
        for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
          if (y < 0 || x < 0 || x >= W) continue;
          const edge = Math.abs(x - cx) / (half + 0.01);
          const col = FLAME[Math.min(FLAME.length - 1, Math.floor(edge * 2.2 + k * 2.4))];
          cells.set(`${x},${y}`, col);
        }
      }
    }
    // the heart: bright at the top, deep red at the bottom, with a shine and a slow pulse
    const pulse = Math.sin(t * 3) * 0.5;
    for (const [x, y] of heart) {
      const k = (y - heartTop) / (heartBottom - heartTop);
      let i = Math.max(0, Math.min(HEART.length - 1, Math.floor(k * HEART.length + pulse)));
      if (x >= 5 && x <= 8 && y >= heartTop + 2 && y <= heartTop + 5) i = 0;   // shine
      cells.set(`${x},${y}`, HEART[i]);
    }
    // a dark outline around everything
    for (const key of cells.keys()) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = `${x + dx},${y + dy}`;
        if (!cells.has(n) && x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) ctx.fillStyle = OUTLINE, ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    }
    for (const [key, col] of cells) { const [x, y] = key.split(','); ctx.fillStyle = col; ctx.fillRect(+x, +y, 1, 1); }
    void isHeart;
  };

  let last = 0;
  const loop = now => {
    if (!c.isConnected && last) return;   // gone from the page: stop
    if (now - last > 90) { t += 0.09 * 1.6; draw(); last = now; }
    requestAnimationFrame(loop);
  };
  draw();
  requestAnimationFrame(loop);
  return c;
}

/** Embers that drift up behind the logo. */
export function logoEmbers(count = 14) {
  return h('div.logo-embers', ...Array.from({ length: count }, (_, i) => h('i', { style: {
    left: `${8 + Math.random() * 84}%`, animationDelay: `${(i / count) * 4}s`, animationDuration: `${3 + Math.random() * 2.5}s`,
    '--drift': `${(Math.random() - 0.5) * 60}px`, '--s': `${2 + Math.round(Math.random() * 3)}px`,
  } })));
}
