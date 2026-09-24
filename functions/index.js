/*
 * Push notices for Heartborn, for when the game is not running at all.
 *
 * The game itself already raises notices while it is open or sitting in the background (src/core/notify.js).
 * These functions cover the rest: a phone with Heartborn closed, or a computer that is not on the page. They watch
 * the same places the game watches — invites, trade offers, and a broadcast node an admin writes to — and send to
 * whatever devices that player has registered under pushTokens/<uid>.
 *
 * Everything is sent DATA-ONLY on purpose. A message with a `notification` block would be drawn by the browser
 * itself as well as by our service worker, and the player would see it twice. public/sw.js draws these.
 *
 * Deploy:  npx firebase-tools deploy --only functions
 * (Cloud Functions need the Blaze plan. Everything in src/core/notify.js works without any of this.)
 */
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { onValueCreated } from 'firebase-functions/v2/database';
import { logger } from 'firebase-functions';

initializeApp();

const REGION = 'asia-southeast1';   // the same region as the Realtime Database, or the trigger never fires
const INSTANCE = 'hearthborn-47548-default-rtdb';

/** Every device that player has opened the game on. */
async function tokensFor(uid) {
  const snap = await getDatabase().ref(`pushTokens/${uid}`).get();
  return Object.entries(snap.val() || {}).map(([id, v]) => ({ id, token: v?.token })).filter(t => t.token);
}

/**
 * Sends one notice to all of a player's devices and forgets the ones the browser has thrown away
 * (an uninstalled app, a cleared site, a phone that has not been opened in months).
 */
async function push(uid, { title, body, tag = 'heartborn', url = '/' }) {
  const devices = await tokensFor(uid);
  if (!devices.length) return 0;
  const res = await getMessaging().sendEachForMulticast({
    tokens: devices.map(d => d.token),
    data: { title, body, tag, url },          // data-only: our service worker draws it, exactly once
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))) dead.push(devices[i].id);
  });
  if (dead.length) await Promise.all(dead.map(id => getDatabase().ref(`pushTokens/${uid}/${id}`).remove()));
  logger.info(`push to ${uid}: ${res.successCount}/${devices.length} sent, ${dead.length} stale removed`);
  return res.successCount;
}

/** A friend asked you into their world. */
export const onWorldInvite = onValueCreated(
  { ref: '/worldInvites/{uid}/{wid}', instance: INSTANCE, region: REGION },
  async event => {
    const inv = event.data.val() || {};
    await push(event.params.uid, {
      title: `${inv.fromName || 'A friend'} invited you`,
      body: `Join ${inv.name || 'their world'} in Heartborn`,
      tag: `invite-${event.params.wid}`,
    });
  },
);

/** Somebody wants to trade with you. */
export const onTradeOffer = onValueCreated(
  { ref: '/w/{world}/offers/{to}/{id}', instance: INSTANCE, region: REGION },
  async event => {
    const o = event.data.val() || {};
    if (o.from === event.params.to) return;
    await push(event.params.to, {
      title: 'Trade offer',
      body: `${o.fromName || o.fromVillage || 'A player'} wants to trade with you`,
      tag: 'trade',
    });
  },
);

/**
 * Everybody at once: write { title, body } to pushBroadcast/<anything> as an admin and it goes out.
 * This is how "a new version is out" reaches people who are not on the page.
 */
export const onBroadcast = onValueCreated(
  { ref: '/pushBroadcast/{id}', instance: INSTANCE, region: REGION },
  async event => {
    const msg = event.data.val() || {};
    if (!msg.title) return;
    const all = await getDatabase().ref('pushTokens').get();
    const uids = Object.keys(all.val() || {});
    let sent = 0;
    for (const uid of uids) sent += await push(uid, { title: msg.title, body: msg.body || '', tag: msg.tag || 'news' });
    logger.info(`broadcast "${msg.title}" reached ${sent} devices across ${uids.length} players`);
    await event.data.ref.remove();
  },
);
