// Romi : chatte blanche à taches tigrées grises, yeux vert-jaune.
// Modèle low poly articulé + animations procédurales + petite vie autonome.
import * as THREE from '../vendor/three.module.min.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// ---------------------------------------------------------------- lieux
// Nœuds de navigation au sol (reliés automatiquement quand le passage est libre)
const NODES = [
  [0.5, -0.9], [2.0, -1.5], [2.6, -2.45], [2.95, -3.3], [1.5, -4.45], [0.5, -4.35], [-1.4, -1.3], [-2.45, -3.35], [-2.45, 2.8], [3.45, 2.8],
  [3.4, -2.6], [0.5, 1.8], [0.25, 4.6], [-1.75, 4.6], [2.9, 1.6], [-1.8, 0.8],
  [-3.55, -3.35], [-4.1, -1.5], [-4.1, -0.75], [-3.88, -0.75], [-6.6, -0.8], [-4.3, -4.55], [-6.4, -4.65], [-7.0, -2.8],
  [-3.55, 2.8], [-5.6, 2.4], [-4.75, 3.45], [-6.3, 3.3], [-5.6, 1.1],
  [4.55, 2.8], [6.0, 2.3], [4.75, 4.5], [6.0, 2.85], [5.2, 1.4],
  [4.6, -2.6], [5.4, -2.2], [5.7, -4.95], [6.7, -4.75], [5.2, -4.2],
];

// Coins favoris : point d'approche au sol, position de repos (y = hauteur), orientation
const SPOTS = {
  panier: { name: 'son panier', approach: [1.45, -4.3], pos: [1.72, 0.17, -4.97], yaw: 0.4, kind: ['sleep', 'loaf'], w: 3 },
  tapis: { name: 'le tapis devant le feu', approach: [0.5, -4.1], pos: [0.5, 0.012, -4.3], yaw: Math.PI, kind: ['loaf', 'sleep', 'side'], w: 2 },
  canape: { name: 'le canapé', approach: [1.0, -3.12], pos: [1.0, 0.53, -2.62], yaw: Math.PI, kind: ['sleep', 'loaf'], w: 2 },
  banc: { name: 'le banc de l’entrée', approach: [-1.75, 4.85], pos: [-1.75, 0.5, 5.68], yaw: 0, kind: ['loaf', 'sit'], w: 1 },
  etendoir: { name: 'l’étendoir', approach: [-4.75, 3.42], pos: [-4.75, 0.6, 4.15], yaw: 0.3, kind: ['sleep', 'loaf'], w: 2.5 },
  lit: { name: 'le lit', approach: [4.75, 4.55], pos: [5.75, 0.64, 4.75], yaw: -Math.PI / 2, kind: ['sleep', 'loaf'], w: 3 },
  bancChambre: { name: 'le banc de la chambre', approach: [6.0, 2.85], pos: [6.0, 0.5, 3.45], yaw: Math.PI, kind: ['loaf'], w: 0.7 },
  fenetre: { name: 'la banquette de la fenêtre', approach: [5.7, -4.95], pos: [5.7, 0.49, -5.7], yaw: Math.PI, kind: ['sit', 'loaf', 'sleep'], w: 3 },
  arbre: { name: 'l’arbre à chat', approach: [6.7, -4.75], pos: [7.27, 0.63, -5.2], yaw: Math.PI / 2, kind: ['loaf', 'sit'], w: 1.5 },
  arbreHaut: { name: 'le haut de l’arbre à chat', approach: [6.7, -4.75], via: [7.27, 0.63, -5.2], pos: [7.55, 1.27, -5.47], yaw: Math.PI * 0.6, kind: ['sleep', 'loaf'], w: 1.5 },
};
const BOWLS = { food: { pos: [-4.38, -0.36], approach: [-4.38, -0.64] }, water: { pos: [-3.86, -0.36], approach: [-3.86, -0.64] } };
const WAND_REST = { pos: [-0.25, -4.25], yaw: 0.6 };

// ---------------------------------------------------------------- poses
// y : hauteur du corps ; p/r : tangage/roulis ; hp/hy/hr : tête ; jambes [hanche, genou]
// tl : levée de la queue ; tc : courbure ; ts : enroulement latéral ; tw : amplitude du balancement
const POSE = {
  stand: { y: 0.25, p: 0, r: 0, hp: 0.12, hy: 0, hr: 0, ear: 0, eye: 1, mouth: 0, lf: [0, 0], rf: [0, 0], lh: [0, 0], rh: [0, 0], tl: 0.55, tc: 0.12, ts: 0, tw: 0.12 },
  greet: { y: 0.25, p: -0.05, r: 0, hp: -0.15, hy: 0, hr: 0.2, ear: 0, eye: 0.85, mouth: 0, lf: [0, 0], rf: [0, 0], lh: [0, 0], rh: [0, 0], tl: 1.35, tc: -0.12, ts: 0, tw: 0.05 },
  sit: { y: 0.157, p: -0.75, r: 0, hp: 0.82, hy: 0, hr: 0, ear: 0, eye: 1, mouth: 0, lf: [0.75, 0], rf: [0.75, 0], lh: [-0.65, 2.6], rh: [-0.65, 2.6], tl: 0.15, tc: -0.08, ts: 0.32, tw: 0.04 },
  loaf: { y: 0.12, p: 0, r: 0, hp: 0.05, hy: 0, hr: 0, ear: 0, eye: 1, mouth: 0, lf: [1.45, -2.8], rf: [1.45, -2.8], lh: [-1.45, 2.8], rh: [-1.45, 2.8], tl: -0.28, tc: 0, ts: 0.3, tw: 0.03 },
  sleep: { y: 0.11, p: 0, r: 1.3, hp: 0.5, hy: 0.55, hr: -0.25, ear: 0.25, eye: 0, mouth: 0, lf: [-0.5, 0.7], rf: [-0.25, 0.5], lh: [0.35, -0.4], rh: [0.55, -0.2], tl: 0.0, tc: 0.0, ts: 0.48, tw: 0.0 },
  side: { y: 0.115, p: 0, r: 1.35, hp: -0.1, hy: 0.25, hr: -1.05, ear: 0, eye: 1, mouth: 0, lf: [-1.0, -0.4], rf: [-0.7, -0.6], lh: [0.25, 0.3], rh: [0.45, 0.2], tl: 0.1, tc: 0.05, ts: 0.1, tw: 0.25 },
  crouch: { y: 0.16, p: 0.08, r: 0, hp: -0.12, hy: 0, hr: 0, ear: -0.2, eye: 1, mouth: 0, lf: [0.75, -1.35], rf: [0.75, -1.35], lh: [-0.95, 1.75], rh: [-0.95, 1.75], tl: -0.05, tc: 0.04, ts: 0, tw: 0.02 },
  eat: { y: 0.21, p: 0.22, r: 0, hp: 0.95, hy: 0, hr: 0, ear: 0, eye: 0.7, mouth: 0, lf: [-0.22, 0.3], rf: [-0.22, 0.3], lh: [-0.42, 0.5], rh: [-0.42, 0.5], tl: 0.35, tc: 0.08, ts: 0, tw: 0.05 },
  stretch: { y: 0.2, p: 0.48, r: 0, hp: -0.45, hy: 0, hr: 0, ear: 0.1, eye: 0.15, mouth: 0.75, lf: [-1.25, 0], rf: [-1.25, 0], lh: [-0.5, 0], rh: [-0.5, 0], tl: 0.55, tc: 0.1, ts: 0, tw: 0.02 },
  leap: { y: 0.25, p: -0.25, r: 0, hp: 0.3, hy: 0, hr: 0, ear: 0.1, eye: 1, mouth: 0, lf: [-1.0, 0.2], rf: [-1.0, 0.2], lh: [0.9, 0.3], rh: [0.9, 0.3], tl: 0.3, tc: 0, ts: 0, tw: 0 },
};
POSE.groom = { ...POSE.sit, rf: [-1.75, 2.35], hp: 1.05, hr: 0.3, hy: -0.25, eye: 0.35 };
POSE.petSit = { ...POSE.sit, hp: 0.5, hr: 0.28, eye: 0.22, ear: 0.18, tl: 0.35, tw: 0.03 };
POSE.petLoaf = { ...POSE.loaf, hp: -0.15, hr: 0.3, eye: 0.2, ear: 0.18 };
POSE.petSleep = { ...POSE.sleep, eye: 0.15, hp: 0.25 };
const PKEYS = ['y', 'p', 'r', 'hp', 'hy', 'hr', 'ear', 'eye', 'mouth', 'tl', 'tc', 'ts', 'tw'];
const LEGS = ['lf', 'rf', 'lh', 'rh'];

// ---------------------------------------------------------------- modèle
function buildModel() {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });
  const mat = {
    white: M(0xf3efe7), grey: M(0x706c69), dark: M(0x4b4744), pink: M(0xe8a3a0),
    eye: new THREE.MeshStandardMaterial({ color: 0xb6c46a, roughness: 0.3, emissive: 0x2a3010, flatShading: true }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x14110f }), mouth: M(0x5a2f2d),
  };
  const meshes = [];
  const blob = (parent, m, sx, sy, sz, x, y, z, detail = 2, part = 'corps') => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.scale(sx, sy, sz);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.part = part;
    parent.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // corps
  const torso = blob(body, mat.white, 0.105, 0.1, 0.21, 0, 0, 0);
  blob(body, mat.white, 0.092, 0.098, 0.1, 0, -0.005, 0.12);
  blob(body, mat.white, 0.1, 0.098, 0.1, 0, 0.0, -0.12);
  // taches tigrées sur le dos (comme Romi)
  blob(body, mat.grey, 0.07, 0.05, 0.1, 0.045, 0.06, 0.03).rotation.z = -0.35;
  blob(body, mat.dark, 0.03, 0.02, 0.07, 0.06, 0.085, 0.04, 1).rotation.z = -0.4;
  blob(body, mat.grey, 0.065, 0.048, 0.085, -0.055, 0.055, -0.08).rotation.z = 0.4;
  blob(body, mat.grey, 0.06, 0.05, 0.055, 0, 0.065, -0.18);
  // tête
  const neck = new THREE.Group();
  neck.position.set(0, 0.065, 0.19);
  body.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  blob(head, mat.white, 0.072, 0.066, 0.068, 0, 0.03, 0.03, 2, 'tete');
  // calotte tigrée grise avec liseré blanc au milieu
  blob(head, mat.grey, 0.042, 0.042, 0.05, 0.033, 0.058, 0.03, 2, 'tete');
  blob(head, mat.grey, 0.042, 0.042, 0.05, -0.033, 0.058, 0.03, 2, 'tete');
  blob(head, mat.grey, 0.06, 0.045, 0.04, 0, 0.055, -0.005, 2, 'tete');
  blob(head, mat.dark, 0.012, 0.018, 0.02, 0.025, 0.08, 0.05, 1, 'tete');
  blob(head, mat.dark, 0.012, 0.018, 0.02, -0.025, 0.08, 0.05, 1, 'tete');
  blob(head, mat.white, 0.018, 0.04, 0.03, 0, 0.055, 0.075, 1, 'tete'); // liseré
  const muzzle = blob(head, mat.white, 0.042, 0.03, 0.035, 0, 0.008, 0.08, 2, 'menton');
  blob(head, mat.pink, 0.012, 0.008, 0.008, 0, 0.026, 0.112, 1, 'tete');
  const mouth = blob(head, mat.mouth, 0.016, 0.012, 0.008, 0, -0.008, 0.108, 1, 'menton');
  mouth.scale.y = 0.01;
  // yeux
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.028, 0.042, 0.085);
    head.add(eg);
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1).scale(0.015, 0.014, 0.008), mat.eye);
    eg.add(e);
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0).scale(0.0035, 0.011, 0.004), mat.pupil);
    p.position.z = 0.006;
    eg.add(p);
    eyes.push(eg);
  }
  // oreilles
  const ears = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.04, 0.078, 0.01);
    eg.rotation.z = -s * 0.32;
    head.add(eg);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.055, 4).translate(0, 0.027, 0), mat.grey);
    outer.rotation.y = Math.PI / 4;
    outer.castShadow = true;
    outer.userData.part = 'tete';
    eg.add(outer);
    meshes.push(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 3).translate(0, 0.02, 0), mat.pink);
    inner.position.set(0, 0.002, 0.008);
    eg.add(inner);
    ears.push(eg);
  }
  // moustaches
  const wg = new THREE.BufferGeometry();
  const wp = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) wp.push(s * 0.03, 0.012, 0.1, s * 0.11, 0.02 - k * 0.012, 0.085 - k * 0.006);
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  // pattes
  const legs = {};
  const legDef = { lf: [0.05, -0.04, 0.13, mat.white], rf: [-0.05, -0.04, 0.13, mat.white], lh: [0.055, -0.035, -0.13, mat.white], rh: [-0.055, -0.035, -0.13, mat.white] };
  for (const [k, [x, y, z, m]] of Object.entries(legDef)) {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    body.add(hip);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.1, 6).translate(0, -0.05, 0), k.endsWith('h') ? mat.white : m);
    up.castShadow = true;
    up.userData.part = 'corps';
    hip.add(up);
    meshes.push(up);
    if (k === 'lh') { const t = blob(hip, mat.grey, 0.03, 0.04, 0.035, 0, -0.025, 0, 1); t.userData.part = 'corps'; }
    const knee = new THREE.Group();
    knee.position.y = -0.1;
    hip.add(knee);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.1, 6).translate(0, -0.05, 0), mat.white);
    low.castShadow = true;
    knee.add(low);
    const paw = blob(knee, mat.white, 0.024, 0.015, 0.032, 0, -0.1, 0.01, 1, 'patte');
    if (k === 'lf') blob(knee, mat.dark, 0.012, 0.008, 0.014, 0.005, -0.1, 0.032, 0, 'patte'); // petite tache
    legs[k] = { hip, knee, paw };
  }
  // queue tigrée
  const tail = [];
  let parent = body;
  const seg = 0.052;
  const tg = new THREE.Group();
  tg.position.set(0, 0.04, -0.2);
  body.add(tg);
  parent = tg;
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Group();
    if (i > 0) s.position.z = -seg;
    parent.add(s);
    const r0 = 0.02 - i * 0.0015;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.9, r0, seg + 0.006, 6).rotateX(Math.PI / 2).translate(0, 0, -seg / 2), i % 2 ? mat.dark : mat.grey);
    m.castShadow = true;
    m.userData.part = 'queue';
    s.add(m);
    meshes.push(m);
    tail.push(s);
    parent = s;
  }
  // ombre douce au sol
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.position.y = 0.006;
  shadow.scale.z = 1.5;
  root.add(shadow);
  root.scale.setScalar(0.88);
  return { root, body, torso, neck, head, eyes, ears, mouth, legs, tail, shadow, meshes, muzzle };
}

// ---------------------------------------------------------------- gamelles + canne
function buildBowls(scene) {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true, ...o });
  const g = new THREE.Group();
  scene.add(g);
  // set de table
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.42).rotateX(-Math.PI / 2), M(0x8ea48a, { roughness: 1 }));
  mat.position.set((BOWLS.food.pos[0] + BOWLS.water.pos[0]) / 2, 0.006, -0.35);
  mat.receiveShadow = true;
  g.add(mat);
  const mkBowl = (x, z, col) => {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.07, 14, 1, true).translate(0, 0.035, 0), M(col));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.09, 0.065, 14, 1, true).scale(-1, 1, 1).translate(0, 0.04, 0), M(0xf2ede4));
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14).rotateX(-Math.PI / 2).translate(0, 0.01, 0), M(0xf2ede4));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.008, 4, 16).rotateX(Math.PI / 2).translate(0, 0.07, 0), M(col));
    for (const m of [outer, inner, bottom, rim]) { m.castShadow = true; m.receiveShadow = true; m.userData.bowl = true; b.add(m); }
    g.add(b);
    return b;
  };
  const food = mkBowl(BOWLS.food.pos[0], BOWLS.food.pos[1], 0xc0704f);
  const water = mkBowl(BOWLS.water.pos[0], BOWLS.water.pos[1], 0x6f8fb0);
  // croquettes
  const kib = new THREE.Group();
  food.add(kib);
  const kMat = M(0x8a5530, { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.085;
    const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012, 0), kMat);
    k.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    k.userData.h = (1 - r / 0.1) * 0.035;
    k.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    kib.add(k);
  }
  // eau
  const wMat = new THREE.MeshStandardMaterial({ color: 0x9cc9d6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8 });
  const wDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), wMat);
  water.add(wDisc);
  for (const o of [food, water]) o.traverse((m) => { if (m.isMesh) m.userData.bowl = o === food ? 'food' : 'water'; });
  kib.traverse((m) => { m.userData.bowl = 'food'; });
  wDisc.userData.bowl = 'water';

  function setLevels(f, w) {
    kib.children.forEach((k, i) => {
      const vis = i / kib.children.length < f * 1.02;
      k.visible = vis;
      k.position.y = 0.012 + (k.userData.h + 0.008) * Math.min(1, f * 1.2);
    });
    wDisc.visible = w > 0.02;
    const y = 0.012 + w * 0.05;
    wDisc.position.y = y;
    wDisc.scale.setScalar(0.09 + (y - 0.012) / 0.065 * 0.025);
  }
  const pick = [];
  g.traverse((m) => { if (m.isMesh && m.userData.bowl) pick.push(m); });
  return { group: g, food, water, setLevels, pick };
}

export function buildWand() {
  // canne en bois + ruban doré
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.8 });
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xd8a542, roughness: 0.35, metalness: 0.45, side: THREE.DoubleSide, emissive: 0x3a2508 });
  return { stickMat, ribbonMat };
}

// ---------------------------------------------------------------- Romi
export function createRomi(scene, { colliders, onMeow: meowCb } = {}) {
  const model = buildModel();
  scene.add(model.root);
  const bowls = buildBowls(scene);
  const { stickMat, ribbonMat } = buildWand();

  // canne posée au sol (on la ramasse pour jouer)
  const wandRest = new THREE.Group();
  {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.75, 5).rotateZ(Math.PI / 2), stickMat);
    stick.position.set(0, 0.01, 0);
    wandRest.add(stick);
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(-0.375 - i * 0.06, 0.004, Math.sin(i * 0.9) * 0.08));
    const rib = new THREE.Mesh(ribbonStrip(pts, 0.022), ribbonMat);
    wandRest.add(rib);
    wandRest.position.set(WAND_REST.pos[0], 0.012, WAND_REST.pos[1]);
    wandRest.rotation.y = WAND_REST.yaw;
    scene.add(wandRest);
  }

  const meow = (v) => { st.meowing = 0.55; meowCb?.(v, st); };

  // ---------- navigation
  const R0 = 0.13;
  const segClear = (ax, az, bx, bz, r = R0) => {
    for (const c of colliders) {
      const x0 = c.x0 - r, x1 = c.x1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
      // test segment / rectangle (slab)
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dz = bz - az;
      let ok = true;
      for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { ok = false; break; } }
        else {
          let u0 = (lo - p) / d, u1 = (hi - p) / d;
          if (u0 > u1) [u0, u1] = [u1, u0];
          t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok) return false;
    }
    return true;
  };
  const nodes = NODES.map(([x, z]) => ({ x, z, n: [] }));
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 4.8 && segClear(a.x, a.z, b.x, b.z)) { a.n.push([j, d]); b.n.push([i, d]); }
    }
  const nearestNode = (x, z) => {
    let best = -1, bd = 1e9, fb = -1, fbd = 1e9;
    nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < fbd) { fbd = d; fb = i; }
      if (d < bd && segClear(x, z, n.x, n.z, 0.08)) { bd = d; best = i; }
    });
    return best >= 0 ? best : fb;
  };
  function findPath(fx, fz, tx, tz) {
    if (segClear(fx, fz, tx, tz, 0.1)) return [[tx, tz]];
    const s = nearestNode(fx, fz), t = nearestNode(tx, tz);
    const dist = new Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(-1), done = new Set();
    dist[s] = 0;
    while (true) {
      let u = -1, ud = Infinity;
      dist.forEach((d, i) => { if (!done.has(i) && d < ud) { ud = d; u = i; } });
      if (u < 0 || u === t) break;
      done.add(u);
      for (const [v, w] of nodes[u].n) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    const path = [];
    for (let v = t; v >= 0; v = prev[v]) { path.unshift([nodes[v].x, nodes[v].z]); if (v === s) break; }
    // raccourcis : on saute les nœuds inutiles
    const out = [];
    let cx = fx, cz = fz;
    const full = [...path, [tx, tz]];
    let i = 0;
    while (i < full.length) {
      let j = full.length - 1;
      while (j > i && !segClear(cx, cz, full[j][0], full[j][1], 0.1)) j--;
      out.push(full[j]);
      [cx, cz] = full[j];
      i = j + 1;
    }
    return out;
  }

  // ---------- état
  const st = {
    x: 0.5, z: -3.95, y: 0, yaw: 2.6, spot: null,
    path: [], speed: 0, gait: 0, moving: false,
    jump: null, act: null, timer: 0,
    pose: { ...POSE.loaf, lf: [...POSE.loaf.lf], rf: [...POSE.loaf.rf], lh: [...POSE.loaf.lh], rh: [...POSE.loaf.rh] },
    target: 'loaf', look: null, blinkT: 2, blink: 0, earT: 3, ear: 0,
    // besoins
    hunger: 0.3, thirst: 0.3, energy: 0.8, boredom: 0.3, social: 0.5,
    food: 0.8, water: 0.8,
    purr: 0, pet: 0, interact: null, toy: null, mood: '',
    meowT: rand(8, 20),
  };
  // chargement de l'état sauvegardé (+ ce qui s'est passé en ton absence)
  const KEY = 'detente.romi.v1';
  try {
    const sv = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (sv) {
      Object.assign(st, { hunger: sv.hunger, thirst: sv.thirst, food: sv.food, water: sv.water, energy: sv.energy ?? 0.8 });
      const hours = Math.min(72, Math.max(0, (Date.now() - sv.t) / 3.6e6));
      simulateAway(hours);
    }
  } catch (e) { /* stockage indisponible */ }
  function simulateAway(hours) {
    let h = hours;
    while (h > 0) {
      const step = Math.min(0.5, h);
      st.hunger = clamp(st.hunger + step * 0.2, 0, 1);
      st.thirst = clamp(st.thirst + step * 0.25, 0, 1);
      if (st.hunger > 0.55 && st.food > 0.05) { st.food = Math.max(0, st.food - 0.34); st.hunger = Math.max(0, st.hunger - 0.6); }
      if (st.thirst > 0.55 && st.water > 0.05) { st.water = Math.max(0, st.water - 0.25); st.thirst = Math.max(0, st.thirst - 0.7); }
      h -= step;
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ hunger: st.hunger, thirst: st.thirst, food: st.food, water: st.water, energy: st.energy, t: Date.now() })); } catch (e) { /* */ }
  }
  setInterval(save, 20000);
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  bowls.setLevels(st.food, st.water);

  // ---------- déplacements
  function goTo(x, z, speed = 0.42) {
    st.path = findPath(st.x, st.z, x, z);
    st.speed = speed;
    st.moving = st.path.length > 0;
  }
  function leaveSpot(then) {
    // descend d'un meuble avant de marcher
    if (st.y > 0.06 && st.spot) {
      const s = st.spot;
      const pts = [];
      if (s.via) pts.push([...s.via]);
      pts.push([s.approach[0], 0, s.approach[1]]);
      startJumps(pts, () => { st.spot = null; then(); });
      return true;
    }
    st.spot = null;
    then();
    return false;
  }
  function startJumps(points, done) {
    const p = points.shift();
    const from = [st.x, st.y, st.z];
    const d = Math.hypot(p[0] - from[0], p[2] - from[2]);
    st.yaw = d > 0.02 ? Math.atan2(p[0] - from[0], p[2] - from[2]) : st.yaw;
    st.jump = { from, to: p, t: 0, dur: 0.38 + Math.abs(p[1] - from[1]) * 0.25 + d * 0.15, arc: 0.12 + Math.max(0, p[1] - from[1]) * 0.35, after: () => (points.length ? startJumps(points, done) : done && done()) };
  }
  function goToSpot(spot, then) {
    leaveSpot(() => {
      goTo(spot.approach[0], spot.approach[1]);
      st.onArrive = () => {
        const pts = [];
        if (spot.via) pts.push([...spot.via]);
        pts.push([...spot.pos]);
        startJumps(pts, () => { st.spot = spot; st.yaw = spot.yaw; then && then(); });
      };
    });
  }
  function walkTo(x, z, then, speed) {
    leaveSpot(() => { goTo(x, z, speed); st.onArrive = then; });
  }

  // ---------- activités
  const say = (fn) => fn;
  function setAct(kind, opts = {}) { if (st.interact) return; st.act = { kind, t: 0, ...opts }; st.mood = ''; }
  function decide(env) {
    st.look = null;
    const night = env.night;
    if (st.thirst > 0.6) return actBowl('water');
    if (st.hunger > 0.6) return actBowl('food');
    if (st.energy < 0.25 || (night && chance(0.5))) return actRest(true);
    const opts = [
      [3, () => actWander()],
      [2.2, () => actRest(false)],
      [1.6, () => actGroom()],
      [1.2, () => actSpot(SPOTS.fenetre, 'sit', rand(20, 50))],
      [st.boredom > 0.4 ? 1.4 : 0.3, () => actPlayAlone()],
      [env.playerNear && st.social > 0.3 ? 2 : 0, () => actGreet(env)],
      [0.25, () => actZoomies()],
      [1, () => actIdle()],
    ];
    let tot = opts.reduce((s, o) => s + o[0], 0), r = Math.random() * tot;
    for (const [w, f] of opts) { if ((r -= w) <= 0) return f(); }
    return actIdle();
  }
  function actIdle() { setAct('idle', { dur: rand(4, 10), pose: chance(0.6) ? 'sit' : 'stand' }); }
  function actWander() {
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    setAct('walk');
    walkTo(n.x + rand(-0.2, 0.2), n.z + rand(-0.2, 0.2), () => setAct('idle', { dur: rand(3, 8), pose: chance(0.5) ? 'sit' : 'stand' }));
  }
  function pickSpot(kind) {
    const list = Object.values(SPOTS).filter((s) => s.kind.includes(kind));
    let tot = list.reduce((a, s) => a + s.w, 0), r = Math.random() * tot;
    for (const s of list) if ((r -= s.w) <= 0) return s;
    return list[0];
  }
  function actSpot(spot, pose, dur) {
    setAct('walk');
    goToSpot(spot, () => setAct('rest', { pose, dur, spot }));
  }
  function actRest(sleepy) {
    const spot = pickSpot(sleepy ? 'sleep' : 'loaf');
    const pose = sleepy && spot.kind.includes('sleep') ? 'sleep' : 'loaf';
    actSpot(spot, pose, sleepy ? rand(70, 200) : rand(25, 70));
  }
  function actGroom() { setAct('groom', { dur: rand(6, 12) }); }
  function actBowl(which) {
    const b = BOWLS[which];
    setAct('walk');
    walkTo(b.approach[0], b.approach[1], () => {
      st.yaw = 0;
      const level = which === 'food' ? st.food : st.water;
      if (level > 0.04) setAct('eat', { which, dur: rand(6, 10) });
      else setAct('wait', { which, dur: rand(14, 28) });
    });
  }
  function actPlayAlone() {
    setAct('walk');
    walkTo(WAND_REST.pos[0] + 0.25, WAND_REST.pos[1] + 0.3, () => setAct('playAlone', { dur: rand(6, 11) }), 0.7);
  }
  function actGreet(env) {
    const p = env.player;
    const dx = st.x - p.x, dz = st.z - p.z, d = Math.hypot(dx, dz) || 1;
    const tx = p.x + (dx / d) * 0.65, tz = p.z + (dz / d) * 0.65;
    setAct('walk');
    walkTo(tx, tz, () => {
      setAct('greet', { dur: rand(5, 9) });
      if (env.playerNear) meow(1);
    }, 0.55);
  }
  function actZoomies() {
    setAct('walk');
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    walkTo(a.x, a.z, () => { const b = nodes[Math.floor(Math.random() * nodes.length)]; walkTo(b.x, b.z, () => actIdle(), 1.25); }, 1.25);
  }

  // ---------- interaction (caresses / jeu)
  const api = {
    model, bowls, wandRest, wandMats: { stickMat, ribbonMat }, state: st, spots: SPOTS, meshes: model.meshes,
    headWorld(v) { return model.head.getWorldPosition(v); },
    floorY() { return st.y; },
    beginInteraction(camPos) {
      st.interact = { mode: 'pet', cam: camPos.clone(), petT: 0 };
      st.path = []; st.moving = false; st.onArrive = null;
      const lying = st.act && st.act.kind === 'rest' && (st.act.pose === 'sleep' || st.act.pose === 'loaf');
      if (!lying) { st.yaw = Math.atan2(camPos.x - st.x, camPos.z - st.z); }
      st.act = { kind: 'interact', t: 0, pose: lying ? st.act.pose : 'sit' };
      if (st.act.pose === 'sleep') st.act.pose = 'sleep';
      if (chance(0.6)) meow(0.8);
    },
    setMode(mode) {
      if (!st.interact) return;
      st.interact.mode = mode;
      if (mode === 'play') {
        st.toy = null;
        leaveSpot(() => { st.act = { kind: 'play', t: 0, sub: 'watch', subT: 0 }; });
      } else if (st.act.kind === 'play') {
        st.act = { kind: 'interact', t: 0, pose: 'sit' };
      }
    },
    pet(dt, part) {
      st.pet = Math.min(1, st.pet + dt * 1.2);
      st.interact && (st.interact.petPart = part, st.interact.petT = 0.3);
      st.social = Math.max(0, st.social - dt * 0.05);
    },
    setToy(p, speed) { st.toy = p ? { x: p.x, y: p.y, z: p.z, speed } : null; },
    endInteraction() {
      st.interact = null; st.toy = null;
      if (st.act && (st.act.kind === 'interact' || st.act.kind === 'play')) {
        const pose = st.act.pose === 'sleep' ? 'sleep' : st.act.pose === 'loaf' ? 'loaf' : null;
        if (pose && st.spot) setAct('rest', { pose, dur: rand(20, 60), spot: st.spot });
        else setAct('idle', { dur: rand(2, 5), pose: 'sit' });
      }
    },
    fill(which) {
      if (which === 'food') st.food = 1; else st.water = 1;
      bowls.setLevels(st.food, st.water);
      save();
      // si elle attendait, elle y va
      if (st.act && st.act.kind === 'wait' && st.act.which === which) setAct('eat', { which, dur: rand(6, 10) });
    },
    debugNav() {
      const seen = new Set([0]), q = [0];
      while (q.length) { const u = q.shift(); for (const [v] of nodes[u].n) if (!seen.has(v)) { seen.add(v); q.push(v); } }
      return { nodes: nodes.length, reachable: seen.size, isolated: nodes.map((n, i) => (seen.has(i) ? null : [n.x, n.z])).filter(Boolean) };
    },
    teleport(spotName, pose) {
      const s = SPOTS[spotName];
      if (s) { st.x = s.pos[0]; st.y = s.pos[1]; st.z = s.pos[2]; st.yaw = s.yaw; st.spot = s; }
      st.path = []; st.moving = false; st.jump = null;
      setAct(pose === 'walk' ? 'idle' : 'rest', { pose: pose || 'loaf', dur: 999, spot: s });
      st.target = pose || 'loaf';
      Object.assign(st.pose, JSON.parse(JSON.stringify(POSE[st.target])));
    },
    get mood() { return moodText(); },
  };

  function moodText() {
    if (st.interact && st.pet > 0.3) return 'ronronne';
    if (st.interact && st.act?.kind === 'interact') return st.act.pose === 'sleep' ? 'somnole' : st.act.pose === 'loaf' ? 'se repose' : 'te regarde';
    if (st.act?.kind === 'wait') return st.act.which === 'food' ? 'attend ses croquettes' : 'attend de l’eau';
    if (st.act?.kind === 'rest' && st.act.pose === 'sleep') return 'dort';
    if (st.act?.kind === 'eat') return st.act.which === 'food' ? 'mange' : 'boit';
    if (st.act?.kind === 'play' || st.act?.kind === 'playAlone') return 'joue';
    if (st.hunger > 0.6 && st.food < 0.05) return 'a faim';
    if (st.thirst > 0.6 && st.water < 0.05) return 'a soif';
    if (st.act?.kind === 'groom') return 'fait sa toilette';
    return 'se promène';
  }

  // ---------- mise à jour
  const tmpV = new THREE.Vector3();
  let time = 0;
  function update(dt, env) {
    time += dt;
    // besoins (faim et soif en heures réelles ; énergie et ennui en minutes)
    st.hunger = clamp(st.hunger + dt / 3600 * 0.2, 0, 1);
    st.thirst = clamp(st.thirst + dt / 3600 * 0.25, 0, 1);
    const resting = st.act && st.act.kind === 'rest';
    st.energy = clamp(st.energy + dt * (resting ? (st.act.pose === 'sleep' ? 0.012 : 0.004) : -0.0016), 0, 1);
    st.boredom = clamp(st.boredom + dt * (st.act?.kind === 'play' || st.act?.kind === 'playAlone' ? -0.02 : 0.0012), 0, 1);
    st.social = clamp(st.social + dt * 0.002, 0, 1);

    // activité courante
    if (!st.act) decide(env);
    const A = st.act;
    A.t += dt;
    let target = 'stand';
    let lookAt = null;
    switch (A.kind) {
      case 'walk':
        target = 'stand';
        if (!st.moving && !st.jump) { const cb = st.onArrive; st.onArrive = null; if (cb) cb(); else if (A.t > 1) st.act = null; }
        break;
      case 'idle':
        target = A.pose;
        if (A.t > A.dur) st.act = null;
        if (env.playerNear && chance(dt * 0.15)) st.look = 'player';
        break;
      case 'rest':
        target = A.pose;
        if (A.pose === 'sleep' && A.t > A.dur * 0.5 && st.energy > 0.95) A.dur = Math.min(A.dur, A.t + 5);
        if (A.t > A.dur) { if (A.pose === 'sleep' && chance(0.7)) setAct('stretch', { dur: 2.8 }); else st.act = null; }
        break;
      case 'groom':
        target = 'groom';
        if (A.t > A.dur) st.act = chance(0.3) ? (setAct('stretch', { dur: 2.6 }), st.act) : null;
        break;
      case 'stretch': target = 'stretch'; if (A.t > A.dur) st.act = null; break;
      case 'eat': {
        target = 'eat';
        const rate = dt / A.dur;
        if (A.which === 'food') { st.food = Math.max(0, st.food - rate * 0.34); st.hunger = Math.max(0, st.hunger - rate * 0.7); }
        else { st.water = Math.max(0, st.water - rate * 0.25); st.thirst = Math.max(0, st.thirst - rate * 0.8); }
        bowls.setLevels(st.food, st.water);
        if (A.t > A.dur || (A.which === 'food' ? st.food : st.water) <= 0.001) { st.act = chance(0.5) ? (setAct('groom', { dur: rand(5, 9) }), st.act) : null; }
        break;
      }
      case 'wait': {
        // gamelle vide : elle tourne autour et s'assoit à côté, sans détresse
        target = A.sub === 'walk' ? 'stand' : 'sit';
        if (!st.moving && A.t > 4 && chance(dt * 0.12)) {
          const b = BOWLS[A.which];
          A.sub = 'walk';
          goTo(b.approach[0] + rand(-0.45, 0.45), b.approach[1] - rand(0.05, 0.4), 0.35);
          st.onArrive = () => { A.sub = 'sit'; st.yaw = Math.atan2(b.pos[0] - st.x, b.pos[1] - st.z); };
        }
        st.meowT -= dt;
        if (env.playerNear && st.meowT < 0) { meow(0.9); st.meowT = rand(14, 30); st.look = 'player'; }
        if ((A.which === 'food' ? st.food : st.water) > 0.04 && !st.moving) { walkTo(BOWLS[A.which].approach[0], BOWLS[A.which].approach[1], () => { st.yaw = 0; setAct('eat', { which: A.which, dur: rand(6, 10) }); }); }
        if (A.t > A.dur) st.act = null;
        break;
      }
      case 'playAlone': {
        target = 'side';
        lookAt = tmpV.set(WAND_REST.pos[0], 0.05, WAND_REST.pos[1]);
        if (A.t > A.dur) st.act = null;
        break;
      }
      case 'greet':
        target = A.t < 2.5 ? 'greet' : 'sit';
        st.look = 'player';
        if (A.t > A.dur) { st.act = null; st.social = 0.1; }
        break;
      case 'interact': {
        const lying = A.pose === 'sleep' || A.pose === 'loaf';
        const petting = st.pet > 0.15;
        target = petting ? (A.pose === 'sleep' ? 'petSleep' : lying ? 'petLoaf' : 'petSit') : A.pose;
        if (!lying || A.pose === 'loaf') st.look = 'player';
        break;
      }
      case 'play': playUpdate(dt, A, env); target = A.pose || 'crouch'; lookAt = st.toy ? tmpV.set(st.toy.x, st.toy.y, st.toy.z) : null; break;
      default: target = 'stand';
    }
    if (st.moving || st.jump) target = st.jump ? 'leap' : 'stand';
    st.target = target;

    // caresses -> ronronnement
    if (st.interact && st.interact.petT > 0) st.interact.petT -= dt;
    else st.pet = Math.max(0, st.pet - dt * 0.35);
    const purrTarget = st.pet > 0.12 ? 0.6 + st.pet * 0.4 : (A.kind === 'rest' && A.pose === 'sleep' && st.interact ? 0.3 : 0);
    st.purr = lerp(st.purr, purrTarget, 1 - Math.exp(-dt * 2));

    // déplacement le long du chemin
    if (st.jump) {
      const J = st.jump;
      J.t += dt / J.dur;
      const k = Math.min(1, J.t), e = k * k * (3 - 2 * k);
      st.x = lerp(J.from[0], J.to[0], e);
      st.z = lerp(J.from[2], J.to[2], e);
      st.y = lerp(J.from[1], J.to[1], e) + Math.sin(Math.PI * k) * J.arc;
      if (k >= 1) { st.y = J.to[1]; st.jump = null; J.after(); }
    } else if (st.moving && st.path.length) {
      const [tx, tz] = st.path[0];
      const dx = tx - st.x, dz = tz - st.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const turn = wrap(want - st.yaw);
      st.yaw += clamp(turn, -dt * 4.5, dt * 4.5);
      const sp = st.speed * (Math.abs(turn) > 1.2 ? 0.25 : 1);
      const step = Math.min(d, sp * dt);
      st.x += Math.sin(st.yaw) * step;
      st.z += Math.cos(st.yaw) * step;
      st.gait += step * (st.speed > 0.8 ? 5.2 : 6.8);
      if (d < 0.05) {
        st.path.shift();
        if (!st.path.length) { st.moving = false; const cb = st.onArrive; st.onArrive = null; cb && cb(); }
      }
    }

    animate(dt, lookAt, env);
    model.root.position.set(st.x, st.y, st.z);
    model.root.rotation.y = st.yaw;
  }

  // ---------- jeu avec la canne
  function playUpdate(dt, A, env) {
    A.subT += dt;
    const T = st.toy;
    if (st.jump) return;
    if (!T) { A.pose = 'sit'; st.look = 'player'; return; }
    const dx = T.x - st.x, dz = T.z - st.z, d = Math.hypot(dx, dz);
    const face = Math.atan2(dx, dz);
    if (A.sub !== 'side') st.yaw += clamp(wrap(face - st.yaw), -dt * 5, dt * 5);
    st.boredom = Math.max(0, st.boredom - dt * 0.02);
    switch (A.sub) {
      case 'watch':
        A.pose = 'sit';
        if (d > 1.2) { A.sub = 'chase'; A.subT = 0; }
        else if (T.speed > 0.5 && d < 1.0) { A.sub = 'crouch'; A.subT = 0; A.wait = rand(0.6, 1.8); }
        else if (d < 0.4 && chance(dt * 1.5)) { A.sub = chance(0.35) ? 'side' : 'bat'; A.subT = 0; }
        break;
      case 'chase': {
        A.pose = 'stand';
        const sp = d > 2 ? 1.1 : 0.7;
        if (d > 0.5) {
          const nx = st.x + Math.sin(st.yaw) * sp * dt, nz = st.z + Math.cos(st.yaw) * sp * dt;
          if (segClear(st.x, st.z, nx, nz, 0.1)) { st.x = nx; st.z = nz; st.gait += sp * dt * 5.5; st.moving = false; st.chasing = true; }
          else { A.sub = 'watch'; }
        } else { A.sub = 'crouch'; A.subT = 0; A.wait = rand(0.5, 1.4); }
        break;
      }
      case 'crouch':
        A.pose = 'crouch';
        if (d > 1.4) { A.sub = 'chase'; A.subT = 0; }
        else if (A.subT > A.wait) {
          // bond !
          const L = Math.min(d, 0.9);
          const tx = st.x + Math.sin(st.yaw) * L, tz = st.z + Math.cos(st.yaw) * L;
          if (segClear(st.x, st.z, tx, tz, 0.1)) {
            startJumps([[tx, st.y, tz]], () => { A.sub = 'bat'; A.subT = 0; });
            st.jump.arc = 0.16; st.jump.dur = 0.36;
            if (chance(0.25)) meow(0.5);
          } else { A.sub = 'bat'; A.subT = 0; }
        }
        break;
      case 'bat':
        A.pose = 'crouch';
        if (A.subT > rand(1.2, 2.2)) { A.sub = d < 0.6 && chance(0.4) ? 'side' : 'watch'; A.subT = 0; }
        break;
      case 'side':
        A.pose = 'side';
        if (A.subT > rand(2.5, 4.5) || d > 0.9) { A.sub = 'watch'; A.subT = 0; }
        break;
    }
  }

  // ---------- animation procédurale
  const P = st.pose;
  function animate(dt, lookAt, env) {
    const tgt = POSE[st.target] || POSE.stand;
    const k = 1 - Math.exp(-dt * (st.jump ? 14 : 5));
    for (const key of PKEYS) P[key] = lerp(P[key], tgt[key], k);
    for (const L of LEGS) for (let i = 0; i < 2; i++) P[L][i] = lerp(P[L][i], tgt[L][i], k);

    const walking = (st.moving || st.chasing) && !st.jump;
    st.chasing = false;
    const m = model;
    // corps
    const breath = Math.sin(time * (st.target === 'sleep' ? 1.6 : 2.6)) * (st.target === 'sleep' ? 0.022 : 0.012);
    let by = P.y, roll = P.r, bodyX = 0;
    if (walking) by += Math.abs(Math.sin(st.gait * Math.PI)) * 0.006;
    if (st.target === 'crouch') bodyX = Math.sin(time * 9) * 0.008; // frétillement du derrière
    m.body.position.set(bodyX, by, 0);
    m.body.rotation.set(P.p, 0, roll);
    m.torso.scale.set(1 + breath * 0.6, 1 + breath, 1);
    // ombre
    m.shadow.material.opacity = 0.18 * (st.y > 0.4 ? 0.6 : 1);

    // pattes + démarche
    const offs = { lh: 0, lf: 0.25, rh: 0.5, rf: 0.75 };
    const swipe = st.act?.kind === 'play' && (st.act.sub === 'bat') ? Math.sin(time * 11) : 0;
    const sideBat = (st.target === 'side' && (st.act?.kind === 'play' || st.act?.kind === 'playAlone')) ? Math.sin(time * 7) : 0;
    for (const L of LEGS) {
      let hip = P[L][0], knee = P[L][1];
      if (walking) {
        const ph = (st.gait + offs[L]) * Math.PI * 2;
        const A = st.speed > 0.8 ? 0.7 : 0.5;
        hip += Math.sin(ph) * A;
        knee += (L.endsWith('f') ? 1 : -1) * Math.max(0, Math.cos(ph)) * 0.55;
      }
      if (L === 'rf' && swipe) { hip = -1.1 + swipe * 0.55; knee = -0.3; }
      if (L === 'lf' && sideBat) { hip += sideBat * 0.5; knee += sideBat * 0.4; }
      if (L === 'rf' && sideBat) { hip -= sideBat * 0.4; }
      if (L === 'rf' && st.target === 'groom') { hip += Math.sin(time * 4) * 0.12; }
      m.legs[L].hip.rotation.x = hip;
      m.legs[L].knee.rotation.x = knee;
    }

    // tête : regard
    let hy = P.hy, hp = P.hp, hr = P.hr;
    let look = lookAt;
    if (!look && st.look === 'player' && env.player) look = tmpV.set(env.player.x, env.player.y - 0.3, env.player.z);
    if (st.interact && !lookAt && env.cam) look = tmpV.copy(env.cam);
    if (look && st.target !== 'sleep' && st.target !== 'petSleep' && st.target !== 'eat') {
      const dx = look.x - st.x, dz = look.z - st.z;
      const yawRel = wrap(Math.atan2(dx, dz) - st.yaw);
      hy = clamp(yawRel, -1.1, 1.1) * (st.target === 'side' ? 0.4 : 1);
      const hd = Math.hypot(dx, dz);
      const dh = look.y - (st.y + 0.3);
      hp = P.hp - clamp(Math.atan2(dh, hd), -0.6, 0.8) * 0.8;
    }
    if (st.target === 'groom') { hp += Math.sin(time * 5) * 0.08; }
    if (st.target === 'eat') { hp += Math.sin(time * 6) * 0.05; }
    m.neck.rotation.set(0, 0, 0);
    m.head.rotation.set(hp, hy, hr, 'YXZ');

    // clignements, oreilles, bouche
    st.blinkT -= dt;
    if (st.blinkT < 0) { st.blink = 1; st.blinkT = rand(2.5, 6); }
    st.blink = Math.max(0, st.blink - dt * 7);
    const eyeOpen = Math.max(0.06, P.eye * (1 - Math.sin(Math.min(1, st.blink) * Math.PI) * 0.95));
    for (const e of m.eyes) e.scale.y = eyeOpen;
    st.earT -= dt;
    if (st.earT < 0) { st.ear = 1; st.earT = rand(3, 9); }
    st.ear = Math.max(0, st.ear - dt * 4);
    m.ears.forEach((e, i) => {
      const s = i ? 1 : -1;
      e.rotation.x = -P.ear * 0.9 + (i === 0 ? Math.sin(st.ear * Math.PI) * 0.4 : 0);
      e.rotation.z = -s * (0.32 + P.ear * 0.5);
    });
    const mouth = P.mouth + (st.target === 'groom' ? (Math.sin(time * 9) * 0.5 + 0.5) * 0.4 : 0) + (st.meowing > 0 ? 0.8 : 0);
    st.meowing = Math.max(0, (st.meowing || 0) - dt);
    m.mouth.scale.y = Math.max(0.01, mouth);

    // queue
    const wagAmp = P.tw + (st.target === 'crouch' ? 0.06 : 0) + (st.pet > 0.3 ? 0.03 : 0);
    const happy = st.target === 'greet' || st.target === 'petSit';
    m.tail.forEach((s, i) => {
      const w = Math.sin(time * (st.target === 'crouch' ? 6 : 1.8) - i * 0.55) * wagAmp * (0.4 + i * 0.25);
      s.rotation.x = i === 0 ? P.tl : P.tc + (happy && i > 4 ? -0.25 : 0);
      s.rotation.y = P.ts + w;
    });
  }

  api.update = update;
  api.meowed = () => { st.meowing = 0.5; };
  // départ : elle somnole dans son panier
  api.teleport('panier', 'loaf');
  st.act.dur = rand(8, 20);
  return api;
}

// bande plate pour le ruban (points dans le plan, largeur w)
export function ribbonStrip(points, w) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(points.length * 2 * 3);
  const idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[Math.min(points.length - 1, i + 1)], o = points[Math.max(0, i - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * w / 2, nz = dx / l * w / 2;
    pos.set([p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz], i * 6);
    if (i < points.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
