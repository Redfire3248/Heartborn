import { h, icon, avatar, modal, timeAgo, confirmModal } from './dom.js';
import { BASES, lastBase, lookFor } from '../game/races.js';
import { hasCharacter } from '../game/characters.js';
import { ERAS } from '../data/buildings.js';
import * as social from '../net/social.js';

/*
 * World picker (shown after signing in), player profiles and friends.
 */

const ui = () => document.getElementById('ui');

// ------------------------------------------------------------------ world picker

/** Resolves with { world, name, kind, seed, importOld } once the player picks (or makes) a world. */
/**
 * Who you are before you pick a world. There are two people in the game and every race is a version of one of
 * them, so this is the one choice that outlives a world: it is remembered and every new world starts with it.
 */
function basePicker() {
  const wrap = h('div.wp-base');
  const draw = () => {
    const now = lastBase();
    wrap.replaceChildren(
      h('span.wp-base-cap', 'Character'),
      ...BASES.filter(b => hasCharacter(b.id)).map(b => h(`button.wp-base-btn${now === b.id ? '.on' : ''}`, {
        title: `${b.name} — ${b.desc}`,
        onclick: () => { try { localStorage.setItem('hb_base', b.id); } catch { /* private window */ } draw(); },
      }, icon(`races/${lookFor('human', b.id)}`, 34), h('span', b.name))));
  };
  draw();
  return wrap;
}

export function worldPicker({ user, username, lastWorld = null, listWorldSaves, deleteWorldSave, oldVillage }) {
  return new Promise(resolve => {
    const unsubs = [];
    const body = h('div.wp-grid');
    const side = h('div.wp-side');
    const err = h('div.error-text');
    const root = h('div.screen.world-picker',
      h('div.card.wp',
        h('div.wp-head', icon('buildings/castle', 40),
          h('div', h('h2', 'Worlds'), h('div.faint', `Playing as ${username} · every world is different, with its own land, monsters, loot and save`)),
          h('div.spacer'),
          basePicker(),
          h('button.btn.sm.ghost.back-btn', { onclick: () => { for (const u of unsubs) u(); root.remove(); resolve({ back: true }); } }, '← Back')),
        h('div.wp-body', h('div.col', body, err), side)));
    ui().append(root);

    const choose = c => { for (const u of unsubs) u(); root.remove(); resolve(c); };
    const tryAction = async fn => { err.textContent = ''; try { await fn(); } catch (e) { err.textContent = e.message; } };

    let saves = null, invites = [], old = null, rejoin = null;
    const load = async () => {
      saves = await listWorldSaves(user.uid).catch(() => []);
      if (!saves.some(s => s.kind === 'solo')) old = await oldVillage(user.uid).catch(() => null);
      render();
      refreshFriends();   // now that we know your servers, friends can be invited to them
    };
    if (lastWorld && !lastWorld.wid.startsWith('solo')) {
      social.getWorld(lastWorld.wid).then(async w => {
        if (!w) return;
        rejoin = { ...lastWorld, name: w.name, seed: w.seed, players: await social.worldMemberCount(lastWorld.wid).catch(() => 0) };
        render();
      }).catch(() => {});
    }

    // new solo world: name + optional seed (the world type shows as you type)
    const newName = h('input.input', { placeholder: 'World name', maxLength: 28 });
    const newSeed = h('input.input', { placeholder: 'Seed (empty = random)', maxLength: 12, inputMode: 'numeric' });
    let randomSeed = Math.floor(Math.random() * 2 ** 31);
    const seedOf = () => { const v = newSeed.value.trim(); if (!v) return randomSeed; const n = Number(v); return Number.isFinite(n) ? Math.abs(Math.floor(n)) % 2 ** 31 : [...v].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 2 ** 31; };

    // servers
    const serverName = h('input.input', { placeholder: 'Server name', maxLength: 28 });
    const code = h('input.input', { placeholder: 'Server code', maxLength: 6, style: { textTransform: 'uppercase' } });

    const worldCard = s => h('div.wp-card.world',
      icon('nature/tree_oak', 44),   // every world holds every biome, so none is labelled as one of them
      h('div',
        h('div.wp-title', s.name || 'World'),
        h('div.faint', `${s.hero ? `${s.hero} · ` : ''}Lv ${s.level || 1} · Day ${s.day || 1}${s.updatedAt ? ` · played ${timeAgo(s.updatedAt)}` : ''}`)),
      h('div.row',
        h('button.btn.sm.ghost', { title: 'Delete this world forever', onclick: () => tryAction(async () => {
          if (!(await confirmModal(`Delete ${s.name}?`, 'The world and everything you did in it are gone for good.', { okLabel: 'Delete', okClass: 'danger' }))) return;
          await deleteWorldSave(user.uid, s.wid);
          if (s.kind === 'server') await social.leaveWorld(user.uid, s.wid).catch(() => {});
          await load();
        }) }, s.kind === 'server' ? 'Leave' : 'Delete'),
        h('button.btn.sm.primary', { onclick: () => choose({ world: s.wid, name: s.name, kind: s.kind, seed: s.seed }) }, 'Play')));

    const render = () => {
      if (!saves) { body.replaceChildren(h('div.faint', 'Loading your worlds...')); return; }
      const solos = saves.filter(s => s.kind === 'solo'), servers = saves.filter(s => s.kind === 'server');
      body.replaceChildren(...[
        rejoin && !servers.some(s => s.wid === rejoin.wid) ? h('button.wp-card.rejoin', { onclick: () => choose({ world: rejoin.wid, name: rejoin.name, kind: 'server', seed: rejoin.seed }) },
          icon('buildings/fortress', 44), h('div', h('div.wp-title', `Rejoin ${rejoin.name}`), h('div.faint', `${rejoin.players} player${rejoin.players === 1 ? '' : 's'} · the server is still there`)), h('span.btn.sm.good', 'Rejoin')) : null,

        h('h3', 'Your worlds'),
        old ? h('div.wp-card.rejoin',
          icon('buildings/campfire', 44),
          h('div', h('div.wp-title', `Bring back ${old.owner?.villageName || 'your old village'}`), h('div.faint', 'Your village from before worlds had their own saves: it becomes your first world.')),
          h('button.btn.sm.good', { onclick: () => choose({ world: `solo_${Date.now().toString(36)}`, name: old.owner?.villageName || 'My World', kind: 'solo', seed: old.seed, importOld: old }) }, 'Bring it')) : null,
        ...solos.map(worldCard),
        !solos.length && !old ? h('div.faint', 'No worlds yet. Make your first one below.') : null,
        h('div.wp-new',
          h('div.wp-new-head', h('b', 'New world')),
          h('div.row.wrap', newName, newSeed),
          h('button.btn.primary', { onclick: () => tryAction(async () => {
            const name = newName.value.trim() || `${username}'s World`;
            choose({ world: `solo_${Date.now().toString(36)}`, name, kind: 'solo', seed: seedOf(), isNew: true });
          }) }, 'Create world')),

        invites.length ? h('h3', 'Invitations') : null,
        ...invites.map(inv => h('div.wp-card.invite',
          icon('items/scroll', 36),
          h('div', h('div.wp-title', inv.name), h('div.faint', `${inv.fromName} invited you · ${timeAgo(inv.ts)}`)),
          h('div.row',
            h('button.btn.sm.ghost', { onclick: () => tryAction(() => social.declineInvite(user.uid, inv.wid)) }, 'Decline'),
            h('button.btn.sm.good', { onclick: () => tryAction(async () => { await social.joinWorld(user.uid, inv.wid, inv.name); const w = await social.getWorld(inv.wid); choose({ world: inv.wid, name: inv.name, kind: 'server', seed: w?.seed }); }) }, 'Join')))),

        h('h3', 'Servers'),
        h('div.faint', 'Servers stay up for good: make one, share its code, and anyone can join any time.'),
        ...servers.map(worldCard),
        h('div.wp-actions',
          h('div.row', serverName, h('button.btn.primary', { onclick: () => tryAction(async () => {
            const w = await social.createWorld(user.uid, username, serverName.value);
            choose({ world: w.wid, name: w.name, kind: 'server', seed: w.seed, code: w.code });
          }) }, 'Create server')),
          h('div.row', code, h('button.btn', { onclick: () => tryAction(async () => {
            const w = await social.joinWorldByCode(user.uid, code.value);
            choose({ world: w.wid, name: w.name, kind: 'server', seed: w.seed });
          }) }, 'Join'))),
      ].filter(Boolean));
    };

    unsubs.push(social.watchInvites(user.uid, async list => {
      const alive = await Promise.all(list.map(async inv => ((await social.getWorld(inv.wid).catch(() => null)) ? inv : (social.declineInvite(user.uid, inv.wid).catch(() => {}), null))));
      invites = alive.filter(Boolean);
      render();
    }));
    const friendsHolder = h('div.col');
    side.append(friendsHolder);
    let friendsOff = friendsPanel(friendsHolder, { user, username });
    const refreshFriends = () => { friendsOff?.(); friendsOff = friendsPanel(friendsHolder, { user, username, worlds: (saves || []).filter(s => s.kind === 'server').map(s => ({ wid: s.wid, name: s.name })) }); };
    unsubs.push(() => friendsOff?.());
    render();
    load();
  });
}

// ------------------------------------------------------------------ lobby

/** Waiting room for a private world. Resolves 'start' when the host starts it, or 'leave'. */
export function lobbyScreen({ user, username, world }) {
  return new Promise(resolve => {
    const unsubs = [];
    const isHost = world.owner === user.uid;
    const members = h('div.col');
    const side = h('div.wp-side');
    const status = h('div.faint');
    const startBtn = h('button.btn.primary', { style: { padding: '12px' } }, '🔥 Start the world');
    const root = h('div.screen.world-picker',
      h('div.card.wp',
        h('div.wp-head', icon('buildings/fortress', 40),
          h('div', h('h2', `${world.name} — Lobby`), h('div.faint', isHost ? 'You are the host. Invite players, then start when everyone is ready.' : `Hosted by ${world.ownerName}. Waiting for the host to start…`)),
          h('div.spacer'),
          h('button.btn.sm.ghost', { onclick: () => done('leave') }, '← Back')),
        h('div.wp-body',
          h('div.col',
            h('div.law-cat',
              h('div.row', h('span.faint', 'Invite code'), h('span.chip', { style: { fontFamily: 'var(--num)', fontSize: '20px', letterSpacing: '6px', userSelect: 'text' } }, world.code || '—')),
              h('div.faint', 'Share this code, or invite friends from the list on the right.')),
            h('h3', 'Players'),
            members,
            status,
            isHost ? startBtn : h('div.chip', '⏳ Waiting for the host')),
          side)));
    document.getElementById('ui').append(root);

    let memberIds = [];
    let inLobby = {};
    const names = new Map();
    const render = () => {
      for (const id of memberIds) {
        if (!names.has(id)) {
          names.set(id, '…');
          social.getPublicProfile(id).then(p => { names.set(id, p?.name || 'Player'); render(); });
        }
      }
      members.replaceChildren(...memberIds.map(id => h(`div.player${inLobby[id] ? '.online' : ''}`,
        avatar(names.get(id), 36),
        h('div', h('div.pname', names.get(id), id === world.owner ? h('span.tag', { style: { marginLeft: '6px', color: 'var(--gold)' } }, 'host') : null),
          h('div.meta', inLobby[id] ? '● in the lobby' : 'joined — not here right now')),
        isHost && id !== user.uid ? h('button.btn.sm.ghost', { onclick: () => social.kickMember(world.wid, id) }, 'Remove') : null)));
      status.textContent = `${memberIds.length} player${memberIds.length === 1 ? '' : 's'} · ${Object.keys(inLobby).length} ready in the lobby`;
    };

    const leaveLobby = social.enterLobby(world.wid, user.uid, username);
    unsubs.push(leaveLobby);
    unsubs.push(social.watchMembers(world.wid, ids => {
      memberIds = ids;
      if (!isHost && !ids.includes(user.uid)) { done('leave'); return; }   // removed by the host
      render();
    }));
    unsubs.push(social.watchLobby(world.wid, l => { inLobby = l; render(); }));
    unsubs.push(social.watchWorld(world.wid, w => {
      if (!w) done('leave');                       // the host closed the world
      else if (w.status === 'started') done('start');
    }));
    unsubs.push(friendsPanel(side, { user, username, world }));
    startBtn.onclick = async () => { startBtn.disabled = true; await social.startWorld(world.wid); };

    function done(result) {
      for (const u of unsubs) u();
      unsubs.length = 0;
      root.remove();
      resolve(result);
    }
  });
}

// ------------------------------------------------------------------ save slots

/** Pick which civilization to bring into a world. Resolves { slot, isNew }. */
export function slotPicker({ user, worldName, listSlots, deleteSlot }) {
  return new Promise(resolve => {
    const grid = h('div.slot-grid', h('div.muted', 'Loading your civilizations…'));
    const root = h('div.screen.world-picker',
      h('div.card.wp', { style: { width: 'min(900px, 95vw)' } },
        h('div.wp-head', icon('characters/king', 40),
          h('div', h('h2', 'Choose your civilization'), h('div.faint', `Entering ${worldName}. Your civilizations are the same in every world.`)),
          h('div.spacer'),
          h('button.btn.sm.ghost.back-btn', { onclick: () => { root.remove(); resolve({ back: true }); } }, '← Back')),
        h('div', { style: { padding: '18px 20px' } }, grid)));
    document.getElementById('ui').append(root);

    const render = async () => {
      const slots = await listSlots(user.uid);
      grid.replaceChildren(...slots.map(s => s.empty
        ? h('button.slot.empty', { onclick: () => pick(s.slot, true) },
          h('div.slot-num', `Slot ${s.slot}`), icon('buildings/campfire', 64),
          h('div.wp-title', 'Start a new adventure'), h('div.faint', 'One hero. Endless adventure.'))
        : h('div.slot',
          h('div.slot-num', `Slot ${s.slot}`), icon('buildings/castle', 64),
          h('div.wp-title', s.villageName),
          h('div.faint', `${ERAS[s.era || 0]?.name} · 👥 ${s.pop} · Day ${s.day}`),
          s.dynasty ? h('div.faint', `House ${s.dynasty}`) : null,
          h('div.faint', s.updatedAt ? `Played ${timeAgo(s.updatedAt)}` : ''),
          h('div.row', { style: { justifyContent: 'center' } },
            h('button.btn.primary', { onclick: () => pick(s.slot, false) }, '▶ Play'),
            h('button.btn.sm.ghost', {
              onclick: async () => {
                if (await confirmModal(`Delete ${s.villageName}?`, 'This civilization will be gone forever, in every world.', { okLabel: 'Delete', okClass: 'danger' })) {
                  await deleteSlot(user.uid, s.slot);
                  render();
                }
              },
            }, '🗑')))));
    };

    function pick(slot, isNew) {
      root.remove();
      resolve({ slot, isNew });
    }
    render();
  });
}

// ------------------------------------------------------------------ friends

/** Friends list with requests and add-by-username, rendered into `el`. */
export function friendsPanel(el, { user, username, world = null, worlds = null, onProfile = null }) {
  let friends = {};
  const err = h('div.error-text');
  const profiles = new Map();
  let add = () => {};
  const nameOf = uid => profiles.get(uid)?.name || '…';
  const load = async uid => {
    if (profiles.has(uid)) return;
    profiles.set(uid, null);
    profiles.set(uid, await social.getPublicProfile(uid));
    render();
  };

  const input = h('input.input', { placeholder: 'Add friend by username', maxLength: 16 });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  const render = () => {
    const entries = Object.entries(friends);
    for (const [uid] of entries) load(uid);
    add = async () => {
      err.textContent = '';
      try {
        const found = await social.findUserByName(input.value);
        if (!found) throw new Error('No player with that name');
        await social.sendFriendRequest(user.uid, username, found.uid);
        err.style.color = 'var(--good)';
        err.textContent = `Request sent to ${found.name}`;
        input.value = '';
      } catch (e) { err.style.color = ''; err.textContent = e.message; }
    };
    const row = (uid, extra) => h('div.player', { style: { cursor: 'pointer' }, onclick: e => { if (!e.target.closest('button')) openProfile(uid, { user, username, world }); } },
      avatar(nameOf(uid), 34), h('div', h('div.pname', nameOf(uid))), h('div.row', { style: { gap: '4px' } }, extra));

    el.replaceChildren(...[
      h('h3', '👥 Friends'),
      h('div.row', input, h('button.btn.sm.primary', { onclick: add }, 'Add')),
      err,
      ...entries.filter(([, st]) => st === 'in').map(([uid]) => row(uid, [
        h('button.btn.sm.good', { onclick: () => social.acceptFriend(user.uid, uid) }, 'Accept'),
        h('button.btn.sm.ghost', { onclick: () => social.removeFriend(user.uid, uid) }, '✕'),
      ])),
      ...entries.filter(([, st]) => st === 'friend').map(([uid]) => {
        const targets = [world, ...(worlds || [])].filter(w => w && typeof w === 'object' && w.wid);
        const seen = new Set();
        const list = targets.filter(w => !seen.has(w.wid) && seen.add(w.wid));
        const invite = async w => {
          try {
            await social.inviteToWorld(w, user.uid, username, uid);
            err.style.color = 'var(--good)';
            err.textContent = `Invited ${nameOf(uid)} to ${w.name}. They see it in Worlds, under Invitations.`;
          } catch (e) { err.style.color = ''; err.textContent = `Could not invite: ${e.message}`; }
        };
        if (!list.length) return row(uid, []);
        if (list.length === 1) return row(uid, [h('button.btn.sm', { title: `Invite to ${list[0].name}`, onclick: () => invite(list[0]) }, 'Invite')]);
        const pick = h('select.input.invite-pick', { style: { maxWidth: '150px' } }, ...list.map(w => h('option', { value: w.wid }, w.name)));
        return row(uid, [pick, h('button.btn.sm', { onclick: () => invite(list.find(w => w.wid === pick.value) || list[0]) }, 'Invite')]);
      }),
      ...entries.filter(([, st]) => st === 'out').map(([uid]) => row(uid, [h('span.faint', 'pending'), h('button.btn.sm.ghost', { onclick: () => social.removeFriend(user.uid, uid) }, '✕')])),
      entries.length ? null : h('div.faint', 'No friends yet. Add someone by their username.'),
    ].filter(Boolean));
  };
  const unsub = social.watchFriends(user.uid, f => { friends = f; render(); });
  render();
  return unsub;
}

// ------------------------------------------------------------------ profile

export async function openProfile(uid, { user, username, world = null, village = null, onVisit = null, onDeal = null, onMarch = null, onSpy = null }) {
  const content = h('div.col', h('div.muted', 'Loading profile…'));
  const m = modal(content, { cls: 'profile-modal', closeX: true });
  let profile = null, friendsSnap = {};
  try {
    [profile, friendsSnap] = await Promise.all([social.getPublicProfile(uid), social.getFriends(user.uid)]);
  } catch (e) {
    content.replaceChildren(h('div.error-text', `Could not load profile: ${e.message}`));
    return;
  }
  const me = uid === user.uid;
  const status = friendsSnap[uid];
  const name = profile?.name || village?.name || 'Unknown player';
  const st = profile?.stats || {};
  const friendBtn = me ? null
    : status === 'friend' ? h('button.btn.sm.ghost', { onclick: async () => { await social.removeFriend(user.uid, uid); m.close(); } }, 'Remove friend')
      : status === 'out' ? h('span.chip', 'Request sent')
        : status === 'in' ? h('button.btn.sm.good', { onclick: async () => { await social.acceptFriend(user.uid, uid); m.close(); } }, 'Accept friend request')
          : h('button.btn.sm.primary', { onclick: async () => { await social.sendFriendRequest(user.uid, username, uid); m.close(); } }, '➕ Add friend');

  content.replaceChildren(...[
    h('div.row', { style: { gap: '14px' } }, avatar(name, 64),
      h('div', h('h2', name), h('div.faint', profile?.joinedAt ? `Playing since ${new Date(profile.joinedAt).toLocaleDateString()}` : ''),
        status === 'friend' ? h('span.chip.good', 'Friend') : null)),
    h('div.stats-grid.profile-stats',
      stat('👥', st.bestPop ?? '—', 'Largest people'),
      stat('🏛', ERAS[st.bestEra || 0]?.name || '—', 'Highest era'),
      stat('⚔', st.raidsWon ?? 0, 'Raids won'),
      stat('☯', st.karma ?? 0, 'Karma'),
      stat('🌍', st.worlds ?? 1, 'Worlds'),
      stat('👑', st.dynasty || '—', 'Dynasty')),
    village ? h('div.law-cat',
      h('div.row', icon('buildings/castle', 28), h('div', h('b', village.villageName), h('div.faint', `${ERAS[village.era || 0]?.name} · 👥 ${village.pop ?? '?'} · ☯ ${village.karma ?? 0}`))),
      h('div.row', { style: { flexWrap: 'wrap', gap: '6px' } },
        onVisit ? h('button.btn.sm', { onclick: () => { m.close(); onVisit(); } }, '🔭 Visit') : null,
        onDeal ? h('button.btn.sm', { onclick: () => { m.close(); onDeal(); } }, '🤝 Deal') : null,
        onMarch ? h('button.btn.sm.danger', { onclick: () => { m.close(); onMarch(); } }, '⚔ March') : null,
        onSpy ? h('button.btn.sm', { onclick: () => { m.close(); onSpy(); } }, '🕵 Spy') : null)) : null,
    h('div.row', h('div.spacer'), friendBtn),
  ].filter(Boolean));
}

const stat = (ic, n, label) => h('div.stat-card', h('span', { style: { fontSize: '22px' } }, ic), h('div', h('div.n', n), h('div.l', label)));
