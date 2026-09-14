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

  /**
   * Paint tiles [tx0,tx1)×[ty0,ty1) at p pixels per tile into a new canvas.
   * Borders are ragged pixel fringes: every tile is split into 8×8 "pixels", and pixels just outside
   * a higher terrain join it depending on distance plus noise — a dithered, hand-pixelled edge.
   */
  paint(tx0, ty0, tx1, ty1, p) {
    const W = tx1 - tx0, H = ty1 - ty0;
    const canvas = document.createElement('canvas');
    canvas.width = W * p;
    canvas.height = H * p;
    const ctx = canvas.getContext('2d');
    const pattern = key => ctx.createPattern(this.tileCanvas(key, p), 'repeat');

    // layer of every tile (with a one-tile margin, since neighbours spill in)
    const MW = W + 2;
    const layerAt = new Int8Array(MW * (H + 2));
    const present = new Set();
    for (let ty = -1; ty <= H; ty++) for (let tx = -1; tx <= W; tx++) {
      const l = LAYER_OF[this.key(tx0 + tx, ty0 + ty)] ?? 0;
      layerAt[(ty + 1) * MW + tx + 1] = l;
      if (tx >= 0 && ty >= 0 && tx < W && ty < H) present.add(l);
      else if (tx >= -1 && ty >= -1) present.add(l);
    }
    const L_at = (tx, ty) => layerAt[(ty + 1) * MW + tx + 1];
    const layers = [...present].sort((a, b) => a - b);

    ctx.fillStyle = pattern(LAYERS[layers[0]][0]);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // fringe "pixels" per tile: 4 screen pixels each in detailed chunks, matching the tile art's pixel size
    const B = p >= 48 ? 16 : 8;
    const MWB = W * B, MHB = H * B;
    const mask = document.createElement('canvas');
    mask.width = MWB; mask.height = MHB;
    const mctx = mask.getContext('2d');
    const rim = document.createElement('canvas');
    rim.width = MWB; rim.height = MHB;
    const rctx = rim.getContext('2d');
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
    const lctx = layerCanvas.getContext('2d');
    const bits = new Uint8Array(MWB * MHB);
    const edgeTile = new Uint8Array(W * H);
    const noiseScale = 4 / B;   // same world-size noise at any resolution

    // build a fringe mask for everything at or above layer L; `reach` widens it (for shallow water)
    const buildMask = (L, reach, withRim) => {
      bits.fill(0);
      edgeTile.fill(0);
      let any = false;
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
        const row0 = ty * B * MWB;
        if (L_at(tx, ty) >= L) {
          any = true;
          for (let by = 0; by < B; by++) bits.fill(1, row0 + by * MWB + tx * B, row0 + by * MWB + tx * B + B);
          continue;
        }
        // neighbours at or above L (only edge tiles need per-pixel work)
        const nb = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && L_at(tx + dx, ty + dy) >= L) nb.push(dx, dy);
        if (!nb.length) continue;
        any = true;
        edgeTile[ty * W + tx] = 1;
        for (let by = 0; by < B; by++) for (let bx = 0; bx < B; bx++) {
          const u = (bx + 0.5) / B, v = (by + 0.5) / B;
          let dist = 9;
          for (let i = 0; i < nb.length; i += 2) {
            const dx = nb[i], dy = nb[i + 1];
            const ex = dx < 0 ? u : dx > 0 ? 1 - u : 0;
            const ey = dy < 0 ? v : dy > 0 ? 1 - v : 0;
            const dd = Math.max(ex, ey) * 0.55 + Math.hypot(ex, ey) * 0.45;   // squarish, not round
            if (dd < dist) dist = dd;
          }
          const wx = (tx0 + tx) * B + bx, wy = (ty0 + ty) * B + by;
          const n = vnoise(wx * noiseScale * 0.09, wy * noiseScale * 0.09, L * 13) * 0.7 + vnoise(wx * noiseScale * 0.3, wy * noiseScale * 0.3, L * 7) * 0.3;
          if (dist < 0.08 + reach + 0.22 * n) bits[row0 + by * MWB + tx * B + bx] = 1;
        }
      }
      if (!any) return false;

      // tidy the edge: no lone specks, no one-pixel holes (those read as dirt/noise)
      for (let pass = 0; pass < 3; pass++) {
        for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
          if (!edgeTile[ty * W + tx]) continue;
          for (let y = ty * B; y < (ty + 1) * B; y++) for (let x = tx * B; x < (tx + 1) * B; x++) {
            const i = y * MWB + x;
            const n = (x > 0 ? bits[i - 1] : 1) + (x < MWB - 1 ? bits[i + 1] : 1) + (y > 0 ? bits[i - MWB] : 1) + (y < MHB - 1 ? bits[i + MWB] : 1);
            if (bits[i] && n <= 1) bits[i] = 0;
            else if (!bits[i] && n >= 3) bits[i] = 1;
          }
        }
      }

      const img = mctx.createImageData(MWB, MHB), d = img.data;
      const rimImg = withRim ? rctx.createImageData(MWB, MHB) : null, rd = rimImg?.data;
      for (let i = 0; i < bits.length; i++) {
        if (!bits[i]) continue;
        d[i * 4 + 3] = 255;
        if (!rd) continue;
        const x = i % MWB, y = (i / MWB) | 0;
        // rim = on-pixels touching an off pixel (outer edge of this terrain)
        if ((x > 0 && !bits[i - 1]) || (x < MWB - 1 && !bits[i + 1]) || (y > 0 && !bits[i - MWB]) || (y < MHB - 1 && !bits[i + MWB])) rd[i * 4 + 3] = 255;
      }
      mctx.putImageData(img, 0, 0);
      if (rimImg) rctx.putImageData(rimImg, 0, 0);
      return true;
    };

    // paint a fill through a mask canvas (pixel-sharp)
    const paintMasked = (fill, m = mask) => {
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      lctx.fillStyle = fill;
      lctx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
      lctx.globalCompositeOperation = 'destination-in';
      lctx.imageSmoothingEnabled = false;
      lctx.drawImage(m, 0, 0, layerCanvas.width, layerCanvas.height);
      ctx.drawImage(layerCanvas, 0, 0);
    };

    for (const L of layers.slice(1)) {
      // shallow water: a paler dithered band where the first land meets the sea
      if (L === WATER_LAYERS && buildMask(L, 0.3, false)) {
        ctx.globalAlpha = 0.35;
        paintMasked('#9fe3ee');
        ctx.globalAlpha = 1;
      }
      const land = L >= WATER_LAYERS;
      if (!buildMask(L, 0, land)) continue;
      paintMasked(pattern(LAYERS[L][0]));
      // a darker one-pixel rim gives land a crisp hand-pixelled outline
      if (land) {
        ctx.globalAlpha = 0.38;
        paintMasked('#1a0f08', rim);
        ctx.globalAlpha = 1;
      }
      // other keys sharing this layer (flowers on grass) keep their own texture inside their tiles
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

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
