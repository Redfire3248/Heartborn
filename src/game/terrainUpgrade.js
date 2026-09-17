/*
 * When world generation improves, older worlds get the new land too (once): the map is rebuilt from its seed at the
 * current size, with fresh biomes, ores, trees and animals. Everything you made stays: houses, tables and other
 * buildings, placed torches, dropped items and your hero are moved so your home keeps sitting in the meadow at the
 * centre of the new map. Chests, finds and cave mouths reappear by themselves in the new land.
 */
import { TILE, NEW_MAP_SIZE, TERRAIN_VERSION, MAP_W } from '../core/constants.js';
import { World, populateWorld } from './world.js';

export function upgradeTerrain(state) {
  if ((state.terrainVersion || 0) >= TERRAIN_VERSION && state.mapSize === NEW_MAP_SIZE) return false;
  const oldSize = state.mapSize || MAP_W;
  const shift = Math.round((NEW_MAP_SIZE - oldSize) / 2);   // tiles: the old centre moves to the new centre
  const px = shift * TILE;
  const world = new World(state.seed, NEW_MAP_SIZE);
  const { objects, creatures } = populateWorld(world);

  for (const b of state.buildings || []) { b.tx += shift; b.ty += shift; }
  for (const v of [...(state.villagers || []), ...(state.benched || [])]) { if (v.x != null) { v.x += px; v.y += px; } }
  for (const list of [state.groundItems, state.torches]) for (const it of list || []) { it.x += px; it.y += px; }
  if (state.center) { state.center.x += px; state.center.y += px; }

  // the new wild land, clear of whatever you built
  const taken = new Set();
  for (const b of state.buildings || []) {
    const s = b.size || 1;
    for (let y = b.ty - 1; y <= b.ty + s; y++) for (let x = b.tx - 1; x <= b.tx + s; x++) taken.add(`${x},${y}`);
  }
  state.objects = objects.filter(o => !taken.has(`${o.x},${o.y}`));
  state.creatures = creatures;
  state.chests = [];
  state.finds = [];
  state.dungeons = [];
  state.mapSize = NEW_MAP_SIZE;
  state.terrainVersion = TERRAIN_VERSION;
  return true;
}
