import { realmPos } from '../net/multiplayer.js';

/*
 * Bridges on your coast point towards your nearest neighbours on the World Map.
 * Stepping onto one (clicking it) offers to cross into that ruler's land.
 */

const MAX_BRIDGES = 4;
const LENGTH = 7;            // tiles of bridge out over the water
const MIN_ANGLE = 0.45;      // radians between two bridges, so they never overlap

export function computeBridges(world, myUid, players) {
  const me = realmPos(myUid);
  const others = players
    .filter(p => p.uid !== myUid)
    .map(p => { const q = realmPos(p.uid); return { p, angle: Math.atan2(q.y - me.y, q.x - me.x), d: Math.hypot(q.x - me.x, q.y - me.y) }; })
    .sort((a, b) => a.d - b.d);

  const bridges = [];
  for (const o of others) {
    if (bridges.length >= MAX_BRIDGES) break;
    if (bridges.some(b => Math.abs(angleDiff(b.angle, o.angle)) < MIN_ANGLE)) continue;
    const coast = coastAlong(world, o.angle);
    if (!coast) continue;
    const dx = Math.cos(o.angle), dy = Math.sin(o.angle);
    const tiles = [];
    for (let i = 0; i < LENGTH; i++) {
      const tx = Math.round(coast.x + dx * i), ty = Math.round(coast.y + dy * i);
      if (!world.inBounds(tx, ty)) break;
      if (!tiles.some(t => t.tx === tx && t.ty === ty)) tiles.push({ tx, ty });
    }
    if (tiles.length < 3) continue;
    bridges.push({
      uid: o.p.uid, name: o.p.name, villageName: o.p.villageName, online: !!o.p.online,
      angle: o.angle, x0: coast.x, y0: coast.y, x1: coast.x + dx * (tiles.length - 0.2), y1: coast.y + dy * (tiles.length - 0.2), tiles,
    });
  }
  return bridges;
}

/** Walk from the island's middle towards `angle`; the first water tile with open water beyond it is the coast. */
function coastAlong(world, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const cx = world.w / 2, cy = world.h / 2;
  let seenLand = false;
  for (let r = 0; r < Math.max(world.w, world.h); r += 0.5) {
    const x = cx + dx * r, y = cy + dy * r;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!world.inBounds(tx, ty)) return null;
    if (!world.isWater(tx, ty)) { seenLand = true; continue; }
    if (!seenLand) continue;
    let open = true;
    for (let k = 1; k <= 3; k++) if (!world.isWater(Math.floor(x + dx * k), Math.floor(y + dy * k))) { open = false; break; }
    if (open) return { x: x - dx * 0.6, y: y - dy * 0.6 };   // start just on the sand
  }
  return null;
}

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** The bridge under a tile, if any. */
export function bridgeAt(bridges, tx, ty) {
  return bridges?.find(b => b.tiles.some(t => t.tx === tx && t.ty === ty)) || null;
}
