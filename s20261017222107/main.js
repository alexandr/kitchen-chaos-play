// App shell: title menu, online lobby (PeerJS rooms), the game loop (solo, host or client) and results.
//
// Netcode: the host runs the kitchen simulation at 60 Hz and broadcasts snapshots at 20 Hz. Each phone
// moves its own chef locally (so walking feels instant on cellular) and sends its position plus button
// presses; the host owns everything else (items, pots, fire, orders, score). Other chefs are drawn
// interpolated ~100 ms in the past.
import { Kitchen } from './game/sim.js';
import { LEVELS } from './game/levels.js';
import { RECIPES, dishIcon } from './game/rules.js';
import { View, chefPortrait, kitchenThumb } from './render/view.js';
import { WorldMap } from './render/map.js';
import { Hud, icon } from './ui/hud.js';
import { Input, isTouch } from './ui/input.js';
import { sfx, unlockAudio, music } from './ui/audio.js';
import { Room, MAX_PLAYERS } from './net/room.js';
import { CHEF_COLORS, CHEFS } from './render/models.js';

const DT = 1 / 60, SNAP_MS = 50, INTERP_MS = 110;
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const app = window.__app = {
  RECIPES,
  view: null, input: new Input(), hud: null, game: null,
  mode: null, room: null, players: [], mySlot: 0, levelIdx: Math.max(0, LEVELS.findIndex(l => l.id === '1-1')), best: loadBest(),
  name: (() => { try { return localStorage.getItem('kc-name') || ''; } catch { return ''; } })(),
  chef: (() => { try { const v = localStorage.getItem('kc-chef'); return v === null ? Math.floor(Math.random() * 14) : +v; } catch { return 0; } })(),
};
function saveChef(v) { app.chef = v; try { localStorage.setItem('kc-chef', String(v)); } catch {} }
function saveName(v) { app.name = v.slice(0, 12); try { localStorage.setItem('kc-name', app.name); } catch {} }
function loadBest() { try { return JSON.parse(localStorage.getItem('kc-best') || '{}'); } catch { return {}; } }
function saveBest() { try { localStorage.setItem('kc-best', JSON.stringify(app.best)); } catch {} }

// ---------------- screens ----------------
const screenEl = el('<div id="screen"></div>');
document.body.appendChild(screenEl);
function show(html) { app.mapActive = false; screenEl.innerHTML = html; screenEl.className = ''; screenEl.style.display = 'flex'; return screenEl; }
function hideScreen() { app.mapActive = false; screenEl.style.display = 'none'; screenEl.innerHTML = ''; }
function toast(msg, ms = 2500) {
  let t = $('#toast'); if (!t) { t = el('<div id="toast"></div>'); document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = 0; }, ms);
}

// the recipe notebook: a plaid cover first (tap to open), then the menu page
let coverSeen = false;
function titleScreen(err) {
  stopGame();
  const q = new URLSearchParams(location.search), code = (q.get('room') || '').toUpperCase().slice(0, 4);
  if (!coverSeen && !code && !err && !q.has('nocover')) {
    const c = show(`<div class="notebook cover" id="cover"><div class="rings"></div><div class="plaid">
      <div class="logo">KITCHEN<br>CHAOS!</div><div class="tap">Tap to continue</div><div class="recipes">RECIPES</div></div></div>`);
    c.classList.add('tabletop');
    $('#cover', c).onclick = () => { coverSeen = true; unlockAudio(); titleScreen(); };
    return;
  }
  coverSeen = true;
  const s = show(`<div class="notebook open"><div class="rings"></div><div class="page">
    <div class="pt">KITCHEN CHAOS</div>
    <label class="line">Your name <input id="name" maxlength="12" placeholder="Chef" value="${esc(app.name)}"></label>
    ${code ? `<button class="item big" id="joinlink">► JOIN ROOM ${esc(code)}</button>` : ''}
    <button class="item" id="create">CREATE ROOM</button>
    <div class="line"><input id="code" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" value="${esc(code)}"><button class="item inline" id="join">JOIN ROOM</button></div>
    <button class="item" id="solo">PLAY SOLO</button>
    <div class="msg ${err ? 'err' : ''}">${esc(err || 'One phone creates a room; friends open the link or type the 4-letter code. Up to 4 chefs.')}</div>
    <div class="help">Stick: move · PICK UP/DROP · CHOP/THROW (also washes plates, sprays the extinguisher) · DASH. Keyboard: WASD, Space, Ctrl/E, Shift.</div>
  </div></div>`);
  s.classList.add('tabletop');
  $('#name', s).addEventListener('input', e => saveName(e.target.value));
  $('#create', s).onclick = () => createRoom();
  $('#solo', s).onclick = () => { app.mode = 'solo'; app.players = [{ pid: 'me', slot: 0, name: app.name || 'Chef', chef: app.chef }]; app.mySlot = 0; lobbyScreen(); };
  $('#join', s).onclick = () => joinRoom($('#code', s).value);
  if (code) $('#joinlink', s).onclick = () => joinRoom(code);
}

async function createRoom() {
  show(`<div class="panel"><h2>Creating room…</h2></div>`);
  try {
    const room = app.room = new Room();
    const code = await room.create();
    app.mode = 'host'; app.mySlot = 0;
    app.players = [{ pid: 'host', slot: 0, name: app.name || 'Chef 1', chef: app.chef }];
    room.on('message', hostMessage);
    room.on('leave', pid => {
      const p = app.players.find(q => q.pid === pid); if (!p) return;
      app.players = app.players.filter(q => q !== p);
      toast(p.name + ' left');
      if (app.game) app.game.k.chefs = app.game.k.chefs.filter(c => c.slot !== p.slot);
      broadcastLobby();
    });
    room.on('error', e => toast('Network: ' + (e.type || e.message)));
    history.replaceState(null, '', location.pathname + '?room=' + code);
    lobbyScreen();
  } catch (e) { app.room?.close(); app.room = null; titleScreen('Could not create a room: ' + (e.message || e.type || e)); }
}

async function joinRoom(code) {
  code = (code || '').toUpperCase().trim();
  if (code.length !== 4) { titleScreen('Enter the 4-letter room code.'); return; }
  show(`<div class="panel"><h2>Joining ${esc(code)}…</h2><div class="msg">Connecting to the host's phone.</div></div>`);
  try {
    const room = app.room = new Room();
    room.on('message', (from, msg) => clientMessage(msg));
    room.on('hostLeft', () => { toast('The host left the room', 4000); leaveRoom(); });
    await room.join(code);
    app.mode = 'client';
    room.send('host', { t: 'hello', name: app.name || 'Chef', chef: app.chef });
    history.replaceState(null, '', location.pathname + '?room=' + code);
  } catch (e) { app.room?.close(); app.room = null; titleScreen(e.message || String(e)); }
}
function leaveRoom() {
  stopGame();
  app.room?.close(); app.room = null; app.mode = null; app.players = [];
  history.replaceState(null, '', location.pathname);
  titleScreen();
}

function broadcastLobby() {
  if (app.mode !== 'host') return;
  app.room.broadcast({ t: 'lobby', players: app.players, level: app.levelIdx });
  if (!app.game) lobbyScreen();
}

function hostMessage(from, msg) {
  switch (msg.t) {
    case 'hello': {
      if (app.players.some(p => p.pid === from)) break;
      const used = new Set(app.players.map(p => p.slot));
      let slot = 0; while (used.has(slot)) slot++;
      if (slot >= MAX_PLAYERS) { app.room.send(from, { t: 'full' }); break; }
      const p = { pid: from, slot, name: String(msg.name || 'Chef').slice(0, 12), chef: (msg.chef | 0) % CHEFS.length };
      app.players.push(p); app.players.sort((a, b) => a.slot - b.slot);
      app.room.send(from, { t: 'welcome', slot });
      toast(p.name + ' joined');
      broadcastLobby();
      if (app.game) { // join mid-game
        app.game.k.addChef({ slot, name: p.name, color: slot, chef: p.chef });
        app.room.send(from, { t: 'start', level: app.levelIdx, players: app.players });
      }
      break;
    }
    case 'chef': {
      const p = app.players.find(q => q.pid === from);
      if (p) { p.chef = ((msg.chef | 0) % CHEFS.length + CHEFS.length) % CHEFS.length; broadcastLobby(); }
      break;
    }
    case 'in': {
      const p = app.players.find(q => q.pid === from);
      if (p && app.game) app.game.remote[p.slot] = msg;
      break;
    }
  }
}
function clientMessage(msg) {
  switch (msg.t) {
    case 'full': titleScreen('That room is full (4 chefs).'); break;
    case 'welcome': app.mySlot = msg.slot; break;
    case 'lobby': app.players = msg.players; app.levelIdx = msg.level; if (!app.game) lobbyScreen(); break;
    case 'start': startGame(msg.level, msg.players); break;
    case 's': app.game?.onSnapshot(msg); break;
    case 'tolobby': stopGame(); lobbyScreen(); break;
  }
}

function lobbyScreen() {
  stopGame();
  const host = app.mode !== 'client', code = app.room?.code;
  const link = code ? `${location.origin}${location.pathname}?room=${code}` : '';
  const slots = [0, 1, 2, 3].map(i => {
    const p = app.players.find(q => q.slot === i);
    if (!p) return app.mode === 'solo' ? '' : `<div class="pl empty" style="--pc:${CHEF_COLORS[i]}"><div class="por"></div><div class="nm muted">open</div></div>`;
    const mine = p.slot === app.mySlot;
    return `<div class="pl" style="--pc:${CHEF_COLORS[i]}">
      ${mine ? '<button class="arr" data-d="-1">◀</button>' : ''}<img class="por" src="${chefPortrait(p.chef ?? i, i)}">${mine ? '<button class="arr" data-d="1">▶</button>' : ''}
      <div class="nm">${esc(p.name)}${mine ? ' (you)' : ''}${p.pid?.startsWith('m:') ? ' <span class="muted">relay</span>' : ''}</div>
      <div class="cn">${esc(CHEFS[p.chef ?? i]?.name ?? '')}</div></div>`;
  }).join('');
  const sel = LEVELS[app.levelIdx], best = app.best[sel.id];
  const nChefs = Math.max(1, app.players.length);
  const th = sel.sequence ? null : Array.isArray(sel.stars) ? sel.stars : sel.stars[Math.min(4, nChefs)];
  const dishes = [...new Set([...(sel.recipes ?? []), ...(sel.sequence ?? []).flat()].map(dishIcon))];
  const s = show(`
    <div class="startotal">★<b>${String(Object.values(app.best).reduce((a, b) => a + (b.stars ?? 0), 0)).padStart(3, '0')}</b></div>
    <div class="topbar">
      ${code ? `<div class="roomcode">Room <b>${code}</b></div><button id="share">${navigator.share ? 'Share link' : 'Copy link'}</button>` : '<div class="roomcode">Solo</div>'}
      <button id="leave">Leave</button>
    </div>
    <div class="card">
      <div class="strip">
        <div class="ctitle">${sel.id === 'peck' ? 'The Finale' : sel.id === 'intro' ? 'Intro' : 'Level ' + esc(sel.name)}</div>
        ${best ? `<div class="best">Score : ${best.score}</div>` : ''}
        <img class="thumb" src="${kitchenThumb(sel, Kitchen)}">
        <div class="dishrow">${dishes.map(r => `<img src="${icon(r, 64)}">`).join('')}</div>
        ${th ? th.map((v, i) => `<div class="srow"><span class="${(best?.score ?? -1) >= v ? 'tick' : 'star'}">${(best?.score ?? -1) >= v ? '✔' : '★'}</span><i></i><b>${v}</b></div>`).join('')
          : '<div class="srow"><span class="star">★★★</span><i></i><b>finish</b></div>'}
        <div class="small">${th ? `for ${nChefs} chef${nChefs > 1 ? 's' : ''}` : ''}${sel.note ? ' · ' + esc(sel.note) : ''}</div>
      </div>
    </div>
    ${host ? '<button class="go" id="start">START ▶</button>' : '<div class="small wait">Waiting for the host…</div>'}
    ${host ? '<div class="mapnav"><button id="prev">◀</button><button id="next">▶</button></div>' : ''}
    <div class="players">${slots}</div>
  `);
  s.className = 'maplobby';
  app.mapActive = true;
  app.map.select(app.levelIdx);
  app.map.updateFlags(app.best);
  const go = d => { app.levelIdx = Math.max(0, Math.min(LEVELS.length - 1, app.levelIdx + d)); broadcastLobby(); if (app.mode === 'solo') lobbyScreen(); };
  if (host) { $('#prev', s).onclick = () => go(-1); $('#next', s).onclick = () => go(1); }
  if (host) $('#start', s).onclick = () => hostStart();
  s.querySelectorAll('.arr').forEach(b => b.onclick = () => {
    const me = app.players.find(q => q.slot === app.mySlot); if (!me) return;
    const v = (((me.chef ?? 0) + +b.dataset.d) % CHEFS.length + CHEFS.length) % CHEFS.length;
    saveChef(v);
    if (app.mode === 'client') { me.chef = v; app.room.send('host', { t: 'chef', chef: v }); lobbyScreen(); }
    else { me.chef = v; broadcastLobby(); if (app.mode === 'solo') lobbyScreen(); }
  });
  $('#leave', s).onclick = () => leaveRoom();
  const sh = $('#share', s);
  if (sh) sh.onclick = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Kitchen Chaos', text: `Join my kitchen! Room ${code}`, url: link }); else { await navigator.clipboard.writeText(link); toast('Link copied'); } } catch {}
  };
}

function hostStart() {
  unlockAudio();
  if (app.mode === 'host') app.room.broadcast({ t: 'start', level: app.levelIdx, players: app.players });
  startGame(app.levelIdx, app.players);
}

// ---------------- the game ----------------
class Game {
  constructor(levelIdx, players) {
    this.level = LEVELS[levelIdx];
    this.isHost = app.mode !== 'client';
    this.k = new Kitchen(this.level, players.map(p => ({ slot: p.slot, name: p.name, color: p.slot, chef: p.chef })));
    this.remote = {};
    this.acc = 0; this.last = performance.now(); this.lastSnap = 0; this.lastSend = 0; this.sentKey = '';
    this.snaps = [];          // client: recent snapshots for interpolating other chefs
    this.evq = [];            // host: events since the last snapshot
    this.overAt = 0;
    this.me = () => this.k.chefs.find(c => c.slot === app.mySlot);
    this.lastDash = app.input.state.d;   // only presses after the game starts count
  }
  frame(now) {
    const dt = this.paused ? 0 : Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const inp = app.input.poll();
    if (this.isHost) {
      this.acc += dt;
      while (this.acc >= DT) {
        this.acc -= DT;
        const me = this.me();
        if (me && this.k.phase === 'play') this.k.move(me, inp.mx, inp.mz, this.dashPress(inp), DT, this.k.chefs);
        const inputs = { ...this.remote };
        inputs[app.mySlot] = { g: inp.g, u: inp.u, d: inp.d, uh: inp.uh };
        const ev = this.k.step(DT, inputs);
        this.handleEvents(ev);
        if (app.mode === 'host') this.evq.push(...ev);
      }
      if (app.mode === 'host' && now - this.lastSnap >= SNAP_MS) {
        this.lastSnap = now;
        app.room.broadcast({ t: 's', s: this.k.snapshot(), ev: this.evq.filter(e => e.e !== 'dash' || true) });
        this.evq = [];
      }
    } else {
      // client: move my own chef locally, send position + buttons
      const me = this.me();
      if (me && this.k.phase === 'play') {
        const others = this.k.chefs.filter(c => c !== me).map(c => this.interp(c));
        const ox = me.x, oz = me.z;
        this.acc += dt;
        while (this.acc >= DT) { this.acc -= DT; this.k.move(me, inp.mx, inp.mz, this.dashPress(inp), DT, others); }
        me.moving = Math.hypot(me.x - ox, me.z - oz) > 1e-4;
      }
      const key = `${inp.g},${inp.u},${inp.d},${inp.uh}`;
      if (me && (key !== this.sentKey || now - this.lastSend > 33)) {
        this.sentKey = key; this.lastSend = now;
        app.room?.send('host', { t: 'in', g: inp.g, u: inp.u, d: inp.d, uh: inp.uh, dead: +(me.dead || 0).toFixed(2), x: +me.x.toFixed(3), z: +me.z.toFixed(3), fx: +me.fx.toFixed(3), fz: +me.fz.toFixed(3), mv: !!me.moving, walk: +me.walk.toFixed(2), dt: +Math.max(0, me.dashT).toFixed(3) });
      }
      // keep moving sections gliding between snapshots
      this.k.time += dt; this.k.layout(this.k.time);
      for (const e of this.k.pending) this.handleEvents([e]);
      this.k.pending = [];
    }
    // clients: tell people when the host's phone has gone quiet (locked, switched apps)
    if (!this.isHost) {
      const quiet = this.lastSnapAt && now - this.lastSnapAt > 2500;
      if (quiet !== this.quiet) { this.quiet = quiet; toast(quiet ? 'Waiting for the host’s phone… (is it locked?)' : 'Back in the kitchen!', quiet ? 60000 : 1500); }
    }
    // render
    app.view.draw(this.k, now, c => (this.isHost || c.slot === app.mySlot) ? c : this.interp(c));
    app.hud.update(this.k);
    if (this.k.phase === 'over') {
      if (!this.overAt) this.overAt = now;
      else if (now - this.overAt > 2600 && !this.resultsShown) { this.resultsShown = true; resultsScreen(this); }
    }
  }
  dashPress(inp) { const p = inp.d !== this.lastDash; this.lastDash = inp.d; return p; }
  onSnapshot(msg) {
    const s = msg.s, k = this.k, me = this.me();
    const mine = me ? { x: me.x, z: me.z, fx: me.fx, fz: me.fz, vx: me.vx, vz: me.vz, walk: me.walk, dashT: me.dashT, dashCD: me.dashCD, dead: me.dead, portal: me.portal, last: me.last } : null;
    k.applySnapshot(s);
    // chefs: take everything from the host except my own position
    const old = new Map(k.chefs.map(c => [c.slot, c]));
    k.chefs = s.chefs.map(c => Object.assign(old.get(c.slot) ?? {}, c));
    const m2 = this.me();
    if (m2 && mine) Object.assign(m2, mine);
    else if (m2) Object.assign(m2, { dashCD: 0, vx: 0, vz: 0, dead: 0, last: { g: 0, u: 0, d: 0 } });
    this.snaps.push({ at: performance.now(), chefs: s.chefs });
    this.lastSnapAt = performance.now();
    while (this.snaps.length > 12) this.snaps.shift();
    this.handleEvents(msg.ev || [], true);
  }
  // other chefs, drawn slightly in the past between two snapshots
  interp(c) {
    const t = performance.now() - INTERP_MS, S = this.snaps;
    if (S.length < 2) return c;
    let a = S[0], b = S[S.length - 1];
    for (let i = 0; i < S.length - 1; i++) if (S[i].at <= t && S[i + 1].at >= t) { a = S[i]; b = S[i + 1]; break; }
    const ca = a.chefs.find(x => x.slot === c.slot), cb = b.chefs.find(x => x.slot === c.slot);
    if (!ca || !cb) return c;
    const f = b.at === a.at ? 1 : Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at)));
    const L = (p, q) => p + (q - p) * f;
    return { ...c, x: L(ca.x, cb.x), z: L(ca.z, cb.z), fx: L(ca.fx, cb.fx), fz: L(ca.fz, cb.fz), walk: L(ca.walk, cb.walk), dashT: cb.dashT };
  }
  handleEvents(evs, remote = false) {
    for (const e of evs) {
      if (remote && e.e === 'dash' && e.s === app.mySlot) continue;
      const f = sfx[e.e === 'pick' ? 'pick' : e.e === 'land' ? 'drop' : e.e === 'catch' ? 'pick' : e.e === 'out' ? 'trash' : e.e];
      f?.();
      if (e.e === 'served') {
        app.hud.pop(`+${e.pts + e.tip}`);
        const ps = this.k.tiles.find(t => t.type === 'pass');
        if (ps && e.tip) { const [x, y] = app.view.toScreen(ps.c + 0.5, 1.2, ps.r + 0.5); app.hud.tip(`+${e.tip} TIP!`, x, y); }
      }
      if (e.e === 'go') music(true);
      if (e.e === 'timeup') music(false);
    }
  }
}

// one render loop for everything: the game when playing, otherwise the last kitchen as a backdrop
function loop(now) {
  requestAnimationFrame(loop);
  try {
    if (app.game) app.game.frame(now);
    else if (app.mapActive && app.map.root) app.map.draw(now, innerWidth / innerHeight > 1.2 ? 3.2 : 0);
    else if (app.view.k) app.view.draw(app.view.k, now);
  } catch (e) { console.error(e); }
}

// keep the screen awake while cooking (a sleeping host phone would freeze everyone)
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && app.game) keepAwake(true); });

function startGame(levelIdx, players) {
  stopGame();
  hideScreen();
  unlockAudio();
  app.levelIdx = levelIdx;
  app.players = players;
  app.game = new Game(levelIdx, players);
  app.view.build(app.game.k);
  app.hud = new Hud();
  app.input.setTouchVisible(true);
  document.body.classList.add('playing');
  keepAwake(true);
}
function stopGame() {
  if (!app.game) return;
  app.game = null; music(false);
  app.hud?.destroy(); app.hud = null;
  app.input.setTouchVisible(false);
  document.body.classList.remove('playing');
  keepAwake(false);
}

function resultsScreen(g) {
  const k = g.k, stars = k.stars(), lv = g.level;
  const prev = app.best[lv.id];
  if (!prev || k.score > prev.score) { app.best[lv.id] = { score: k.score, stars: Math.max(stars, prev?.stars ?? 0) }; saveBest(); }
  const host = app.mode !== 'client';
  const th = k.starThresholds(), rec = Math.max(prev?.score ?? 0, k.score), next = th.find(x => x > k.score);
  const s = show(`<div class="receipt">
    <div class="kc">KITCHEN COMPLETE</div>
    <div class="lvl">Level ${esc(lv.name)}</div>
    <table>
      <tr><td>Orders Delivered</td><td>${k.delivered} x 20 = ${k.delivered * 20}</td></tr>
      <tr><td>Tips</td><td>${k.tips}</td></tr>
      <tr class="fail"><td>Orders Failed</td><td>${k.failed} x 10 = ${k.failed * 10}</td></tr>
    </table>
    <div class="total">TOTAL: <b>${k.score}</b></div>
    <div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.4 + i * 0.5}s">★</span>`).join('')}</div>
    <div class="small">${k.seq ? 'Finish every order for 3 stars' : `Stars at ${th.join(' / ')} for ${k.chefs.length} chef${k.chefs.length > 1 ? 's' : ''}`} · Record ${rec}${next && !k.seq ? ` · Next Star ${next}` : ''}</div>
    <div class="row">${host ? `<button class="big" id="again">Play again</button>${app.levelIdx < LEVELS.length - 1 ? '<button class="big" id="next">Next kitchen ▶</button>' : ''}<button id="lobby">Kitchens</button>` : '<div class="small">Waiting for the host…</div>'}
      <button id="leave">Leave</button></div>
  </div>`);
  s.classList.add('table');
  for (let i = 0; i < stars; i++) setTimeout(() => sfx.cooked(), 450 + i * 500);
  if (host) {
    $('#again', s).onclick = () => hostStart();
    const n = $('#next', s); if (n) n.onclick = () => { app.levelIdx++; hostStart(); };
    $('#lobby', s).onclick = () => { if (app.mode === 'host') app.room.broadcast({ t: 'tolobby' }); stopGame(); broadcastLobby(); lobbyScreen(); };
  }
  $('#leave', s).onclick = () => leaveRoom();
}

// ---------------- boot ----------------
function boot() {
  const canvas = $('#gl');
  app.view = new View(canvas);
  app.map = new WorldMap(app.view.renderer);
  app.map.build(LEVELS, app.best);
  app.map.select(app.levelIdx);
  // tap a kitchen on the map to drive there (host / solo)
  screenEl.addEventListener('pointerdown', e => {
    if (!app.mapActive || e.target !== screenEl || app.mode === 'client') return;
    const i = app.map.pick(e.clientX, e.clientY);
    if (i >= 0 && i !== app.levelIdx) { app.levelIdx = i; broadcastLobby(); if (app.mode === 'solo') lobbyScreen(); }
  });
  const touch = isTouch();
  if (touch) { document.body.classList.add('touch'); app.input.mountTouch(); app.input.setTouchVisible(false); }
  const rot = el('<div id="rotate"><div style="font-size:16vmin">⟳</div><div>Turn your phone sideways</div></div>');
  document.body.appendChild(rot);
  // pause menu (solo pauses the kitchen; online it is just a menu, the kitchen keeps cooking)
  const quit = el('<button id="quit">❚❚</button>'); document.body.appendChild(quit);
  const pause = el(`<div id="pause"><div class="strip"><h3>PAUSE</h3><button id="p-resume" class="hi">RESUME</button><button id="p-controls">CONTROLS</button><button id="p-restart">RESTART</button><button id="p-quit">QUIT</button>
    <div class="ctl" id="p-ctl">Stick: walk · <b>PICK UP/DROP</b>: take, put down, plate, serve at the pass · <b>CHOP/THROW</b>: chop on a board, wash at the sink, spray the extinguisher (hold), throw what you hold · <b>DASH</b>: zoom forward.<br>Keyboard: WASD/arrows, Space, Ctrl or E, Shift.</div></div></div>`);
  document.body.appendChild(pause);
  const closePause = () => { pause.classList.remove('on'); if (app.game) app.game.paused = false; };
  quit.onclick = () => {
    pause.classList.add('on'); if (app.mode === 'solo' && app.game) app.game.paused = true;
    $('#p-restart').style.display = app.mode === 'client' ? 'none' : '';
  };
  $('#p-resume').onclick = closePause;
  $('#p-controls').onclick = () => $('#p-ctl').classList.toggle('on');
  $('#p-restart').onclick = () => { closePause(); hostStart(); };
  $('#p-quit').onclick = () => {
    closePause();
    if (app.mode === 'host') { app.room.broadcast({ t: 'tolobby' }); stopGame(); lobbyScreen(); }
    else if (app.mode === 'solo') lobbyScreen(); else leaveRoom();
  };
  addEventListener('keydown', e => { if (e.code === 'Escape' && app.game) (pause.classList.contains('on') ? closePause : quit.onclick)(); });
  const resize = () => { app.view.fit(); app.map.fit(); };
  addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
  addEventListener('pointerdown', unlockAudio, { once: false });
  // idle background: show the first kitchen behind the menu
  app.view.build(new Kitchen(LEVELS[0], []));
  requestAnimationFrame(loop);
  const q = new URLSearchParams(location.search);
  if (q.has('solo')) { app.mode = 'solo'; app.players = [{ pid: 'me', slot: 0, name: app.name || 'Chef', chef: app.chef }]; startGame(Math.max(0, LEVELS.findIndex(l => l.id === q.get('solo'))), app.players); }
  else titleScreen();
}
boot();
