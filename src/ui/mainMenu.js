/*
 * The main menu, once you are signed in.
 *
 * The world keeps playing behind it (the title scene), darkened on the left where the menu sits: the name, then a
 * list of text buttons - Play, Worlds, Character, Friends, Settings, Account - with the chosen one lit and an arrow
 * beside it. The right side shows whatever is chosen. Red number badges say where something is waiting: a newly
 * earned character, a friend request, what is new after an update.
 */
import { h, icon, avatar } from './dom.js';
import { play } from '../core/sound.js';
import { BUILD, latestChanges } from '../core/version.js';
import { CHARACTERS, hasCharacter, unseenCharacters, markCharactersSeen } from '../game/characters.js';
import { lastBase, lastRace, chooseBase, lookFor } from '../game/races.js';
import * as social from '../net/social.js';

const PAGES = [
  ['play', 'PLAY'], ['worlds', 'WORLDS'], ['character', 'CHARACTER'], ['friends', 'FRIENDS'], ['settings', 'SETTINGS'], ['account', 'ACCOUNT'],
];

/**
 * opts: { user, username, listWorldSaves(uid), onPlay(choice|null), onWorlds(), onSignOut() }
 * onPlay(null) opens the full Worlds screen; onPlay(choice) goes straight into that world.
 */
export function mainMenu(opts) {
  const { user } = opts;
  let page = 'play';
  let saves = null, friends = null, friendNames = {}, unsubFriends = null;
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

  const seenVersion = () => { try { return localStorage.getItem('hb-seen-version'); } catch { return null; } };
  const badges = () => ({
    character: unseenCharacters().length,
    friends: friends ? Object.values(friends).filter(v => v === 'in').length : 0,
    settings: seenVersion() && seenVersion() !== BUILD.version ? 1 : 0,
  });

  const drawNav = () => {
    const b = badges();
    nav.replaceChildren(...PAGES.map(([id, name]) => h(`button.mm-item${page === id ? '.on' : ''}`, {
      onclick: () => { page = id; play('click'); if (id === 'character') markCharactersSeen(); if (id === 'settings') { try { localStorage.setItem('hb-seen-version', BUILD.version); } catch { /* private */ } } render(); },
    }, h('span.mm-arrow', page === id ? '▸' : ''), h('span', name), b[id] ? h('span.mm-badge', String(b[id])) : null)));
    who.replaceChildren(avatar(opts.username || '?', 26), h('span', opts.username ? `Signed in as ${opts.username}` : 'Signed in: you will choose a name next'));
  };

  // ------------------------------------------------------------- the pages
  const card = (...kids) => h('div.mm-card', ...kids);
  const look = () => `races/${lookFor(lastRace(), lastBase())}`;

  const playPage = () => {
    const newest = saves?.[0];
    return h('div.mm-play',
      h('div.mm-hero', h('div.mm-glow'), icon(look(), 200)),
      card(
        newest ? h('span.mm-cap', 'Continue') : h('span.mm-cap', 'Your first adventure'),
        h('b.mm-title', newest ? newest.name || 'Your world' : saves ? 'No world yet' : 'Loading your worlds…'),
        newest ? h('span.mm-sub', `${newest.kind === 'server' ? 'Server' : 'Solo'} · Lv ${newest.level || 1} · Day ${newest.day || 1}`) : null,
        h('button.btn.primary.mm-play-btn', {
          disabled: !saves,
          onclick: () => opts.onPlay(newest ? { world: newest.wid, name: newest.name, kind: newest.kind, seed: newest.seed } : null),
        }, newest ? 'PLAY' : 'NEW WORLD')));
  };

  const worldsPage = () => card(
    h('b.mm-title', 'Worlds'),
    !saves ? h('span.mm-sub', 'Loading…')
      : saves.length ? h('div.mm-list', ...saves.slice(0, 4).map(s => h('div.mm-row',
        h('div.mm-row-text', h('b', s.name || 'World'), h('span', `${s.kind === 'server' ? 'Server' : 'Solo'} · Lv ${s.level || 1} · Day ${s.day || 1}`)),
        h('button.btn.sm', { onclick: () => opts.onPlay({ world: s.wid, name: s.name, kind: s.kind, seed: s.seed }) }, 'Play'))))
        : h('span.mm-sub', 'You have no worlds yet.'),
    h('button.btn.mm-wide', { onclick: () => opts.onPlay(null) }, 'All worlds, new worlds and servers'));

  const characterPage = () => card(
    h('b.mm-title', 'Character'),
    h('span.mm-sub', 'Every race you roll is a version of the person you choose here.'),
    h('div.mm-chars', ...CHARACTERS.map(c => {
      const mine = hasCharacter(c.id);
      const on = lastBase() === c.id;
      return h(`button.mm-char${on ? '.on' : ''}${mine ? '' : '.locked'}`, {
        title: mine ? c.desc : `Locked: ${c.how}`,
        onclick: () => { if (!mine) return; chooseBase(c.id); play('click'); render(); },
      }, icon(`races/${lookFor('human', c.id)}`, 64), h('b', c.name), mine ? (on ? h('i', 'Chosen') : null) : h('i.mm-lock', c.how));
    })));

  const friendsPage = () => {
    const input = h('input.input', { placeholder: 'Add a friend by username', maxLength: 16 });
    const msg = h('span.mm-sub');
    const add = async () => {
      msg.textContent = '';
      try {
        const found = await social.findUserByName(input.value.trim());
        if (!found) throw new Error('Nobody by that name');
        await social.sendFriendRequest(user.uid, opts.username || '', found.uid);
        msg.textContent = `Request sent to ${found.name}`;
        input.value = '';
      } catch (e) { msg.textContent = e.message; }
    };
    const rows = Object.entries(friends || {}).sort((a, b) => (a[1] === 'in' ? -1 : 0) - (b[1] === 'in' ? -1 : 0));
    return card(
      h('b.mm-title', 'Friends'),
      h('div.mm-add', input, h('button.btn.sm.primary', { onclick: add }, 'Add')), msg,
      !friends ? h('span.mm-sub', 'Loading…')
        : rows.length ? h('div.mm-list', ...rows.map(([uid, st]) => h('div.mm-row',
          avatar(friendNames[uid] || '?', 28),
          h('div.mm-row-text', h('b', friendNames[uid] || '…'), h('span', st === 'in' ? 'Wants to be friends' : st === 'out' ? 'Request sent' : 'Friend')),
          st === 'in' ? h('button.btn.sm.primary', { onclick: () => social.acceptFriend(user.uid, uid) }, 'Accept') : null,
          h('button.btn.sm.ghost', { onclick: () => social.removeFriend(user.uid, uid) }, st === 'in' ? 'Decline' : 'Remove'))))
          : h('span.mm-sub', 'No friends yet: add someone by their username.'));
  };

  const settingsPage = () => {
    let art = 'auto';
    try { art = localStorage.getItem('hb-art') || 'auto'; } catch { /* private */ }
    const setArt = v => { try { localStorage.setItem('hb-art', v); } catch { /* private */ } location.reload(); };
    const news = h('div.mm-news', 'Loading what is new…');
    latestChanges().then(c => { news.replaceChildren(h('b', c.title), h('ul', ...c.changes.slice(0, 4).map(x => h('li', x)))); }).catch(() => { news.textContent = ''; });
    return card(
      h('b.mm-title', 'Settings'),
      h('div.mm-setting', h('span', 'Graphics'),
        h('div.mm-seg', ...[['auto', 'Auto'], ['hi', 'Sharp'], ['lo', 'Fast']].map(([v, n]) => h(`button.btn.sm${art === v ? '.primary' : ''}`, { onclick: () => setArt(v) }, n)))),
      h('span.mm-sub', 'Sound, controls and everything else are in Settings inside the game.'),
      h('span.mm-cap', `What is new · ${BUILD.version}`),
      news);
  };

  const accountPage = () => card(
    h('b.mm-title', 'Account'),
    h('div.mm-row', avatar(opts.username || '?', 36), h('div.mm-row-text', h('b', opts.username || 'No name yet'), h('span', 'Your characters and worlds are saved to this account'))),
    h('button.btn.mm-wide', { onclick: () => opts.onSignOut() }, 'Sign out'));

  const render = () => {
    drawNav();
    panel.replaceChildren(({ play: playPage, worlds: worldsPage, character: characterPage, friends: friendsPage, settings: settingsPage, account: accountPage })[page]());
  };

  // what the pages need from the network: your worlds, and your friends with their names
  opts.listWorldSaves(user.uid).then(list => { saves = list || []; render(); }).catch(() => { saves = []; render(); });
  unsubFriends = social.watchFriends(user.uid, async f => {
    friends = f || {};
    render();
    for (const uid of Object.keys(friends)) if (!friendNames[uid]) {
      const p = await social.getPublicProfile(uid).catch(() => null);
      friendNames[uid] = p?.name || 'Player';
      render();
    }
  });
  render();

  return {
    refresh: render,
    hide() { root.style.display = 'none'; },
    show() { root.style.display = ''; render(); },
    setUsername(name) { opts.username = name; render(); },
    remove() { unsubFriends?.(); root.remove(); },
  };
}

