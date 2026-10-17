// Low-poly models built from primitives: chefs, stations and food. All original, made in code.
import * as THREE from 'three';

export const COUNTER_H = 0.62;
export const CHEF_COLORS = ['#e8423a', '#3a7be8', '#3cc04a', '#f2c21b'];

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  return matCache.get(key);
}
export function basic(color, opts = {}) {
  const key = 'b' + color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, ...opts }));
  return matCache.get(key);
}
function mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  if (shadow) { o.castShadow = true; o.receiveShadow = true; }
  return o;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);

// ---------------- chef ----------------
// The roster: original low-poly chefs (people and animals), all in white jackets and toques.
export const CHEFS = [
  { name: 'Gus', kind: 'human', skin: '#f2c39b', hair: '#5a3a22', beard: true },
  { name: 'Mittens', kind: 'cat', skin: '#2a2a30', inner: '#f2a0a8' },
  { name: 'Rafa', kind: 'human', skin: '#c98a5a', hair: '#1e1612', style: 'short' },
  { name: 'Cubo', kind: 'box', skin: '#d8c8a8' },
  { name: 'Nell', kind: 'human', skin: '#f6cfae', hair: '#6a3e1e', style: 'long' },
  { name: 'Tango', kind: 'cat', skin: '#e8902a', inner: '#ffd2a0' },
  { name: 'Rosie', kind: 'human', skin: '#f8d6bc', hair: '#c4421e', style: 'long' },
  { name: 'Dex', kind: 'human', skin: '#7a4a2c', hair: '#141010', style: 'short' },
  { name: 'Grub', kind: 'orc', skin: '#7aa84a' },
  { name: 'Sven', kind: 'human', skin: '#f2c8a4', hair: '#e8c060', style: 'long' },
  { name: 'Prof', kind: 'human', skin: '#efc19c', glasses: true },
  { name: 'Theo', kind: 'human', skin: '#f0c6a0', hair: '#7a4a24', style: 'short' },
  { name: 'Bandit', kind: 'raccoon', skin: '#8a8a90', inner: '#2a2a2e' },
  { name: 'Ama', kind: 'human', skin: '#6e4228', hair: '#120c0a', style: 'bun' },
  { name: 'Biscuit', kind: 'dog', skin: '#c8945a', inner: '#7a5030' },
  { name: 'Bao', kind: 'panda', skin: '#f6f6f2', inner: '#202024' },
  { name: 'Truffle', kind: 'pig', skin: '#f2a6b0', inner: '#e07888' },
  { name: 'Bolt', kind: 'robot', skin: '#a8b4c0', inner: '#40d0ff' },
];

function chefHead(head, d) {
  const S = mat(d.skin);
  const eye = (x, y = 0.03, z = 0.2) => head.add(mesh(sph(0.032, 5, 4), mat('#1b1410'), x, y, z, false));
  switch (d.kind) {
    case 'box': {
      head.add(mesh(box(0.4, 0.38, 0.38), S, 0, 0, 0));
      eye(-0.08, 0.04, 0.2); eye(0.08, 0.04, 0.2);
      head.add(mesh(box(0.14, 0.03, 0.02), mat('#3a2a1a'), 0, -0.07, 0.2, false));
      break; }
    case 'robot': {
      head.add(mesh(box(0.4, 0.36, 0.36), S, 0, 0, 0));
      head.add(mesh(box(0.3, 0.1, 0.02), basic(d.inner), 0, 0.03, 0.185, false));
      head.add(mesh(cyl(0.015, 0.015, 0.12, 5), mat('#666'), 0.15, 0.22, 0));
      break; }
    default: {
      head.add(mesh(sph(0.22, 10, 8), S, 0, 0, 0));
      eye(-0.08); eye(0.08);
      const animal = ['cat', 'raccoon', 'dog', 'panda', 'pig'].includes(d.kind);
      if (d.kind === 'cat' || d.kind === 'raccoon') for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.07, 0.13, 4), S, s * 0.14, 0.17, -0.02); e.rotation.z = -s * 0.4; head.add(e); }
      if (d.kind === 'panda' || d.kind === 'dog') for (const s of [-1, 1]) { const e = mesh(sph(0.075, 6, 5), mat(d.inner), s * (d.kind === 'dog' ? 0.21 : 0.15), d.kind === 'dog' ? 0.0 : 0.16, 0); if (d.kind === 'dog') e.scale.set(0.6, 1.4, 0.9); head.add(e); }
      if (d.kind === 'pig') for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.06, 0.1, 4), S, s * 0.14, 0.18, 0); head.add(e); }
      if (d.kind === 'raccoon' || d.kind === 'panda') for (const s of [-1, 1]) head.add(mesh(sph(0.06, 6, 4), mat(d.inner), s * 0.08, 0.03, 0.175, false));
      if (d.kind === 'raccoon' || d.kind === 'panda') { eye(-0.08, 0.03, 0.225); eye(0.08, 0.03, 0.225); }
      if (animal) {
        const snout = mesh(sph(0.08, 6, 5), mat(d.kind === 'pig' ? d.inner : d.kind === 'panda' ? '#fff' : d.inner ?? d.skin), 0, -0.06, 0.19, false); snout.scale.set(1.2, 0.8, 0.8); head.add(snout);
        head.add(mesh(sph(0.03, 5, 4), mat('#1b1410'), 0, -0.04, 0.26, false));
        if (d.kind === 'cat') for (const s of [-1, 1]) head.add(mesh(box(0.14, 0.008, 0.008), mat('#eee'), s * 0.15, -0.06, 0.18, false));
      } else if (d.kind === 'orc') {
        for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.025, 0.08, 4), mat('#f4f0e0'), s * 0.07, -0.08, 0.2, false); head.add(t); }
        for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.05, 0.14, 4), S, s * 0.23, 0.04, 0); e.rotation.z = -s * 1.3; head.add(e); }
        head.add(mesh(sph(0.05, 6, 4), mat('#5a8a3a'), 0, -0.01, 0.22, false));
      } else { // people
        head.add(mesh(sph(0.05, 6, 4), mat(d.skin), 0, -0.01, 0.22, false));
        if (d.beard) {
          const b = mesh(sph(0.2, 8, 6), mat(d.hair), 0, -0.1, 0.06); b.scale.set(1, 0.7, 0.9); head.add(b);
          head.add(mesh(box(0.22, 0.05, 0.05), mat(d.hair), 0, -0.05, 0.2, false));
        }
        if (d.glasses) for (const s of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 10), mat('#1b1410'), s * 0.08, 0.03, 0.215, false); head.add(r); }
        if (d.hair && d.style) {
          const back = mesh(sph(0.225, 9, 7), mat(d.hair), 0, 0.03, -0.04); back.scale.set(1.02, 0.95, 0.95); head.add(back);
          if (d.style === 'long') { const l = mesh(box(0.42, 0.3, 0.14), mat(d.hair), 0, -0.12, -0.12); head.add(l); }
          if (d.style === 'bun') head.add(mesh(sph(0.09, 7, 5), mat(d.hair), 0, 0.06, -0.24));
        }
      }
    }
  }
}

// passers-by (1-2's crossing)
export function makePedestrian(i) {
  const g = new THREE.Group();
  const shirt = ['#3a6ab8', '#c84a6a', '#4a9a5a', '#d8a030'][i % 4], skin = ['#f2c39b', '#8a5a3a', '#e8b08a', '#c98a5a'][i % 4];
  for (const s of [-1, 1]) g.add(mesh(cyl(0.06, 0.06, 0.4, 6), mat('#2a2a3a'), s * 0.09, 0.2, 0));
  g.add(mesh(cyl(0.2, 0.22, 0.5, 8), mat(shirt), 0, 0.62, 0));
  g.add(mesh(sph(0.2, 8, 6), mat(skin), 0, 1.05, 0));
  g.add(mesh(sph(0.21, 8, 6), mat('#2a1a10'), 0, 1.12, -0.04));
  g.scale.setScalar(1.25);
  return g;
}

export function makeChef(colorIdx, skinIdx = colorIdx) {
  const g = new THREE.Group();
  const col = CHEF_COLORS[colorIdx % 4];
  const d = CHEFS[((skinIdx % CHEFS.length) + CHEFS.length) % CHEFS.length];
  const body = new THREE.Group(); g.add(body); g.userData.body = body;
  // feet
  for (const s of [-1, 1]) body.add(mesh(sph(0.09, 6, 4), mat('#3a2a22'), s * 0.11, 0.05, 0.02));
  // white double-breasted jacket, belt band in the player's colour
  const torso = mesh(cyl(0.22, 0.29, 0.36, 9), mat('#f4f1ea'), 0, 0.3, 0); body.add(torso);
  body.add(mesh(cyl(0.292, 0.295, 0.08, 9), mat(col), 0, 0.2, 0));
  for (const y of [0.32, 0.42]) for (const s of [-1, 1]) body.add(mesh(sph(0.022, 5, 4), mat('#c9c2b4'), s * 0.06, y, 0.235, false));
  // head
  const head = new THREE.Group(); head.position.set(0, 0.64, 0); head.scale.setScalar(1.35); body.add(head); g.userData.head = head;
  chefHead(head, d);
  // neckerchief (red, like the originals) with a player-colour knot
  head.add(mesh(cyl(0.16, 0.2, 0.08, 9), mat('#d8342a'), 0, -0.19, 0.02));
  head.add(mesh(sph(0.05, 5, 4), mat(col), 0, -0.2, 0.18, false));
  // toque
  const hy = d.kind === 'box' || d.kind === 'robot' ? 0.24 : 0.22;
  head.add(mesh(cyl(0.17, 0.17, 0.16, 10), mat('#ffffff'), 0, hy, 0));
  const puff = mesh(sph(0.22, 9, 6), mat('#ffffff'), 0, hy + 0.15, 0); puff.scale.set(1, 0.7, 1); head.add(puff);
  // floating hands
  const hands = [];
  for (const s of [-1, 1]) { const h = mesh(sph(0.075, 7, 5), mat('#f4f1ea'), s * 0.3, 0.36, 0.12); body.add(h); hands.push(h); }
  g.userData.hands = hands;
  // held item anchor
  const hold = new THREE.Group(); hold.position.set(0, 0.42, 0.4); hold.scale.setScalar(0.78); body.add(hold); g.userData.hold = hold;
  // ring under the feet in the player's colour
  const ring = mesh(new THREE.RingGeometry(0.3, 0.36, 18), basic(col, { transparent: true, opacity: 0.85 }), 0, 0.012, 0, false);
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  return g;
}

// ---------------- food & items ----------------
const ING_LOOK = {
  onion: { raw: '#d7a24a', inner: '#f3e6c4', top: '#7a9a3a' },
  tomato: { raw: '#df3b2b', inner: '#f06a4f', top: '#3d8a2e' },
  mushroom: { raw: '#c99a6d', inner: '#efe2cf', top: '#e9dfcf' },
  lettuce: { raw: '#6cc04a', inner: '#b6e48a', top: '#4a9a32' },
  meat: { raw: '#c8463c', inner: '#e8857a', top: '#f2d6c8', cooked: '#6a3a22' },
  chicken: { raw: '#f0c8a8', inner: '#f8e2cc', top: '#fff', cooked: '#c9822e' },
  fish: { raw: '#7aa6c8', inner: '#f4d7c4', top: '#5a86a8', cooked: '#e0a040' },
  potato: { raw: '#b98a4e', inner: '#f2df9a', top: '#8a6a3a', cooked: '#f0c040' },
  cheese: { raw: '#f5c838', inner: '#ffe27a', top: '#e0a820' },
  pepperoni: { raw: '#b8322a', inner: '#d85a4a', top: '#8a2018' },
  dough: { raw: '#f2e2bc', inner: '#f6ead0', top: '#e8d4a4' },
  bun: { raw: '#e09a48', inner: '#f6dcae', top: '#fff2d0' },
  tortilla: { raw: '#efd9a0', inner: '#f6e6bc', top: '#d9b870' },
  rice: { raw: '#f4f2ea', inner: '#ffffff', top: '#e0dccb' },
  burnt: { raw: '#2b2420', inner: '#2b2420', top: '#2b2420', cooked: '#2b2420' },
};
const TOP_COLOR = { tomato: '#d8452e', cheese: '#f7d24a', pepperoni: '#b8322a', mushroom: '#c9a27a' };
function choppedMesh(k, L, cooked) {
  const g = new THREE.Group();
  if (k === 'potato' && cooked) { // chips
    for (let i = 0; i < 7; i++) { const p = mesh(box(0.05, 0.05, 0.2), mat(L.cooked), Math.cos(i * 1.7) * 0.08, 0.04 + (i % 3) * 0.03, Math.sin(i * 1.7) * 0.08); p.rotation.y = i * 0.9; g.add(p); }
    return g;
  }
  if ((k === 'meat' || k === 'chicken') && cooked) { g.add(mesh(cyl(0.16, 0.17, 0.07, 10), mat(L.cooked), 0, 0.04, 0)); return g; }
  if (k === 'meat') { g.add(mesh(cyl(0.16, 0.17, 0.06, 10), mat(L.raw), 0, 0.03, 0)); return g; }   // a raw patty
  if (k === 'fish') { const b = mesh(box(0.3, 0.06, 0.14), mat(cooked ? L.cooked : L.inner), 0, 0.04, 0); g.add(b); return g; }
  const pieces = [[-0.07, 0, -0.04], [0.06, 0, -0.06], [0.0, 0, 0.06], [0.09, 0, 0.05], [-0.08, 0, 0.07]];
  pieces.forEach(([x, y, z], i) => {
    const p = mesh(k === 'mushroom' || k === 'pepperoni' ? cyl(0.06, 0.07, 0.04, 6) : box(0.09, 0.05, 0.08), mat(i % 2 ? L.inner : L.raw), x, 0.03, z);
    p.rotation.y = i * 1.3; g.add(p);
  });
  return g;
}
export function ingredientMesh(k, s, top = []) {
  const g = new THREE.Group();
  const L = s === 'burnt' ? ING_LOOK.burnt : (ING_LOOK[k] ?? ING_LOOK.onion);
  if (k === 'dough' && s !== 'raw') { // flattened base (+ toppings), baked in the oven
    const col = s === 'burnt' ? '#2b2420' : s === 'cooked' ? '#e7b25a' : L.raw;
    g.add(mesh(cyl(0.26, 0.27, 0.05, 14), mat(col), 0, 0.03, 0));
    if (s !== 'burnt') top.forEach((t, i) => {
      if (t === 'tomato') g.add(mesh(cyl(0.22, 0.22, 0.01, 14), mat(TOP_COLOR.tomato), 0, 0.06, 0, false));
      else if (t === 'cheese') g.add(mesh(cyl(0.19, 0.19, 0.012, 10), mat(s === 'cooked' ? '#f4c44a' : TOP_COLOR.cheese), 0, 0.068, 0, false));
      else for (let j = 0; j < 5; j++) g.add(mesh(cyl(0.04, 0.04, 0.015, 7), mat(TOP_COLOR[t]), Math.cos(j * 1.26 + i) * 0.13, 0.078, Math.sin(j * 1.26 + i) * 0.13, false));
    });
    return g;
  }
  if (s === 'chopped' || s === 'cooked' || (s === 'burnt' && k !== 'dough')) return choppedMesh(k, L, s === 'cooked' || s === 'burnt');
  switch (k) {
    case 'mushroom': {
      g.add(mesh(cyl(0.06, 0.08, 0.13, 7), mat(L.top), 0, 0.07, 0));
      const cap = mesh(new THREE.SphereGeometry(0.15, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(L.raw), 0, 0.12, 0); cap.scale.y = 0.75; g.add(cap);
      return g; }
    case 'lettuce': { const b = mesh(sph(0.17, 8, 6), mat(L.raw), 0, 0.15, 0); b.scale.y = 0.85; g.add(b); g.add(mesh(sph(0.1, 6, 4), mat(L.inner), 0, 0.27, 0)); return g; }
    case 'meat': { g.add(mesh(box(0.32, 0.1, 0.22), mat(L.raw), 0, 0.06, 0)); g.add(mesh(cyl(0.035, 0.035, 0.12, 6), mat(L.top), 0.16, 0.06, 0).rotateZ(Math.PI / 2)); return g; }
    case 'chicken': { g.add(mesh(sph(0.15, 8, 6), mat(L.raw), -0.04, 0.12, 0)); g.add(mesh(cyl(0.035, 0.035, 0.18, 6), mat(L.top), 0.12, 0.12, 0).rotateZ(Math.PI / 2)); return g; }
    case 'fish': { const b = mesh(sph(0.14, 8, 6), mat(L.raw), 0, 0.1, 0); b.scale.set(1.6, 0.7, 0.8); g.add(b); const tail = mesh(new THREE.ConeGeometry(0.1, 0.14, 4), mat(L.top), 0.26, 0.1, 0); tail.rotation.z = Math.PI / 2; g.add(tail); return g; }
    case 'potato': { const b = mesh(sph(0.15, 8, 6), mat(L.raw), 0, 0.12, 0); b.scale.set(1.25, 0.85, 1); g.add(b); return g; }
    case 'cheese': { const b = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 3, 1, false, 0, Math.PI * 0.5), mat(L.raw), 0, 0.08, 0); g.add(b); return g; }
    case 'pepperoni': { const b = mesh(cyl(0.06, 0.06, 0.34, 8), mat(L.raw), 0, 0.07, 0); b.rotation.z = Math.PI / 2; g.add(b); return g; }
    case 'dough': { const b = mesh(sph(0.16, 8, 6), mat(L.raw), 0, 0.11, 0); b.scale.y = 0.7; g.add(b); return g; }
    case 'bun': { const b = mesh(new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(L.raw), 0, 0.06, 0); b.scale.y = 0.7; g.add(b); g.add(mesh(cyl(0.17, 0.17, 0.06, 10), mat(L.inner), 0, 0.03, 0)); return g; }
    case 'tortilla': { g.add(mesh(cyl(0.24, 0.24, 0.025, 12), mat(L.raw), 0, 0.02, 0)); return g; }
    case 'rice': { g.add(mesh(cyl(0.13, 0.15, 0.2, 8), mat('#d8c8a0'), 0, 0.1, 0)); g.add(mesh(cyl(0.13, 0.13, 0.02, 8), mat(L.raw), 0, 0.21, 0)); return g; }
  }
  const b = mesh(sph(0.15, 9, 7), mat(L.raw), 0, 0.14, 0); if (k === 'onion') b.scale.y = 0.95; g.add(b);
  const t = mesh(k === 'onion' ? cyl(0.01, 0.04, 0.12, 5) : cyl(0.07, 0.07, 0.02, 6), mat(L.top), 0, k === 'onion' ? 0.32 : 0.29, 0); g.add(t);
  return g;
}
const SOUP_COLOR = { onion: '#e6b85c', tomato: '#d8452e', mushroom: '#a8805a', mixed: '#8a7a50', burnt: '#2a2018', rice: '#f6f4ee' };
// what's on a plate, arranged as a dish (burgers stacked, burritos wrapped, fish next to chips)
function dishMesh(c) {
  const g = new THREE.Group();
  c = c.filter(x => typeof x === 'string');
  if (!c.length) return g;
  const has = k => c.includes(k);
  if (c.some(x => x.startsWith('soup:'))) {
    g.add(mesh(cyl(0.2, 0.13, 0.14, 12), mat('#f6f2e6'), 0, 0.08, 0));
    g.add(mesh(cyl(0.18, 0.18, 0.02, 12), mat(SOUP_COLOR[c[0].slice(5)] ?? '#999'), 0, 0.145, 0, false));
    return g;
  }
  if (c.some(x => x.startsWith('pizza:'))) { const p = ingredientMesh('dough', 'cooked', c[0].slice(6).split('+')); g.add(p); return g; }
  if (has('tortilla') && (has('rice') || has('meat') || has('chicken'))) {
    if (has('rice') && (has('meat') || has('chicken'))) { const w = mesh(cyl(0.11, 0.11, 0.42, 10), mat(ING_LOOK.tortilla.raw), 0, 0.12, 0); w.rotation.z = Math.PI / 2; w.rotation.y = 0.5; g.add(w); return g; }
  }
  let y = 0.02;
  if (has('bun')) { g.add(mesh(cyl(0.17, 0.17, 0.06, 10), mat(ING_LOOK.bun.inner), 0, y + 0.03, 0)); y += 0.06; }
  if (has('tortilla')) { g.add(mesh(cyl(0.24, 0.24, 0.025, 12), mat(ING_LOOK.tortilla.raw), 0, y + 0.012, 0)); y += 0.025; }
  if (has('rice')) { const r = mesh(sph(0.11, 7, 5), mat('#fbfaf4'), -0.05, y + 0.04, 0); r.scale.y = 0.6; g.add(r); }
  if (has('meat') || has('chicken')) { g.add(mesh(cyl(0.16, 0.17, 0.07, 10), mat(has('meat') ? ING_LOOK.meat.cooked : ING_LOOK.chicken.cooked), 0, y + 0.035, 0)); y += 0.07; }
  if (has('lettuce')) { g.add(mesh(cyl(0.19, 0.18, 0.03, 9), mat(ING_LOOK.lettuce.raw), 0, y + 0.015, 0)); y += 0.03; }
  if (has('tomato')) { g.add(mesh(cyl(0.15, 0.15, 0.03, 9), mat(ING_LOOK.tomato.raw), 0, y + 0.015, 0)); y += 0.03; }
  if (has('bun') && c.length > 1) { const top = mesh(new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(ING_LOOK.bun.raw), 0, y, 0); top.scale.y = 0.7; g.add(top); }
  else if (has('bun')) { const top = mesh(new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(ING_LOOK.bun.raw), 0.0, y, 0); top.scale.y = 0.7; g.add(top); }
  if (has('fish')) { const f = mesh(box(0.28, 0.06, 0.13), mat(ING_LOOK.fish.cooked), has('chips') ? -0.08 : 0, 0.04, 0); g.add(f); }
  if (has('chips')) { const ch = choppedMesh('potato', ING_LOOK.potato, true); ch.scale.setScalar(0.8); ch.position.x = has('fish') ? 0.1 : 0; g.add(ch); }
  return g;
}
export function plateMesh(it) {
  const g = new THREE.Group();
  const n = Math.min(it.n ?? 1, 6);
  for (let i = 0; i < n; i++) {
    g.add(mesh(cyl(0.27, 0.2, 0.045, 14), mat(it.dirty ? '#cfc6b2' : '#fbfbf7'), 0, 0.025 + i * 0.05, 0));
    if (it.dirty) for (let k = 0; k < 3; k++) g.add(mesh(cyl(0.05, 0.05, 0.01, 6), mat('#8a6a3a'), Math.cos(k * 2.1 + i) * 0.13, 0.05 + i * 0.05, Math.sin(k * 2.1 + i) * 0.13, false));
  }
  if (it.c?.length) { const d = dishMesh(it.c); d.position.y = 0.04; g.add(d); }
  return g;
}
export function vesselMesh(it) {
  const g = new THREE.Group();
  if (it.t === 'pot') {
    g.add(mesh(cyl(0.27, 0.24, 0.26, 12), mat('#5d6470'), 0, 0.13, 0));
    g.add(mesh(cyl(0.28, 0.28, 0.03, 12), mat('#7b838f'), 0, 0.26, 0));
    for (const s of [-1, 1]) g.add(mesh(box(0.1, 0.04, 0.06), mat('#2e3238'), s * 0.31, 0.2, 0));
    if (it.c?.length) {
      const kind = it.burnt ? 'burnt' : it.c[0] === 'rice' ? 'rice' : (it.c.every(c => c === it.c[0]) ? it.c[0] : 'mixed');
      const lvl = 0.08 + Math.max(it.c.length, it.c[0] === 'rice' ? 3 : 0) * 0.05;
      g.add(mesh(cyl(0.24, 0.24, 0.02, 12), mat(SOUP_COLOR[kind]), 0, lvl, 0, false));
      if (!it.burnt && it.c[0] !== 'rice') it.c.forEach((k, i) => { const p = mesh(box(0.07, 0.04, 0.07), mat(ING_LOOK[k]?.raw ?? '#aaa'), Math.cos(i * 2.2) * 0.12, lvl + 0.02, Math.sin(i * 2.2) * 0.12, false); p.rotation.y = i; g.add(p); });
    }
  } else if (it.t === 'pan') {
    g.add(mesh(cyl(0.27, 0.23, 0.08, 14), mat('#2e3238'), 0, 0.04, 0));
    const h = mesh(box(0.34, 0.04, 0.07), mat('#1d1f24'), 0.42, 0.07, 0); g.add(h);
    if (it.c?.length) { const m = choppedMesh(it.c[0], it.burnt ? ING_LOOK.burnt : ING_LOOK[it.c[0]], it.burnt || it.ck >= 8); m.position.y = 0.06; g.add(m); }
  } else { // fryer basket
    g.add(mesh(cyl(0.24, 0.22, 0.2, 8, 1), mat('#a7aeb5', { wireframe: false }), 0, 0.1, 0));
    g.add(mesh(cyl(0.2, 0.2, 0.02, 8), mat('#d8a43a'), 0, 0.17, 0, false));
    g.add(mesh(box(0.06, 0.05, 0.36), mat('#1d1f24'), 0, 0.2, 0.34));
    if (it.c?.length) { const m = choppedMesh(it.c[0], it.burnt ? ING_LOOK.burnt : ING_LOOK[it.c[0]], it.burnt || it.ck >= 9); m.position.y = 0.17; g.add(m); }
  }
  return g;
}
export function extMesh() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.1, 0.42, 10), mat('#d42a22'), 0, 0.21, 0));
  g.add(mesh(sph(0.1, 8, 5), mat('#d42a22'), 0, 0.42, 0));
  g.add(mesh(box(0.05, 0.06, 0.2), mat('#222'), 0, 0.5, 0.06));
  g.add(mesh(box(0.14, 0.03, 0.05), mat('#888'), 0, 0.54, -0.04));
  return g;
}
export function itemMesh(it) {
  const g = itemMesh0(it);
  if (g) g.scale.setScalar(it.t === 'plate' && it.n > 1 ? 1.2 : 1.35);
  return g;
}
function itemMesh0(it) {
  if (!it) return null;
  switch (it.t) {
    case 'ing': return ingredientMesh(it.k, it.s, it.top);
    case 'plate': return plateMesh(it);
    case 'pot': case 'pan': case 'basket': return vesselMesh(it);
    case 'ext': return extMesh();
  }
  return null;
}
// key that changes whenever the look of the item changes (continuous progress is drawn by bars)
export function itemKey(it) {
  if (!it) return '';
  switch (it.t) {
    case 'ing': return 'i' + it.k + it.s + (it.top ?? []).join('+');
    case 'plate': return 'p' + it.n + (it.dirty ? 'd' : '') + (it.c ?? []).join(',');
    case 'pot': case 'pan': case 'basket': return it.t + it.c.join(',') + (it.burnt ? 'b' : '') + (it.t !== 'pot' && it.ck >= 8 ? 'c' : '');
    default: return it.t;
  }
}

// ---------------- stations ----------------
const WOOD = '#c98f55', WOOD_D = '#9c6a3c', STEEL = '#b9c2c9', STEEL_D = '#8a949c', TOP = '#f3cd7c', FRONT = '#c08048';
const texCache = new Map();
function iconTexture(url) {
  if (!texCache.has(url)) { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; texCache.set(url, t); }
  return texCache.get(url);
}
export function stationMesh(type, extra = {}) {
  const g = new THREE.Group();
  const H = COUNTER_H;
  const top = extra.top ?? TOP, front = extra.front ?? FRONT;
  const base = (col = front, tp = top) => {
    g.add(mesh(box(1, H - 0.06, 1), mat(col), 0, (H - 0.06) / 2, 0));
    g.add(mesh(box(1.02, 0.06, 1.02), mat(tp), 0, H - 0.03, 0));
    // drawer line on the front
    g.add(mesh(box(0.86, 0.02, 0.01), mat('#00000033', { transparent: true }), 0, H - 0.17, 0.505, false));
  };
  switch (type) {
    case 'counter': base(); break;
    case 'board': {
      base();
      g.add(mesh(box(0.62, 0.04, 0.5), mat('#f4f2ec'), 0, H + 0.02, 0.04));
      // a big knife standing in the board
      const k = new THREE.Group(); k.position.set(-0.12, H + 0.04, -0.06); k.rotation.z = 0.25; g.add(k);
      k.add(mesh(box(0.04, 0.3, 0.13), mat('#d8dde2'), 0, 0.15, 0));
      k.add(mesh(box(0.05, 0.14, 0.06), mat('#3a2a22'), 0, 0.37, -0.03));
      break; }
    case 'stove':
      g.add(mesh(box(1, H - 0.06, 1), mat('#c8342a'), 0, (H - 0.06) / 2, 0));
      g.add(mesh(box(1.02, 0.06, 1.02), mat('#2a2c31'), 0, H - 0.03, 0));
      { const ring = mesh(new THREE.TorusGeometry(0.26, 0.035, 5, 14), mat('#55585e'), 0, H + 0.01, 0); ring.rotation.x = Math.PI / 2; g.add(ring); }
      { const glow = mesh(cyl(0.24, 0.24, 0.01, 14), basic('#ff5a1f', { transparent: true, opacity: 0 }), 0, H + 0.005, 0, false); g.add(glow); g.userData.glow = glow; }
      for (const s of [-1, 1]) g.add(mesh(cyl(0.05, 0.05, 0.04, 6), mat('#eee'), s * 0.25, H - 0.18, 0.51).rotateX(Math.PI / 2));
      break;
    case 'pass': {
      g.add(mesh(box(1, H - 0.06, 1), mat('#6a7078'), 0, (H - 0.06) / 2, 0));
      g.add(mesh(box(1.02, 0.06, 1.02), mat('#e8e6e0'), 0, H - 0.03, 0));
      // hood over the hatch
      g.add(mesh(box(1.0, 0.08, 0.5), mat('#5a6068'), 0, H + 0.75, -0.25));
      for (const s of [-1, 1]) g.add(mesh(box(0.06, 0.75, 0.06), mat('#5a6068'), s * 0.47, H + 0.37, -0.45));
      const pivot = new THREE.Group(); pivot.position.y = H + 0.04; g.add(pivot); g.userData.arrow = pivot;
      for (const z of [-0.2, 0.18]) { const arrow = mesh(new THREE.ConeGeometry(0.2, 0.26, 3), basic('#7a8088'), 0, 0, z, false); arrow.rotation.x = Math.PI / 2; arrow.scale.y = 1; arrow.scale.z = 0.2; pivot.add(arrow); }
      break; }
    case 'sink':
      g.add(mesh(box(1, H - 0.06, 1), mat(STEEL_D), 0, (H - 0.06) / 2, 0));
      g.add(mesh(box(1.02, 0.06, 1.02), mat(STEEL), 0, H - 0.03, 0));
      g.add(mesh(box(0.72, 0.03, 0.62), mat('#7ab8d0'), 0, H + 0.0, 0.02, false));
      g.add(mesh(cyl(0.03, 0.03, 0.3, 6), mat('#ccc'), 0, H + 0.15, -0.38));
      g.add(mesh(box(0.04, 0.04, 0.18), mat('#ccc'), 0, H + 0.3, -0.3));
      break;
    case 'rack':
      base(STEEL_D, STEEL);
      for (let i = -2; i <= 2; i++) g.add(mesh(box(0.03, 0.18, 0.7), mat('#888f96'), i * 0.16, H + 0.09, 0));
      break;
    case 'return':
      base('#5f6a86', '#9aa4c0');
      g.add(mesh(box(0.74, 0.02, 0.74), mat('#7a84a2'), 0, H + 0.005, 0, false));
      g.add(mesh(cyl(0.27, 0.27, 0.012, 14), mat('#6a7392'), 0, H + 0.02, 0, false));
      break;
    case 'bin':
      base();
      g.add(mesh(box(0.78, 0.03, 0.78), mat('#3fb04a'), 0, H + 0.005, 0, false));
      g.add(mesh(box(0.62, 0.035, 0.62), basic('#101210'), 0, H + 0.01, 0, false));
      break;
    case 'fryer':
      g.add(mesh(box(1, H - 0.06, 1), mat('#8a949c'), 0, (H - 0.06) / 2, 0));
      g.add(mesh(box(1.02, 0.06, 1.02), mat('#b9c2c9'), 0, H - 0.03, 0));
      g.add(mesh(box(0.66, 0.03, 0.66), mat('#c8952e'), 0, H + 0.0, 0, false));
      break;
    case 'oven': {
      g.add(mesh(box(1, H + 0.35, 1), mat('#a8473a'), 0, (H + 0.35) / 2, 0));
      g.add(mesh(box(1.04, 0.08, 1.04), mat('#7a2f26'), 0, H + 0.39, 0));
      const mouth = mesh(box(0.7, 0.32, 0.05), basic('#2a0f08'), 0, H - 0.05, 0.5, false); g.add(mouth);
      const glow = mesh(box(0.6, 0.22, 0.02), basic('#ff7a1f', { transparent: true, opacity: 0 }), 0, H - 0.05, 0.53, false); g.add(glow); g.userData.glow = glow;
      g.add(mesh(box(0.86, 0.04, 0.86), mat('#5a5a5a'), 0, H - 0.18, 0, false));
      break; }
    case 'belt': {
      g.add(mesh(box(1, H - 0.08, 1), mat('#5a6168'), 0, (H - 0.08) / 2, 0));
      g.add(mesh(box(1.0, 0.05, 0.86), mat('#2b2e33'), 0, H - 0.04, 0));
      const pivot = new THREE.Group(); pivot.position.y = H - 0.005; g.add(pivot); g.userData.belt = pivot;
      for (let i = -2; i <= 2; i++) { const st = mesh(box(0.06, 0.012, 0.8), basic('#ffd23a'), 0, 0, 0, false); st.position.x = i * 0.2; pivot.add(st); }
      break; }
    case 'wall':
      g.add(mesh(box(1, H + 0.1, 1), mat(extra.wall ?? '#b8604a'), 0, (H + 0.1) / 2, 0));
      break;
    case 'crate': {
      g.add(mesh(box(0.98, H - 0.04, 0.98), mat(WOOD_D), 0, (H - 0.04) / 2, 0));
      for (const y of [0.15, 0.4]) g.add(mesh(box(1.0, 0.06, 1.0), mat(WOOD), 0, y, 0));
      g.add(mesh(box(1.0, 0.04, 1.0), mat(WOOD), 0, H - 0.02, 0));
      // the lid shows a round picture of what's inside
      if (extra.icon) {
        g.add(mesh(cyl(0.34, 0.34, 0.02, 18), mat('#9fd6d0'), 0, H + 0.005, 0, false));
        const pic = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ map: iconTexture(extra.icon), transparent: true }));
        pic.rotation.x = -Math.PI / 2; pic.position.y = H + 0.018; g.add(pic);
      }
      break; }
  }
  return g;
}

// ---------------- progress bars / icons (camera-facing) ----------------
export function makeBar(color = '#3fd04a') {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.13), basic('#1a1a1a', { depthTest: false, transparent: true }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.08), basic(color, { depthTest: false, transparent: true }));
  bg.renderOrder = 10; fg.renderOrder = 11; fg.position.z = 0.001;
  g.add(bg, fg); g.userData.fg = fg;
  g.userData.set = (p, col) => { fg.scale.x = Math.max(0.001, p); fg.position.x = -0.28 * (1 - p); if (col) fg.material = basic(col, { depthTest: false, transparent: true }); };
  return g;
}
const iconCache = new Map();
export function textSprite(text, bg, fg = '#fff', size = 0.5) {
  const key = text + bg + fg;
  let tex = iconCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
    x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = fg; x.font = '900 80px Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 70);
    tex = new THREE.CanvasTexture(c); iconCache.set(key, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.setScalar(size); s.renderOrder = 12;
  return s;
}
