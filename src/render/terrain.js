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
    this.overview = this.paint(0, 0, world.w, world.h, Math.min(OVERVIEW_PPT, Math.floor(2400 / world.w)));   // bigger worlds: a smaller overview, easy on phones
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
   * Borders are "chamfered" pixel edges: each terrain's shape is closed then opened with a diamond
   * so every corner is cut at 45° (a quarter tile deep), then outlined with a dark one-pixel rim.
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

    // edge "pixels" per tile: 4 screen pixels each in detailed chunks, matching the tile art's pixel size
    const B = p >= 48 ? 16 : 4;
    const R = B / 4;                       // chamfer: corners are cut a quarter of a tile deep, at 45°
    const MWB = W * B, MHB = H * B;
    // work area has a one-tile margin, so corners next to a chunk border match the neighbouring chunk
    const AW = MWB + 2 * B, AH = MHB + 2 * B;
    const work = new Uint8Array(AW * AH), tmp = new Uint8Array(AW * AH), dist = new Float32Array(AW * AH);
    const mask = document.createElement('canvas');
    mask.width = MWB; mask.height = MHB;
    const mctx = mask.getContext('2d');
    const rim = document.createElement('canvas');
    rim.width = MWB; rim.height = MHB;
    const rctx = rim.getContext('2d');
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
    const lctx = layerCanvas.getContext('2d');

    // grow (value 1) or shrink (value 0) the shape in `a` by r pixels, diamond-shaped (city-block distance)
    const morph = (a, out, r, grow) => {
      const INF = 1e6, want = grow ? 1 : 0;
      for (let i = 0; i < a.length; i++) dist[i] = a[i] === want ? 0 : INF;
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const i = y * AW + x;
        let v = dist[i];
        if (x > 0 && dist[i - 1] + 1 < v) v = dist[i - 1] + 1;
        if (y > 0 && dist[i - AW] + 1 < v) v = dist[i - AW] + 1;
        dist[i] = v;
      }
      for (let y = AH - 1; y >= 0; y--) for (let x = AW - 1; x >= 0; x--) {
        const i = y * AW + x;
        let v = dist[i];
        if (x < AW - 1 && dist[i + 1] + 1 < v) v = dist[i + 1] + 1;
        if (y < AH - 1 && dist[i + AW] + 1 < v) v = dist[i + AW] + 1;
        dist[i] = v;
      }
      for (let i = 0; i < a.length; i++) out[i] = dist[i] <= r ? want : 1 - want;
    };

    // mask for everything at or above layer L, with chamfered corners; `reach` widens it (shallow water)
    const buildMask = (L, reach, withRim) => {
      let any = false;
      for (let ty = -1; ty <= H; ty++) for (let tx = -1; tx <= W; tx++) {
        const on = L_at(tx, ty) >= L ? 1 : 0;
        if (on && tx >= 0 && ty >= 0 && tx < W && ty < H) any = true;
        const ax = (tx + 1) * B, ay = (ty + 1) * B;
        for (let by = 0; by < B; by++) work.fill(on, (ay + by) * AW + ax, (ay + by) * AW + ax + B);
      }
      if (!any && !reach) return false;
      // close then open: fills inside corners and cuts outside corners, both at 45°
      morph(work, tmp, R, true); morph(tmp, work, R, false);
      morph(work, tmp, R, false); morph(tmp, work, R, true);
      if (reach) { morph(work, tmp, Math.round(reach * B), true); work.set(tmp); }

      const img = mctx.createImageData(MWB, MHB), d = img.data;
      const rimImg = withRim ? rctx.createImageData(MWB, MHB) : null, rd = rimImg?.data;
      let painted = false;
      for (let y = 0; y < MHB; y++) for (let x = 0; x < MWB; x++) {
        const i = (y + B) * AW + x + B;
        if (!work[i]) continue;
        painted = true;
        const o = (y * MWB + x) * 4;
        d[o + 3] = 255;
        // rim = on-pixels touching an off pixel (the outer edge of this terrain)
        if (rd && (!work[i - 1] || !work[i + 1] || !work[i - AW] || !work[i + AW])) rd[o + 3] = 255;
      }
      if (!painted) return false;
      mctx.putImageData(img, 0, 0);
      if (rimImg) rctx.putImageData(rimImg, 0, 0);
      return true;
    };

    // paint a fill through a mask canvas (pixel-sharp), optionally only inside some tiles
    const paintMasked = (fill, m = mask, tiles = null) => {
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      lctx.fillStyle = fill;
      if (tiles) for (const [tx, ty] of tiles) lctx.fillRect(tx * p, ty * p, p, p);
      else lctx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
      lctx.globalCompositeOperation = 'destination-in';
      lctx.imageSmoothingEnabled = false;
      lctx.drawImage(m, 0, 0, layerCanvas.width, layerCanvas.height);
      ctx.drawImage(layerCanvas, 0, 0);
    };

    for (const L of layers.slice(1)) {
      // shallow water: a paler dithered band where the first land meets the sea
      if (L === WATER_LAYERS && buildMask(L, 0.25, false)) {
        ctx.globalAlpha = 0.3;
        paintMasked('#9fe3ee');
        ctx.globalAlpha = 1;
      }
      const land = L >= WATER_LAYERS;
      if (!buildMask(L, 0, land)) continue;
      paintMasked(pattern(LAYERS[L][0]));
      // other keys sharing this layer (flowers on grass) keep their own texture inside their tiles, cut to the same edge
      for (const other of LAYERS[L].slice(1)) {
        const tiles = [];
        for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (this.key(tx0 + tx, ty0 + ty) === other) tiles.push([tx, ty]);
        if (tiles.length) paintMasked(pattern(other), mask, tiles);
      }
      // a darker one-pixel rim gives land a crisp hand-pixelled outline
      if (land) {
        ctx.globalAlpha = 0.45;
        paintMasked('#1a0f08', rim);
        ctx.globalAlpha = 1;
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
