import { held } from './controls.js';
import { TILE, MAP_W, MAP_H } from './constants.js';

const MIN_ZOOM = 0.25, MAX_ZOOM = 5;

/** Camera controls: drag to pan, wheel/pinch to zoom, WASD/arrows, click to act. */
export class Input {
  constructor(canvas, renderer, handlers) {
    this.canvas = canvas;
    this.r = renderer;
    this.h = handlers;
    this.keys = new Set();
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;

    canvas.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select')) return;
      this.keys.add(e.key.toLowerCase());
      this.h.onKey?.(e);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.r.camera.zoom };
      this.drag = null;
      return;
    }
    this.drag = { x: e.clientX, y: e.clientY, cx: this.r.camera.x, cy: this.r.camera.y, moved: false, button: e.button };
    // in build mode a left-drag paints buildings instead of moving the camera
    if (e.button === 0 && this.h.isPlacing?.()) {
      this.drag.place = true;
      const w = this.r.screenToWorld(e.clientX, e.clientY);
      this.h.onPlaceStart?.(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    }
  }

  move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.setZoom(this.pinch.zoom * d / this.pinch.dist);
      return;
    }
    if (e.target === this.canvas || this.drag) {
      const w = this.r.screenToWorld(e.clientX, e.clientY);
      this.h.onHover?.(Math.floor(w.x / TILE), Math.floor(w.y / TILE), w);
    }
    if (!this.drag) return;
    if (this.drag.place) {
      const w = this.r.screenToWorld(e.clientX, e.clientY);
      this.h.onPlaceMove?.(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
      return;
    }
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
    if (this.drag.moved && this.h.isLeading?.()) return;   // you are your character: the camera stays on you
    if (this.drag.moved) {
      this.r.camera.x = this.drag.cx - dx / this.r.camera.zoom;
      this.r.camera.y = this.drag.cy - dy / this.r.camera.zoom;
      this.clamp();
      this.canvas.style.cursor = 'grabbing';
    }
  }

  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const d = this.drag;
    this.drag = null;
    this.canvas.style.cursor = '';
    if (d?.place) {
      const w = this.r.screenToWorld(e.clientX, e.clientY);
      this.h.onPlaceEnd?.(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
      return;
    }
    if (!d || d.moved || e.target !== this.canvas) return;
    const w = this.r.screenToWorld(e.clientX, e.clientY);
    if (d.button === 2) this.h.onRightClick?.(w);
    else this.h.onClick?.(w, Math.floor(w.x / TILE), Math.floor(w.y / TILE));
  }

  zoomAt(sx, sy, factor) {
    const before = this.r.screenToWorld(sx, sy);
    this.setZoom(this.r.camera.zoom * factor);
    const after = this.r.screenToWorld(sx, sy);
    this.r.camera.x += before.x - after.x;
    this.r.camera.y += before.y - after.y;
    this.clamp();
  }

  setZoom(z) { this.r.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)); }

  clamp() {
    const c = this.r.camera;
    c.x = Math.max(0, Math.min(MAP_W * TILE, c.x));
    c.y = Math.max(0, Math.min(MAP_H * TILE, c.y));
  }

  update(dt) {
    if (this.h.isSailing?.() || this.h.isLeading?.()) return;   // at the helm, the keys steer the boat and the camera follows it
    const k = this.keys;
    const sp = 500 * dt / this.r.camera.zoom;
    if (held(k, 'up') || k.has('arrowup')) this.r.camera.y -= sp;
    if (held(k, 'down') || k.has('arrowdown')) this.r.camera.y += sp;
    if (held(k, 'left') || k.has('arrowleft')) this.r.camera.x -= sp;
    if (held(k, 'right') || k.has('arrowright')) this.r.camera.x += sp;
    if (k.has('q')) this.setZoom(this.r.camera.zoom * (1 - dt * 1.5));
    if (k.has('e')) this.setZoom(this.r.camera.zoom * (1 + dt * 1.5));
    this.clamp();
  }

  panTo(x, y) { this.r.camera.x = x; this.r.camera.y = y; this.clamp(); }
}
