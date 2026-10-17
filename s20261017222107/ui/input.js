// Player input: keyboard (desktop) and on-screen touch controls (phones). Buttons are counted presses so
// no tap is lost between network ticks: g = pick up / put down, u = chop / use / throw, d = dash.
/* global nipplejs */

export function isTouch() {
  const q = new URLSearchParams(location.search);
  if (q.has('touch')) return true;
  if (q.has('notouch')) return false;
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

export class Input {
  constructor() {
    this.state = { mx: 0, mz: 0, g: 0, u: 0, d: 0, uh: false };
    this.keys = new Set();
    this.stick = { x: 0, z: 0 };
    this.touchUse = false;
    addEventListener('keydown', e => {
      if (e.target?.tagName === 'INPUT') return;
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'KeyJ', 'KeyZ'].includes(e.code)) { this.state.g++; e.preventDefault(); }
      if (['ControlLeft', 'ControlRight', 'KeyK', 'KeyX', 'KeyE'].includes(e.code)) { this.state.u++; e.preventDefault(); }
      if (['ShiftLeft', 'ShiftRight', 'KeyL', 'KeyC', 'AltLeft'].includes(e.code)) { this.state.d++; e.preventDefault(); }
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  poll() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; } else { x = this.stick.x; z = this.stick.z; }
    this.state.mx = x; this.state.mz = z;
    this.state.uh = this.touchUse || ['ControlLeft', 'ControlRight', 'KeyK', 'KeyX', 'KeyE'].some(c => k.has(c));
    return this.state;
  }

  mountTouch() {
    if (this.root) return;
    const css = document.createElement('style');
    css.textContent = `
      #touch { position: fixed; inset: 0; z-index: 10; pointer-events: none; }
      #touch .zone { position: absolute; left: 0; top: 18%; width: 50%; height: 82%; pointer-events: auto; }
      #touch .btn { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;
        font: 900 2.9vmin/1.05 "Arial Black", system-ui, sans-serif; color: #fff; text-shadow: 0 2px 2px #0008; border: 3px solid rgba(255,255,255,0.7);
        opacity: 0.78; box-shadow: inset 0 -6px 10px rgba(0,0,0,0.3), 0 3px 8px #0006; text-align: center; touch-action: none; }
      #touch .btn b { font-size: 6vmin; line-height: 1; }
      #touch .btn.on { opacity: 1; transform: scale(0.92); }
    `;
    document.head.appendChild(css);
    const root = this.root = document.createElement('div'); root.id = 'touch';
    const zone = document.createElement('div'); zone.className = 'zone'; root.appendChild(zone);
    const mk = (html, size, right, bottom, color, on, off) => {
      const b = document.createElement('div'); b.className = 'btn'; b.innerHTML = html;
      Object.assign(b.style, { width: size + 'vmin', height: size + 'vmin', right: `calc(${right}vw + env(safe-area-inset-right))`, bottom: bottom + 'vh', background: color });
      const down = e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('on'); navigator.vibrate?.(10); on(); };
      const up = e => { e.preventDefault(); if (!b.classList.contains('on')) return; b.classList.remove('on'); off?.(); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      root.appendChild(b); return b;
    };
    mk('<b>✋</b>PICK UP<br>DROP', 27, 3, 6, '#2f9a3c', () => this.state.g++);
    mk('<b>🔪</b>CHOP<br>THROW', 22, 25, 4, '#2d6fd6', () => { this.state.u++; this.touchUse = true; }, () => { this.touchUse = false; });
    mk('<b>💨</b>DASH', 19, 8, 40, '#d9902a', () => this.state.d++);
    document.body.appendChild(root);
    this.nipple = nipplejs.create({ zone, mode: 'dynamic', color: 'white', size: 140, threshold: 0.05, fadeTime: 100, restOpacity: 0.7 });
    const max = 140 * 0.4;
    this.nipple.on('move', (e, d) => {
      const k = Math.min(1, (d.distance ?? 0) / max), a = d.angle?.radian ?? 0;
      this.stick.x = Math.cos(a) * k; this.stick.z = -Math.sin(a) * k;
    });
    this.nipple.on('end', () => { this.stick.x = 0; this.stick.z = 0; });
    addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
  }
  setTouchVisible(v) { if (this.root) this.root.style.display = v ? '' : 'none'; }
}
