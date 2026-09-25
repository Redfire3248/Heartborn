/*
 * Hatching an egg, properly.
 *
 * An egg used to become a pet the instant you pressed the button, which is a waste of the best moment a pet has.
 * Now the egg comes up on a dark stage, wobbles, cracks three times with a shake and a burst of light each time,
 * and finally bursts open — the rarer what is inside, the longer it teases, the harder the shake and the brighter
 * the light. The pet rises out of the shell, and only then does its name and what it does appear.
 *
 * The result is decided before any of this runs, so nothing here can change what you got: it only shows it.
 */
import { h, modal, icon } from './dom.js';
import { spriteAvailable, iconUrl } from '../core/assets.js';
import { play } from '../core/sound.js';
import { PETS } from '../game/pets.js';
import { RARITY } from '../game/rpg.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

/**
 * Plays the hatch for a pet that has already been rolled. Resolves when the reveal is on screen; the window stays
 * until it is closed, so the player can read what they got.
 */
export async function playHatch(hud, pet) {
  const def = PETS[pet.kind];
  const R = RARITY[def.rarity] || RARITY[0];
  const shakes = 3 + def.rarity;                      // a rarer egg fights harder to open
  const stage = h('div.egg-stage', { style: { '--pc': R.color } });
  // the shell matches what is inside, and turns to the cracked one on the last blow
  const EGGS = ['pets/egg_common', 'pets/egg_rare', 'pets/egg_epic', 'pets/egg_legendary', 'pets/egg_mythic'];
  const shellKey = EGGS[Math.min(EGGS.length - 1, def.rarity)];
  const shell = icon(shellKey, 104);
  const egg = h('div.egg', shell);
  const rays = h('div.egg-rays');
  const out = h('div.egg-out');
  stage.append(rays, egg, out);
  const m = modal([stage], { cls: 'egg-modal', closeX: true });

  egg.classList.add('idle');
  play('click');
  await wait(600);

  for (let i = 0; i < shakes; i++) {
    egg.classList.remove('crack');
    void egg.offsetWidth;
    egg.style.setProperty('--shake', String(1 + i * 0.6));
    egg.classList.add('crack');
    play('click');
    hud.game.fx.shake = Math.max(hud.game.fx.shake || 0, 0.6 + i * 0.4);
    stage.style.setProperty('--glow', String(0.2 + (i + 1) / shakes * 0.8));
    if (i === shakes - 1 && spriteAvailable('pets/egg_hatching')) shell.src = iconUrl('pets/egg_hatching');
    await wait(430 + i * 90);
  }

  // it bursts: the shell goes, light floods out, and the pet rises through it
  egg.classList.add('burst');
  rays.classList.add('on');
  play('reveal');
  hud.game.fx.shake = Math.max(hud.game.fx.shake || 0, 2.4 + def.rarity * 0.6);
  await wait(260);
  egg.remove();
  out.append(
    h('div.egg-pet', icon(def.sprite, 108)),
    h('div.egg-name', { style: { color: R.color } }, def.name),
    h('div.egg-rarity', { style: { color: R.color, borderColor: `${R.color}66` } }, R.name),
    h('div.faint.egg-desc', def.desc),
    h('button.btn.primary', { onclick: () => m.close() }, 'Take it with you'),
  );
  out.classList.add('on');
  if (def.rarity >= 3) { play('complete'); hud.toast?.({ text: `${R.name} pet: ${def.name}!`, kind: 'good' }); }
  return m;
}
