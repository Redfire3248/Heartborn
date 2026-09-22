import { avatarId } from '../game/avatars.js';
import { CREATURES } from '../data/objects.js';
import { damageCreature } from '../game/creatures.js';
import { mobsToSend, applyNetMobs, MOB_LEASE_MS } from '../game/netMobs.js';
import { hookWorldSync, applyEdit } from '../game/worldSync.js';
import { on } from '../core/features.js';
import { toolsOf, giveTool, dropTool } from '../game/tools.js';
import { rpgOf, onHeroKill } from '../game/rpg.js';
import { cleanText } from './chatSafety.js';
import {
  ref, onValue, onChildAdded, onChildRemoved, push, set, update, remove, get, serverTimestamp,
  onDisconnect, query, orderByChild, limitToLast, runTransaction,
} from 'firebase/database';
import { rtdb } from './firebase.js';
import { profileFor, writeProfile, getProfile } from './save.js';
import { EVENTS } from '../data/events.js';
import { RAID_SHIELD_MS, ADULT_AGE, TILE } from '../core/constants.js';
import { clamp } from '../core/rng.js';
import { trySpot, DUST_SECONDS, spawnArmy, tributeCost, rally } from '../game/war.js';
import { returnHome } from '../game/villagers.js';
import { seaLift, seaUpdate, seaIncomingShot, BOATS } from '../game/sailing.js';
import { isTrained } from '../game/dynasty.js';
import { isSpy, destroyBuildings, damageBuilding, sufferStrike, hasMissiles, hasOrbital, MISSILE_COST } from '../game/intrigue.js';

const RAID_COOLDOWN_MS = 2 * 3600 * 1000;
const CHAT_COOLDOWN_MS = 1500;
const VISIT_ASK_MS = 60_000;   // how long a visit request waits for an answer
const INFILTRATE_WINDOW_MS = 10 * 60_000;   // a spy sent in person waits this long for you to take control
// Tests shrink real-time waits (travel, grace periods) with globalThis.HB_TIME_SCALE.
const scale = () => globalThis.HB_TIME_SCALE ?? 1;
const DEFENDER_GRACE = () => Math.max(3000, 45_000 * scale());     // an online defender gets first claim on the battle
const STALE_BATTLE = () => Math.max(60_000, 10 * 60_000 * scale()); // a live battle abandoned this long is decided by stats

/** Every village has a fixed place in the realm, derived from its owner's id (0..100 on each axis). */
export function realmPos(uid) {
  let h = 2166136261;
  for (const ch of uid) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return { x: ((h >>> 0) % 1000) / 10, y: (((h >>> 10) >>> 0) % 1000) / 10 };
}

/** Travel time between two villages: armies 4–20 min, caravans a bit faster. */
export function travelMs(fromUid, toUid, kind = 'army') {
  const a = realmPos(fromUid), b = realmPos(toUid);
  const d = Math.hypot(a.x - b.x, a.y - b.y);          // 0 .. ~141
  const minutes = 4 + d * 0.115;
  return Math.round(minutes * (kind === 'caravan' ? 0.6 : 1) * 60_000 * scale());
}

/** The villager a spy on the spot chose: whoever stands nearest where they were (same job preferred). */
function personNear(s, target, ok) {
  if (!target || target.x == null) return null;
  const near = s.villagers.filter(v => !v.away && ok(v) && Math.hypot(v.x - target.x, v.y - target.y) < 32 * 6);
  near.sort((a, b) => (b.job === target.job) - (a.job === target.job) || Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
  return near[0] || null;
}

export const fmtMinutes = ms => {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

/**
 * Live multiplayer over the Realtime Database:
 * presence, global chat, trade/gift/alliance offers, marching armies, admin commands and broadcasts.
 *
 * Offers use escrow: the sender pays up front; the recipient accepts or declines;
 * the sender's client then settles (receives payment or a refund) from offersSent.
 *
 * Attacks (attacks/{defender}/{id}) march for a few real minutes. The defender's scouts warn
 * them early. On arrival the defender — if online — claims the battle and fights it live in
 * their world; otherwise the attacker's client decides it by stats. Each side applies its own
 * results and marks itself settled; the record is deleted once both sides have settled.
 */
export class Multiplayer {
  constructor(user, game, world = 'realm') {
    this.user = user;
    this.g = game;
    game.mp = this;   // the game asks us to pass blows on to whoever runs the monsters
    this.uid = user.uid;
    this.world = world;
    this.w = `w/${world}/`;   // every multiplayer path lives inside its world
    this.unsubs = [];
    this.players = [];
    this.inbox = [];
    this.allies = new Set();
    this.chat = [];
    this.incoming = {};        // attacks on me
    this.outgoing = {};        // my armies: id -> attack record (or null once deleted)
    this.watching = new Map(); // attack id -> unsubscribe
    this.warned = new Set();
    this.sweeps = {};         // attack id -> scouting sweep timer
    this.busy = new Set();
    this._seenEdits = new Set();   // changes to the island we have already played back
    this.lastChatAt = 0;
    this.startedAt = Date.now();
    this.listeners = {};
    game.mpThreats = [];
  }

  /** Players are known by their username, never their email. */
  get name() { return this.g.state.owner.name || 'Chieftain'; }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, data) { for (const fn of this.listeners[name] || []) fn(data); }

  start() {
    const me = ref(rtdb, `${this.w}presence/${this.uid}`);
    this.unsubs.push(onValue(ref(rtdb, '.info/connected'), snap => {
      if (!snap.val()) return;
      onDisconnect(me).update({ online: false, lastSeen: serverTimestamp() });
      set(me, this.presenceData(true));
    }));
    this.presenceTimer = setInterval(() => this.heartbeat(), 30_000);
    this.warTimer = setInterval(() => this.warTick(), 1000);

    // shared monsters: one player runs them for everybody, and passes them on a few times a second
    if (this.world !== 'realm') this.startMobs();

    // the shared world: every change anyone makes to the island (chopped, mined, paved, built, knocked down)
    if (this.world !== 'realm') {
      hookWorldSync(this.g, e => this.sendEdit(e));
      const editQ = query(ref(rtdb, `${this.w}edits`), orderByChild('ts'), limitToLast(600));
      this.unsubs.push(onChildAdded(editQ, snap => {
        const e = snap.val();
        if (!e || e.uid === this.uid) return;         // our own changes already happened here
        if (this._seenEdits.has(snap.key)) return;
        this._seenEdits.add(snap.key);
        applyEdit(this.g, e);
      }, () => {}));
    }

    // everyone playing this world, live: the same island for all of us, so we see each other walking about
    const mine = ref(rtdb, `${this.w}live/${this.uid}`);
    onDisconnect(mine).remove();
    this.unsubs.push(onValue(ref(rtdb, `${this.w}live`), snap => {
      const prev = new Map((this.g.livePlayers || []).map(s => [s.id, s]));
      this.g.livePlayers = this.livePlayerList(snap.val() || {}, prev);
      this.emit('livePlayers', this.g.livePlayers);
    }, () => {}));

    this.unsubs.push(onValue(ref(rtdb, `${this.w}presence`), snap => {
      const all = snap.val() || {};
      this.players = Object.entries(all).map(([uid, p]) => ({ uid, ...p })).sort((a, b) => (b.online - a.online) || (b.pop - a.pop));
      this.emit('players', this.players);
    }));

    const chatQ = query(ref(rtdb, `${this.w}chat`), orderByChild('ts'), limitToLast(60));
    this.unsubs.push(onChildAdded(chatQ, snap => {
      this.chat.push({ id: snap.key, ...snap.val() });
      if (this.chat.length > 60) this.chat.shift();
      this.emit('chat', this.chat);
    }));
    this.unsubs.push(onChildRemoved(chatQ, snap => {
      this.chat = this.chat.filter(m => m.id !== snap.key);
      this.emit('chat', this.chat);
    }));

    this.unsubs.push(onValue(ref(rtdb, `${this.w}offers/${this.uid}`), snap => this.handleInbox(snap.val() || {})));
    this.unsubs.push(onValue(ref(rtdb, `${this.w}offersSent/${this.uid}`), snap => this.settleSent(snap.val() || {})));
    // people asking to visit my land
    this.unsubs.push(onValue(ref(rtdb, `${this.w}visits/${this.uid}`), snap => {
      const all = snap.val() || {};
      const asks = Object.entries(all).filter(([, v]) => v.status === 'ask' && Date.now() - (v.ts || 0) < VISIT_ASK_MS).map(([uid, v]) => ({ uid, ...v }));
      this.visitAsks = asks;
      this.emit('visitAsks', asks);
    }));
    this.unsubs.push(onValue(ref(rtdb, `${this.w}alliances/${this.uid}`), snap => {
      this.allies = new Set(Object.keys(snap.val() || {}));
      this.emit('players', this.players);
    }));

    // war
    this.unsubs.push(onValue(ref(rtdb, `${this.w}attacks/${this.uid}`), snap => {
      this.incoming = snap.val() || {};
      this.warTick();
    }));
    this.unsubs.push(onValue(ref(rtdb, `${this.w}attacksSent/${this.uid}`), snap => this.trackOutgoing(snap.val() || {})));
    this.unsubs.push(onValue(ref(rtdb, `${this.w}missions/${this.uid}`), snap => { this.incomingMissions = snap.val() || {}; this.applyMissions(); }));
    this.unsubs.push(onValue(ref(rtdb, `${this.w}missionsSent/${this.uid}`), snap => { this.sentMissions = snap.val() || {}; }));
    // people from other lands walking in ours (visitors, and spies dressed as travellers)
    this.unsubs.push(onValue(ref(rtdb, `${this.w}strangers/${this.uid}`), snap => {
      const all = snap.val() || {};
      const now = Date.now();
      const prev = new Map((this.g.strangers || []).map(s => [s.id, s]));
      this.g.strangers = this.strangerList(all, prev);
    }));
    // player vs player: blows other players land on you
    this.unsubs.push(onChildAdded(ref(rtdb, `${this.w}pvpHits/${this.uid}`), snap => {
      const hit = snap.val();
      remove(snap.ref).catch(() => {});
      if (hit && Date.now() - (hit.ts || 0) < 5000) this.emit('pvpHit', hit);
    }));
    const offBattle = this.g.on('battleEnd', r => { if (r.kind === 'player') this.finishLiveBattle(r); });
    this.unsubs.push(offBattle);

    this.unsubs.push(onValue(ref(rtdb, 'announcements'), snap => {
      const a = snap.val();
      if (a?.text && (a.ts || 0) > (Number(localStorage.getItem('hb_last_announcement')) || 0)) {
        localStorage.setItem('hb_last_announcement', String(a.ts));
        this.emit('announcement', a);
      }
    }));
    this.unsubs.push(onValue(ref(rtdb, 'globalEvent'), snap => {
      const ev = snap.val();
      if (!ev?.id || (ev.ts || 0) < this.startedAt) return;
      const event = EVENTS.find(e => e.id === ev.id);
      if (event) this.g.startEvent(event);
    }));
    this.unsubs.push(onChildAdded(ref(rtdb, `adminCommands/${this.uid}`), snap => {
      this.applyAdminCommand(snap.val());
      remove(snap.ref);
    }));
  }

  stop() {
    this.leaveSea?.();
    clearInterval(this.presenceTimer);
    clearInterval(this.warTimer);
    for (const u of this.unsubs) u();
    for (const u of this.watching.values()) u();
    this.unsubs = [];
    this.watching.clear();
    update(ref(rtdb, `${this.w}presence/${this.uid}`), { online: false, lastSeen: serverTimestamp() }).catch(() => {});
  }

  presenceData(online) {
    const p = profileFor(this.user, this.g);
    return {
      online, name: p.name, villageName: p.villageName, pop: p.pop, karma: p.karma,
      era: p.era, wealth: p.wealth, seed: p.seed, lastSeen: serverTimestamp(),   // seed: the World Map draws their real island
    };
  }

  heartbeat() {
    set(ref(rtdb, `${this.w}presence/${this.uid}`), this.presenceData(true)).catch(() => {});
    writeProfile(this.user, this.g).catch(() => {});
  }

  // ---------------- chat ----------------
  async sendChat(text) {
    text = cleanText(text.trim().slice(0, 200));   // swear words never leave your device
    if (!text) return;
    if (Date.now() - this.lastChatAt < CHAT_COOLDOWN_MS) throw new Error('Slow down!');
    this.lastChatAt = Date.now();
    await push(ref(rtdb, `${this.w}chat`), {
      uid: this.uid, name: this.name,
      village: this.g.state.owner.villageName, text, ts: serverTimestamp(),
    });
  }

  // ---------------- offers ----------------
  // ================================================================ the Open Sea
  /**
   * Ships at sea are shared live: sea/{uid} is each captain's ship (position, heading, hull),
   * seaShots/{id} are bombs in flight (every client flies them; the ship that gets hit applies the damage),
   * seaSunk/{id} tells a captain they sank someone.
   */
  enterSea() {
    if (this.seaUnsubs) return;
    const g = this.g;
    this.seaUnsubs = [];
    const mine = ref(rtdb, `${this.w}sea/${this.uid}`);
    onDisconnect(mine).remove();
    this.seaUnsubs.push(onValue(ref(rtdb, `${this.w}sea`), snap => {
      const all = snap.val() || {};
      const now = Date.now();
      for (const [uid, d] of Object.entries(all)) if (uid !== this.uid && now - (d.ts || 0) < 15_000) seaUpdate(g, uid, d);
      for (const uid of [...(g.sail?.others?.keys() || [])]) if (!all[uid] || now - (all[uid].ts || 0) >= 15_000) seaUpdate(g, uid, null);
    }));
    const since = Date.now() - 2000;
    this.seaUnsubs.push(onChildAdded(ref(rtdb, `${this.w}seaShots`), snap => {
      const shot = snap.val();
      if (shot && shot.from !== this.uid && (shot.ts || 0) > since) seaIncomingShot(g, shot);
    }));
    this.seaUnsubs.push(onChildAdded(ref(rtdb, `${this.w}seaSunk`), snap => {
      const e = snap.val();
      if (!e || (e.ts || 0) < since) return;
      if (e.by === this.uid) {
        const gold = 80 + g.state.era * 40;
        g.addResource('gold', gold);
        if (g.sail) { g.sail.sunk++; g.sail.gold += gold; }
        g.log(`You sank ${e.victimName}'s ${e.ship}! +${gold} gold`, 'good');
        g.announce(`You sank ${e.victimName}'s ship!`);
        remove(snap.ref).catch(() => {});
      }
    }));
    this.lastSeaPublish = 0;
  }

  /** Our ship's position, a few times a second. */
  publishShip(s, boat) {
    if (!this.seaUnsubs) this.enterSea();
    const now = Date.now();
    if (now - this.lastSeaPublish < 200) return;
    this.lastSeaPublish = now;
    set(ref(rtdb, `${this.w}sea/${this.uid}`), {
      x: Math.round(s.x), y: Math.round(s.y), a: Math.round(s.angle * 100) / 100, type: s.type,
      hull: Math.max(0, Math.ceil(boat.hull)), max: BOATS[s.type].hull, name: this.name, village: this.g.state.owner.villageName, ts: now,
    }).catch(() => {});
  }

  sendShot(shot) {
    const r = push(ref(rtdb, `${this.w}seaShots`));
    set(r, { from: this.uid, x: Math.round(shot.x), y: Math.round(shot.y), vx: Math.round(shot.vx), vy: Math.round(shot.vy), dmg: shot.dmg, ts: Date.now() }).catch(() => {});
    setTimeout(() => remove(r).catch(() => {}), 4000);   // bombs only live a moment
  }

  reportSunk(byUid, boat) {
    push(ref(rtdb, `${this.w}seaSunk`), { victim: this.uid, victimName: this.name, by: byUid, ship: BOATS[boat.type]?.name || 'ship', ts: Date.now() }).catch(() => {});
  }

  leaveSea() {
    for (const u of this.seaUnsubs || []) u();
    this.seaUnsubs = null;
    remove(ref(rtdb, `${this.w}sea/${this.uid}`)).catch(() => {});
  }

  /**
   * Ask another ruler to let us visit their land. Resolves 'yes' | 'no' | 'timeout' | 'offline'.
   * visits/{host}/{guest} = { status: 'ask' | 'yes' | 'no', name, villageName, ts }
   */
  async requestVisit(host) {
    const p = this.players.find(x => x.uid === host.uid);
    if (!p?.online) return 'offline';
    const path = ref(rtdb, `${this.w}visits/${host.uid}/${this.uid}`);
    await set(path, { status: 'ask', name: this.name, villageName: this.g.state.owner.villageName, ts: Date.now() });
    return new Promise(resolve => {
      let done = false;
      const finish = answer => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsub();
        remove(path).catch(() => {});
        resolve(answer);
      };
      const unsub = onValue(path, snap => {
        const s = snap.val()?.status;
        if (s === 'yes' || s === 'no') finish(s);
        else if (!snap.exists() && !done) finish('no');
      });
      const timer = setTimeout(() => finish('timeout'), VISIT_ASK_MS);
      this.cancelVisitAsk = () => finish('cancelled');
    });
  }

  /** Host: allow or refuse a visitor. */
  answerVisit(guestUid, allow) {
    return set(ref(rtdb, `${this.w}visits/${this.uid}/${guestUid}/status`), allow ? 'yes' : 'no').catch(() => {});
  }

  async sendOffer(to, type, give = {}, want = {}) {
    if (to.uid === this.uid) throw new Error("That's you!");
    if (type === 'trade' && !this.g.hasBuilding('market')) throw new Error('You need a Market to trade');
    give = cleanRes(give); want = cleanRes(want);
    if (!this.g.spend(give)) throw new Error('Not enough resources');
    const id = push(ref(rtdb, `${this.w}offers/${to.uid}`)).key;
    const offer = {
      id, type, from: this.uid, fromName: this.name, fromVillage: this.g.state.owner.villageName,
      to: to.uid, toName: to.name || '', toVillage: to.villageName || '', give, want, ts: Date.now(), status: 'pending',
      deliverAt: Date.now() + travelMs(this.uid, to.uid, 'caravan'),
    };
    try {
      await update(ref(rtdb), { [`${this.w}offers/${to.uid}/${id}`]: offer, [`${this.w}offersSent/${this.uid}/${id}`]: offer });
    } catch (e) {
      for (const [k, v] of Object.entries(give)) this.g.addResource(k, v);   // refund
      throw e;
    }
    if (type === 'gift') this.g.addKarma(2);
    this.g.log(`A ${type === 'alliance' ? 'messenger' : 'caravan'} sets out for ${to.villageName || 'their village'} — arrives in ${fmtMinutes(offer.deliverAt - offer.ts)}.`, 'event');
  }

  /**
   * Send an item trade: give = { res, gear: [items], tools: { key: n } }, want = { res, tools }.
   * What you give leaves your inventory at once (held in the offer) and comes back if they decline.
   */
  async sendTrade(to, give = {}, want = {}) {
    if (!to?.uid || to.uid === this.uid) throw new Error("That's you!");
    const g = this.g, r = rpgOf(g);
    give = { res: cleanRes(give.res), gear: (give.gear || []).filter(it => r.bag.includes(it)), tools: cleanRes(give.tools) };
    want = { res: cleanRes(want.res), tools: cleanRes(want.tools) };
    const empty = b => !Object.keys(b.res).length && !(b.gear?.length) && !Object.keys(b.tools).length;
    if (empty(give) && empty(want)) throw new Error('Add something to the trade');
    const owned = toolsOf(g);
    for (const [k, n] of Object.entries(give.tools)) if ((owned[k] || 0) < n) throw new Error(`You do not have ${n} of that tool`);
    if (!g.spend(give.res)) throw new Error('Not enough resources');
    r.bag = r.bag.filter(it => !give.gear.includes(it));
    for (const [k, n] of Object.entries(give.tools)) dropTool(g, k, n);
    const id = push(ref(rtdb, `${this.w}offers/${to.uid}`)).key;
    const offer = {
      id, type: 'itemtrade', from: this.uid, fromName: this.name, fromVillage: g.state.owner.villageName,
      to: to.uid, toName: to.name || '', toVillage: to.villageName || '', give: JSON.parse(JSON.stringify(give)), want, ts: Date.now(), status: 'pending', deliverAt: Date.now(),
    };
    try {
      await update(ref(rtdb), { [`${this.w}offers/${to.uid}/${id}`]: offer, [`${this.w}offersSent/${this.uid}/${id}`]: offer });
    } catch (e) {
      this.receiveBundle(give);   // refund
      throw e;
    }
    g.emit('change');
    return offer;
  }

  /** Put a trade bundle into your inventory. */
  receiveBundle(b = {}) {
    const g = this.g, r = rpgOf(g);
    for (const [k, v] of Object.entries(b.res || {})) g.state.resources[k] = (g.state.resources[k] || 0) + v;
    for (const it of b.gear || []) r.bag.push(it);
    for (const [k, n] of Object.entries(b.tools || {})) giveTool(g, k, n);
    g.emit('change');
  }

  handleInbox(all) {
    this.allOffers = Object.values(all);
    this.refreshInbox();
  }

  /** Only caravans that have actually arrived show up. */
  refreshInbox() {
    const now = Date.now();
    const arrived = (this.allOffers || []).filter(o => !o.deliverAt || o.deliverAt <= now).sort((a, b) => b.ts - a.ts);
    if (arrived.length !== this.inbox.length) {
      if (arrived.length > this.inbox.length) this.g.log('A caravan has arrived at the village gates.', 'event');
      this.inbox = arrived;
      this.emit('inbox', this.inbox);
    }
  }

  async respond(offer, accept) {
    const g = this.g;
    const paths = {};
    const status = accept ? 'accepted' : 'declined';
    if (accept && offer.type === 'trade' && !g.spend(offer.want)) throw new Error('You cannot afford their request');
    if (accept && offer.type === 'itemtrade') {
      const w = offer.want || {}, owned = toolsOf(g);
      for (const [k, n] of Object.entries(w.tools || {})) if ((owned[k] || 0) < n) throw new Error(`You need ${n} ${k.replace(/_/g, ' ')}`);
      if (!g.spend(w.res || {})) throw new Error('You cannot afford what they want');
      for (const [k, n] of Object.entries(w.tools || {})) dropTool(g, k, n);
      this.receiveBundle(offer.give);
      g.log(`Traded with ${offer.fromName}.`, 'good');
    } else if (accept) {
      for (const [k, v] of Object.entries(offer.give || {})) g.addResource(k, v);
      if (offer.type === 'alliance') paths[`${this.w}alliances/${this.uid}/${offer.from}`] = true;
      g.log(`Accepted ${offer.type} from ${offer.fromName}.`, 'good');
    }
    paths[`${this.w}offersSent/${offer.from}/${offer.id}/status`] = status;
    paths[`${this.w}offers/${this.uid}/${offer.id}`] = null;
    await update(ref(rtdb), paths);
    g.emit('change');
  }

  settleSent(all) {
    const g = this.g;
    const done = (g.state.settledOffers ||= []);
    for (const o of Object.values(all)) {
      if (o.status === 'pending' || done.includes(o.id)) {
        if (done.includes(o.id)) remove(ref(rtdb, `${this.w}offersSent/${this.uid}/${o.id}`));
        continue;
      }
      done.push(o.id);
      if (done.length > 100) done.shift();
      if (o.status === 'accepted') {
        if (o.type === 'trade') for (const [k, v] of Object.entries(o.want || {})) g.addResource(k, v);
        if (o.type === 'itemtrade') this.receiveBundle(o.want);
        if (o.type === 'alliance') set(ref(rtdb, `${this.w}alliances/${this.uid}/${o.to}`), true);
        g.log(`${o.toName || 'A player'} accepted your ${o.type}.`, 'good');
      } else if (o.status === 'declined' && o.type === 'itemtrade') {
        this.receiveBundle(o.give);
        g.log(`${o.toName || 'A player'} declined your trade. Everything came back.`, 'info');
      } else if (o.status === 'declined') {
        for (const [k, v] of Object.entries(o.give || {})) g.addResource(k, v);
        g.log(`${o.toName || 'A player'} declined your ${o.type}. Refunded.`, 'info');
      }
      remove(ref(rtdb, `${this.w}offersSent/${this.uid}/${o.id}`));
      g.emit('change');
    }
  }

  async breakAlliance(uid) {
    await update(ref(rtdb), { [`${this.w}alliances/${this.uid}/${uid}`]: null });
  }

  // ================================================================ war
  availableWarriors() {
    return this.g.state.villagers.filter(v => v.job === 'warrior' && v.armed && isTrained(v) && !v.away && v.age >= ADULT_AGE && v.hp > 30);
  }

  armies() {
    return Object.values(this.outgoing).filter(Boolean);
  }

  raidCheck(target) {
    const g = this.g;
    const s = g.state;
    if (!g.hasBuilding('barracks')) return 'You need Barracks to raise an army';
    if (!this.availableWarriors().length) {
      return this.g.state.villagers.some(v => v.job === 'warrior') ? 'Your warriors have no weapons — build a Craft Hut and assign a Smith' : 'Assign some healthy Warriors first';
    }
    if (this.allies.has(target.uid)) return 'You cannot attack an ally';
    if (this.armies().some(a => a.to === target.uid)) return 'Your army is already marching on them';
    const cooldown = RAID_COOLDOWN_MS * g.law.raidCooldown;
    if (Date.now() - (s.lastRaidAt || 0) < cooldown) {
      const m = Math.ceil((cooldown - (Date.now() - s.lastRaidAt)) / 60000);
      return `Your people need time before another war (${m >= 60 ? Math.ceil(m / 60) + 'h' : m + 'm'})`;
    }
    return true;
  }

  /** opts.count: how many warriors to send (the best fighters go first); opts.bySea: carried by the fleet. */
  async launchAttack(targetUid, opts = {}) {
    const g = this.g;
    const s = g.state;
    const target = await getProfile(targetUid);
    if (!target) throw new Error('Village not found');
    const check = this.raidCheck({ ...target, uid: targetUid });
    if (check !== true) throw new Error(check);
    if ((target.shieldUntil || 0) > Date.now()) throw new Error(`${target.villageName} is protected by a shield`);

    const all = this.availableWarriors().sort((a, b) => (b.skills.combat || 0) - (a.skills.combat || 0));
    const count = Math.max(1, Math.min(all.length, Math.floor(opts.count || all.length)));
    const warriors = all.slice(0, count);
    let lift = null;
    if (opts.bySea) {
      lift = seaLift(g);
      if (!g.hasBuilding('shipyard') || !lift.ships.length) throw new Error('You need a Shipyard and boats to invade by sea');
      if (lift.capacity < warriors.length) throw new Error(`Your boats carry only ${lift.capacity} soldiers — send fewer or build more boats`);
    }
    const bombs = Math.min(Math.floor(s.resources.bombs || 0), warriors.length * 2);
    s.resources.bombs -= bombs;
    // by sea: faster, a surprise landing (+15%) and the ships' guns join the attack
    const seaBonus = lift ? 0.15 : 0;
    const power = Math.round(warriors.reduce((sum, v) => sum + 5 + v.skills.combat, 0) * (1 + g.combatBonus + (g.raidBonus || 0) + seaBonus) + Math.max(0, g.fateBonus) * 10 + bombs * 3 + (lift ? lift.guns * 6 : 0));
    const now = Date.now();
    const arrivesAt = now + travelMs(this.uid, targetUid, 'army') * (lift ? 0.6 : 1);
    const id = push(ref(rtdb, `${this.w}attacks/${targetUid}`)).key;
    const attack = {
      id, from: this.uid, fromName: this.name, fromVillage: s.owner.villageName,
      to: targetUid, toVillage: target.villageName, power, warriors: warriors.length, bombs, launchedAt: now, arrivesAt, status: 'marching', bySea: !!lift, ships: lift ? lift.ships.length : 0,
    };
    await update(ref(rtdb), {
      [`${this.w}attacks/${targetUid}/${id}`]: attack,
      [`${this.w}attacksSent/${this.uid}/${id}`]: { id, to: targetUid, toVillage: target.villageName, arrivesAt, warriors: warriors.length },
    });
    for (const v of warriors) { v.away = { attackId: id, until: arrivesAt + (arrivesAt - now) + 30 * 60_000 }; v._task = null; }
    if (lift) for (const b of lift.ships) b.awayUntil = arrivesAt + (arrivesAt - now);   // the fleet sails with them and comes home after
    s.lastRaidAt = now;
    g.addKarma(-8);
    g.log(lift
      ? `${lift.ships.length} ship${lift.ships.length === 1 ? '' : 's'} carry ${warriors.length} warriors${bombs ? ` and ${bombs} bombs` : ''} to invade ${target.villageName} by sea. They land in ${fmtMinutes(arrivesAt - now)}.`
      : `${warriors.length} warriors${bombs ? ` carrying ${bombs} bombs` : ''} march on ${target.villageName}. They arrive in ${fmtMinutes(arrivesAt - now)}.`, 'event');
    g.emit('change');
    return { arrivesAt, target };
  }

  trackOutgoing(sent) {
    for (const [id, info] of Object.entries(sent)) {
      if (this.watching.has(id)) continue;
      const unsub = onValue(ref(rtdb, `${this.w}attacks/${info.to}/${id}`), snap => {
        const a = snap.val();
        this.outgoing[id] = a || { ...info, id, vanished: true };
        if (a && (a.status === 'resolved' || a.status === 'bribed') && !a.attackerSettled) this.settleOutgoing(a);
        if (!a) this.settleVanished(id, info);
        this.emit('armies', this.armies());
      }, () => { this.settleVanished(id, info); });
      this.watching.set(id, unsub);
    }
    for (const id of [...this.watching.keys()]) {
      if (!sent[id]) { this.watching.get(id)(); this.watching.delete(id); delete this.outgoing[id]; }
    }
    this.emit('armies', this.armies());
  }

  /** Runs every second: scout warnings, claiming battles, settling results. */
  warTick() {
    if (!on('invasions')) return;   // no armies marching on anyone for now
    const g = this.g;
    const now = Date.now();
    this.resolveMissions();
    this.refreshInbox();
    this.arrivals();
    const threats = [];

    for (const a of Object.values(this.incoming)) {
      if (a.status === 'marching') {
        const remaining = (a.arrivesAt - now) / 1000;
        if (!this.warned.has(a.id) && trySpot(g, remaining, (this.sweeps[a.id] ||= {}), now / 1000)) {
          this.warned.add(a.id);
          {
            g.emit('scoutReport', { id: a.id, kind: 'player', name: a.bySea ? `${a.fromVillage}'s fleet` : `${a.fromVillage}'s army`, count: a.warriors, seconds: Math.max(0, (a.arrivesAt - now) / 1000), ref: a });
            g.log(a.bySea
              ? (remaining <= DUST_SECONDS ? `Sails on the horizon! ${a.fromVillage}'s fleet is landing on our shore!` : `Lookouts report: ${a.ships || 'enemy'} ship${a.ships === 1 ? '' : 's'} from ${a.fromVillage} carry ${a.warriors} warriors toward our coast!`)
              : remaining <= DUST_SECONDS
                ? `Dust on the horizon — ${a.fromVillage}'s army is at the gates! Nobody saw them coming.`
                : `Scouts report: ${a.fromVillage} (${a.fromName}) marches on us with ${a.warriors} warriors!`, 'bad');
            if (g.autoRally && !g.state.rallied) rally(g);
          }
        }
        if (this.warned.has(a.id)) threats.push(a);
        if (now >= a.arrivesAt) this.claimLiveBattle(a);
      } else if (a.status === 'resolved' && !a.defenderSettled) {
        this.applyIncomingResult(a);
      } else if (a.status === 'bribed' && a.attackerSettled) {
        remove(ref(rtdb, `${this.w}attacks/${this.uid}/${a.id}`)).catch(() => {});
      }
    }
    g.mpThreats = threats;

    // keep live battles we are fighting marked as alive, so the attacker never decides them by strength
    for (const a of Object.values(this.incoming)) {
      if (a.status === 'battle' && a.resolver === this.uid && this.g.state.battles?.[a.id] && now - (a.battleAt || 0) > 10_000) {
        a.battleAt = now;
        update(ref(rtdb, `${this.w}attacks/${this.uid}/${a.id}`), { battleAt: now }).catch(() => {});
      }
    }

    for (const a of this.armies()) {
      if (a.vanished) continue;
      if ((a.status === 'marching' && now >= a.arrivesAt + DEFENDER_GRACE()) || isStale(a)) this.resolveByStats(a);
    }
  }

  // ---- defender side
  async claimLiveBattle(a) {
    if (this.busy.has(a.id)) return;
    this.busy.add(a.id);
    try {
      const tx = await runTransaction(ref(rtdb, `${this.w}attacks/${this.uid}/${a.id}`), cur => {
        if (!cur || cur.status !== 'marching') return undefined;
        return { ...cur, status: 'battle', resolver: this.uid, battleAt: Date.now() };
      });
      if (!tx.committed) return;
      const count = clamp(a.warriors, 1, 12);
      const scale = clamp(a.power / Math.max(1, a.warriors) / 8, 0.6, 2);
      spawnArmy(this.g, { id: a.id, kind: 'player', name: `${a.fromVillage}'s army`, count, scale });
    } catch (e) {
      console.warn('claim battle failed', e);
    } finally {
      this.busy.delete(a.id);
    }
  }

  async finishLiveBattle(r) {
    const g = this.g;
    const attackerWon = !r.defenderWon;
    const path = ref(rtdb, `${this.w}attacks/${this.uid}/${r.id}`);
    try {
      const tx = await runTransaction(path, cur => {
        if (!cur || cur.status !== 'battle' || cur.resolver !== this.uid) return undefined;
        return { ...cur, status: 'resolved', defenderSettled: true, result: { attackerWon, loot: r.loot, attackerLosses: r.killed, by: 'battle' } };
      });
      if (!tx.committed) return;
      const a = tx.snapshot.val();
      this.markSettled(r.id);
      if (attackerWon) {
        if (a.bombs >= 4) destroyBuildings(g, Math.floor(a.bombs / 4), `${a.fromVillage}'s bombs destroyed the`);
        g.state.shieldUntil = Date.now() + RAID_SHIELD_MS;
        g.log(`${a.fromVillage} plundered us (${fmtRes(r.loot) || 'nothing'}). A 12h shield is raised.`, 'bad');
      } else {
        const inf = g.addResource('influence', 10 + r.killed * 2);
        g.log(`We crushed ${a.fromVillage}'s army! ${r.killed} invaders fell. +${inf} influence`, 'good');
        g.announce(`🛡 ${a.fromVillage}'s army is defeated!`);
      }
      if (a.attackerSettled) await remove(path);
      writeProfile(this.user, g).catch(() => {});
      g.emit('change');
    } catch (e) {
      console.warn('finish battle failed', e);
    }
  }

  applyIncomingResult(a) {
    const g = this.g;
    const s = g.state;
    const path = ref(rtdb, `${this.w}attacks/${this.uid}/${a.id}`);
    if (!this.isSettled(a.id)) {
      this.markSettled(a.id);
      // a live battle we abandoned was decided by stats instead: clear the leftover invaders
      s.creatures = s.creatures.filter(c => c.attackId !== a.id);
      if (s.battles) delete s.battles[a.id];
      const res = a.result || {};
      if (res.attackerWon) {
        const lost = {};
        for (const [k, v] of Object.entries(res.loot || {})) {
          const n = Math.min(v, Math.floor(s.resources[k] || 0));
          s.resources[k] -= n;
          lost[k] = n;
        }
        if (a.bombs >= 4) destroyBuildings(g, Math.floor(a.bombs / 4), `${a.fromVillage}'s bombs destroyed the`);
        s.shieldUntil = Date.now() + RAID_SHIELD_MS;
        g.log(`While you were away, ${a.fromVillage} attacked and took ${fmtRes(lost) || 'nothing'}. Shield raised for 12h.`, 'bad');
        g.announce(`⚔ ${a.fromVillage} raided your village!`);
      } else {
        g.addResource('influence', 10);
        g.log(`Your defenders repelled ${a.fromVillage}'s army! +10 influence`, 'good');
      }
      writeProfile(this.user, g).catch(() => {});
      g.emit('change');
    }
    if (a.attackerSettled) remove(path).catch(() => {});
    else update(path, { defenderSettled: true }).catch(() => {});
  }

  /** Pay the approaching army to turn around. */
  async payTribute(a) {
    const g = this.g;
    const cost = tributeCost(g);
    const path = ref(rtdb, `${this.w}attacks/${this.uid}/${a.id}`);
    const tx = await runTransaction(path, cur => {
      if (!cur || cur.status !== 'marching') return undefined;
      return { ...cur, status: 'bribed', tribute: cost, defenderSettled: true };
    });
    if (!tx.committed) throw new Error('Too late — they are already here!');
    g.spend(cost);
    this.markSettled(a.id);
    g.log(`Paid ${fmtRes(cost) || 'a token'} in tribute. ${a.fromVillage}'s army turns back.`, 'event');
    g.emit('change');
  }

  // ---- attacker side
  async resolveByStats(a) {
    if (this.busy.has(a.id)) return;
    this.busy.add(a.id);
    const path = ref(rtdb, `${this.w}attacks/${a.to}/${a.id}`);
    try {
      const tx = await runTransaction(path, cur => {
        if (!cur) return undefined;
        if (cur.status !== 'marching' && !isStale(cur)) return undefined;
        return { ...cur, status: 'resolving', resolver: this.uid, battleAt: Date.now() };
      });
      if (!tx.committed) return;
      const target = await getProfile(a.to);
      const defend = (target?.warriorPower || 0) + (target?.defense || 0) + (target?.pop || 0) * 0.5 + 4;
      const attackerWon = a.power * (0.75 + Math.random() * 0.5) > defend * (0.75 + Math.random() * 0.5);
      const loot = {};
      if (attackerWon) {
        for (const k of ['food', 'wood', 'stone', 'gold']) {
          const n = Math.floor((target?.res?.[k] || 0) * 0.2);
          if (n > 0) loot[k] = n;
        }
      }
      const attackerLosses = attackerWon
        ? Math.floor(a.warriors * Math.random() * 0.3)
        : Math.ceil(a.warriors * (0.3 + Math.random() * 0.4));
      await update(path, { status: 'resolved', result: { attackerWon, loot, attackerLosses, by: 'stats' } });
    } catch (e) {
      console.warn('resolve by stats failed', e);
    } finally {
      this.busy.delete(a.id);
    }
  }

  settleOutgoing(a) {
    const g = this.g;
    const s = g.state;
    const path = ref(rtdb, `${this.w}attacks/${a.to}/${a.id}`);
    if (!this.isSettled(a.id)) {
      this.markSettled(a.id);
      const warriors = s.villagers.filter(v => v.away?.attackId === a.id);
      const back = travelMs(this.uid, a.to, 'army');
      const homeAt = Date.now() + back;
      let cargo = {};
      if (a.status === 'bribed') {
        cargo = a.tribute || {};
        g.log(`${a.toVillage} paid tribute (${fmtRes(cargo) || 'a pittance'}). The army marches home — ${fmtMinutes(back)}.`, 'good');
      } else {
        const res = a.result || {};
        const losses = Math.min(warriors.length, res.attackerLosses || 0);
        const fallen = [...warriors].sort(() => Math.random() - 0.5).slice(0, losses);
        for (const v of fallen) g.killVillager(v, `fell in battle at ${a.toVillage}`);
        if (res.attackerWon) {
          cargo = res.loot || {};
          s.stats.raidsWon = (s.stats.raidsWon || 0) + 1;
          g.log(`Victory at ${a.toVillage}! ${losses} warriors lost. They carry home ${fmtRes(cargo) || 'nothing'} — ${fmtMinutes(back)}.`, 'good');
          g.announce(`⚔ Victory over ${a.toVillage}!`);
        } else {
          s.stats.raidsLost = (s.stats.raidsLost || 0) + 1;
          g.log(`Defeat at ${a.toVillage}. ${losses} warriors never came home.`, 'bad');
          g.announce(`Your army was beaten at ${a.toVillage}`);
        }
        for (const v of warriors) if (!fallen.includes(v)) v.skills.combat = Math.min(10, v.skills.combat + 0.5);
      }
      for (const v of s.villagers) if (v.away?.attackId === a.id) v.away = { attackId: a.id, until: homeAt, returning: true };
      (s.caravans ||= []).push({ id: a.id, at: homeAt, res: cargo, text: `Your army is home from ${a.toVillage}` });
      g.emit('change');
    }
    const done = a.defenderSettled ? remove(path) : update(path, { attackerSettled: true });
    done.catch(() => {}).finally(() => remove(ref(rtdb, `${this.w}attacksSent/${this.uid}/${a.id}`)).catch(() => {}));
  }

  settleVanished(id) {
    const g = this.g;
    const home = g.state.villagers.filter(v => v.away?.attackId === id);
    if (home.length) {
      for (const v of home) returnHome(g, v);
      g.log('Your army returns home.', 'info');
      g.emit('change');
    }
    remove(ref(rtdb, `${this.w}attacksSent/${this.uid}/${id}`)).catch(() => {});
  }

  /** Armies and loot coming home. */
  arrivals() {
    const g = this.g;
    const list = g.state.caravans;
    if (!list?.length) return;
    const now = Date.now();
    for (const c of list.filter(x => x.at <= now)) {
      const got = Object.entries(c.res || {}).map(([k, v]) => `${g.addResource(k, v)} ${k}`).filter(x => !x.startsWith('0 ')).join(', ');
      for (const v of g.state.villagers) if (v.away?.attackId === c.id || v.away?.missionId === c.id) returnHome(g, v);
      g.log(`${c.text}${got ? ` with ${got}` : ''}.`, 'event');
      g.emit('change');
    }
    g.state.caravans = list.filter(x => x.at > now);
  }

  // ================================================================ spies & missiles
  /** Missions on the road (outbound), for the world panel and realm map. */
  missions() {
    return Object.values(this.sentMissions || {});
  }

  availableSpies() {
    return this.g.state.villagers.filter(v => isSpy(v) && !v.away && v.hp > 30);
  }

  /** opts.admin: free, no silo needed, pierces shields, arrives in ~20s (admin missile command) */
  async launchMission(targetUid, mission, aim = null, opts = {}) {
    const g = this.g;
    const s = g.state;
    const target = await getProfile(targetUid);
    if (!target) throw new Error('Village not found');
    const isMissile = mission === 'missile' || mission === 'orbital' || mission === 'nuke';
    let agent = null;
    if (isMissile && opts.admin) {
      aim = aim && { ...aim, radius: opts.radius || null, nuke: mission === 'nuke', pierce: true };
    } else if (isMissile) {
      if (mission === 'orbital' ? !hasOrbital(g) : !hasMissiles(g)) throw new Error(`You need a ${mission === 'orbital' ? 'Orbital Cannon' : 'Missile Silo'}`);
      if (!g.spend(MISSILE_COST)) throw new Error(`Needs ${Object.entries(MISSILE_COST).map(([k, n]) => `${n} ${k}`).join(', ')}`);
      g.addKarma(mission === 'orbital' ? -35 : -25);
    } else {
      agent = this.availableSpies().sort((a, b) => b.skills.stealth - a.skills.stealth)[0];
      if (!agent) throw new Error('No trained spy at home — build a Spy Den and train one');
      if (mission === 'sabotage' && !g.spend({ bombs: 1 })) throw new Error('Sabotage needs 1 bomb');
    }
    const now = Date.now();
    const travel = opts.admin ? 20_000 : travelMs(this.uid, targetUid, 'caravan') * (isMissile ? 0.2 : 1);
    const arrivesAt = now + travel;
    const id = push(ref(rtdb, `${this.w}missions/${targetUid}`)).key;
    const record = {
      id, kind: isMissile ? 'missile' : 'spy', mission, from: this.uid, fromName: this.name, fromVillage: s.owner.villageName,
      to: targetUid, toVillage: target.villageName, stealth: agent ? Math.round(agent.skills.stealth * 10) / 10 : 0,
      agent: agent?.name || null, launchedAt: now, arrivesAt, status: 'travelling',
      ...(isMissile && aim ? { aim: { tx: Math.round(aim.tx), ty: Math.round(aim.ty), ...(aim.radius ? { radius: aim.radius } : {}), ...(aim.nuke ? { nuke: true } : {}), ...(aim.pierce ? { pierce: true } : {}) } } : {}),
    };
    await update(ref(rtdb), {
      [`${this.w}missions/${targetUid}/${id}`]: record,
      [`${this.w}missionsSent/${this.uid}/${id}`]: { id, to: targetUid, toVillage: target.villageName, mission, kind: record.kind, agent: record.agent, launchedAt: now, arrivesAt },
    });
    if (agent) { agent.away = { missionId: id, until: arrivesAt + travel + 30 * 60_000 }; agent._task = null; }
    g.log(isMissile
      ? `☢ ${mission === 'nuke' ? 'Nuke' : mission === 'orbital' ? 'Orbital strike' : 'Missile'} launched at ${target.villageName}! Impact in ${fmtMinutes(travel)}.`
      : `🕵 ${agent.name} slips away toward ${target.villageName} to ${mission}. Arrives in ${fmtMinutes(travel)}.`, 'event');
    g.emit('change');
    return { arrivesAt, target };
  }

  /** Attacker side: decide missions that have arrived. */
  async resolveMissions() {
    const now = Date.now();
    for (const m of Object.values(this.sentMissions || {})) {
      if (m.arrivesAt > now || this.busy.has(m.id)) continue;
      // a spy sent in person waits for you to take control (and acts by stats if you never do)
      if (m.mission === 'infiltrate' && (now < m.arrivesAt + INFILTRATE_WINDOW_MS || this.infiltrating === m.id)) continue;
      this.busy.add(m.id);
      try {
        await this.decideMission(m);
      } catch (e) {
        console.warn('mission resolve failed', e);
      } finally {
        this.busy.delete(m.id);
      }
    }
  }

  /**
   * Settle a mission on its record. `inPerson` = { action, target, guards } when you did it yourself as the spy:
   * better odds for the hand on the spot, worse when guards are watching, and the exact building or person hit.
   */
  async decideMission(m, inPerson = null) {
    const path = ref(rtdb, `${this.w}missions/${m.to}/${m.id}`);
    const target = await getProfile(m.to);
    const tx = await runTransaction(path, cur => {
      // with nothing cached locally the first call sees null: return null so the server value is retried
      if (cur === null) return null;
      if (cur.status !== 'travelling') return undefined;
      const mission = inPerson?.action || (cur.mission === 'infiltrate' ? 'scout' : cur.mission);
      const result = { success: false, caught: false };
      if (cur.kind === 'missile') {
        result.success = !!cur.aim?.pierce || !target?.missileShield;
      } else {
        const guards = inPerson?.guards || 0;
        const chance = clamp(0.4 + cur.stealth * 0.06 + Math.min(0.2, (target?.leaks || 0) * 0.05) - (target?.counterIntel || 0.1) + (inPerson ? 0.15 - guards * 0.1 : 0), 0.05, 0.95);
        result.success = Math.random() < chance;
        result.caught = !result.success && Math.random() < Math.min(0.95, 0.6 + guards * 0.1);
        if (result.success && mission === 'steal') result.gold = Math.floor((target?.res?.gold || 0) * 0.25);
        if (result.success && mission === 'scout' && target) {
          result.report = { pop: target.pop, warriors: target.warriors, power: target.warriorPower, defense: target.defense, gold: target.res?.gold, food: target.res?.food, era: target.era, officials: target.officials };
        }
        if (inPerson?.target) result.target = inPerson.target;
        if (inPerson) result.inPerson = true;
      }
      return { ...cur, mission, status: 'resolved', result };
    });
    const done = tx.committed && tx.snapshot.val();
    if (done?.status === 'resolved') this.applyOwnMission(done);
    await remove(ref(rtdb, `${this.w}missionsSent/${this.uid}/${m.id}`));
    return done;
  }

  /** You are the spy on the spot: do one thing, and the mission ends with it. */
  async actInPerson(m, action, target = null, guards = 0) {
    if (this.busy.has(m.id)) throw new Error('Already acting');
    if (action === 'sabotage' && !this.g.spend({ bombs: 1 })) throw new Error('Sabotage needs 1 bomb');
    this.busy.add(m.id);
    try {
      return await this.decideMission(m, { action, target, guards });
    } finally {
      this.busy.delete(m.id);
      if (this.infiltrating === m.id) this.infiltrating = null;
    }
  }

  // ---------------- strangers: people from other lands walking in yours ----------------
  /** Where you are in someone else's land, so they see you walking about (a spy shows as a nameless traveller). */
  publishStranger(hostUid, id, v, { disguised = false } = {}) {
    const now = Date.now();
    if (now - (this._strangerAt || 0) < 300) return;
    this._strangerAt = now;
    const path = ref(rtdb, `${this.w}strangers/${hostUid}/${id}`);
    if (this._strangerPath !== path.toString()) { this._strangerPath = path.toString(); onDisconnect(path).remove(); }
    set(path, {
      from: this.uid, x: Math.round(v.x), y: Math.round(v.y), sex: v.sex === 'f' ? 'f' : 'm',
      name: disguised ? 'Traveller' : String(v.name || 'Visitor').slice(0, 40), job: disguised ? 'gather' : String(v.job || 'idle').slice(0, 20),
      walking: !!v._walking, flip: !!v._flip, ts: now, title: disguised ? '' : String(this.titleText || '').slice(0, 30), a: disguised ? null : avatarId(this.g),
    }).catch(() => {});
  }

  // ---------------- shared monsters ----------------

  /** Watches who runs the monsters, takes the job when it is free, and sends or shows them. */
  startMobs() {
    const claim = ref(rtdb, `${this.w}mobHost`);
    this.unsubs.push(onValue(claim, snap => {
      const v = snap.val();
      const live = v && Date.now() - (v.ts || 0) < MOB_LEASE_MS ? v.uid : null;
      this.mobHostUid = live;
      const wasGuest = this.g.mobGuest;
      this.g.mobHost = live === this.uid;
      this.g.mobGuest = !!live && !this.g.mobHost;
      if (this.g.mobGuest && !wasGuest) {   // our own monsters were never real: the host's are
        this.g.state.creatures = this.g.state.creatures.filter(c => !CREATURES[c.t]?.hostile || c.net);
      }
    }, () => {}));
    this.mobLease = setInterval(() => {
      runTransaction(claim, cur => ((!cur || Date.now() - (cur.ts || 0) > MOB_LEASE_MS || cur.uid === this.uid) ? { uid: this.uid, ts: Date.now() } : undefined)).catch(() => {});
      if (this.g.mobHost) this.mobsAttackPlayers();
    }, 4000);
    this.mobTimer = setInterval(() => {
      if (!this.g.mobHost) return;
      set(ref(rtdb, `${this.w}mobs`), mobsToSend(this.g, this.g.livePlayers || [])).catch(() => {});
    }, 250);
    this.unsubs.push(onValue(ref(rtdb, `${this.w}mobs`), snap => {
      if (this.g.mobGuest) applyNetMobs(this.g, snap.val() || {});
    }, () => {}));
    // the host takes the blows everyone else lands
    this.unsubs.push(onChildAdded(ref(rtdb, `${this.w}mobHits/${this.uid}`), snap => {
      const hit = snap.val();
      remove(snap.ref).catch(() => {});
      if (!hit || !this.g.mobHost) return;
      const c = this.g.state.creatures.find(x => x.id === hit.id);
      if (!c) return;
      damageCreature(this.g, c, Math.max(0, Math.min(9999, hit.dmg || 0)), null);
      if (!this.g.state.creatures.includes(c)) push(ref(rtdb, `${this.w}mobKills`), { id: hit.id, by: hit.from, t: c.t, x: Math.round(c.x), y: Math.round(c.y), ts: Date.now() }).catch(() => {});
    }, () => {}));
    // whoever struck the last blow gets the experience and the loot, on their own machine
    this.unsubs.push(onChildAdded(query(ref(rtdb, `${this.w}mobKills`), orderByChild('ts'), limitToLast(15)), snap => {
      const k = snap.val();
      if (this.g.mobHost) remove(snap.ref).catch(() => {});
      if (!k || Date.now() - (k.ts || 0) > 20_000) return;
      this.g.state.creatures = this.g.state.creatures.filter(c => c.netId !== k.id);
      if (k.by !== this.uid) return;
      const v = this.g.state.villagers?.find(x => x.id === this.g.hero?.id);
      if (v) { this.g.hero.kills = (this.g.hero.kills || 0) + 1; onHeroKill(this.g, { t: k.t, x: k.x, y: k.y }, v); }
    }, () => {}));
  }

  /** A guest's blow, sent to whoever runs the monsters. */
  sendMobHit(id, dmg) {
    if (!id || !this.mobHostUid || this.mobHostUid === this.uid) return;
    push(ref(rtdb, `${this.w}mobHits/${this.mobHostUid}`), { id, dmg: Math.round(dmg), from: this.uid, ts: Date.now() }).catch(() => {});
  }

  /** The host also lets monsters hurt the other players standing next to them. */
  mobsAttackPlayers() {
    const now = Date.now();
    for (const p of this.g.livePlayers || []) {
      for (const c of this.g.state.creatures) {
        const def = CREATURES[c.t];
        if (!def?.hostile || !def.damage) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) > TILE * 1.3) continue;
        if (now - (c._netSwing || 0) < 1500) continue;
        c._netSwing = now;
        this.sendHit(p.uid, def.damage, c.x, c.y, def.name || c.t.replace(/_/g, ' '));
        break;
      }
    }
  }

  /** Tells everyone else about a change to the island. Old records are tidied away by the world's owner. */
  sendEdit(e) {
    if (!e || this.world === 'realm') return;
    push(ref(rtdb, `${this.w}edits`), { ...e, uid: this.uid, ts: Date.now() }).catch(() => {});
    this._edited = (this._edited || 0) + 1;
    if (this._edited % 200 === 0) this.pruneEdits();
  }

  /** Keeps the log from growing for ever: the oldest records go once there are a lot of them. */
  async pruneEdits() {
    try {
      const snap = await get(query(ref(rtdb, `${this.w}edits`), orderByChild('ts'), limitToLast(1200)));
      const all = snap.val() || {};
      const keys = Object.keys(all);
      if (keys.length < 1100) return;
      const oldest = keys.sort((a, b) => (all[a].ts || 0) - (all[b].ts || 0)).slice(0, keys.length - 800);
      const gone = {};
      for (const k of oldest) gone[k] = null;
      await update(ref(rtdb, `${this.w}edits`), gone);
    } catch {}
  }

  /**
   * Where you are right now, for everyone else in this world (about five times a second, and only
   * when you moved). Everyone shares the island, so this is enough to see each other walking around.
   */
  publishLive(v, { facing = 0, level = 1, dungeon = false } = {}) {
    if (!v) return;
    const now = Date.now();
    if (now - (this._liveAt || 0) < 200) return;
    const moved = Math.abs(v.x - (this._liveX ?? -9999)) > 1 || Math.abs(v.y - (this._liveY ?? -9999)) > 1;
    if (!moved && now - (this._liveAt || 0) < 3000) return;   // standing still: a keep-alive now and then
    this._liveAt = now; this._liveX = v.x; this._liveY = v.y;
    set(ref(rtdb, `${this.w}live/${this.uid}`), {
      x: Math.round(v.x), y: Math.round(v.y), name: String(v.name || this.name || 'Player').slice(0, 40),
      sex: v.sex === 'f' ? 'f' : 'm', walking: !!v._walking, flip: !!v._flip, dungeon: !!dungeon, a: avatarId(this.g),
      level: Math.round(level) || 1, facing, title: String(this.titleText || '').slice(0, 30), ts: now,
    }).catch(() => {});
  }

  /** The other players in this world (never you), gliding from where they were to where they are. */
  livePlayerList(all, prev) {
    const now = Date.now();
    return Object.entries(all).filter(([uid, s]) => uid !== this.uid && now - (s.ts || 0) < 15_000 && !s.dungeon).map(([uid, s]) => {
      const old = prev.get(uid);
      return { id: uid, uid, player: true, avatar: s.a || null, title: s.title || '', name: s.name, sex: s.sex, job: 'idle', level: s.level || 1, tx: s.x, ty: s.y, x: old ? old.x : s.x, y: old ? old.y : s.y, _walking: !!s.walking, _flip: !!s.flip, ts: s.ts };
    });
  }

  stopMobs() { clearInterval(this.mobLease); clearInterval(this.mobTimer); }

  clearLive() { remove(ref(rtdb, `${this.w}live/${this.uid}`)).catch(() => {}); }

  /** Everyone walking an island (not you), gliding from where they were to where they are. */
  strangerList(all, prev) {
    const now = Date.now();
    return Object.entries(all).filter(([, s]) => now - (s.ts || 0) < 20_000 && s.from !== this.uid).map(([id, s]) => {
      const old = prev.get(id);
      return { id, from: s.from, avatar: s.a || null, title: s.title || '', name: s.name, sex: s.sex, job: s.job, tx: s.x, ty: s.y, x: old ? old.x : s.x, y: old ? old.y : s.y, _walking: !!s.walking, _flip: !!s.flip, ts: s.ts };
    });
  }

  /** While you walk someone else's island: see the owner and the other visitors there, live. */
  watchIsland(hostUid, land) {
    this.unwatchIsland();
    this._islandOff = onValue(ref(rtdb, `${this.w}strangers/${hostUid}`), snap => {
      const prev = new Map((land.strangers || []).map(s => [s.id, s]));
      land.strangers = this.strangerList(snap.val() || {}, prev);
    }, () => {});
  }

  unwatchIsland() { this._islandOff?.(); this._islandOff = null; }

  /** Hit another player: they take it on their side (their dodge, guard and armour still count). */
  sendHit(uid, dmg, x, y, name) {
    if (!uid || uid === this.uid) return;
    push(ref(rtdb, `${this.w}pvpHits/${uid}`), { from: this.uid, name: String(name || 'Someone').slice(0, 40), dmg: Math.max(0, Math.min(200, Math.round(dmg))), x: Math.round(x), y: Math.round(y), ts: Date.now() }).catch(() => {});
  }

  clearStranger(hostUid, id) {
    this._strangerPath = null;
    remove(ref(rtdb, `${this.w}strangers/${hostUid}/${id}`)).catch(() => {});
  }

  applyOwnMission(m) {
    const g = this.g;
    const s = g.state;
    const r = m.result || {};
    const agent = s.villagers.find(v => v.away?.missionId === m.id);
    if (m.kind === 'missile') {
      g.log(r.success ? `☢ The strike on ${m.toVillage} hit its target.` : `Your missile was destroyed by ${m.toVillage}'s shield.`, r.success ? 'event' : 'bad');
      return;
    }
    if (r.caught) {
      if (agent) g.killVillager(agent, `was caught spying in ${m.toVillage} and executed`);
      return;
    }
    if (r.success) {
      if (m.mission === 'steal') g.addResource('gold', r.gold || 0);
      if (m.mission === 'scout' && r.report) {
        const x = r.report;
        g.log(`🕵 Report on ${m.toVillage}: ${x.pop} people, ${x.warriors} warriors (power ${x.power}), defense ${x.defense}, ${x.gold} gold, ${x.food} food, ${x.officials} officials.`, 'event');
      } else {
        g.log(`🕵 Mission to ${m.toVillage} succeeded (${m.mission}${m.mission === 'steal' ? `: +${r.gold || 0} gold` : ''}).`, 'good');
      }
    } else {
      g.log(`🕵 ${m.agent} failed the mission in ${m.toVillage} but escaped.`, 'bad');
    }
    if (agent) {
      const back = travelMs(this.uid, m.to, 'caravan');
      agent.away = { missionId: m.id, until: Date.now() + back, returning: true };
      (s.caravans ||= []).push({ id: m.id, at: Date.now() + back, res: {}, text: `${agent.name} returns from ${m.toVillage}` });
    }
    g.emit('change');
  }

  /** Defender side: feel the effects of missions against us. */
  applyMissions() {
    const g = this.g;
    const s = g.state;
    for (const m of Object.values(this.incomingMissions || {})) {
      if (m.status !== 'resolved' || this.isSettled(m.id)) continue;
      this.markSettled(m.id);
      const r = m.result || {};
      const traced = s.court?.spymaster?.id || Math.random() < 0.3;
      const who = traced ? m.fromVillage : 'an unknown enemy';
      if (m.kind === 'missile') {
        if (r.success) sufferStrike(g, m.fromVillage, m.mission === 'orbital', m.aim);
        else g.log(`A missile from ${m.fromVillage} was stopped by our shield.`, 'good');
      } else if (r.caught) {
        g.addResource('influence', 15);
        g.log(`🕵 We caught a spy from ${m.fromVillage} (${m.mission})! +15 influence`, 'good');
      } else if (r.success) {
        switch (m.mission) {
          case 'sabotage': {
            // a spy on the spot picked the building; otherwise it is whichever they could reach
            const b = r.target && s.buildings.find(x => x.built && x.type === r.target.type && x.tx === r.target.tx && x.ty === r.target.ty);
            if (b) damageBuilding(g, b, `Saboteurs sent by ${who} struck the`);
            else destroyBuildings(g, 1, `Saboteurs sent by ${who} struck the`);
            break;
          }
          case 'steal': {
            const n = Math.min(r.gold || 0, Math.floor(s.resources.gold));
            s.resources.gold -= n;
            if (n) g.log(`${n} gold was stolen from the treasury by agents of ${who}.`, 'bad');
            break;
          }
          case 'incite': {
            const v = personNear(s, r.target, x => x.age >= 12 && !x.ruling && !x.robot && !x.traitor) || s.villagers.filter(x => x.age >= 12 && !x.ruling && !x.robot && !x.traitor).sort((a, b) => a.happy - b.happy)[0];
            if (v) v.traitor = true;   // silently
            if (traced) g.log(`Our Spymaster suspects agents of ${m.fromVillage} are turning our people…`, 'bad');
            break;
          }
          case 'assassinate': {
            const court = Object.values(s.court || {}).map(c => s.villagers.find(v => v.id === c?.id)).filter(Boolean);
            const heir = s.villagers.find(v => v.id === s.ruler?.heirId);
            const victim = personNear(s, r.target, x => !x.ruling) || heir || court[0];
            if (victim) g.killVillager(victim, `was assassinated by agents of ${who}`);
            break;
          }
          case 'scout':
            if (traced) g.log(`Spies from ${m.fromVillage} were seen counting our soldiers.`, 'event');
            break;
        }
      }
      remove(ref(rtdb, `${this.w}missions/${this.uid}/${m.id}`)).catch(() => {});
      g.emit('change');
    }
  }

  isSettled(id) { return (this.g.state.settledOffers || []).includes(id); }
  markSettled(id) {
    const done = (this.g.state.settledOffers ||= []);
    if (!done.includes(id)) done.push(id);
    if (done.length > 150) done.shift();
  }

  // ---------------- admin commands ----------------
  applyAdminCommand(cmd) {
    const g = this.g;
    if (!cmd) return;
    switch (cmd.type) {
      case 'give':
        for (const [k, v] of Object.entries(cmd.res || {})) g.state.resources[k] = Math.max(0, (g.state.resources[k] || 0) + (Number(v) || 0));   // admin gifts ignore storage limits
        g.log(`The Admin gifted you ${fmtRes(cmd.res)}.`, 'good');
        break;
      case 'shield':
        g.state.shieldUntil = Date.now() + (Number(cmd.hours) || 24) * 3600000;
        g.log(`The Admin granted you a ${cmd.hours}h shield.`, 'good');
        break;
      case 'karma':
        g.state.karma = Number(cmd.value) || 0;   // no limit when the Admin sets it
        g.log(`The Admin set your karma to ${g.state.karma}.`, 'event');
        break;
      case 'event': {
        const ev = EVENTS.find(e => e.id === cmd.id);
        if (ev) g.startEvent(ev);
        break;
      }
      case 'spawn':
        g.spawnRaiders(cmd.creature, Number(cmd.count) || 1);
        break;
      case 'message':
        g.announce(`📜 Admin: ${cmd.text}`);
        g.log(`Admin: ${cmd.text}`, 'event');
        break;
      case 'reset':
        this.emit('reset');
        break;
    }
    g.emit('change');
  }
}

/** A battle or stats resolution whose owner vanished mid-way. */
function isStale(a) {
  const age = Date.now() - (a.battleAt || 0);
  return (a.status === 'battle' && age > STALE_BATTLE()) || (a.status === 'resolving' && age > 2 * 60_000);
}

function cleanRes(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const n = Math.floor(Number(v));
    if (n > 0) out[k] = n;
  }
  return out;
}

export function fmtRes(obj) {
  return Object.entries(obj || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
}
