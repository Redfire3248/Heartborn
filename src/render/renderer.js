import { TILE } from '../core/constants.js';
import { drawSprite, sprite } from '../core/assets.js';
import { BOATS, fleetOf } from '../game/sailing.js';
import { TerrainPainter } from './terrain.js';
import { OBJECTS, CREATURES, villagerSprite } from '../data/objects.js';
import { BUILDINGS, sizeOf, buildingSprite } from '../data/buildings.js';
import { displayRole, toolFor, carryIcon, heldItem } from '../game/villagers.js';
import { speedMult, bodyWorkMult } from '../game/body.js';
import { maxHp } from '../game/creatures.js';
import { FIND_KINDS } from '../game/finds.js';
import { ITEMS } from '../data/people.js';

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
    ctx.fillStyle = '#0d2a4a';
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

    this.drawTerrain(g, view);
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
      if (inView(c.x, c.y)) items.push({ y: c.y + (CREATURES[c.t]?.flying ? 40 : 0), draw: () => this.drawCreature(g, c) });
    }
    for (const v of g.state.villagers) {
      if (!v.away && inView(v.x, v.y)) items.push({ y: v.y, draw: () => this.drawVillager(g, v) });
    }
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
    this.drawParticles(g);
    this.drawBeams(g);
    this.drawStrikes(g);
    this.drawLighting(g, ox, oy, s);
    this.drawWeather(g, dt);

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

  shadow(x, y, w) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, w * 0.4, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A find waiting to be collected: bobbing sprite on a pulsing golden glow, fading out near the end. */
  /** An item lying on the ground: bobbing gently over its shadow, with a count. */
  drawGroundItem(it) {
    const { ctx } = this;
    const bob = Math.sin(this.time * 3 + it.x * 0.1) * 1.5;
    this.shadow(it.x, it.y, TILE * 0.45);
    drawSprite(ctx, ITEMS[it.item]?.icon || 'items/relic', it.x, it.y - 3 + bob, TILE * 0.55);
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
    drawSprite(ctx, buildingSprite(b.type), x, y, size, { tint: blighted ? '#553311' : null });
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
      drawSprite(ctx, key, v.x, v.y, size, { flip: v._flip, offsetY });
      return;
    }
    const hero = g.hero?.id === v.id ? g.hero : null;
    if (hero) this.drawHeroRing(g, v, hero);
    this.shadow(v.x, v.y, size * 0.8);
    const tint = v._hurtFlash > 0 ? '#ff2020' : v.sick ? '#4fbf3f' : null;
    drawSprite(ctx, key, v.x, v.y, size, { flip: v._flip, offsetY, rot, squash, tint });

    const tool = hero ? (hero.swing > 0 || v._walking ? heldItem(g, v) : null) : working ? toolFor(v, g) : null;
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
  }

  drawCreature(g, c) {
    const { ctx } = this;
    const def = CREATURES[c.t];
    if (!def) return;
    const size = def.size * TILE;
    const t = this.time + c.x * 0.01;
    let offsetY = 0, rot = 0, squash = 0;
    if (def.flying) offsetY = -TILE * 1.2 + Math.sin(t * 3) * 4;
    else if (def.water) offsetY = Math.sin(t * 2) * 1.5;
    else if (c.t === 'slime') squash = Math.sin(t * 6) * 0.12;
    else if (c.t === 'ghost') offsetY = -4 + Math.sin(t * 2.5) * 3;
    if (c._walking && !def.flying) { offsetY -= Math.abs(Math.sin(t * 10)) * 2; rot = Math.sin(t * 10) * 0.05; }
    if (c._attack) squash = -0.15;
    this.shadow(c.x, c.y, size * (def.flying ? 0.5 : 0.8));
    const alpha = c.t === 'ghost' ? 0.75 : 1;
    drawSprite(ctx, c.sprite || def.sprite, c.x, c.y, size, { flip: c._flip, offsetY, rot, squash, alpha, tint: c._hurtFlash > 0 ? '#ffffff' : def.tint || null });
    if (def.hostile) {
      const max = maxHp(c);
      const hp = c.hp ?? max;
      if (hp < max) bar(ctx, c.x - 10, c.y - size + offsetY - 4, 20, hp / max, '#ff4a4a');
      if (c.attackId || c.t === 'invader') drawSprite(ctx, 'effects/marker_war', c.x, c.y - size + offsetY - 6, 9);
      if (c.t === 'forest_spirit' || c.t === 'dragon') {
        if (Math.random() < 0.1) g.fx.particles.push({ x: c.x + (Math.random() - 0.5) * size, y: c.y + offsetY - size * Math.random(), vx: 0, vy: -10, sprite: c.t === 'dragon' ? 'effects/flame' : 'effects/leaf', size: 6, life: 0.8, max: 0.8, rot: 0 });
      }
    }
    if (c.bounty) {
      const p = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + p * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, size * 0.6, size * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      drawSprite(ctx, 'items/icon_gold', c.x, c.y - size + offsetY - 12 - p * 3, 12);
      label(ctx, `${c.bounty.name} · ${c.bounty.gold} gold`, c.x, c.y + 8);
    } else if (g.selected?.ref === c) label(ctx, c.t.replace('_', ' '), c.x, c.y + 7);
  }

  /** The villager you walk yourself: a golden ring, and a pointer toward the bounty or the nearest find. */
  drawHeroRing(g, v, hero) {
    const { ctx } = this;
    const p = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    ctx.strokeStyle = `rgba(255,215,106,${0.55 + p * 0.45})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(v.x, v.y + 1, TILE * 0.5, TILE * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    const target = g.state.creatures.find(c => c.bounty) || (g.state.finds || []).reduce((best, f) => (!best || Math.hypot(f.x - v.x, f.y - v.y) < Math.hypot(best.x - v.x, best.y - v.y) ? f : best), null);
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
  }

  drawLighting(g, ox, oy, s) {
    const dark = g.darkness;
    const tint = SEASON_TINT[g.season];
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
    lctx.fillStyle = `rgba(8,10,38,${0.68 * dark})`;
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';

    const lights = [];
    for (const b of g.state.buildings) {
      const def = BUILDINGS[b.type];
      if (!b.built) continue;
      const r = def.light || (def.housing ? 2.2 : 0);
      if (r) lights.push({ ...g.buildingCenter(b), r: r * TILE });
    }
    for (const v of g.state.villagers) if (!v.away) lights.push({ x: v.x, y: v.y - 8, r: TILE * 1.1 });
    const flicker = 1 + Math.sin(this.time * 12) * 0.03;
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
