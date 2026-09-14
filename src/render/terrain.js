import { TILE } from '../core/constants.js';
import { sprite, spriteVersion } from '../core/assets.js';
import { TILES } from '../game/world.js';

/*
 * Terrain is painted into cached canvases with soft, rounded borders between tile types
 * (instead of hard squares). Terrains are layered from lowest to highest priority; each
 * layer fills the union of its tiles grown into slightly bigger, rounded, wobbly blobs, so
 * higher ground spills naturally over lower ground and every corner comes out round.
 * A low-res overview covers the whole island for zoomed-out views; detailed chunks are
 * painted on demand when zoomed in.
 */

// draw order: higher layers spill over lower ones. Keys in the same layer don't blend.
const LAYERS = [
  ['tile_deep_water'], ['tile_water'], ['tile_lava'], ['tile_cave_floor'], ['tile_stone_path'], ['tile_tilled_soil'],
  ['tile_swamp'], ['tile_dirt'], ['tile_sand'], ['tile_snow'], ['tile_grass', 'tile_grass_flowers'],
];
const LAYER_OF = Object.fromEntries(LAYERS.flatMap((keys, i) => keys.map(k => [k, i])));
const WATER_LAYERS = 2;     // layers below this are water

const CHUNK = 12;           // tiles per detailed chunk
const DETAIL_PPT = 64;      // pixels per tile in detailed chunks
const OVERVIEW_PPT = 24;    // pixels per tile in the whole-map overview
const MAX_CHUNKS = 36;
const CHUNKS_PER_FRAME = 2;

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export class TerrainPainter {
  constructor() {
    this.world = null;
    this.version = -1;
    this.chunks = new Map();   // "cx,cy" -> { canvas, used }
    this.overview = null;
    this.patterns = new Map(); // "key@ppt" -> canvas tile used as a fill pattern
  }

  reset(world) {
    this.world = world;
    this.version = world.version;
    this.sprites = spriteVersion();
    this.patterns.clear();
    this.chunks.clear();
    this.overview = this.paint(0, 0, world.w, world.h, OVERVIEW_PPT);
  }

  /** Draw visible terrain in world coordinates. pxPerTile = on-screen device pixels per tile. */
  draw(ctx, world, view, pxPerTile) {
    if (world !== this.world || world.version !== this.version || spriteVersion() !== this.sprites) this.reset(world);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.overview, 0, 0, world.w * TILE, world.h * TILE);
    if (pxPerTile > OVERVIEW_PPT * 1.6) {
      ctx.imageSmoothingEnabled = pxPerTile < DETAIL_PPT * 1.5;
      let painted = 0;
      const cx0 = Math.max(0, Math.floor(view.x0 / CHUNK)), cy0 = Math.max(0, Math.floor(view.y0 / CHUNK));
      const cx1 = Math.min(Math.ceil(world.w / CHUNK) - 1, Math.floor(view.x1 / CHUNK));
      const cy1 = Math.min(Math.ceil(world.h / CHUNK) - 1, Math.floor(view.y1 / CHUNK));
      const now = performance.now();
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const key = `${cx},${cy}`;
          let c = this.chunks.get(key);
          if (!c) {
            if (painted >= CHUNKS_PER_FRAME) continue;   // overview stands in until it's ready
            painted++;
            const tx1 = Math.min(world.w, (cx + 1) * CHUNK), ty1 = Math.min(world.h, (cy + 1) * CHUNK);
            c = { canvas: this.paint(cx * CHUNK, cy * CHUNK, tx1, ty1, DETAIL_PPT) };
            this.chunks.set(key, c);
            this.evict();
          }
          c.used = now;
          const cvs = c.canvas;
          ctx.drawImage(cvs, cx * CHUNK * TILE, cy * CHUNK * TILE, cvs.width / DETAIL_PPT * TILE, cvs.height / DETAIL_PPT * TILE);
        }
      }
    }
    ctx.restore();
  }

  evict() {
    if (this.chunks.size <= MAX_CHUNKS) return;
    const oldest = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.chunks.size - MAX_CHUNKS);
    for (const [k] of oldest) this.chunks.delete(k);
  }

  key(tx, ty) { return TILES[this.world.tile(tx, ty)]; }

  /** One tile of texture at p×p (edges cropped: AI tiles have faint borders), for pattern fills. */
  tileCanvas(key, p) {
    const id = `${key}@${p}`;
    let c = this.patterns.get(id);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = p;
    const s = sprite(`nature/${key}`);
    if (s) {
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const inset = s.img.width * 0.025;
      g.drawImage(s.img, inset, inset, s.img.width - inset * 2, s.img.height - inset * 2, 0, 0, p, p);
    }
    this.patterns.set(id, c);
    return c;
  }

  /** Paint tiles [tx0,tx1)×[ty0,ty1) at p pixels per tile into a new canvas. */
  paint(tx0, ty0, tx1, ty1, p) {
    const canvas = document.createElement('canvas');
    canvas.width = (tx1 - tx0) * p;
    canvas.height = (ty1 - ty0) * p;
    const ctx = canvas.getContext('2d');
    const pattern = key => ctx.createPattern(this.tileCanvas(key, p), 'repeat');

    // which layers appear here (with a margin, since neighbours spill in)
    const layer = new Map();
    for (let ty = ty0 - 1; ty <= ty1; ty++) for (let tx = tx0 - 1; tx <= tx1; tx++) layer.set(`${tx},${ty}`, LAYER_OF[this.key(tx, ty)] ?? 0);
    const present = [...new Set(layer.values())].sort((a, b) => a - b);

    // lowest layer fills everything
    ctx.fillStyle = pattern(LAYERS[present[0]][0]);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const L of present.slice(1)) {
      // each tile at or above this layer: a slightly rounded core, and on every side that faces
      // lower ground a trail of small circles that shrink as they spill outward
      ctx.beginPath();
      const circle = (cx, cy, r) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); };
      for (let ty = ty0 - 1; ty <= ty1; ty++) for (let tx = tx0 - 1; tx <= tx1; tx++) {
        if (layer.get(`${tx},${ty}`) < L) continue;
        const x = (tx - tx0) * p, y = (ty - ty0) * p;
        ctx.rect(x - 0.5, y - 0.5, p + 1, p + 1);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if ((layer.get(`${tx + dx},${ty + dy}`) ?? 0) >= L) continue;
          const n = 9;
          for (let i = 0; i < n; i++) {
            const along = (i + 0.2 + hash(tx, ty, 40 + i * 4 + dx * 2 + dy) * 0.6) / n;   // position along the edge
            const out = Math.pow(hash(tx, ty, 90 + i * 4 + dx * 3 + dy * 5), 1.8) * 0.42;    // how far it trails
            const r = p * Math.max(0.035, 0.22 * (1 - out / 0.5) * (0.65 + 0.35 * hash(tx, ty, 140 + i)));
            const ex = dx ? (dx > 0 ? 1 + out : -out) : along;
            const ey = dy ? (dy > 0 ? 1 + out : -out) : along;
            circle(x + ex * p, y + ey * p, r);
          }
          // a few tiny stray dots further out complete the trail
          for (let i = 0; i < 3; i++) {
            const along = hash(tx, ty, 200 + i * 7 + dx + dy * 3);
            const out = 0.4 + hash(tx, ty, 230 + i * 5 + dx * 2 + dy) * 0.25;
            const ex = dx ? (dx > 0 ? 1 + out : -out) : along, ey = dy ? (dy > 0 ? 1 + out : -out) : along;
            circle(x + ex * p, y + ey * p, p * (0.025 + 0.03 * hash(tx, ty, 260 + i)));
          }
        }
      }
      // shallow water glow where land meets water: a soft rim drawn just before the first land layer
      if (L === WATER_LAYERS) {
        ctx.save();
        ctx.shadowColor = 'rgba(200,250,255,0.55)';
        ctx.shadowBlur = p * 0.6;
        ctx.fillStyle = 'rgba(160,230,245,0.5)';
        ctx.fill('nonzero');
        ctx.restore();
      }
      ctx.fillStyle = pattern(LAYERS[L][0]);
      ctx.fill('nonzero');
      // other keys sharing this layer (flowers on grass) are painted as plain tiles
      for (const other of LAYERS[L].slice(1)) {
        const fill = pattern(other);
        for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
          if (this.key(tx, ty) !== other) continue;
          ctx.fillStyle = fill;
          ctx.fillRect((tx - tx0) * p, (ty - ty0) * p, p, p);
        }
      }
    }
    return canvas;
  }
}
