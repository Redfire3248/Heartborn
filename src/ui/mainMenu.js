/*
 * The main menu, once you are signed in.
 *
 * The world keeps playing behind it (the title scene), darkened on the left where the menu sits: the name, then a
 * list of text buttons - Play, Multiplayer, Character, Race, Friends, Settings, Account - lit when you point at
 * them. The right side shows whatever is chosen. Red number badges say where something is waiting: a newly
 * earned character, Race Stones, a friend request or an invitation, what is new after an update.
 *
 * Play is your own single-player worlds. Multiplayer is servers: yours, the ones you are invited to, public
 * servers anyone can join, and making or joining one by its code.
 */
import { h, icon, avatar, confirmModal } from './dom.js';
import { play } from '../core/sound.js';
import { BUILD, latestChanges } from '../core/version.js';
import { CHARACTERS, hasCharacter, unseenCharacters, markCharactersSeen } from '../game/characters.js';
import { lastBase, chooseBase, lookFor, accountRace, loadAccountRaceInto, RACES, RACE_TIERS } from '../game/races.js';
import { openLayoutPreview, resetLayout } from './layoutEdit.js';
import * as social from '../net/social.js';

const PAGES = [
  ['play', 'PLAY'], ['online', 'MULTIPLAYER'], ['character', 'CHARACTER'], ['race', 'RACE'], ['friends', 'FRIENDS'], ['settings', 'SETTINGS'], ['account', 'ACCOUNT'],
];

const ago = t => {
  const s = Math.max(0, (Date.now() - (t || 0)) / 1000);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

/**
 * opts: { user, username, listWorldSaves(uid), deleteWorldSave(uid, wid), onPlay(choice), onSignOut(),
 *         controls(), sound() }  - the last two build the key-binding and volume settings, shared with the game.
 */
export function mainMenu(opts) {
  const { user } = opts;
  let page = 'play';
  let setTab = 'controls';
  let saves = null, friends = null, friendNames = {}, invites = [], publics = null;
  const unsubs = [];
  const panel = h('div.mm-panel');
  const nav = h('nav.mm-nav', { 'aria-label': 'Main menu' });
  const who = h('div.mm-who');
  const root = h('div.screen.main-menu',
    h('div.mm-shade'),
    h('div.mm-left',
      h('div.mm-logo', 'HEARTBORN'),
      h('div.mm-tag', 'One hero. Endless adventure.'),
      nav,
      h('div.mm-spacer'),
      who),
    panel);
  document.getElementById('ui').append(root);

  /*
   * A phone on its side gets the laptop menu, just smaller: the whole screen is laid out 720 tall and as wide as
   * the screen's own shape, then scaled down to fit, rather than rearranged. Upright phones keep their own layout.
   */
  const fit = () => {
    const sideways = innerWidth > innerHeight && innerHeight < 600;
    root.classList.toggle('mm-scaled', sideways);
    if (!sideways) { root.style.transform = ''; root.style.width = ''; return; }
    const s = innerHeight / 720;
    root.style.width = `${Math.round(innerWidth / s)}px`;
    root.style.transform = `scale(${s})`;
  };
  fit();
  addEventListener('resize', fit);

  const seenVersion = () => { try { return localStorage.getItem('hb-seen-version'); } catch { return null; } };
  const badges = () => ({
    online: invites.length,
    character: unseenCharacters().length,
    race: Math.max(0, Math.floor(accountRace()?.stones || 0)),   // Race Stones waiting to be rolled
    friends: friends ? Object.values(friends).filter(v => v === 'in').length : 0,
    settings: seenVersion() && seenVersion() !== BUILD.version ? 1 : 0,
  });

  const go = id => {
    page = id; play('click');
    if (id === 'character') markCharactersSeen();
    if (id === 'settings') { try { localStorage.setItem('hb-seen-version', BUILD.version); } catch { /* private */ } }
    if (id === 'online') loadPublic();
    render();
  };
  const drawNav = () => {
    const b = badges();
    nav.replaceChildren(...PAGES.map(([id, name]) => h(`button.mm-item${page === id ? '.on' : ''}`, { onclick: () => go(id) },
      h('span.mm-arrow'), h('span', name), b[id] ? h('span.mm-badge', String(b[id])) : null)));   // the arrow only appears on hover
    who.replaceChildren(avatar(opts.username || '?', 26), h('span', opts.username ? `Signed in as ${opts.username}` : 'Signed in: you will choose a name next'));
  };

  // ------------------------------------------------------------- the pages
  const card = (...kids) => h('div.mm-card', ...kids);
  const msg = h('span.mm-sub.mm-msg');
  const attempt = async fn => { msg.textContent = ''; try { await fn(); } catch (e) { msg.textContent = e.message; } };
  const myRace = () => (RACES[accountRace()?.race] ? accountRace().race : 'human');
  const look = () => `races/${lookFor(myRace(), lastBase())}`;   // you, as the race you are in every world
  const hero = () => h('div.mm-hero', h('div.mm-glow'), icon(look(), 200));
  const enter = s => opts.onPlay({ world: s.wid, name: s.name, kind: s.kind, seed: s.seed });
  const line = s => `${s.kind === 'server' ? 'Server' : 'Solo'} · Lv ${s.level || 1} · Day ${s.day || 1}`;
  const forget = s => attempt(async () => {
    const server = s.kind === 'server';
    if (!(await confirmModal(server ? `Leave ${s.name}?` : `Delete ${s.name}?`, server ? 'Your hero there is forgotten. You can join again later.' : 'The world and everything you did in it are gone for good.', { okLabel: server ? 'Leave' : 'Delete', okClass: 'danger' }))) return;
    await opts.deleteWorldSave?.(user.uid, s.wid);
    if (server) await social.leaveWorld(user.uid, s.wid).catch(() => {});
    await loadSaves();
  });
  const worldRow = s => h('div.mm-row',
    h('div.mm-row-text', h('b', s.name || 'World'), h('span', line(s))),
    h('button.btn.sm.ghost', { onclick: () => forget(s) }, s.kind === 'server' ? 'Leave' : 'Delete'),
    h('button.btn.sm.primary', { onclick: () => enter(s) }, 'Play'));

  /** Play: your own worlds, only you in them. The newest is one tap away; below it the rest and a new one. */
  const playPage = () => {
    const solos = (saves || []).filter(s => s.kind !== 'server');
    const newest = solos[0];
    const name = h('input.input', { placeholder: 'New world name', maxLength: 28 });
    const create = () => opts.onPlay({ world: `solo_${Date.now().toString(36)}`, name: name.value.trim() || `${opts.username || 'My'}'s World`, kind: 'solo', seed: Math.floor(Math.random() * 2 ** 31), isNew: true });
    return h('div.mm-play',
      hero(),
      card(
        h('span.mm-cap', 'Single player'),
        h('b.mm-title', newest ? newest.name || 'Your world' : saves ? 'No world yet' : 'Loading your worlds…'),
        newest ? h('span.mm-sub', line(newest)) : null,
        newest ? h('button.btn.primary.mm-play-btn', { onclick: () => enter(newest) }, 'PLAY') : null,
        solos.length > 1 ? h('div.mm-list', ...solos.slice(1, 5).map(worldRow)) : null,
        h('span.mm-cap', 'New world'),
        h('div.mm-add', name, h(`button.btn.sm${newest ? '' : '.primary'}`, { disabled: !saves, onclick: create }, 'Create')),
        msg));
  };

  /** Multiplayer: servers only. Yours, invitations, public servers anyone can join, and make or join one. */
  const onlinePage = () => {
    const servers = (saves || []).filter(s => s.kind === 'server');
    const mine = new Set(servers.map(s => s.wid));
    const sName = h('input.input', { placeholder: 'Server name', maxLength: 28 });
    const pub = h('input', { type: 'checkbox', checked: true });
    const code = h('input.input', { placeholder: 'Code', maxLength: 6, style: { textTransform: 'uppercase' } });
    const joinPublic = w => attempt(async () => { await social.joinWorld(user.uid, w.wid, w.name); opts.onPlay({ world: w.wid, name: w.name, kind: 'server', seed: w.seed }); });
    return card(
      h('b.mm-title', 'Multiplayer'),
      invites.length ? h('span.mm-cap', 'Invitations') : null,
      invites.length ? h('div.mm-list', ...invites.map(inv => h('div.mm-row',
        h('div.mm-row-text', h('b', inv.name), h('span', `${inv.fromName} invited you`)),
        h('button.btn.sm.ghost', { onclick: () => attempt(() => social.declineInvite(user.uid, inv.wid)) }, 'Decline'),
        h('button.btn.sm.primary', { onclick: () => attempt(async () => { await social.joinWorld(user.uid, inv.wid, inv.name); const w = await social.getWorld(inv.wid); opts.onPlay({ world: inv.wid, name: inv.name, kind: 'server', seed: w?.seed }); }) }, 'Join')))) : null,
      h('span.mm-cap', 'Your servers'),
      !saves ? h('span.mm-sub', 'Loading…') : servers.length ? h('div.mm-list', ...servers.slice(0, 6).map(worldRow)) : h('span.mm-sub', 'You are on no servers yet.'),
      h('span.mm-cap', 'Public servers'),
      !publics ? h('span.mm-sub', 'Looking for servers…')
        : publics.filter(w => !mine.has(w.wid)).length ? h('div.mm-list', ...publics.filter(w => !mine.has(w.wid)).slice(0, 8).map(w => h('div.mm-row',
          h('div.mm-row-text', h('b', w.name), h('span', `Hosted by ${w.ownerName || 'someone'} · made ${ago(w.createdAt)}`)),
          h('button.btn.sm.primary', { onclick: () => joinPublic(w) }, 'Join'))))
          : h('span.mm-sub', 'No public servers right now. Make one and anyone can join.'),
      h('span.mm-cap', 'Make a server'),
      h('div.mm-add', sName, h('button.btn.sm.primary', { onclick: () => attempt(async () => {
        const w = await social.createWorld(user.uid, opts.username || 'Player', sName.value, { isPublic: pub.checked });
        opts.onPlay({ world: w.wid, name: w.name, kind: 'server', seed: w.seed, code: w.code });
      }) }, 'Create')),
      h('label.mm-check', pub, h('span', 'Public: anyone can find it and join')),
      h('span.mm-cap', 'Join with a code'),
      h('div.mm-add', code, h('button.btn.sm', { onclick: () => attempt(async () => {
        const w = await social.joinWorldByCode(user.uid, code.value);
        opts.onPlay({ world: w.wid, name: w.name, kind: 'server', seed: w.seed });
      }) }, 'Join')),
      msg);
  };

  const characterPage = () => card(
    h('b.mm-title', 'Character'),
    h('span.mm-sub', 'Every race you roll is a version of the person you choose here.'),
    h('div.mm-chars', ...CHARACTERS.map(c => {
      const have = hasCharacter(c.id);
      const on = lastBase() === c.id;
      return h(`button.mm-char${on ? '.on' : ''}${have ? '' : '.locked'}`, {
        title: have ? c.desc : `Locked: ${c.how}`,
        onclick: () => { if (!have) return; chooseBase(c.id); play('click'); render(); },
      }, icon(`races/${lookFor('human', c.id)}`, 64), h('b', c.name), have ? (on ? h('i', 'Chosen') : null) : h('i.mm-lock', c.how));
    })));

  /*
   * The race screen, from the menu. Your race lives with your account, so it is rolled here on the account itself:
   * a small stand-in "game" holds it, and every change the wheel makes is saved back to the account.
   */
  const accountGame = () => {
    const g = { state: { rpg: {} }, fx: {}, emit() {}, noAccountRace: false };
    loadAccountRaceInto(g);
    return g;
  };
  const racePage = () => {
    const key = myRace(), d = RACES[key], t = RACE_TIERS[d.tier];
    const stones = Math.max(0, Math.floor(accountRace()?.stones || 0));
    const i = d.passive.indexOf(': ');
    return h('div.mm-play',
      hero(),
      card(
        h('span.mm-cap', 'Your race, in every world'),
        h('b.mm-title', { style: { color: d.color } }, d.name),
        h('span.mm-sub', { style: { color: t.color } }, t.name),
        h('span.mm-sub', i > 0 ? `${d.passive.slice(0, i)}: ${d.passive.slice(i + 2)}` : d.passive),
        h('span.mm-sub', `${stones} Race Stone${stones === 1 ? '' : 's'} to roll`),
        h('button.btn.primary.mm-play-btn', {
          onclick: async () => {
            const M = await import('./raceMenu.js');
            const m = M.openRaceMenu({ game: accountGame(), hint: () => {}, toast: () => {} });
            const done = new MutationObserver(() => { if (!m?.el?.isConnected) { done.disconnect(); render(); } });
            done.observe(document.getElementById('ui'), { childList: true, subtree: true });
          },
        }, 'OPEN')));
  };

  const friendsPage = () => {
    const input = h('input.input', { placeholder: 'Add a friend by username', maxLength: 16 });
    const note = h('span.mm-sub');
    const add = async () => {
      note.textContent = '';
      try {
        const found = await social.findUserByName(input.value.trim());
        if (!found) throw new Error('Nobody by that name');
        await social.sendFriendRequest(user.uid, opts.username || '', found.uid);
        note.textContent = `Request sent to ${found.name}`;
        input.value = '';
      } catch (e) { note.textContent = e.message; }
    };
    const rows = Object.entries(friends || {}).sort((a, b) => (a[1] === 'in' ? -1 : 0) - (b[1] === 'in' ? -1 : 0));
    return card(
      h('b.mm-title', 'Friends'),
      h('div.mm-add', input, h('button.btn.sm.primary', { onclick: add }, 'Add')), note,
      !friends ? h('span.mm-sub', 'Loading…')
        : rows.length ? h('div.mm-list', ...rows.map(([uid, st]) => h('div.mm-row',
          avatar(friendNames[uid] || '?', 28),
          h('div.mm-row-text', h('b', friendNames[uid] || '…'), h('span', st === 'in' ? 'Wants to be friends' : st === 'out' ? 'Request sent' : 'Friend')),
          st === 'in' ? h('button.btn.sm.primary', { onclick: () => social.acceptFriend(user.uid, uid) }, 'Accept') : null,
          h('button.btn.sm.ghost', { onclick: () => social.removeFriend(user.uid, uid) }, st === 'in' ? 'Decline' : 'Remove'))))
          : h('span.mm-sub', 'No friends yet: add someone by their username.'));
  };

  /** Settings: the same controls, layout, sound and graphics as in the game, in tabs. */
  const settingsPage = () => {
    const choice = (key, def, list, after) => {
      let now = def;
      try { now = localStorage.getItem(key) || def; } catch { /* private */ }
      return h('div.mm-seg', ...list.map(([v, n]) => h(`button.btn.sm${now === v ? '.primary' : ''}`, { onclick: () => { try { localStorage.setItem(key, v); } catch { /* private */ } after ? after(v) : render(); } }, n)));
    };
    const moved = o => { try { return Object.keys(JSON.parse(localStorage.getItem(`hb-layout-${o}`) || '{}')).length; } catch { return 0; } };
    const TABS = [['controls', 'Controls'], ['layout', 'Layout'], ['sound', 'Sound'], ['graphics', 'Graphics'], ['news', 'What is new']];
    const body = h('div.mm-set-body');
    if (setTab === 'controls') body.append(opts.controls ? opts.controls() : h('span.mm-sub', 'Open Settings in the game to change keys.'));
    else if (setTab === 'layout') {
      const sideways = innerWidth > innerHeight;
      body.append(
        h('span.mm-sub', 'Put the stick, the buttons, the hotbar, your health, the resources, the menu button and the minimap wherever you like, and make them bigger or smaller. Sideways and upright screens each keep their own.'),
        h('button.btn.primary.mm-wide', { onclick: () => { root.style.display = 'none'; openLayoutPreview(() => { root.style.display = ''; render(); }); } }, 'Move and resize controls'),
        h('div.mm-setting', h('span', `Sideways${sideways ? ' (this screen)' : ''}: ${moved('land') ? `${moved('land')} moved` : 'default'}`), h('button.btn.sm', { disabled: !moved('land'), onclick: () => { resetLayout('land'); render(); } }, 'Reset')),
        h('div.mm-setting', h('span', `Upright${sideways ? '' : ' (this screen)'}: ${moved('port') ? `${moved('port')} moved` : 'default'}`), h('button.btn.sm', { disabled: !moved('port'), onclick: () => { resetLayout('port'); render(); } }, 'Reset')));
    } else if (setTab === 'sound') body.append(opts.sound ? opts.sound() : null);
    else if (setTab === 'graphics') {
      body.append(
        h('div.mm-setting', h('span', 'Art'), choice('hb-art', 'auto', [['auto', 'Auto'], ['hi', 'Sharp'], ['lo', 'Fast']], () => location.reload())),
        h('div.mm-setting', h('span', 'Effects'), choice('hb-quality', 'auto', [['auto', 'Auto'], ['high', 'Everything'], ['low', 'Smooth']])));
    } else {
      const news = h('div.mm-news', 'Loading what is new…');
      latestChanges().then(c => { news.replaceChildren(h('b', c.title), h('ul', ...c.changes.slice(0, 6).map(x => h('li', x)))); }).catch(() => { news.textContent = ''; });
      body.append(h('span.mm-cap', `Version ${BUILD.version}`), news);
    }
    return card(
      h('b.mm-title', 'Settings'),
      h('div.mm-tabs', ...TABS.map(([id, n]) => h(`button.mm-tab${setTab === id ? '.on' : ''}`, { onclick: () => { setTab = id; play('click'); render(); } }, n))),
      body);
  };

  const accountPage = () => card(
    h('b.mm-title', 'Account'),
    h('div.mm-row', avatar(opts.username || '?', 36), h('div.mm-row-text', h('b', opts.username || 'No name yet'), h('span', 'Your characters, race and worlds are saved to this account'))),
    h('button.btn.mm-wide', { onclick: () => opts.onSignOut() }, 'Sign out'));

  const render = () => {
    drawNav();
    const scroll = panel.scrollTop;
    panel.replaceChildren(({ play: playPage, online: onlinePage, character: characterPage, race: racePage, friends: friendsPage, settings: settingsPage, account: accountPage })[page]());
    panel.scrollTop = scroll;
  };

  // what the pages need from the network: your worlds, invitations, public servers, and your friends' names
  const loadSaves = () => opts.listWorldSaves(user.uid).then(list => { saves = list || []; render(); }).catch(() => { saves = []; render(); });
  const loadPublic = () => social.listPublicWorlds().then(list => { publics = list; if (page === 'online') render(); }).catch(() => { publics = []; if (page === 'online') render(); });
  loadSaves();
  unsubs.push(social.watchInvites(user.uid, list => { invites = list; render(); }));
  unsubs.push(social.watchFriends(user.uid, async f => {
    friends = f || {};
    render();
    for (const uid of Object.keys(friends)) if (!friendNames[uid]) {
      const p = await social.getPublicProfile(uid).catch(() => null);
      friendNames[uid] = p?.name || 'Player';
      render();
    }
  }));
  render();

  return {
    refresh: render,
    hide() { root.style.display = 'none'; },
    show() { root.style.display = ''; loadSaves(); render(); },
    setUsername(name) { opts.username = name; render(); },
    remove() { for (const u of unsubs) u?.(); removeEventListener('resize', fit); root.remove(); },
  };
}
