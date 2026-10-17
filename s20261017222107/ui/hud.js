// In-game HUD (DOM): order tickets top-left, coin + score bottom-left, level timer bottom-right,
// plus the "Ready / Go / Time's up" banners and floating score pops.
import { RECIPES, dishIcon } from '../game/rules.js';

const iconCache = new Map();
// small hand-drawn icons (canvas) for ingredients and dishes
export function icon(kind, size = 64) {
  const key = kind + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const s = size / 64;
  x.scale(s, s); x.lineWidth = 3; x.strokeStyle = '#2a1a10';
  const blob = (fill, cx = 32, cy = 34, r = 20) => { x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.stroke(); };
  const soup = (col) => {
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(32, 40, 28, 12, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#f4efe2'; x.beginPath(); x.moveTo(10, 30); x.quadraticCurveTo(32, 64, 54, 30); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = col; x.beginPath(); x.ellipse(32, 30, 22, 7, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  };
  switch (kind) {
    case 'onion': blob('#d7a24a'); x.fillStyle = '#7a9a3a'; x.fillRect(29, 6, 6, 12); x.strokeRect(29, 6, 6, 12); x.beginPath(); x.moveTo(32, 18); x.lineTo(32, 50); x.stroke(); break;
    case 'tomato': blob('#df3b2b'); x.fillStyle = '#3d8a2e'; x.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; x.lineTo(32 + Math.cos(a) * 11, 16 + Math.sin(a) * 5); x.lineTo(32 + Math.cos(a + 0.6) * 4, 16 + Math.sin(a + 0.6) * 2); } x.closePath(); x.fill(); x.stroke(); break;
    case 'mushroom': x.fillStyle = '#efe2cf'; x.fillRect(24, 32, 16, 22); x.strokeRect(24, 32, 16, 22); x.fillStyle = '#c99a6d'; x.beginPath(); x.arc(32, 34, 24, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); break;
    case 'onion_soup': soup('#e6b85c'); break;
    case 'tomato_soup': soup('#d8452e'); break;
    case 'mushroom_soup': soup('#a8805a'); break;
    case 'lettuce': blob('#6cc04a'); x.fillStyle = '#b6e48a'; x.beginPath(); x.arc(32, 30, 9, 0, Math.PI * 2); x.fill(); break;
    case 'bun': x.fillStyle = '#e09a48'; x.beginPath(); x.arc(32, 38, 22, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#f6dcae'; x.fillRect(10, 40, 44, 8); x.strokeRect(10, 40, 44, 8); break;
    case 'meat': x.fillStyle = '#c8463c'; x.beginPath(); x.ellipse(30, 34, 22, 15, -0.3, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#f2d6c8'; x.beginPath(); x.arc(40, 30, 5, 0, Math.PI * 2); x.fill(); break;
    case 'chicken': blob('#e8a060', 26, 30, 16); x.fillStyle = '#fff'; x.fillRect(38, 38, 16, 7); x.strokeRect(38, 38, 16, 7); break;
    case 'fish': x.fillStyle = '#7aa6c8'; x.beginPath(); x.ellipse(28, 32, 20, 11, 0, 0, Math.PI * 2); x.fill(); x.stroke(); x.beginPath(); x.moveTo(46, 32); x.lineTo(58, 22); x.lineTo(58, 42); x.closePath(); x.fill(); x.stroke(); break;
    case 'potato': x.fillStyle = '#b98a4e'; x.beginPath(); x.ellipse(32, 34, 22, 15, 0.2, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    case 'dough': x.fillStyle = '#f2e2bc'; x.beginPath(); x.ellipse(32, 36, 22, 14, 0, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    case 'cheese': x.fillStyle = '#f5c838'; x.beginPath(); x.moveTo(8, 46); x.lineTo(56, 46); x.lineTo(56, 22); x.closePath(); x.fill(); x.stroke(); break;
    case 'pepperoni': x.fillStyle = '#b8322a'; x.beginPath(); x.ellipse(32, 34, 24, 10, -0.5, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    case 'rice': x.fillStyle = '#fbfaf4'; x.beginPath(); x.arc(32, 36, 20, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = '#d8c8a0'; x.fillRect(12, 36, 40, 12); x.strokeRect(12, 36, 40, 12); break;
    case 'tortilla': x.fillStyle = '#efd9a0'; x.beginPath(); x.arc(32, 32, 24, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#d9b870'; [[24, 26], [40, 30], [30, 42]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 3, 0, Math.PI * 2); x.fill(); }); break;
    case 'burger': x.fillStyle = '#e09a48'; x.beginPath(); x.arc(32, 30, 24, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#6cc04a'; x.fillRect(8, 30, 48, 5); x.fillStyle = '#6a3a22'; x.fillRect(8, 35, 48, 8); x.strokeRect(8, 35, 48, 8); x.fillStyle = '#e09a48'; x.fillRect(8, 43, 48, 9); x.strokeRect(8, 43, 48, 9); break;
    case 'fish_chips': x.fillStyle = '#fff'; x.beginPath(); x.ellipse(32, 44, 28, 10, 0, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#e0a040'; x.beginPath(); x.ellipse(24, 36, 16, 8, 0, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#f0c040'; for (let i = 0; i < 5; i++) { x.fillRect(38 + i * 3, 22 + (i % 2) * 4, 4, 18); x.strokeRect(38 + i * 3, 22 + (i % 2) * 4, 4, 18); } break;
    case 'pizza': case 'pepperoni_pizza': case 'mushroom_pizza':
      x.fillStyle = '#e7b25a'; x.beginPath(); x.arc(32, 34, 26, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#d8452e'; x.beginPath(); x.arc(32, 34, 21, 0, Math.PI * 2); x.fill(); x.fillStyle = '#f7d24a'; x.beginPath(); x.arc(32, 34, 17, 0, Math.PI * 2); x.fill();
      if (kind !== 'pizza') { x.fillStyle = kind === 'pepperoni_pizza' ? '#a82a22' : '#a8805a'; [[24, 28], [40, 30], [30, 42], [42, 42], [22, 40]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 4, 0, Math.PI * 2); x.fill(); }); }
      break;
    case 'burrito': x.fillStyle = '#efd9a0'; x.save(); x.translate(32, 34); x.rotate(-0.5); x.fillRect(-26, -11, 52, 22); x.strokeRect(-26, -11, 52, 22); x.fillStyle = '#c8463c'; x.fillRect(22, -9, 5, 18); x.restore(); break;
    case 'salad': case 'tomato_salad': x.fillStyle = '#fff'; x.beginPath(); x.ellipse(32, 42, 26, 12, 0, 0, Math.PI * 2); x.fill(); x.stroke(); blob('#6cc04a', 32, 34, 15); if (kind === 'tomato_salad') blob('#df3b2b', 40, 36, 7); break;
    case 'pan': x.fillStyle = '#2e3238'; x.beginPath(); x.ellipse(26, 38, 20, 9, 0, 0, Math.PI * 2); x.fill(); x.fillRect(44, 34, 16, 5); x.strokeStyle = '#2e3238'; x.lineWidth = 3; for (const o of [16, 26, 36]) { x.beginPath(); x.moveTo(o, 24); x.quadraticCurveTo(o + 4, 18, o, 12); x.stroke(); } break;
    case 'basket': x.strokeStyle = '#2e3238'; x.lineWidth = 4; x.strokeRect(14, 22, 30, 24); for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(14 + i * 7.5, 22); x.lineTo(14 + i * 7.5, 46); x.stroke(); } x.beginPath(); x.moveTo(44, 26); x.lineTo(58, 18); x.stroke(); break;
    case 'pot': x.fillStyle = '#2e3238'; x.fillRect(14, 26, 36, 24); x.fillRect(6, 29, 8, 5); x.fillRect(50, 29, 8, 5); x.fillRect(12, 22, 40, 5); break;
    case 'oven': x.fillStyle = '#2e3238'; x.fillRect(12, 16, 40, 34); x.fillStyle = '#ff8a2a'; x.fillRect(18, 28, 28, 14); break;
    case 'coin': x.fillStyle = '#f5c430'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; x.lineTo(32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29); } x.closePath(); x.fill(); x.lineWidth = 4; x.strokeStyle = '#a8740e'; x.stroke(); x.fillStyle = '#e0a820'; x.beginPath(); x.arc(32, 32, 19, 0, Math.PI * 2); x.fill(); break;
    case 'coin_old': blob('#f5c430', 32, 32, 26); x.fillStyle = '#c98f10'; x.font = '900 30px Arial Black'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('★', 32, 34); break;
    case 'clock': x.fillStyle = '#9fb2c4'; x.fillRect(27, 2, 10, 8); x.fillRect(46, 8, 8, 6); blob('#cfdbe6', 32, 36, 26); blob('#f4f8fb', 32, 36, 20); x.beginPath(); x.moveTo(32, 36); x.lineTo(32, 22); x.moveTo(32, 36); x.lineTo(42, 40); x.stroke(); break;
    case 'clock_old': blob('#fff', 32, 32, 26); x.beginPath(); x.moveTo(32, 32); x.lineTo(32, 14); x.moveTo(32, 32); x.lineTo(44, 38); x.stroke(); break;
  }
  const url = c.toDataURL(); iconCache.set(key, url); return url;
}

function css() {
  if (document.getElementById('hud-css')) return;
  const s = document.createElement('style'); s.id = 'hud-css';
  s.textContent = `
  #hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: "Arial Black", system-ui, sans-serif; color: #fff; }
  #orders { position: absolute; left: calc(8px + env(safe-area-inset-left)); top: 6px; display: flex; gap: 6px; align-items: flex-start; }
  .ticket { width: 84px; flex: none; background: #fdf8ec; border-radius: 6px; box-shadow: 0 3px 0 #0005; overflow: hidden; transition: transform .25s, opacity .25s; transform-origin: top left; }
  .ticket.new { transform: translateY(-120%); }
  .ticket.gone { opacity: 0; transform: scale(.6); }
  .ticket .tbar { height: 7px; background: #333; } .ticket .tbar i { display: block; height: 100%; background: #3fd04a; }
  .ticket .dish { display: flex; justify-content: center; padding: 2px 0 0; } .ticket .dish img { width: 46px; height: 46px; }
  .ticket .ings { display: flex; justify-content: center; gap: 1px; background: #b8cdd8; padding: 2px; }
  .ticket .ing { display: flex; flex-direction: column; align-items: center; } .ticket .ing img { width: 22px; height: 22px; }
  .ticket .ing img.p { width: 16px; height: 16px; opacity: .85; }
  .ticket .ing img:first-child { background: #fff; border-radius: 50%; }
  .ticket .meth { display: flex; justify-content: center; background: #b8cdd8; padding: 0 0 2px; } .ticket .meth img { width: 18px; height: 18px; }
  .ticket.late { animation: shake .4s infinite; }
  @keyframes shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-2px) } 75% { transform: translateX(2px) } }
  #score { position: absolute; left: calc(10px + env(safe-area-inset-left)); bottom: 8px; display: flex; align-items: center; gap: 6px; font-size: 30px; text-shadow: 0 3px 0 #000a, 0 0 6px #000; }
  #score img { width: 64px; height: 64px; } #score { font-size: 40px !important; }
  #score .tips { font-size: 14px; color: #ffe27a; }
  #clock { position: absolute; right: calc(12px + env(safe-area-inset-right)); bottom: 8px; display: flex; align-items: center; gap: 6px; font-size: 30px; text-shadow: 0 3px 0 #000a, 0 0 6px #000; }
  #clock img { width: 58px; height: 58px; } #clock { font-size: 40px !important; }
  #clock.low { color: #ff5a4a; }
  body.touch #clock { bottom: auto; top: 6px; font-size: 26px !important; } body.touch #clock img { width: 30px; height: 30px; }
  body.touch #score { left: auto; right: calc(10px + env(safe-area-inset-right)); bottom: auto; top: 44px; font-size: 26px !important; } body.touch #score img { width: 30px; height: 30px; }
  #banner { position: absolute; left: 0; right: 0; top: 34%; text-align: center; font: 15vmin/1 'Luckiest Guy', 'Arial Black', sans-serif; letter-spacing: 2px; color: #ff9a1f;
    -webkit-text-stroke: 1.2vmin #fff; paint-order: stroke fill; text-shadow: 0 1.2vmin 0 #00000055; transition: opacity .3s, transform .3s; }
  #banner.go { color: #3fc43a; } #banner.over { color: #3fb0f0; }
  #banner.show { animation: bannerIn .45s cubic-bezier(.3,1.6,.5,1); }
  @keyframes bannerIn { from { transform: scale(.2); } to { transform: scale(1); } }
  #score .n, #clock span { font-family: 'Luckiest Guy', 'Arial Black', sans-serif; -webkit-text-stroke: 5px #3a2410; paint-order: stroke fill; letter-spacing: 1px; }
  #clock span { -webkit-text-stroke-color: #2a3a4a; }
  .tip { position: absolute; transform: translate(-50%, -100%); font: 26px 'Luckiest Guy', 'Arial Black', sans-serif; color: #5fe04a; -webkit-text-stroke: 4px #1a4a10; paint-order: stroke fill; animation: pop 1.4s forwards; white-space: nowrap; }
  .pop { position: absolute; font-size: 22px; color: #ffe066; text-shadow: 0 2px 0 #000; animation: pop 1.2s forwards; }
  @keyframes pop { from { transform: translateY(0); opacity: 1 } to { transform: translateY(-60px); opacity: 0 } }
  `;
  document.head.appendChild(s);
}

export class Hud {
  constructor() {
    css();
    this.root = document.createElement('div'); this.root.id = 'hud';
    this.root.innerHTML = `<div id="orders"></div><div id="score"><img src="${icon('coin')}"><span class="n">0</span></div>
      <div id="clock"><img src="${icon('clock')}"><span>0:00</span></div><div id="banner"></div>`;
    document.body.appendChild(this.root);
    this.ordersEl = this.root.querySelector('#orders');
    this.tickets = new Map();
  }
  destroy() { this.root.remove(); }
  update(k) {
    // tickets
    const live = new Set(k.orders.map(o => o.id));
    for (const [id, el] of this.tickets) if (!live.has(id) && !el.classList.contains('gone')) { el.classList.add('gone'); setTimeout(() => { el.remove(); this.tickets.delete(id); }, 280); }
    for (const o of k.orders) {
      let el = this.tickets.get(o.id);
      if (!el) {
        const r = RECIPES[o.r];
        el = document.createElement('div'); el.className = 'ticket new';
        // ingredient circles; the cooking method sits under each cooked ingredient, or once under all of them
        const ings = r.ings.map(([i, m]) => `<div class="ing"><img src="${icon(i, 44)}">${m ? `<img class="p" src="${icon(m, 32)}">` : ''}</div>`).join('');
        el.innerHTML = `<div class="tbar"><i></i></div><div class="dish"><img src="${icon(dishIcon(o.r))}"></div><div class="ings">${ings}</div>${r.method ? `<div class="meth"><img src="${icon(r.method, 32)}"></div>` : ''}`;
        el.style.width = Math.max(70, r.ings.length * 26 + 10) + 'px';
        this.ordersEl.appendChild(el); this.tickets.set(o.id, el);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('new')));
      }
      const f = Math.max(0, o.left / o.total);
      const bar = el.querySelector('.tbar i');
      bar.style.width = (f * 100).toFixed(1) + '%';
      bar.style.background = f > 0.5 ? '#3fd04a' : f > 0.25 ? '#f2c21b' : '#e8322a';
      el.classList.toggle('late', f < 0.2);
    }
    this.root.querySelector('#score .n').textContent = k.score;

    const s = Math.ceil(k.left), clock = this.root.querySelector('#clock');
    clock.querySelector('span').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    clock.classList.toggle('low', s <= 30 && k.phase === 'play');
    const b = this.root.querySelector('#banner');
    const ready = k.phase === 'ready';
    const txt = ready ? (k.time < 2 ? 'READY?' : 'GO!') : k.phase === 'over' ? "TIME'S UP!" : '';
    if (txt !== b.textContent) { b.textContent = txt; b.className = (txt === 'GO!' ? 'go' : txt.startsWith('TIME') ? 'over' : '') + (txt ? ' show' : ''); }
    b.style.opacity = txt ? 1 : 0;
  }
  // "+6 TIP!" floating up from the serving pass (screen position given by the caller)
  tip(text, x, y) {
    const p = document.createElement('div'); p.className = 'tip'; p.textContent = text;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    this.root.appendChild(p); setTimeout(() => p.remove(), 1500);
  }
  pop(text) {
    const p = document.createElement('div'); p.className = 'pop'; p.textContent = text;
    const sc = this.root.querySelector('#score').getBoundingClientRect();
    p.style.left = sc.left + 'px'; p.style.top = (sc.top - 20) + 'px';
    this.root.appendChild(p); setTimeout(() => p.remove(), 1300);
  }
}
