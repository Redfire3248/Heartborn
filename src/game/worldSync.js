/*
 * The shared world: on a server, what one player changes changes for everyone.
 *
 * Everyone on a server already walks the same island (the same seed), so we only need to pass the CHANGES
 * around: a tree chopped, a rock mined, a tile paved, a building put up or knocked down, a chest emptied.
 * Each change is one small record in the world's edit log; every client plays back the ones it has not seen.
 * Joining later, you read the log and catch up, so the island looks the same to everyone.
 *
 * Mobs, loot rolls and dungeons still run on each player's own machine: those are yours alone.
 */
import { TILE } from '../core/constants.js';
import { OBJECTS } from '../data/objects.js';
import { BUILDINGS } from '../data/buildings.js';

/** Turns a change into a record small enough to send. */
export const objEdit = (t, o) => ({ t, x: o.x, y: o.y, k: o.t, ...(o.grow ? { g: o.grow } : {}), ...(o.charges != null ? { c: o.charges } : {}) });

/**
 * Hooks a game up to a world's edit log: changes you make are sent, changes others make are applied.
 * Safe to call for solo worlds too (`send` is then null and nothing leaves this device).
 */
export function hookWorldSync(g, send) {
  if (g._syncHooked) { g.netSend = send; return; }
  g._syncHooked = true;
  g.netSend = send;
  const emit = e => { if (!g._applyingEdit && g.netSend) g.netSend(e); };

  const world = g.world;
  const origRemove = world.removeObject.bind(world);
  world.removeObject = (objects, o) => { if (objects === g.state.objects && o) emit(objEdit('obj-', o)); return origRemove(objects, o); };
  const origAdd = world.addObject.bind(world);
  world.addObject = (objects, o) => { if (objects === g.state.objects && o) emit(objEdit('obj+', o)); return origAdd(objects, o); };
  const origSetTile = world.setTile.bind(world);
  world.setTile = (tx, ty, t) => { if (world.tile(tx, ty) !== t) emit({ t: 'tile', x: tx, y: ty, v: t }); return origSetTile(tx, ty, t); };

  const origPlace = g.placeBuilding.bind(g);
  g.placeBuilding = (type, tx, ty) => {
    const r = origPlace(type, tx, ty);
    if (r.ok && r.building) emit({ t: 'build+', b: { id: r.building.id, type, tx, ty, by: g.state.owner?.name || 'Someone' } });
    return r;
  };
  const origDemolish = g.demolish.bind(g);
  g.demolish = b => { if (b?.id) emit({ t: 'build-', id: b.id }); return origDemolish(b); };
}

/** Plays back one change that another player made. */
export function applyEdit(g, e) {
  if (!e || !g?.world) return;
  g._applyingEdit = true;
  try {
    const w = g.world, s = g.state;
    if (e.t === 'obj-') {
      const o = w.objectAt(e.x, e.y);
      if (o) w.removeObject(s.objects, o);
    } else if (e.t === 'obj+') {
      if (!w.objectAt(e.x, e.y) && OBJECTS[e.k]) {
        const o = { t: e.k, x: e.x, y: e.y };
        if (e.g) o.grow = e.g;
        if (e.c != null) o.charges = e.c;
        w.addObject(s.objects, o);
      }
    } else if (e.t === 'tile') {
      w.setTile(e.x, e.y, e.v);
    } else if (e.t === 'build+') {
      const def = BUILDINGS[e.b?.type];
      if (def && !s.buildings.some(b => b.id === e.b.id)) {
        for (let y = 0; y < def.size; y++) for (let x = 0; x < def.size; x++) {
          const o = w.objectAt(e.b.tx + x, e.b.ty + y);
          if (o) w.removeObject(s.objects, o);
        }
        s.buildings.push({ id: e.b.id, type: e.b.type, tx: e.b.tx, ty: e.b.ty, size: def.size, built: true, progress: def.work || 0, builtBy: e.b.by || null, theirs: true });
        g.recalc?.();
      }
    } else if (e.t === 'build-') {
      const b = s.buildings.find(x => x.id === e.id);
      if (b) { s.buildings = s.buildings.filter(x => x !== b); g.recalc?.(); }
    } else if (e.t === 'chest') {
      s.chests = (s.chests || []).filter(c => Math.round(c.x / TILE) !== e.x || Math.round(c.y / TILE) !== e.y);
    }
    g.emit?.('change');
  } finally {
    g._applyingEdit = false;
  }
}
