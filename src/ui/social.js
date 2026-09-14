import { h, icon, avatar, modal, timeAgo, confirmModal } from './dom.js';
import { ERAS } from '../data/buildings.js';
import * as social from '../net/social.js';

/*
 * World picker (shown after signing in), player profiles and friends.
 */

const ui = () => document.getElementById('ui');

// ------------------------------------------------------------------ world picker

/** Resolves with { world, name } once the player picks where to play. */
export function worldPicker({ user, username, lastWorld = null }) {
  return new Promise(resolve => {
    const unsubs = [];
    const body = h('div.wp-grid');
    const side = h('div.wp-side');
    const err = h('div.error-text');
    const root = h('div.screen.world-picker',
      h('div.card.wp',
        h('div.wp-head', icon('buildings/castle', 40),
          h('div', h('h2', 'Choose your world'), h('div.faint', `Ruling as ${username} · your civilizations come with you to any world`)),
          h('div.spacer'),
          h('button.btn.sm.ghost.back-btn', { onclick: () => { for (const u of unsubs) u(); root.remove(); resolve({ back: true }); } }, '← Back')),
        h('div.wp-body', h('div.col', body, err), side)));
    ui().append(root);

    const choose = (world, name) => {
      for (const u of unsubs) u();
      root.remove();
      resolve({ world, name });
    };
    const tryAction = async fn => { err.textContent = ''; try { await fn(); } catch (e) { err.textContent = e.message; } };

    let invites = [];
    let rejoin = null;   // the world you were in when the game closed, if it is still running
    if (lastWorld) {
      social.getWorld(lastWorld.wid).then(async w => {
        if (!w || !(await social.isMember(lastWorld.wid, user.uid))) return;
        rejoin = { ...lastWorld, name: w.name, status: w.status, players: await social.worldMemberCount(lastWorld.wid).catch(() => 0) };
        render();
      }).catch(() => {});
    }
    const render = () => {
      body.replaceChildren(...[
        rejoin ? h('button.wp-card.rejoin', { onclick: () => { for (const u of unsubs) u(); root.remove(); resolve({ world: rejoin.wid, name: rejoin.name, rejoin: true, slot: rejoin.slot }); } },
          icon('buildings/fortress', 44),
          h('div', h('div.wp-title', `🔁 Rejoin ${rejoin.name}`), h('div.faint', `You left this world ${timeAgo(rejoin.at)} · ${rejoin.players} player${rejoin.players === 1 ? '' : 's'} · ${rejoin.status === 'lobby' ? 'still in the lobby' : 'still running'}`)),
          h('span.btn.sm.good', 'Rejoin')) : null,
        h('button.wp-card.public', { onclick: () => choose(social.SOLO_WORLD, 'Solo World') },
          icon('buildings/campfire', 44),
          h('div', h('div.wp-title', '🏕 Solo World'), h('div.faint', 'Just you. No raids, no chat — build at your own pace.')),
          h('span.btn.sm.primary', 'Play')),
        invites.length ? h('h3', 'Invitations') : null,
        ...invites.map(inv => h('div.wp-card.invite',
          icon('items/scroll', 36),
          h('div', h('div.wp-title', inv.name), h('div.faint', `${inv.fromName} invited you · ${timeAgo(inv.ts)}`)),
          h('div.row',
            h('button.btn.sm.ghost', { onclick: () => tryAction(() => social.declineInvite(user.uid, inv.wid)) }, 'Decline'),
            h('button.btn.sm.good', { onclick: () => tryAction(async () => { await social.joinWorld(user.uid, inv.wid, inv.name); choose(inv.wid, inv.name); }) }, 'Join')))),
        h('h3', 'Play with friends'),
        h('div.faint', 'Create a world and invite friends, or join one with its code. Worlds last while you play in them — your civilizations are what gets saved.'),
        actions,
      ].filter(Boolean));
    };

    function createAndJoin() {
      const name = h('input.input', { placeholder: 'New world name', maxLength: 28 });
      const code = h('input.input', { placeholder: 'Invite code', maxLength: 6, style: { textTransform: 'uppercase' } });
      return h('div.wp-actions',
        h('div.row', name, h('button.btn.primary', {
          onclick: () => tryAction(async () => {
            const w = await social.createWorld(user.uid, username, name.value);
            choose(w.wid, w.name);
          }),
        }, '➕ Create')),
        h('div.row', code, h('button.btn', {
          onclick: () => tryAction(async () => {
            const w = await social.joinWorldByCode(user.uid, code.value);
            choose(w.wid, w.name);
          }),
        }, '🔑 Join')));
    }

    const actions = createAndJoin();
    // only show invitations to worlds that still exist
    unsubs.push(social.watchInvites(user.uid, async list => {
      const alive = await Promise.all(list.map(async inv => ((await social.getWorld(inv.wid).catch(() => null)) ? inv : (social.declineInvite(user.uid, inv.wid).catch(() => {}), null))));
      invites = alive.filter(Boolean);
      render();
    }));
    friendsPanel(side, { user, username });
    render();
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
          h('div.wp-title', 'Found a new civilization'), h('div.faint', 'Three humans. One fire.'))
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
export function friendsPanel(el, { user, username, world = null, onProfile = null }) {
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
      ...entries.filter(([, st]) => st === 'friend').map(([uid]) => row(uid, world && typeof world === 'object'
        ? [h('button.btn.sm', { onclick: async () => { await social.inviteToWorld(world, user.uid, username, uid); err.style.color = 'var(--good)'; err.textContent = `Invited ${nameOf(uid)} to ${world.name}`; } }, 'Invite')]
        : [])),
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
  const m = modal(content, { cls: 'profile-modal' });
  let profile = null, friendsSnap = {};
  try {
    [profile, friendsSnap] = await Promise.all([social.getPublicProfile(uid), social.getFriends(user.uid)]);
  } catch (e) {
    content.replaceChildren(h('div.error-text', `Could not load profile: ${e.message}`), h('button.btn.sm', { onclick: () => m.close() }, 'Close'));
    return;
  }
  const me = uid === user.uid;
  const status = friendsSnap[uid];
  const name = profile?.name || village?.name || 'Unknown ruler';
  const st = profile?.stats || {};
  const friendBtn = me ? null
    : status === 'friend' ? h('button.btn.sm.ghost', { onclick: async () => { await social.removeFriend(user.uid, uid); m.close(); } }, 'Remove friend')
      : status === 'out' ? h('span.chip', 'Request sent')
        : status === 'in' ? h('button.btn.sm.good', { onclick: async () => { await social.acceptFriend(user.uid, uid); m.close(); } }, 'Accept friend request')
          : h('button.btn.sm.primary', { onclick: async () => { await social.sendFriendRequest(user.uid, username, uid); m.close(); } }, '➕ Add friend');

  content.replaceChildren(...[
    h('div.row', { style: { gap: '14px' } }, avatar(name, 64),
      h('div', h('h2', name), h('div.faint', profile?.joinedAt ? `Ruler since ${new Date(profile.joinedAt).toLocaleDateString()}` : ''),
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
    h('div.row', h('div.spacer'), friendBtn, h('button.btn.sm', { onclick: () => m.close() }, 'Close')),
  ].filter(Boolean));
}

const stat = (ic, n, label) => h('div.stat-card', h('span', { style: { fontSize: '22px' } }, ic), h('div', h('div.n', n), h('div.l', label)));
