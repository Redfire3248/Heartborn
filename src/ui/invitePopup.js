/*
 * Invitations pop up wherever you are - on the menu or in the middle of playing - with a Join button.
 *
 * Someone invites you by your username (no code, no need to be friends); the moment it arrives a card slides in at
 * the top of the screen: who it is from, which server, Join or Not now. Not now leaves it on the Multiplayer page;
 * Join takes you straight there. Old invitations (from before this visit) wait quietly on the Multiplayer page.
 */
import { h, icon } from './dom.js';
import { play } from '../core/sound.js';
import * as social from '../net/social.js';

const FRESH_MS = 30 * 60 * 1000;   // an invitation older than this is not news any more

/** Starts watching your invitations; onJoin(invite) is called when you press Join. Returns a stop function. */
export function watchInvitePopups(uid, onJoin) {
  const shown = new Set();
  const holder = h('div.invite-pops');
  document.getElementById('ui').append(holder);
  const unsub = social.watchInvites(uid, list => {
    for (const inv of list) {
      const key = `${inv.wid}:${inv.ts}`;
      if (shown.has(key)) continue;
      shown.add(key);
      if (Date.now() - (inv.ts || 0) > FRESH_MS) continue;
      pop(inv);
    }
  });

  function pop(inv) {
    const close = () => { card.classList.add('going'); setTimeout(() => card.remove(), 200); };
    const join = h('button.btn.sm.primary', {
      onclick: async () => {
        join.disabled = true; join.textContent = 'Joining…';
        try { await onJoin(inv); close(); } catch (e) { join.disabled = false; join.textContent = 'Join'; note.textContent = e.message; }
      },
    }, 'Join');
    const note = h('span.invite-pop-note');
    const card = h('div.card.invite-pop',
      icon('buildings/fortress', 30),
      h('div.invite-pop-text', h('b', `${inv.fromName || 'Someone'} invited you`), h('span', `to ${inv.name || 'their server'}`), note),
      h('button.btn.sm.ghost', { onclick: close }, 'Not now'),
      join);
    holder.append(card);
    play('reveal');
    setTimeout(() => { if (card.isConnected && !join.disabled) close(); }, 45000);   // it stays on the Multiplayer page
  }

  return () => { unsub?.(); holder.remove(); };
}
