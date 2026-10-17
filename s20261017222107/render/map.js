// The overworld: a tabletop diorama of hex tiles with a yellow road linking the kitchens, a flag over each
// level showing its stars, and a little bus that drives to the selected kitchen. Drawn with the game's
// renderer into its own scene.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, basic } from './models.js';

// hex colours per world (grass town, sea, snow, haunted, space, lava)
const LAND = {
  0: ['#7a6a5a', '#6a5a4a'], 1: ['#7cc05a', '#6ab04c'], 2: ['#8ac860', '#78b852'], 3: ['#eef6fb', '#d8e8f2'],
  4: ['#4a4a5e', '#3e3e52'], 5: ['#1c2038', '#262a48'], 6: ['#e8a050', '#d89040'], 7: ['#c85a2a', '#b84a22'],
};
const SEA = '#4a9ad8';

function label(text, bg = '#ffffff', fg = '#2b1d12', w = 256, h = 128, font = 72) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.font = `900 ${font}px "Luckiest Guy", "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 14; x.strokeStyle = bg; x.strokeText(text, w / 2, h / 2 + 4); x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(w / 128, h / 128, 1);
  return s;
}
function flagSprite(stars, unlocked, sel) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = sel ? '#ffd23a' : stars ? '#3fb04a' : '#ffffff'; x.strokeStyle = '#2b1d12'; x.lineWidth = 6;
  x.beginPath(); x.roundRect(8, 8, 176, 80, 22); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(80, 86); x.lineTo(96, 118); x.lineTo(112, 86); x.fill(); x.stroke();
  for (let i = 0; i < 3; i++) {
    x.fillStyle = i < stars ? '#f5c430' : unlocked ? '#9a9a9a' : '#555';
    x.font = '900 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.strokeStyle = '#2b1d12'; x.lineWidth = 4; x.strokeText('★', 44 + i * 52, 50); x.fillText('★', 44 + i * 52, 50);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(1.5, 1, 1);
  return s;
}

export class WorldMap {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#6a4a2e');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    this.scene.add(new THREE.HemisphereLight('#fff6e8', '#7a6a5a', 1.7));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-10, 30, 15); this.scene.add(sun);
    this.sel = 0; this.busPos = null; this.target = new THREE.Vector3();
  }

  build(levels, best) {
    if (this.root) this.scene.remove(this.root);
    const root = this.root = new THREE.Group(); this.scene.add(root);
    this.levels = levels;
    // a winding road: left to right, gently snaking
    this.nodes = levels.map((l, i) => new THREE.Vector3(i * 2.6, 0.32, Math.sin(i * 0.62) * 3.2 + (i % 2 ? 0.4 : -0.4)));
    // hex land around the road, coloured by the nearest kitchen's world
    const R = 1, W = Math.sqrt(3) * R;
    const geos = new Map();
    const add = (col, g) => { if (!geos.has(col)) geos.set(col, []); geos.get(col).push(g); };
    const x0 = -6, x1 = this.nodes.at(-1).x + 6;
    for (let row = -9; row <= 9; row++) for (let colI = Math.floor(x0 / W) - 1; colI <= x1 / W + 1; colI++) {
      const x = colI * W + (row & 1 ? W / 2 : 0), z = row * 1.5 * R;
      let best = Infinity, bi = 0;
      this.nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.z - z); if (d < best) { best = d; bi = i; } });
      const world = levels[bi].world, land = best < 5.2;
      const h = land ? 0.25 + ((colI * 7 + row * 13) % 5) * 0.02 : 0.1;
      const g = new THREE.CylinderGeometry(R * 0.98, R * 0.98, h, 6); g.rotateY(Math.PI / 6); g.translate(x, h / 2, z);
      if (!land) continue;   // the rest of the board is plain graph paper
      add(LAND[world][(colI + row) & 1], g.toNonIndexed());
      // a few props: trees on grass, ice spikes on snow, rocks on lava
      if (land && best > 1.6 && ((colI * 31 + row * 17) % 7 === 0)) {
        const t = world === 3 ? '#ffffff' : world === 7 || world === 6 ? '#7a3a1a' : world === 5 ? '#6a6aa8' : world === 4 ? '#2a3a2a' : '#2f8a3a';
        const cone = new THREE.ConeGeometry(0.35, 1.1, 6); cone.translate(x, h + 0.55, z); add(t, cone.toNonIndexed());
        if (world <= 2 || world === 6) { const tr = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 5); tr.translate(x, h + 0.1, z); add('#6a4a2a', tr.toNonIndexed()); }
      }
    }
    // the road: yellow with an orange outline
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i], b = this.nodes[i + 1], len = a.distanceTo(b), ang = Math.atan2(b.z - a.z, b.x - a.x);
      for (const [wid, col, y] of [[0.75, '#e07a2a', 0.31], [0.5, '#ffd23a', 0.33]]) {
        const g = new THREE.BoxGeometry(len + wid * 0.6, 0.04, wid); g.rotateY(-ang); g.translate((a.x + b.x) / 2, y, (a.z + b.z) / 2); add(col, g.toNonIndexed());
      }
    }
    // graph-paper board under everything
    {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#f0e2b8'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#d8c48a'; x.lineWidth = 3; x.strokeRect(0, 0, 128, 128);
      x.lineWidth = 1; for (let i = 32; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
      const bw = x1 - x0 + 2, bd = 29; tex.repeat.set(bw / 2, bd / 2);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), new THREE.MeshLambertMaterial({ map: tex }));
      paper.rotation.x = -Math.PI / 2; paper.position.set((x0 + x1) / 2, 0.01, 0); root.add(paper);
    }
    // board edge: a wooden frame
    const fx0 = x0 - 1, fx1 = x1 + 1;
    for (const [w, d, x, z] of [[fx1 - fx0, 0.8, (fx0 + fx1) / 2, -14.5], [fx1 - fx0, 0.8, (fx0 + fx1) / 2, 14.5], [0.8, 29.8, fx0, 0], [0.8, 29.8, fx1, 0]]) {
      const g = new THREE.BoxGeometry(w, 0.6, d); g.translate(x, 0.3, z); add('#8a5a32', g.toNonIndexed());
    }
    for (const [col, list] of geos) {
      for (const g of list) for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      root.add(new THREE.Mesh(mergeGeometries(list), mat(col)));
    }
    // level discs, numbers and flags
    this.flags = [];
    levels.forEach((l, i) => {
      const n = this.nodes[i];
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 16), mat('#f6f2ea')); disc.position.set(n.x, 0.38, n.z); root.add(disc);
      const lab = label(l.id === 'peck' ? 'FINALE' : l.id === 'intro' ? 'INTRO' : l.name, '#ffffff', '#2b1d12', 256, 96, 64);
      lab.position.set(n.x, 0.75, n.z + 0.9); lab.scale.multiplyScalar(0.75); root.add(lab);
      this.flags.push(null);
    });
    this.updateFlags(best);
    // the bus
    const bus = this.bus = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.62), mat('#e8423a')); body.position.y = 0.42; bus.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.58), mat('#ffffff')); roof.position.y = 0.76; bus.add(roof);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.46), basic('#9fd6f0')); win.position.set(0.56, 0.52, 0); bus.add(win);
    for (const [x, z] of [[-0.32, 0.32], [0.32, 0.32], [-0.32, -0.32], [0.32, -0.32]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), mat('#222')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.18, z); bus.add(w); }
    root.add(bus);
    this.busPos = this.nodes[this.sel].clone();
    this.fit();
  }
  updateFlags(best) {
    this.best = best;
    this.levels.forEach((l, i) => {
      if (this.flags[i]) this.root.remove(this.flags[i]);
      const b = best[l.id];
      const f = flagSprite(b?.stars ?? 0, true, i === this.sel);
      const n = this.nodes[i]; f.position.set(n.x, 1.55, n.z);
      this.root.add(f); this.flags[i] = f;
    });
  }
  select(i) { if (i === this.sel) return; this.sel = i; if (this.best) this.updateFlags(this.best); }
  fit() {
    const cv = this.renderer.domElement, W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight;
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
  }
  // which level node is under a screen point
  pick(px, py) {
    const cv = this.renderer.domElement, r = cv.getBoundingClientRect();
    const v = new THREE.Vector2((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    let best = -1, bd = 0.09;
    this.nodes.forEach((n, i) => { const p = n.clone().project(this.camera); const d = Math.hypot(p.x - v.x, (p.y - v.y) / this.camera.aspect * 1.2); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  draw(now, offsetX = 0) {
    const t = now / 1000;
    const goal = this.nodes[this.sel];
    // drive along the road towards the selected kitchen
    const d = goal.clone().sub(this.busPos), len = d.length();
    if (len > 0.01) { const step = Math.min(len, 0.12 + len * 0.06); const dir = d.normalize(); this.busPos.addScaledVector(dir, step); this.bus.rotation.y = Math.atan2(-dir.z, dir.x); }
    this.bus.position.set(this.busPos.x, 0.3 + Math.abs(Math.sin(t * 14)) * (len > 0.05 ? 0.04 : 0), this.busPos.z);
    // camera follows the bus from above, kitchen card on the right leaves room on the left
    this.target.lerp(new THREE.Vector3(this.busPos.x + offsetX, 0, this.busPos.z), 0.08);
    const cam = this.camera;
    cam.position.set(this.target.x, 16, this.target.z + 11.5); cam.lookAt(this.target.x, 0, this.target.z + 0.5);
    this.flags.forEach((f, i) => { if (f) f.position.y = 1.55 + (i === this.sel ? Math.sin(t * 4) * 0.08 : 0); });
    this.renderer.render(this.scene, cam);
  }
}
