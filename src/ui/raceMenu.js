/*
 * The Races screen: who you are, what it gives you, and the stone that changes it.
 *
 * Laid out like a proper roll screen: CURRENT RACE across the top, your character big in the middle, your race slots
 * and what your race does on the left, the odds of every race on the right, and one big Reroll button underneath.
 *
 * Rolling runs a slot-machine reel through the middle: every race slides up past the centre line, the one on the line
 * big and bright and the others shrinking and fading away from it, slowing until it stops on what you rolled - and
 * only then is it yours (the result is decided when you press, handed over when it lands).
 */
import { h, icon, modal, toggleMenu } from './dom.js';
import { play } from '../core/sound.js';
import {
  RACES, RACE_TIERS, tierOf, raceOf, lookOf, raceArt, setRace,
  stonesOf, decideRoll, applyRoll, raceSlots, RACE_SLOTS, acceptRoll, dropRace, rollOrder,
  BASES, baseOf, setBase, previewOf,
} from '../game/races.js';

const pct = m => `${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`;
const STATS = [['Health', 'hp'], ['Damage', 'dmg'], ['Speed', 'speed'], ['Stamina', 'stamina'], ['Crit', 'crit']];

/** "Keen Eye: half again as likely..." -> ['Keen Eye', 'half again as likely...'] */
const splitPassive = p => { const i = String(p || '').indexOf(': '); return i > 0 ? [p.slice(0, i), p.slice(i + 2)] : ['Passive', p || '']; };

export function openRaceMenu(hud) {
  if (toggleMenu('race-modal', { sameView: true })) return null;
  const g = hud.game;
  applyRoll(g);   // a spin that was cut short by closing the window is handed over now
  const m = modal([], { cls: 'race-modal', closeX: true, onClose: () => { applyRoll(g); cancelAnimationFrame(raf); } });
  let spinning = false;
  let pending = null;   // a roll that landed with no slot free
  let raf = 0;

  // ---------------------------------------------------------------- left: slots and perks
  const slots = () => {
    const held = raceSlots(g);
    const cells = [];
    for (let i = 0; i < RACE_SLOTS; i++) {
      const k = held[i];
      if (!k) { cells.push(h('div.rr-slot.empty', h('span.rr-slot-plus', '+'), h('span', 'Empty'))); continue; }
      const d = RACES[k], t = RACE_TIERS[d.tier];
      cells.push(h(`button.rr-slot${raceOf(g) === k ? '.on' : ''}`, {
        style: { '--tc': t.color }, title: `${d.name} · ${t.name}`, disabled: spinning,
        onclick: () => { setRace(g, k); play('click'); render(); },
      }, icon(previewOf(g, k), 40), h('span', d.name), raceOf(g) === k ? h('i.rr-slot-sel', 'Wearing') : null,
      held.length > 1 && !spinning ? h('span.rr-slot-drop', { title: 'Let this one go', onclick: e => { e.stopPropagation(); dropRace(g, k); play('click'); render(); } }, '✕') : null));
    }
    return h('div.rr-slots', ...cells);
  };

  const perks = def => {
    const [name, text] = splitPassive(def.passive);
    const chips = STATS.filter(([, k]) => def.mult[k] !== 1).map(([label, k]) => h(`span.rr-stat${def.mult[k] > 1 ? '.up' : '.down'}`, `${label} ${pct(def.mult[k])}`));
    return h('div.rr-perks',
      h('div.rr-perk', h('b', name), h('span', text)),
      chips.length ? h('div.rr-perk', h('b', 'Numbers'), h('div.rr-stats', ...chips)) : null,
      h('div.rr-perk.faint-perk', h('span', def.desc)));
  };

  // ---------------------------------------------------------------- right: the odds
  const chances = () => {
    const order = rollOrder();
    const total = order.reduce((n, k) => n + (RACES[k].weight || 0), 0) || 1;
    const held = new Set(raceSlots(g));
    return h('div.rr-odds', ...[...order].sort((a, b) => RACES[b].weight - RACES[a].weight).map(k => {
      const d = RACES[k], t = RACE_TIERS[d.tier];
      const p = (d.weight / total) * 100;
      return h(`div.rr-odd${held.has(k) ? '.held' : ''}`, { style: { '--tc': t.color } },
        h('i.rr-dot'), h('span.rr-odd-name', d.name), h('b', `${p < 1 ? p.toFixed(1) : Math.round(p)}%`));
    }));
  };

  // ---------------------------------------------------------------- the middle: you, or the reel
  const stage = h('div.rr-stage');
  const CELL = 64;
  const character = () => {
    const key = raceOf(g), def = RACES[key];
    stage.replaceChildren(
      h('div.rr-glow', { style: { '--rc': def.color } }),
      h('div.rr-char', icon(raceArt(lookOf(g)), 150)),
      h('div.rr-bases', ...BASES.map(b => h(`button.rr-base${baseOf(g) === b.id ? '.on' : ''}`,
        { title: `${b.name}: ${b.desc}`, disabled: spinning, onclick: () => { setBase(g, b.id); play('click'); render(); } }, b.name))));
  };

  /**
   * The reel. Laps of every race in a column slide up past the centre line and stop with the winner dead on it.
   * Each frame, every cell is sized by how close it is to the line, so the one passing the middle is big and bright
   * and the rest shrink and fade - the slot-machine look.
   */
  const spin = async () => {
    if (spinning) return;
    const res = decideRoll(g);   // decided now, handed over when the reel stops
    if (res.error) { hud.hint(res.error, 2200); return; }
    spinning = true;
    render();
    const order = rollOrder();
    const laps = 8;
    const cells = [];
    for (let r = 0; r < laps; r++) for (const k of order) cells.push(k);
    const landAt = cells.length - order.length + order.indexOf(res.key);
    const strip = h('div.rr-strip', ...cells.map(k => {
      const d = RACES[k], t = RACE_TIERS[d.tier];
      return h('div.rr-cell', { style: { '--tc': t.color } }, icon(previewOf(g, k), 52), h('span', d.name));
    }));
    const reel = h('div.rr-reel', h('div.rr-line.top'), h('div.rr-line.bottom'), strip);
    stage.replaceChildren(h('div.rr-glow.spin'), reel);
    const height = reel.clientHeight || 220;
    const target = -(landAt * CELL) + height / 2 - CELL / 2;
    const dur = 4200 + res.tier * 600;                       // the rarer it is, the longer it teases
    strip.style.transform = 'translateY(0px)';
    void strip.offsetHeight;
    strip.style.transition = `transform ${dur}ms cubic-bezier(.08,.75,.12,1)`;
    strip.style.transform = `translateY(${target}px)`;
    play('reveal');

    // size every cell by its distance from the line, every frame, and tick as each one crosses it
    const kids = [...strip.children];
    let lastIdx = -1;
    const frame = () => {
      const y = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42;
      const mid = height / 2 - y - CELL / 2;               // which cell position sits on the line right now
      const idx = Math.round(mid / CELL);
      if (idx !== lastIdx) { lastIdx = idx; play('click'); }
      for (let i = Math.max(0, idx - 4); i <= Math.min(kids.length - 1, idx + 4); i++) {
        const dd = Math.abs(i * CELL - mid) / CELL;       // 0 on the line, 1 a cell away
        const s = Math.max(0.55, 1.35 - dd * 0.45);
        kids[i].style.scale = String(s);
        kids[i].style.opacity = String(Math.max(0.15, 1 - dd * 0.4));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    await new Promise(r => setTimeout(r, dur + 200));
    cancelAnimationFrame(raf);
    // the winner, on the line: a flash, and then it is yours
    const win = kids[landAt];
    win.style.scale = '1.5'; win.style.opacity = '1';
    win.classList.add('rr-win');
    await new Promise(r => setTimeout(r, 650));
    spinning = false;
    applyRoll(g);
    if (res.needsSlot) pending = { key: res.key, look: res.look };
    const d = RACES[res.key], tier = RACE_TIERS[d.tier];
    hud.toast?.({ text: `${res.fresh ? 'New race! ' : ''}${d.name} · ${tier.name}`, kind: res.tier >= 3 ? 'good' : 'event' });
    if (res.tier >= 3) { g.fx.shake = Math.max(g.fx.shake || 0, 2.5); play('complete'); }
    render();
    stage.classList.add('rr-reveal');
    setTimeout(() => stage.classList.remove('rr-reveal'), 900);
  };

  /** The reel landed but every slot is full: pick which one it pushes out. */
  const replacePrompt = () => {
    if (!pending) return null;
    const d = RACES[pending.key], t = RACE_TIERS[d.tier];
    return h('div.rr-replace', { style: { '--rc': d.color } },
      icon(previewOf(g, pending.key), 48),
      h('div', h('b', { style: { color: d.color } }, `${d.name} · ${t.name}`), h('div.faint', 'Your slots are full. Which one does it replace?')),
      h('div.rr-replace-picks', ...raceSlots(g).map((k, i) => h('button.btn.sm', { onclick: () => { acceptRoll(g, pending.key, pending.look, i); pending = null; play('complete'); render(); } }, RACES[k].name))),
      h('button.btn.sm.ghost', { onclick: () => { pending = null; render(); } }, 'Let it go'));
  };

  const render = () => {
    const key = raceOf(g), def = RACES[key], tier = tierOf(key);
    const stones = stonesOf(g);
    if (!spinning) character();
    m.el.replaceChildren(m.closeBtn,
      h('div.rr',
        h('div.rr-top',
          h('span.rr-top-cap', spinning ? 'Rolling…' : 'Current race'),
          h('div.rr-top-name', { style: { color: def.color } }, spinning ? '???' : def.name),
          spinning ? null : h('span.rr-tier', { style: { color: tier.color, borderColor: `${tier.color}88` } }, tier.name)),
        h('div.rr-panel.rr-left',
          h('div.rr-panel-head', 'Race stats'),
          h('div.rr-sub', `Race slots ${raceSlots(g).length}/${RACE_SLOTS}`),
          slots(),
          h('div.rr-sub', 'Race perks'),
          perks(def)),
        stage,
        h('div.rr-panel.rr-right',
          h('div.rr-panel-head', 'Race chances'),
          chances()),
        h('div.rr-bottom',
          h('span.rr-stones', icon('items/mat_star_shard', 18), `Stones: ${stones}`),
          h('button.btn.primary.rr-roll', { disabled: spinning || stones < 1, onclick: spin }, spinning ? 'Rolling…' : 'Reroll'),
          h('span.rr-hint.faint', stones ? 'What it lands on is yours' : 'Stones drop from bosses, elites and deep chests')),
        replacePrompt()));
  };
  render();
  return m;
}
