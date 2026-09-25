/*
 * The Races screen: who you are, everyone you have been, and the stone that changes it.
 *
 * You do not simply pick a race. A Race Stone is a rare thing that falls from bosses and deep chests, and spending
 * one spins the wheel — a reel of faces that races past, slows, and lands on whatever the sea of chance gives you.
 * What it lands on is yours for good, so the wall fills up over time and you can go back to anything you have
 * already rolled for nothing.
 */
import { h, icon, modal, toggleMenu } from './dom.js';
import { play } from '../core/sound.js';
import {
  RACES, RACE_KEYS, RACE_TIERS, tierOf, raceOf, lookOf, raceArt, setRace, setLookOnly,
  stonesOf, rollRace, raceSlots, RACE_SLOTS, slotsFull, acceptRoll, dropRace, rollOrder,
  BASES, baseOf, setBase, previewOf,
} from '../game/races.js';

const pct = m => `${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`;

export function openRaceMenu(hud) {
  if (toggleMenu('race-modal', { sameView: true })) return null;
  const g = hud.game;
  const m = modal([], { cls: 'race-modal', closeX: true });
  let spinning = false;
  let pending = null;   // a roll that landed with no slot free

  /** The five numbers a race moves, as chips. */
  const statChips = def => [['Health', def.mult.hp], ['Damage', def.mult.dmg], ['Speed', def.mult.speed], ['Stamina', def.mult.stamina], ['Crit', def.mult.crit]]
    .filter(([, x]) => x !== 1)
    .map(([label, x]) => h(`span.race-stat${x > 1 ? '.up' : '.down'}`, `${label} ${pct(x)}`));

  /** Your current character, big, with everything it gives you. */
  const you = () => {
    const key = raceOf(g), def = RACES[key], tier = tierOf(key);
    return h('div.race-you', { style: { '--rc': def.color } },
      h('div.race-you-art', icon(raceArt(lookOf(g)), 108)),
      h('div.race-you-text',
        h('div.race-you-head', h('h3', { style: { color: def.color } }, def.name), h('span.race-tier', { style: { color: tier.color, borderColor: `${tier.color}66` } }, tier.name)),
        h('div.faint', def.desc),
        h('div.race-stats', ...statChips(def)),
        h('div.race-passive', def.passive)));
  };

  /**
   * The wheel. A long strip of faces slides past under a marker; it starts fast, eases down over a few seconds and
   * stops with the one you rolled dead centre. The strip is built so the winner is always the same cell, so the
   * landing is exact however long the spin runs.
   */
  const reel = h('div.race-reel');
  const strip = h('div.race-strip');
  reel.append(h('div.race-marker'), strip);

  const CELL = 92;
  const spin = async () => {
    if (spinning) return;
    const res = rollRace(g);
    if (res.error) { hud.hint(res.error, 2200); return; }
    spinning = true;
    render();
    const order = rollOrder();
    const reps = 7;                                      // how many times the wheel goes round
    const cells = [];
    for (let r = 0; r < reps; r++) for (const k of order) cells.push(k);
    const landAt = cells.length - order.length + order.indexOf(res.key);   // a winner in the last lap
    strip.replaceChildren(...cells.map(k => {
      const d = RACES[k], t = RACE_TIERS[d.tier];
      return h('div.race-cell', { style: { '--rc': d.color, '--tc': t.color } }, icon(previewOf(g, k), 60), h('span', d.name));
    }));
    const width = reel.clientWidth || 420;
    const offset = () => -(landAt * CELL) + width / 2 - CELL / 2;
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';
    void strip.offsetWidth;
    const dur = 3600 + res.tier * 500;                   // the rarer it is, the longer it teases
    strip.style.transition = `transform ${dur}ms cubic-bezier(.12,.72,.14,1)`;
    strip.style.transform = `translateX(${offset()}px)`;
    play('reveal');
    // a tick as each face goes by, thinning out as the wheel slows
    let t = 0;
    const tick = () => {
      if (t > dur) return;
      play('click');
      t += 70 + (t / dur) * 520;
      setTimeout(tick, 70 + (t / dur) * 520);
    };
    tick();
    await new Promise(r => setTimeout(r, dur + 250));
    spinning = false;
    if (res.needsSlot) pending = { key: res.key, look: res.look };
    const d = RACES[res.key], tier = RACE_TIERS[d.tier];
    hud.toast?.({ text: `${res.fresh ? 'New race! ' : ''}${d.name} — ${tier.name}`, kind: res.tier >= 3 ? 'good' : 'event' });
    if (res.tier >= 3) { g.fx.shake = Math.max(g.fx.shake || 0, 2.5); play('complete'); }
    render();
  };

  /** Your three slots: what you are holding, and empty sockets for what you have not rolled yet. */
  const wall = () => {
    const held = raceSlots(g);
    const cells = [];
    for (let i = 0; i < RACE_SLOTS; i++) {
      const k = held[i];
      if (!k) { cells.push(h('div.race-slot.empty', h('span', 'Empty slot'))); continue; }
      const d = RACES[k], t = RACE_TIERS[d.tier];
      cells.push(h(`button.race-slot${raceOf(g) === k ? '.on' : ''}`, { style: { '--tc': t.color }, title: `${d.name} · ${t.name}`, onclick: () => { setRace(g, k); play('click'); render(); } },
        icon(previewOf(g, k), 46), h('span', d.name), h('i.race-slot-tier', { style: { background: t.color } }),
        held.length > 1 ? h('span.race-slot-drop', { title: 'Let this one go', onclick: e => { e.stopPropagation(); dropRace(g, k); play('click'); render(); } }, '✕') : null));
    }
    return h('div.race-wall', ...cells);
  };

  /** The wheel landed but every slot is full: pick which one it pushes out. */
  const replacePrompt = () => {
    if (!pending) return null;
    const d = RACES[pending.key], t = RACE_TIERS[d.tier];
    return h('div.race-replace', { style: { '--rc': d.color } },
      icon(previewOf(g, pending.key), 52),
      h('div', h('b', { style: { color: d.color } }, `${d.name} — ${t.name}`), h('div.faint', 'Your slots are full. Which one does it take the place of?')),
      h('div.race-replace-picks', ...raceSlots(g).map((k, i) => h('button.btn.sm', { onclick: () => { acceptRoll(g, pending.key, pending.look, i); pending = null; play('complete'); render(); } }, RACES[k].name))),
      h('button.btn.sm.ghost', { onclick: () => { pending = null; render(); } }, 'Let it go'));
  };

  /**
   * Which of the two people you are. A race is a version of this person, so the same character runs all the way
   * through: the zombie you is the human you, dead.
   */
  const whoAmI = () => h('div.race-chars',
    h('div.race-chars-head', h('b', 'Your character'), h('span.faint', 'Every race is a version of this person')),
    h('div.race-bases', ...BASES.map(b => h(`button.race-base${baseOf(g) === b.id ? '.on' : ''}`,
      { title: b.desc, onclick: () => { setBase(g, b.id); play('click'); render(); } },
      icon(`races/${raceOf(g)}_${b.id}`, 64),
      h('b', b.name),
      h('i', b.id === baseOf(g) ? 'you' : 'switch')))));

  const render = () => {
    const stones = stonesOf(g);
    m.el.replaceChildren(m.closeBtn,
      h('div.race-head',
        icon('items/mat_star_shard', 26), h('h2', 'Races'),
        h('span.faint', `${raceSlots(g).length} / ${RACE_SLOTS} slots`),
        h('div.spacer'),
        h('span.race-stones', icon('items/mat_star_shard', 18), h('b', String(stones)), ' Race Stone', stones === 1 ? '' : 's')),
      you(),
      h('div.race-roll',
        reel,
        h('div.race-roll-side',
          h('button.btn.primary.race-spin', { disabled: spinning || stones < 1, onclick: spin }, spinning ? 'Rolling…' : stones ? 'Spend a stone' : 'No stones'),
          h('div.faint', stones
            ? 'Whatever it lands on is yours for good.'
            : 'Race Stones fall from bosses, elites and the chests on deep floors.'))),
      replacePrompt(),
      h('div.race-wall-head', h('b', `Your races (${raceSlots(g).length}/${RACE_SLOTS})`), h('span.faint', 'Click one to wear it, for nothing. A fourth roll pushes one out.')),
      wall(),
      whoAmI());
  };
  render();
  return m;
}
