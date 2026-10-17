// Draws a Kitchen with three.js: static stations once, then items, chefs, fire and bars every frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COUNTER_H, makePedestrian, makeChef, itemMesh, itemKey, stationMesh, makeBar, textSprite, mat, basic } from './models.js';
import { RULES, COOK } from '../game/rules.js';
import { icon } from '../ui/hud.js';

// colours per world (0 = intro, 7 = The Peckening)
const BASE = { env: 'restaurant', sky: '#1d2b3a', ground: '#6a6470', floorA: '#f1efe6', floorB: '#8fb3ad', iceA: '#eef8ff', iceB: '#bfe3f5', hazard: '#3a8fd0', wall: '#b8604a', trim: '#7a3a2a' };
const THEMES = {
  0: { ...BASE, env: 'ruins', ground: '#4a3528', hazard: '#ff6a1a', floorB: '#b9a58a', wall: '#7a6a5a', trim: '#4a3a2a' },
  1: BASE,
  2: { ...BASE, env: 'street', ground: '#5a6068', hazard: '#3b3f46', floorB: '#c9b28a', wall: '#8a8f96', trim: '#5a5f66' },
  3: { ...BASE, env: 'ice', sky: '#9fc7e0', ground: '#e8f3fa', hazard: '#2c6fa8', floorA: '#f4f9fc', floorB: '#bcd7e6', wall: '#a8c4d6', trim: '#7898ac' },
  4: { ...BASE, env: 'lava', sky: '#1a0f0c', ground: '#2a1a14', hazard: '#ff5a1a', floorA: '#6a5a50', floorB: '#4a3d36', wall: '#5a4038', trim: '#3a2620' },
  5: { ...BASE, env: 'space', sky: '#0a0c1e', ground: '#101428', hazard: '#05060f', floorA: '#d6dbe8', floorB: '#7a86a8', wall: '#4a5070', trim: '#2a3050' },
  6: { ...BASE, ground: '#6a6470', floorB: '#d0a87a', wall: '#c08050', trim: '#8a5030' },
  7: { ...BASE, env: 'lava', sky: '#1a0f0c', ground: '#3a2014', hazard: '#ff5a1a', floorB: '#a08a70', wall: '#6a4a3a', trim: '#4a2a1a' },
};

// a chef's head-and-shoulders portrait as an image (for the lobby and level card)
const portraits = new Map();
let pr = null;
export function chefPortrait(skin, color, size = 128) {
  const key = skin + ':' + color + ':' + size;
  if (portraits.has(key)) return portraits.get(key);
  if (!pr) {
    const cv = document.createElement('canvas');
    pr = { r: new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }), scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, 0.1, 20) };
    pr.r.outputColorSpace = THREE.SRGBColorSpace;
    pr.scene.add(new THREE.HemisphereLight('#fff6e8', '#5a6a80', 2.2));
    const l = new THREE.DirectionalLight('#fff', 1.6); l.position.set(1, 2, 3); pr.scene.add(l);
    pr.cam.position.set(0, 1.05, 2.3); pr.cam.lookAt(0, 0.8, 0);
  }
  pr.r.setSize(size, size, false);
  const chef = makeChef(color, skin); chef.rotation.y = 0.25; pr.scene.add(chef);
  pr.r.render(pr.scene, pr.cam);
  const url = pr.r.domElement.toDataURL();
  pr.scene.remove(chef);
  portraits.set(key, url);
  return url;
}

const bubbleCache = new Map();
function bubbleTex(k) {
  const key = k ?? '+';
  if (!bubbleCache.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    x.fillStyle = k ? '#fff' : '#ffffff88'; x.beginPath(); x.arc(48, 48, 44, 0, Math.PI * 2); x.fill(); x.lineWidth = 5; x.strokeStyle = '#9aa'; x.stroke();
    if (k) { const img = new Image(); img.src = icon(k, 64); img.onload = () => { x.drawImage(img, 16, 16, 64, 64); t.needsUpdate = true; }; }
    else { x.strokeStyle = '#9aa'; x.lineWidth = 8; x.beginPath(); x.moveTo(48, 26); x.lineTo(48, 70); x.moveTo(26, 48); x.lineTo(70, 48); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; bubbleCache.set(key, t);
  }
  return bubbleCache.get(key);
}

// per-level surroundings that override the world colours
const ENVS = {
  restaurant: {},
  teal: { floorA: '#f4b860', floorB: '#e7a048', top: '#62c6b8', front: '#3a8f88' },
  street: { ground: '#5c5f66', hazard: '#5c5f66', floorA: '#666970', floorB: '#62656c' },
  truck: { sky: '#e88a3a', ground: '#5c5f66', hazard: '#5c5f66', floorA: '#a8957a', floorB: '#9a8870', top: '#7ab8b0', front: '#4a7f88', truck: '#8fb4c8' },
  ship: { ground: '#b97a42', floorA: '#d9a062', floorB: '#cc9152', top: '#9fae9a', front: '#6f7f6c', sky: '#3a8aa0', hazard: '#2a7a8a' },
  floe: { sky: '#0b1430', ground: '#123060', hazard: '#123a6a', floorA: '#e6f4fc', floorB: '#c4e2f2', iceA: '#e6f4fc', iceB: '#c4e2f2', top: '#b8c8d4', front: '#7890a4' },
  iceroad: { sky: '#9fc7e0', ground: '#7a8aa8', hazard: '#6a7a98', floorA: '#8a8f98', floorB: '#80858e', top: '#c8d8e8', front: '#6a86b0', truck: '#7aa0d8' },
  snow: { sky: '#cfe2ee', ground: '#eef4f8', hazard: '#2f74b0', floorA: '#e8f4fb', floorB: '#cde6f3', iceA: '#e8f4fb', iceB: '#cde6f3', top: '#9aa6ae', front: '#6a767e' },
  haunted: { sky: '#101018', ground: '#1c1c26', hazard: '#0c0c12', floorA: '#7a2a2a', floorB: '#6a2222', top: '#b0703f', front: '#6e4026', wall: '#4a5064', trim: '#30364a' },
  space: { sky: '#03040c', ground: '#05060f', hazard: '#05060f', floorA: '#3e434e', floorB: '#333842', top: '#dde2e8', front: '#8c949e', wall: '#9aa0aa', trim: '#6a707a' },
  lava: { sky: '#2a0c04', ground: '#ff6a1a', hazard: '#ff6a1a', floorA: '#c8643a', floorB: '#b55a32', top: '#e8a070', front: '#9a5030', wall: '#7a3a22', trim: '#4a2010' },
  ruins: { sky: '#2a1410', ground: '#4a3528', hazard: '#ff6a1a', floorA: '#b9a58a', floorB: '#a89478', wall: '#7a6a5a', trim: '#4a3a2a' },
};
// which setting each kitchen is in (from the reference frames)
const LEVEL_ENV = {
  intro: 'ruins', '1-1': 'restaurant', '1-2': 'street', '1-3': 'ship', '1-4': 'teal', '1-5': 'restaurant', '1-6': 'teal',
  '2-1': 'truck', '2-2': 'restaurant', '2-3': 'teal', '2-4': 'teal',
  '3-1': 'floe', '3-2': 'ship', '3-3': 'iceroad', '3-4': 'snow',
  '4-1': 'haunted', '4-2': 'haunted', '4-3': 'haunted', '4-4': 'haunted',
  '5-1': 'space', '5-2': 'lava', '5-3': 'space', '5-4': 'lava', '5-5': 'space', '5-6': 'space',
  '6-1': 'ship', '6-2': 'restaurant', '6-3': 'snow', '6-4': 'space', peck: 'lava',
};

// a still picture of a kitchen for the level card (rendered once per level, off screen)
const thumbs = new Map();
let thumbView = null;
export function kitchenThumb(level, Kitchen) {
  if (thumbs.has(level.id)) return thumbs.get(level.id);
  if (!thumbView) { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 240; Object.assign(cv.style, { width: '400px', height: '240px' }); thumbView = new View(cv, { thumb: true }); }
  const k = new Kitchen(level, []);
  thumbView.build(k); thumbView.draw(k, 0);
  const url = thumbView.renderer.domElement.toDataURL('image/jpeg', 0.8);
  thumbs.set(level.id, url);
  return url;
}

export class View {
  constructor(canvas, opts = {}) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!opts.thumb });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1d2b3a');
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const hemi = new THREE.HemisphereLight('#fff6e8', '#5a6a80', 1.6); this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight('#ffffff', 1.9);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0015;
    this.scene.add(sun, sun.target);
    this.root = null;
  }

  build(k) {
    if (this.root) this.scene.remove(this.root);
    const root = this.root = new THREE.Group(); this.scene.add(root);
    this.k = k;
    const w = k.w, h = k.h;
    const envName = k.level.env ?? LEVEL_ENV[k.level.id] ?? THEMES[k.level.world]?.env ?? 'restaurant';
    const th = this.theme = { ...BASE, ...(ENVS[envName] ?? {}), ...(k.level.theme ?? {}), env: envName };
    this.scene.background = new THREE.Color(th.sky);
    // tiles that change: moving sections and timed switches are drawn separately from the baked scenery
    const moving = new Set(k.movers.flatMap(m => m.ids));
    const toggled = new Set((k.level.toggles ?? []).flatMap(tg => tg.cells.map(([c, r]) => r * w + c)));
    this.toggled = toggled;
    // ground around the kitchen
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, h + 60), mat(th.ground));
    ground.rotation.x = -Math.PI / 2; ground.position.set(w / 2, -0.03, h / 2); ground.receiveShadow = true; root.add(ground);
    this.environment(root, k, th);
    this.stations = new Map();   // tile id -> station mesh
    this.moverGroups = k.movers.map(() => { const g = new THREE.Group(); return g; });
    for (const t of k.byId) {
      const c = t.id % w, r = (t.id / w) | 0;
      if (toggled.has(t.id)) continue;
      const parent = moving.has(t.id) ? this.moverGroups[k.moverOf.get(t.id)] : root;
      this.addCell(parent, t, c, r);
    }
    // hazard / ground under moving sections where they can leave
    for (const m of k.movers) for (const id of m.ids) {
      const c = id % w, r = (id / w) | 0;
      const base = k.byId[id];
      const under = m.under ?? '.';
      if (under === '~') this.hazardTile(root, c, r);
      else if (under === '.') this.floorTile(root, c, r, -0.005);
    }
    const mg = new THREE.Group(); root.add(mg); this.moverGroups.forEach(g => mg.add(g));
    // trucks: a chassis and wheels under each moving section
    if (th.truck) k.movers.forEach((m, i) => {
      const cs = m.ids.map(id => [id % w, (id / w) | 0]), c0 = Math.min(...cs.map(c => c[0])), c1 = Math.max(...cs.map(c => c[0])) + 1, r0 = Math.min(...cs.map(c => c[1])), r1 = Math.max(...cs.map(c => c[1])) + 1;
      const box = new THREE.Mesh(new THREE.BoxGeometry(c1 - c0 + 0.3, 0.5, r1 - r0 + 0.3), mat(th.truck)); box.position.set((c0 + c1) / 2, -0.26, (r0 + r1) / 2); this.moverGroups[i].add(box);
      for (const [x, z] of [[c0 + 0.8, r1], [c1 - 0.8, r1], [c0 + 0.8, r0], [c1 - 0.8, r0]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), mat('#222')); wh.rotation.x = Math.PI / 2; wh.position.set(x, -0.3, z); this.moverGroups[i].add(wh); }
    });
    this.mergeStatic(root, new Set(this.moverGroups));
    this.moverGroups.forEach(g => this.mergeStatic(g, new Set()));
    this.cells = new Map();       // toggled cell id -> { type, obj }
    // dynamic layers
    this.dyn = new THREE.Group(); root.add(this.dyn);
    this.tileItems = new Map();   // tile index -> { key, obj }
    this.chefs = new Map();       // slot -> { obj, heldKey, heldObj }
    this.loose = [];              // floor + flying item meshes
    this.bars = new Map();
    this.fires = new Map();
    this.icons = new Map();
    this.sprays = new Map();
    this.peds = []; this.bubbles = new Map();
    if (!['lava', 'ruins'].includes(th.env)) this.lavaGlow = null;
    this.fit();
  }

  // bake every static mesh into one mesh per material (hundreds of draw calls -> a few dozen)
  mergeStatic(root, skip) {
    root.updateMatrixWorld(true);
    const keep = new Set();
    for (const st of this.stations.values()) for (const k of ['glow', 'arrow', 'belt']) st.userData[k]?.traverse(o => keep.add(o));
    for (const g of skip) g.traverse(o => keep.add(o));
    const inv = root.matrixWorld.clone().invert();
    const groups = new Map(), victims = [];
    root.traverse(o => {
      if (!o.isMesh || keep.has(o)) return;
      const key = o.material.uuid + (o.castShadow ? 's' : '');
      if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      groups.get(key).geos.push(g); victims.push(o);
    });
    for (const o of victims) o.parent.remove(o);
    for (const { mat, cast, geos } of groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      m.castShadow = cast; m.receiveShadow = true; root.add(m);
    }
  }

  // what surrounds the kitchen: a brick-walled restaurant with diners, a street, a ship deck...
  environment(root, k, th) {
    const w = k.w, h = k.h, env = th.env;
    const B = (W, H, D, x, y, z, col, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat(col)); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
    const top = k.byId.slice(0, w).filter(t => !['void', 'hazard', 'floor', 'ice'].includes(t.base)).length;
    if (env === 'restaurant' || env === 'teal' || env === 'haunted') {
      // thick brick walls round the kitchen, low at the front so the camera sees in
      B(w + 1.2, 1.5, 0.6, w / 2, 0.75, -0.3, th.wall); B(w + 1.3, 0.1, 0.7, w / 2, 1.52, -0.3, th.trim);
      for (const x of [-0.3, w + 0.3]) { B(0.6, 1.0, h + 0.6, x, 0.5, h / 2, th.wall); B(0.7, 0.1, h + 0.7, x, 1.02, h / 2, th.trim); }
      B(w + 1.2, 0.45, 0.5, w / 2, 0.22, h + 0.25, th.wall); B(w + 1.3, 0.08, 0.6, w / 2, 0.47, h + 0.25, th.trim);
      // diners outside: little tables with chairs
      const table = (x, z) => {
        B(0.9, 0.06, 0.9, x, 0.62, z, '#f2e8d6'); B(0.12, 0.6, 0.12, x, 0.3, z, '#6a4a3a', false);
        for (const [dx, dz] of [[-0.75, 0], [0.75, 0]]) { B(0.4, 0.08, 0.4, x + dx, 0.4, z + dz, '#c84a3a'); B(0.4, 0.5, 0.08, x + dx * 1.2, 0.65, z + dz, '#c84a3a'); }
      };
      for (let x = 2; x < w - 1; x += 4) table(x, -2.4);
      for (let z = 2; z < h; z += 3.5) { table(-2.8, z); table(w + 2.8, z); }
    } else if (env === 'space') {
      // stars and the Earth far below
      const sg = new THREE.BufferGeometry(), pts = [];
      for (let i = 0; i < 500; i++) pts.push((Math.random() - 0.5) * 90 + w / 2, -2 - Math.random() * 8, (Math.random() - 0.5) * 70 + h / 2);
      sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12 })));
      const earth = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), mat('#2f78c8')); earth.position.set(w + 4, -9, h + 4); root.add(earth);
      const land = new THREE.Mesh(new THREE.SphereGeometry(7.05, 12, 8, 0, 2, 0.4, 1.2), mat('#4aa84a')); land.position.copy(earth.position); root.add(land);
      // station hull under the kitchen
      B(w + 0.6, 0.6, h + 0.6, w / 2, -0.32, h / 2, '#6a707a', false);
    } else if (env === 'lava' || env === 'ruins') {
      // glowing lava: a second brighter layer that pulses
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, h + 60), basic('#ffb02a', { transparent: true, opacity: 0.25 }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(w / 2, -0.025, h / 2); root.add(glow); this.lavaGlow = glow;
    } else if (env === 'truck' || env === 'iceroad') {
      for (let x = -8; x < w + 8; x += 2) B(1, 0.012, 0.12, x, 0.006, h / 2, '#f4f4f0', false);
    } else if (env === 'street') {
      // road markings: dashed centre line and kerbs
      for (let x = -8; x < w + 8; x += 2) if (!(k.level.crosswalk && x >= k.level.crosswalk[0] - 1 && x <= k.level.crosswalk[1] + 1)) B(1, 0.012, 0.12, x, 0.006, h / 2, '#f4f4f0', false);
      if (k.level.crosswalk) { const [c0, c1] = k.level.crosswalk; for (let z = -3; z < h + 3; z += 0.9) B(c1 - c0 + 1, 0.012, 0.45, (c0 + c1 + 1) / 2, 0.008, z, '#f4f4f0', false); }
      for (const z of [-0.6, h + 0.6]) B(w + 30, 0.02, 0.12, w / 2, 0.01, z, '#f2c21b', false);
      B(w + 30, 0.25, 3, w / 2, 0.12, -2.4, '#b8b0a4'); B(w + 30, 0.25, 3, w / 2, 0.12, h + 2.4, '#b8b0a4');
      // striped awnings over the counters
      const aw = (x, z, a, b) => { for (let i = 0; i < 6; i++) B(0.4, 0.06, 1.4, x - 1 + i * 0.4, 1.7, z, i % 2 ? a : b); };
      aw(3, -1.2, '#e8423a', '#fff'); aw(w - 4, -1.2, '#6a8ab8', '#fff'); aw(3, h + 1.2, '#6a8ab8', '#fff'); aw(w - 4, h + 1.2, '#e8423a', '#fff');
    } else if (env === 'ship') {
      // deck rail, barrels and the sea beyond
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, 30), mat('#2a7a8a')); sea.rotation.x = -Math.PI / 2; sea.position.set(w / 2, -0.5, -16); root.add(sea);
      B(w + 2, 0.9, 0.3, w / 2, 0.45, -1.4, '#7a4a2a'); B(w + 2.2, 0.1, 0.4, w / 2, 0.92, -1.4, '#5a3220');
      for (let x = 0; x < w; x += 2.2) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 10), mat('#8a5a32')); b.position.set(x + 0.6, 0.35, -0.85); b.castShadow = true; root.add(b); }
    } else if (top > w * 0.5 && th.wall) {
      B(w + 0.4, 1.6, 0.3, w / 2, 0.8, -0.15, th.wall); B(w + 0.5, 0.12, 0.36, w / 2, 1.62, -0.15, th.trim);
    }
  }
  floorTile(parent, c, r, y = 0, type = 'floor') {
    const th = this.theme, n = 3, q = 1 / n;
    const g = this.floorG ??= new THREE.PlaneGeometry(q, q);
    const [a, b] = type === 'ice' ? [th.iceA, th.iceB] : [th.floorA, th.floorB];
    for (let i = 0; i < n * n; i++) {
      const dx = i % n, dz = (i / n) | 0;
      const f = new THREE.Mesh(g, mat((c * n + dx + r * n + dz) % 2 ? a : b));
      f.rotation.x = -Math.PI / 2; f.position.set(c + q / 2 + dx * q, y, r + q / 2 + dz * q); f.receiveShadow = true; parent.add(f);
    }
  }
  hazardTile(parent, c, r) {
    const f = new THREE.Mesh(this.hazG ??= new THREE.PlaneGeometry(1, 1), mat(this.theme.hazard));
    f.rotation.x = -Math.PI / 2; f.position.set(c + 0.5, -0.02, r + 0.5); parent.add(f);
  }
  // one map cell: floor / hazard under it plus its station
  addCell(parent, t, c, r, type = t.base) {
    const k = this.k;
    if (type === 'void') return;
    if (type === 'hazard') { this.hazardTile(parent, c, r); return; }
    this.floorTile(parent, c, r, 0, type);
    if (type === 'portal') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 20), basic(t.portal === 'Q' || t.portal === 'q' ? '#7a4cff' : '#20c0ff'));
      ring.rotation.x = Math.PI / 2; ring.position.set(c + 0.5, 0.03, r + 0.5); parent.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), basic('#c9b8ff', { transparent: true, opacity: 0.5 }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(c + 0.5, 0.02, r + 0.5); parent.add(disc);
      return;
    }
    if (type === 'floor' || type === 'ice') return;
    const m = stationMesh(type, { crate: t.crate, icon: t.crate ? icon(t.crate, 96) : null, wall: this.theme.wall, top: this.theme.top, front: this.theme.front });
    m.position.set(c + 0.5, 0, r + 0.5);
    if (type === 'pass') { // arrow points out of the kitchen
      const out = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dc, dr]) => { const n = k.byId[(r + dr) * k.w + c + dc]; return !n || c + dc < 0 || c + dc >= k.w || ['void', 'hazard'].includes(n.base); }) ?? [0, -1];
      m.rotation.y = Math.atan2(-out[0], -out[1]); m.userData.arrow.rotation.y = Math.PI;
    }
    if (type === 'belt') m.userData.belt.rotation.y = Math.atan2(t.dir[0], t.dir[1]) + Math.PI / 2;
    parent.add(m); this.stations.set(t.id, m);
    return m;
  }

  fit() {
    const k = this.k; if (!k) return;
    const cv = this.renderer.domElement, W = this.opts.thumb ? 400 : cv.clientWidth || innerWidth, H = this.opts.thumb ? 240 : cv.clientHeight || innerHeight;
    this.renderer.setSize(W, H, false);
    const cam = this.camera; cam.aspect = W / H;
    const pitch = 56 * Math.PI / 180;
    let cx = k.w / 2;
    let cz = k.h / 2 + 0.2;
    const pts = [[0, 0, 0], [k.w, 0, 0], [0, 0, k.h], [k.w, 0, k.h], [0, 1.7, 0], [k.w, 1.7, 0], [0, 0.62, k.h], [k.w, 0.62, k.h]].map(p => new THREE.Vector3(...p));
    // margins: room for the order tickets at the top and the HUD at the bottom
    const touch = document.body.classList.contains('touch') && !this.opts.thumb;
    const xL = -0.98, xR = touch ? (W / H > 1.9 ? 0.52 : 0.6) : 0.98, mTop = this.opts.thumb ? 0.96 : W / H > 1.6 ? 0.72 : 0.62, mBot = this.opts.thumb ? 0.96 : touch ? 0.97 : 0.84;
    const place = d => { cam.position.set(cx, Math.sin(pitch) * d, cz + Math.cos(pitch) * d); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
    const proj = () => pts.map(p => p.clone().project(cam));
    let d = 20;
    for (let pass = 0; pass < 4; pass++) {
      let lo = 3, hi = 90;
      for (let it = 0; it < 30; it++) {
        d = (lo + hi) / 2; place(d);
        const v = proj(), y0 = Math.min(...v.map(p => p.y)), y1 = Math.max(...v.map(p => p.y)), x0 = Math.min(...v.map(p => p.x)), x1 = Math.max(...v.map(p => p.x));
        if (x1 - x0 < xR - xL && y1 - y0 < mTop + mBot) hi = d; else lo = d;
      }
      d = hi; place(d);
      // recentre vertically inside the band
      const v = proj(), y0 = Math.min(...v.map(p => p.y)), y1 = Math.max(...v.map(p => p.y));
      const want = (mTop - mBot) / 2, have = (y0 + y1) / 2;
      cz -= (have - want) * d * 0.38;
      const x0 = Math.min(...v.map(p => p.x)), x1 = Math.max(...v.map(p => p.x));
      cx += ((x0 + x1) / 2 - (xL + xR) / 2) * d * 0.36 * cam.aspect;
    }
    place(d);
    this.sun.position.set(cx - 4, 14, cz + 6); this.sun.target.position.set(cx, 0, cz);
    const s = Math.max(k.w, k.h) * 0.75 + 2; Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 40 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  // state: a Kitchen (host) or a client mirror; chefPos(slot) gives the position to draw each chef at
  draw(k, now, chefPos) {
    const camQ = this.camera.quaternion;
    const t = now / 1000;
    if (this.lavaGlow) this.lavaGlow.material.opacity = 0.18 + 0.12 * Math.sin(t * 1.7);
    // moving sections and switching tiles
    k.movers.forEach((m, i) => this.moverGroups[i].position.set(m.vis[0], 0, m.vis[1]));
    for (const id of this.toggled) {
      const tile = k.byId[id]; let e = this.cells.get(id);
      if (e?.type === tile.type) continue;
      if (e?.obj) this.root.remove(e.obj);
      const obj = new THREE.Group(); this.root.add(obj);
      this.addCell(obj, tile, id % k.w, (id / k.w) | 0, tile.type);
      this.cells.set(id, { type: tile.type, obj });
    }
    // items on stations
    for (const tile of k.byId) {
      const x = tile.c + tile.ox + 0.5, z = tile.r + tile.oz + 0.5, i = tile.id;
      const st = this.stations.get(i);
      // item
      const key = itemKey(tile.item);
      let slot = this.tileItems.get(i);
      if ((slot?.key ?? '') !== key) {
        if (slot?.obj) this.dyn.remove(slot.obj);
        const obj = itemMesh(tile.item);
        if (obj) this.dyn.add(obj);
        slot = { key, obj }; this.tileItems.set(i, slot);
      }
      if (slot?.obj) {
        let bx = 0, bz = 0;
        if (tile.type === 'belt' && tile.dir) { const f = Math.min(1, tile.belt ?? 0) - 0.5; bx = tile.dir[0] * f * 0.6; bz = tile.dir[1] * f * 0.6; }
        slot.obj.position.set(x + bx, COUNTER_H + (tile.type === 'board' ? 0.05 : tile.type === 'oven' ? -0.17 : 0), z + bz);
      }
      // sink: dirty plates waiting
      if (tile.type === 'sink') {
        const sk = 'sink' + (tile.dirty || 0);
        let s2 = this.tileItems.get('s' + i);
        if ((s2?.key ?? '') !== sk) {
          if (s2?.obj) this.dyn.remove(s2.obj);
          const obj = tile.dirty ? itemMesh({ t: 'plate', n: tile.dirty, dirty: true, c: [] }) : null;
          if (obj) { obj.position.set(x, COUNTER_H - 0.02, z); this.dyn.add(obj); }
          this.tileItems.set('s' + i, { key: sk, obj });
        }
      }
      const it = tile.item;
      // stove / oven glow
      if (st?.userData.glow) {
        const hot = it && !tile.fire && (((it.t === 'pot' || it.t === 'pan') && it.c.length && !it.burnt) || (it.t === 'ing' && tile.type === 'oven' && it.s !== 'burnt'));
        st.userData.glow.material.opacity = hot ? 0.55 + 0.2 * Math.sin(t * 9 + i) : 0;
        st.userData.glow.material.transparent = true;
      }
      if (st?.userData.arrow) st.userData.arrow.position.y = COUNTER_H + 0.08 + 0.03 * Math.sin(t * 4);
      if (st?.userData.belt) st.userData.belt.children.forEach((c, j) => { c.position.x = ((((j * 0.2 + t / RULES.beltStep) % 1) + 1) % 1 - 0.5) * 0.9; });
      // progress bars
      let prog = null, col = '#3fd04a', icon = null;
      const heat = it && (it.t === 'pot' || it.t === 'pan' || it.t === 'basket' ? COOK[it.t] : it.t === 'ing' && tile.type === 'oven' ? COOK.oven : null);
      if (it?.t === 'ing' && it.s === 'raw' && it.ch > 0 && it.ch < 1) prog = it.ch;
      else if (heat && (it.t === 'ing' || it.c.length) && !it.burnt && it.s !== 'burnt') {
        const done = (it.ck ?? 0) >= heat.time && (it.t === 'ing' || k.vesselFull(it));
        if (!done) { if ((it.ck ?? 0) > 0) prog = it.ck / heat.time; }
        else if (it.ov > RULES.burnWarn) { prog = 1; col = Math.floor(t * (it.ov > RULES.burnWarn + 5 ? 10 : 5)) % 2 ? '#ff3a2a' : '#ffd23a'; icon = Math.floor(t * 5) % 2 ? '!' : null; }
        else icon = '✓';
      } else if (tile.type === 'sink' && tile.wash > 0) prog = tile.wash;
      if (it && (it.burnt || it.s === 'burnt')) icon = '✗';
      this.setBar(i, prog, col, x, COUNTER_H + 0.75, z);
      this.setIcon(i, icon, x, COUNTER_H + 1.05, z);
      this.setBubbles(i, it?.t === 'pot' && !it.burnt && !icon && it.c.length && (it.ck ?? 0) < COOK.pot.time ? it.c : null, x, COUNTER_H + 1.1, z);
      this.setFire(i, tile.fire > 0 ? tile.fire / RULES.fireHP : 0, x, z, t);
    }
    // chefs
    const live = new Set();
    for (const ch of k.chefs) {
      live.add(ch.slot);
      let e = this.chefs.get(ch.slot);
      if (e && e.skin !== ch.skin) { this.dyn.remove(e.obj); e = null; }
      if (!e) { e = { obj: makeChef(ch.color, ch.skin), skin: ch.skin, heldKey: '', heldObj: null }; e.obj.scale.setScalar(1.42); this.dyn.add(e.obj); this.chefs.set(ch.slot, e); }
      const p = chefPos?.(ch) ?? ch;
      e.obj.position.set(p.x, 0, p.z);
      e.obj.visible = !(p.dead > 0);
      const target = Math.atan2(p.fx, p.fz);
      let cur = e.obj.rotation.y, d = target - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      e.obj.rotation.y = cur + d * 0.35;
      const body = e.obj.userData.body;
      const moving = Math.abs((p.walk ?? 0) - (e.lastWalk ?? 0)) > 1e-4; e.lastWalk = p.walk;
      body.position.y = moving ? Math.abs(Math.sin((p.walk ?? 0) * 12)) * 0.06 : 0;
      body.rotation.z = moving ? Math.sin((p.walk ?? 0) * 12) * 0.06 : 0;
      body.rotation.x = (p.dashT ?? 0) > 0 ? 0.35 : 0;
      // hands: hold position, chopping, washing
      const [hl, hr] = e.obj.userData.hands;
      if (ch.held) { hl.position.set(-0.24, 0.42, 0.34); hr.position.set(0.24, 0.42, 0.34); }
      else if (ch.work) { const a = Math.sin(t * (ch.work.kind === 'chop' ? 22 : 14)); hl.position.set(-0.22, 0.5, 0.3); hr.position.set(0.2, 0.55 + a * 0.12, 0.42); }
      else { const a = moving ? Math.sin((p.walk ?? 0) * 12) * 0.1 : 0; hl.position.set(-0.3, 0.36, 0.12 + a); hr.position.set(0.3, 0.36, 0.12 - a); }
      // held item
      const hk = itemKey(ch.held);
      if (hk !== e.heldKey) {
        if (e.heldObj) e.obj.userData.hold.remove(e.heldObj);
        e.heldObj = itemMesh(ch.held); if (e.heldObj) e.obj.userData.hold.add(e.heldObj);
        e.heldKey = hk;
      }
      // extinguisher spray
      let sp = this.sprays.get(ch.slot);
      if (ch.spray) {
        if (!sp) { sp = new THREE.Mesh(new THREE.ConeGeometry(0.5, RULES.extinguishRange, 10, 1, true), basic('#eef6ff', { transparent: true, opacity: 0.55, side: THREE.DoubleSide })); this.dyn.add(sp); this.sprays.set(ch.slot, sp); }
        sp.visible = true;
        sp.position.set(p.x + p.fx * (RULES.extinguishRange / 2 + 0.4), 0.85, p.z + p.fz * (RULES.extinguishRange / 2 + 0.4));
        sp.rotation.set(0, 0, 0); sp.lookAt(p.x + p.fx * 10, 0.85, p.z + p.fz * 10); sp.rotateX(-Math.PI / 2);
        sp.scale.setScalar(0.9 + 0.1 * Math.sin(t * 30));
      } else if (sp) sp.visible = false;
      // name tag bar for chopping progress is drawn at the board; nothing else here
    }
    for (const [slot, e] of this.chefs) if (!live.has(slot)) { this.dyn.remove(e.obj); this.chefs.delete(slot); }
    // pedestrians
    const ws = k.walkers ? k.walkers() : [];
    this.peds ??= [];
    ws.forEach((p, i) => {
      let o = this.peds[i];
      if (!o) { o = this.peds[i] = makePedestrian(i); this.dyn.add(o); }
      o.position.set(p.x, Math.abs(Math.sin(t * 9 + i)) * 0.05, p.z); o.rotation.y = Math.atan2(p.fx, p.fz);
    });
    // floor + flying items
    for (const o of this.loose) this.dyn.remove(o);
    this.loose = [];
    for (const f of k.floor ?? []) { const o = itemMesh(f.it); if (o) { o.position.set(f.x, 0.01, f.z); this.dyn.add(o); this.loose.push(o); } }
    for (const f of k.flying ?? []) { const o = itemMesh(f.it); if (o) { o.position.set(f.x, f.y, f.z); o.rotation.y = t * 12; this.dyn.add(o); this.loose.push(o); } }
    // bars face the camera
    for (const b of this.bars.values()) b.quaternion.copy(camQ);
    this.renderer.render(this.scene, this.camera);
  }

  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera), cv = this.renderer.domElement;
    return [(v.x + 1) / 2 * cv.clientWidth, (1 - v.y) / 2 * cv.clientHeight];
  }
  setBar(i, p, col, x, y, z) {
    let b = this.bars.get(i);
    if (p === null) { if (b) b.visible = false; return; }
    if (!b) { b = makeBar(); this.dyn.add(b); this.bars.set(i, b); }
    b.visible = true; b.position.set(x, y, z); b.userData.set(Math.min(1, p), col);
  }
  // what's in a pot, as little picture bubbles above it (with + for empty slots)
  setBubbles(i, list, x, y, z) {
    this.bubbles ??= new Map();
    let e = this.bubbles.get(i); const key = list ? list.join(',') : '';
    if ((e?.key ?? '') !== key) {
      if (e?.obj) this.dyn.remove(e.obj);
      let obj = null;
      if (list) {
        obj = new THREE.Group();
        const all = [...list, ...Array(Math.max(0, 3 - list.length)).fill(null)];
        all.forEach((k2, j) => {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(k2), depthTest: false }));
          sp.scale.setScalar(0.34); sp.position.set((j - (all.length - 1) / 2) * 0.36, 0, 0); sp.renderOrder = 12; obj.add(sp);
        });
        this.dyn.add(obj);
      }
      e = { key, obj }; this.bubbles.set(i, e);
    }
    e?.obj?.position.set(x, y, z);
  }
  setIcon(i, icon, x, y, z) {
    let e = this.icons.get(i);
    if ((e?.icon ?? null) === icon) return;
    if (e?.obj) this.dyn.remove(e.obj);
    let obj = null;
    if (icon) {
      obj = textSprite(icon, icon === '✓' ? '#2fb14a' : icon === '!' ? '#e8322a' : '#333', '#fff', 0.42);
      obj.position.set(x, y, z); this.dyn.add(obj);
    }
    this.icons.set(i, { icon, obj });
  }
  setFire(i, amt, x, z, t) {
    let f = this.fires.get(i);
    if (!amt) { if (f) f.visible = false; return; }
    if (!f) {
      f = new THREE.Group();
      const cols = ['#ff4a12', '#ff8a1a', '#ffd23a'];
      for (let k = 0; k < 7; k++) {
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16 + (k % 3) * 0.04, 0.5, 6), basic(cols[k % 3], { transparent: true, opacity: 0.92 }));
        fl.position.set(Math.cos(k * 2.4) * 0.22 * (k ? 1 : 0), 0.25, Math.sin(k * 2.4) * 0.22 * (k ? 1 : 0)); fl.userData.ph = k * 1.7;
        f.add(fl);
      }
      this.dyn.add(f); this.fires.set(i, f);
    }
    f.visible = true; f.position.set(x, COUNTER_H, z);
    f.children.forEach(fl => { const s = 0.7 + 0.35 * Math.sin(t * 13 + fl.userData.ph); fl.scale.set(1, s * (0.6 + 0.6 * amt), 1); fl.position.y = 0.25 * fl.scale.y; });
  }
}
