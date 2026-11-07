// Les moments de l'année : la cabane se décore toute seule selon la date (Paris).
// Épiphanie, Chandeleur, Saint-Valentin, Pâques, 14 juillet, Halloween, Noël, Nouvel An.
import * as THREE from '../vendor/three.module.min.js';
import { height } from './outside.js';

// ---------- calendrier
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
export function activeEvents(date = new Date()) {
  const forced = new URLSearchParams(location.search).get('fete');
  if (forced) return forced.split(',');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date).map((p) => [p.type, +p.value || p.value]));
  const y = +parts.year, m = +parts.month, d = +parts.day;
  const today = Date.UTC(y, m - 1, d), E = easter(y), day = 864e5;
  const ev = [];
  if (m === 1 && d === 6) ev.push('epiphanie');
  if (m === 2 && d === 2) ev.push('chandeleur');
  if (m === 2 && (d === 13 || d === 14)) ev.push('valentin');
  if (today >= E - 3 * day && today <= E + 3 * day) ev.push('paques');
  if (m === 7 && d === 14) ev.push('juillet14');
  if (m === 10 && d >= 25) ev.push('halloween');
  if ((m === 12 && d >= 1) || (m === 1 && d <= 6)) ev.push('noel');
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) ev.push('nouvelan');
  return ev;
}

// ---------- petits outils
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true, ...o });
const glowMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.6 });
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function heartGeo(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.6); s.bezierCurveTo(-0.2, -0.35, -1, -0.1, -0.6, 0.45);
  s.bezierCurveTo(-0.35, 0.75, 0, 0.55, 0, 0.3); s.bezierCurveTo(0, 0.55, 0.35, 0.75, 0.6, 0.45);
  s.bezierCurveTo(1, -0.1, 0.2, -0.35, 0, -0.6);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -0.125);
  g.scale(size, size, size);
  return g;
}
function starGeo(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.25, bevelEnabled: false });
  g.translate(0, 0, -r * 0.125);
  return g;
}
function pumpkin(r, carved, glowM) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(r, 16, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), k = 1 + 0.08 * Math.cos(a * 8);
    p.setXYZ(i, x * k, y * 0.78, z * k);
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, std(0xd9772e, { flatShading: false, roughness: 0.6 })));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.12, r * 0.35, 6), std(0x5d6a35));
  stem.position.y = r * 0.85;
  stem.rotation.z = 0.2;
  g.add(stem);
  if (carved) {
    // visage gentil, pas effrayant
    const face = new THREE.Group();
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(r * 0.16, 3), glowM);
      eye.position.set(s * r * 0.33, r * 0.15, r * 0.99);
      eye.rotation.z = Math.PI / 2 * (s > 0 ? 1 : 1) + Math.PI / 6;
      face.add(eye);
    }
    const sm = new THREE.Shape();
    sm.moveTo(-0.5, 0); sm.quadraticCurveTo(0, -0.55, 0.5, 0); sm.quadraticCurveTo(0, -0.25, -0.5, 0);
    const mouth = new THREE.Mesh(new THREE.ShapeGeometry(sm), glowM);
    mouth.scale.setScalar(r * 0.75);
    mouth.position.set(0, -r * 0.12, r * 0.98);
    face.add(mouth);
    g.add(face);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createEvents(scene, { colliders }) {
  const events = activeEvents();
  const group = new THREE.Group();
  scene.add(group);
  const glows = []; // matériaux qui s'illuminent le soir
  const twinkles = []; // guirlandes qui scintillent très doucement
  const lights = [];
  const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; group.add(m); m.traverse?.((o) => { if (o.isMesh) { o.castShadow = o.castShadow || false; o.receiveShadow = true; } }); return m; };
  const MANTEL_Y = 1.48, MANTEL_Z = -5.18;
  const coffee = (dx, dz) => [0.5 + dx, 0.42, -3.65 + dz];
  const ktable = (dx, dz) => [-5.5 + dx, 0.77, -2.7 + dz];

  // ---------------- Noël
  if (events.includes('noel')) {
    const T = { x: -2.35, z: 1.5 };
    const tree = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 10), std(0xa8463a));
    pot.position.y = 0.15;
    tree.add(pot);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), std(0x5a3f2c));
    trunk.position.y = 0.4;
    tree.add(trunk);
    const greens = [0x3f6a48, 0x45734d, 0x3a6243, 0x4a7a50];
    for (let k = 0; k < 4; k++) {
      const r = 0.62 - k * 0.13, h = 0.62 - k * 0.06, y = 0.5 + k * 0.36;
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), std(greens[k]));
      c.position.y = y + h / 2;
      c.rotation.y = k;
      c.castShadow = true;
      tree.add(c);
    }
    const star = new THREE.Mesh(starGeo(0.09), glowMat(0xf2c35a));
    star.position.y = 2.12;
    tree.add(star);
    glows.push(star.material);
    // boules
    const balls = [0xb8463c, 0xe0b04a, 0xeee4d2, 0x7d95a8];
    for (let i = 0; i < 26; i++) {
      const y = 0.55 + rnd() * 1.4, rr = (1 - (y - 0.5) / 1.6) * 0.58 + 0.02, a = rnd() * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(balls[i % 4], { roughness: 0.3, metalness: 0.3, flatShading: false }));
      b.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      tree.add(b);
    }
    // guirlande lumineuse en spirale (4 groupes qui scintillent lentement)
    for (let gidx = 0; gidx < 4; gidx++) {
      const mat = glowMat([0xffd9a0, 0xffc98a, 0xfff0c8, 0xffcf9a][gidx]);
      twinkles.push({ mat, phase: gidx * 1.6 });
      for (let i = gidx; i < 60; i += 4) {
        const u = i / 60, y = 0.55 + u * 1.45, rr = (1 - (y - 0.5) / 1.6) * 0.6 + 0.03, a = u * Math.PI * 9;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat);
        l.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        tree.add(l);
      }
    }
    add(tree, T.x, 0, T.z);
    colliders.push({ x0: T.x - 0.55, x1: T.x + 0.55, z0: T.z - 0.55, z1: T.z + 0.55 });
    const tl = new THREE.PointLight(0xffc98a, 0, 3.5, 1.6);
    tl.position.set(T.x + 0.3, 1.2, T.z);
    group.add(tl);
    lights.push({ light: tl, max: 0.9 });
    // cadeaux
    const gifts = [[0.45, 0.25, 0xa8463a, 0xe0b04a], [-0.35, 0.4, 0x5f7a66, 0xeee4d2], [0.15, 0.55, 0xeee4d2, 0xb8463c], [0.5, -0.3, 0x7d95a8, 0xe0b04a]];
    for (const [dx, dz, c, rc] of gifts) {
      const s = 0.14 + rnd() * 0.1;
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), std(c));
      box.position.y = s * 0.4;
      box.castShadow = true;
      g.add(box);
      for (const rot of [0, Math.PI / 2]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(s + 0.004, s * 0.8 + 0.004, 0.025), std(rc));
        rib.position.y = s * 0.4;
        rib.rotation.y = rot;
        g.add(rib);
      }
      add(g, T.x + dx, 0, T.z + dz, rnd() * 3);
    }
    // guirlande de sapin sur la cheminée + chaussettes
    for (let i = 0; i < 22; i++) {
      const x = -0.85 + i * 0.13;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), std(greens[i % 4]));
      b.scale.set(1.2, 0.8, 0.9);
      add(b, x, MANTEL_Y + 0.02 - Math.sin((i / 21) * Math.PI) * 0.0, MANTEL_Z + 0.1);
      if (i % 2) {
        const tw = twinkles[i % 4];
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), tw.mat);
        add(l, x + 0.03, MANTEL_Y + 0.04, MANTEL_Z + 0.18);
      }
    }
    const stocking = (x, c, small) => {
      const s = small ? 0.7 : 1;
      const g = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.26 * s, 0.05), std(c));
      leg.position.y = -0.13 * s;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.09 * s, 0.05), std(c));
      foot.position.set(0.03 * s, -0.27 * s, 0);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.06 * s, 0.06), std(0xf3efe8));
      cuff.position.y = -0.01;
      g.add(leg, foot, cuff);
      if (small) { // celle de Romi, avec une petite patte
        const paw = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), std(0xf3efe8));
        paw.position.set(0, -0.14 * s, 0.027);
        g.add(paw);
      }
      return add(g, x, 1.3, MANTEL_Z + 0.17);
    };
    stocking(-0.5, 0xa8463a);
    stocking(1.45, 0x5f7a66);
    stocking(1.78, 0xa8463a, true);
    // couronne sur la porte d'entrée
    const wreath = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), std(0x3f6a48));
    wreath.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), std(0xb8463c));
      b.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.05);
      wreath.add(b);
    }
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), std(0xa8463a));
    bow.position.set(0, -0.2, 0.05);
    wreath.add(bow);
    add(wreath, 0.25, 1.5, 6.0, Math.PI);
  }

  // ---------------- Nouvel An
  if (events.includes('nouvelan')) {
    const bottle = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.2, 10), std(0x2f4a35, { roughness: 0.3, flatShading: false }));
    body.position.y = 0.1;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.04, 0.1, 10), std(0x2f4a35, { roughness: 0.3, flatShading: false }));
    neck.position.y = 0.25;
    const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.05, 8), std(0xd9b45a, { metalness: 0.6, roughness: 0.3 }));
    foil.position.y = 0.31;
    bottle.add(body, neck, foil);
    add(bottle, ...coffee(-0.32, 0.12));
    const glass = new THREE.MeshStandardMaterial({ color: 0xf6e7b8, transparent: true, opacity: 0.55, roughness: 0.1 });
    for (const dx of [-0.18, -0.08]) {
      const fl = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.09, 10), glass);
      cup.position.y = 0.15;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 5), glass);
      stem.position.y = 0.05;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.004, 10), glass);
      fl.add(cup, stem, foot);
      add(fl, ...coffee(dx, 0.2));
    }
    // guirlande dorée
    for (let i = 0; i < 16; i++) {
      const m = glowMat(i % 2 ? 0xe0b04a : 0xf3e2b0);
      m.emissiveIntensity = 0.3;
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), m);
      add(s, -0.8 + i * 0.17, MANTEL_Y + 0.25 + Math.sin(i) * 0.03, MANTEL_Z + 0.08);
    }
  }

  // ---------------- Épiphanie
  if (events.includes('epiphanie')) {
    const gal = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.015, 18), std(0xf2ede4));
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20, 1, false, 0, Math.PI * 1.75), std(0xd9a24e, { flatShading: false }));
    cake.position.y = 0.03;
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 6, 1, false, Math.PI * 1.78, Math.PI * 0.22), std(0xd9a24e, { flatShading: false }));
    slice.position.set(0.05, 0.03, 0.05);
    gal.add(plate, cake, slice);
    add(gal, ...ktable(-0.25, 0.15));
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16, 1, true), std(0xe0b04a, { metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
    crown.add(band);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 4), band.material);
      p.position.set(Math.cos(a) * 0.09, 0.05, Math.sin(a) * 0.09);
      crown.add(p);
    }
    add(crown, ...ktable(0.2, 0.32).map((v, i) => (i === 1 ? v + 0.03 : v)));
  }

  // ---------------- Chandeleur
  if (events.includes('chandeleur')) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.015, 18), std(0xf2ede4)));
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 18), std(i % 2 ? 0xe8c07a : 0xddb067, { flatShading: false }));
      c.position.set((rnd() - 0.5) * 0.015, 0.012 + i * 0.009, (rnd() - 0.5) * 0.015);
      g.add(c);
    }
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 18, 1, false, 0, Math.PI), std(0xe8c07a));
    fold.position.y = 0.1;
    g.add(fold);
    add(g, ...ktable(-0.25, 0.18));
    const jar = new THREE.Group();
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0x9a2f3a, roughness: 0.3, transparent: true, opacity: 0.85 }));
    j.position.y = 0.045;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), std(0xe8e0d0));
    lid.position.y = 0.1;
    jar.add(j, lid);
    add(jar, ...ktable(0.08, 0.38));
  }

  // ---------------- Saint-Valentin
  if (events.includes('valentin')) {
    const hearts = [0xc9505a, 0xe58a96, 0xd96b74];
    for (let i = 0; i < 9; i++) {
      const h = new THREE.Mesh(heartGeo(0.085), std(hearts[i % 3], { flatShading: false }));
      add(h, -0.75 + i * 0.32, MANTEL_Y + 0.2 - Math.sin((i / 8) * Math.PI) * 0.08, MANTEL_Z + 0.06);
    }
    // bouquet de roses
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xcfe2e6, transparent: true, opacity: 0.6, roughness: 0.1 }));
    add(vase, ...coffee(-0.05, 0.22).map((v, i) => (i === 1 ? v + 0.08 : v)));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, r = i ? 0.04 : 0;
      const [x, y, z] = coffee(-0.05 + Math.cos(a) * r, 0.22 + Math.sin(a) * r);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), std(0x4f6f45));
      add(stem, x, y + 0.2, z);
      const rose = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), std(0xb8343f));
      add(rose, x, y + 0.32 + (i ? 0 : 0.03), z);
    }
    // coussin cœur sur le canapé
    const cush = new THREE.Mesh(heartGeo(0.13), std(0xd96b74, { flatShading: false }));
    add(cush, 0.05, 0.68, -2.3, 0).rotation.x = -0.25;
  }

  // ---------------- Pâques
  if (events.includes('paques')) {
    const eggCols = [0xe9b8c4, 0xb9d3e8, 0xf2dd9b, 0xbfdcb4, 0xd7c2e8, 0xf6c9a3];
    const egg = (c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std(c, { flatShading: false, roughness: 0.5 })); m.scale.y = 1.3; return m; };
    const basket = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.08, 14, 1, true), std(0xc9a46a, { side: THREE.DoubleSide }));
    wall.position.y = 0.04;
    basket.add(wall);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 14), std(0xc9a46a));
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.03, 14), std(0xe0cf8a));
    straw.position.y = 0.06;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 5, 16, Math.PI), std(0xc9a46a));
    handle.position.y = 0.08;
    basket.add(bottom, straw, handle);
    for (let i = 0; i < 7; i++) {
      const e = egg(eggCols[i % 6]);
      const a = (i / 7) * Math.PI * 2, r = i ? 0.06 : 0;
      e.position.set(Math.cos(a) * r, 0.1 + (i ? 0 : 0.02), Math.sin(a) * r);
      e.rotation.set(rnd(), 0, rnd() * 0.6);
      basket.add(e);
    }
    add(basket, ...coffee(-0.15, 0.18));
    // œufs cachés dans la maison et le jardin
    const hidden = [[-2.6, 1.55, -0.2], [3.65, 0.86, 0.3], [6.9, 0.58, -1.65], [-6.95, 0.94, -5.7], [-1.2, null, 8.0], [1.9, null, 9.5], [2.6, null, 7.2]];
    hidden.forEach(([x, y, z], i) => add(egg(eggCols[i % 6]), x, (y ?? height(x, z) - 0.12) + 0.04, z));
    // tulipes sur la table de la cuisine
    for (let i = 0; i < 5; i++) {
      const [x, y, z] = ktable(-0.28 + (rnd() - 0.5) * 0.06, 0.25 + (rnd() - 0.5) * 0.06);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4), std(0x5d8a3e)), x, y + 0.12, z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.045, 6), std([0xe58a96, 0xf2dd9b, 0xd96b74][i % 3])), x, y + 0.25, z);
    }
    // lapin en céramique sur le buffet
    const bunny = new THREE.Group();
    const w = std(0xf3efe8, { flatShading: false });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), w); b1.scale.set(1, 1.1, 1.2); b1.position.y = 0.06;
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), w); b2.position.set(0, 0.14, 0.04);
    bunny.add(b1, b2);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), w); ear.scale.set(1, 4, 1); ear.position.set(s * 0.015, 0.2, 0.03); ear.rotation.z = s * 0.15; bunny.add(ear); }
    add(bunny, 3.62, 0.84, 1.25, -Math.PI / 2);
  }

  // ---------------- Halloween (douce)
  if (events.includes('halloween')) {
    const faceGlow = glowMat(0xffa64a);
    glows.push(faceGlow);
    add(pumpkin(0.26, true, faceGlow), 2.2, height(2.2, 9.6) - 0.04, 9.6, Math.PI);
    add(pumpkin(0.18, false), 2.85, height(2.85, 9.2) - 0.06, 9.2, 0.5);
    add(pumpkin(0.22, true, faceGlow), -1.6, height(-1.6, 9.0) - 0.05, 9.0, Math.PI + 0.3);
    const pl = new THREE.PointLight(0xff9a40, 0, 6, 1.6);
    pl.position.set(0.4, 0.6, 9.8);
    group.add(pl);
    lights.push({ light: pl, max: 1.6 });
    add(pumpkin(0.1, true, faceGlow), 1.55, MANTEL_Y + 0.08, MANTEL_Z + 0.08, 0);
    add(pumpkin(0.08, false), -0.6, MANTEL_Y + 0.06, MANTEL_Z + 0.06, 0.4);
    add(pumpkin(0.09, false), ...coffee(-0.2, 0.2).map((v, i) => (i === 1 ? v + 0.07 : v)), 0.8);
    // guirlande de feuilles d'automne
    for (let i = 0; i < 14; i++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.05, 5), std([0xd9822b, 0xc4502c, 0xe6b23a][i % 3], { side: THREE.DoubleSide }));
      add(l, -0.8 + i * 0.2, MANTEL_Y + 0.22 - Math.sin((i / 13) * Math.PI) * 0.1, MANTEL_Z + 0.06, 0).rotation.z = rnd() * 3;
    }
  }

  // ---------------- 14 juillet : lampions dans le jardin
  if (events.includes('juillet14')) {
    const posts = [[-1.4, 8.2], [2.0, 10.0], [-1.0, 13.0], [2.2, 15.8]];
    const pm = std(0x5a3f2c);
    for (const [x, z] of posts) add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), pm), x, height(x, z) - 0.12 + 1.1, z);
    const cols = [0x3d5fa8, 0xf3efe8, 0xc0453a];
    for (let s = 0; s < posts.length - 1; s++) {
      const [ax, az] = posts[s], [bx, bz] = posts[s + 1];
      const ay = height(ax, az) + 2.0, by = height(bx, bz) + 2.0;
      for (let i = 1; i < 6; i++) {
        const u = i / 6, x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = ay + (by - ay) * u - Math.sin(u * Math.PI) * 0.35;
        const m = glowMat(cols[(s * 5 + i) % 3]);
        glows.push(m);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), m);
        lamp.scale.y = 0.85;
        add(lamp, x, y - 0.1, z);
      }
    }
    // fanions sur la cheminée
    for (let i = 0; i < 12; i++) {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 3), std(cols[i % 3], { flatShading: true }));
      tri.rotation.z = Math.PI;
      add(tri, -0.8 + i * 0.24, MANTEL_Y + 0.22 - Math.sin((i / 11) * Math.PI) * 0.06, MANTEL_Z + 0.05);
    }
  }

  // ---------------- feux d'artifice lointains (Nouvel An, 14 juillet) : doux, sans bruit ni flash
  let fw = null;
  if (events.includes('nouvelan') || events.includes('juillet14')) fw = makeFireworks(group);

  function update(t, dt, sky) {
    const dusk = 1 - sky.day;
    for (const m of glows) m.emissiveIntensity = 0.25 + 1.4 * dusk;
    for (const tw of twinkles) tw.mat.emissiveIntensity = (0.35 + 1.3 * dusk) * (0.75 + 0.25 * Math.sin(t * 0.9 + tw.phase));
    for (const l of lights) l.light.intensity = l.max * dusk;
    if (fw) fw.update(t, dt, sky.night > 0.5);
  }
  return { events, update, group };
}

function makeFireworks(parent) {
  const B = 5, N = 120;
  const pos = new Float32Array(B * N * 3), col = new Float32Array(B * N * 3);
  const vel = new Float32Array(B * N * 3);
  const bursts = Array.from({ length: B }, () => ({ t: 99, c: new THREE.Color(), x: 0, y: 0, z: 0 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.6, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pts.frustumCulled = false;
  parent.add(pts);
  const palette = [0xf2d28a, 0xf0a0b4, 0x9fc4ee, 0xf6efe0, 0xc7a8ee, 0xa8e0c0];
  let next = 1;
  function spawn() {
    const b = bursts.find((x) => x.t > 3) || bursts[0];
    b.t = 0;
    b.x = (Math.random() - 0.5) * 320; b.y = 70 + Math.random() * 60; b.z = 480 + Math.random() * 220;
    b.c.set(palette[Math.floor(Math.random() * palette.length)]);
    const i0 = bursts.indexOf(b) * N;
    const sp = 18 + Math.random() * 8;
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const v = sp * (0.85 + Math.random() * 0.15);
      vel.set([Math.cos(a) * s * v, u * v, Math.sin(a) * s * v], (i0 + i) * 3);
    }
  }
  return {
    update(t, dt, active) {
      pts.visible = active || bursts.some((b) => b.t < 3);
      if (active) { next -= dt; if (next < 0) { spawn(); next = 1.4 + Math.random() * 3; } }
      bursts.forEach((b, bi) => {
        b.t += dt;
        const T = b.t, fade = T < 3 ? Math.pow(1 - T / 3, 1.6) * 0.75 : 0;
        for (let i = 0; i < N; i++) {
          const k = (bi * N + i) * 3;
          const damp = (1 - Math.exp(-T * 1.6)) / 1.6;
          pos[k] = b.x + vel[k] * damp;
          pos[k + 1] = b.y + vel[k + 1] * damp - 1.5 * T * T;
          pos[k + 2] = b.z + vel[k + 2] * damp;
          const tw = 0.75 + 0.25 * Math.sin(T * 9 + i);
          col[k] = b.c.r * fade * tw; col[k + 1] = b.c.g * fade * tw; col[k + 2] = b.c.b * fade * tw;
        }
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
