// Le potager : une serre vitrée à côté de la maison avec 6 bacs, des pots
// d'aromatiques sur le rebord de la fenêtre de la cuisine, et un frigo.
// Tout pousse en temps réel ; l'arrosage double la vitesse pendant 12 h ;
// rien ne fane ni ne meurt jamais.
import * as THREE from '../vendor/three.module.min.js';
import { GARDEN, height } from './outside.js';

const Q = new URLSearchParams(location.search);
const SPEED = Math.max(1, +Q.get('pousse') || 1); // ?pousse=500 pour tester
const HOUR = 3600e3 / SPEED;
const WET = 12 * HOUR;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const VEG = {
  tomate: { one: 'tomate', name: 'Tomates', lc: 'tomates', g: 'f', hours: 168, n: 3, yield: 9, color: 0xd9452f },
  carotte: { one: 'carotte', name: 'Carottes', lc: 'carottes', g: 'f', hours: 96, n: 8, yield: 8, color: 0xe8822e },
  salade: { one: 'salade', name: 'Salades', lc: 'salades', g: 'f', hours: 60, n: 4, yield: 4, color: 0x8cc152 },
  radis: { one: 'radis', name: 'Radis', lc: 'radis', g: 'm', hours: 36, n: 8, yield: 8, color: 0xd9476a },
  pois: { one: 'cosse de petits pois', name: 'Petits pois', lc: 'petits pois', g: 'm', hours: 96, n: 4, yield: 12, color: 0x7fb24a },
  potiron: { one: 'potiron', name: 'Potirons', lc: 'potirons', g: 'm', hours: 168, n: 2, yield: 2, color: 0xe58a2b },
  fraise: { one: 'fraise', name: 'Fraises', lc: 'fraises', g: 'f', hours: 120, n: 6, yield: 12, color: 0xd6343f },
};
export const HERBS = {
  basilic: { name: 'Basilic', art: 'Le basilic', g: 'm', hours: 72, color: 0x5fae3e },
  romarin: { name: 'Romarin', art: 'Le romarin', g: 'm', hours: 120, color: 0x4f6b4a },
  menthe: { name: 'Menthe', art: 'La menthe', g: 'f', hours: 96, color: 0x6fbf5a },
  ciboulette: { name: 'Ciboulette', art: 'La ciboulette', g: 'f', hours: 72, color: 0x5f9e45 },
};

// ---------------------------------------------------------------- matériaux et petites formes
const MATS = new Map();
const mat = (c, o) => {
  const k = c + (o ? JSON.stringify(o) : '');
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o }));
  return MATS.get(k);
};
const GEO = {
  sphere: new THREE.SphereGeometry(1, 8, 6),
  sphereLo: new THREE.SphereGeometry(1, 6, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
  leaf: new THREE.SphereGeometry(1, 6, 4).scale(0.5, 0.12, 1).translate(0, 0, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
};
function part(g, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, typeof c === 'number' ? mat(c) : c);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz, 'YXZ');
  m.castShadow = true;
  g.add(m);
  return m;
}
const leafAt = (g, c, x, y, z, len, yaw, tilt, w = 0.45) => part(g, GEO.leaf, c, x, y, z, len * w * 2, len, len, -tilt, yaw);
const stem = (g, c, x, y, z, h, r = 0.008, rx = 0, rz = 0) => part(g, GEO.cyl, c, x, y, z, r, h, r, rx, 0, rz);
const ball = (g, c, x, y, z, r, sy = 1) => part(g, GEO.sphere, c, x, y, z, r, r * sy, r);
const mixC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHex();

// ---------------------------------------------------------------- les plantes, selon leur avancement p (0 → 1 = mûr)
function seedling(g, p, rnd) {
  // petite butte de terre + germe
  ball(g, 0x3e2b1e, 0, 0.0, 0, 0.035, 0.35);
  const s = smooth(0.02, 0.12, p);
  if (s > 0) {
    stem(g, 0x7aa84d, 0, 0, 0, 0.03 * s, 0.004);
    leafAt(g, 0x8cc152, 0, 0.03 * s, 0, 0.025 * s, 0, 0.4);
    leafAt(g, 0x8cc152, 0, 0.03 * s, 0, 0.025 * s, Math.PI, 0.4);
  }
}
const BUILD = {
  tomate(g, p, rnd) {
    if (p < 0.12) return seedling(g, p, rnd);
    const s = smooth(0.1, 0.8, p), h = 0.12 + 0.75 * s;
    stem(g, 0x8a6a46, 0.05, 0, 0.02, 1.0, 0.007); // tuteur
    stem(g, 0x5d8a3e, 0, 0, 0, h, 0.012);
    const n = 2 + Math.floor(s * 7);
    for (let i = 0; i < n; i++) {
      const y = 0.08 + (i / n) * h, a = i * 2.3;
      leafAt(g, i % 2 ? 0x4f7f38 : 0x5d8f40, 0, y, 0, 0.06 + 0.05 * s, a, -0.35);
      leafAt(g, 0x5d8f40, 0, y + 0.02, 0, 0.045 + 0.03 * s, a + 0.6, -0.2);
    }
    if (p > 0.5 && p < 0.85) for (let i = 0; i < 4; i++) ball(g, 0xf2d24a, Math.cos(i * 1.7) * 0.07, h * (0.45 + i * 0.12), Math.sin(i * 1.7) * 0.07, 0.012);
    if (p > 0.65) {
      const r = 0.018 + 0.022 * smooth(0.65, 0.95, p), col = mixC(0x7fb04a, 0xd9452f, smooth(0.86, 1, p));
      for (let i = 0; i < 3; i++) ball(g, col, Math.cos(i * 2.1 + 0.5) * 0.06, h * (0.35 + i * 0.16), Math.sin(i * 2.1 + 0.5) * 0.06, r, 0.9);
    }
  },
  carotte(g, p, rnd) {
    if (p < 0.1) return seedling(g, p, rnd);
    const s = smooth(0.08, 0.7, p);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + rnd() * 0.3, t = 0.25 + rnd() * 0.25, h = 0.08 + 0.2 * s;
      const st = stem(g, 0x5f9443, 0, 0, 0, h, 0.004, Math.cos(a) * t, Math.sin(a) * t);
      // fanes plumeuses : petites folioles le long de la tige
      for (let k = 1; k <= 4; k++) {
        const pt = new THREE.Vector3(0, (h * k) / 4, 0).applyEuler(st.rotation);
        for (const sd of [-1, 1]) leafAt(g, k % 2 ? 0x6aa14a : 0x5f9443, pt.x, pt.y, pt.z, 0.012 + 0.012 * s, a + sd * 1.3, -0.5, 0.35);
      }
    }
    if (p > 0.55) part(g, GEO.cyl, 0xe8822e, 0, -0.01, 0, 0.012 + 0.014 * smooth(0.55, 1, p), 0.025, 0.012 + 0.014 * smooth(0.55, 1, p));
  },
  salade(g, p, rnd) {
    if (p < 0.1) return seedling(g, p, rnd);
    const s = smooth(0.08, 0.95, p), R = 0.03 + 0.1 * s;
    const n = 5 + Math.floor(s * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      part(g, GEO.sphereLo, mixC(0x7fb648, 0x9acd5a, i / n), Math.cos(a) * R * 0.55, R * 0.45, Math.sin(a) * R * 0.55, R * 0.62, R * 0.5, R * 0.62, 0, a, 0.5);
    }
    ball(g, 0xc5e08a, 0, R * 0.7, 0, R * 0.55, 0.85);
  },
  radis(g, p, rnd) {
    if (p < 0.1) return seedling(g, p, rnd);
    const s = smooth(0.08, 0.75, p);
    for (let i = 0; i < 5; i++) leafAt(g, i % 2 ? 0x6aa14a : 0x5d9443, 0, 0.01, 0, 0.04 + 0.07 * s, i * 1.26 + rnd() * 0.3, 0.75);
    if (p > 0.45) ball(g, 0xd9476a, 0, 0.012, 0, 0.012 + 0.016 * smooth(0.45, 1, p), 0.9);
  },
  pois(g, p, rnd) {
    if (p < 0.1) return seedling(g, p, rnd);
    const s = smooth(0.08, 0.8, p), h = 0.1 + 0.62 * s;
    let x = 0, y = 0;
    const n = 3 + Math.floor(s * 7);
    for (let i = 0; i < n; i++) {
      const nx = Math.sin(i * 1.3) * 0.03, ny = ((i + 1) / n) * h;
      const len = Math.hypot(nx - x, ny - y);
      stem(g, 0x6f9e48, x, y, 0, len, 0.005, 0, -Math.atan2(nx - x, ny - y));
      x = nx; y = ny;
      leafAt(g, 0x7fb24a, x, y, 0, 0.035 + 0.02 * s, 0.4 + i * 2.2, -0.2, 0.7);
      if (p > 0.5 && p < 0.78 && i % 2) ball(g, 0xf4f1ea, x + 0.02, y, 0.02, 0.011);
      if (p > 0.72 && i % 2 === 0 && i > 0) {
        const L = 0.025 + 0.03 * smooth(0.72, 1, p);
        part(g, GEO.sphereLo, 0x86bf52, x + 0.025, y - L * 0.6, 0.015, 0.012, L, 0.009, 0, 0, 0.3);
      }
    }
  },
  potiron(g, p, rnd) {
    if (p < 0.12) return seedling(g, p, rnd);
    const s = smooth(0.1, 0.6, p);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.3, r = 0.08 + 0.15 * s;
      stem(g, 0x5d8a3e, Math.cos(a) * r * 0.4, 0, Math.sin(a) * r * 0.4, 0.06 + 0.08 * s, 0.007);
      part(g, GEO.sphereLo, i % 2 ? 0x4f7f38 : 0x5d8f40, Math.cos(a) * r, 0.07 + 0.08 * s, Math.sin(a) * r, 0.05 + 0.09 * s, 0.012, 0.05 + 0.09 * s, 0.25, a);
    }
    if (p > 0.5) {
      const r = 0.03 + 0.12 * smooth(0.5, 1, p);
      const m = ball(g, mixC(0x7a9a45, 0xe58a2b, smooth(0.78, 1, p)), 0.14, r * 0.78, 0.04, r, 0.78);
      stem(g, 0x5d6a35, 0.14, r * 1.5, 0.04, 0.03, 0.008);
      m.castShadow = true;
    }
  },
  fraise(g, p, rnd) {
    if (p < 0.1) return seedling(g, p, rnd);
    const s = smooth(0.08, 0.6, p);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + rnd() * 0.3, r = 0.03 + 0.05 * s, ex = Math.cos(a) * r, ez = Math.sin(a) * r, ey = 0.04 + 0.05 * s;
      stem(g, 0x5d8a3e, ex * 0.4, 0, ez * 0.4, ey, 0.004, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
      for (let k = -1; k <= 1; k++) part(g, GEO.sphereLo, 0x4f8a3a, ex + Math.cos(a + k * 0.7) * 0.02, ey, ez + Math.sin(a + k * 0.7) * 0.02, 0.018 + 0.012 * s, 0.006, 0.018 + 0.012 * s);
    }
    if (p > 0.42 && p < 0.72) for (let i = 0; i < 3; i++) { ball(g, 0xf7f3ea, Math.cos(i * 2.1) * 0.05, 0.06, Math.sin(i * 2.1) * 0.05, 0.012, 0.5); }
    if (p > 0.62) {
      const r = 0.008 + 0.012 * smooth(0.62, 0.95, p), col = mixC(0xb8d48a, 0xd6343f, smooth(0.85, 1, p));
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 1;
        const m = part(g, GEO.cone, col, Math.cos(a) * 0.07, 0.035, Math.sin(a) * 0.07, r, r * 2, r, Math.PI);
        m.position.y += r * 2;
      }
    }
  },
};
const HERB_BUILD = {
  basilic(g, p, rnd) {
    const s = smooth(0.05, 0.9, p);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6, x = Math.cos(a) * 0.02, z = Math.sin(a) * 0.02, h = 0.04 + 0.11 * s;
      stem(g, 0x5d8a3e, x, 0, z, h, 0.004);
      for (let k = 0; k < 3; k++) part(g, GEO.sphereLo, k === 2 ? 0x7cc552 : 0x5fae3e, x + Math.cos(a + k * 2) * 0.018, h * (0.5 + k * 0.25), z + Math.sin(a + k * 2) * 0.018, 0.016 + 0.014 * s, 0.009, 0.022 + 0.014 * s, 0.2, a + k * 2);
    }
  },
  romarin(g, p, rnd) {
    const s = smooth(0.05, 0.9, p);
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, t = 0.1 + rnd() * 0.25, h = 0.05 + 0.16 * s * (0.7 + rnd() * 0.4);
      const st = stem(g, 0x4f6b4a, Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015, h, 0.006, Math.cos(a) * t, Math.sin(a) * t);
      if (p > 0.9 && i % 3 === 0) { const tip = new THREE.Vector3(0, h, 0).applyEuler(st.rotation); ball(g, 0x9fb4e0, tip.x, tip.y, tip.z, 0.008); }
    }
  },
  menthe(g, p, rnd) {
    const s = smooth(0.05, 0.9, p);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26, t = 0.25, h = 0.04 + 0.1 * s;
      const st = stem(g, 0x5d8a3e, 0, 0, 0, h, 0.004, Math.cos(a) * t, Math.sin(a) * t);
      for (let k = 1; k <= 3; k++) {
        const pt = new THREE.Vector3(0, (h * k) / 3, 0).applyEuler(st.rotation);
        leafAt(g, k === 3 ? 0x85cf6a : 0x6fbf5a, pt.x, pt.y, pt.z, 0.018 + 0.012 * s, a + k * 1.6, -0.3, 0.75);
        leafAt(g, 0x6fbf5a, pt.x, pt.y, pt.z, 0.018 + 0.012 * s, a + k * 1.6 + Math.PI, -0.3, 0.75);
      }
    }
  },
  ciboulette(g, p, rnd) {
    const s = smooth(0.05, 0.85, p);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.012 + (i % 3) * 0.008, h = 0.05 + 0.18 * s * (0.75 + rnd() * 0.35);
      const st = stem(g, 0x5f9e45, Math.cos(a) * r, 0, Math.sin(a) * r, h, 0.003, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
      if (p > 0.85 && i % 4 === 0) { const tip = new THREE.Vector3(0, h, 0).applyEuler(st.rotation); ball(g, 0xb58ad9, tip.x, tip.y, tip.z, 0.012); }
    }
  },
};

// ---------------------------------------------------------------- sauvegarde
const KEY = 'detente.jardin.v1';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}

export function createGarden(scene, { colliders, getAudio }) {
  const now = () => Date.now();
  const sv = load();
  const st = {
    beds: Array.from({ length: 6 }, (_, i) => (sv?.beds?.[i] || { type: null })),
    pots: Array.from({ length: 4 }, (_, i) => (sv?.pots?.[i] || { type: null })),
    fridge: sv?.fridge || {},
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* */ } };
  addEventListener('pagehide', save);

  function advance(slot, defs) {
    if (!slot.type) return;
    const H = defs[slot.type].hours * HOUR, t = now();
    const wetDur = Math.max(0, Math.min(t, slot.wet || 0) - slot.t);
    const dry = Math.max(0, t - slot.t - wetDur);
    slot.prog = Math.min(1, slot.prog + (wetDur * 2 + dry) / H);
    slot.t = t;
  }

  // ================================================================ la serre
  const G = GARDEN, CX = (G.x0 + G.x1) / 2, CZ = (G.z0 + G.z1) / 2;
  let fy = -10;
  for (let x = G.x0 - 0.5; x <= G.x1 + 0.5; x += 0.5) for (let z = G.z0 - 0.5; z <= G.z1 + 0.5; z += 0.5) fy = Math.max(fy, height(x, z));
  const FY = fy + 0.06; // sol de la serre
  const house = new THREE.Group();
  scene.add(house);
  const wood = mat(0xe9e4da), woodDark = mat(0x7b5c41);
  const frame = (x0, y0, z0, x1, y1, z1, m = wood) => {
    const b = new THREE.Mesh(GEO.box, m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    b.scale.set(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    b.castShadow = true; b.receiveShadow = true;
    house.add(b);
    return b;
  };
  const EAVE = 2.25, RIDGE = 3.15, DOOR = { z0: 11.2, z1: 12.2 };
  // socle en pierre + sol
  frame(G.x0 - 0.1, FY - 1.2, G.z0 - 0.1, G.x1 + 0.1, FY - 0.02, G.z1 + 0.1, mat(0x8a847d));
  frame(G.x0, FY - 0.04, G.z0, G.x1, FY, G.z1, mat(0xa59c8c)); // gravier
  frame(G.x0, FY, DOOR.z0 + 0.05, G.x1 - 0.15, FY + 0.012, DOOR.z1 - 0.05, mat(0x8a6a4c)); // allée en planches
  for (let x = G.x0 + 0.3; x < G.x1 - 0.2; x += 0.45) frame(x, FY + 0.012, DOOR.z0 + 0.05, x + 0.012, FY + 0.016, DOOR.z1 - 0.05, mat(0x6b4f38));
  // marche devant la porte
  const outY = height(G.x0 - 0.6, (DOOR.z0 + DOOR.z1) / 2);
  frame(G.x0 - 0.75, Math.min(outY, FY) - 0.6, DOOR.z0 - 0.1, G.x0, (FY + outY) / 2, DOOR.z1 + 0.1, mat(0x8a847d));
  // ossature blanche
  const posts = [];
  for (let x = G.x0; x <= G.x1 + 0.01; x += (G.x1 - G.x0) / 4) posts.push([x, G.z0], [x, G.z1]);
  for (const z of [G.z0 + (G.z1 - G.z0) / 3, DOOR.z0, DOOR.z1, G.z0 + (2 * (G.z1 - G.z0)) / 3]) posts.push([G.x0, z], [G.x1, z]);
  for (const [x, z] of posts) frame(x - 0.045, FY, z - 0.045, x + 0.045, FY + EAVE, z + 0.045);
  frame(G.x0 - 0.05, FY + EAVE - 0.05, G.z0 - 0.05, G.x1 + 0.05, FY + EAVE + 0.04, G.z0 + 0.05);
  frame(G.x0 - 0.05, FY + EAVE - 0.05, G.z1 - 0.05, G.x1 + 0.05, FY + EAVE + 0.04, G.z1 + 0.05);
  frame(G.x0 - 0.05, FY + EAVE - 0.05, G.z0, G.x0 + 0.05, FY + EAVE + 0.04, G.z1);
  frame(G.x1 - 0.05, FY + EAVE - 0.05, G.z0, G.x1 + 0.05, FY + EAVE + 0.04, G.z1);
  frame(G.x0 - 0.05, FY + RIDGE - 0.05, CZ - 0.05, G.x1 + 0.05, FY + RIDGE + 0.05, CZ + 0.05); // faîtage
  frame(G.x0 - 0.04, FY + 0.6, G.z0 - 0.03, G.x1 + 0.04, FY + 0.66, G.z0 + 0.03); // lisses basses
  frame(G.x0 - 0.04, FY + 0.6, G.z1 - 0.03, G.x1 + 0.04, FY + 0.66, G.z1 + 0.03);
  frame(G.x1 - 0.03, FY + 0.6, G.z0, G.x1 + 0.03, FY + 0.66, G.z1);
  frame(G.x0 - 0.03, FY + 0.6, G.z0, G.x0 + 0.03, FY + 0.66, DOOR.z0);
  frame(G.x0 - 0.03, FY + 0.6, DOOR.z1, G.x0 + 0.03, FY + 0.66, G.z1);
  frame(G.x0 - 0.03, FY + 2.05, DOOR.z0, G.x0 + 0.03, FY + 2.12, DOOR.z1); // linteau
  // chevrons
  const halfZ = (G.z1 - G.z0) / 2, slope = Math.atan2(RIDGE - EAVE, halfZ), rl = Math.hypot(halfZ, RIDGE - EAVE);
  for (let x = G.x0; x <= G.x1 + 0.01; x += (G.x1 - G.x0) / 8) for (const s of [-1, 1]) {
    const r = new THREE.Mesh(GEO.box, wood);
    r.scale.set(0.05, 0.06, rl);
    r.position.set(x, FY + (EAVE + RIDGE) / 2, CZ + (s * halfZ) / 2);
    r.rotation.x = s * slope;
    r.castShadow = true;
    house.add(r);
  }
  // pignons (triangles) en ossature
  for (const x of [G.x0, G.x1]) frame(x - 0.03, FY + EAVE, CZ - 0.03, x + 0.03, FY + RIDGE, CZ + 0.03);
  // vitrages
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdcecf0, transparent: true, opacity: 0.13, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const pane = (w, h, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0, 'YXZ');
    m.renderOrder = 3;
    house.add(m);
    return m;
  };
  const W = G.x1 - G.x0, D = G.z1 - G.z0;
  pane(W, EAVE, CX, FY + EAVE / 2, G.z0);
  pane(W, EAVE, CX, FY + EAVE / 2, G.z1);
  pane(D, EAVE, G.x1, FY + EAVE / 2, CZ, Math.PI / 2);
  pane(DOOR.z0 - G.z0, EAVE, G.x0, FY + EAVE / 2, (G.z0 + DOOR.z0) / 2, Math.PI / 2);
  pane(G.z1 - DOOR.z1, EAVE, G.x0, FY + EAVE / 2, (DOOR.z1 + G.z1) / 2, Math.PI / 2);
  pane(DOOR.z1 - DOOR.z0, EAVE - 2.12, G.x0, FY + (2.12 + EAVE) / 2, (DOOR.z0 + DOOR.z1) / 2, Math.PI / 2);
  for (const x of [G.x0, G.x1]) {
    const tri = new THREE.Shape();
    tri.moveTo(-halfZ, 0); tri.lineTo(halfZ, 0); tri.lineTo(0, RIDGE - EAVE); tri.lineTo(-halfZ, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), glassMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(x, FY + EAVE, CZ);
    m.renderOrder = 3;
    house.add(m);
  }
  const roofPanes = [];
  for (const s of [-1, 1]) roofPanes.push(pane(W, rl, CX, FY + (EAVE + RIDGE) / 2, CZ + (s * halfZ) / 2, 0, -Math.PI / 2 + s * slope));
  // neige sur le toit (hiver)
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const roofSnow = roofPanes.map((p) => { const m = new THREE.Mesh(p.geometry, snowMat); m.position.copy(p.position); m.position.y += 0.03; m.rotation.copy(p.rotation); m.renderOrder = 4; house.add(m); return m; });
  // porte vitrée, ouverte contre la paroi
  const doorG = new THREE.Group();
  doorG.position.set(G.x0, FY, DOOR.z0);
  doorG.rotation.y = -1.9;
  house.add(doorG);
  const df = (x0, y0, x1, y1) => { const b = new THREE.Mesh(GEO.box, wood); b.position.set(0, (y0 + y1) / 2, (x0 + x1) / 2); b.scale.set(0.04, y1 - y0, x1 - x0); b.castShadow = true; doorG.add(b); };
  df(0, 0, 0.05, 2.05); df(0.95, 0, 1.0, 2.05); df(0, 0, 1.0, 0.06); df(0, 1.99, 1.0, 2.05); df(0, 0.9, 1.0, 0.95);
  const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.95), glassMat);
  dp.rotation.y = Math.PI / 2; dp.position.set(0, 1.02, 0.5); dp.renderOrder = 3;
  doorG.add(dp);
  // étagère de semis, arrosoir, tonneau de pluie, lanterne
  frame(G.x1 - 0.45, FY, G.z0 + 0.15, G.x1 - 0.1, FY + 0.04, G.z1 - 0.15, woodDark);
  for (const y of [0.45, 0.9]) frame(G.x1 - 0.45, FY + y, G.z0 + 0.15, G.x1 - 0.1, FY + y + 0.03, G.z1 - 0.15, woodDark);
  for (const z of [G.z0 + 0.2, CZ, G.z1 - 0.2]) frame(G.x1 - 0.44, FY, z - 0.02, G.x1 - 0.4, FY + 0.95, z + 0.02, woodDark);
  for (let i = 0; i < 9; i++) {
    const z = G.z0 + 0.4 + i * 0.45, y = FY + (i % 2 ? 0.93 : 0.48);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 8), mat(0xb86a4b));
    pot.position.set(G.x1 - 0.28, y + 0.045, z);
    house.add(pot);
    const sp = new THREE.Group(); sp.position.set(G.x1 - 0.28, y + 0.09, z);
    seedling(sp, 0.06 + (i % 3) * 0.03, Math.random); house.add(sp);
  }
  const can = new THREE.Group();
  can.position.set(G.x0 + 0.45, FY, DOOR.z1 + 0.25);
  const canM = mat(0x6f8f9a, { metalness: 0.4, roughness: 0.5 });
  part(can, new THREE.CylinderGeometry(0.11, 0.12, 0.24, 12).translate(0, 0.12, 0), canM, 0, 0, 0, 1, 1, 1);
  part(can, new THREE.CylinderGeometry(0.012, 0.022, 0.32, 6).translate(0, 0.16, 0), canM, 0.08, 0.1, 0, 1, 1, 1, 0, 0, -0.9);
  part(can, new THREE.TorusGeometry(0.08, 0.012, 5, 12, Math.PI), canM, -0.02, 0.24, 0, 1, 1, 1, 0, Math.PI / 2, 0);
  house.add(can);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.75, 12), mat(0x7b5c41));
  barrel.position.set(G.x0 - 0.5, height(G.x0 - 0.5, G.z0 + 0.6) + 0.3, G.z0 + 0.6);
  barrel.castShadow = true;
  house.add(barrel);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc070, emissiveIntensity: 0.3 }));
  lantern.position.set(CX, FY + RIDGE - 0.45, CZ);
  house.add(lantern);
  const cord = new THREE.Mesh(GEO.cyl, mat(0x2f2b28));
  cord.position.set(CX, FY + RIDGE - 0.35, CZ); cord.scale.set(0.004, 0.35, 0.004);
  house.add(cord);
  const glow = new THREE.PointLight(0xffc488, 0, 7, 1.6);
  glow.position.copy(lantern.position);
  house.add(glow);

  // collisions : parois (porte à l'ouest), étagère
  const wall = (x0, z0, x1, z1) => colliders.push({ x0, x1, z0, z1 });
  wall(G.x0 - 0.06, G.z0 - 0.06, G.x1 + 0.06, G.z0 + 0.06);
  wall(G.x0 - 0.06, G.z1 - 0.06, G.x1 + 0.06, G.z1 + 0.06);
  wall(G.x1 - 0.06, G.z0, G.x1 + 0.06, G.z1);
  wall(G.x0 - 0.06, G.z0, G.x0 + 0.06, DOOR.z0);
  wall(G.x0 - 0.06, DOOR.z1, G.x0 + 0.06, G.z1);
  wall(G.x1 - 0.46, G.z0, G.x1, G.z1);
  wall(G.x0 + 0.3, DOOR.z1 + 0.1, G.x0 + 0.6, DOOR.z1 + 0.4); // arrosoir

  // ================================================================ les 6 bacs
  const BW = 1.55, BD = 1.25, BH = 0.42;
  const bedX = [G.x0 + 0.4 + BW / 2, G.x0 + 0.4 + BW * 1.5 + 0.3, G.x0 + 0.4 + BW * 2.5 + 0.6];
  const beds = [];
  const soilDry = new THREE.Color(0x4a3426), soilWet = new THREE.Color(0x2e2017);
  for (let i = 0; i < 6; i++) {
    const x = bedX[i % 3], z = i < 3 ? G.z0 + 0.25 + BD / 2 : G.z1 - 0.25 - BD / 2;
    const g = new THREE.Group();
    g.position.set(x, FY, z);
    house.add(g);
    const plank = mat(0x8a6a4c);
    for (const [px, pz, sx, sz] of [[0, -BD / 2, BW, 0.06], [0, BD / 2, BW, 0.06], [-BW / 2, 0, 0.06, BD], [BW / 2, 0, 0.06, BD]]) {
      const b = new THREE.Mesh(GEO.box, plank);
      b.position.set(px, BH / 2, pz); b.scale.set(sx, BH, sz); b.castShadow = true; b.receiveShadow = true;
      g.add(b);
      for (let k = 1; k < 3; k++) { const l = new THREE.Mesh(GEO.box, mat(0x6b4f38)); l.position.set(px, (BH * k) / 3, pz); l.scale.set(sx + 0.005, 0.012, sz + 0.005); g.add(l); }
    }
    const soilMat = new THREE.MeshStandardMaterial({ color: soilDry.clone(), roughness: 1, flatShading: true });
    const sg = new THREE.PlaneGeometry(BW - 0.06, BD - 0.06, 8, 6);
    const sp = sg.attributes.position;
    for (let k = 0; k < sp.count; k++) sp.setZ(k, Math.random() * 0.025);
    sg.computeVertexNormals();
    const soil = new THREE.Mesh(sg, soilMat);
    soil.rotation.x = -Math.PI / 2; soil.position.y = BH - 0.04; soil.receiveShadow = true;
    g.add(soil);
    const plants = new THREE.Group(); plants.position.y = BH - 0.03;
    g.add(plants);
    const extra = new THREE.Group(); g.add(extra); // treillis, étiquette
    const hit = new THREE.Mesh(new THREE.BoxGeometry(BW, 1.1, BD), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.55; hit.userData = { kind: 'bed', i };
    g.add(hit);
    colliders.push({ x0: x - BW / 2 - 0.02, x1: x + BW / 2 + 0.02, z0: z - BD / 2 - 0.02, z1: z + BD / 2 + 0.02 });
    beds.push({ g, plants, extra, soilMat, hit, key: '' });
  }
  function slotPositions(type) {
    const n = VEG[type].n, cols = n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push([((c + 0.5) / cols - 0.5) * (BW - 0.35), ((r + 0.5) / rows - 0.5) * (BD - 0.35)]);
    }
    return out;
  }
  const disposeGroup = (grp) => { while (grp.children.length) grp.remove(grp.children[0]); };
  function drawBed(i) {
    const s = st.beds[i], B = beds[i];
    const q = s.type ? Math.floor((s.prog || 0) * 40) : -1;
    const wet = s.type && (s.wet || 0) > now();
    const key = `${s.type}|${q}|${wet}`;
    B.soilMat.color.copy(wet ? soilWet : soilDry);
    if (key === B.key) return;
    B.key = key;
    disposeGroup(B.plants); disposeGroup(B.extra);
    if (!s.type) return;
    let seed = (i + 1) * 977;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [px, pz] of slotPositions(s.type)) {
      const pg = new THREE.Group();
      pg.position.set(px, 0, pz);
      pg.rotation.y = rnd() * 6.28;
      BUILD[s.type](pg, s.prog || 0, rnd);
      B.plants.add(pg);
    }
    // treillis pour les petits pois
    if (s.type === 'pois') {
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(GEO.cyl, mat(0x8a6a46)); p.position.set(sx * (BW / 2 - 0.12), BH, 0); p.scale.set(0.01, 0.85, 0.01); B.extra.add(p); }
      for (let k = 1; k <= 4; k++) { const w = new THREE.Mesh(GEO.box, mat(0xd8cfb8)); w.position.set(0, BH + k * 0.18, 0); w.scale.set(BW - 0.24, 0.004, 0.004); B.extra.add(w); }
    }
    // étiquette en bois avec la couleur du légume
    const lab = new THREE.Mesh(GEO.box, mat(0xd9c49a));
    lab.position.set(-BW / 2 + 0.12, BH + 0.1, -BD / 2 + 0.1); lab.scale.set(0.015, 0.2, 0.015);
    B.extra.add(lab);
    const top = new THREE.Mesh(GEO.box, mat(0xd9c49a));
    top.position.set(-BW / 2 + 0.12, BH + 0.22, -BD / 2 + 0.1); top.scale.set(0.012, 0.06, 0.09);
    B.extra.add(top);
    const dot = new THREE.Mesh(GEO.sphereLo, mat(VEG[s.type].color));
    dot.position.set(-BW / 2 + 0.11, BH + 0.22, -BD / 2 + 0.1); dot.scale.setScalar(0.022);
    B.extra.add(dot);
  }

  // ================================================================ pots d'aromatiques (rebord de la fenêtre de la cuisine)
  const POTX = [-6.3, -5.9, -5.3, -4.9], POTY = 1.08, POTZ = -5.97;
  const potCols = [0xb86a4b, 0xe3d5bf, 0x8ea48a, 0xc98a6a];
  const pots = POTX.map((x, i) => {
    const g = new THREE.Group();
    g.position.set(x, POTY, POTZ);
    scene.add(g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.11, 10).translate(0, 0.055, 0), mat(potCols[i]));
    pot.castShadow = true;
    g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.008, 5, 12).rotateX(Math.PI / 2), mat(potCols[i]));
    rim.position.y = 0.11; g.add(rim);
    const soilMat = new THREE.MeshStandardMaterial({ color: soilDry.clone(), roughness: 1 });
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.058, 10).rotateX(-Math.PI / 2), soilMat);
    soil.position.y = 0.1; g.add(soil);
    const plants = new THREE.Group(); plants.position.y = 0.1; g.add(plants);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.18), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.18; hit.userData = { kind: 'pot', i };
    g.add(hit);
    return { g, plants, soilMat, hit, key: '' };
  });
  function drawPot(i) {
    const s = st.pots[i], P = pots[i];
    const q = s.type ? Math.floor((s.prog || 0) * 30) : -1;
    const wet = s.type && (s.wet || 0) > now();
    P.soilMat.color.copy(wet ? soilWet : soilDry);
    const key = `${s.type}|${q}`;
    if (key === P.key) return;
    P.key = key;
    disposeGroup(P.plants);
    if (!s.type) return;
    let seed = (i + 7) * 131;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if ((s.prog || 0) < 0.06) seedling(P.plants, s.prog || 0, rnd);
    else HERB_BUILD[s.type](P.plants, s.prog, rnd);
  }

  // ================================================================ frigo rétro (cuisine, mur ouest)
  const FX0 = -7.9, FX1 = -7.25, FZ0 = -2.0, FZ1 = -1.2, FH = 1.7;
  const fridge = new THREE.Group();
  scene.add(fridge);
  const cream = mat(0xe9e1cf, { flatShading: false, roughness: 0.4 }), inner = mat(0xf6f3ec, { flatShading: false });
  const fb = (x0, y0, z0, x1, y1, z1, m) => { const b = new THREE.Mesh(GEO.box, m); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.scale.set(x1 - x0, y1 - y0, z1 - z0); b.castShadow = true; b.receiveShadow = true; fridge.add(b); return b; };
  fb(FX0, 0.06, FZ0, FX0 + 0.05, FH, FZ1, cream); // dos
  fb(FX0, 0.06, FZ0, FX1, FH, FZ0 + 0.05, cream); // côtés
  fb(FX0, 0.06, FZ1 - 0.05, FX1, FH, FZ1, cream);
  fb(FX0, FH - 0.08, FZ0, FX1, FH, FZ1, cream); // dessus arrondi
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, FZ1 - FZ0, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2), cream);
  crown.scale.set(1, 0.18, 1); crown.position.set((FX0 + FX1) / 2, FH, (FZ0 + FZ1) / 2);
  fridge.add(crown);
  fb(FX0, 0.06, FZ0, FX1, 0.12, FZ1, cream); // fond
  fb(FX0, 0, FZ0 + 0.04, FX1 - 0.03, 0.06, FZ1 - 0.04, mat(0x9a9690)); // socle
  // intérieur : parois claires, étagères, freezer
  const backLight = fb(FX0 + 0.051, 0.12, FZ0 + 0.051, FX0 + 0.06, FH - 0.08, FZ1 - 0.051, new THREE.MeshStandardMaterial({ color: 0xf6f3ec, emissive: 0xfff6e0, emissiveIntensity: 0 }));
  fb(FX0 + 0.05, 0.12, FZ0 + 0.05, FX1 - 0.02, 0.125, FZ1 - 0.05, inner);
  const SHELF = [0.13, 0.55, 0.97];
  const glassShelf = mat(0xdfeef2, { transparent: true, opacity: 0.55, roughness: 0.1 });
  for (const y of SHELF.slice(1)) fb(FX0 + 0.06, y - 0.012, FZ0 + 0.06, FX1 - 0.03, y, FZ1 - 0.06, glassShelf);
  fb(FX0 + 0.06, 1.33, FZ0 + 0.06, FX1 - 0.03, 1.36, FZ1 - 0.06, inner); // freezer
  fb(FX1 - 0.05, 1.36, FZ0 + 0.06, FX1 - 0.03, FH - 0.09, FZ1 - 0.06, mat(0xd8d2c4));
  colliders.push({ x0: FX0 - 0.02, x1: FX1 + 0.03, z0: FZ0 - 0.02, z1: FZ1 + 0.02 });
  // porte (charnière côté nord), s'ouvre vers la pièce
  const fdoor = new THREE.Group();
  fdoor.position.set(FX1, 0.06, FZ0);
  fridge.add(fdoor);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.07, FH - 0.06, FZ1 - FZ0).translate(0.035, (FH - 0.06) / 2, (FZ1 - FZ0) / 2), cream);
  leaf.castShadow = true;
  fdoor.add(leaf);
  const inL = new THREE.Mesh(new THREE.BoxGeometry(0.01, FH - 0.2, FZ1 - FZ0 - 0.1).translate(-0.004, (FH - 0.06) / 2, (FZ1 - FZ0) / 2), inner);
  fdoor.add(inL);
  for (const y of [0.4, 0.8, 1.2]) { const tray = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, FZ1 - FZ0 - 0.14).translate(-0.04, y, (FZ1 - FZ0) / 2), inner); fdoor.add(tray); }
  const chrome = mat(0xc9c7c2, { metalness: 0.8, roughness: 0.25, flatShading: false });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.03).translate(0.09, 1.05, FZ1 - FZ0 - 0.08), chrome);
  fdoor.add(handle);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.025, 0.16).translate(0.072, 1.45, (FZ1 - FZ0) / 2), chrome);
  fdoor.add(badge);
  const fhit = new THREE.Mesh(new THREE.BoxGeometry(0.8, FH, FZ1 - FZ0 + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  fhit.position.set((FX0 + FX1) / 2 + 0.1, FH / 2, (FZ0 + FZ1) / 2); fhit.userData = { kind: 'fridge' };
  fridge.add(fhit);
  const contents = new THREE.Group();
  fridge.add(contents);
  let fOpen = false, fAngle = 0, fTimer = 0, fKey = '';
  // ce qu'on range, et où
  const ITEM = {
    potiron: { shelf: 0, max: 2, w: 0.25, make: (g) => { const m = ball(g, 0xe58a2b, 0, 0.075, 0, 0.09, 0.78); stem(g, 0x5d6a35, 0, 0.13, 0, 0.03, 0.01); return m; } },
    salade: { shelf: 0, max: 3, w: 0.16, make: (g) => { ball(g, 0x9acd5a, 0, 0.06, 0, 0.07, 0.85); ball(g, 0xc5e08a, 0, 0.09, 0, 0.045); } },
    tomate: { shelf: 1, max: 9, w: 0.075, make: (g) => { ball(g, 0xd9452f, 0, 0.032, 0, 0.034, 0.88); stem(g, 0x5d8a3e, 0, 0.06, 0, 0.012, 0.006); } },
    fraise: { shelf: 1, max: 12, w: 0.04, make: (g) => { const m = part(g, GEO.cone, 0xd6343f, 0, 0.04, 0, 0.016, 0.035, 0.016, Math.PI); ball(g, 0x5d8a3e, 0, 0.042, 0, 0.012, 0.3); return m; } },
    radis: { shelf: 1, max: 8, w: 0.05, make: (g) => { ball(g, 0xd9476a, 0, 0.022, 0, 0.022, 0.9); leafAt(g, 0x6aa14a, 0, 0.04, 0, 0.05, 0, 0.6); } },
    carotte: { shelf: 2, max: 8, w: 0.045, make: (g) => { part(g, GEO.cone, 0xe8822e, 0, 0.018, 0.0, 0.017, 0.16, 0.017, -Math.PI / 2, 0, 0); ball(g, 0x6aa14a, 0, 0.018, -0.02, 0.02, 1.2); } },
    pois: { shelf: 2, max: 12, w: 0.04, make: (g) => { part(g, GEO.sphereLo, 0x86bf52, 0, 0.012, 0, 0.012, 0.009, 0.045); } },
    basilic: { shelf: 2, max: 2, w: 0.08, herb: true }, romarin: { shelf: 2, max: 2, w: 0.08, herb: true }, menthe: { shelf: 2, max: 2, w: 0.08, herb: true }, ciboulette: { shelf: 2, max: 2, w: 0.08, herb: true },
  };
  function drawFridge() {
    const key = JSON.stringify(st.fridge);
    if (key === fKey) return;
    fKey = key;
    disposeGroup(contents);
    const cursor = [0, 0, 0], row = [0, 0, 0];
    const depthRows = [FX1 - 0.12, FX1 - 0.3, FX1 - 0.48];
    for (const [type, I] of Object.entries(ITEM)) {
      const n = Math.min(I.max, st.fridge[type] || 0);
      for (let k = 0; k < n; k++) {
        const sh = I.shelf;
        if (cursor[sh] + I.w > FZ1 - FZ0 - 0.14) { cursor[sh] = 0; row[sh]++; }
        if (row[sh] > 2) break;
        const g = new THREE.Group();
        g.position.set(depthRows[row[sh]], 0.06 + SHELF[sh], FZ0 + 0.08 + cursor[sh] + I.w / 2);
        g.rotation.y = (k * 1.7) % 6.28;
        if (I.herb) {
          // petit bouquet attaché
          for (let j = 0; j < 7; j++) stem(g, HERBS[type].color, (j % 3 - 1) * 0.008, 0.01, (Math.floor(j / 3) - 1) * 0.008, 0.11, 0.004, 0, 0.12 * (j - 3) / 3);
          for (let j = 0; j < 5; j++) ball(g, HERBS[type].color, (j - 2) * 0.01, 0.1 + (j % 2) * 0.02, 0, 0.018, 0.6);
          part(g, GEO.cyl, 0xd9c49a, 0, 0.03, 0, 0.012, 0.012, 0.012);
          g.rotation.z = -Math.PI / 2 + 0.2;
          g.position.y += 0.02;
        } else I.make(g);
        contents.add(g);
        cursor[sh] += I.w;
      }
    }
  }

  // ================================================================ menus (planter)
  const sheet = document.createElement('div');
  sheet.id = 'plant-sheet';
  document.body.appendChild(sheet);
  let menu = null;
  function openMenu(title, options, onPick) {
    sheet.innerHTML = '';
    const h = document.createElement('p'); h.className = 'ps-title'; h.textContent = title; sheet.appendChild(h);
    const wrap = document.createElement('div'); wrap.className = 'ps-opts'; sheet.appendChild(wrap);
    for (const [k, d] of options) {
      const b = document.createElement('button');
      b.innerHTML = `<span class="ps-dot" style="background:#${new THREE.Color(d.color).getHexString()}"></span>${d.name}`;
      b.addEventListener('click', () => { closeMenu(); onPick(k); });
      wrap.appendChild(b);
    }
    const c = document.createElement('button'); c.className = 'ps-cancel'; c.textContent = 'Annuler';
    c.addEventListener('click', closeMenu);
    sheet.appendChild(c);
    sheet.classList.add('on');
    menu = true;
  }
  function closeMenu() { sheet.classList.remove('on'); menu = null; }

  // messages éphémères (affichés par l'indice discret en haut)
  let flashMsg = '', flashT = 0;
  const flash = (m, d = 3) => { flashMsg = m; flashT = d; };
  const pct = (p) => `${Math.round(p * 100)} %`;
  const ready = (g) => (g === 'f' ? 'prêtes' : 'prêts');

  // ================================================================ actions
  function plant(slot, type) { Object.assign(slot, { type, prog: 0, t: now(), wet: 0 }); save(); }
  function water(slot, i, kind) {
    slot.wet = now() + WET;
    save();
    getAudio()?.pour();
    splash(kind === 'bed' ? beds[i].g.position : pots[i].g.position, kind === 'bed' ? 0.42 : 0.12, kind === 'bed' ? 0.6 : 0.06);
  }
  function tapBed(i) {
    const s = st.beds[i];
    advance(s, VEG);
    if (!s.type) {
      openMenu('Que veux-tu planter ?', Object.entries(VEG), (k) => { plant(s, k); drawBed(i); flash(`${VEG[k].name} planté${VEG[k].g === 'f' ? 'es' : 's'}. Touche le bac pour arroser.`); });
      return;
    }
    const d = VEG[s.type];
    if (s.prog >= 1) {
      st.fridge[s.type] = (st.fridge[s.type] || 0) + d.yield;
      Object.assign(s, { type: null, prog: 0, wet: 0 });
      save();
      drawBed(i);
      getAudio()?.pick?.();
      flash(`+${d.yield} ${d.lc}, rangé${d.g === 'f' ? 'es' : 's'} dans le frigo`);
      return;
    }
    if ((s.wet || 0) < now()) { water(s, i, 'bed'); flash(`${d.name} arrosé${d.g === 'f' ? 'es' : 's'} · ${pct(s.prog)}`); }
    else flash(`${d.name} · ${pct(s.prog)} · déjà arrosé${d.g === 'f' ? 'es' : 's'}`);
  }
  function tapPot(i) {
    const s = st.pots[i];
    advance(s, HERBS);
    if (!s.type) {
      openMenu('Quelle aromatique ?', Object.entries(HERBS), (k) => { plant(s, k); drawPot(i); flash(`${HERBS[k].name} planté${HERBS[k].g === 'f' ? 'e' : ''}. Touche le pot pour arroser.`); });
      return;
    }
    const d = HERBS[s.type];
    if (s.prog >= 1) {
      st.fridge[s.type] = (st.fridge[s.type] || 0) + 1;
      s.prog = 0.55; s.t = now(); // on cueille un bouquet, ça repousse
      save(); drawPot(i);
      getAudio()?.pick?.();
      flash(`Un bouquet de ${d.name.toLowerCase()} dans le frigo`);
      return;
    }
    if ((s.wet || 0) < now()) { water(s, i, 'pot'); flash(`${d.name} arrosé${d.g === 'f' ? 'e' : ''} · ${pct(s.prog)}`); }
    else flash(`${d.name} · ${pct(s.prog)}`);
  }
  function tapFridge() {
    fOpen = !fOpen;
    fTimer = 25;
    getAudio()?.fridge?.(fOpen);
    if (fOpen) {
      const list = Object.entries(st.fridge).filter(([, n]) => n > 0).map(([k, n]) => VEG[k] ? `${n} ${n > 1 ? (k === 'pois' ? 'cosses de petits pois' : VEG[k].lc) : VEG[k].one}` : `${n} bouquet${n > 1 ? 's' : ''} de ${HERBS[k].name.toLowerCase()}`);
      flash(list.length ? `Frigo : ${list.join(', ')}` : 'Le frigo est vide pour l’instant', 4);
    }
  }

  // éclaboussures d'arrosage
  const drops = [];
  const dropGeo = new THREE.SphereGeometry(0.012, 4, 3), dropMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ea, transparent: true, opacity: 0.8 });
  function splash(at, y, spread) {
    for (let k = 0; k < 40; k++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.position.set(at.x + (Math.random() - 0.5) * spread * 2, at.y + y + 0.5 + Math.random() * 0.25, at.z + (Math.random() - 0.5) * spread * 1.6);
      m.userData = { vy: -Math.random() * 0.5, floor: at.y + y, delay: Math.random() * 0.8 };
      m.visible = false;
      scene.add(m);
      drops.push(m);
    }
  }

  // ================================================================ cibles pour les interactions
  const targets = [
    { pick: beds.map((b) => b.hit), range: 2.8, onTap: (h) => { tapBed(h.object.userData.i); } },
    { pick: pots.map((p) => p.hit), range: 2.4, onTap: (h) => { tapPot(h.object.userData.i); } },
    { pick: [fhit], range: 2.6, onTap: () => { tapFridge(); } },
  ];
  // le canevas touché ailleurs ferme le menu
  document.getElementById('c').addEventListener('pointerdown', () => { if (menu) closeMenu(); });

  let fridgeSeen = 0;
  function hint(p) {
    if (flashT > 0) return flashMsg;
    if (menu) return '';
    // bac le plus proche
    const inside = p.x > G.x0 && p.x < G.x1 && p.z > G.z0 && p.z < G.z1;
    if (inside) {
      let bi = -1, bd = 1.7;
      beds.forEach((b, i) => { const d = Math.hypot(p.x - b.g.position.x, p.z - b.g.position.z); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) {
        const s = st.beds[bi];
        if (!s.type) return 'Touche un bac pour planter';
        const d = VEG[s.type];
        if (s.prog >= 1) return `Les ${d.lc} sont ${ready(d.g)} : touche pour cueillir`;
        if ((s.wet || 0) < now()) return `Touche les ${d.lc} pour les arroser`;
      }
      return '';
    }
    if (Math.hypot(p.x + 5.6, p.z + 5.2) < 1.3) {
      const empty = st.pots.findIndex((s) => !s.type), ripe = st.pots.findIndex((s) => s.type && s.prog >= 1), dry = st.pots.findIndex((s) => s.type && (s.wet || 0) < now());
      if (ripe >= 0) { const d = HERBS[st.pots[ripe].type]; return `${d.art} est ${d.g === 'f' ? 'prête' : 'prêt'} : touche pour en cueillir`; }
      if (empty >= 0) return 'Touche un pot pour planter une aromatique';
      if (dry >= 0) return 'Touche un pot pour l’arroser';
    }
    if (fridgeSeen < 1 && Math.hypot(p.x + 6.9, p.z + 1.6) < 1.8 && Object.values(st.fridge).some((n) => n > 0)) return 'Touche le frigo pour l’ouvrir';
    return '';
  }

  // ================================================================ boucle
  let tick = 0;
  st.beds.forEach((s, i) => { advance(s, VEG); drawBed(i); });
  st.pots.forEach((s, i) => { advance(s, HERBS); drawPot(i); });
  drawFridge();
  function update(t, dt, sky, w, player) {
    flashT = Math.max(0, flashT - dt);
    tick -= dt;
    if (tick <= 0) {
      tick = SPEED > 1 ? 0.25 : 5;
      st.beds.forEach((s, i) => { advance(s, VEG); drawBed(i); });
      st.pots.forEach((s, i) => { advance(s, HERBS); drawPot(i); });
      drawFridge();
      if (SPEED > 1) save();
    }
    // frigo
    if (fOpen) {
      fTimer -= dt;
      if (fTimer < 0 || Math.hypot(player.x + 6.9, player.z + 1.6) > 3.2) { fOpen = false; getAudio()?.fridge?.(false); }
      if (fAngle > 0.5) fridgeSeen = 1;
    }
    fAngle += ((fOpen ? 1.95 : 0) - fAngle) * (1 - Math.exp(-dt * 5));
    fdoor.rotation.y = fAngle;
    backLight.material.emissiveIntensity = Math.min(1, fAngle) * 0.9;
    // serre : lanterne le soir, neige sur le toit
    const dusk = 1 - sky.day;
    lantern.material.emissiveIntensity = 0.2 + 1.6 * dusk;
    glow.intensity = 2.2 * dusk;
    const snow = Math.max(w.snow * 0.6, Math.min(1, (w.snowDepth || 0) / 0.05));
    snowMat.opacity = snow * 0.85;
    for (const m of roofSnow) m.visible = snow > 0.02;
    // gouttes
    for (let k = drops.length - 1; k >= 0; k--) {
      const m = drops[k], u = m.userData;
      if (u.delay > 0) { u.delay -= dt; continue; }
      m.visible = true;
      u.vy -= 9.8 * dt;
      m.position.y += u.vy * dt;
      if (m.position.y < u.floor) { scene.remove(m); drops.splice(k, 1); }
    }
  }

  const DOOR_OUT = [G.x0 - 0.7, (DOOR.z0 + DOOR.z1) / 2], DOOR_IN = [G.x0 + 0.6, (DOOR.z0 + DOOR.z1) / 2];
  const inside = (x, z) => x > G.x0 && x < G.x1 && z > G.z0 && z < G.z1;
  return {
    update, targets, hint, state: st, FY,
    // sol (pour marcher dans la serre et sur la marche)
    groundAt(x, z, base) {
      if (inside(x, z)) return FY;
      if (x > G.x0 - 0.75 && x <= G.x0 && z > DOOR.z0 - 0.1 && z < DOOR.z1 + 0.1) return (FY + outY) / 2;
      return base(x, z);
    },
    // itinéraire de Romi : passe par la porte de la serre
    route(ax, az, bx, bz) {
      const ia = inside(ax, az), ib = inside(bx, bz);
      if (ia === ib) return [[bx, bz]];
      const nearDoor = Math.abs(az - DOOR_OUT[1]) < 0.45 && ax > DOOR_OUT[0] - 0.3 && ax < DOOR_IN[0] + 0.3;
      if (nearDoor) return ia ? [DOOR_OUT, [bx, bz]] : [DOOR_IN, [bx, bz]];
      return ia ? [DOOR_IN, DOOR_OUT, [bx, bz]] : [DOOR_OUT, DOOR_IN, [bx, bz]];
    },
    debug: { tapBed, tapPot, tapFridge, beds, pots },
  };
}
