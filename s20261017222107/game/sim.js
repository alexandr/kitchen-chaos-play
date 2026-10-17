// The kitchen simulation. Pure data + logic (no DOM, no three.js) so the host can run it, clients can
// render its snapshots, and Node tests can drive it.
//
// Grid: level.map rows of characters, x = column + 0.5, z = row + 0.5 (z grows towards the camera).
// Tiles are objects with a stable `id` (their index in the original map); moving sections of a kitchen
// relocate tile objects, so this.tiles[r * w + c] is "whatever tile is at (c, r) right now".
// Items are plain objects:
//   { t:'ing', k:'onion', s:'raw'|'chopped'|'cooked'|'burnt', ch:0..1, top:[...] }  ingredient (ch = chop
//        progress; dough carries pizza toppings in `top` and cooks in the oven with ck/ov)
//   { t:'plate', n:1, dirty:false, c:['bun','meat'] }        plate or a stack of n plates (c only when n == 1)
//   { t:'pot'|'pan'|'basket', c:['onion',...], ck, ov, wait, burnt }   cooking vessel
//   { t:'ext' }                                              fire extinguisher
import { RULES, RECIPES, INGREDIENTS, SOUP_INGS, COOK, POT_CAPACITY } from './rules.js';

export const TILE = {
  '.': 'floor', ',': 'ice', '~': 'hazard', ' ': 'void', '_': 'void',
  '#': 'counter', 'H': 'wall', 'C': 'board', 'S': 'stove', 'F': 'stove', 'G': 'stove', 'D': 'fryer', 'V': 'oven',
  'P': 'pass', 'W': 'sink', 'K': 'rack', 'R': 'return', 'X': 'bin', 'E': 'counter', 'L': 'counter',
  '>': 'belt', '<': 'belt', '^': 'belt', 'v': 'belt', 'Q': 'portal', 'q': 'portal', 'Y': 'portal', 'y': 'portal',
};
export const CRATES = {
  O: 'onion', T: 'tomato', M: 'mushroom', e: 'meat', u: 'bun', l: 'lettuce', f: 'fish', p: 'potato', d: 'dough',
  c: 'cheese', s: 'pepperoni', r: 'rice', w: 'tortilla', k: 'chicken',
};
const BELT = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], 'v': [0, 1] };
const WALK = new Set(['floor', 'ice', 'portal', 'hazard']);
const PLACE = new Set(['counter', 'board', 'crate', 'belt']);   // stations that take any item

export function walkable(type) { return WALK.has(type); }
export const newVessel = t => ({ t, c: [], ck: 0, ov: 0, wait: 0, burnt: false });
export const newPot = () => newVessel('pot');
const clone = o => JSON.parse(JSON.stringify(o));

export class Kitchen {
  constructor(level, players) {
    this.level = level;
    const rows = level.map;
    this.h = rows.length; this.w = Math.max(...rows.map(r => r.length));
    this.tiles = []; this.byId = [];
    const spawns = [];
    for (let r = 0; r < this.h; r++) for (let c = 0; c < this.w; c++) {
      let ch = rows[r][c] ?? ' ';
      if (ch >= '1' && ch <= '4') { spawns[+ch - 1] = { x: c + 0.5, z: r + 0.5 }; ch = '.'; }
      const id = r * this.w + c;
      const tile = { id, ch, type: CRATES[ch] ? 'crate' : (TILE[ch] ?? 'void'), item: null, fire: 0, c, r, ox: 0, oz: 0 };
      if (ch === 'S') tile.item = newVessel('pot');
      if (ch === 'F') tile.item = newVessel('pan');
      if (ch === 'D') tile.item = newVessel('basket');
      if (CRATES[ch]) tile.crate = CRATES[ch];
      if (BELT[ch]) tile.dir = BELT[ch];
      if ('QqYy'.includes(ch)) tile.portal = ch;
      if (ch === 'E') tile.item = { t: 'ext' };
      if (ch === 'L') tile.item = { t: 'plate', n: 1, dirty: false, c: [] };
      if (ch === 'W') { tile.dirty = 0; tile.wash = 0; }
      tile.home = clone(tile.item);   // what respawns here if it gets lost
      tile.base = tile.type;
      this.tiles.push(tile); this.byId.push(tile);
    }
    this.hasSink = this.tiles.some(t => t.type === 'sink');
    if (level.dirtyStart) { const rt = this.tiles.find(t => t.type === 'return'); if (rt) rt.item = { t: 'plate', n: level.dirtyStart, dirty: this.hasSink, c: [] }; }
    this.spawns = spawns;
    // moving sections: tiles that travel together
    this.movers = (level.movers ?? []).map(m => ({ ...m, ids: m.cells.map(([c, r]) => r * this.w + c), off: [0, 0], idx: 0 }));
    this.moverOf = new Map();
    this.movers.forEach((m, k) => m.ids.forEach(id => this.moverOf.set(id, k)));
    this.toggles = level.toggles ?? [];
    this.recipeSet = [...new Set([...(level.recipes ?? []), ...(level.sequence ?? []).flat()])];
    this.seq = level.sequence ? level.sequence.flat() : null;
    this.chefs = [];
    players.forEach((p, i) => this.addChef(p, i));
    this.floor = [];     // items lying on the floor: { x, z, it }
    this.flying = [];    // thrown items: { x, z, y, vx, vz, vy, it, by, dist }
    this.orders = [];
    this.time = 0;       // seconds since the level started (including the ready countdown)
    this.left = level.time ?? 150;
    this.phase = 'ready';
    this.score = 0; this.tips = 0; this.delivered = 0; this.failed = 0;
    this.nextOrder = 0;
    this.returns = [];   // pending plate returns: seconds left
    this.respawns = [];  // lost equipment coming back: { t, tile id }
    this.events = []; this.pending = [];
    this.orderSeq = 0;
    this.layout(0);
  }

  addChef(p, i = this.chefs.length) {
    const slot = p.slot ?? i;
    if (this.chefs.some(c => c.slot === slot)) return;
    const sp = this.spawnOf(slot);
    this.chefs.push({ slot, name: p.name ?? 'Chef', color: p.color ?? slot, skin: p.chef ?? slot, x: sp.x, z: sp.z, vx: 0, vz: 0,
      fx: 0, fz: 1, held: null, dashT: 0, dashCD: 0, work: null, spray: false, walk: 0, dead: 0, last: { g: 0, u: 0, d: 0 } });
    this.chefs.sort((a, b) => a.slot - b.slot);
  }
  spawnOf(slot) { return this.spawns[slot] ?? this.spawns[0] ?? { x: 1.5, z: 1.5 }; }

  // ---- grid helpers ----
  tileAt(c, r) { return c < 0 || r < 0 || c >= this.w || r >= this.h ? null : this.tiles[r * this.w + c]; }
  solid(c, r) { const t = this.tileAt(c, r); return !t || !WALK.has(t.type); }
  idx(c, r) { return r * this.w + c; }
  posOf(t) { return [t.c, t.r]; }

  // ---- moving sections and timed tile switches; a pure function of time, so every phone agrees ----
  layout(time) {
    let changed = false;
    for (const tg of this.toggles) {
      const ph = ((time + (tg.phase ?? 0)) % tg.period + tg.period) % tg.period;
      const on = ph >= tg.period * (1 - tg.duty);
      for (const [c, r] of tg.cells) {
        const t = this.byId[r * this.w + c];
        const type = TILE[on ? tg.b : tg.a] ?? 'floor';
        if (t.type !== type) { t.type = type; changed = true; if (!PLACE.has(type) && t.item && type !== 'stove') { this.loseItem(t.item, t); t.item = null; } }
      }
    }
    for (const m of this.movers) {
      const n = m.path.length, cyc = (m.hold + m.move) * n;
      const ph = ((time % cyc) + cyc) % cyc, k = Math.floor(ph / (m.hold + m.move)), u = ph - k * (m.hold + m.move);
      const a = m.path[k], b = m.path[(k + 1) % n];
      const f = u <= m.hold ? 0 : (u - m.hold) / m.move;
      const logical = f < 0.5 ? a : b;
      m.vis = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      m.vel = u <= m.hold ? [0, 0] : [(b[0] - a[0]) / m.move, (b[1] - a[1]) / m.move];
      if (logical[0] !== m.off[0] || logical[1] !== m.off[1] || !m.placed) { m.off = logical.slice(); m.placed = true; changed = true; }
    }
    if (changed || !this.laid) this.relayout();
    for (const m of this.movers) for (const id of m.ids) { const t = this.byId[id]; t.ox = m.vis[0] - m.off[0]; t.oz = m.vis[1] - m.off[1]; }
    this.laid = true;
  }
  relayout() {
    const grid = new Array(this.w * this.h).fill(null);
    for (const t of this.byId) if (!this.moverOf.has(t.id)) { grid[t.id] = t; t.c = t.id % this.w; t.r = (t.id / this.w) | 0; }
    for (const [k, m] of this.movers.entries()) {
      for (const id of m.ids) {
        const t = this.byId[id], c = id % this.w + m.off[0], r = ((id / this.w) | 0) + m.off[1];
        if (c < 0 || r < 0 || c >= this.w || r >= this.h) continue;
        const under = grid[r * this.w + c];
        if (under && !this.moverOf.has(under.id) && under.item && WALK.has(t.type) === false) { this.loseItem(under.item, under); under.item = null; }
        grid[r * this.w + c] = t; t.c = c; t.r = r;
      }
      // what is revealed where the section used to be
      for (const id of m.ids) {
        if (grid[id] && grid[id].id !== id && this.moverOf.has(grid[id].id)) continue;
        if (grid[id] && grid[id].id === id) continue;
        if (!grid[id]) grid[id] = this.underTile(id, m.under ?? '.');
      }
    }
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = this.underTile(i, '.');
    this.tiles = grid;
  }
  underTile(i, ch) {
    this.unders ??= new Map();
    let t = this.unders.get(i + ch);
    if (!t) { t = { id: -1 - i, ch, type: TILE[ch] ?? 'floor', item: null, fire: 0, c: i % this.w, r: (i / this.w) | 0, ox: 0, oz: 0, under: true }; this.unders.set(i + ch, t); }
    return t;
  }

  // the ground under a point, following moving sections where they are drawn (not where they snap to)
  groundAt(x, z) {
    for (const m of this.movers) {
      const c = Math.floor(x - m.vis[0]), r = Math.floor(z - m.vis[1]);
      if (c < 0 || r < 0 || c >= this.w || r >= this.h) continue;
      const id = r * this.w + c;
      if (this.moverOf.get(id) === this.movers.indexOf(m)) return { t: this.byId[id], m };
    }
    const t = this.tileAt(Math.floor(x), Math.floor(z));
    return { t, m: null };
  }

  // Which station the chef is facing (or null).
  facing(ch) {
    const cc = Math.floor(ch.x), cr = Math.floor(ch.z);
    let best = null, bestScore = Infinity;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const c = cc + dc, r = cr + dr, t = this.tileAt(c, r);
      if (!t || WALK.has(t.type) || t.type === 'void' || t.type === 'wall') continue;
      const dx = c + 0.5 - ch.x, dz = r + 0.5 - ch.z, d = Math.hypot(dx, dz);
      if (d > 1.35) continue;
      const cos = (dx * ch.fx + dz * ch.fz) / d;
      if (cos < 0.5) continue;
      const s = d * (2 - cos);
      if (s < bestScore) { bestScore = s; best = { c, r, t }; }
    }
    return best;
  }

  // ---- movement (run by whoever owns a chef: the host for itself, each client for itself) ----
  move(ch, mx, mz, dash, dt, others = []) {
    this.walkersNow = this.walkers();
    if (ch.dead > 0) {
      ch.dead -= dt;
      if (ch.dead <= 0) { ch.dead = 0; const sp = this.spawnOf(ch.slot); ch.x = sp.x; ch.z = sp.z; ch.vx = ch.vz = 0; this.pending.push({ e: 'respawn', s: ch.slot }); }
      return;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.15) { ch.fx = mx / len; ch.fz = mz / len; }
    if (dash && ch.dashCD <= 0) { ch.dashT = RULES.dashTime; ch.dashCD = RULES.dashCooldown; this.pending.push({ e: 'dash', s: ch.slot }); }
    ch.dashCD = Math.max(0, ch.dashCD - dt);
    let tx, tz;
    if (ch.dashT > 0) { ch.dashT -= dt; tx = ch.fx * RULES.dashSpeed; tz = ch.fz * RULES.dashSpeed; }
    else { const k = Math.min(1, len) * RULES.chefSpeed; tx = len > 0.15 ? ch.fx * k : 0; tz = len > 0.15 ? ch.fz * k : 0; }
    const { t: here, m } = this.groundAt(ch.x, ch.z);
    if (here?.type === 'ice' && ch.dashT <= 0) { const g = Math.min(1, RULES.iceGrip * dt); ch.vx += (tx - ch.vx) * g; ch.vz += (tz - ch.vz) * g; }
    else { ch.vx = tx; ch.vz = tz; }
    // carried by a moving section
    const cx = m ? m.vel[0] : 0, cz = m ? m.vel[1] : 0;
    // sub-step so a dash can't tunnel through counters
    const vx = ch.vx + cx, vz = ch.vz + cz;
    const steps = Math.ceil(Math.hypot(vx, vz) * dt / 0.15) || 1;
    for (let i = 0; i < steps; i++) {
      ch.x += vx * dt / steps; this.collide(ch, others);
      ch.z += vz * dt / steps; this.collide(ch, others);
    }
    if (len > 0.15 || ch.dashT > 0) { ch.walk += dt * (ch.dashT > 0 ? 3 : 1); if (ch.work) ch.work = null; }
    // portals and hazards under the chef's centre
    const t = this.groundAt(ch.x, ch.z).t;
    if (t?.type === 'portal' && ch.portal !== t.id) {
      const pair = { Q: 'q', q: 'Q', Y: 'y', y: 'Y' }[t.portal];
      const dst = this.tiles.find(o => o.portal === pair);
      if (dst) { ch.x = dst.c + 0.5 + ch.fx * 0.1; ch.z = dst.r + 0.5 + ch.fz * 0.1; ch.portal = dst.id; this.pending.push({ e: 'portal', s: ch.slot }); }
    } else if (t?.type !== 'portal') ch.portal = null;
    if (!t || t.type === 'hazard') this.fall(ch);
  }
  fall(ch) {
    if (ch.dead > 0) return;
    ch.dead = RULES.respawn; ch.dashT = 0; ch.work = null;
    this.pending.push({ e: 'fall', s: ch.slot });
  }
  collide(ch, others) {
    const R = RULES.chefRadius;
    const c0 = Math.floor(ch.x - R), c1 = Math.floor(ch.x + R), r0 = Math.floor(ch.z - R), r1 = Math.floor(ch.z + R);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!this.solid(c, r)) continue;
      const nx = Math.max(c, Math.min(ch.x, c + 1)), nz = Math.max(r, Math.min(ch.z, r + 1));
      let dx = ch.x - nx, dz = ch.z - nz; const d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (d < 1e-6) { // centre inside the tile: push out along the shortest axis
        const opts = [[c - R - ch.x, 0], [c + 1 + R - ch.x, 0], [0, r - R - ch.z], [0, r + 1 + R - ch.z]];
        opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        ch.x += opts[0][0]; ch.z += opts[0][1]; continue;
      }
      ch.x = nx + dx / d * R; ch.z = nz + dz / d * R;
    }
    for (const o of others) {
      if (o === ch || o.dead > 0) continue;
      const dx = ch.x - o.x, dz = ch.z - o.z, d = Math.hypot(dx, dz), m = R * 2;
      if (d < m && d > 1e-6) { ch.x = o.x + dx / d * m; ch.z = o.z + dz / d * m; }
    }
    // pedestrians can't be pushed
    for (const o of this.walkersNow ?? []) {
      const dx = ch.x - o.x, dz = ch.z - o.z, d = Math.hypot(dx, dz), m = R + 0.3;
      if (d < m) { const k = d > 1e-6 ? 1 / d : 0; ch.x = o.x + (k ? dx * k : 1) * m; ch.z = o.z + (k ? dz * k : 0) * m; }
    }
  }

  // pedestrians and other walkers: positions are a pure function of time (ping-pong along a line)
  walkers(time = this.time) {
    return (this.level.walkers ?? []).map(w => {
      const u = ((time + (w.phase ?? 0)) / w.period) % 1, f = u < 0.5 ? u * 2 : 2 - u * 2;
      const x = w.from[0] + (w.to[0] - w.from[0]) * f, z = w.from[1] + (w.to[1] - w.from[1]) * f;
      return { x, z, fx: Math.sign(w.to[0] - w.from[0]) * (u < 0.5 ? 1 : -1), fz: Math.sign(w.to[1] - w.from[1]) * (u < 0.5 ? 1 : -1), look: w.look ?? 0, walk: time };
    });
  }

  // ---- one simulation tick. inputs[slot] = { g, u, d (press counters), uh (use held), x, z, fx, fz, dead } ----
  step(dt, inputs = {}) {
    this.events = this.pending; this.pending = [];
    this.time += dt;
    this.layout(this.time);
    if (this.phase === 'ready') {
      if (this.time >= RULES.readyTime) { this.phase = 'play'; this.events.push({ e: 'go' }); this.addOrder(); this.nextOrder = 3; }
    } else if (this.phase === 'play') {
      if (!this.level.clockAfterServe || this.delivered) this.left -= dt;
      if (this.left <= 0) { this.left = 0; this.phase = 'over'; this.events.push({ e: 'timeup' }); }
    }
    const playing = this.phase !== 'over';
    for (const ch of this.chefs) {
      const inp = inputs[ch.slot];
      if (inp?.x !== undefined) {
        ch.x = inp.x; ch.z = inp.z; ch.fx = inp.fx; ch.fz = inp.fz; ch.dead = inp.dead ?? 0;
        if (inp.mv) { ch.walk = inp.walk ?? ch.walk; if (ch.work) ch.work = null; }
        ch.dashT = inp.dt ?? ch.dashT;
      }
      // a chef who fell in loses what they were holding
      if (ch.dead > 0) { if (ch.held) { this.loseItem(ch.held); ch.held = null; } ch.work = null; ch.spray = false; if (inp) ch.last = { g: inp.g, u: inp.u, d: inp.d }; continue; }
      if (!inp) continue;
      if (!playing || this.phase === 'ready') { ch.last = { g: inp.g, u: inp.u, d: inp.d }; ch.spray = false; continue; }
      const grab = inp.g !== ch.last.g, use = inp.u !== ch.last.u;
      ch.last = { g: inp.g, u: inp.u, d: inp.d };
      if (grab) this.grab(ch);
      if (use) this.use(ch);
      ch.spray = !!(inp.uh && ch.held?.t === 'ext');
    }
    if (this.phase === 'play') this.tickWorld(dt);
    return this.events;
  }

  tickWorld(dt) {
    // orders
    this.nextOrder -= dt;
    if ((this.nextOrder <= 0 && this.orders.length < RULES.ordersMax) || this.orders.length === 0) this.addOrder();
    for (const o of this.orders) o.left -= dt;
    for (const o of this.orders.filter(o => o.left <= 0)) {
      this.orders.splice(this.orders.indexOf(o), 1);
      this.failed++; this.score -= RULES.orderPenalty;
      this.events.push({ e: 'expired', id: o.id });
    }
    if (this.seq && this.seqDone && !this.orders.length) { this.phase = 'over'; this.events.push({ e: 'timeup' }); }
    // chopping / washing
    for (const ch of this.chefs) {
      if (!ch.work) continue;
      const f = this.facing(ch);
      if (!f || f.c !== ch.work.c || f.r !== ch.work.r || ch.held) { ch.work = null; continue; }
      const t = f.t;
      if (ch.work.kind === 'chop') {
        const it = t.item;
        if (!it || it.t !== 'ing' || it.s !== 'raw' || t.fire) { ch.work = null; continue; }
        it.ch = Math.min(1, (it.ch ?? 0) + dt / (RULES.chopTime * (this.chefs.length === 1 ? RULES.chopSoloFactor : 1)));
        if (it.ch >= 1) { it.s = 'chopped'; it.ch = 1; ch.work = null; this.events.push({ e: 'chopped', c: f.c, r: f.r }); }
      } else if (ch.work.kind === 'wash') {
        if (!t.dirty || t.fire) { ch.work = null; continue; }
        t.wash += dt / RULES.washTime;
        if (t.wash >= 1) {
          t.wash = 0; t.dirty--;
          this.addToRack(t);
          this.events.push({ e: 'washed', c: f.c, r: f.r });
          if (!t.dirty) ch.work = null;
        }
      }
    }
    // heat: vessels on stoves and fryers, pizzas in ovens
    for (const t of this.tiles) {
      if (t.fire) continue;
      const it = t.item; if (!it) continue;
      if ((t.type === 'stove' && (it.t === 'pot' || it.t === 'pan')) || (t.type === 'fryer' && it.t === 'basket')) this.cook(it, t, COOK[it.t], this.vesselFull(it), dt);
      else if (t.type === 'oven' && it.t === 'ing' && it.k === 'dough' && (it.s === 'chopped' || it.s === 'cooked')) this.cook(it, t, COOK.oven, true, dt);
    }
    // conveyor belts carry items along
    for (const t of this.tiles) {
      if (t.type !== 'belt' || !t.item) { if (t.type === 'belt') t.belt = 0; continue; }
      t.belt = (t.belt ?? 0) + dt / RULES.beltStep;
      if (t.belt < 1) continue;
      const n = this.tileAt(t.c + t.dir[0], t.r + t.dir[1]);
      if (n?.type === 'bin') { this.loseItem(t.item, t); t.item = null; t.belt = 0; this.events.push({ e: 'trash' }); }
      else if (n && !n.item && (n.type === 'belt' || n.type === 'counter')) { n.item = t.item; n.belt = 0; t.item = null; t.belt = 0; n.moved = true; }
      else t.belt = 1;
    }
    for (const t of this.tiles) if (t.moved) t.moved = false;
    // fire: spreads to neighbouring stations, put out by extinguishers
    for (const ch of this.chefs) if (ch.spray) this.sprayFrom(ch, dt);
    for (const t of this.tiles) {
      if (!t.fire) continue;
      t.spread = (t.spread ?? 0) + dt;
      if (t.spread >= RULES.fireSpread) {
        t.spread = 0;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => this.tileAt(t.c + dc, t.r + dr)).filter(n =>
          n && !WALK.has(n.type) && n.type !== 'void' && n.type !== 'wall' && !n.fire);
        if (nb.length) this.ignite(nb[Math.floor(Math.random() * nb.length)]);
      }
    }
    // plates coming back, lost equipment respawning
    for (let k = this.returns.length - 1; k >= 0; k--) {
      this.returns[k] -= dt;
      if (this.returns[k] <= 0) { this.returns.splice(k, 1); this.returnPlate(); }
    }
    for (let k = this.respawns.length - 1; k >= 0; k--) {
      const r = this.respawns[k]; r.t -= dt;
      if (r.t > 0) continue;
      const home = this.byId[r.id];
      const spot = !home.item && PLACE.has(home.type) || (!home.item && home.type === 'stove' && r.it.t !== 'ext') || (!home.item && home.type === 'fryer') ? home
        : this.tiles.find(t => !t.item && t.type === 'counter');
      if (spot) { spot.item = r.it; this.respawns.splice(k, 1); this.events.push({ e: 'plate' }); }
    }
    // thrown items
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const f = this.flying[k];
      const ox = f.x, oz = f.z;
      f.x += f.vx * dt; f.z += f.vz * dt; f.dist += Math.hypot(f.vx, f.vz) * dt;
      f.vy -= 9 * dt; f.y = Math.max(0, f.y + f.vy * dt);
      const catcher = this.chefs.find(ch => ch.slot !== f.by && !ch.held && !ch.dead && Math.hypot(ch.x - f.x, ch.z - f.z) < RULES.catchRadius);
      if (catcher) { catcher.held = f.it; this.flying.splice(k, 1); this.events.push({ e: 'catch', s: catcher.slot }); continue; }
      const c = Math.floor(f.x), r = Math.floor(f.z);
      const t = this.tileAt(c, r);
      if (this.solid(c, r)) {
        this.flying.splice(k, 1);
        if (t && this.land(t, f.it)) this.events.push({ e: 'land', c, r });
        else this.floor.push({ x: Math.max(Math.floor(ox) + 0.2, Math.min(Math.floor(ox) + 0.8, ox)), z: Math.max(Math.floor(oz) + 0.2, Math.min(Math.floor(oz) + 0.8, oz)), it: f.it });
        continue;
      }
      if (f.y <= 0 && f.dist > 0.5) {
        this.flying.splice(k, 1);
        if (t?.type === 'hazard') this.events.push({ e: 'splash' });
        else { this.floor.push({ x: f.x, z: f.z, it: f.it }); this.events.push({ e: 'land' }); }
      }
    }
    // items on the floor of a hazard (e.g. a bridge that just sank) are lost
    for (let k = this.floor.length - 1; k >= 0; k--) {
      const fl = this.floor[k], t = this.tileAt(Math.floor(fl.x), Math.floor(fl.z));
      if (!t || t.type === 'hazard' || t.type === 'void') { this.loseItem(fl.it); this.floor.splice(k, 1); }
    }
  }

  cook(it, t, spec, full, dt) {
    if (it.burnt || it.s === 'burnt') return;
    if (it.t !== 'ing' && !it.c.length) return;
    if ((it.wait ?? 0) < spec.delay) { it.wait = (it.wait ?? 0) + dt; return; }
    it.ck = it.ck ?? 0; it.ov = it.ov ?? 0;
    if (it.ck < spec.time) {
      it.ck = Math.min(spec.time, it.ck + dt);
      if (it.ck >= spec.time && full) { if (it.t === 'ing') it.s = 'cooked'; this.events.push({ e: 'cooked', c: t.c, r: t.r }); }
    } else if (full) {
      if (it.t === 'ing') it.s = 'cooked';
      it.ov += dt;
      if (it.ov >= RULES.burnTime) {
        if (it.t === 'ing') it.s = 'burnt'; else it.burnt = true;
        this.ignite(t); this.events.push({ e: 'burnt', c: t.c, r: t.r });
      }
    }
  }

  // something is lost (fell in water, binned by a belt, held by a chef who fell): equipment respawns
  loseItem(it, from) {
    if (!it) return;
    if (it.t === 'plate') { for (let i = 0; i < (it.n ?? 1); i++) this.returns.push(RULES.itemRespawn); return; }
    if (it.t === 'pot' || it.t === 'pan' || it.t === 'basket' || it.t === 'ext') {
      const home = this.byId.find(t => t.home?.t === it.t && !this.respawns.some(r => r.id === t.id) && t.item !== it) ?? from;
      const fresh = it.t === 'ext' ? { t: 'ext' } : newVessel(it.t);
      if (home) this.respawns.push({ t: RULES.itemRespawn, id: home.id >= 0 ? home.id : 0, it: fresh });
    }
  }

  // a thrown item hits a station: accept it if it fits there
  land(t, it) {
    if (t.fire || t.type === 'void' || t.type === 'wall') return false;
    if (t.type === 'bin') { this.events.push({ e: 'trash' }); return true; }
    const y = t.item;
    if (y && this.isVessel(y) && this.vesselAccepts(y, it)) { this.vesselAdd(y, it); return true; }
    if (y?.t === 'plate' && this.plateAccepts(y, this.tokenOf(it))) { this.plateAdd(y, this.tokenOf(it)); return true; }
    if (y && this.baseAccepts(y, it)) { this.baseAdd(y, it); return true; }
    if (!y && PLACE.has(t.type)) { t.item = it; return true; }
    return false;
  }

  ignite(t) { if (!t.fire) { t.fire = RULES.fireHP; t.spread = 0; this.events.push({ e: 'fire', c: t.c, r: t.r }); } }
  sprayFrom(ch, dt) {
    for (const t of this.tiles) {
      if (!t.fire) continue;
      const dx = t.c + 0.5 - ch.x, dz = t.r + 0.5 - ch.z, d = Math.hypot(dx, dz);
      if (d > RULES.extinguishRange + 0.5) continue;
      if ((dx * ch.fx + dz * ch.fz) / (d || 1) < 0.6) continue;
      t.fire -= dt;
      if (t.fire <= 0) { t.fire = 0; this.events.push({ e: 'out', c: t.c, r: t.r }); }
    }
  }

  addToRack(sink) {
    // the drying rack next to the sink (any rack if none is adjacent)
    let rack = null;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = this.tileAt(sink.c + dc, sink.r + dr); if (t?.type === 'rack') rack = t; }
    if (!rack) rack = this.tiles.find(t => t.type === 'rack');
    if (!rack) rack = sink;
    if (rack.item?.t === 'plate' && !rack.item.dirty && !rack.item.c.length) rack.item.n++;
    else if (!rack.item) rack.item = { t: 'plate', n: 1, dirty: false, c: [] };
  }
  returnPlate() {
    const t = this.tiles.find(t => t.type === 'return');
    const dirty = this.hasSink;
    if (!t) return;
    if (t.item?.t === 'plate' && t.item.dirty === dirty && !t.item.c.length) t.item.n++;
    else if (!t.item) t.item = { t: 'plate', n: 1, dirty, c: [] };
    else { this.returns.push(1); return; }
    this.events.push({ e: 'plate' });
  }

  addOrder() {
    let k;
    if (this.seq) {
      this.seqIdx = this.seqIdx ?? 0;
      if (this.seqIdx >= this.seq.length) { this.seqDone = true; this.nextOrder = 9999; return; }
      k = this.seq[this.seqIdx++];
    } else {
      const list = this.level.recipes;
      k = list[Math.floor(Math.random() * list.length)];
    }
    const total = this.level.orderTime ?? (this.chefs.length === 1 ? RULES.orderTimeSolo : RULES.orderTime);
    this.orders.push({ id: ++this.orderSeq, r: k, left: total, total });
    this.nextOrder = this.level.orderEvery ?? RULES.orderEvery;
    this.events.push({ e: 'order' });
  }

  // ---- item rules ----
  isVessel(it) { return it?.t === 'pot' || it?.t === 'pan' || it?.t === 'basket'; }
  vesselAccepts(v, it) {
    if (!this.isVessel(v) || v.burnt || it?.t !== 'ing') return false;
    const d = INGREDIENTS[it.k]; if (!d) return false;
    if (v.t === 'pot') {
      if (it.k === 'rice') return it.s === 'raw' && !v.c.length;
      return SOUP_INGS.includes(it.k) && it.s === 'chopped' && v.c.length < POT_CAPACITY && !v.c.includes('rice');
    }
    return d.cook === v.t && it.s === 'chopped' && !v.c.length;
  }
  vesselAdd(v, it) {
    v.c.push(it.k); const n = v.c.length;
    if (n === 1) v.wait = 0; else v.ck *= ((n - 1) / n) ** 2;   // a new ingredient knocks the progress back
    this.events.push({ e: 'plop' });
  }
  vesselFull(v) { return v.t === 'pot' ? (v.c[0] === 'rice' ? v.c.length === 1 : v.c.length === POT_CAPACITY) : v.c.length === 1; }
  vesselReady(v) { return this.isVessel(v) && !v.burnt && v.c.length && this.vesselFull(v) && v.ck >= COOK[v.t].time; }
  vesselToken(v) {
    if (v.t === 'pot') { if (v.c[0] === 'rice') return 'rice'; return 'soup:' + (v.c.every(c => c === v.c[0]) ? v.c[0] : 'mixed'); }
    if (v.t === 'basket') return v.c[0] === 'potato' ? 'chips' : 'fish';
    return v.c[0];   // pan: meat / chicken
  }
  // what an ingredient item becomes on a plate (null = can't go on a plate as it is)
  tokenOf(it) {
    if (it?.t !== 'ing') return null;
    const d = INGREDIENTS[it.k];
    if (it.k === 'dough') return it.s === 'cooked' ? 'pizza:' + [...(it.top ?? [])].sort().join('+') : null;
    if (d?.plate === 'raw' && it.s === 'raw') return it.k;
    if (d?.plate === 'chopped' && it.s === 'chopped') return it.k;
    return null;
  }
  // a plate takes a token if the result still fits some recipe of this kitchen
  plateAccepts(pl, token) {
    if (!token || pl?.t !== 'plate' || pl.dirty || pl.n !== 1) return false;
    const want = [...pl.c, token];
    return this.recipeSet.some(r => { const need = [...RECIPES[r].plate]; return want.every(x => { const i = need.indexOf(x); if (i < 0) return false; need.splice(i, 1); return true; }); });
  }
  plateAdd(pl, token) { pl.c.push(token); pl.c.sort(); this.events.push({ e: 'drop' }); }
  // pizza toppings stack on flattened dough
  baseAccepts(b, it) {
    if (b?.t !== 'ing' || b.k !== 'dough' || b.s !== 'chopped' || it?.t !== 'ing' || it.s !== 'chopped' || !INGREDIENTS[it.k]?.top) return false;
    const top = [...(b.top ?? []), it.k].sort();
    return this.recipeSet.some(r => { const p = RECIPES[r].plate[0]; if (!p.startsWith('pizza:')) return false; const need = p.slice(6).split('+'); return top.every(x => need.includes(x)) && new Set(top).size === top.length; });
  }
  baseAdd(b, it) { b.top = [...(b.top ?? []), it.k].sort(); this.events.push({ e: 'drop' }); }
  emptyPlate(it) { return it?.t === 'plate' && it.n === 1 && !it.dirty && !it.c.length; }

  // the "pick up / put down" button
  grab(ch) {
    const f = this.facing(ch);
    const held = ch.held;
    if (f?.t.fire) return;
    if (!held) {
      if (f) {
        const t = f.t;
        if (t.item) {
          const it = t.item;
          if (it.t === 'plate' && it.n > 1 && !it.dirty) { it.n--; ch.held = { t: 'plate', n: 1, dirty: false, c: [] }; }
          else { ch.held = it; t.item = null; t.belt = 0; }
          this.events.push({ e: 'pick', s: ch.slot });
          return;
        }
        if (t.type === 'crate') { ch.held = { t: 'ing', k: t.crate, s: 'raw', ch: 0 }; this.events.push({ e: 'pick', s: ch.slot }); return; }
      }
      // something on the floor nearby?
      let best = null, bd = 0.9;
      for (const fl of this.floor) { const d = Math.hypot(fl.x - (ch.x + ch.fx * 0.4), fl.z - (ch.z + ch.fz * 0.4)); if (d < bd) { bd = d; best = fl; } }
      if (best) { this.floor.splice(this.floor.indexOf(best), 1); ch.held = best.it; this.events.push({ e: 'pick', s: ch.slot }); }
      return;
    }
    if (!f) { // put it down on the floor in front
      const x = ch.x + ch.fx * 0.45, z = ch.z + ch.fz * 0.45, ft = this.tileAt(Math.floor(x), Math.floor(z));
      if (ft && WALK.has(ft.type)) {
        if (ft.type === 'hazard') { this.loseItem(held); this.events.push({ e: 'splash' }); }
        else this.floor.push({ x, z, it: held });
        ch.held = null; this.events.push({ e: 'drop', s: ch.slot });
      }
      return;
    }
    const t = f.t;
    if (this.combine(ch, t)) return;
    if (t.item) return;
    // place the held item on an empty station
    switch (t.type) {
      case 'counter': case 'board': case 'crate': case 'rack': case 'belt':
        if (t.type === 'rack' && !(held.t === 'plate' && !held.dirty)) return;
        t.item = held; ch.held = null; t.belt = 0; this.events.push({ e: 'drop', s: ch.slot }); return;
      case 'stove':
        if (held.t === 'pot' || held.t === 'pan') { t.item = held; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); }
        return;
      case 'fryer':
        if (held.t === 'basket') { t.item = held; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); }
        return;
      case 'oven':
        if (held.t === 'ing' && held.k === 'dough' && held.s !== 'raw') { t.item = held; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); }
        return;
      case 'sink':
        if (held.t === 'plate' && held.dirty) { t.dirty += held.n; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); }
        return;
    }
  }

  // held item + whatever is on the station; true if something happened
  combine(ch, t) {
    const held = ch.held, it = t.item;
    if (t.type === 'bin') { this.trash(ch); return true; }
    if (t.type === 'pass') { this.serve(ch); return true; }
    if (t.type === 'sink') {
      if (held.t === 'plate' && held.dirty) { t.dirty += held.n; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); }
      return true;
    }
    if (!it) return false;
    const ok = () => true;
    // ingredient into a vessel (either way round)
    if (this.vesselAccepts(it, held)) { this.vesselAdd(it, held); ch.held = null; return ok(); }
    if (this.vesselAccepts(held, it)) { this.vesselAdd(held, it); t.item = null; return ok(); }
    // a finished vessel onto a plate (either way round)
    if (held.t === 'plate' && this.vesselReady(it) && this.plateAccepts(held, this.vesselToken(it))) { this.pour(it, held); return ok(); }
    if (it.t === 'plate' && this.vesselReady(held) && this.plateAccepts(it, this.vesselToken(held))) { this.pour(held, it); return ok(); }
    // a soup can be poured from one pot into another empty one
    // plates and plate stacks
    if (held.t === 'plate' && it.t === 'plate' && held.dirty === it.dirty && !held.c.length && !it.c.length) {
      it.n += held.n; ch.held = null; this.events.push({ e: 'drop', s: ch.slot }); return ok();
    }
    // ingredients onto plates (either way round)
    if (held.t === 'plate' && this.plateAccepts(held, this.tokenOf(it))) { this.plateAdd(held, this.tokenOf(it)); t.item = null; return ok(); }
    if (it.t === 'plate' && this.plateAccepts(it, this.tokenOf(held))) { this.plateAdd(it, this.tokenOf(held)); ch.held = null; return ok(); }
    // pizza toppings onto the dough (either way round)
    if (this.baseAccepts(it, held)) { this.baseAdd(it, held); ch.held = null; return ok(); }
    if (this.baseAccepts(held, it)) { this.baseAdd(held, it); t.item = null; return ok(); }
    return false;
  }
  pour(v, plate) {
    this.plateAdd(plate, this.vesselToken(v));
    v.c = []; v.ck = 0; v.ov = 0; v.wait = 0;
    this.events.push({ e: 'pour' });
  }
  trash(ch) {
    const h = ch.held;
    if (h.t === 'ing') ch.held = null;
    else if (this.isVessel(h)) { h.c = []; h.ck = 0; h.ov = 0; h.wait = 0; h.burnt = false; }
    else if (h.t === 'plate' && h.c.length) h.c = [];
    else return;
    this.events.push({ e: 'trash' });
  }
  serve(ch) {
    const h = ch.held;
    if (h?.t !== 'plate' || h.dirty || !h.c.length || h.n !== 1) return;
    const key = h.c.slice().sort().join('|');
    const ord = this.orders.find(o => RECIPES[o.r].plate.slice().sort().join('|') === key);
    if (!ord) { this.events.push({ e: 'wrong' }); return; }
    ch.held = null;
    this.returns.push(RULES.plateReturn);
    const f = ord.left / ord.total, tip = f > 2 / 3 ? RULES.tips[0] : f > 1 / 3 ? RULES.tips[1] : RULES.tips[2];
    this.score += RULES.points + tip; this.tips += tip; this.delivered++;
    this.orders.splice(this.orders.indexOf(ord), 1);
    if (this.orders.length < 1 && !this.seqDone) this.nextOrder = Math.min(this.nextOrder, 2);
    this.events.push({ e: 'served', id: ord.id, pts: RULES.points, tip });
  }

  // the "chop / use / throw" button
  use(ch) {
    const held = ch.held;
    if (held) {
      if (held.t === 'ing') this.throwItem(ch);
      return;
    }
    const f = this.facing(ch);
    if (!f || f.t.fire) return;
    const t = f.t;
    if (t.type === 'board' && t.item?.t === 'ing' && t.item.s === 'raw' && INGREDIENTS[t.item.k]?.chop) { ch.work = { kind: 'chop', c: f.c, r: f.r }; this.events.push({ e: 'chop', s: ch.slot }); }
    else if (t.type === 'sink' && t.dirty) ch.work = { kind: 'wash', c: f.c, r: f.r };
  }
  throwItem(ch) {
    const it = ch.held; ch.held = null;
    this.flying.push({ x: ch.x + ch.fx * 0.4, z: ch.z + ch.fz * 0.4, y: 0.9, vx: ch.fx * RULES.throwSpeed, vz: ch.fz * RULES.throwSpeed, vy: 1.6, it, by: ch.slot, dist: 0 });
    this.events.push({ e: 'throw', s: ch.slot });
  }

  starThresholds() {
    const st = this.level.stars ?? [40, 80, 120];
    return Array.isArray(st) ? st : st[Math.min(4, Math.max(1, this.chefs.length))];
  }
  stars() {
    if (this.seq) return this.seqDone && !this.orders.length ? 3 : 0;   // The Peckening: finish it for 3 stars
    return this.starThresholds().filter(x => this.score >= x).length;
  }

  // ---- network snapshot ----
  snapshot() {
    const tiles = [];
    for (const t of this.byId) if (t.item || t.fire || t.dirty || t.wash) tiles.push([t.id, t.item, +t.fire.toFixed(2), t.dirty ?? 0, +(t.wash ?? 0).toFixed(2)]);
    const r2 = v => Math.round(v * 100) / 100;
    return {
      time: r2(this.time), left: r2(this.left), phase: this.phase, score: this.score, tips: this.tips, delivered: this.delivered, failed: this.failed,
      orders: this.orders.map(o => ({ ...o, left: r2(o.left) })),
      chefs: this.chefs.map(c => ({ slot: c.slot, name: c.name, color: c.color, skin: c.skin, x: r2(c.x), z: r2(c.z), fx: r2(c.fx), fz: r2(c.fz), held: c.held, dashT: r2(c.dashT), work: c.work, spray: c.spray, walk: r2(c.walk), dead: r2(c.dead) })),
      tiles, floor: this.floor.map(f => ({ x: r2(f.x), z: r2(f.z), it: f.it })),
      flying: this.flying.map(f => ({ x: r2(f.x), z: r2(f.z), y: r2(f.y), it: f.it })),
    };
  }
  // client side: overwrite the visible state from a snapshot (own chef position is kept by the caller)
  applySnapshot(s) {
    Object.assign(this, { time: s.time, left: s.left, phase: s.phase, score: s.score, tips: s.tips, delivered: s.delivered, failed: s.failed, orders: s.orders, floor: s.floor, flying: s.flying });
    this.layout(this.time);
    for (const t of this.byId) { t.item = null; t.fire = 0; if (t.type === 'sink') { t.dirty = 0; t.wash = 0; } }
    for (const [id, item, fire, dirty, wash] of s.tiles) { const t = this.byId[id]; if (!t) continue; t.item = item; t.fire = fire; if (t.dirty !== undefined) { t.dirty = dirty; t.wash = wash; } }
  }
}
