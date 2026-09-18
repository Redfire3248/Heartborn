import { PETS } from '../game/pets.js';
import { titleOf } from '../game/journal.js';
import { keyLabel, keyOf } from '../core/controls.js';
import { specialDrop } from '../game/forging.js';
import { nearestStation } from '../game/crafting.js';
import { TILE } from '../core/constants.js';
import { RES_ICON } from '../ui/dom.js';
import { stackIcon } from '../game/groundItems.js';
import { drawSprite, sprite } from '../core/assets.js';
import { BOATS, fleetOf } from '../game/sailing.js';
import { TerrainPainter } from './terrain.js';
import { OBJECTS, CREATURES, villagerSprite } from '../data/objects.js';
import { BUILDINGS, sizeOf, buildingSprite } from '../data/buildings.js';
import { displayRole, toolFor, carryIcon, heldItem } from '../game/villagers.js';
import { speedMult, bodyWorkMult } from '../game/body.js';
import { FIND_KINDS } from '../game/finds.js';
import { ITEMS } from '../data/people.js';
import { heroWeapon, rpgOf, WEAPONS, SHIELDS, RARITY } from '../game/rpg.js';
import { gearIconKey, hasArt } from './gearArt.js';
import { avatarId, avatarArt } from '../game/avatars.js';
import { trapUp } from '../game/dungeon.js';
import { DESIGNS, doorOf, isHome, builderOf } from '../game/houses.js';
import { TOOLS, lightBonus, heldSlot, hasTool as hasToolG, heroLight } from '../game/tools.js';
import { CONSUMABLES } from '../game/consumables.js';
import { SHOTS, maxHp } from '../game/creatures.js';
import { spriteAvailable, spriteVersion } from '../core/assets.js';
import { T } from '../game/world.js';

// hero frames leave room around the figure for swings and dashes: draw them bigger so the hero stands as tall as villagers
const HERO_SCALE = 1.55;

const SEASON_TINT = { Spring: null, Summer: 'rgba(255,220,120,0.05)', Autumn: 'rgba(255,140,40,0.08)', Winter: 'rgba(180,210,255,0.14)' };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.camera = { x: 0, y: 0, zoom: 2 };
    this.time = 0;
    this.hoverTile = null;
    this.ghost = null;          // { type, tx, ty, ok }
    this.weather = [];
    this.terrain = new TerrainPainter();
    this.resize();
    // phones fire resize constantly while the address bar slides; resizing a canvas wipes it, which flickers.
    // Coalesce into one resize per frame, and only when the pixel size really changed.
    let queued = false;
    const onResize = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; this.resize(); });
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
  }

  resize() {
    // phones have 3x screens: drawing that many pixels every frame is slow and hot, and looks no better on pixel art
    const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
    const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const w = Math.floor(cssW * dpr), h = Math.floor(cssH * dpr);
    this.dpr = dpr;
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.light.width = w;
    this.light.height = h;
    this.lastGame && this.render(this.lastGame, 0);   // repaint right away so no blank frame shows
  }

  get scale() { return this.camera.zoom * this.dpr; }

  screenToWorld(sx, sy) {
    const s = this.scale;
    return {
      x: (sx * this.dpr - this.canvas.width / 2) / s + this.camera.x,
      y: (sy * this.dpr - this.canvas.height / 2) / s + this.camera.y,
    };
  }

  worldToScreen(wx, wy) {
    const s = this.scale;
    return { x: ((wx - this.camera.x) * s + this.canvas.width / 2) / this.dpr, y: ((wy - this.camera.y) * s + this.canvas.height / 2) / this.dpr };
  }

  render(g, dt) {
    this.time += dt;
    this.lastGame = g;
    const { ctx, canvas } = this;
    const s = this.scale;
    const W = canvas.width, H = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = g.dungeon ? '#07060a' : '#0d2a4a';
    ctx.fillRect(0, 0, W, H);

    const shake = g.fx.shake > 0 ? g.fx.shake * 3 : 0;
    const ox = W / 2 - this.camera.x * s + (Math.random() - 0.5) * shake * this.dpr;
    const oy = H / 2 - this.camera.y * s + (Math.random() - 0.5) * shake * this.dpr;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    // downscaling hi-res art looks best smoothed; zoomed way in, keep it crisp
    ctx.imageSmoothingEnabled = TILE * s < 110;
    ctx.imageSmoothingQuality = 'high';

    const view = {
      x0: Math.floor((-ox / s) / TILE) - 2, y0: Math.floor((-oy / s) / TILE) - 2,
      x1: Math.ceil(((W - ox) / s) / TILE) + 2, y1: Math.ceil(((H - oy) / s) / TILE) + 3,
    };

    if (g.dungeon) this.drawDungeonFloor(g, view);   // its own square rooms (the painter rounds corners into water)
    else this.drawTerrain(g, view);
    this.drawBridges(g);
    this.drawGroundMarks(g, view);

    // y-sorted scene
    const items = [];
    const inView = (x, y) => x >= (view.x0 - 2) * TILE && x <= (view.x1 + 2) * TILE && y >= view.y0 * TILE && y <= (view.y1 + 3) * TILE;
    for (const o of g.state.objects) {
      const x = o.x * TILE + TILE / 2, y = o.y * TILE + TILE * 0.9;
      if (inView(x, y)) items.push({ y, draw: () => this.drawObject(o, x, y) });
    }
    for (const b of g.state.buildings) {
      const size = sizeOf(b);
      const x = (b.tx + size / 2) * TILE, y = (b.ty + size) * TILE - 2;
      if (inView(x, y)) items.push({ y, draw: () => this.drawBuilding(g, b, x, y) });
    }
    for (const c of g.state.creatures) {
      if (inView(c.x, c.y)) items.push({ y: c.y + (CREATURES[c.t]?.flying ? 40 : 0), draw: () => { this.drawCreature(g, c); this.drawStatus(g, c); } });
    }
    for (const v of g.state.villagers) {
      if (!v.away && inView(v.x, v.y)) items.push({ y: v.y, draw: () => this.drawVillager(g, v) });
    }
    // strangers from other lands (visitors, spies dressed as travellers), gliding to where they really are
    if (g.petBody && !g.visiting) { const pb = g.petBody; if (inView(pb.x, pb.y)) items.push({ y: pb.y, draw: () => this.drawPet(pb) }); }
    for (const st of g.strangers || []) {
      st.x += (st.tx - st.x) * Math.min(1, dt * 8); st.y += (st.ty - st.y) * Math.min(1, dt * 8);
      if (inView(st.x, st.y)) items.push({ y: st.y, draw: () => this.drawStranger(g, st) });
    }
    if (!g.visiting) {   // treasure chests, opened chests fading away, and hearts and potions to grab
      for (const ch of g.state.chests || []) if (inView(ch.x, ch.y)) items.push({ y: ch.y, draw: () => this.drawChest(ch) });
      for (const ch of g.openedChests || []) { ch.life -= dt; if (ch.life > 0 && inView(ch.x, ch.y)) items.push({ y: ch.y, draw: () => this.drawChest(ch, true) }); }
      if (g.openedChests?.length) g.openedChests = g.openedChests.filter(c => c.life > 0);
      for (const p of g.pickups || []) if (inView(p.x, p.y)) items.push({ y: p.y, draw: () => this.drawPickup(p) });
    }
    if (!g.visiting && !g.dungeon) for (const e of g.state.dungeons || []) if (inView(e.x, e.y)) items.push({ y: e.y, draw: () => this.drawCaveMouth(g, e) });
    if (g.dungeon) {
      const d = g.dungeon;
      for (const t of d.torches) if (inView(t.x, t.y)) items.push({ y: t.y - TILE, draw: () => this.drawTorch(t) });
      if (hasArt('dungeon/bones')) for (const p of d.props || []) if (inView(p.x, p.y)) items.push({ y: ['puddle', 'floor_grate', 'bones', 'rubble', 'cobweb'].includes(p.kind) ? p.y - TILE * 2 : p.y, draw: () => drawSprite(this.ctx, `dungeon/${p.kind}`, p.x, p.y + TILE * 0.35, TILE * ({ pillar: 1.3, cage: 1.1, chains: 1.1, altar: 1.3, glow_crystal: 0.9, cobweb: 1 }[p.kind] || 0.8), { flip: p.flip }) });
      if (d.key) items.push({ y: d.key.y, draw: () => this.drawKey(d.key) });
    }
    for (const t of g.state.torches || []) if (inView(t.x, t.y)) items.push({ y: t.y, draw: () => this.drawPlacedTorch(g, t) });
    if (!g.visiting) for (const it of g.state.groundItems || []) {
      if (inView(it.x, it.y)) items.push({ y: it.y, draw: () => this.drawGroundItem(it) });
    }
    if (!g.visiting) for (const f of g.state.finds || []) {
      if (inView(f.x, f.y)) items.push({ y: f.y, draw: () => this.drawFind(g, f) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    this.drawSea(g);
    this.drawGhost(g);
    this.drawShots(g);
    this.drawBolts(g, dt);
    if (g.fx.flashes?.length) {   // ability bursts
      const { ctx } = this;
      for (const f of g.fx.flashes) {
        f.life -= dt;
        const k = Math.max(0, f.life / f.max), r = f.r * (1.1 - k * 0.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        gr.addColorStop(0, f.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = k * 0.8; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      g.fx.flashes = g.fx.flashes.filter(f => f.life > 0);
    }
    this.drawParticles(g);
    this.drawBeams(g);
    this.drawStrikes(g);
    this.drawLighting(g, ox, oy, s);
    if (!g.dungeon) this.drawWeather(g, dt);

    // screen-space overlays
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBubbles(g, ox, oy, s);
    this.drawFloaters(g, ox, oy, s);
    this.drawEnemyMarkers(g, ox, oy, s);
  }

  drawTerrain(g, view) {
    this.terrain.draw(this.ctx, g.world, view, TILE * this.scale);
  }

  /** Wooden bridges from the coast towards neighbouring lands (pixel planks, rails and posts). */
  drawBridges(g) {
    const bridges = g.visiting ? null : g.bridges;
    if (!bridges?.length) return;
    const { ctx } = this;
    const P = TILE / 8;   // one "art pixel"
    for (const b of bridges) {
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * TILE;
      ctx.save();
      ctx.translate(b.x0 * TILE, b.y0 * TILE);
      ctx.rotate(b.angle);
      const hot = this.hoverBridge === b;
      // shadow on the water
      ctx.fillStyle = 'rgba(0,20,40,0.35)';
      ctx.fillRect(0, -3 * P, len, 8 * P);
      // planks
      for (let x = 0, i = 0; x < len; x += 2 * P, i++) {
        ctx.fillStyle = i % 3 === 0 ? '#8a5a32' : i % 3 === 1 ? '#9c6a3c' : '#7d5230';
        ctx.fillRect(x, -4 * P, 2 * P - 1, 8 * P);
      }
      // rails and posts
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(0, -5 * P, len, P);
      ctx.fillRect(0, 4 * P, len, P);
      for (let x = 0; x < len; x += 6 * P) { ctx.fillRect(x, -6 * P, P * 1.5, 2 * P); ctx.fillRect(x, 4 * P, P * 1.5, 2 * P); }
      if (hot) { ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.5; ctx.strokeRect(-P, -6.5 * P, len + 2 * P, 13 * P); }
      // flag at the far end in the neighbour's colour
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(len - 2 * P, -12 * P, P, 8 * P);
      ctx.fillStyle = b.online ? '#ffcf5a' : '#9b8fae';
      ctx.fillRect(len - P, -12 * P, 4 * P, 3 * P);
      ctx.restore();
    }
  }

  drawGroundMarks(g, view) {
    const { ctx } = this;
    if (this.hoverTile && !this.ghost) {
      ctx.strokeStyle = 'rgba(255,240,200,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.hoverTile.tx * TILE + 0.5, this.hoverTile.ty * TILE + 0.5, TILE - 1, TILE - 1);
    }
    const sel = g.selected;
    if (sel) {
      const p = selectionPos(g, sel);
      if (p) {
        const pulse = 1 + Math.sin(this.time * 5) * 0.08;
        ctx.strokeStyle = '#ffd76a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * pulse, p.r * 0.45 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ------------------------------------------------------------ dungeons (drawn in code, no art needed)
  /** Rock walls with a lit brick face, locked doors, stairs and spike traps. */
  drawDungeonFloor(g, view) {
    const { ctx } = this;
    const w = g.world, d = g.dungeon, P = TILE / 8;
    // the maze itself never changes (until the boss door opens): paint it once, then just copy it each frame
    if (this._dungeonCache?.world !== w || this._dungeonCache.version !== w.version || this._dungeonCache.sprites !== spriteVersion()) this._dungeonCache = this.paintDungeon(g);
    const cache = this._dungeonCache;
    const x0 = Math.max(0, view.x0), y0 = Math.max(0, view.y0), x1 = Math.min(w.w, view.x1 + 1), y1 = Math.min(w.h, view.y1 + 1);
    if (x1 > x0 && y1 > y0) {
      const k = cache.ppt;
      ctx.drawImage(cache.canvas, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0 * TILE, y0 * TILE, (x1 - x0) * TILE, (y1 - y0) * TILE);
    }
    const stairs = (p, down) => {
      const X = p.x - TILE * 0.75, Y = p.y - TILE * 0.75, S = TILE * 1.5;
      if (hasArt(down ? 'dungeon/stairs_down' : 'dungeon/stairs_up')) { drawSprite(ctx, down ? 'dungeon/stairs_down' : 'dungeon/stairs_up', p.x, p.y, S, { center: true, full: true }); return; }
      ctx.fillStyle = down ? '#0b0910' : '#3c3548'; ctx.fillRect(X, Y, S, S);
      for (let i = 0; i < 5; i++) {
        const k = down ? i : 4 - i;
        ctx.fillStyle = `rgb(${70 + k * 18},${62 + k * 16},${84 + k * 16})`;
        ctx.fillRect(X + (down ? i * S * 0.06 : 0), Y + i * S / 5, S - (down ? i * S * 0.12 : 0), S / 5 - P * 0.4);
      }
      const bob = Math.sin(this.time * 4) * 2;
      ctx.fillStyle = down ? '#ffcf5a' : '#9fe07a';
      ctx.beginPath();
      const ay = p.y - TILE * 1.2 + bob, dir = down ? 1 : -1;
      ctx.moveTo(p.x - 4, ay - 3 * dir); ctx.lineTo(p.x + 4, ay - 3 * dir); ctx.lineTo(p.x, ay + 4 * dir); ctx.fill();
    };
    stairs(d.exit, false);
    if (d.stairsDown) stairs(d.stairsDown, true);
    for (const t of d.traps) {
      const X = t.tx * TILE, Y = t.ty * TILE, up = trapUp(g, t);
      if (hasArt('dungeon/spikes_down')) { drawSprite(ctx, up ? 'dungeon/spikes_up' : 'dungeon/spikes_down', X + TILE / 2, Y + TILE / 2, TILE, { center: true, full: true }); continue; }
      ctx.fillStyle = '#2b2630'; ctx.fillRect(X + P, Y + P, 6 * P, 6 * P);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const sx = X + (2 + i * 2) * P, sy = Y + (2 + j * 2) * P;
        if (up) { ctx.fillStyle = '#c9c4d6'; ctx.beginPath(); ctx.moveTo(sx - P * 0.7, sy + P * 0.6); ctx.lineTo(sx + P * 0.7, sy + P * 0.6); ctx.lineTo(sx, sy - P * 1.6); ctx.fill(); }
        else { ctx.fillStyle = '#16131a'; ctx.fillRect(sx - P * 0.4, sy - P * 0.4, P * 0.8, P * 0.8); }
      }
    }
  }

  /** Floors, brick wall faces and the boss door, painted once at 24 pixels per tile. */
  paintDungeon(g) {
    const w = g.world, d = g.dungeon, ppt = 24;
    const canvas = document.createElement('canvas');
    canvas.width = w.w * ppt; canvas.height = w.h * ppt;
    const ctx = canvas.getContext('2d');
    const k = ppt / TILE;
    ctx.scale(k, k);
    const P = TILE / 8;
    const wall = (x, y) => w.tile(x, y) === T.deep_water;
    const doors = new Set(d.open ? [] : d.doors.map(p => `${p.x},${p.y}`));
    const isDoor = (x, y) => doors.has(`${x},${y}`);
    const floorTile = this.terrain.tileCanvas('tile_cave_floor', 64);
    const art = hasArt('dungeon/dungeon_floor_1') && hasArt('dungeon/wall_face_1');
    const tileArt = (key, X, Y, flip = false) => {
      const s = sprite(key);
      if (!s) return;
      const ix = s.box.w * 0.04, iy = s.box.h * 0.04;   // AI tiles have faint borders: crop them so no grid shows
      if (flip) { ctx.save(); ctx.translate(X + TILE, Y); ctx.scale(-1, 1); ctx.drawImage(s.img, s.box.x + ix, s.box.y + iy, s.box.w - ix * 2, s.box.h - iy * 2, -0.3, -0.3, TILE + 0.6, TILE + 0.6); ctx.restore(); return; }
      ctx.drawImage(s.img, s.box.x + ix, s.box.y + iy, s.box.w - ix * 2, s.box.h - iy * 2, X - 0.3, Y - 0.3, TILE + 0.6, TILE + 0.6);
    };
    const rnd = (x, y, k = 0) => { let n = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
    const openDoors = new Set(d.open ? d.doors.map(p => `${p.x},${p.y}`) : []);
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const X = x * TILE, Y = y * TILE;
        if (art) {   // the painted tiles, drawn so walls read as walls: tall lit faces, stone lips, a dark mass behind
          if (!wall(x, y)) {
            const f = rnd(x, y);
            tileArt(`dungeon/${f < 0.55 ? 'dungeon_floor_1' : f < 0.8 ? 'dungeon_floor_2' : f < 0.89 ? 'dungeon_floor_cracked' : f < 0.97 ? 'dungeon_floor_mossy' : 'dungeon_floor_rubble'}`, X, Y);
            ctx.fillStyle = 'rgba(12,8,22,0.22)'; ctx.fillRect(X, Y, TILE, TILE);   // floors a touch darker than walls
            if (openDoors.has(`${x},${y}`)) tileArt('dungeon/door_open', X, Y);
            // contact shadows: deep at the foot of a wall face, softer along side walls
            if (wall(x, y - 1)) { const gr = ctx.createLinearGradient(0, Y, 0, Y + TILE * 0.55); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(X, Y, TILE, TILE * 0.55); }
            if (wall(x - 1, y)) { const gr = ctx.createLinearGradient(X, 0, X + TILE * 0.35, 0); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(X, Y, TILE * 0.35, TILE); }
            if (wall(x + 1, y)) { const gr = ctx.createLinearGradient(X + TILE, 0, X + TILE * 0.65, 0); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(X + TILE * 0.65, Y, TILE * 0.35, TILE); }
            continue;
          }
          if (isDoor(x, y)) { tileArt('dungeon/door_closed', X, Y); continue; }
          const open = (xx, yy) => !wall(xx, yy) || isDoor(xx, yy);
          const floorBelow = open(x, y + 1);
          const floorTwoBelow = !floorBelow && open(x, y + 2);
          if (floorBelow || floorTwoBelow) {
            // a wall face two tiles tall: the lower tile is lit by the room, the upper falls into shade, a stone lip caps it
            const f = rnd(x, y, 1);
            tileArt(`dungeon/${f < 0.6 ? 'wall_face_1' : f < 0.85 ? 'wall_face_2' : 'wall_face_mossy'}`, X, Y);
            const gr = ctx.createLinearGradient(0, Y, 0, Y + TILE);
            if (floorBelow && wall(x, y - 1) && !open(x, y - 1)) { gr.addColorStop(0, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0.02)'); }
            else { gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); }
            ctx.fillStyle = gr; ctx.fillRect(X, Y, TILE, TILE);
            if (floorBelow) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X, Y + TILE - P * 0.5, TILE, P * 0.5); }   // where the wall meets the floor
            if (floorTwoBelow || open(x, y - 1)) {   // the top of the face: a stone lip catching the light
              ctx.fillStyle = '#6f667c'; ctx.fillRect(X, Y, TILE, P * 1.1);
              ctx.fillStyle = '#a097ae'; ctx.fillRect(X, Y, TILE, P * 0.35);
              ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(X, Y + P * 1.1, TILE, P * 0.3);
            }
            if (open(x - 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X, Y, P * 0.5, TILE); }
            if (open(x + 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(X + TILE - P * 0.5, Y, P * 0.5, TILE); }
            continue;
          }
          // the solid rock behind the walls: near black, with a lit stone lip wherever it meets the room
          ctx.fillStyle = '#0b0910'; ctx.fillRect(X - 0.5, Y - 0.5, TILE + 1, TILE + 1);
          const lip = (x0, y0, w0, h0, x1, y1, w1, h1) => { ctx.fillStyle = '#5a5266'; ctx.fillRect(x0, y0, w0, h0); ctx.fillStyle = '#8a80a0'; ctx.fillRect(x1, y1, w1, h1); };
          if (open(x - 1, y)) lip(X, Y, P * 0.9, TILE, X, Y, P * 0.3, TILE);
          if (open(x + 1, y)) lip(X + TILE - P * 0.9, Y, P * 0.9, TILE, X + TILE - P * 0.3, Y, P * 0.3, TILE);
          if (open(x, y - 1)) lip(X, Y, TILE, P * 0.9, X, Y, TILE, P * 0.3);
          // the rim continues round the corner where a side wall meets a face below
          if (!open(x, y + 1) && (open(x - 1, y + 1) || open(x + 1, y + 1) || open(x - 1, y + 2) || open(x + 1, y + 2))) { ctx.fillStyle = 'rgba(90,82,102,0.3)'; ctx.fillRect(X, Y + TILE - P * 0.6, TILE, P * 0.6); }
          continue;
        }
        if (!wall(x, y)) {
          ctx.drawImage(floorTile, X - 0.25, Y - 0.25, TILE + 0.5, TILE + 0.5);
          if (wall(x, y - 1)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X, Y, TILE, P * 1.2); }   // the wall's shadow
          continue;
        }
        if (isDoor(x, y)) {   // a heavy wooden door with iron bands and a golden lock
          ctx.fillStyle = '#5a3a1e'; ctx.fillRect(X, Y, TILE, TILE);
          ctx.fillStyle = '#6e4826'; for (let i = 0; i < 4; i++) ctx.fillRect(X + i * 2 * P + P * 0.3, Y, P * 1.4, TILE);
          ctx.fillStyle = '#3b3b44'; ctx.fillRect(X, Y + 1.5 * P, TILE, P); ctx.fillRect(X, Y + 5.5 * P, TILE, P);
          ctx.fillStyle = '#ffcf5a'; ctx.fillRect(X + 3 * P, Y + 3 * P, 2 * P, 2 * P);
          ctx.fillStyle = '#2a1a0a'; ctx.fillRect(X + 3.7 * P, Y + 3.6 * P, 0.6 * P, 1 * P);
          continue;
        }
        ctx.fillStyle = '#15121c'; ctx.fillRect(X - 0.5, Y - 0.5, TILE + 1, TILE + 1);
        if (!wall(x, y + 1) || isDoor(x, y + 1)) {   // the face you see from the room below: stone bricks
          ctx.fillStyle = '#4a4254'; ctx.fillRect(X, Y + 2 * P, TILE, 6 * P);
          ctx.fillStyle = '#3a3344';
          for (let row = 0; row < 3; row++) {
            ctx.fillRect(X, Y + (2 + row * 2) * P, TILE, P * 0.35);
            const off = (row + x) % 2 ? 0 : 4 * P;
            ctx.fillRect(X + off, Y + (2 + row * 2) * P, P * 0.35, 2 * P);
          }
          ctx.fillStyle = '#6a6076'; ctx.fillRect(X, Y + 2 * P, TILE, P * 0.5);
        } else if (!wall(x, y - 1) || !wall(x - 1, y) || !wall(x + 1, y)) {
          ctx.fillStyle = '#2a2433'; ctx.fillRect(X, Y, TILE, TILE);   // wall tops next to the floor
        }
      }
    }
    if (art) for (const web of d.webs || []) if (wall(web.tx, web.ty)) tileArt('dungeon/cobweb', web.tx * TILE, web.ty * TILE, web.flip);   // cobwebs in the top corners of rooms
    return { canvas, ppt, world: w, version: w.version, sprites: spriteVersion() };
  }

  /** Enemy shots (their art from Projectiles.png, or simple shapes until then) and slam warnings. */
  drawShots(g) {
    const { ctx } = this;
    for (const a of g.aoes || []) {   // a red circle fills up, then a shockwave where it lands
      const k = Math.min(1, a.t / a.delay);
      if (a.t < a.delay) {
        if (hasArt('combat/warning_circle')) drawSprite(ctx, 'combat/warning_circle', a.x, a.y, a.r * 2, { center: true, full: true, alpha: 0.6 + k * 0.4 });
        ctx.fillStyle = `rgba(255,50,40,${0.12 + k * 0.22})`;
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * k, a.r * 0.5 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,70,50,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r, a.r * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const e = (a.t - a.delay) / 0.35;
        if (hasArt('combat/shockwave')) drawSprite(ctx, 'combat/shockwave', a.x, a.y, a.r * 2 * (0.6 + e), { center: true, full: true, alpha: 1 - e });
        else { ctx.strokeStyle = `rgba(230,210,170,${1 - e})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * (0.6 + e * 0.6), a.r * 0.5 * (0.6 + e * 0.6), 0, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
    for (const sh of g.enemyShots || []) {
      const kind = SHOTS[sh.kind] || SHOTS.rock;
      const key = `combat/${sh.kind || 'rock'}`;
      const ang = Math.atan2(sh.vy, sh.vx);
      const size = TILE * kind.size;
      if (kind.glow) {
        const grad = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, size);
        grad.addColorStop(0, kind.glow); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55; ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sh.x, sh.y, size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      if (hasArt(key)) { drawSprite(ctx, key, sh.x, sh.y, size, { rot: kind.spin ? this.time * 12 : ang, center: true, full: true }); continue; }
      if (!sh.kind || sh.kind === 'rock' || sh.kind === 'boulder') { drawSprite(ctx, 'nature/rock', sh.x, sh.y + 4, size, { rot: this.time * 12 }); continue; }
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(ang);
      if (sh.kind === 'arrow' || sh.kind === 'bone_arrow' || sh.kind === 'throwing_knife') {
        ctx.fillStyle = sh.kind === 'throwing_knife' ? '#c8ccd8' : '#8a5a32'; ctx.fillRect(-size * 0.5, -1, size, 2);
        ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.moveTo(size * 0.5 + 4, 0); ctx.lineTo(size * 0.5 - 1, -3); ctx.lineTo(size * 0.5 - 1, 3); ctx.fill();
      } else {
        ctx.fillStyle = sh.kind === 'web_ball' ? '#f0f0f0' : kind.glow || '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-size * 0.08, -size * 0.08, size * 0.12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  /** One of your shots: bullets, lasers, rockets, magic, thrown weapons and bombs. */
  drawHeroShot(ar) {
    const { ctx } = this;
    const ang = Math.atan2(ar.vy, ar.vx);
    const art = { arrow: 'combat/arrow', bone_arrow: 'combat/bone_arrow', fireball: 'combat/fireball', ice_shard: 'combat/ice_shard', lightning_bolt: 'combat/lightning_bolt', magic_bolt: 'combat/magic_bolt', dark_orb: 'combat/dark_orb', poison_spit: 'combat/poison_spit', heal_orb: 'combat/heal_orb' }[ar.kind] || ar.sprite;
    if (ar.kind === 'bullet') {
      ctx.strokeStyle = 'rgba(255,230,140,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ar.x - Math.cos(ang) * 14, ar.y - Math.sin(ang) * 14); ctx.lineTo(ar.x, ar.y); ctx.stroke();
      return;
    }
    if (ar.kind === 'laser') {   // a beam from the muzzle to the tip
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = ar.color || '#5ad8ff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(ar.x0, ar.y0); ctx.lineTo(ar.x, ar.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(ar.x0, ar.y0); ctx.lineTo(ar.x, ar.y); ctx.stroke();
      ctx.restore();
      return;
    }
    if (ar.kind === 'plasma' || ar.kind === 'banana' || ar.kind === 'rocket') {
      const color = { plasma: '#7aff6a', banana: '#ffe04a', rocket: '#ff8a3a' }[ar.kind];
      const grad = ctx.createRadialGradient(ar.x, ar.y, 0, ar.x, ar.y, 14);
      grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ar.x, ar.y, 14, 0, Math.PI * 2); ctx.fill();
      if (ar.kind === 'rocket') drawSprite(ctx, 'armory/rocket_launcher', ar.x, ar.y, 20, { rot: ang + Math.PI / 4, center: true, full: true });
      if (ar.kind === 'banana') { ctx.strokeStyle = '#ffd21a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ar.x, ar.y, 6, this.time * 12, this.time * 12 + 2.5); ctx.stroke(); }
      return;
    }
    if (art && hasArt(art)) { drawSprite(ctx, art, ar.x, ar.y, ar.sprite ? 18 : 22, { rot: ar.spin ? this.time * 18 : ar.sprite ? ang + Math.PI / 4 : ang, center: true, full: true }); return; }
    ctx.strokeStyle = '#e8d2a6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ar.x - Math.cos(ang) * 10, ar.y - Math.sin(ang) * 10); ctx.lineTo(ar.x, ar.y); ctx.stroke();
  }

  /** Explosions from rockets, bombs and plasma (a black hole swirls inward instead). */
  drawBooms(g) {
    const { ctx } = this;
    const list = g.fx.booms || [];
    for (const b of list) {
      b.t += 1 / 60;
      const k = Math.min(1, b.t / 0.45);
      if (b.pull) {
        ctx.fillStyle = `rgba(40,0,70,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - k * 0.7), 0, Math.PI * 2); ctx.fill();
        if (hasArt('combat/dark_orb')) drawSprite(ctx, 'combat/dark_orb', b.x, b.y, b.r * (1.2 - k), { rot: this.time * 8, center: true, full: true });
      } else if (hasArt('combat/small_explosion')) drawSprite(ctx, 'combat/small_explosion', b.x, b.y, b.r * 2 * (0.5 + k), { center: true, full: true, alpha: 1 - k });
      else { ctx.fillStyle = `rgba(255,140,40,${1 - k})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * k, 0, Math.PI * 2); ctx.fill(); }
    }
    if (list.length) g.fx.booms = list.filter(b => b.t < 0.45);
  }

  /** Chain lightning from a thunder sword. */
  drawBolts(g, dt) {
    const { ctx } = this;
    for (const b of g.fx.bolts || []) {
      b.life -= dt;
      ctx.strokeStyle = `rgba(255,240,120,${Math.max(0, b.life * 5)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0);
      for (let i = 1; i < 6; i++) { const t = i / 6; ctx.lineTo(b.x0 + (b.x1 - b.x0) * t + (Math.random() - 0.5) * 10, b.y0 + (b.y1 - b.y0) * t + (Math.random() - 0.5) * 10); }
      ctx.lineTo(b.x1, b.y1); ctx.stroke();
    }
    if (g.fx.bolts?.length) g.fx.bolts = g.fx.bolts.filter(b => b.life > 0);
  }

  drawTorch(t) {
    const { ctx } = this;
    const P = TILE / 8;
    if (hasArt('dungeon/torch_1')) { drawSprite(ctx, `dungeon/torch_${1 + Math.floor(this.time * 8 + t.x) % 4}`, t.x, t.y + TILE * 0.15, TILE * 0.9); return; }
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(t.x - P * 0.5, t.y - TILE * 0.55, P, P * 3.5);
    ctx.fillStyle = '#3b3b44'; ctx.fillRect(t.x - P, t.y - TILE * 0.55, P * 2, P * 0.8);
    const flick = 1 + Math.sin(this.time * 14 + t.x) * 0.12;
    drawSprite(ctx, 'effects/flame', t.x, t.y - TILE * 0.55, TILE * 0.55 * flick);
  }

  drawKey(k) {
    const bob = Math.sin(this.time * 3) * 2;
    this.shadow(k.x, k.y, TILE * 0.4);
    if (Math.sin(this.time * 3) > 0.5) drawSprite(this.ctx, 'effects/spark', k.x + 6, k.y - 14 + bob, 8);
    drawSprite(this.ctx, hasArt('dungeon/boss_key') ? 'dungeon/boss_key' : 'gear/key', k.x, k.y - 4 + bob, TILE * 0.6);
  }

  /** A cave mouth in the wilds: a mound of rock around a black opening. */
  drawCaveMouth(g, e) {
    const { ctx } = this;
    const S = TILE * 1.8;
    this.shadow(e.x, e.y + 2, S * 1.1);
    if (hasArt('dungeon/cave_entrance')) { drawSprite(ctx, 'dungeon/cave_entrance', e.x, e.y + 4, S * 1.25); this.caveLabel(g, e, S); return; }
    ctx.fillStyle = '#5d5566';
    ctx.beginPath(); ctx.ellipse(e.x, e.y - S * 0.25, S * 0.62, S * 0.5, 0, Math.PI, 0); ctx.lineTo(e.x + S * 0.62, e.y); ctx.lineTo(e.x - S * 0.62, e.y); ctx.fill();
    ctx.fillStyle = '#7a7186';
    ctx.beginPath(); ctx.ellipse(e.x - S * 0.1, e.y - S * 0.38, S * 0.45, S * 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#0a080d';
    ctx.beginPath(); ctx.ellipse(e.x, e.y, S * 0.3, S * 0.42, 0, Math.PI, 0); ctx.fill();
    drawSprite(ctx, 'nature/rock', e.x - S * 0.5, e.y + 2, TILE * 0.55);
    drawSprite(ctx, 'nature/rock', e.x + S * 0.52, e.y + 3, TILE * 0.45);
    const flick = 1 + Math.sin(this.time * 14 + e.x) * 0.12;
    drawSprite(ctx, 'effects/flame', e.x - S * 0.36, e.y - S * 0.62, TILE * 0.4 * flick);
    this.caveLabel(g, e, S);
  }

  caveLabel(g, e, S) {
    const { ctx } = this;
    const hero = g.hero && g.state.villagers.find(v => v.id === g.hero.id);
    if (hero && Math.hypot(hero.x - e.x, hero.y - e.y) < TILE * 4) {
      ctx.font = 'bold 7px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Dungeon: strike to enter', e.x + 0.6, e.y - S * 0.95 + 0.6);
      ctx.fillStyle = '#ffd76a'; ctx.fillText('Dungeon: strike to enter', e.x, e.y - S * 0.95);
    }
  }

  shadow(x, y, w) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, w * 0.4, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A find waiting to be collected: bobbing sprite on a pulsing golden glow, fading out near the end. */
  /** Someone from another land walking through yours: drawn like any villager, with their name. */
  drawStranger(g, st) {
    const v = st._v ||= { id: `s${st.id}`, age: 25, hp: 100, traits: [], skills: {}, inv: { pack: {} } };
    Object.assign(v, { name: st.name, sex: st.sex, job: st.job, profession: st.job, x: st.x, y: st.y, _walking: st._walking, _flip: st._flip });
    if (st._hitFlash > 0) { st._hitFlash -= 1 / 60; v._whiteFlash = st._hitFlash; } else v._whiteFlash = 0;
    this.drawVillager(g, v);
    label(this.ctx, st.name, st.x, st.y + 7);
    if (st.title) titleLabel(this.ctx, st.title, st.x, st.y + 13);
  }

  /** A treasure chest: bobbing sparkle when closed, lid open for a moment after you break it open. */
  drawChest(ch, opened = false) {
    const { ctx } = this;
    const size = TILE * (ch.boss ? 1.25 : ch.tier ? 1.0 : 0.85);
    this.shadow(ch.x, ch.y, size * 0.8);
    const key = opened ? 'gear/chest_open' : ch.boss ? 'gear/boss_chest' : 'gear/chest_closed';
    drawSprite(ctx, key, ch.x, ch.y + 2, size, { alpha: opened ? Math.min(1, ch.life) : 1 });
    if (!opened && Math.sin(this.time * 3 + ch.x) > 0.6) {
      drawSprite(ctx, 'effects/spark', ch.x + Math.sin(this.time * 5 + ch.y) * size * 0.35, ch.y - size * 0.8, 8);
    }
  }

  /** A heart or potion dropped by a slain beast, bobbing and blinking before it fades. */
  drawPickup(p) {
    const { ctx } = this;
    if (p.life < 5 && Math.floor(this.time * 8) % 2) return;   // blinks before it disappears
    const bob = Math.sin(this.time * 4 + p.x) * 2;
    this.shadow(p.x, p.y, TILE * 0.35);
    drawSprite(ctx, p.kind === 'heart' ? 'gear/heart_full' : 'gear/health_potion', p.x, p.y - 4 + bob, TILE * (p.kind === 'heart' ? 0.45 : 0.55));
  }

  /** An item lying on the ground: bobbing gently over its shadow, with a count. */
  /** A torch stuck in the ground: its flame flickers and sparks rise. */
  drawPlacedTorch(g, t) {
    const { ctx } = this;
    this.shadow(t.x, t.y, TILE * 0.25);
    // the torch art leans (about 63 degrees): turn it upright about its middle so it stands on its spot
    const size = TILE * 1.1;
    drawSprite(ctx, hasArt(TOOLS.torch.icon) ? TOOLS.torch.icon : TOOLS.torch.fallbackIcon || 'items/torch', t.x, t.y - size * 0.42, size, { rot: -0.466, center: true });
    const fx = t.x, fy = t.y - size * 0.82;   // the flame
    const f = 1 + Math.sin(this.time * 14 + t.x) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14 * f);
    grd.addColorStop(0, 'rgba(255,210,120,0.8)'); grd.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(fx, fy, 14 * f, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.06) g.fx.particles.push({ x: fx, y: fy - 2, vx: (Math.random() - 0.5) * 6, vy: -16, sprite: 'effects/spark', size: 4, life: 0.6, max: 0.6, rot: 0 });
  }

  drawGroundItem(it) {
    const { ctx } = this;
    const bob = Math.sin(this.time * 3 + it.x * 0.1) * 1.5;
    this.shadow(it.x, it.y, TILE * 0.45);
    if (it.gear?.rarity >= 1) {   // a beam of light marks good loot from afar
      const beam = it.gear.rarity >= 4 ? 'effects/beam_pink' : it.gear.rarity >= 3 ? 'effects/beam_gold' : 'effects/beam_white';
      drawSprite(ctx, hasArt(beam) ? beam : 'gear/loot_beam_white', it.x, it.y + 4, TILE * (1.2 + Math.min(4, it.gear.rarity) * 0.3), { alpha: 0.55 + 0.25 * Math.sin(this.time * 3) });
    }
    if (it.gear) {   // loot glows in the colour of its rarity
      const col = ['#d9d4c7', '#5aa9ff', '#c77dff', '#ffb347'][it.gear.rarity] || '#fff';
      ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.time * 4); ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(it.x, it.y, TILE * 0.45, TILE * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (it.gear.rarity >= 2 && Math.random() < 0.05) this.lastGame?.fx.particles.push({ x: it.x, y: it.y - 6, vx: 0, vy: -14, sprite: 'effects/spark', size: 6, life: 0.6, max: 0.6, rot: 0 });
    }
    if (it.res) {   // a popped resource: small, bouncing, with a soft glow
      const sp = specialDrop(it.res);
      if (sp >= 0) {   // boss materials and the rarest metals: a beam of light in their rarity colour
        const col = RARITY[sp].color, t = this.time * 3 + it.x * 0.1;
        const beam = sp >= 4 ? 'effects/beam_pink' : 'effects/beam_gold';
        drawSprite(ctx, hasArt(beam) ? beam : 'gear/loot_beam_gold', it.x, it.y + 4, TILE * (1.6 + (sp - 3) * 0.4), { alpha: 0.6 + 0.25 * Math.sin(t) });
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 1.3); ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(it.x, it.y, TILE * (0.5 + 0.08 * Math.sin(t)), TILE * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (Math.random() < 0.12) this.lastGame?.fx.particles.push({ x: it.x + (Math.random() - 0.5) * 14, y: it.y - 4, vx: 0, vy: -22, sprite: 'effects/spark', size: 6, life: 0.7, max: 0.7, rot: 0 });
      }
      this.shadow(it.x, it.y, TILE * 0.22);
      drawSprite(ctx, RES_ICON[it.res] || 'items/relic', it.x, it.y - 2 - (it.z || 0) + bob * (sp >= 0 ? 1.5 : 0.5), TILE * (sp >= 0 ? 0.6 : 0.42));
      if (it.count > 1 && this.camera.zoom >= 1.5) label(ctx, `×${it.count}`, it.x + 7, it.y + 4);
      return;
    }
    const ic = it.gear ? gearIconKey(it.gear) : stackIcon(it);
    drawSprite(ctx, hasArt(ic) ? ic : (it.tool && TOOLS[it.tool]?.fallbackIcon) || ic || 'items/relic', it.x, it.y - 3 + bob, TILE * 0.55);
    if (it.count > 1 && this.camera.zoom >= 1.5) label(ctx, `×${it.count}`, it.x + 8, it.y + 4);
  }

  drawFind(g, f) {
    const { ctx } = this;
    const left = f.until - g.state.time;
    const fade = Math.min(1, left / 20) * Math.min(1, (g.state.time - f.born) / 1.5);
    const t = this.time * 3 + f.x;
    const pulse = 0.5 + Math.sin(t) * 0.5;
    ctx.save();
    ctx.globalAlpha = fade;
    // glow ring on the ground
    ctx.fillStyle = `rgba(255, 207, 90, ${0.18 + pulse * 0.17})`;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, TILE * (0.42 + pulse * 0.08), TILE * (0.18 + pulse * 0.04), 0, 0, Math.PI * 2);
    ctx.fill();
    // blinking pixel sparkles
    ctx.fillStyle = '#fff6c8';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.7 + i * 2.1, on = Math.sin(t * 1.7 + i * 2) > 0.2;
      if (on) ctx.fillRect(f.x + Math.cos(a) * TILE * 0.45 - 1.5, f.y - TILE * 0.5 + Math.sin(a) * TILE * 0.3 - 1.5, 3, 3);
    }
    ctx.restore();
    const kind = FIND_KINDS[f.kind]?.sprite || 'items/icon_gold';
    const person = f.kind === 'traveller';
    drawSprite(ctx, kind, f.x, f.y - (person ? 0 : 4 + Math.sin(t) * 3), person ? TILE * 0.95 : TILE * 0.6, { alpha: fade });
  }

  drawObject(o, x, y) {
    const def = OBJECTS[o.t];
    if (!def) return;
    const size = def.size * TILE;
    const isTree = o.t.startsWith('tree_') && o.t !== 'tree_stump';
    if (def.size > 0.7) this.shadow(x, y, size * 0.7);
    let sway = isTree ? Math.sin(this.time * 1.3 + o.x * 0.7 + o.y) * 0.025 : 0;
    if (o._shake > 0) { sway += Math.sin(this.time * 38) * 0.07 * Math.min(1, o._shake * 4); o._shake -= 1 / 60; }   // being chopped or mined
    const depleted = def.regrowDays && o.charges <= 0;
    drawSprite(this.ctx, def.sprite, x, y, size, { rot: sway, alpha: depleted ? 0.55 : 1 });
    if (o.rich && Math.sin(this.time * 3 + o.x * 1.7 + o.y) > 0.6) {   // a rich vein twinkles
      const k = (Math.sin(this.time * 3 + o.x * 1.7 + o.y) - 0.6) / 0.4;
      drawSprite(this.ctx, hasArt('effects/rich_sparkle') ? 'effects/rich_sparkle' : 'effects/spark', x + Math.sin(o.x * 13 + o.y) * size * 0.25, y - size * (0.35 + 0.2 * Math.cos(o.y * 7)), TILE * 0.5 * k, { center: true, alpha: k });
    }
  }

  drawBuilding(g, b, x, y) {
    const { ctx } = this;
    const def = BUILDINGS[b.type];
    const size = sizeOf(b) * TILE * 1.12;
    // a thin contact shadow hugging the base (a big oval made buildings look like they float)
    if (b.type !== 'farm') {
      const { ctx } = this;
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, sizeOf(b) * TILE * 0.46, TILE * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!b.built) {
      // the building rises from the ground as it is built, behind its scaffolding
      drawSprite(ctx, buildingSprite(b.type), x, y, size, { alpha: 0.18 });
      const p = Math.max(0, Math.min(1, b.progress || 0));
      if (p > 0.02) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - size, y - size * 1.3 * p, size * 2, size * 1.3 * p + 4);
        ctx.clip();
        drawSprite(ctx, buildingSprite(b.type), x, y, size);
        ctx.restore();
      }
      drawSprite(ctx, 'buildings/construction', x, y, Math.max(TILE, size * 0.8), { alpha: p > 0.75 ? Math.max(0.25, 1 - (p - 0.75) * 3) : 1 });
      bar(ctx, x - TILE * 0.6, y + 2, TILE * 1.2, b.progress, '#ffd76a');
      return;
    }
    const blighted = b.blightUntil > g.state.time;
    // homes wear the outside look you chose: its own picture if there is one, else a colour wash
    const design = def.housing ? (b.design || 0) : 0;
    const styled = design && spriteAvailable(`${buildingSprite(b.type)}_style${design}`) ? `${buildingSprite(b.type)}_style${design}` : buildingSprite(b.type);
    drawSprite(ctx, styled, x, y, size, { tint: blighted ? '#553311' : styled === buildingSprite(b.type) ? DESIGNS[design]?.tint : null });
    if (b.type === 'market_stall' && g.hero && !g.visiting) {
      const hero = g.state.villagers.find(v => v.id === g.hero.id), c = g.buildingCenter(b);
      if (hero && nearestStation(g, hero) === b) keyPrompt(ctx, keyLabel(keyOf('potion')), 'Shop', c.x, y - TILE * 1.55 + Math.sin(this.time * 3) * 0.8);
    }
    if (b.type === 'enchanting_table' && g.hero && !g.visiting) {
      const hero = g.state.villagers.find(v => v.id === g.hero.id), c = g.buildingCenter(b);
      if (hero && nearestStation(g, hero) === b) keyPrompt(ctx, keyLabel(keyOf('potion')), 'Enchant', c.x, y - TILE * 1.55 + Math.sin(this.time * 3) * 0.8);
    }
    if (b.type === 'crafting_table' && g.hero && !g.visiting) {
      const hero = g.state.villagers.find(v => v.id === g.hero.id), c = g.buildingCenter(b);
      if (hero && nearestStation(g, hero) === b) {   // only the closer table shows its key
        keyPrompt(ctx, keyLabel(keyOf('potion')), 'Craft', c.x, y - TILE * 1.55 + Math.sin(this.time * 3) * 0.8);
      }
    }
    if (isHome(b) && g.hero && !g.visiting) {
      const hero = g.state.villagers.find(v => v.id === g.hero.id);
      const door = doorOf(g, b);
      if (hero && Math.hypot(hero.x - door.x, hero.y - door.y) < TILE * 2.2) {
        ctx.font = 'bold 7px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Walk in to enter', door.x + 0.6, door.y + 9.6);
        ctx.fillStyle = '#ffd76a'; ctx.fillText('Walk in to enter', door.x, door.y + 9);
        const by = `Built by ${builderOf(g, b)}`;
        ctx.font = '6px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(by, door.x + 0.5, door.y + 17.5);
        ctx.fillStyle = '#f0e6d0'; ctx.fillText(by, door.x, door.y + 17);
        ctx.fillStyle = 'rgba(255,215,106,0.35)';
        ctx.beginPath(); ctx.ellipse(door.x, door.y - 4, 5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (b.type === 'campfire' || b.type === 'blacksmith') {
      const flick = Math.sin(this.time * 14) * 0.5 + Math.sin(this.time * 23) * 0.5;
      if (Math.random() < 0.08) g.fx.particles.push({ x: x + (Math.random() - 0.5) * 6, y: y - TILE * 0.6, vx: 0, vy: -18, sprite: 'effects/smoke', size: 6 + flick, life: 1.2, max: 1.2, rot: 0 });
    }
  }

  drawVillager(g, v) {
    const { ctx } = this;
    const child = v.age < 12;
    const t = this.time + (v.id.charCodeAt(1) || 0);
    const task = v._task;
    const working = task && task.phase === 'work' && !['rest', 'eat', 'wait'].includes(task.type) && task.type !== 'wander';
    // how big someone is drawn is its own setting (v.size, 1 = normal), never their strength or health
    const size = TILE * (child ? 0.62 : 0.92) * Math.max(0.3, Math.min(8, v.size || 1));
    // quick people take quicker steps; strong, tireless people swing their tools faster
    const stepRate = 11 * speedMult(v);
    const swingRate = 9 * (working ? bodyWorkMult(v, task.type) : 1);
    let offsetY = 0, rot = 0, squash = 0;
    if (v._walking) {
      offsetY = -Math.abs(Math.sin(t * stepRate)) * 3;
      rot = Math.sin(t * stepRate) * 0.07;
    } else if (working) {
      offsetY = -Math.abs(Math.sin(t * swingRate)) * 1.2;   // small effort hop while swinging a tool
    }
    const role = displayRole(v);
    const key = villagerSprite({ ...v, role });
    // zoomed far out (or a huge village): just the figure — shadows, tools, bars and emotes are too small to see
    if (this.camera.zoom < 1.1 || (g.state.villagers.length > 250 && this.camera.zoom < 1.8)) {
      const look = g.hero?.id === v.id ? avatarArt(avatarId(g), 'front') : null;   // you keep the look you picked, even from far away
      drawSprite(ctx, look && hasArt(look) ? look : key, v.x, v.y, look && hasArt(look) ? size * 1.15 : size, { flip: look ? false : v._flip, offsetY });
      return;
    }
    const hero = g.hero?.id === v.id ? g.hero : null;
    if (hero) this.drawHeroRing(g, v, hero);
    this.shadow(v.x, v.y, size * 0.8);
    const stunnedWhite = g.hero?.id === v.id && g.hero.stagger > 0 && Math.floor(this.time * 10) % 2 === 0;   // stunned: you blink white the whole time
    const tint = v._whiteFlash > 0 || stunnedWhite ? '#ffffff' : v._hurtFlash > 0 ? '#ff2020' : v.sick ? '#4fbf3f' : null;
    // you: the animated hero (boy or girl), walking and swinging in four directions
    if (hero && !v.disguised) this.drawHero(g, v, hero, key, size, tint);
    else drawSprite(ctx, key, v.x, v.y, size, { flip: v._flip, offsetY, rot, squash, tint });

    const tool = hero && !v.disguised ? null : hero ? (hero.swing > 0 || v._walking ? heldItem(g, v) : null) : working ? toolFor(v, g) : null;
    if (tool) {
      const swing = hero ? (hero.swing > 0 ? 1 - hero.swing / 0.22 * 2 : Math.sin(t * stepRate) * 0.2) : Math.sin(t * swingRate);
      const dir = v._flip ? -1 : 1;
      ctx.save();
      ctx.translate(v.x + dir * size * 0.32, v.y - size * 0.45);
      ctx.scale(dir, 1);
      drawSprite(ctx, tool, 0, size * 0.2, size * 0.55, { rot: -0.6 + swing * 0.9 });
      ctx.restore();
    }

    // carrying work home: a bundle bobbing above their head
    const load = carryIcon(v);
    if (load) drawSprite(ctx, load, v.x + (v._flip ? 3 : -3), v.y - size * 0.92 + Math.abs(Math.sin(t * stepRate)) * -2, TILE * 0.42);
    if (v.hp < 99) bar(ctx, v.x - 8, v.y - size - 4, 16, v.hp / 100, v.hp > 40 ? '#6fdc5a' : '#ff5a4a');
    if (v._emote) drawSprite(ctx, v._emote.key, v.x + 6, v.y - size - 2 + Math.sin(this.time * 4) * 1.5, 12);
    if (hero || g.selected?.ref === v || this.camera.zoom >= 3.2) label(ctx, v.name, v.x, v.y + 7);
    if (hero && !g.visiting) { const t = titleOf(g); if (t) titleLabel(ctx, t, v.x, v.y + 13); }
  }

  /**
   * You, drawn from pieces: the body (your avatar's own look) plus the sword and shield you really carry, each its own
   * image, animated in code. Any sword or shield you add shows up in your hands and swings, guards and flinches the same.
   */
  drawHero(g, v, hero, bodyKey, size, tint) {
    const { ctx } = this;
    const a = hero.facing ?? Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const facing = Math.abs(dx) >= Math.abs(dy) * 0.85 ? (dx >= 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down';
    const side = facing === 'left' ? -1 : 1;
    const step = this.time * 12 * speedMult(v);
    const atkT = hero.atkAnim && hero.atkAnim.t < hero.atkAnim.dur ? hero.atkAnim.t / hero.atkAnim.dur : 0;
    const ease = atkT ? 1 - Math.pow(1 - atkT, 3) : 0;
    // body motion: steps bounce, a dash leans and stretches, a swing lunges, a hit knocks you back a little
    const bob = hero.dash ? -3 : v._walking ? -Math.abs(Math.sin(step)) * 3.2 : Math.sin(this.time * 2.5) * 0.7;
    const sq = hero.dash ? -0.14 : v._walking ? Math.cos(step * 2) * 0.05 : atkT ? -Math.sin(atkT * Math.PI) * 0.06 : 0;
    const lean = hero.dash ? side * 0.22 : v._walking ? Math.sin(step) * 0.06 : atkT ? side * Math.sin(atkT * Math.PI) * 0.12 : 0;
    const lunge = atkT ? Math.sin(Math.min(1, atkT * 1.5) * Math.PI) * 5 : 0;
    const hurt = v._hurtFlash > 0 ? (v._hurtFlash / 0.25) * 3 : 0;
    const bx = v.x + dx * lunge - dx * hurt, by = v.y + dy * lunge * 0.5 - dy * hurt;
    // the weapon-free hero body (front, back or side) once that art is in; until then your avatar's own look
    const view = facing === 'up' ? 'back' : facing === 'down' ? 'front' : 'side';
    const chosen = avatarArt(avatarId(g), 'front');   // the look you picked, always drawn facing straight ahead
    const bodyArt = `hero/${v.sex === 'f' ? 'girl' : 'boy'}_body_${view}`;
    const body = hasArt(chosen) ? chosen : hasArt(bodyArt) ? bodyArt : 'characters/king';
    const w = heroWeapon(g, v);
    const held = g.state.rpg ? heldSlot(g) : 'weapon';   // you hold what is selected in your hotbar
    const tool = TOOLS[held];
    const weaponKey = held?.startsWith?.('item:') ? CONSUMABLES[held.slice(5)]?.icon : held === 'potion' ? 'gear/health_potion' : tool ? (hasArt(tool.icon) ? tool.icon : tool.fallbackIcon) : w.base === 'fists' ? null : gearIconKey(w) || w.icon;
    const sh = rpgOf(g).gear.shield;
    const shieldKey = sh ? gearIconKey(sh) : v.inv?.pack?.shield ? 'gear/round_shield' : null;
    const shieldDef = sh ? SHIELDS[sh.base] : SHIELDS.round;

    // where the hands are, relative to the body, for each way you can face
    const hy = by - size * 0.38 + bob;
    const weaponHand = { x: bx + (facing === 'up' ? -side : side) * size * (facing === 'right' || facing === 'left' ? 0.18 : 0.3), y: hy };
    const shieldHand = { x: bx - (facing === 'up' ? -1 : 1) * side * size * (facing === 'right' || facing === 'left' ? 0.2 : 0.3), y: hy + 2 };

    const drawWeapon = () => {
      if (!weaponKey) return;
      // the blade's direction on screen: resting up and out; on a swing it sweeps from behind to in front of you
      let blade;
      if (atkT) blade = a - side * 1.7 + side * 3.2 * ease * (facing === 'up' || facing === 'down' ? 1 : 1);
      else if (hero.blocking) blade = Math.PI / 2 + side * 0.7;   // sword held low and out of the way behind the shield
      else blade = -Math.PI / 2 + side * (0.55 + (v._walking ? Math.sin(step) * 0.15 : Math.sin(this.time * 2) * 0.04));
      const small = held === 'potion' || held?.startsWith?.('item:');   // potions, bombs and food: a small thing in the hand
      const len = small ? size * 0.34 : tool ? size * 0.55 : size * 0.72 * (WEAPONS[w.base]?.length || 1);
      const cx = weaponHand.x + Math.cos(blade) * len * 0.32, cy = weaponHand.y + Math.sin(blade) * len * 0.32;
      // gear icons are drawn pointing up and to the right (45 degrees): turn them to the blade direction
      if (small && !atkT) { drawSprite(ctx, weaponKey, weaponHand.x + side * 3, weaponHand.y + 2, len, { center: true, full: true, tint: tint === '#ffffff' ? '#ffffff' : null, solid: tint === '#ffffff' }); return; }   // held upright, not waved like a blade
      drawSprite(ctx, weaponKey, cx, cy, len, { rot: blade + Math.PI / 4 + (tool || small ? 0 : WEAPONS[w.base]?.iconRot || 0), center: true, full: true, tint: tint === '#ffffff' ? '#ffffff' : null, solid: tint === '#ffffff' });
    };
    const drawShield = () => {
      if (!shieldKey) return;
      const s = size * 0.5 * (shieldDef?.size || 0.85) * (hero.blocking ? 1.25 : 1);
      let x = shieldHand.x, y = shieldHand.y;
      if (hero.blocking) {   // guard up: the shield comes round in front of you, toward the danger
        const k = Math.min(1, (this.time - (hero._guardDrawAt ??= this.time)) * 10);
        x += (bx + dx * size * 0.32 - x) * k;
        y += (by - size * 0.4 + dy * size * 0.18 - y) * k;
        if (hero.sinceHit < 0.15) { x += (Math.random() - 0.5) * 3; y += (Math.random() - 0.5) * 3; }
      } else hero._guardDrawAt = undefined;
      drawSprite(ctx, shieldKey, x, y + bob * 0.5, s, { center: true, full: true, flip: side < 0, tint: tint === '#ffffff' ? '#ffffff' : null, solid: tint === '#ffffff' });
    };

    // layering: facing away, your gear is in front of the body; otherwise the shield arm is behind and the sword in front
    // facing away the shield is on your back, but the sword stays in your hand, in view
    // your chosen avatar always faces the viewer, so the shield is carried in front of it
    const front = body.startsWith('avatars/');
    if (!front && !hero.blocking) drawShield();
    if ((hero.buffs?.invis || 0) > g.state.time) ctx.globalAlpha = 0.35;
    drawSprite(ctx, body, bx, by, size * (body.startsWith('hero/') ? 1.1 : body.startsWith('avatars/') ? 1.15 : 1), { flip: side < 0 && !body.startsWith('avatars/'), tint, solid: tint === '#ffffff', offsetY: bob, squash: sq, rot: lean });
    drawWeapon();
    if (front || hero.blocking) drawShield();
    ctx.globalAlpha = 1;
    if (hero.stagger > 0.15) {   // dazed: stars circling your head, like the enemies you stun
      for (let i = 0; i < 3; i++) {
        const s = this.time * 6 + i * 2.1;
        drawSprite(ctx, 'effects/spark', bx + Math.cos(s) * size * 0.35, by - size * 1.05 + Math.sin(s) * 3, 7);
      }
    }
  }

  /** Which hero frame to show: facing (down / up / side), walking or attacking, and the frame of that animation. */
  heroFrame(v, hero) {
    if (v.disguised) return null;   // a spy abroad looks like an ordinary traveller
    const who = v.sex === 'f' ? 'girl' : 'boy';
    const a = hero.facing ?? Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const dir = Math.abs(dx) >= Math.abs(dy) * 0.85 ? 'side' : dy < 0 ? 'up' : 'down';
    let anim = 'walk', n = 0;
    const atk = hero.atkAnim;
    const has = k => !!sprite(`hero/${who}_${k}_0`);
    // dash, guard and flinch have their own frames once that sheet is in (side view for dash and block)
    if (hero.dash && has('dash_side')) return { key: `hero/${who}_dash_side_${Math.min(5, Math.floor((1 - hero.dash.t / 0.18) * 6))}`, flip: dx < 0 };
    if (hero.blocking && has('block_side')) return { key: `hero/${who}_block_side_${Math.min(3, Math.floor((this.time - (hero._blockDrawAt ??= this.time)) * 12))}`, flip: dx < 0 };
    hero._blockDrawAt = undefined;
    if (v._hurtFlash > 0 && has('hurt_down')) return { key: `hero/${who}_hurt_down_${Math.min(5, Math.floor((0.25 - v._hurtFlash) / 0.25 * 6))}`, flip: false };
    if (atk && atk.t < atk.dur) { anim = 'attack'; n = Math.min(5, Math.floor(atk.t / atk.dur * 6)); }
    else if (hero.dash) n = Math.floor(this.time * 30) % 6;   // a burst of quick steps
    else if (v._walking) n = Math.floor(this.time * 12 * speedMult(v)) % 6;
    const key = `hero/${who}_${anim}_${dir}_${n}`;
    if (!sprite(key)) return null;   // art not loaded yet: fall back to the villager look
    return { key, flip: dir === 'side' && dx < 0 };
  }

  /** Your pet: small, bobbing along (fliers hover). */
  drawPet(pb) {
    const def = PETS[pb.kind];
    if (!def) return;
    const size = TILE * def.size;
    const bob = def.fly ? Math.sin(this.time * 4) * 2 - 10 : pb.moving ? -Math.abs(Math.sin(this.time * 10)) * 2 : 0;
    this.shadow(pb.x, pb.y, size * 0.5);
    drawSprite(this.ctx, def.sprite, pb.x, pb.y + bob, size, { flip: pb.flip });   // pet art faces right
  }

  /** Small icons over a monster for what is on it: burning, frozen, slowed, bleeding, stunned, enraged. */
  drawStatus(g, c) {
    const now = g.state.time;
    const list = [];
    if (c._burn && c._burn.until > now) list.push('ui/status_burn');
    if (c._frozen && c._frozen > now) list.push('ui/status_frozen');
    else if (c._chill && c._chill.until > now) list.push('ui/status_slow');
    if (c._bleed && c._bleed.until > now) list.push('ui/status_bleed');
    if (c._stunned > 0 && !(c._frozen > now)) list.push('ui/status_stun');
    if (c._enraged) list.push('ui/status_enraged');
    if (!list.length) return;
    const def = CREATURES[c.t];
    const top = c.y - (def?.size || 1) * TILE * (c.scale || 1) - 8 + Math.sin(this.time * 4 + c.x) * 1.5;
    const s = TILE * 0.42, gap = s * 0.9;
    list.forEach((k, i) => { if (hasArt(k)) drawSprite(this.ctx, k, c.x + (i - (list.length - 1) / 2) * gap, top, s, { center: true }); });
  }

  drawCreature(g, c) {
    const { ctx } = this;
    const def = CREATURES[c.t];
    if (!def) return;
    const size = def.size * TILE;
    const t = this.time + c.x * 0.01;
    let offsetY = 0, rot = 0, squash = 0;
    if (def.flying) offsetY = -TILE * 1.2 + Math.sin(t * 3) * 4;
    if (c._hop) offsetY -= c._hop;   // a boss mid-leap
    else if (def.water) offsetY = Math.sin(t * 2) * 1.5;
    else if (c.t === 'slime') squash = Math.sin(t * 6) * 0.12;
    else if (c.t === 'ghost') offsetY = -4 + Math.sin(t * 2.5) * 3;
    if (c._walking && !def.flying) { offsetY -= Math.abs(Math.sin(t * 10)) * 2; rot = Math.sin(t * 10) * 0.05; }
    if (c._attack) squash = -0.15;
    this.shadow(c.x, c.y, size * (def.flying ? 0.5 : 0.8));
    const alpha = c.t === 'ghost' ? 0.75 : c._iframes > 0 ? 0.55 : 1;   // rolling: hard to touch
    // monsters whose own art is not in yet wear a recoloured cousin's
    const useFallback = !c.sprite && def.fallback && !spriteAvailable(def.sprite);
    const art = c.sprite || (useFallback ? def.fallback.sprite : def.sprite);
    const iced = c._chill || (c._frozen && c._frozen > g.state.time);
    const baseTint = iced ? '#9fd4ff' : useFallback ? def.fallback.tint || null : def.tint || null;
    drawSprite(ctx, art, c.x, c.y, size, { flip: c._flip, offsetY: offsetY + (c._stunned > 0 && !c._whiteFlash ? Math.sin(this.time * 40) * 0.8 : 0), rot, squash, alpha, tint: c._whiteFlash > 0 || (c._stunned > 0 && Math.floor(this.time * 10) % 2 === 0) ? '#ffffff' : c._hurtFlash > 0 ? '#ffffff' : baseTint, solid: c._whiteFlash > 0 || (c._stunned > 0 && Math.floor(this.time * 10) % 2 === 0) });
    if (def.hostile) {
      const max = maxHp(c);
      const hp = c.hp ?? max;
      if (hp < max) bar(ctx, c.x - 10, c.y - size + offsetY - 4, 20, hp / max, '#ff4a4a');
      if (c.attackId || c.t === 'invader') drawSprite(ctx, 'effects/marker_war', c.x, c.y - size + offsetY - 6, 9);
      if (c.t === 'forest_spirit' || c.t === 'dragon') {
        if (Math.random() < 0.1) g.fx.particles.push({ x: c.x + (Math.random() - 0.5) * size, y: c.y + offsetY - size * Math.random(), vx: 0, vy: -10, sprite: c.t === 'dragon' ? 'effects/flame' : 'effects/leaf', size: 6, life: 0.8, max: 0.8, rot: 0 });
      }
    }
    if (c._stunned > 0.15 && !def.boss) {   // dazed: little stars circling the head
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + i * 2.1;
        drawSprite(ctx, 'effects/spark', c.x + Math.cos(a) * size * 0.35, c.y - size + offsetY - 2 + Math.sin(a) * 3, 7);
      }
    }
    if (c._guard > 0) {   // a boss behind its guard: hitting it only chips, keep at it to break it
      const k = 0.6 + 0.4 * Math.sin(this.time * 12);
      ctx.save();
      ctx.strokeStyle = `rgba(170,200,255,${k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(c.x, c.y - size * 0.45 + offsetY, size * 0.62, size * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (c._enraged && Math.random() < 0.25) g.fx.particles.push({ x: c.x + (Math.random() - 0.5) * size * 0.8, y: c.y + offsetY - size * Math.random() * 0.9, vx: 0, vy: -16, sprite: 'effects/flame', size: 5, life: 0.5, max: 0.5, rot: 0 });
    const bw = def.boss && BOSS_WEAPONS[c.t];
    if (bw && spriteAvailable(bw)) {   // bosses carry a weapon and swing it like a fighter
      if (c._swing) { c._swing.t += 1 / 60; if (c._swing.t > c._swing.dur) c._swing = null; }
      const face = c._flip ? Math.PI : 0;
      let ang;
      if (c._spin) ang = c._spin;
      else if (c._swing) { const k = Math.min(1, c._swing.t / c._swing.dur); ang = c._swing.ang - c._swing.dir * 1.6 + c._swing.dir * 3.2 * (1 - (1 - k) ** 3); }
      else if (c._raise) ang = (c._flip ? -Math.PI / 2 - 0.9 : -Math.PI / 2 + 0.9) - (c._flip ? -1 : 1) * c._raise * 1.2;   // raised high behind the head
      else ang = face + (c._flip ? 1 : -1) * (0.9 + Math.sin(this.time * 2 + c.x) * 0.08);   // held ready
      const len = size * 0.95, hx = c.x + (c._flip ? -1 : 1) * size * 0.28, hy = c.y - size * 0.42 + offsetY;
      if (c._charging > 0) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 30); drawSprite(ctx, bw, hx + Math.cos(ang) * len * 0.35, hy + Math.sin(ang) * len * 0.35, len * 1.15, { rot: ang + Math.PI / 4, center: true, full: true, tint: '#ff5a2a', solid: true }); ctx.restore(); }
      drawSprite(ctx, bw, hx + Math.cos(ang) * len * 0.35, hy + Math.sin(ang) * len * 0.35, len, { rot: ang + Math.PI / 4, center: true, full: true });
    }
    if (c._charging > 0) {   // a heavy attack is coming: it glows red and grows a warning arc
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,40,${0.35 + 0.35 * Math.sin(this.time * 24)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, size * 0.9, size * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (c._windup > 0) {   // winding up a blow: a red warning, time to dodge or block
      const k = 0.5 + 0.5 * Math.sin(this.time * 30);
      ctx.fillStyle = `rgba(255,60,40,${0.6 + k * 0.4})`;
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', c.x, c.y - size + offsetY - 8);
    }
    if (c.elite && !c.bounty) {   // Elite: a golden ring and its title
      ctx.strokeStyle = `rgba(255,207,90,${0.6 + 0.4 * Math.sin(this.time * 5)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, size * 0.55, size * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
      if (this.camera.zoom >= 1.4) label(ctx, `Elite ${c.t.replace('_', ' ')}`, c.x, c.y + 8);
    }
    if (c.bounty) {
      const p = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + p * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, size * 0.6, size * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      drawSprite(ctx, 'items/icon_gold', c.x, c.y - size + offsetY - 12 - p * 3, 12);
      const heroV = g.hero && g.state.villagers.find(x => x.id === g.hero.id);
      if (!heroV || Math.hypot(heroV.x - c.x, heroV.y - c.y) > TILE * 1.6) label(ctx, `${c.bounty.name} · ${c.bounty.gold} gold`, c.x, c.y + 8);   // hidden when it would sit on your name
    } else if (g.selected?.ref === c) label(ctx, c.t.replace('_', ' '), c.x, c.y + 7);
  }

  /** The villager you walk yourself: a golden ring, and a pointer toward the bounty or the nearest find. */
  drawHeroRing(g, v, hero) {
    const { ctx } = this;
    const p = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    // dash afterimages
    for (const tr of hero.trail || []) {
      ctx.globalAlpha = Math.max(0, tr.life / 0.25) * 0.35;
      const look = avatarArt(avatarId(g), 'front');
      const body = hasArt(look) ? look : 'characters/king';
      drawSprite(ctx, body, tr.x, tr.y, TILE * 0.92, { tint: '#9fd4ff' });
    }
    ctx.globalAlpha = 1;
    // the swing: a bright arc in front of you
    if (hero.arc && !sprite('combat/slash_0')) {   // until the slash art has loaded
      const a = hero.arc, k = a.t / a.max;
      ctx.fillStyle = a.crit ? `rgba(255,215,106,${0.55 * k})` : `rgba(255,255,255,${0.4 * k})`;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y - 8);
      ctx.arc(v.x, v.y - 8, a.range, a.angle - a.width / 2, a.angle + a.width / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(v.x, v.y - 8, a.range, a.angle - a.width / 2, a.angle + a.width / 2); ctx.stroke();
    }
    // your shots in flight
    for (const ar of hero.arrows || []) this.drawHeroShot(ar);
    this.drawBooms(g);
    ctx.strokeStyle = `rgba(255,215,106,${0.55 + p * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(v.x, v.y + 1, TILE * 0.5, TILE * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    const chestTarget = hasToolG(g, 'compass') ? [...(g.state.chests || []), ...(g.state.dungeons || [])].reduce((best, f) => (!best || Math.hypot(f.x - v.x, f.y - v.y) < Math.hypot(best.x - v.x, best.y - v.y) ? f : best), null) : null;
    const target = chestTarget || g.state.creatures.find(c => c.bounty) || (g.state.finds || []).reduce((best, f) => (!best || Math.hypot(f.x - v.x, f.y - v.y) < Math.hypot(best.x - v.x, best.y - v.y) ? f : best), null);
    if (target && Math.hypot(target.x - v.x, target.y - v.y) > TILE * 3) {
      const a = Math.atan2(target.y - v.y, target.x - v.x);
      const r = TILE * 0.95;
      ctx.translate(v.x + Math.cos(a) * r, v.y - TILE * 0.3 + Math.sin(a) * r);
      ctx.rotate(a);
      ctx.fillStyle = target.bounty ? '#ff6b4a' : '#ffd76a';
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawGhost(g) {
    const gh = this.ghost;
    if (!gh) return;
    const { ctx } = this;
    if (gh.demolish) {
      // demolish box and every building inside it, in red
      const { x0, y0, x1, y1 } = gh.box;
      ctx.fillStyle = 'rgba(255,60,50,0.10)';
      ctx.strokeStyle = 'rgba(255,120,110,0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
      ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, (x1 - x0 + 1) * TILE - 1, (y1 - y0 + 1) * TILE - 1);
      ctx.setLineDash([]);
      for (const b of gh.demolish) {
        const s = sizeOf(b);
        ctx.fillStyle = 'rgba(255,50,40,0.35)';
        ctx.strokeStyle = '#ff6a5a';
        ctx.fillRect(b.tx * TILE, b.ty * TILE, s * TILE, s * TILE);
        ctx.strokeRect(b.tx * TILE + 0.5, b.ty * TILE + 0.5, s * TILE - 1, s * TILE - 1);
      }
      return;
    }
    const def = BUILDINGS[gh.type];
    if (gh.spots) {
      // build grid around the area, then every planned spot
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      const xs = gh.spots.map(s => s.tx), ys = gh.spots.map(s => s.ty);
      const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + def.size + 2, y0 = Math.min(...ys) - 2, y1 = Math.max(...ys) + def.size + 2;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) { ctx.moveTo(x * TILE, y0 * TILE); ctx.lineTo(x * TILE, y1 * TILE); }
      for (let y = y0; y <= y1; y++) { ctx.moveTo(x0 * TILE, y * TILE); ctx.lineTo(x1 * TILE, y * TILE); }
      ctx.stroke();
      for (const sp of gh.spots) {
        const color = !sp.ok ? ['rgba(255,70,60,0.25)', '#ff6a5a'] : sp.afford ? ['rgba(90,255,120,0.2)', '#7dff9a'] : ['rgba(255,190,60,0.22)', '#ffc24d'];
        ctx.fillStyle = color[0];
        ctx.strokeStyle = color[1];
        ctx.lineWidth = 1;
        ctx.fillRect(sp.tx * TILE, sp.ty * TILE, def.size * TILE, def.size * TILE);
        ctx.strokeRect(sp.tx * TILE + 0.5, sp.ty * TILE + 0.5, def.size * TILE - 1, def.size * TILE - 1);
        if (sp.ok) drawSprite(ctx, buildingSprite(gh.type), (sp.tx + def.size / 2) * TILE, (sp.ty + def.size) * TILE - 2, def.size * TILE * 1.12, { alpha: sp.afford ? 0.6 : 0.3 });
      }
      return;
    }
    ctx.fillStyle = gh.ok ? 'rgba(90,255,120,0.22)' : 'rgba(255,70,60,0.28)';
    ctx.strokeStyle = gh.ok ? '#7dff9a' : '#ff6a5a';
    ctx.lineWidth = 1;
    ctx.fillRect(gh.tx * TILE, gh.ty * TILE, def.size * TILE, def.size * TILE);
    ctx.strokeRect(gh.tx * TILE + 0.5, gh.ty * TILE + 0.5, def.size * TILE - 1, def.size * TILE - 1);
    drawSprite(ctx, buildingSprite(gh.type), (gh.tx + def.size / 2) * TILE, (gh.ty + def.size) * TILE - 2, def.size * TILE * 1.12, { alpha: 0.7 });
  }

  /** A boat sprite (drawn pointing right) turned to face its heading, centred on its position. */
  drawShip(key, x, y, angle, length, alpha = 1) {
    const s = sprite(key);
    if (!s) return;
    const { box } = s;
    const scale = length / box.w;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    // a soft shadow on the water
    ctx.fillStyle = 'rgba(0, 20, 40, 0.28)';
    ctx.beginPath(); ctx.ellipse(2, 4, length * 0.5, length * 0.2, angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);   // keep the sails upright when heading left
    ctx.drawImage(s.img, box.x, box.y, box.w, box.h, -box.w * scale / 2, -box.h * scale / 2, box.w * scale, box.h * scale);
    ctx.restore();
  }

  /** Sailing: the player's boat, pirates, flying bombs, wake and floating treasure. */
  drawSea(g) {
    const s = g.sail;
    if (!s || g.visiting) return;
    const { ctx } = this;
    for (const w of s.wake) {
      ctx.fillStyle = `rgba(230, 250, 255, ${w.life / 1.2 * 0.5})`;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, 6 + (1.2 - w.life) * 10, 3 + (1.2 - w.life) * 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const l of s.loot) {
      const bob = Math.sin(this.time * 3 + l.x) * 2;
      drawSprite(ctx, 'boats/treasure_chest', l.x, l.y + 8 + bob, TILE * 0.8);
    }
    // other players' ships, with their captain and village
    for (const o of s.others?.values() || []) {
      this.drawShip(`boats/${o.type}`, o.x, o.y, o.a, TILE * (1.5 + (BOATS[o.type]?.guns || 1) * 0.12));
      bar(ctx, o.x - 16, o.y - TILE * 1.1, 32, (o.hull || 0) / (o.max || 1), '#ff9a4a');
      ctx.save();
      ctx.font = '600 9px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10, 8, 16, .9)';
      ctx.fillStyle = '#ffd9a8';
      const label = `${o.name} · ${o.village}`;
      ctx.strokeText(label, o.x, o.y - TILE * 1.3);
      ctx.fillText(label, o.x, o.y - TILE * 1.3);
      ctx.restore();
    }
    for (const p of s.pirates) {
      this.drawShip(p.sprite, p.x, p.y, p.angle, TILE * 1.9);
      bar(ctx, p.x - 14, p.y - TILE * 1.1, 28, p.hull / p.max, '#ff5a4a');
    }
    const boat = fleetOf(g).find(b => b.id === s.boatId);
    const def = BOATS[s.type];
    this.drawShip(`boats/${s.type}`, s.x, s.y + Math.sin(this.time * 2.5) * 1.2, s.angle, TILE * (1.5 + def.guns * 0.12));
    if (boat) bar(ctx, s.x - 16, s.y - TILE * 1.1, 32, boat.hull / def.hull, '#6fdc5a');
    for (const b of s.shots) drawSprite(ctx, b.heavy ? 'boats/sea_bomb' : 'nature/rock', b.x, b.y + 6, TILE * (b.heavy ? 0.45 : 0.3), { rot: this.time * 8 });
  }

  /** Falling missiles: a red target ring on the ground, the missile streaking down, then a white flash. */
  drawStrikes(g) {
    const strikes = g.strikes;
    if (!strikes?.length) return;
    const { ctx } = this;
    ctx.save();
    for (const st of strikes) {
      const x = (st.tx + 0.5) * TILE, y = (st.ty + 0.5) * TILE;
      const r = (st.radius || (st.orbital ? 5 : 3.5)) * TILE;
      if (!st.hit) {
        const t = 1 - st.life / st.max;   // 0 → 1 as it falls
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 14);
        ctx.strokeStyle = `rgba(255,60,50,${0.5 + pulse * 0.4})`;
        ctx.fillStyle = `rgba(255,40,30,${0.08 + t * 0.14})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
        if (st.orbital) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(120,220,255,${t})`;
          ctx.lineWidth = 2 + t * 10;
          ctx.beginPath(); ctx.moveTo(x, y - 900); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          const my = y - (1 - t * t) * 700;
          const mx = x + (1 - t * t) * 160;
          ctx.strokeStyle = 'rgba(255,200,120,0.55)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(mx + 60 * (1 - t), my - 260 * (1 - t) - 40); ctx.lineTo(mx, my); ctx.stroke();
          drawSprite(ctx, 'units/missile', mx, my, TILE * (st.nuke ? 2 : 1.1), { rot: Math.atan2(700, -160) - Math.PI / 2 });
        }
      } else {
        const a = Math.max(0, st.flash / 0.7);
        if (st.nuke) {   // a mushroom cloud rising out of the flash
          const up = 1 - a;
          ctx.fillStyle = `rgba(90,70,60,${0.55 * a + 0.1})`;
          ctx.beginPath(); ctx.ellipse(x, y - r * (0.6 + up * 0.5), r * 0.55, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(x - r * 0.1, y - r * (0.6 + up * 0.5), r * 0.2, r * (0.6 + up * 0.5));
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${180 + a * 60},${120 + a * 100},${a * 0.8})`;
        ctx.beginPath(); ctx.arc(x, y, r * (1.3 - a * 0.4), 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  /** Spell beams: a glowing line that fades in half a second. */
  drawBeams(g) {
    const beams = g.fx.beams;
    if (!beams?.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of beams) {
      const a = Math.max(0, b.life / b.max);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Speech bubbles over villagers' heads (only when zoomed in enough to read them). */
  drawBubbles(g, ox, oy, s) {
    if (this.camera.zoom < 1.5 || g.visiting) return;
    const { ctx } = this;
    const t = performance.now();
    const W = this.canvas.width / this.dpr, H = this.canvas.height / this.dpr;
    ctx.font = '600 11px Rubik, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let drawn = 0;
    const placed = [];   // bubbles already drawn this frame, so neighbours stack instead of overlapping
    for (const v of g.state.villagers) {
      const b = v._say;
      if (!b || v.away || t < (b.from || 0) || t > b.until) continue;
      const x = (v.x * s + ox) / this.dpr;
      let y = ((v.y - TILE * (v.age < 12 ? 0.8 : 1.15)) * s + oy) / this.dpr;
      if (x < -80 || y < -40 || x > W + 80 || y > H + 40) continue;
      const alpha = Math.min(1, (t - (b.from || b.until - 4200)) / 180, (b.until - t) / 300);
      const w = Math.min(190, ctx.measureText(b.text).width + 14), h = 20;
      for (let tries = 0; tries < 4 && placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < h + 3); tries++) y -= h + 4;
      placed.push({ x, y, w });
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = '#fff6e2';
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h - 6, w, h, 7);
      ctx.moveTo(x - 4, y - 6.5); ctx.lineTo(x, y); ctx.lineTo(x + 4, y - 6.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1a10';
      ctx.fillText(b.text, x, y - h / 2 - 6, w - 10);
      if (++drawn >= 24) break;
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  drawParticles(g) {
    for (const p of g.fx.particles) {
      drawSprite(this.ctx, p.sprite, p.x, p.y, p.size, { alpha: Math.min(1, p.life / p.max * 1.5), rot: p.rot });
    }
    // animated effects: slashes, hits, dust, parries, poofs
    for (const a of g.fx.anims || []) {
      const frame = Math.min(5, Math.floor(a.t / a.dur * 6));
      // effects that point somewhere (slashes) mirror across that direction; others mirror left-right
      drawSprite(this.ctx, `${a.prefix}_${frame}`, a.x, a.y, a.size, { rot: a.rot, flip: a.rot == null && a.flip, flipY: a.rot != null && a.flip, full: true, center: true });
    }
  }

  drawLighting(g, ox, oy, s) {
    const dark = g.darkness;
    const tint = g.dungeon ? null : SEASON_TINT[g.season];
    const { ctx, lctx, light } = this;
    if (tint) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, light.width, light.height);
    }
    if (dark <= 0) return;

    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, light.width, light.height);
    lctx.fillStyle = g.dungeon ? 'rgba(4,3,8,0.86)' : `rgba(8,10,38,${0.68 * dark})`;
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';

    const lights = [];
    for (const b of g.state.buildings) {
      const def = BUILDINGS[b.type];
      if (!b.built) continue;
      const r = def.light || (def.housing ? 2.2 : 0);
      if (r) lights.push({ ...g.buildingCenter(b), r: r * TILE });
    }
    for (const v of g.state.villagers) if (!v.away) lights.push({ x: v.x, y: v.y - 8, r: TILE * (g.hero?.id === v.id ? heroLight(g, !!g.dungeon) + (g.dungeon ? lightBonus(g) * 0.3 : 0) : 1.1) });
    for (const t of g.state.torches || []) lights.push({ x: t.x, y: t.y - 10, r: TILE * 5 });   // placed torches
    if (g.dungeon) {
      for (const t of g.dungeon.torches) lights.push({ x: t.x, y: t.y - TILE * 0.4, r: TILE * 3.4 });
      for (const p of g.dungeon.props || []) if (p.kind === 'glow_crystal') lights.push({ x: p.x, y: p.y, r: TILE * 1.8 });
      for (const p of [g.dungeon.exit, g.dungeon.stairsDown, g.dungeon.key]) if (p) lights.push({ x: p.x, y: p.y, r: TILE * 1.6 });
    }
    const flicker = 1 + Math.sin(this.time * 12) * 0.03;
    const W = light.width, H = light.height;
    for (let i = lights.length - 1; i >= 0; i--) {   // skip lights that are off screen
      const l = lights[i], x = l.x * s + ox, y = l.y * s + oy, r = l.r * s;
      if (x + r < 0 || y + r < 0 || x - r > W || y - r > H) lights.splice(i, 1);
    }
    for (const l of lights) {
      const x = l.x * s + ox, y = l.y * s + oy, r = l.r * s * flicker;
      const grad = lctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = grad;
      lctx.beginPath(); lctx.arc(x, y, r, 0, Math.PI * 2); lctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(light, 0, 0);

    // warm glow around fires
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.r < TILE * 2) continue;
      const x = l.x * s + ox, y = l.y * s + oy, r = l.r * s * 0.6 * flicker;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,150,50,${0.18 * dark})`);
      grad.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawWeather(g, dt) {
    const { ctx, canvas } = this;
    const dayIndex = g.day;
    const raining = (g.season === 'Spring' || g.season === 'Autumn') && ((dayIndex + 3) * 7919) % 5 === 0;
    const snowing = g.season === 'Winter';
    if (!raining && !snowing) { this.weather.length = 0; return; }
    const W = canvas.width, H = canvas.height;
    const target = snowing ? 90 : 160;
    while (this.weather.length < target) this.weather.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(180,210,255,0.45)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = this.dpr;
    for (const p of this.weather) {
      if (snowing) {
        p.y += 40 * p.s * dt * this.dpr; p.x += Math.sin(this.time + p.y * 0.01) * 15 * dt * this.dpr;
        ctx.fillRect(p.x, p.y, 2 * this.dpr * p.s, 2 * this.dpr * p.s);
      } else {
        p.y += 600 * p.s * dt * this.dpr; p.x -= 120 * dt * this.dpr;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 4 * this.dpr, p.y + 14 * this.dpr); ctx.stroke();
      }
      if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
      if (p.x < 0) p.x = W;
    }
  }

  /**
   * Enemies inside your land that are off screen: a red dot on the screen edge in their direction,
   * one per direction with a count, pulsing for armies (raiders, invaders, warbands).
   */
  drawEnemyMarkers(g, ox, oy, s) {
    if (g.visiting || g.sail) return;
    const W = this.canvas.width / this.dpr, H = this.canvas.height / this.dpr;
    const cen = g.center, landR = TILE * 40;
    const groups = new Map();
    for (const c of g.state.creatures) {
      if (!CREATURES[c.t]?.hostile) continue;
      if (!c.raid && !c.attackId && !c.hunting && Math.hypot(c.x - cen.x, c.y - cen.y) > landR * 0.45) continue;   // wild beasts far out in the woods don't count
      const sx = (c.x * s + ox) / this.dpr, sy = (c.y * s + oy) / this.dpr;
      if (sx > 0 && sy > 0 && sx < W && sy < H) continue;   // on screen: you can see it
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const key = Math.round(a / (Math.PI / 12));
      const gr = groups.get(key) || { a: 0, n: 0, army: false, boss: false };
      gr.a += a; gr.n++; gr.army ||= !!(c.raid || c.attackId); gr.boss ||= !!CREATURES[c.t].boss;
      groups.set(key, gr);
    }
    if (!groups.size) return;
    const { ctx } = this;
    const pad = 22, topPad = 70, bottomPad = 90;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px sans-serif';
    for (const gr of groups.values()) {
      const a = gr.a / gr.n;
      const dx = Math.cos(a), dy = Math.sin(a);
      // walk out from the centre to the padded screen edge
      const tx = dx > 0 ? (W - pad - W / 2) / dx : dx < 0 ? (pad - W / 2) / dx : Infinity;
      const ty = dy > 0 ? (H - bottomPad - H / 2) / dy : dy < 0 ? (topPad - H / 2) / dy : Infinity;
      const t = Math.min(tx, ty);
      const x = W / 2 + dx * t, y = H / 2 + dy * t;
      const r = (gr.boss ? 11 : gr.army ? 9 : 7) + (gr.army ? pulse * 2 : 0);
      ctx.fillStyle = 'rgba(255,40,30,0.25)';
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3b30';
      ctx.strokeStyle = '#2a0805';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // a small arrowhead pointing at them
      ctx.beginPath();
      ctx.moveTo(x + dx * (r + 9), y + dy * (r + 9));
      ctx.lineTo(x + dx * (r + 2) - dy * 5, y + dy * (r + 2) + dx * 5);
      ctx.lineTo(x + dx * (r + 2) + dy * 5, y + dy * (r + 2) - dx * 5);
      ctx.closePath(); ctx.fill();
      if (gr.n > 1) { ctx.fillStyle = '#fff'; ctx.fillText(String(gr.n), x, y + 0.5); }
    }
    ctx.restore();
  }

  drawFloaters(g, ox, oy, s) {
    const { ctx } = this;
    ctx.font = '600 13px Rubik, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const f of g.fx.floaters) {
      if (/\p{Extended_Pictographic}/u.test(f.text)) f.text = f.text.replace(/\p{Extended_Pictographic}️?\s?/gu, '');   // no emojis on the map
      const x = (f.x * s + ox) / this.dpr, y = (f.y * s + oy) / this.dpr;
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,12,30,0.9)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}

function bar(ctx, x, y, w, frac, color) {
  ctx.fillStyle = 'rgba(20,12,30,0.8)';
  ctx.fillRect(x - 0.5, y - 0.5, w + 1, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 2);
}

const BOSS_WEAPONS = { cave_troll: 'armory/maul', stone_golem: 'gear/war_hammer', lich: 'armory/necro_staff', forest_spirit: 'armory/druid_staff', slime_king: null, spider_queen: null, dragon: null };

/** A small button prompt over something you can use: a key cap and a word, in a dark rounded pill. */
function keyPrompt(ctx, key, text, x, y) {
  ctx.save();
  ctx.font = '600 6px "Pixelify Sans", monospace';
  const tw = ctx.measureText(text).width, kw = Math.max(8, ctx.measureText(key).width + 5);
  const w = kw + tw + 9, hgt = 11, x0 = Math.round(x - w / 2), y0 = Math.round(y - hgt / 2);
  ctx.fillStyle = 'rgba(16,10,24,0.88)';
  ctx.beginPath(); ctx.roundRect(x0, y0, w, hgt, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.fillStyle = '#ffd76a';   // the key cap
  ctx.beginPath(); ctx.roundRect(x0 + 2, y0 + 2, kw, hgt - 4, 2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1a08'; ctx.fillText(key, x0 + 2 + kw / 2, y0 + hgt / 2 + 0.3);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff3d6';
  ctx.fillText(text, x0 + kw + 5, y0 + hgt / 2 + 0.3);
  ctx.restore();
}

/** A player's title, small and gold, under their name. */
function titleLabel(ctx, text, x, y) {
  ctx.save();
  ctx.font = '600 4.5px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(20,12,30,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function label(ctx, text, x, y) {
  ctx.save();
  ctx.font = '600 6px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(20,12,30,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function selectionPos(g, sel) {
  const r = sel.ref;
  if (sel.kind === 'villager' || sel.kind === 'creature') return { x: r.x, y: r.y - 1, r: TILE * 0.4 };
  if (sel.kind === 'building') {
    const size = sizeOf(r);
    return { x: (r.tx + size / 2) * TILE, y: (r.ty + size) * TILE - 4, r: size * TILE * 0.55 };
  }
  if (sel.kind === 'object') return { x: r.x * TILE + TILE / 2, y: r.y * TILE + TILE * 0.9, r: TILE * 0.4 };
  return null;
}
