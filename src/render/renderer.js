import { TILE } from '../core/constants.js';
import { drawSprite } from '../core/assets.js';
import { TerrainPainter } from './terrain.js';
import { OBJECTS, CREATURES, villagerSprite } from '../data/objects.js';
import { BUILDINGS } from '../data/buildings.js';
import { displayRole, toolFor } from '../game/villagers.js';
import { maxHp } from '../game/creatures.js';

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
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.light.width = this.canvas.width;
    this.light.height = this.canvas.height;
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
    this.drawGroundMarks(g, view);

    // y-sorted scene
    const items = [];
    const inView = (x, y) => x >= (view.x0 - 2) * TILE && x <= (view.x1 + 2) * TILE && y >= view.y0 * TILE && y <= (view.y1 + 3) * TILE;
    for (const o of g.state.objects) {
      const x = o.x * TILE + TILE / 2, y = o.y * TILE + TILE * 0.9;
      if (inView(x, y)) items.push({ y, draw: () => this.drawObject(o, x, y) });
    }
    for (const b of g.state.buildings) {
      const size = BUILDINGS[b.type].size;
      const x = (b.tx + size / 2) * TILE, y = (b.ty + size) * TILE - 2;
      if (inView(x, y)) items.push({ y, draw: () => this.drawBuilding(g, b, x, y) });
    }
    for (const c of g.state.creatures) {
      if (inView(c.x, c.y)) items.push({ y: c.y + (CREATURES[c.t]?.flying ? 40 : 0), draw: () => this.drawCreature(g, c) });
    }
    for (const v of g.state.villagers) {
      if (!v.away && inView(v.x, v.y)) items.push({ y: v.y, draw: () => this.drawVillager(g, v) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    this.drawGhost(g);
    this.drawParticles(g);
    this.drawLighting(g, ox, oy, s);
    this.drawWeather(g, dt);

    // screen-space overlays
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawFloaters(g, ox, oy, s);
  }

  drawTerrain(g, view) {
    this.terrain.draw(this.ctx, g.world, view, TILE * this.scale);
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

  drawObject(o, x, y) {
    const def = OBJECTS[o.t];
    if (!def) return;
    const size = def.size * TILE;
    const isTree = o.t.startsWith('tree_') && o.t !== 'tree_stump';
    if (def.size > 0.7) this.shadow(x, y, size * 0.7);
    const sway = isTree ? Math.sin(this.time * 1.3 + o.x * 0.7 + o.y) * 0.025 : 0;
    const depleted = def.regrowDays && o.charges <= 0;
    drawSprite(this.ctx, def.sprite, x, y, size, { rot: sway, alpha: depleted ? 0.55 : 1 });
  }

  drawBuilding(g, b, x, y) {
    const { ctx } = this;
    const def = BUILDINGS[b.type];
    const size = def.size * TILE * 1.12;
    // a thin contact shadow hugging the base (a big oval made buildings look like they float)
    if (b.type !== 'farm') {
      const { ctx } = this;
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, def.size * TILE * 0.46, TILE * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!b.built) {
      drawSprite(ctx, `buildings/${b.type}`, x, y, size, { alpha: 0.22 });
      drawSprite(ctx, 'buildings/construction', x, y, Math.max(TILE, size * 0.8));
      bar(ctx, x - TILE * 0.6, y + 2, TILE * 1.2, b.progress, '#ffd76a');
      return;
    }
    const blighted = b.blightUntil > g.state.time;
    drawSprite(ctx, `buildings/${b.type}`, x, y, size, { tint: blighted ? '#553311' : null });
    if (b.type === 'campfire' || b.type === 'blacksmith') {
      const flick = Math.sin(this.time * 14) * 0.5 + Math.sin(this.time * 23) * 0.5;
      if (Math.random() < 0.08) g.fx.particles.push({ x: x + (Math.random() - 0.5) * 6, y: y - TILE * 0.6, vx: 0, vy: -18, sprite: 'effects/smoke', size: 6 + flick, life: 1.2, max: 1.2, rot: 0 });
    }
  }

  drawVillager(g, v) {
    const { ctx } = this;
    const child = v.age < 12;
    const size = TILE * (child ? 0.62 : 0.92);
    const t = this.time + (v.id.charCodeAt(1) || 0);
    const task = v._task;
    const working = task && task.phase === 'work' && !['rest', 'eat', 'wait'].includes(task.type) && task.type !== 'wander';
    let offsetY = 0, rot = 0, squash = 0;
    if (v._walking) {
      offsetY = -Math.abs(Math.sin(t * 11)) * 3;
      rot = Math.sin(t * 11) * 0.07;
    } else if (working) {
      offsetY = -Math.abs(Math.sin(t * 9)) * 1.2;   // small effort hop while swinging a tool
    }
    const role = displayRole(v);
    const key = villagerSprite({ ...v, role });
    this.shadow(v.x, v.y, size * 0.8);
    const tint = v._hurtFlash > 0 ? '#ff2020' : v.sick ? '#4fbf3f' : null;
    drawSprite(ctx, key, v.x, v.y, size, { flip: v._flip, offsetY, rot, squash, tint });

    const tool = working ? toolFor(v) : null;
    if (tool) {
      const swing = Math.sin(t * 9);
      const dir = v._flip ? -1 : 1;
      ctx.save();
      ctx.translate(v.x + dir * size * 0.32, v.y - size * 0.45);
      ctx.scale(dir, 1);
      drawSprite(ctx, tool, 0, size * 0.2, size * 0.55, { rot: -0.6 + swing * 0.9 });
      ctx.restore();
    }

    if (v.hp < 99) bar(ctx, v.x - 8, v.y - size - 4, 16, v.hp / 100, v.hp > 40 ? '#6fdc5a' : '#ff5a4a');
    if (v._emote) drawSprite(ctx, v._emote.key, v.x + 6, v.y - size - 2 + Math.sin(this.time * 4) * 1.5, 12);
    if (g.selected?.ref === v || this.camera.zoom >= 3.2) label(ctx, v.name, v.x, v.y + 7);
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
    if (g.selected?.ref === c) label(ctx, c.t.replace('_', ' '), c.x, c.y + 7);
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
        const s = BUILDINGS[b.type].size;
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
        if (sp.ok) drawSprite(ctx, `buildings/${gh.type}`, (sp.tx + def.size / 2) * TILE, (sp.ty + def.size) * TILE - 2, def.size * TILE * 1.12, { alpha: sp.afford ? 0.6 : 0.3 });
      }
      return;
    }
    ctx.fillStyle = gh.ok ? 'rgba(90,255,120,0.22)' : 'rgba(255,70,60,0.28)';
    ctx.strokeStyle = gh.ok ? '#7dff9a' : '#ff6a5a';
    ctx.lineWidth = 1;
    ctx.fillRect(gh.tx * TILE, gh.ty * TILE, def.size * TILE, def.size * TILE);
    ctx.strokeRect(gh.tx * TILE + 0.5, gh.ty * TILE + 0.5, def.size * TILE - 1, def.size * TILE - 1);
    drawSprite(ctx, `buildings/${gh.type}`, (gh.tx + def.size / 2) * TILE, (gh.ty + def.size) * TILE - 2, def.size * TILE * 1.12, { alpha: 0.7 });
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
    const size = BUILDINGS[r.type].size;
    return { x: (r.tx + size / 2) * TILE, y: (r.ty + size) * TILE - 4, r: size * TILE * 0.55 };
  }
  if (sel.kind === 'object') return { x: r.x * TILE + TILE / 2, y: r.y * TILE + TILE * 0.9, r: TILE * 0.4 };
  return null;
}
