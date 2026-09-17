import { loadAssets, spriteAvailable, allAssetsReady } from './core/assets.js';
import { setPeopleSprites } from './data/objects.js';
import { setupPWA } from './core/pwa.js';
import { setupErrorReporting, reportError } from './net/errors.js';
import { BUILD } from './core/version.js';
import { setupSound } from './core/sound.js';
import { AUTOSAVE_SECONDS, OFFLINE_CAP_SECONDS, OFFLINE_PROGRESS, TILE, DAY_LENGTH } from './core/constants.js';
import { Input } from './core/input.js';
import { Renderer } from './render/renderer.js';
import { Game } from './game/game.js';
import { newState } from './game/state.js';
import { makeVisitGame, visitCenter } from './game/visit.js';
import { getProfile } from './net/save.js';
import { signInWithGoogle, signInWithEmail, createAccount, resetPassword, signOut, onAuth, adminStatus } from './net/firebase.js';
import { h, modal } from './ui/dom.js';
import { loadSave, writeSave, writeProfile, writePrivate, getBan, clearLocalSave, getUsername, claimUsername, setWorld, currentWorld, listWorldSaves, deleteWorldSave, oldVillage } from './net/save.js';
import { THEMES, themeOf } from './game/themeNames.js';
import { ensureProfile, updateProfileStats, getWorld, leaveOrCloseWorld, SOLO_WORLD } from './net/social.js';
import { worldPicker } from './ui/social.js';
import { Multiplayer } from './net/multiplayer.js';
import { HUD } from './ui/hud.js';
import { AdminConsole } from './ui/adminConsole.js';
import { loadingScreen, loginScreen, nameVillage, chooseUsername, bannedScreen, offlineSummary, extinctScreen } from './ui/screens.js';

setupPWA();
setupErrorReporting(BUILD);
setupSound();
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);

const app = {
  mode: 'boot',      // boot | title | playing
  game: null,
  demo: null,
  user: null,
  hud: null,
  mp: null,
  input: null,
  visit: null,         // another player's land we are looking at
  homeCamera: null,
  saveTimer: 0,
  saving: false,
};

boot();

async function boot() {
  document.getElementById('boot')?.remove();
  const loading = loadingScreen();
  // fonts never hold up the game for more than a moment
  await Promise.all([
    loadAssets(p => loading.progress(p * 0.9, 'Loading sprites…')),
    Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 700))]),
  ]);
  setPeopleSprites(spriteAvailable('people/farmer_m'));   // profession sprites once the People sheet is sliced
  loading.progress(1, 'Waking the world…');
  startDemo();
  requestAnimationFrame(loop);
  loading.remove();
  showTitle();
}

// ------------------------------------------------------------------ title screen

function startDemo() {
  const state = newState({ uid: 'demo', name: 'demo', villageName: 'demo' });
  const c = state.center;
  const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
  state.buildings.push(
    { id: 'd2', type: 'tent', tx: tx - 2, ty: ty - 2, built: true, progress: 1 },
    { id: 'd3', type: 'tent', tx: tx + 2, ty: ty - 2, built: true, progress: 1 },
    { id: 'd4', type: 'stockpile', tx: tx + 1, ty: ty + 1, built: true, progress: 1 },
  );
  state.time = DAY_LENGTH * 0.72;   // golden evening
  state.nextEventAt = Infinity;
  app.demo = new Game(state);
  app.demo.offline = true;          // no logs/events on the title screen
  app.demo.speed = 1.5;
  renderer.camera = { x: c.x, y: c.y, zoom: 2.6 };
}

function showTitle() {
  app.mode = 'title';
  const screen = loginScreen({
    user: app.user,
    onSignIn: async () => { await signInWithGoogle(); },
    onEmailSignIn: (email, pw) => signInWithEmail(email, pw),
    onCreateAccount: (email, pw) => createAccount(email, pw),
    onResetPassword: email => resetPassword(email),
    onPlay: async () => { await enterGame(app.user); screen.remove(); },
    onSignOut: async () => { await signOut(); },
  });
  onAuth(async user => {
    const changed = app.user?.uid !== user?.uid;
    app.user = user;
    if (!user) app.username = null;
    else {
      if (changed) app.username = null;
      const name = await getUsername(user.uid);
      if (name && app.user?.uid === user.uid) app.username = name;   // never overwrite a name claimed meanwhile
    }
    if (app.mode === 'title') screen.update(user, app.username);
  });
}

// ------------------------------------------------------------------ entering the game

async function enterGame(user) {
  if (!user) throw new Error('Please sign in first');
  await allAssetsReady();   // usually finished already: the rest of the art loads while you are on the title screen
  const ban = await getBan(user.uid);
  if (ban) {
    bannedScreen(ban, async () => { await signOut(); location.reload(); });
    return;
  }
  writePrivate(user).catch(e => console.warn('private profile', e));

  if (!app.username) {
    const name = await chooseUsername(n => claimUsername(user.uid, n), { onBack: () => location.reload() });
    if (!name) return;
    app.username = name;
  }
  ensureProfile(user.uid, app.username).catch(e => console.warn('profile', e));
  document.querySelectorAll('.screen.login, .vignette, .footer-note').forEach(e => e.remove());

  // pick a world (solo worlds and servers each keep their own save), then play in it
  const choice = await worldPicker({ user, username: app.username, lastWorld: lastWorld(user.uid), listWorldSaves, deleteWorldSave, oldVillage });
  if (choice.back) { location.reload(); return; }
  setWorld(choice.world);
  app.world = choice.kind === 'server' ? (await getWorld(choice.world).catch(() => null)) || { wid: choice.world, name: choice.name } : { wid: choice.world, name: choice.name };
  app.world.kind = choice.kind;
  let state = choice.isNew ? null : await loadSave(user.uid);
  if (!state && choice.importOld) state = choice.importOld;   // an old village becomes this world
  if (!state) {
    const seed = choice.seed ?? app.world.seed ?? [...String(choice.world)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    state = newState({ uid: user.uid, name: app.username, villageName: `${app.username}'s Hearth`, seed });
  }
  state.worldName = choice.name || app.world.name;
  state.owner.uid = user.uid;
  state.owner.name = app.username;

  const game = new Game(state);
  let summary = null;
  if (OFFLINE_PROGRESS) {   // wired out for now (see constants.js)
    const away = Math.min(OFFLINE_CAP_SECONDS, (Date.now() - (state.updatedAt || Date.now())) / 1000);
    if (away > 120 && state.villagers.length) summary = game.simulate(away);
  }

  rememberWorld(user.uid, { wid: choice.world, name: app.world.name, kind: choice.kind });
  startGame(user, game, { online: choice.kind === 'server' });
  const theme = THEMES[themeOf(state.seed)];
  setTimeout(() => app.hud?.announce(`${state.worldName} · ${theme.name}`), 400);
  if (choice.code) setTimeout(() => app.hud?.hint(`Server created. Share its code: ${choice.code}`, 9000), 900);
  if (summary) offlineSummary(summary);
}

// The world you were last playing, so closing the tab by accident never locks you out.
const LAST_WORLD_KEY = 'hb_last_world';
function rememberWorld(uid, w) { try { localStorage.setItem(LAST_WORLD_KEY, JSON.stringify({ uid, ...w, at: Date.now() })); } catch { /* private mode */ } }
function forgetWorld() { try { localStorage.removeItem(LAST_WORLD_KEY); } catch { /* ignore */ } }
function lastWorld(uid) {
  try {
    const w = JSON.parse(localStorage.getItem(LAST_WORLD_KEY));
    return w && w.uid === uid && Date.now() - w.at < 7 * 24 * 3600 * 1000 ? w : null;
  } catch { return null; }
}

function startGame(user, game, { online = true } = {}) {
  app.demo = null;
  app.game = game;
  app.mode = 'playing';
  renderer.camera = { ...game.state.camera };
  if (!renderer.camera.zoom) renderer.camera.zoom = 2;

  if (!app.input) {
    app.input = new Input(canvas, renderer, {
      onHover: (tx, ty, w) => app.hud?.onHover(tx, ty, w),
      onClick: (w, tx, ty) => { if (!app.visit) app.hud?.onClick(w, tx, ty, app.input.keys.has('shift')); },
      isPlacing: () => !app.visit && (!!app.hud?.buildType || !!app.hud?.demolishMode),
      isSailing: () => !!app.game?.sail,
      isLeading: () => (app.visit ? !!app.visit.hero : !!app.game?.hero),
      onPlaceStart: (tx, ty) => app.hud?.onPlaceStart(tx, ty),
      onPlaceMove: (tx, ty) => app.hud?.onPlaceMove(tx, ty),
      onPlaceEnd: (tx, ty) => app.hud?.onPlaceEnd(tx, ty, app.input.keys.has('shift')),
      onRightClick: () => { if (app.hud?.demolishMode) app.hud.toggleDemolish(false); else if (app.hud?.buildType) app.hud.cancelBuild(); else app.hud?.select(null); },
      onKey: e => app.hud?.onKey(e),
    });
  }

  // grab an item lying on the ground before the camera starts panning
  if (!app.itemGrab) {
    app.itemGrab = true;
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0 || app.visit || !app.hud) return;
      if (app.hud.grabGroundItem(e)) e.stopImmediatePropagation();
    }, { capture: true });
  }

  app.mp = online ? new Multiplayer(user, game, currentWorld()) : null;
  app.hud = new HUD({
    game, renderer, input: app.input, mp: app.mp, user, isAdmin: false,
    onSave: () => save(true),
    onSignOut: async () => { await save(true).catch(() => {}); forgetWorld(); app.mp?.stop(); await signOut(); location.reload(); },
    onRestart: () => restart(),
    world: app.world || { wid: currentWorld(), name: 'World' },
    username: app.username,
    // keeps the world remembered, so the main screen offers Rejoin World
    onBackToMenu: async () => { await save(true).catch(() => {}); app.mp?.stop(); location.reload(); },
    onSwitchWorld: async () => { await save(true).catch(() => {}); forgetWorld(); app.mp?.stop(); location.reload(); },
    onVisit: uid => visitRealm(uid),
    // out on the Open Sea the screen shows the shared ocean (your village keeps running at home)
    onSeaView: seaGame => { app.visit = seaGame; },
    // in person in another land (your spy taking control there)
    // below ground in a dungeon (your realm keeps living above)
    onDungeon: dg => { if (dg) { if (!app.visit) app.homeCamera = { ...renderer.camera }; app.visit = dg; } else app.visit = null; },
    onAbroad: (land, profile) => { if (!app.visit) app.homeCamera = { ...renderer.camera }; app.visit = land; app.hud.setVisiting(profile); },
    onReturnHome: () => returnHome(),
  });
  app.console = null;
  const hud = app.hud;
  app.adminStatus = 'checking';
  adminStatus(user).then(status => {
    app.adminStatus = status;
    if (status !== 'admin' || app.hud !== hud) return;
    hud.isAdmin = true;
    app.console = new AdminConsole({ game, mp: app.mp, user, hud });
  });
  if (app.mp) {
    app.mp.on('reset', () => { clearLocalSave(user.uid); restart(); });
    app.mp.start();
    writeProfile(user, game).catch(e => console.warn('profile', e));
  }

  game.on('extinct', () => extinctScreen(() => { document.querySelector('.modal-bg')?.remove(); restart(); }));
  if (game.day === 0 && !game.state.buildings.length) {
    game.announce(`${game.state.owner.villageName} is founded`);
    app.hud.hint('Open Build (B) and place a Campfire, then a Craft Hut for your blacksmith. Your people will do the rest.', 9000);
  }
}

async function visitRealm(uid) {
  if (uid === app.user?.uid) { returnHome(); return; }
  const profile = await getProfile(uid);
  // their land, their rules: the owner has to let you in
  if (app.mp) {
    const who = profile?.villageName || 'their land';
    const wait = app.hud.hint(`Asking ${profile?.name || 'the ruler'} to let you visit ${who}...`, 60_000);
    const answer = await app.mp.requestVisit({ uid });
    app.hud.clearHint?.(wait);
    const why = { no: `${profile?.name || 'The ruler'} refused your visit.`, timeout: `No answer from ${profile?.name || 'the ruler'}. Try again later.`, offline: `${profile?.name || 'The ruler'} is offline. Visits need them online to let you in.`, cancelled: 'Visit request cancelled.' }[answer];
    if (answer !== 'yes') { app.hud.hint(why, 4000); throw Object.assign(new Error(why), { shown: true }); }
  }
  const visit = makeVisitGame({ ...profile, uid });
  if (!app.visit) app.homeCamera = { ...renderer.camera };
  app.visit = visit;
  const c = visitCenter(visit);
  renderer.camera = { x: c.x, y: c.y, zoom: 2.2 };
  app.hud.setVisiting({ ...profile, uid });
  app.hud.arriveAsVisitor(visit, { ...profile, uid });   // walk their land as your avatar
}

function returnHome() {
  if (!app.visit) return;
  app.hud.leaveAbroad?.();
  app.visit = null;
  if (app.homeCamera) renderer.camera = app.homeCamera;
  app.hud.setVisiting(null);
}

async function restart() {
  const user = app.user;
  const old = app.game;
  app.visit = null;
  app.mp?.stop();
  app.hud?.destroy();
  app.console = null;
  const state = newState({ uid: user.uid, name: app.username || old?.state.owner.name, villageName: old?.state.owner.villageName || 'New Hearth', seed: old?.state.seed });
  state.worldName = old?.state.worldName;
  const game = new Game(state);
  startGame(user, game, { online: app.world?.kind === 'server' });
  await save(true).catch(() => {});
}

// ------------------------------------------------------------------ saving

async function save(force = false) {
  const { game, user } = app;
  if (!game || !user || (app.saving && !force)) return;
  app.saving = true;
  try {
    game.state.camera = { ...renderer.camera };
    await writeSave(user.uid, game.state);
    await writeProfile(user, game);
    const s = game.state;
    const prev = app.bestStats || {};
    app.bestStats = {
      bestPop: Math.max(prev.bestPop || 0, s.villagers.length, s.stats.maxPop || 0),
      bestEra: Math.max(prev.bestEra || 0, s.era),
      raidsWon: s.stats.raidsWon || 0,
      karma: Math.round(s.karma),
      dynasty: s.ruler?.dynasty || '',
    };
    updateProfileStats(user.uid, app.bestStats);
    if (app.hud) { app.hud.lastSavedAt = Date.now(); app.hud.setSaveProblem(null); }
  } catch (e) {
    // the village is already stored on this device (writeSave does that first): say what went wrong and retry soon
    const denied = e?.code === 'permission-denied' || /permission/i.test(e?.message || '');
    app.hud?.setSaveProblem(denied
      ? 'Cloud save blocked: the Firebase rules are not published (run rules.bat). Your village is safe on this device.'
      : `Cloud save failed (${e?.message || 'offline'}). Your village is safe on this device — retrying.`);
    app.saveTimer = AUTOSAVE_SECONDS - 15;   // try again in 15 seconds
    reportError(e, 'save');
    throw e;
  } finally {
    app.saving = false;
  }
}

// F2 opens the admin command line (admins only)
window.addEventListener('keydown', e => {
  if (e.key !== 'F2' || !app.game) return;
  e.preventDefault();
  if (app.console) { app.console.toggle(); return; }
  if (document.querySelector('.admin-help')) return;
  // not an admin (yet): say exactly why, and show the UID to add in Firebase
  const uid = app.user?.uid || '';
  const why = {
    checking: 'Still checking your admin rights — try again in a second.',
    'not-listed': 'Your account is not listed as an admin yet.',
    rules: 'Firebase refused the check: the new Firestore rules are not published yet.',
    error: 'Could not reach Firebase to check your admin rights.',
  }[app.adminStatus] || 'Your account is not an admin.';
  const copy = h('button.btn.sm', { onclick: () => { navigator.clipboard?.writeText(uid); copy.textContent = 'Copied!'; } }, 'Copy UID');
  const m = modal([
    h('h2', 'Admin panel locked'),
    h('div.muted', why),
    h('div.law-cat',
      h('div.faint', 'Your UID'),
      h('div.row', h('code', { style: { userSelect: 'text', wordBreak: 'break-all', fontSize: '13px' } }, uid), h('div.spacer'), copy)),
    h('div.faint', { html: '<b>To unlock:</b><br>1. Firebase → <b>Firestore</b> → collection <b>admins</b> → add a document whose <b>Document ID</b> is the UID above (add any field, e.g. admin = true).<br>2. Firebase → <b>Realtime Database</b> → add <b>admins</b> → <b>UID</b> → <b>true</b>.<br>3. Publish both rules files (firestore.rules and database.rules.json).<br>4. Reload the game and press F2.' }),
    h('button.btn.primary', { onclick: () => m.close() }, 'OK'),
  ], { cls: 'admin-help', onClose: () => {} });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save().catch(() => {});
});
window.addEventListener('beforeunload', () => {
  if (app.game && app.user) {
    app.game.state.camera = { ...renderer.camera };
    save().catch(() => {});
  }
});

// ------------------------------------------------------------------ loop

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (app.mode === 'playing' && app.game) {
    app.input.update(dt);
    app.game.update(dt);          // your realm keeps living while you travel
    app.hud.tick(dt);
    if (app.visit) {
      app.visit.update(dt);
      renderer.render(app.visit, dt);
    } else {
      renderer.render(app.game, dt);
    }
    app.saveTimer += dt;
    if (app.saveTimer >= AUTOSAVE_SECONDS) {
      app.saveTimer = 0;
      save().catch(() => {});   // save() reports problems on screen and keeps a local backup
    }
  } else if (app.demo) {
    app.demo.update(dt);
    const c = app.demo.state.center;
    const t = now / 1000;
    renderer.camera.x = c.x + Math.cos(t * 0.05) * TILE * 6;
    renderer.camera.y = c.y + Math.sin(t * 0.05) * TILE * 4;
    renderer.render(app.demo, dt);
  }
  requestAnimationFrame(loop);
}

// Dev-only test hook (removed from production builds): lets tools start a local village without Google sign-in.
if (import.meta.env.DEV) {
  window.__hb = {
    app, renderer,
    startLocal(villageName = 'Test Hearth') {
      document.querySelectorAll('.screen, .vignette, .footer-note').forEach(e => e.remove());
      const user = { uid: 'dev', displayName: 'Dev Tester', email: 'dev@local', photoURL: '' };
      app.user = user;
      startGame(user, new Game(newState({ uid: 'dev', name: 'Dev', villageName })), { online: false });
      app.console = new AdminConsole({ game: app.game, mp: null, user });
    },
    /** Emulator only (?emu): sign in anonymously and stay on the title screen, so the rest can be clicked through. */
    async devSignIn() {
      const { signInAnonymously } = await import('firebase/auth');
      const { auth } = await import('./net/firebase.js');
      return (await signInAnonymously(auth)).user.uid;
    },
    /** Emulator only (?emu): sign in as a throwaway local test player and go through the normal world picker. */
    async devLogin(name) {
      const { signInAnonymously } = await import('firebase/auth');
      const { auth } = await import('./net/firebase.js');
      const user = (await signInAnonymously(auth)).user;
      app.user = user;
      app.username = await claimUsername(user.uid, name);
      await enterGame(user);
      return user.uid;
    },
    /** Emulator only (?emu): join as a throwaway local test player, no real account. */
    async devJoin(name, villageName) {
      const { signInAnonymously } = await import('firebase/auth');
      const { auth } = await import('./net/firebase.js');
      document.querySelectorAll('.screen, .vignette, .footer-note').forEach(e => e.remove());
      const user = (await signInAnonymously(auth)).user;
      app.user = user;
      app.username = await claimUsername(user.uid, name);
      const state = newState({ uid: user.uid, name, villageName });
      state.shieldUntil = 0;
      const game = new Game(state);
      startGame(user, game);
      await save(true);
      return user.uid;
    },
  };
}
