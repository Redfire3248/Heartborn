/*
 * The tutorial, the way Roblox games do it.
 *
 * One objective at a time in a big banner across the top ("STEP 2 / 8 · Chop down a tree 1/3"), with what it pays.
 * The thing to go to is marked in the world itself - a bouncing arrow and a pulsing ring over the actual tree, rock,
 * monster or dungeon - and when it is off the screen an arrow on the screen's edge points the way with the distance.
 * When a step wants a button, a glowing ring and a pointing arrow sit on that button. Finishing a step pops
 * "STEP COMPLETE" with its reward and moves straight on.
 *
 * Every step watches what you really did (wood in your bag, a monster gone, your dash used), so nothing can be
 * clicked past. Progress lives in your hero's save; it can be skipped, and restarted from Save & Settings.
 */
import { h, icon } from './dom.js';
import { play } from '../core/sound.js';
import { TILE } from '../core/constants.js';
import { heroOf } from '../game/hero.js';
import { rpgOf, gainXp } from '../game/rpg.js';
import { hotbarOf, heldSlot } from '../game/tools.js';
import { TOOLS } from '../game/tools.js';
import { CREATURES } from '../data/objects.js';
import { keyOf, keyLabel } from '../core/controls.js';

const TOUCH = () => matchMedia('(pointer: coarse)').matches;
const tileSpot = o => ({ x: (o.x + 0.5) * TILE, y: (o.y + 0.5) * TILE });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The nearest thing of a kind to you, as a point in the world. */
function nearestObject(g, test) {
  const v = heroOf(g);
  if (!v) return null;
  let best = null, bd = Infinity;
  for (const o of g.state.objects) {
    if (!test(o.t)) continue;
    const p = tileSpot(o), d = dist(p, v);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const isTree = t => t.startsWith('tree_') && t !== 'tree_stump';
const isRock = t => t === 'rock' || t.endsWith('_ore');

/** Which hotbar slot holds something (a tool of a kind, or your weapon): -1 if none. */
const slotOf = (g, test) => hotbarOf(g).findIndex(k => k && test(k));
const toolKind = kind => k => TOOLS[k]?.kind === kind;
const holding = (g, test) => { const k = heldSlot(g); return !!k && test(k); };

/*
 * The steps. Each has:
 *   title, hint(g)  - the objective and one line of how, worded for a phone or a keyboard
 *   start(g, t)     - remembers where you started (how much wood you had, and so on)
 *   progress(g, t)  - [have, need]; the step is done when have >= need
 *   target(g, t)    - a point in the world to mark, or null
 *   point(hud, g)   - an element on the screen to point at, or null
 *   gold, xp        - what it pays
 */
export const STEPS = [
  {
    id: 'move', title: 'Walk around', gold: 10, xp: 20,
    hint: () => (TOUCH() ? 'Drag the stick in the bottom corner to walk' : 'Walk with W A S D'),
    start: (g, t) => { const v = heroOf(g); t.from = v ? { x: v.x, y: v.y } : null; t.walked = 0; },
    progress: (g, t) => [Math.min(6, Math.floor((t.walked || 0) / TILE)), 6],
    point: hud => (TOUCH() ? hud.root.querySelector('.hero-stick') : null),
  },
  {
    id: 'chop', title: 'Chop down a tree', gold: 25, xp: 40,
    hint: g => { const i = slotOf(g, toolKind('axe')); return `Hold your axe${i >= 0 && !TOUCH() ? ` (press ${i + 1})` : ''} and swing at a tree until it drops wood`; },
    start: (g, t) => { t.base = g.state.resources.wood || 0; },
    progress: (g, t) => [Math.max(0, Math.min(3, Math.floor((g.state.resources.wood || 0) - t.base))), 3],
    target: g => nearestObject(g, isTree),
    point: (hud, g) => (holding(g, toolKind('axe')) ? attackButton(hud) : slotButton(hud, slotOf(g, toolKind('axe')))),
  },
  {
    id: 'mine', title: 'Mine a rock', gold: 25, xp: 40,
    hint: g => { const i = slotOf(g, toolKind('pickaxe')); return `Take out your pickaxe${i >= 0 && !TOUCH() ? ` (press ${i + 1})` : ''} and break a rock for stone`; },
    start: (g, t) => { t.base = g.state.resources.stone || 0; },
    progress: (g, t) => [Math.max(0, Math.min(3, Math.floor((g.state.resources.stone || 0) - t.base))), 3],
    target: g => nearestObject(g, isRock),
    point: (hud, g) => (holding(g, toolKind('pickaxe')) ? attackButton(hud) : slotButton(hud, slotOf(g, toolKind('pickaxe')))),
  },
  {
    id: 'sword', title: 'Draw your sword', gold: 10, xp: 20,
    hint: g => { const i = slotOf(g, k => k === 'weapon'); return TOUCH() ? 'Tap your weapon on the hotbar' : `Press ${i >= 0 ? i + 1 : 1} to hold your weapon`; },
    progress: g => [holding(g, k => k === 'weapon') ? 1 : 0, 1],
    point: (hud, g) => slotButton(hud, slotOf(g, k => k === 'weapon')),
  },
  {
    id: 'fight', title: 'Defeat a monster', gold: 50, xp: 80,
    hint: () => (TOUCH() ? 'Walk up to it and tap the red sword button to attack' : 'Walk up to it and click (or press Space) to attack'),
    // a practice slime appears nearby if nothing hostile is around, so there is always something to fight
    start: (g, t) => {
      const v = heroOf(g);
      const near = v && g.state.creatures.find(c => CREATURES[c.t]?.hostile && (c.hp ?? 1) > 0 && dist(c, v) < TILE * 20);
      let foe = near;
      if (!foe && v) {
        const a = Math.random() * Math.PI * 2;
        foe = g.spawnCreature?.('slime', v.x + Math.cos(a) * TILE * 7, v.y + Math.sin(a) * TILE * 7) || null;
      }
      t.foe = foe?.id ?? null;
    },
    progress: (g, t) => {
      const foe = t.foe != null && g.state.creatures.find(c => c.id === t.foe);
      if (t.foe != null && (!foe || (foe.hp ?? 1) <= 0)) return [1, 1];
      if (t.foe == null) STEPS.find(s => s.id === 'fight').start(g, t);   // nothing found yet: keep looking
      return [0, 1];
    },
    target: (g, t) => { const foe = t.foe != null && g.state.creatures.find(c => c.id === t.foe); return foe ? { x: foe.x, y: foe.y } : null; },
    point: hud => attackButton(hud),
  },
  {
    id: 'dash', title: 'Dash', gold: 15, xp: 25,
    hint: () => (TOUCH() ? 'Tap the blue boot button to dash out of danger' : `Press ${keyLabel(keyOf('dash'))} to dash out of danger`),
    start: (g, t) => { t.dashed = false; },
    progress: (g, t) => { if (g.hero?.dash) t.dashed = true; return [t.dashed ? 1 : 0, 1]; },
    point: hud => (TOUCH() ? hud.root.querySelector('.hero-dash') : null),
  },
  {
    id: 'bag', title: 'Open your Backpack', gold: 15, xp: 25,
    hint: () => (TOUCH() ? 'Tap Bag: your gear, tools and loot live there' : `Press ${keyLabel(keyOf('backpack'))} or tap Bag: your gear, tools and loot live there`),
    progress: () => [document.querySelector('.backpack-modal') ? 1 : 0, 1],
    point: hud => [...hud.root.querySelectorAll('.dock button')].find(b => /bag|backpack/i.test(b.textContent)) || null,
  },
  {
    id: 'dungeon', title: 'Enter a dungeon', gold: 100, xp: 150,
    hint: () => 'Follow the arrow to a cave mouth and walk in. Bosses and the best loot are down there',
    progress: (g, t, hud) => [hud.dungeon ? 1 : 0, 1],
    target: g => {
      const v = heroOf(g);
      if (!v) return null;
      let best = null, bd = Infinity;
      for (const e of g.state.dungeons || []) { const d = dist(e, v); if (d < bd) { bd = d; best = { x: e.x, y: e.y }; } }
      return best;
    },
  },
];

function attackButton(hud) { return TOUCH() ? hud.root.querySelector('.hero-act') : null; }
function slotButton(hud, i) { return i >= 0 ? hud.root.querySelector(`.hotbar .hot-slot[data-slot="${i}"]`) : null; }

export class HeroTutorial {
  constructor(hud) {
    this.hud = hud;
    this.g = hud.game;
    const r = rpgOf(this.g);
    // a new hero gets it; someone already well on their way is left alone (it can be started from Settings)
    if (!r.tutorial) r.tutorial = (r.level || 1) <= 2 ? { step: 0, done: false } : { step: 0, done: true, skipped: true };
    this.banner = h('div.tq-banner', { hidden: true });
    this.beacon = h('div.tq-beacon', { hidden: true }, h('div.tq-beacon-arrow'), h('div.tq-beacon-ring'));
    this.edge = h('div.tq-edge', { hidden: true }, h('div.tq-edge-arrow'), h('span.tq-edge-dist'));
    this.pointer = h('div.tq-point', { hidden: true }, h('div.tq-point-arrow'));
    hud.root.append(this.banner, this.beacon, this.edge, this.pointer);
    this.key = '';
  }

  get t() { return rpgOf(this.g).tutorial; }
  get active() { return !!this.t && !this.t.done; }

  /** Every frame: check the step, move the markers. */
  frame() {
    const t = this.t;
    const hide = () => { for (const el of [this.banner, this.beacon, this.edge, this.pointer]) if (!el.hidden) el.hidden = true; this.clearGlow(); };
    if (!this.active || this.hud.visiting || this.hud.abroad || this.g.sail) { hide(); return; }
    const step = STEPS[t.step];
    if (!step) { this.finish(); hide(); return; }
    if (!t.started) { t.started = true; t.data = {}; step.start?.(this.g, t.data); }
    // the walking step counts real distance
    const g = this.hud.dungeon || this.g;
    const v = heroOf(g);
    if (step.id === 'move' && v) {
      const from = t.data.from || { x: v.x, y: v.y };
      t.data.walked = (t.data.walked || 0) + Math.min(TILE, Math.hypot(v.x - from.x, v.y - from.y));
      t.data.from = { x: v.x, y: v.y };
    }
    const [have, need] = step.progress(this.g, t.data, this.hud);
    if (have >= need) { this.complete(step); return; }
    this.drawBanner(step, have, need);
    this.drawTarget(this.hud.dungeon ? null : step.target?.(this.g, t.data), v);
    this.drawPointer(step.point?.(this.hud, this.g) || null);
  }

  drawBanner(step, have, need) {
    const key = `${this.t.step}|${have}|${step.hint(this.g)}`;
    this.banner.hidden = false;
    if (key === this.key) return;
    this.key = key;
    this.banner.replaceChildren(
      h('div.tq-top',
        h('span.tq-step', `STEP ${this.t.step + 1} / ${STEPS.length}`),
        h('b.tq-title', step.title),
        need > 1 ? h('span.tq-count', `${have}/${need}`) : null,
        h('span.tq-reward', icon('items/icon_gold', 14), `+${step.gold}`),
        h('button.tq-skip', { title: 'Skip the tutorial', onclick: () => this.skip() }, 'Skip')),
      h('div.tq-hint', step.hint(this.g)),
      h('div.tq-bar', h('i', { style: { width: `${Math.round((this.t.step + (need > 1 ? have / need : 0)) / STEPS.length * 100)}%` } })));
  }

  /** The world marker: over the target when it is on screen, on the screen's edge pointing at it when it is not. */
  drawTarget(p, v) {
    if (!p || !v) { this.beacon.hidden = true; this.edge.hidden = true; return; }
    const r = this.hud.renderer;
    const s = r.worldToScreen(p.x, p.y);
    const W = innerWidth, H = innerHeight, m = 40;
    if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) {
      this.edge.hidden = true;
      this.beacon.hidden = false;
      this.beacon.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
      return;
    }
    this.beacon.hidden = true;
    this.edge.hidden = false;
    const c = { x: W / 2, y: H / 2 };
    const ang = Math.atan2(s.y - c.y, s.x - c.x);
    // where the line from the middle to the target leaves the screen, kept inside a margin
    const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
    const x = c.x + Math.cos(ang) * k, y = c.y + Math.sin(ang) * k;
    this.edge.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.edge.firstChild.style.transform = `rotate(${ang}rad)`;
    this.edge.lastChild.textContent = `${Math.round(Math.hypot(p.x - v.x, p.y - v.y) / TILE)}m`;
  }

  /** A glowing ring and a bouncing arrow on the button the step wants you to press. */
  drawPointer(el) {
    if (!el || !el.isConnected || el.getBoundingClientRect().width < 1) { this.pointer.hidden = true; this.clearGlow(); return; }
    const b = el.getBoundingClientRect();
    this.pointer.hidden = false;
    Object.assign(this.pointer.style, { left: `${b.left - 6}px`, top: `${b.top - 6}px`, width: `${b.width + 12}px`, height: `${b.height + 12}px` });
    // the arrow comes from above, or from below when the button is near the top of the screen
    this.pointer.classList.toggle('below', b.top < 90);
    if (this._glow !== el) { this.clearGlow(); el.classList.add('tq-glow'); this._glow = el; }
  }
  clearGlow() { this._glow?.classList.remove('tq-glow'); this._glow = null; }

  complete(step) {
    const t = this.t;
    this.g.addResource?.('gold', step.gold);
    if (step.xp) gainXp(this.g, step.xp, heroOf(this.hud.dungeon || this.g));
    play('complete');
    this.pop('STEP COMPLETE', `${step.title}`, `+${step.gold} gold  ·  +${step.xp} XP`);
    t.step++;
    t.started = false;
    this.key = '';
    this.clearGlow();
    if (t.step >= STEPS.length) this.finish();
    this.g.emit?.('change');
  }

  finish() {
    const t = this.t;
    if (t.done) return;
    t.done = true;
    this.g.addResource?.('gold', 150);
    const r = rpgOf(this.g);
    r.raceStones = (r.raceStones || 0) + 1;   // something worth having: a roll on the race wheel
    play('reveal');
    setTimeout(() => this.pop('TUTORIAL COMPLETE', 'You are ready, adventurer', '+150 gold  ·  +1 Race Stone', true), 1300);
    this.g.emit?.('change');
  }

  pop(head, title, reward, big = false) {
    this.hud.root.querySelector('.tq-pop')?.remove();
    const el = h(`div.tq-pop${big ? '.big' : ''}`, h('div.tq-pop-head', head), h('div.tq-pop-title', title), h('div.tq-pop-reward', reward));
    this.hud.root.append(el);
    setTimeout(() => el.remove(), big ? 3200 : 1800);
  }

  skip() {
    const t = this.t;
    t.done = true; t.skipped = true;
    this.clearGlow();
    this.hud.hint?.('Tutorial skipped. You can start it again from Save & Settings.', 2600);
  }

  restart() {
    rpgOf(this.g).tutorial = { step: 0, done: false };
    this.key = '';
  }

  destroy() {
    this.clearGlow();
    for (const el of [this.banner, this.beacon, this.edge, this.pointer]) el.remove();
  }
}
