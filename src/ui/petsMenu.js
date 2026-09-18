/*
 * The Pets window: hatch your eggs, pick the pet that follows you, or let one go.
 */
import { h, icon, modal, rarityFrame, confirmModal } from './dom.js';
import { play } from '../core/sound.js';
import { RARITY } from '../game/rpg.js';
import { PETS, petsOf, hatch, choosePet, releasePet } from '../game/pets.js';

export function openPets(hud) {
  const g = hud.game;
  const m = modal([], { cls: 'pets-modal', closeX: true });
  const render = () => {
    const r = petsOf(g);
    const cards = r.pets.map(p => {
      const def = PETS[p.kind], fr = rarityFrame(def.rarity), on = r.pet === p.id;
      return h(`div.pet-card${on ? '.on' : ''}`,
        h(`div.pet-pic${fr.cls}`, { style: fr.style }, icon(def.sprite, 52)),
        h('b', { style: { color: RARITY[def.rarity].color } }, p.name),
        h('div.faint.pet-desc', `${RARITY[def.rarity].name} · ${def.desc}`),
        h('div.row.pet-btns',
          h(`button.btn.sm${on ? '.primary' : ''}`, { onclick: () => { choosePet(g, p.id); play('click'); render(); } }, on ? 'Following' : 'Follow me'),
          h('button.btn.sm.ghost', { onclick: async () => { if (await confirmModal('Release pet?', `${p.name} will leave for good.`, { okLabel: 'Release', okClass: 'danger' })) { releasePet(g, p.id); render(); } } }, 'Release')));
    });
    m.el.replaceChildren(m.closeBtn,
      h('div.table-head', icon('pets/happy', 32), h('div', h('h2', 'Pets'), h('div.faint', 'Bosses sometimes drop a pet egg. Hatch it to see what you get; the pet you pick follows you, fetches loot and helps.'))),
      h('div.egg-row', icon('pets/egg_common', 40), h('div', h('b', `Eggs: ${r.eggs}`), h('div.faint', 'Common 45% · Rare 30% · Epic 16% · Legendary 7.5% · Mythic 1.5%')),
        h(`button.btn${r.eggs ? '.primary' : ''}`, { disabled: !r.eggs, onclick: () => { const p = hatch(g); if (!p) return; play('reveal'); hud.rareLootReveal?.({ pet: p }); render(); } }, 'Hatch')),
      cards.length ? h('div.pet-grid', ...cards) : h('div.faint', 'No pets yet. Defeat bosses to find eggs.'));
  };
  render();
  return m;
}
