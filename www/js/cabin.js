// La cabane : murs, sols, pièces et mobilier (low poly doux).
//
// Plan (vue de dessus, nord = -z, est = +x), cabane de 16 m x 12 m :
//
//   z=-6  +-----------+-----------------+-----------+
//         |  Cuisine  |                 |   Coin    |
//         |           |     Salon       |  lecture  |
//   z= 0  +-----------+   (cheminée     +-----------+
//         |  Salle    |    au nord)     |  Chambre  |
//         |  de bain  |                 |           |
//   z=+6  +-----------+-----------------+-----------+
//        x=-8        x=-3              x=4         x=8
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './builder.js';
import * as TX from './textures.js';

export const H = 2.8; // hauteur sous plafond
const TOP = H + 0.12; // haut des murs (noyé dans le plafond)
const T = 0.2; // épaisseur des murs

const C = {
  wood: 0x8b5e3c, woodDark: 0x5a3b26, woodLight: 0xb7865a, woodHoney: 0xc99a64,
  frame: 0x4e3424, beam: 0x6b4630,
  stone: [0x8f8a83, 0x9e978d, 0x7c7772, 0xa8a095, 0x878079, 0x958b80, 0xa39788],
  mortar: 0x645e58, soot: 0x1b1715,
  sage: 0x8ea48a, sageDark: 0x6f8770, cream: 0xebdfc9, creamDark: 0xd6c4a6,
  terracotta: 0xc0704f, mustard: 0xcf9d4a, rose: 0xc99088, dusty: 0x7d95a8, plum: 0x8a6878,
  leaf: [0x5d7d4e, 0x6b8c58, 0x4f6f45, 0x7a9a63, 0x587a52],
  pot: 0xb86a4b, potCream: 0xe3d5bf,
  metal: 0x2f2b28, brass: 0xb08a4a, ceramic: 0xf1ece4, white: 0xf3efe8,
};
const BOOKS = [0x8a5a44, 0x6f8770, 0xb98a52, 0x7d6a8a, 0x9b4f3f, 0x56708a, 0xc9b48a, 0x5e4a3a, 0xa66b5b, 0x7a8a5a, 0xd8c7a3];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(42);
const pick = (a) => a[Math.floor(R() * a.length)];

export function buildCabin(scene, { shadows = true } = {}) {
  const B = new Builder();
  const lights = []; // lampes (position monde)
  const wp = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(B.matrix);

  // ---------- matériaux ----------
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true, ...o });
  B.defineMaterial('plain', std({}));
  B.defineMaterial('wall', std({ map: TX.logs({ base: 0xd3a676 }), flatShading: false }));
  B.defineMaterial('floor', std({ map: TX.planks({ base: 0x9a6843, count: 7, seed: 4 }), flatShading: false, roughness: 0.8 }));
  B.defineMaterial('ceiling', std({ map: TX.planks({ base: 0xc49565, count: 8, seed: 9 }), flatShading: false }));
  B.defineMaterial('terracotta', std({ map: TX.tiles({ base: 0xb8694c, n: 4, seed: 5 }), flatShading: false, roughness: 0.85 }));
  B.defineMaterial('bathtile', std({ map: TX.tiles({ base: 0xe6dccb, n: 5, seed: 6, grout: '#b9ab96', jitter: 0.06 }), flatShading: false, roughness: 0.5 }));
  B.defineMaterial('rug1', std({ map: TX.rug({ a: 0xa85c44, b: 0xe7d8bd, c: 0x6f8a78, seed: 2 }), flatShading: false }));
  B.defineMaterial('rug2', std({ map: TX.rug({ a: 0x6f8a78, b: 0xe7d8bd, c: 0xc99a54, seed: 8, round: true }), flatShading: false }));
  B.defineMaterial('rug3', std({ map: TX.rug({ a: 0x8a6878, b: 0xeadfca, c: 0xc0704f, seed: 13 }), flatShading: false }));
  B.defineMaterial('glass', new THREE.MeshStandardMaterial({ color: 0xcfe4ee, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  // abat-jours : s'illuminent plus la nuit (intensité pilotée dans main.js)
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffc58a, emissiveIntensity: 0.6, roughness: 1, flatShading: true });
  B.defineMaterial('glow', glowMat);
  B.defineMaterial('candle', new THREE.MeshBasicMaterial({ color: 0xffc070 }));

  // tapis : plan avec UV 0..1 pour garder le motif entier
  const rug = (x0, z0, x1, z1, mat) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    B.add(g, 0xffffff, mat);
  };

  // ---------- murs ----------
  // Mur le long de X à la cote z (repère local) ; ouvertures {a,b,y0,y1,kind}
  function wallRun(z, x0, x1, ops = []) {
    ops = [...ops].sort((p, q) => p.a - q.a);
    let cur = x0;
    const z0 = z - T / 2, z1 = z + T / 2;
    for (const o of ops) {
      if (o.a > cur) B.box(cur, 0, z0, o.a, TOP, z1, 0xffffff, 'wall', { uv: 2.4, collide: true });
      if (o.y0 > 0) B.box(o.a, 0, z0, o.b, o.y0, z1, 0xffffff, 'wall', { uv: 2.4, collide: true });
      if (o.y1 < H) B.box(o.a, o.y1, z0, o.b, TOP, z1, 0xffffff, 'wall', { uv: 2.4 });
      if (o.kind === 'window') windowFrame(o, z);
      else if (o.kind === 'door') {
        doorTrim(o, z);
        if (o.closed) frontDoor(o, z);
      } else if (o.kind === 'arch') doorTrim(o, z, true);
      cur = o.b;
    }
    if (x1 > cur) B.box(cur, 0, z0, x1, TOP, z1, 0xffffff, 'wall', { uv: 2.4, collide: true });
  }
  function windowFrame(o, z) {
    const { a, b, y0, y1 } = o, f = 0.08, d0 = z - T / 2 - 0.03, d1 = z + T / 2 + 0.03;
    B.box(a, y0, d0, a + f, y1, d1, C.frame);
    B.box(b - f, y0, d0, b, y1, d1, C.frame);
    B.box(a, y1 - f, d0, b, y1, d1, C.frame);
    B.box(a - 0.06, y0 - 0.05, z - T / 2 - 0.12, b + 0.06, y0 + 0.03, z + T / 2 + 0.12, C.woodDark); // rebord
    // croisillons
    const mx = (a + b) / 2, my = y0 + (y1 - y0) * 0.62;
    B.box(mx - 0.025, y0, z - 0.03, mx + 0.025, y1, z + 0.03, C.frame);
    B.box(a, my - 0.025, z - 0.03, b, my + 0.025, z + 0.03, C.frame);
    B.box(a, y0, z - 0.004, b, y1, z + 0.004, 0xffffff, 'glass');
    B.collideLocal(a, z - T / 2, b, z + T / 2);
  }
  function doorTrim(o, z, wide = false) {
    const { a, b, y1 } = o, f = wide ? 0.1 : 0.07, d0 = z - T / 2 - 0.03, d1 = z + T / 2 + 0.03;
    // l'encadrement mord légèrement dans l'ouverture : pas de faces superposées au mur
    B.box(a - f, 0, d0, a + 0.025, y1 + f, d1, C.frame);
    B.box(b - 0.025, 0, d0, b + f, y1 + f, d1, C.frame);
    B.box(a - f, y1 - 0.025, d0, b + f, y1 + f, d1, C.frame);
  }
  function frontDoor(o, z) {
    // le battant est animé à part (door.js) ; ici seulement le paillasson intérieur
    const { a, b } = o;
    B.box(a - 0.15, 0, z - T / 2 - 0.5, b + 0.15, 0.015, z - T / 2 - 0.05, C.sageDark);
  }
  // Mur le long de Z à la cote x : on tourne le repère
  function wallRunZ(x, z0, z1, ops = []) {
    B.push(x, 0, 0, -Math.PI / 2);
    wallRun(0, z0, z1, ops);
    B.pop();
  }

  const win = (a, b, y0, y1) => ({ a, b, y0, y1, kind: 'window' });
  const door = (a, b, closed = false) => ({ a, b, y0: 0, y1: 2.1, kind: 'door', closed });

  // Extérieurs
  wallRun(-6 - T / 2, -8 - T, 8 + T, [win(-6.6, -4.6, 1.05, 2.25), win(4.9, 7.3, 0.55, 2.4)]);
  wallRun(6 + T / 2, -8 - T, 8 + T, [win(-6.6, -5.4, 1.5, 2.25), win(-2.6, -1.3, 0.9, 2.2), door(-0.25, 0.75, true), win(1.7, 3.3, 0.9, 2.3), win(5.6, 6.9, 1.32, 2.3)]);
  wallRunZ(-8 - T / 2, -6.1, 6.1, [win(-4.1, -2.3, 1.0, 2.2)]);
  wallRunZ(8 + T / 2, -6.1, 6.1, [win(-5.1, -2.1, 0.55, 2.4), win(2.0, 3.4, 1.0, 2.2)]);
  // Intérieurs
  wallRunZ(-3, -6.1, 6.1, [door(-3.9, -2.8), door(2.3, 3.3)]);
  wallRunZ(4, -6.1, 6.1, [{ a: -5.2, b: -0.9, y0: 0, y1: 2.3, kind: 'arch' }, door(2.3, 3.3)]);
  wallRun(0, -8.1, -3);
  wallRun(0, 4, 8.1);

  // ---------- sols, plafond, poutres ----------
  B.box(-3, -0.1, -6, 4, 0, 6, 0xffffff, 'floor', { uv: 2.2 });
  B.box(4, -0.1, -6, 8, 0, 6, 0xffffff, 'floor', { uv: 2.2 });
  B.box(-8, -0.1, -6, -3, 0, 0, 0xffffff, 'terracotta', { uv: 1.6 });
  B.box(-8, -0.1, 0, -3, 0, 6, 0xffffff, 'bathtile', { uv: 1.5 });
  B.box(-8.3, H, -6.3, 8.3, H + 0.45, 6.3, 0xffffff, 'ceiling', { uv: 2.4 });
  for (let z = -5; z <= 5; z += 2) B.box(-8, H - 0.18, z - 0.1, 8, H, z + 0.1, C.beam);
  // plinthes discrètes
  const base = (x0, z0, x1, z1) => B.box(x0, 0, z0, x1, 0.08, z1, C.woodDark);
  base(-3 + T / 2, -6, 4 - T / 2, -5.97);

  // ================= SALON =================
  fireplace(B, C);
  rug(-1.0, -4.7, 2.0, -1.6, 'rug1');
  // canapé face à la cheminée
  B.push(0.5, 0, -2.45, Math.PI);
  sofa(B, C.sage, C.sageDark);
  B.pop();
  B.push(0.5, 0, -3.65, 0);
  coffeeTable(B);
  B.pop();
  // fauteuil tourné vers le feu
  B.push(-1.6, 0, -3.9, Math.PI * 0.62);
  armchair(B, C.terracotta);
  B.pop();
  B.push(-1.05, 0, -2.25, 0);
  sideTable(B);
  lights.push({ pos: lampTable(B, 0, 0.56, 0), room: 'salon', strength: 0.8 });
  B.pop();
  // pouf
  B.cyl(2.3, 0, -3.3, 0.3, 0.32, 0.38, C.mustard, 10, 'plain', { collide: true });
  // bibliothèque contre le mur ouest
  B.push(-3 + T / 2 + 0.2, 0, -0.4, Math.PI / 2);
  bookshelf(B, 2.2, 2.2, 0.36);
  B.pop();
  // buffet contre le mur est
  B.push(4 - T / 2 - 0.25, 0, 0.75, -Math.PI / 2);
  sideboard(B);
  B.pop();
  // entrée : banc, portemanteau
  B.push(-1.75, 0, 6 - 0.3, Math.PI);
  bench(B);
  B.pop();
  coatRack(B, 1.2, 5.6);
  B.push(-0.85, 0, 5.75, 0);
  boots(B);
  B.pop();
  plant(B, 3.55, 5.5, 'tall');
  plant(B, -2.55, -5.5, 'bush');
  plant(B, 3.5, -5.5, 'tall');
  // pile de bûches à côté de la cheminée
  logPile(B, 2.15, -5.6);
  // fauteuil de lecture côté sud du salon + lampadaire
  B.push(2.6, 0, 3.6, -Math.PI * 0.75);
  armchair(B, C.dusty);
  B.pop();
  lights.push({ pos: floorLamp(B, 3.4, 4.6), room: 'salon', strength: 0.9 });
  rug(0.6, 2.2, 3.6, 5.2, 'rug3');
  frames(B, -3 + T / 2 + 0.02, 1.6, 4.75, Math.PI / 2);
  curtains(B, 'z', 6 - 0.13, 1.7, 3.3, 2.38, C.cream);
  curtains(B, 'z', 6 - 0.13, -2.6, -1.3, 2.3, C.cream);

  // panier de Romi sur l'âtre, au chaud près du feu
  catBasket(B, 1.72, 0.1, -4.97);

  // ================= COIN LECTURE =================
  const rr = new THREE.CircleGeometry(1.45, 28);
  rr.rotateX(-Math.PI / 2);
  rr.translate(6.0, 0.012, -3.15);
  B.add(rr, 0xffffff, 'rug2');
  B.push(6.4, 0, -3.3, Math.PI * 0.82);
  armchair(B, C.mustard, true);
  B.pop();
  B.cyl(6.85, 0, -4.0, 0.24, 0.26, 0.34, C.creamDark, 10, 'plain', { collide: true }); // repose-pieds
  B.push(7.35, 0, -1.6, 0);
  sideTable(B);
  mug(B, 0.05, 0.56, 0.02);
  bookStack(B, -0.08, 0.56, -0.05, 2);
  B.pop();
  lights.push({ pos: floorLamp(B, 7.45, -2.45), room: 'lecture', strength: 1.0 });
  B.push(6.0, 0, -T / 2 - 0.17, Math.PI);
  bookshelf(B, 3.6, 2.3, 0.34);
  B.pop();
  plant(B, 4.6, -5.55, 'tall');
  // banquette sous la grande fenêtre (vue sur le lac)
  windowSeat(B, 4.95, 7.0, -5.98, -5.45);
  // arbre à chat dans l'angle des deux fenêtres
  catTree(B, 7.45, -5.35);
  // panier à plaids
  B.cyl(4.55, 0, -1.2, 0.26, 0.22, 0.4, C.woodHoney, 10, 'plain', { collide: true });
  B.blob(4.55, 0.42, -1.2, 0.24, 0.12, 0.22, C.rose, 1);
  B.blob(4.5, 0.48, -1.15, 0.2, 0.1, 0.18, C.cream, 1);

  // ================= CHAMBRE =================
  rug(4.7, 2.2, 7.6, 5.0, 'rug3');
  B.push(6.0, 0, 5.97, Math.PI);
  bed(B);
  B.pop();
  B.push(4.85, 0, 5.75, Math.PI);
  nightstand(B);
  lights.push({ pos: lampTable(B, 0, 0.55, 0), room: 'chambre', strength: 0.9 });
  B.pop();
  B.push(7.15, 0, 5.75, Math.PI);
  nightstand(B);
  bookStack(B, 0, 0.55, 0, 3);
  B.pop();
  B.push(7.3, 0, 0.45, 0);
  wardrobe(B);
  B.pop();
  B.push(5.2, 0, 0.35, 0);
  dresser(B);
  B.pop();
  plant(B, 4.38, 0.45, 'bush');
  plant(B, 7.62, 1.2, 'tall');
  // banc au pied du lit, cadres, chaise avec gilet
  B.push(6.0, 0, 3.45, 0);
  bench(B);
  B.pop();
  frames(B, 4 + T / 2 + 0.02, 1.55, 4.55, Math.PI / 2);
  B.push(7.45, 0, 2.05, -Math.PI / 2 - 0.35);
  chair(B);
  B.box(-0.2, 0.5, -0.19, 0.2, 0.86, -0.12, C.dusty); // gilet sur le dossier
  B.pop();
  curtains(B, 'x', 8 - 0.13, 2.0, 3.4, 2.3, C.sage);

  // ================= CUISINE =================
  kitchen(B, lights);

  // ================= SALLE DE BAIN =================
  bathroom(B, lights);

  const meshes = B.build(scene, { shadows });
  // Toit « d'ombre » au-dessus du plafond : invisible, il projette l'ombre du toit
  // et évite les fuites de soleil à la jonction murs/plafond.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(17.4, 0.3, 13.4),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  );
  roof.position.set(0, H + 1.05, 0);
  roof.castShadow = shadows;
  scene.add(roof);
  return { colliders: B.colliders, lights, glowMat, meshes, C };
}

// ---------------------------------------------------------------------------
// Mobilier (repère local : l'avant du meuble regarde vers +z)
// ---------------------------------------------------------------------------

function fireplace(B, C) {
  const X0 = -0.75, X1 = 1.75, Z0 = -6, Z1 = -5.25, OX0 = -0.15, OX1 = 1.15, OY0 = 0.22, OY1 = 1.12;
  // massif (mortier) + foyer
  B.box(X0, 0, Z0, X1, OY0, Z1, C.mortar, 'plain', { collide: true });
  B.box(X0, OY0, Z0, OX0, OY1, Z1, C.mortar, 'plain', { collide: true });
  B.box(OX1, OY0, Z0, X1, OY1, Z1, C.mortar, 'plain', { collide: true });
  B.box(X0, OY1, Z0, X1, H, Z1, C.mortar);
  B.box(OX0, OY0, Z0, OX1, OY1, Z0 + 0.18, C.soot);
  B.box(OX0, OY0 - 0.01, Z0, OX1, OY0 + 0.01, Z1, C.soot);
  B.box(OX0, OY0, Z0, OX0 + 0.01, OY1, Z1, C.soot);
  B.box(OX1 - 0.01, OY0, Z0, OX1, OY1, Z1, C.soot);
  B.box(OX0, OY1 - 0.01, Z0, OX1, OY1, Z1, C.soot);
  // pierres en façade
  const stones = (x0, x1, y0, y1, face) => {
    let y = y0;
    while (y < y1 - 0.05) {
      const h = Math.min(0.16 + R() * 0.12, y1 - y);
      let x = x0 + (R() < 0.5 ? 0 : -0.1);
      while (x < x1) {
        const w = 0.22 + R() * 0.24;
        const a = Math.max(x, x0) + 0.012, b = Math.min(x + w, x1) - 0.012;
        if (b - a > 0.05) {
          const p = 0.02 + R() * 0.035;
          const col = pick(C.stone);
          if (face === 'front') B.box(a, y + 0.012, Z1 - 0.01, b, y + h - 0.012, Z1 + p, col);
          else if (face === 'left') B.box(X0 - p, y + 0.012, a, X0 + 0.01, y + h - 0.012, b, col);
          else B.box(X1 - 0.01, y + 0.012, a, X1 + p, y + h - 0.012, b, col);
        }
        x += w;
      }
      y += h;
    }
  };
  stones(X0, OX0, 0, OY1, 'front');
  stones(OX1, X1, 0, OY1, 'front');
  stones(OX0, OX1, 0, OY0, 'front');
  stones(X0, X1, OY1, 1.3, 'front');
  stones(X0, X1, 1.5, H, 'front');
  stones(Z0, Z1, 0, H, 'left');
  stones(Z0, Z1, 0, H, 'right');
  // linteau / manteau en bois
  B.box(X0 - 0.15, 1.3, Z1 - 0.08, X1 + 0.15, 1.48, Z1 + 0.22, C.beam);
  // âtre
  B.box(X0 - 0.3, 0, Z1, X1 + 0.3, 0.09, Z1 + 0.55, 0x8a837b, 'plain', { collide: false });
  for (let i = 0; i < 6; i++) B.box(X0 - 0.3 + i * 0.5 + 0.01, 0.09, Z1 + 0.01, X0 - 0.3 + (i + 1) * 0.5 - 0.01, 0.1, Z1 + 0.54, pick(C.stone));
  // sur la cheminée : bougies, bocal, petite plante, bougeoir
  candle(B, X0 + 0.05, 1.48, Z1 + 0.08, 0.18);
  candle(B, X0 + 0.2, 1.48, Z1 + 0.1, 0.12);
  candle(B, X1 - 0.1, 1.48, Z1 + 0.06, 0.22);
  B.cyl(0.95, 1.48, Z1 + 0.07, 0.07, 0.08, 0.16, C.potCream, 8);
  for (let i = 0; i < 5; i++) B.blob(0.95 + (R() - 0.5) * 0.12, 1.7 + R() * 0.08, Z1 + 0.07 + (R() - 0.5) * 0.1, 0.07, 0.05, 0.07, pick(C.leaf), 0);
  B.box(0.0, 1.48, Z1 + 0.04, 0.38, 1.82, Z1 + 0.06, C.frame); // cadre posé
  B.box(0.03, 1.51, Z1 + 0.06, 0.35, 1.79, Z1 + 0.065, 0xd9b98f);
  // outils de cheminée
  B.cyl(X0 - 0.35, 0, Z1 + 0.25, 0.09, 0.11, 0.05, C.metal, 8);
  B.cyl(X0 - 0.35, 0.05, Z1 + 0.25, 0.015, 0.015, 0.75, C.metal, 6);
  B.blob(X0 - 0.35, 0.82, Z1 + 0.25, 0.05, 0.03, 0.05, C.brass, 0);
}

function candle(B, x, y, z, h) {
  B.cyl(x, y, z, 0.035, 0.035, h, C.cream, 8);
  const g = new THREE.ConeGeometry(0.012, 0.04, 5);
  g.translate(x, y + h + 0.025, z);
  B.add(g, 0xffffff, 'candle');
}

function sofa(B, main, dark) {
  B.box(-1.1, 0.08, -0.45, 1.1, 0.4, 0.45, dark, 'plain');
  B.collideLocal(-1.1, -0.45, 1.1, 0.45);
  for (const [x, z] of [[-1.02, -0.38], [1.02, -0.38], [-1.02, 0.38], [1.02, 0.38]]) B.cyl(x, 0, z, 0.03, 0.025, 0.08, C.woodDark, 6);
  B.box(-1.1, 0.4, -0.45, 1.1, 0.92, -0.2, main);
  B.box(-1.12, 0.4, -0.45, -0.9, 0.68, 0.45, main);
  B.box(0.9, 0.4, -0.45, 1.12, 0.68, 0.45, main);
  B.box(-0.89, 0.4, -0.2, -0.01, 0.53, 0.43, main);
  B.box(0.01, 0.4, -0.2, 0.89, 0.53, 0.43, main);
  B.blob(-0.45, 0.72, -0.13, 0.4, 0.19, 0.09, main, 1);
  B.blob(0.45, 0.72, -0.13, 0.4, 0.19, 0.09, main, 1);
  B.blob(-0.72, 0.68, -0.02, 0.18, 0.16, 0.07, C.mustard, 1, 'plain', 0.3);
  B.blob(0.74, 0.68, -0.02, 0.18, 0.16, 0.07, C.rose, 1, 'plain', -0.3);
  // plaid sur l'accoudoir
  B.box(0.86, 0.68, -0.3, 1.16, 0.71, 0.3, C.terracotta);
  B.box(1.13, 0.25, -0.3, 1.16, 0.7, 0.3, C.terracotta);
}

function armchair(B, col, big = false) {
  const w = big ? 0.55 : 0.48;
  B.box(-w, 0.08, -0.42, w, 0.4, 0.42, col);
  B.collideLocal(-w, -0.42, w, 0.42);
  for (const [x, z] of [[-w + 0.06, -0.36], [w - 0.06, -0.36], [-w + 0.06, 0.36], [w - 0.06, 0.36]]) B.cyl(x, 0, z, 0.03, 0.025, 0.08, C.woodDark, 6);
  B.box(-w, 0.4, -0.42, w, big ? 1.05 : 0.95, -0.2, col);
  B.box(-w - 0.02, 0.4, -0.42, -w + 0.16, 0.64, 0.42, col);
  B.box(w - 0.16, 0.4, -0.42, w + 0.02, 0.64, 0.42, col);
  B.box(-w + 0.17, 0.4, -0.2, w - 0.17, 0.53, 0.4, col);
  B.blob(0, 0.72, -0.12, w - 0.2, 0.17, 0.08, C.cream, 1);
}

function coffeeTable(B) {
  B.box(-0.6, 0.36, -0.32, 0.6, 0.42, 0.32, C.wood, 'plain', { collide: true });
  for (const [x, z] of [[-0.52, -0.25], [0.52, -0.25], [-0.52, 0.25], [0.52, 0.25]]) B.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.36, z + 0.03, C.woodDark);
  B.box(-0.55, 0.1, -0.28, 0.55, 0.12, 0.28, C.wood);
  // théière + tasses
  B.blob(-0.2, 0.5, 0.0, 0.1, 0.08, 0.1, C.sageDark, 1);
  B.cyl(-0.2, 0.57, 0.0, 0.03, 0.04, 0.03, C.sageDark, 6);
  const sp = new THREE.CylinderGeometry(0.012, 0.02, 0.12, 5);
  sp.rotateZ(-0.9);
  sp.translate(-0.08, 0.53, 0.0);
  B.add(sp, C.sageDark);
  mug(B, 0.08, 0.42, 0.1);
  mug(B, 0.2, 0.42, -0.08);
  bookStack(B, 0.38, 0.42, 0.12, 2);
  candle(B, -0.42, 0.42, -0.15, 0.1);
}

function mug(B, x, y, z) {
  B.cyl(x, y, z, 0.04, 0.035, 0.09, pick([C.cream, C.terracotta, C.dusty]), 8);
  B.cyl(x, y + 0.07, z, 0.032, 0.032, 0.005, 0x6b4428, 8);
}

function bookStack(B, x, y, z, n) {
  let h = y;
  for (let i = 0; i < n; i++) {
    const t = 0.03 + R() * 0.02;
    B.push(x, 0, z, (R() - 0.5) * 0.4);
    B.box(-0.11, h, -0.08, 0.11, h + t, 0.08, pick(BOOKS));
    B.box(-0.105, h + 0.004, -0.075, 0.115, h + t - 0.004, 0.075, C.cream);
    B.pop();
    h += t;
  }
}

function sideTable(B) {
  B.cyl(0, 0.52, 0, 0.26, 0.26, 0.04, C.wood, 10, 'plain', { collide: true });
  B.cyl(0, 0, 0, 0.04, 0.05, 0.52, C.woodDark, 6);
  B.cyl(0, 0, 0, 0.18, 0.2, 0.03, C.woodDark, 8);
}

function lampTable(B, x, y, z) {
  B.blob(x, y + 0.1, z, 0.08, 0.1, 0.08, C.potCream, 1);
  B.cyl(x, y + 0.18, z, 0.01, 0.01, 0.14, C.brass, 5);
  B.cyl(x, y + 0.3, z, 0.08, 0.15, 0.17, C.cream, 10, 'glow');
  return new THREE.Vector3(x, y + 0.34, z).applyMatrix4(B.matrix);
}

function floorLamp(B, x, z) {
  B.cyl(x, 0, z, 0.16, 0.18, 0.04, C.metal, 8, 'plain', { collide: true });
  B.cyl(x, 0.04, z, 0.015, 0.015, 1.36, C.brass, 6);
  B.cyl(x, 1.36, z, 0.14, 0.24, 0.28, C.cream, 10, 'glow');
  return new THREE.Vector3(x, 1.42, z).applyMatrix4(B.matrix);
}

function bookshelf(B, w, h, d) {
  const hw = w / 2;
  B.box(-hw, 0, -d / 2, -hw + 0.04, h, d / 2, C.wood);
  B.box(hw - 0.04, 0, -d / 2, hw, h, d / 2, C.wood);
  B.box(-hw, 0, -d / 2, hw, h, -d / 2 + 0.02, C.woodDark);
  B.collideLocal(-hw, -d / 2, hw, d / 2);
  const shelves = Math.round(h / 0.42);
  for (let s = 0; s <= shelves; s++) {
    const y = (s * (h - 0.04)) / shelves;
    B.box(-hw, y, -d / 2, hw, y + 0.04, d / 2, C.wood);
    if (s === shelves) break;
    let x = -hw + 0.06;
    const maxH = (h - 0.04) / shelves - 0.08;
    while (x < hw - 0.12) {
      const r = R();
      if (r < 0.06) { // petite plante
        B.cyl(x + 0.08, y + 0.04, 0, 0.06, 0.05, 0.1, C.pot, 7);
        B.blob(x + 0.08, y + 0.2, 0, 0.09, 0.08, 0.09, pick(C.leaf), 0);
        x += 0.2;
      } else if (r < 0.1) { // pile couchée
        bookStack(B, x + 0.12, y + 0.04, 0, 3);
        x += 0.28;
      } else if (r < 0.14) {
        B.blob(x + 0.07, y + 0.1, 0, 0.06, 0.06, 0.06, pick([C.potCream, C.sage, C.terracotta]), 0);
        x += 0.16;
      } else {
        const n = 3 + Math.floor(R() * 6);
        for (let i = 0; i < n && x < hw - 0.08; i++) {
          const bw = 0.025 + R() * 0.035, bh = Math.min(maxH, 0.18 + R() * 0.14), bd = d - 0.06 - R() * 0.06;
          B.box(x, y + 0.04, -d / 2 + 0.03, x + bw, y + 0.04 + bh, -d / 2 + 0.03 + bd, pick(BOOKS));
          x += bw + 0.003;
        }
        x += 0.03;
      }
    }
  }
}

function sideboard(B) {
  B.box(-0.8, 0.08, -0.22, 0.8, 0.8, 0.22, C.woodHoney, 'plain', { collide: true });
  B.box(-0.82, 0.8, -0.24, 0.82, 0.84, 0.24, C.wood);
  for (const x of [-0.75, 0.75]) for (const z of [-0.17, 0.17]) B.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.08, z + 0.03, C.woodDark);
  for (const x of [-0.4, 0.4]) {
    B.box(x - 0.37, 0.14, 0.22, x + 0.37, 0.74, 0.23, C.wood);
    B.cyl(x + (x < 0 ? 0.3 : -0.3), 0.42, 0.24, 0.015, 0.015, 0.03, C.brass, 5);
  }
  // vase, bougies, livres, cadre
  B.cyl(-0.55, 0.84, 0, 0.08, 0.06, 0.28, C.terracotta, 8);
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(0.005, 0.005, 0.35, 4);
    g.rotateZ((R() - 0.5) * 0.5);
    g.translate(-0.55 + (R() - 0.5) * 0.06, 1.25, (R() - 0.5) * 0.06);
    B.add(g, 0x8a7a55);
    B.blob(-0.55 + (R() - 0.5) * 0.15, 1.42 + R() * 0.06, (R() - 0.5) * 0.1, 0.04, 0.03, 0.04, 0xd9c49a, 0);
  }
  bookStack(B, 0.1, 0.84, 0, 3);
  candle(B, 0.5, 0.84, 0.05, 0.14);
  candle(B, 0.62, 0.84, -0.04, 0.09);
  B.box(-0.2, 1.4, -0.235, 0.6, 2.0, -0.21, C.frame);
  B.box(-0.16, 1.44, -0.212, 0.56, 1.96, -0.205, 0x7b9384);
  B.blob(0.1, 1.62, -0.2, 0.25, 0.12, 0.01, 0x93a88f, 0);
  B.blob(0.3, 1.58, -0.2, 0.2, 0.08, 0.01, 0x6f8770, 0);
}

function bench(B) {
  B.box(-0.6, 0.38, -0.2, 0.6, 0.44, 0.2, C.wood, 'plain', { collide: true });
  for (const x of [-0.5, 0.5]) B.box(x - 0.04, 0, -0.17, x + 0.04, 0.38, 0.17, C.woodDark);
  B.box(-0.55, 0.44, -0.17, 0.55, 0.5, 0.17, C.sage);
  B.blob(0.35, 0.6, -0.08, 0.16, 0.12, 0.06, C.rose, 1, 'plain', 0.2);
  // panier sous le banc
  B.box(-0.35, 0, -0.14, 0.05, 0.22, 0.14, C.woodHoney);
}

function coatRack(B, x, z) {
  B.cyl(x, 0, z, 0.18, 0.2, 0.04, C.woodDark, 8, 'plain', { collide: true });
  B.cyl(x, 0.04, z, 0.025, 0.03, 1.7, C.wood, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    B.blob(x + Math.cos(a) * 0.08, 1.7, z + Math.sin(a) * 0.08, 0.04, 0.015, 0.04, C.woodDark, 0);
  }
  B.blob(x + 0.12, 1.25, z, 0.14, 0.42, 0.12, C.plum, 1);
  B.blob(x - 0.08, 1.35, z + 0.08, 0.12, 0.32, 0.1, C.mustard, 1);
  B.blob(x - 0.05, 1.75, z - 0.08, 0.12, 0.06, 0.12, C.terracotta, 1);
}

function boots(B) {
  for (const [x, col] of [[-0.12, C.woodDark], [0.02, C.woodDark], [0.25, 0x7a5a3a], [0.38, 0x7a5a3a]]) {
    B.box(x - 0.05, 0, -0.12, x + 0.05, 0.08, 0.12, col);
    B.box(x - 0.05, 0.08, -0.12, x + 0.05, 0.3, -0.02, col);
  }
}

function plant(B, x, z, kind = 'bush') {
  if (kind === 'tall') {
    B.cyl(x, 0, z, 0.2, 0.15, 0.36, C.pot, 9, 'plain', { collide: true });
    B.cyl(x, 0.34, z, 0.19, 0.19, 0.02, 0x4a3426, 9);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + R() * 0.4, h = 0.45 + R() * 0.75, r = 0.15 + R() * 0.3;
      const e = new THREE.Euler(Math.sin(a) * r, 0, -Math.cos(a) * r);
      const g = new THREE.CylinderGeometry(0.008, 0.012, h, 4);
      g.translate(0, h / 2, 0);
      g.rotateX(e.x);
      g.rotateZ(e.z);
      g.translate(x, 0.36, z);
      B.add(g, 0x55703f);
      const tip = new THREE.Vector3(0, h, 0).applyEuler(e);
      const ang = Math.atan2(tip.x, tip.z);
      B.blob(x + tip.x * 1.05, 0.36 + tip.y, z + tip.z * 1.05, 0.11, 0.035, 0.24, pick(C.leaf), 0, 'plain', ang);
    }
  } else {
    B.cyl(x, 0, z, 0.17, 0.13, 0.3, pick([C.potCream, C.pot]), 9, 'plain', { collide: true });
    for (let i = 0; i < 7; i++) B.blob(x + (R() - 0.5) * 0.25, 0.4 + R() * 0.25, z + (R() - 0.5) * 0.25, 0.14, 0.12, 0.14, pick(C.leaf), 0, 'plain', R() * 3);
  }
}

function logPile(B, x, z) {
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4 - (row > 1 ? 1 : 0); i++) {
      const g = new THREE.CylinderGeometry(0.075, 0.08, 0.6, 7);
      g.rotateX(Math.PI / 2);
      g.translate(x - 0.24 + i * 0.16 + (row % 2) * 0.08, 0.08 + row * 0.14, z);
      B.add(g, pick([0x6b4a32, 0x7a563a, 0x5e4130]));
    }
  }
  B.collideLocal(x - 0.35, z - 0.3, x + 0.35, z + 0.3);
}

function frames(B, x, y, z, rot) {
  B.push(x, 0, z, rot);
  const items = [[-0.55, 0.15, 0.5, 0.65, 0xa8b89a], [0.05, 0.3, 0.38, 0.38, 0xd9b98f], [0.05, -0.18, 0.38, 0.38, 0x9fb0c0], [0.55, 0.05, 0.45, 0.6, 0xc9a090]];
  for (const [cx, cy, w, h, col] of items) {
    B.box(cx - w / 2, y + cy - h / 2, 0, cx + w / 2, y + cy + h / 2, 0.03, C.frame);
    B.box(cx - w / 2 + 0.04, y + cy - h / 2 + 0.04, 0.03, cx + w / 2 - 0.04, y + cy + h / 2 - 0.04, 0.035, col);
    B.blob(cx, y + cy - h * 0.1, 0.04, w * 0.28, h * 0.15, 0.005, 0xf0e6d2, 0);
  }
  B.pop();
}

// rideaux de part et d'autre d'une fenêtre (axis = mur le long de x ('z') ou de z ('x'))
function curtains(B, axis, c, a, b, top, col) {
  if (axis === 'x') { B.push(c, 0, 0, -Math.PI / 2); } else B.push(0, 0, c, 0);
  B.cyl((a + b) / 2, top + 0.08, 0, 0.015, 0.015, 0.001, C.brass, 4);
  const rod = new THREE.CylinderGeometry(0.015, 0.015, b - a + 0.5, 6);
  rod.rotateZ(Math.PI / 2);
  rod.translate((a + b) / 2, top + 0.1, 0);
  B.add(rod, C.brass);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? a - 0.28 : b - 0.02;
    for (let i = 0; i < 4; i++) {
      const fx = x0 + i * 0.075;
      B.box(fx, 0.15, -0.04 + (i % 2) * 0.03, fx + 0.075, top + 0.1, -0.02 + (i % 2) * 0.03, col);
    }
  }
  B.pop();
}

function bed(B) {
  // tête de lit à z=0 (contre le mur), le lit s'étend vers +z
  B.box(-0.85, 0, 0, 0.85, 1.15, 0.08, C.wood);
  for (let i = 0; i < 6; i++) B.box(-0.85 + i * 0.283 + 0.01, 0.3, 0.075, -0.85 + (i + 1) * 0.283 - 0.01, 1.1, 0.09, C.woodHoney);
  B.box(-0.82, 0.12, 0.08, 0.82, 0.32, 2.1, C.wood);
  B.collideLocal(-0.85, 0, 0.85, 2.15);
  for (const x of [-0.78, 0.78]) for (const z of [0.12, 2.05]) B.box(x - 0.04, 0, z - 0.04, x + 0.04, 0.12, z + 0.04, C.woodDark);
  B.box(-0.78, 0.32, 0.1, 0.78, 0.52, 2.05, C.white);
  // couette avec léger rebond
  B.box(-0.82, 0.5, 0.65, 0.82, 0.6, 2.1, C.sage);
  B.box(-0.84, 0.25, 0.65, -0.8, 0.6, 2.1, C.sage);
  B.box(0.8, 0.25, 0.65, 0.84, 0.6, 2.1, C.sage);
  B.blob(0, 0.62, 0.95, 0.75, 0.04, 0.32, C.sage, 1);
  B.box(-0.82, 0.6, 0.58, 0.82, 0.64, 0.8, C.cream); // revers du drap
  // plaid tricoté au pied
  B.box(-0.86, 0.6, 1.55, 0.86, 0.66, 2.0, C.mustard);
  B.box(-0.88, 0.3, 1.55, -0.84, 0.66, 2.0, C.mustard);
  B.box(0.84, 0.3, 1.55, 0.88, 0.66, 2.0, C.mustard);
  // oreillers
  B.blob(-0.38, 0.64, 0.3, 0.32, 0.1, 0.17, C.cream, 1);
  B.blob(0.38, 0.64, 0.3, 0.32, 0.1, 0.17, C.cream, 1);
  B.blob(-0.2, 0.72, 0.48, 0.17, 0.13, 0.06, C.rose, 1, 'plain', 0.2);
  B.blob(0.22, 0.72, 0.48, 0.17, 0.13, 0.06, C.dusty, 1, 'plain', -0.2);
}

function nightstand(B) {
  B.box(-0.24, 0.08, -0.2, 0.24, 0.55, 0.2, C.woodHoney, 'plain', { collide: true });
  for (const x of [-0.2, 0.2]) for (const z of [-0.16, 0.16]) B.box(x - 0.025, 0, z - 0.025, x + 0.025, 0.08, z + 0.025, C.woodDark);
  B.box(-0.21, 0.32, 0.2, 0.21, 0.5, 0.21, C.wood);
  B.blob(0, 0.41, 0.22, 0.03, 0.015, 0.015, C.brass, 0);
}

function wardrobe(B) {
  B.box(-0.6, 0, -0.3, 0.6, 2.2, 0.3, C.woodHoney, 'plain', { collide: true });
  B.box(-0.62, 2.2, -0.32, 0.62, 2.26, 0.32, C.wood);
  B.box(-0.01, 0.1, 0.3, 0.01, 2.15, 0.31, C.woodDark);
  for (const x of [-0.08, 0.08]) B.cyl(x, 1.05, 0.32, 0.012, 0.012, 0.25, C.brass, 5);
  B.box(-0.55, 0.1, 0.3, -0.05, 2.1, 0.305, C.wood);
  B.box(0.05, 0.1, 0.3, 0.55, 2.1, 0.305, C.wood);
  B.box(-0.4, 2.26, -0.2, 0.0, 2.5, 0.15, C.creamDark); // boîtes rangées dessus
  B.box(0.05, 2.26, -0.2, 0.4, 2.42, 0.15, C.terracotta);
}

function dresser(B) {
  B.box(-0.55, 0.08, -0.22, 0.55, 0.9, 0.22, C.wood, 'plain', { collide: true });
  for (let i = 0; i < 3; i++) {
    const y = 0.14 + i * 0.25;
    B.box(-0.5, y, 0.22, 0.5, y + 0.22, 0.23, C.woodHoney);
    B.box(-0.08, y + 0.1, 0.23, 0.08, y + 0.12, 0.25, C.brass);
  }
  B.cyl(0.2, 0.9, 0, 0.09, 0.07, 0.04, C.ceramic, 8);
  candle(B, -0.3, 0.9, 0.0, 0.14);
  // miroir rond
  const m = new THREE.CylinderGeometry(0.32, 0.32, 0.03, 16);
  m.rotateX(Math.PI / 2);
  m.translate(0, 1.55, -0.2);
  B.add(m, C.woodHoney);
  const m2 = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16);
  m2.rotateX(Math.PI / 2);
  m2.translate(0, 1.55, -0.19);
  B.add(m2, 0xbfcfd6);
}

function kitchen(B, lights) {
  const Z = -6; // mur nord
  // plan de travail le long du mur nord
  const X0 = -6.98, X1 = -3.6;
  B.box(X0, 0, Z, X1, 0.86, Z + 0.6, 0x8a9e86, 'plain', { collide: true });
  B.box(X0, 0.86, Z, X1 + 0.02, 0.92, Z + 0.63, 0xb98b5c);
  for (let x = X0 + 0.05; x < X1 - 0.3; x += 0.55) {
    B.box(x, 0.08, Z + 0.6, x + 0.5, 0.8, Z + 0.61, 0x96aa92);
    B.box(x + 0.22, 0.66, Z + 0.61, x + 0.28, 0.68, Z + 0.63, C.brass);
  }
  B.box(X0, 0, Z + 0.55, X1, 0.08, Z + 0.6, 0x5f6f5c);
  // évier sous la fenêtre
  B.box(-5.95, 0.8, Z + 0.1, -5.25, 0.925, Z + 0.52, C.ceramic);
  B.box(-5.9, 0.82, Z + 0.15, -5.3, 0.93, Z + 0.47, 0xb7b9b4);
  B.cyl(-5.6, 0.92, Z + 0.07, 0.015, 0.02, 0.28, C.brass, 6);
  const sp = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6);
  sp.rotateX(Math.PI / 2);
  sp.translate(-5.6, 1.19, Z + 0.14);
  B.add(sp, C.brass);
  // (les pots d'aromatiques du rebord sont gérés par garden.js)
  // cuisinière à bois (noire) + conduit
  B.box(-7.9, 0, Z, -7.0, 0.85, Z + 0.68, C.metal, 'plain', { collide: true });
  B.box(-7.92, 0.85, Z, -6.98, 0.9, Z + 0.7, 0x3c3734);
  B.box(-7.75, 0.2, Z + 0.68, -7.15, 0.6, Z + 0.69, 0x4a4440);
  B.box(-7.6, 0.28, Z + 0.69, -7.3, 0.52, Z + 0.695, 0xd27a3c, 'candle');
  B.cyl(-7.72, 0.9, Z + 0.2, 0.07, 0.07, 1.95, C.metal, 8);
  // bouilloire
  B.blob(-7.3, 0.98, Z + 0.4, 0.11, 0.09, 0.11, C.terracotta, 1);
  B.cyl(-7.3, 1.06, Z + 0.4, 0.02, 0.03, 0.04, C.metal, 6);
  // étagères ouvertes
  for (const y of [1.45, 1.85]) {
    for (const [a, b] of [[-7.5, -6.75], [-4.45, -3.6]]) {
      B.box(a, y, Z, b, y + 0.04, Z + 0.28, C.wood);
      let x = a + 0.08;
      while (x < b - 0.1) {
        const r = R();
        if (r < 0.4) { B.cyl(x + 0.05, y + 0.04, Z + 0.14, 0.05, 0.05, 0.14 + R() * 0.06, pick([0xe6dccb, 0xc9b48a, 0xd8c4a8]), 8); B.cyl(x + 0.05, y + 0.2, Z + 0.14, 0.052, 0.052, 0.03, C.woodDark, 8); x += 0.14; }
        else if (r < 0.7) { for (let i = 0; i < 4; i++) B.cyl(x + 0.1, y + 0.04 + i * 0.02, Z + 0.14, 0.1, 0.08, 0.018, C.ceramic, 10); x += 0.24; }
        else { B.blob(x + 0.08, y + 0.1, Z + 0.14, 0.07, 0.06, 0.07, pick([C.sage, C.terracotta, C.dusty]), 0); x += 0.18; }
      }
    }
  }
  // barre à ustensiles
  const rail = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 5);
  rail.rotateZ(Math.PI / 2);
  rail.translate(-4.1, 1.3, Z + 0.03);
  B.add(rail, C.brass);
  for (let i = 0; i < 4; i++) {
    B.box(-4.4 + i * 0.18, 1.08, Z + 0.02, -4.38 + i * 0.18, 1.3, Z + 0.04, C.woodDark);
    B.blob(-4.39 + i * 0.18, 1.05, Z + 0.04, 0.035, 0.05, 0.015, i % 2 ? C.woodDark : 0x9a9690, 0); // louche, spatule...
  }
  // garde-manger
  B.box(-7.9, 0, -0.95, -7.2, 2.1, -0.15, 0x8a9e86, 'plain', { collide: true });
  B.box(-7.2, 0.1, -0.9, -7.19, 2.0, -0.2, 0x96aa92);
  B.cyl(-7.17, 1.0, -0.3, 0.012, 0.012, 0.18, C.brass, 5);
  // table ronde + chaises
  B.cyl(-5.5, 0.72, -2.7, 0.62, 0.62, 0.05, C.woodHoney, 14, 'plain', { collide: true });
  B.cyl(-5.5, 0, -2.7, 0.07, 0.1, 0.72, C.wood, 8);
  B.cyl(-5.5, 0, -2.7, 0.28, 0.32, 0.04, C.wood, 10);
  B.cyl(-5.5, 0.77, -2.7, 0.14, 0.09, 0.08, C.ceramic, 10); // coupe de fruits
  for (const [dx, dz, col] of [[-0.05, 0.03, 0xd8743a], [0.06, -0.02, 0xc0453a], [0.0, -0.07, 0xd9b84a]]) B.blob(-5.5 + dx, 0.88, -2.7 + dz, 0.045, 0.045, 0.045, col, 1);
  B.cyl(-5.25, 0.77, -2.95, 0.04, 0.05, 0.16, 0x9fb5b0, 8); // vase
  for (let i = 0; i < 4; i++) B.blob(-5.25 + (R() - 0.5) * 0.1, 1.0 + R() * 0.08, -2.95 + (R() - 0.5) * 0.1, 0.035, 0.035, 0.035, pick([0xe8c6c0, 0xf2e3c2, 0xd99a8e]), 0);
  for (const a of [0.3, 2.0, 3.6, 5.0]) {
    B.push(-5.5 + Math.sin(a) * 0.85, 0, -2.7 + Math.cos(a) * 0.85, a + Math.PI);
    chair(B);
    B.pop();
  }
  // suspension au-dessus de la table
  B.cyl(-5.5, 1.95, -2.7, 0.005, 0.005, H - 1.95, C.metal, 4);
  B.cyl(-5.5, 1.75, -2.7, 0.04, 0.26, 0.22, 0x5f7a66, 10);
  B.blob(-5.5, 1.73, -2.7, 0.06, 0.06, 0.06, 0xfff0d0, 1, 'glow');
  lights.push({ pos: new THREE.Vector3(-5.5, 1.62, -2.7), room: 'cuisine', strength: 1.0 });
  // tapis de passage devant le plan de travail
  const rg = new THREE.PlaneGeometry(2.6, 0.55);
  rg.rotateX(-Math.PI / 2);
  rg.translate(-5.35, 0.012, -5.08);
  B.add(rg, 0xffffff, 'rug1');
  // planche à pain, miche et torchon
  B.box(-4.55, 0.92, -5.78, -4.1, 0.95, -5.5, C.woodLight);
  B.blob(-4.33, 0.99, -5.64, 0.13, 0.06, 0.08, 0xc98c4a, 1);
  B.box(-6.2, 0.55, Z + 0.605, -6.05, 0.8, Z + 0.62, C.cream);
  // corbeille de fruits et bocal à ustensiles
  B.cyl(-3.85, 0.92, -5.7, 0.06, 0.05, 0.14, C.potCream, 8);
  for (let i = 0; i < 3; i++) B.cyl(-3.85 + (i - 1) * 0.025, 1.0, -5.7, 0.008, 0.008, 0.2, C.woodDark, 4);
}

function catBasket(B, x, y, z) {
  B.cyl(x, y, z, 0.3, 0.26, 0.05, C.woodHoney, 12, 'plain', { collide: true });
  const ring = new THREE.TorusGeometry(0.27, 0.06, 6, 14);
  ring.rotateX(Math.PI / 2);
  ring.translate(x, y + 0.1, z);
  B.add(ring, C.woodHoney);
  B.blob(x, y + 0.07, z, 0.24, 0.05, 0.24, C.cream, 1);
}

function windowSeat(B, x0, x1, z0, z1) {
  B.box(x0, 0, z0, x1, 0.4, z1, C.woodHoney, 'plain', { collide: true });
  B.box(x0 + 0.03, 0.06, z1, x1 - 0.03, 0.34, z1 + 0.01, C.wood);
  B.box(x0 + 0.02, 0.4, z0 + 0.02, x1 - 0.02, 0.48, z1 - 0.02, C.sage);
  B.blob(x0 + 0.3, 0.62, z0 + 0.14, 0.22, 0.16, 0.08, C.rose, 1);
  B.blob(x1 - 0.3, 0.62, z0 + 0.14, 0.22, 0.16, 0.08, C.cream, 1);
  B.box(x1 - 0.9, 0.48, z0 + 0.1, x1 - 0.5, 0.51, z1 - 0.06, C.mustard); // plaid plié
}

function catTree(B, x, z) {
  B.box(x - 0.32, 0, z - 0.3, x + 0.32, 0.06, z + 0.3, C.creamDark, 'plain', { collide: true });
  for (const [px, pz, h] of [[-0.18, 0.15, 0.55], [0.15, -0.12, 1.15]]) B.cyl(x + px, 0.06, z + pz, 0.06, 0.06, h, 0xc9b48a, 8); // poteaux en sisal
  B.box(x - 0.32, 0.55, z - 0.05, x + 0.05, 0.6, z + 0.3, C.creamDark);
  B.cyl(x - 0.13, 0.6, z + 0.14, 0.17, 0.17, 0.03, C.sage, 10);
  B.cyl(x + 0.1, 1.15, z - 0.12, 0.28, 0.28, 0.05, C.creamDark, 12);
  const ring = new THREE.TorusGeometry(0.25, 0.05, 6, 14);
  ring.rotateX(Math.PI / 2);
  ring.translate(x + 0.1, 1.24, z - 0.12);
  B.add(ring, C.creamDark);
  B.blob(x + 0.1, 1.22, z - 0.12, 0.22, 0.04, 0.22, C.sage, 1);
  // pompon suspendu
  B.cyl(x - 0.25, 0.32, z + 0.25, 0.003, 0.003, 0.23, 0x8a7a55, 3);
  B.blob(x - 0.25, 0.3, z + 0.25, 0.035, 0.035, 0.035, C.rose, 0);
}

function dryingRack(B, x, z) {
  // étendoir tour, comme à la maison : Romi aime dormir sur l'étage du bas
  const w = 0.42, d = 0.28;
  for (const [px, pz] of [[-w, -d], [w, -d], [-w, d], [w, d]]) B.cyl(x + px, 0, z + pz, 0.012, 0.012, 1.6, 0xf2f2f2, 5);
  for (const y of [0.55, 1.0, 1.45]) {
    for (const s of [-1, 1]) {
      B.box(x - w, y, z + s * d - 0.008, x + w, y + 0.016, z + s * d + 0.008, 0xf2f2f2);
      B.box(x + s * w - 0.008, y, z - d, x + s * w + 0.008, y + 0.016, z + d, 0xf2f2f2);
    }
    for (let k = -3; k <= 3; k++) B.box(x + k * 0.12 - 0.005, y, z - d, x + k * 0.12 + 0.005, y + 0.012, z + d, 0xf2f2f2);
    for (const s of [-1, 1]) B.box(x - 0.03 + s * w, y - 0.01, z + d - 0.03, x + 0.03 + s * w, y + 0.03, z + d + 0.01, 0x7ab8d0); // clips bleus
  }
  // linge étendu (en haut) et en vrac sur l'étage du bas
  const cloth = [0x2c3140, 0x6f86a8, 0xe9e6e0, 0x3a3f4f, 0x8f9db3];
  for (let k = 0; k < 5; k++) {
    const cx = x - 0.34 + k * 0.17, col = cloth[k];
    B.box(cx - 0.07, 1.45 - 0.55 - R() * 0.25, z - 0.01, cx + 0.07, 1.47, z + 0.01, col);
  }
  B.box(x - 0.38, 1.0 - 0.35, z + d - 0.02, x - 0.05, 1.02, z + d, 0xe8e2d8);
  for (let s = 0; s < 3; s++) B.blob(x - 0.25 + s * 0.22, 0.6, z + (R() - 0.5) * 0.15, 0.13, 0.04, 0.15, pick([0x2c3140, 0x4a4f5e, 0xd9d5cc]), 1);
  B.collideLocal(x - w, z - d, x + w, z + d);
}

function chair(B) {
  B.box(-0.21, 0.44, -0.2, 0.21, 0.48, 0.2, C.wood);
  B.collideLocal(-0.21, -0.2, 0.21, 0.2);
  for (const [x, z] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) B.box(x - 0.02, 0, z - 0.02, x + 0.02, 0.44, z + 0.02, C.woodDark);
  // dossier à l'arrière (-z) : l'assise regarde la table
  for (const x of [-0.18, 0.18]) B.box(x - 0.02, 0.48, -0.19, x + 0.02, 0.92, -0.15, C.woodDark);
  B.box(-0.2, 0.68, -0.18, 0.2, 0.9, -0.15, C.wood);
  B.blob(0, 0.5, 0, 0.17, 0.03, 0.17, C.terracotta, 1);
}

function bathroom(B, lights) {
  // baignoire sur pieds contre le mur ouest
  const tub = new THREE.CylinderGeometry(0.42, 0.36, 0.5, 16, 1, true);
  tub.scale(1.0, 1, 1.85);
  tub.translate(-7.25, 0.12 + 0.25, 4.4);
  B.add(tub, C.white);
  const inner = new THREE.CylinderGeometry(0.38, 0.33, 0.48, 16, 1, true);
  inner.scale(-1, 1, 1.85); // faces tournées vers l'intérieur
  inner.translate(-7.25, 0.14 + 0.24, 4.4);
  B.add(inner, 0xe9e4da);
  const bottom = new THREE.CylinderGeometry(0.36, 0.36, 0.02, 16);
  bottom.scale(1, 1, 1.85);
  bottom.translate(-7.25, 0.12, 4.4);
  B.add(bottom, C.white);
  const water = new THREE.CylinderGeometry(0.37, 0.37, 0.02, 16);
  water.scale(1, 1, 1.85);
  water.translate(-7.25, 0.42, 4.4);
  B.add(water, 0xa6cdd0);
  const rimG = new THREE.TorusGeometry(0.405, 0.03, 5, 20);
  rimG.rotateX(Math.PI / 2);
  rimG.scale(1, 1, 1.85);
  rimG.translate(-7.25, 0.62, 4.4);
  B.add(rimG, C.white);
  for (const [dx, dz] of [[-0.25, -0.5], [0.25, -0.5], [-0.25, 0.5], [0.25, 0.5]]) B.blob(-7.25 + dx, 0.07, 4.4 + dz, 0.05, 0.08, 0.05, C.brass, 0);
  B.collideLocal(-7.75, 3.55, -6.75, 5.25);
  candle(B, -7.25, 0.63, 3.66, 0.1);
  candle(B, -7.13, 0.63, 3.71, 0.07);
  // robinetterie
  B.cyl(-7.85, 0.6, 4.4, 0.02, 0.02, 0.35, C.brass, 6);
  B.blob(-7.78, 0.95, 4.4, 0.06, 0.02, 0.03, C.brass, 0);
  // tabouret avec serviettes pliées
  B.cyl(-6.55, 0, 5.45, 0.2, 0.2, 0.04, C.woodHoney, 10);
  B.cyl(-6.55, 0.4, 5.45, 0.2, 0.2, 0.04, C.woodHoney, 10, 'plain', { collide: true });
  for (const a of [0, 2.1, 4.2]) B.box(-6.55 + Math.cos(a) * 0.14 - 0.02, 0, 5.45 + Math.sin(a) * 0.14 - 0.02, -6.55 + Math.cos(a) * 0.14 + 0.02, 0.4, 5.45 + Math.sin(a) * 0.14 + 0.02, C.wood);
  B.box(-6.7, 0.44, 5.32, -6.4, 0.5, 5.58, C.cream);
  B.box(-6.68, 0.5, 5.34, -6.42, 0.56, 5.56, C.rose);
  candle(B, -6.48, 0.56, 5.4, 0.08);
  // étendoir à linge
  dryingRack(B, -4.75, 4.15);
  // étagère au-dessus des toilettes : serviettes roulées, bougie, plante
  B.box(-4.1, 1.45, 5.72, -3.15, 1.49, 6.0, C.woodHoney);
  for (let i = 0; i < 3; i++) {
    const t = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8);
    t.rotateX(Math.PI / 2);
    t.translate(-4.0 + i * 0.13, 1.55, 5.86);
    B.add(t, [C.cream, C.sage, C.cream][i]);
  }
  candle(B, -3.55, 1.49, 5.86, 0.1);
  B.cyl(-3.3, 1.49, 5.86, 0.06, 0.05, 0.09, C.potCream, 7);
  for (let i = 0; i < 4; i++) B.blob(-3.3 + (R() - 0.5) * 0.08, 1.63 + R() * 0.05, 5.86 + (R() - 0.5) * 0.06, 0.05, 0.05, 0.05, pick(C.leaf), 0);
  // tapis de bain
  B.box(-6.6, 0, 3.9, -6.0, 0.015, 4.9, C.sage);
  // meuble vasque + miroir + applique
  B.box(-6.1, 0, 0.05, -4.9, 0.8, 0.55, C.wood, 'plain', { collide: true });
  B.box(-6.12, 0.8, 0.05, -4.88, 0.85, 0.58, 0xb98b5c);
  B.cyl(-5.5, 0.85, 0.32, 0.2, 0.15, 0.12, C.ceramic, 12);
  B.cyl(-5.5, 0.85, 0.12, 0.015, 0.015, 0.28, C.brass, 6);
  B.box(-6.05, 0.1, 0.55, -5.52, 0.75, 0.56, C.woodHoney);
  B.box(-5.48, 0.1, 0.55, -4.95, 0.75, 0.56, C.woodHoney);
  const m = new THREE.CylinderGeometry(0.36, 0.36, 0.03, 18);
  m.rotateX(Math.PI / 2);
  m.translate(-5.5, 1.55, 0.13);
  B.add(m, C.brass);
  const m2 = new THREE.CylinderGeometry(0.32, 0.32, 0.03, 18);
  m2.rotateX(Math.PI / 2);
  m2.translate(-5.5, 1.55, 0.14);
  B.add(m2, 0xc4d4da);
  B.box(-4.75, 1.6, 0.1, -4.65, 1.75, 0.18, C.brass);
  B.cyl(-4.7, 1.72, 0.25, 0.07, 0.1, 0.16, C.cream, 8, 'glow');
  lights.push({ pos: new THREE.Vector3(-4.7, 1.85, 0.4), room: 'bain', strength: 0.8 });
  B.cyl(-5.95, 0.85, 0.3, 0.04, 0.04, 0.16, C.terracotta, 8);
  B.cyl(-5.05, 0.85, 0.3, 0.03, 0.035, 0.12, 0xa9c0b8, 8);
  // WC
  B.cyl(-3.55, 0, 5.4, 0.16, 0.2, 0.4, C.white, 10, 'plain', { collide: true });
  B.blob(-3.55, 0.42, 5.35, 0.2, 0.04, 0.24, C.white, 1);
  B.box(-3.78, 0.4, 5.72, -3.32, 0.85, 5.92, C.white);
  B.box(-3.8, 0.85, 5.7, -3.3, 0.88, 5.94, C.woodHoney);
  // échelle à serviettes
  B.push(-3.25, 0, 1.2, -Math.PI / 2 + 0.15);
  for (const x of [-0.25, 0.25]) B.box(x - 0.025, 0, -0.03, x + 0.025, 1.7, 0.03, C.woodHoney);
  for (let y = 0.4; y < 1.7; y += 0.32) B.box(-0.25, y, -0.015, 0.25, y + 0.03, 0.015, C.woodHoney);
  B.box(-0.22, 0.95, -0.05, 0.22, 1.43, 0.05, C.cream);
  B.box(-0.2, 0.42, -0.05, 0.2, 0.76, 0.05, C.sage);
  B.pop();
  B.collideLocal(-3.45, 0.9, -3.05, 1.5);
  plant(B, -7.6, 0.45, 'tall');
  plant(B, -4.0, 5.6, 'bush');
  // panier à linge
  B.cyl(-7.55, 0, 2.3, 0.22, 0.2, 0.5, C.woodHoney, 10, 'plain', { collide: true });
  B.blob(-7.55, 0.52, 2.3, 0.2, 0.06, 0.2, C.cream, 1);
}
