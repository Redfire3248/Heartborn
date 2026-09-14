/* global __BUILD__ */
import { CHANGELOG } from '../data/changelog.js';

/** The build this page is running: { version, commit, builtAt }. */
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { version: 'dev', commit: 'dev', builtAt: new Date().toISOString() };

export const LATEST_CHANGES = CHANGELOG[0];

/** Asks the live site which build is newest. Resolves { live, current, isLatest } or throws when offline. */
export async function checkLatest() {
  const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(import.meta.env.DEV ? 'version.json only exists on the built site' : `HTTP ${res.status}`);
  const live = await res.json();
  return { live, current: BUILD, isLatest: live.version === BUILD.version && live.commit === BUILD.commit };
}
