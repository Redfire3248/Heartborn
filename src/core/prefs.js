/** Small per-player preferences kept in this browser. */
const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* private mode */ } };

/** Quick craft: tools and potions skip the forging minigames. */
export const quickCraft = () => get('hb-quickcraft', false);
export const setQuickCraft = v => set('hb-quickcraft', v);
