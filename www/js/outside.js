// Dehors, ambiance Norvège : la cabane au bord d'un fjord, montagnes abruptes,
// forêt d'épicéas et de bouleaux, ville en bois colorée sur l'autre rive.
// La météo (Annecy) et les saisons pilotent nuages, pluie, neige, vent et couleurs.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { Builder, mergeColored } from './builder.js';
import { buildTown } from './town.js';

export const WATER = -2.6;
const NZ = makeNoise(7);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// --- rives du fjord (il coule d'est en ouest, devant la porte, au sud)
export const shoreNear = (x) => 30 + 6 * Math.sin(x * 0.011 + 0.3) + 7 * NZ.fbm(x * 0.007, 1.7, 3) * smooth(15, 60, Math.abs(x));
export const shoreFar = (x) => 860 + 50 * Math.sin(x * 0.0035 + 2) + 35 * NZ.fbm(x * 0.004, 9.1, 3);
const PATH_X = (z) => 0.3 + Math.sin(z * 0.22) * 1.3;

// Relief
export function height(x, z) {
  const r = Math.hypot(x, z);
  const zn = shoreNear(x), zf = shoreFar(x);
  // massifs larges et sommets arrondis (pas de dents de scie)
  const ridge = NZ.ridge(x * 0.0013 + 3.1, z * 0.0013 - 1.7, 2) * 0.75 + (NZ.fbm(x * 0.0022 - 4, z * 0.0022 + 2, 3) * 0.5 + 0.5) * 0.25;
  let land;
  if (z < (zn + zf) / 2) {
    // notre rive : prairie qui descend doucement vers l'eau, montagne derrière la cabane
    const meadow = smooth(18, 8, Math.abs(x - 1)) * smooth(2, 8, z);
    let h = (NZ.fbm(x * 0.03, z * 0.03, 3) * 1.4 + NZ.fbm(x * 0.008, z * 0.008, 3) * 4) * smooth(9, 24, r) * (1 - meadow * 0.85);
    h -= 2.55 * smooth(zn - 22, zn + 0.5, z) * smooth(4, 12, z);
    const back = Math.max(0, -z - 30);
    h += Math.pow(smooth(0, 1500, back), 1.2) * (330 + 330 * ridge) + smooth(0, 120, back) * 16;
    // les flancs du fjord se resserrent au loin, à l'est et à l'ouest
    h += smooth(500, 2600, Math.abs(x)) * smooth(zn + 300, zn - 40, z) * (160 + 220 * ridge) * smooth(-200, zn - 40, z);
    land = h - 0.12;
  } else {
    // l'autre rive : bande plate pour la ville, puis montagnes très hautes
    const d = z - zf;
    land = 1.2 + Math.max(0, d) * 0.07 + Math.pow(smooth(zf + 70, zf + 1100, z), 1.15) * (480 + 360 * ridge) + smooth(zf + 60, zf + 200, z) * 18 * NZ.fbm(x * 0.008, z * 0.008, 2);
  }
  const tNear = smooth(zn - 1.5, zn + 8, z), tFar = smooth(zf + 2, zf - 10, z);
  const wet = tNear * tFar;
  const deep = WATER - 1.5 - 70 * smooth(zn, zn + 160, z) * smooth(zf, zf - 160, z);
  return lerp(land, deep, wet);
}

// palettes de saison (Norvège : épicéas sombres, bouleaux dorés à l'automne)
const PAL = {
  printemps: { grass: [0x7aa956, 0x8fb862, 0x6a974b], dry: 0x8fa35a, leaves: [0x98c95e, 0xaed46e, 0x8dbf58], flowers: [0xfff4e0, 0xf6d24a, 0xe6a1c4, 0xb9a3e6, 0x9fc7f0], snowline: 260, grassH: 1 },
  ete: { grass: [0x5f9443, 0x72a24c, 0x527f3a], dry: 0x8e9a52, leaves: [0x5e8a3e, 0x6d9746, 0x76a04c], flowers: [0xfff4e0, 0xf2c94c, 0xe58fb0, 0x9b8fe0], snowline: 520, grassH: 1.15 },
  automne: { grass: [0x7d904b, 0x8c9a53, 0x6c8045], dry: 0xa8925a, leaves: [0xe6b23a, 0xf0c64a, 0xd9952e, 0xc98a2a, 0xe8bd4f], flowers: [], snowline: 330, grassH: 0.9 },
  hiver: { grass: [0x7f805e, 0x8c8a66, 0x707356], dry: 0x8f8a6a, leaves: [0x6e5a3a], flowers: [], snowline: 60, grassH: 0.6 },
};

export function createOutside(scene, { season, mobile = false, shadows = true }) {
  const P = PAL[season.name];
  const rnd = NZ.rnd;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const col = new THREE.Color(), c2 = new THREE.Color();
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.2 } };

  // ------------------------------------------------------------------ relief (maillage polaire : fin près de la cabane, large au loin)
  const NR = mobile ? 110 : 150, NA = mobile ? 170 : 230, RMAX = 3600;
  const pos = [], idx = [];
  const ring = (i) => (i === 0 ? 0 : 4 + (RMAX - 4) * Math.pow((i - 1) / (NR - 1), 2.35));
  pos.push(0, height(0, 0), 0);
  for (let i = 1; i <= NR; i++) {
    const r = ring(i);
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, height(x, z), z);
    }
  }
  for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j);
  for (let i = 1; i < NR; i++) for (let j = 0; j < NA; j++) {
    const a = 1 + (i - 1) * NA + j, b = 1 + (i - 1) * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
    idx.push(a, b, c, b, d, c);
  }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tgeo.setIndex(idx);
  tgeo.computeVertexNormals();
  const vcount = pos.length / 3;
  const baseCol = new Float32Array(vcount * 3), snowCol = new Float32Array(vcount * 3), curCol = new Float32Array(vcount * 3);
  const nrm = tgeo.attributes.normal;
  for (let v = 0; v < vcount; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const slope = 1 - nrm.getY(v);
    const patch = NZ.fbm(x * 0.04 + 9, z * 0.04, 3) * 0.5 + 0.5;
    col.set(P.grass[0]).lerp(c2.set(P.grass[1]), smooth(0.35, 0.75, patch));
    col.lerp(c2.set(P.grass[2]), smooth(0.55, 0.9, NZ.fbm(x * 0.11, z * 0.11 + 4, 2) * 0.5 + 0.5) * 0.6);
    col.lerp(c2.set(P.dry), smooth(0.6, 0.85, NZ.fbm(x * 0.02 - 5, z * 0.02, 2) * 0.5 + 0.5) * 0.45);
    // forêt de montagne : épicéas sombres, taches de bouleaux (dorés en automne)
    const forest = smooth(4, 20, y) * (1 - smooth(220, 330, y)) * smooth(-0.15, 0.25, NZ.fbm(x * 0.006, z * 0.006 - 7, 3) + 0.25);
    if (forest > 0) {
      const birch = smooth(0.55, 0.75, NZ.fbm(x * 0.02 + 3, z * 0.02, 2) * 0.5 + 0.5);
      c2.set(0x2f4a34).lerp(col.clone().set(season.name === 'automne' ? 0xc99a32 : season.name === 'hiver' ? 0x6d6658 : 0x5d8a46), birch * 0.8);
      col.lerp(c2, forest * 0.92);
    }
    // roche : pentes raides et altitude (lande rousse en dessous)
    col.lerp(c2.set(0x7d7b63), smooth(240, 340, y) * 0.6);
    const rock = Math.max(smooth(0.42, 0.68, slope), smooth(320, 480, y));
    col.lerp(c2.set(patch > 0.5 ? 0x7c7a78 : 0x6a6967), rock);
    // grève de galets et fonds
    if (y > WATER - 1.2) col.lerp(c2.set(0x9a958a), smooth(WATER + 0.7, WATER + 0.05, y));
    if (y < WATER - 0.6) col.set(0x34494a).lerp(c2.set(0x22302f), smooth(WATER - 1, WATER - 8, y));
    // neiges
    const snowL = P.snowline + NZ.fbm(x * 0.004, z * 0.004, 2) * 80;
    col.lerp(c2.set(0xf2f4f6), smooth(snowL, snowL + 60, y) * (slope < 0.8 ? 1 : 0.55));
    baseCol.set([col.r, col.g, col.b], v * 3);
    c2.set(0xeef1f4).lerp(col, (y < WATER - 0.2 ? 1 : 0) + smooth(0.55, 0.85, slope) * 0.6 + (patch < 0.2 ? 0.12 : 0));
    snowCol.set([c2.r, c2.g, c2.b], v * 3);
  }
  curCol.set(baseCol);
  tgeo.setAttribute('color', new THREE.BufferAttribute(curCol, 3));
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ------------------------------------------------------------------ fjord
  const wgeo = new THREE.PlaneGeometry(7600, 1100, mobile ? 120 : 180, mobile ? 30 : 46);
  wgeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1f5f6a, roughness: 0.1, metalness: 0.15, flatShading: true });
  const wU = { uTime: uniforms.uTime, uWave: { value: 0.12 }, uSky: { value: new THREE.Color(0xcfe2ee) } };
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wU);
    sh.fragmentShader = 'uniform vec3 uSky;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 4.0);
      outgoingLight = mix(outgoingLight, uSky, clamp(fres * 0.75, 0.0, 0.75));
      #include <opaque_fragment>`);
    sh.vertexShader = 'uniform float uTime; uniform float uWave;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float near = 1.0 - smoothstep(60.0, 400.0, abs(position.z + 520.0));
      transformed.y += (sin(position.x * 0.21 + uTime * 0.9) * 0.5 + sin(position.z * 0.33 - uTime * 1.2) * 0.4 + sin((position.x + position.z) * 0.5 + uTime * 1.9) * 0.25) * uWave * (0.35 + near);`);
  };
  const water = new THREE.Mesh(wgeo, waterMat);
  water.position.set(0, WATER, 520);
  scene.add(water);

  // ------------------------------------------------------------------ arbres (épicéas + bouleaux)
  const sway = (mat, k) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uWind = uniforms.uWind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float sw = sin(uTime * 1.3 + ip.x * 0.17 + ip.z * 0.13) + 0.45 * sin(uTime * 2.7 + ip.z * 0.31 + ip.x * 0.07);
        float hh = max(transformed.y, 0.0);
        transformed.x += (sw * uWind + uWind * 0.6) * hh * ${k.toFixed(4)};
        transformed.z += cos(uTime * 1.1 + ip.x * 0.2) * uWind * hh * ${(k * 0.5).toFixed(4)};`);
    };
    return mat;
  };
  const treeMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.01);
  const leafMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.016);
  const snowCapMat = sway(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.9, flatShading: true }), 0.01);

  // épicéa : élancé, 6 étages
  const spruceParts = [[new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6).translate(0, 0.6, 0), 0x4e3828]];
  const capParts = [];
  for (let k = 0; k < 6; k++) {
    const r = 1.35 - k * 0.2, h = 1.5 - k * 0.1, y = 0.9 + k * 0.85;
    spruceParts.push([new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), [0x2c4a33, 0x31523a, 0x2a4631, 0x355a3d, 0x2f4e36, 0x36593e][k]]);
    const ch = h * 0.5 + 0.05;
    capParts.push([new THREE.ConeGeometry(r * 0.52 * 1.08, ch, 7).translate(0, y + h * 0.5 + ch / 2, 0), 0xffffff]);
  }
  const spruceGeo = mergeColored(spruceParts), capGeo = mergeColored(capParts);
  // bouleau : tronc blanc tacheté, houppier léger
  const birchParts = [];
  for (let k = 0; k < 5; k++) birchParts.push([new THREE.CylinderGeometry(0.09 - k * 0.012, 0.1 - k * 0.012, 0.85, 6).translate(0, 0.42 + k * 0.85, 0), k % 2 ? 0xe9e6dd : 0xdedad0]);
  for (let k = 0; k < 6; k++) birchParts.push([new THREE.BoxGeometry(0.06, 0.05, 0.2).translate(0, 0.5 + k * 0.6, 0).rotateY(k * 1.3), 0x2c2a28]);
  for (const [a, t] of [[0.6, 0.55], [2.6, -0.6], [4.4, 0.5]]) {
    const b = new THREE.CylinderGeometry(0.025, 0.05, 1.3, 5).translate(0, 0.65, 0);
    b.rotateZ(t); b.rotateY(a); b.translate(0, 2.6, 0);
    birchParts.push([b, 0xdedad0]);
  }
  const birchGeo = mergeColored(birchParts);
  const crownParts = [];
  for (const [x, y, z, s] of [[0, 4.0, 0, 1.1], [0.7, 3.4, 0.3, 0.8], [-0.65, 3.5, -0.2, 0.85], [0.1, 4.8, -0.2, 0.75], [-0.2, 3.1, 0.6, 0.7]]) {
    const g = new THREE.IcosahedronGeometry(s, 0).translate(x, y, z);
    g.scale(1, 1.15, 1);
    crownParts.push([g, 0xffffff]);
  }
  const crownGeo = mergeColored(crownParts);

  const nSpruce = mobile ? 520 : 1000, nBirch = mobile ? 160 : 320;
  const spots = { spruce: [], birch: [] };
  let guard = 0;
  while ((spots.spruce.length < nSpruce || spots.birch.length < nBirch) && guard++ < 60000) {
    const x = (rnd() * 2 - 1) * 420, z = -380 + rnd() * 410;
    const r = Math.hypot(x, z);
    if (r < 12) continue;
    const zn = shoreNear(x);
    if (z > zn - 3) continue;
    // la prairie devant la cabane reste dégagée (vue sur le fjord), bordée d'arbres
    if (z > -4 && Math.abs(x - 1) < 11 + (z > 10 ? (z - 10) * 0.9 : 0)) continue;
    if (r < 24 && rnd() < 0.6) continue;
    const g = NZ.fbm(x * 0.025 + 11, z * 0.025, 2);
    if (g < -0.15 && rnd() < 0.85) continue;
    const h = height(x, z);
    if (h < WATER + 0.6 || h > 230) continue;
    const e = 1.5, slope = Math.abs(height(x + e, z) - h) + Math.abs(height(x, z + e) - h);
    if (slope > 2.6) continue;
    const isBirch = rnd() < (NZ.fbm(x * 0.02 + 3, z * 0.02, 2) > 0.05 ? 0.55 : 0.12);
    const list = isBirch ? spots.birch : spots.spruce;
    if (list.length >= (isBirch ? nBirch : nSpruce)) continue;
    list.push({ x, z, h, s: (0.85 + rnd() * 0.85) * (r < 50 ? 1.2 : 1), rot: rnd() * 6.28, r });
  }
  // quelques arbres choisis pour encadrer la vue
  for (const [x, z, b] of [[13.5, 3], [-12.5, 2, 1], [12.5, 12], [-11, 13, 1], [-14, 20], [16, 19, 1], [-9.5, -12], [11, -11, 1], [4, -13], [-3, -14, 1]]) {
    (b ? spots.birch : spots.spruce).push({ x, z, h: height(x, z), s: 1.3 + rnd() * 0.3, rot: rnd() * 6.28, r: Math.hypot(x, z) });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const setM = (s) => m4.compose(v3.set(s.x, s.h - 0.15, s.z), q.setFromAxisAngle(up, s.rot), sc.setScalar(s.s));
  const instanced = (geo, mat, list, castNear, fn) => {
    const out = [];
    for (const near of [true, false]) {
      const L = list.filter((s) => (s.r < 45) === near);
      if (!L.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, L.length);
      L.forEach((s, i) => { setM(s); m.setMatrixAt(i, m4); if (fn) m.setColorAt(i, fn(s, i)); });
      m.castShadow = shadows && near && castNear;
      m.receiveShadow = true;
      scene.add(m);
      out.push(m);
    }
    return out;
  };
  const tint = new THREE.Color();
  instanced(spruceGeo, treeMat, spots.spruce, true, () => tint.setHSL(0, 0, 0.85 + rnd() * 0.25));
  const caps = instanced(capGeo, snowCapMat, spots.spruce, false);
  instanced(birchGeo, treeMat, spots.birch, true);
  const crownSpots = spots.birch.filter(() => season.name !== 'hiver' && rnd() >= season.autumnBare * 0.9);
  if (crownSpots.length) instanced(crownGeo, leafMat, crownSpots, true, () => tint.set(pick(P.leaves)).multiplyScalar(0.85 + rnd() * 0.3));

  // ------------------------------------------------------------------ sol : herbe, fleurs, feuilles, rochers
  const scatter = (count, x0, x1, z0, z1, avoidPath = true) => {
    const out = [];
    let g2 = 0;
    while (out.length < count && g2++ < count * 25) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (Math.abs(x) < 8.7 && Math.abs(z) < 6.7) continue;
      if (Math.abs(x - 0.25) < 1.8 && z > 6 && z < 8.2) continue; // terrasse
      if (avoidPath && Math.abs(x - PATH_X(z)) < 0.7 && z > 6 && z < 40) continue;
      const h = height(x, z);
      if (h < WATER + 0.3 || z > shoreNear(x) - 1) continue;
      out.push({ x, z, h });
    }
    return out;
  };
  const tuftGeo = mergeColored([0, 1, 2, 3].map((k) => {
    const b = new THREE.ConeGeometry(0.035, 0.42, 3).translate(0, 0.21, 0);
    b.rotateZ((k - 1.5) * 0.28);
    b.rotateY(k * 1.7);
    return [b, 0xffffff];
  }));
  const grassMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.12);
  const tufts = scatter(mobile ? 2200 : 4200, -30, 32, -30, 45);
  const grass = new THREE.InstancedMesh(tuftGeo, grassMat, tufts.length);
  tufts.forEach((t, i) => {
    m4.compose(v3.set(t.x, t.h - 0.12, t.z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(1, P.grassH * (0.7 + rnd() * 0.7), 1));
    grass.setMatrixAt(i, m4);
    grass.setColorAt(i, tint.set(pick(P.grass)).multiplyScalar(1.05 + rnd() * 0.25));
  });
  scene.add(grass);
  let flowers = null;
  if (P.flowers.length) {
    const fl = scatter(mobile ? 450 : 900, -22, 24, 6, 40);
    const fGeo = mergeColored([
      [new THREE.CylinderGeometry(0.008, 0.01, 0.3, 3).translate(0, 0.15, 0), 0x5d8a3e],
      [new THREE.IcosahedronGeometry(0.06, 0).translate(0, 0.32, 0), 0xffffff],
    ]);
    flowers = new THREE.InstancedMesh(fGeo, grassMat, fl.length);
    fl.forEach((t, i) => {
      m4.compose(v3.set(t.x, t.h - 0.12, t.z), q.identity(), sc.setScalar(0.8 + rnd() * 0.6));
      flowers.setMatrixAt(i, m4);
      flowers.setColorAt(i, tint.set(pick(P.flowers)));
    });
    scene.add(flowers);
  }
  let leaves = null;
  if (season.name === 'automne') {
    const lv = scatter(mobile ? 700 : 1400, -25, 25, -25, 30, false);
    const lGeo = new THREE.CircleGeometry(0.08, 4).rotateX(-Math.PI / 2);
    leaves = new THREE.InstancedMesh(lGeo, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), lv.length);
    lv.forEach((t, i) => {
      m4.compose(v3.set(t.x, t.h - 0.1 + rnd() * 0.02, t.z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(1 + rnd(), 1, 0.6 + rnd() * 0.6));
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, tint.set(pick(P.leaves)));
    });
    scene.add(leaves);
  }
  // rochers, dont des blocs moussus le long de la rive
  const rocks = scatter(mobile ? 120 : 220, -90, 90, -60, 40, true);
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * 2 - 1) * 70;
    if (Math.abs(x - 2.5) < 4) continue;
    const z = shoreNear(x) - 0.5 + rnd() * 2;
    rocks.push({ x, z, h: height(x, z), shore: true });
  }
  const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x86837d, roughness: 1, flatShading: true }), rocks.length);
  rocks.forEach((t, i) => {
    const s = t.shore ? 0.5 + rnd() * 1.4 : 0.4 + Math.pow(rnd(), 2) * 2.2;
    m4.compose(v3.set(t.x, t.h - 0.15 * s, t.z), q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), sc.set(s * (0.8 + rnd() * 0.5), s * 0.6, s));
    rockMesh.setMatrixAt(i, m4);
    rockMesh.setColorAt(i, tint.setHSL(0.1, 0.05, 0.42 + rnd() * 0.15));
  });
  rockMesh.castShadow = shadows;
  rockMesh.receiveShadow = true;
  scene.add(rockMesh);

  // ------------------------------------------------------------------ extérieur de la cabane, chemin, ponton
  const B = new Builder();
  B.defineMaterial('plain', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  B.defineMaterial('glow', new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffbe72, emissiveIntensity: 1, roughness: 1 }));
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  B.defineMaterial('roof', roofMat);
  // toit végétal (torvtak) à deux pans + rives en bois
  const EAVE = 3.25, RIDGE = 5.6, ZE = 6.85, XE = 8.75;
  const slopeLen = Math.hypot(ZE, RIDGE - EAVE), ang = Math.atan2(RIDGE - EAVE, ZE);
  for (const s of [-1, 1]) {
    const sod = new THREE.BoxGeometry(XE * 2, 0.28, slopeLen + 0.1, 24, 1, 10);
    const p = sod.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + (NZ.noise(p.getX(i) * 0.9, p.getZ(i) * 0.9 + s * 7) * 0.06));
    sod.computeVertexNormals();
    sod.rotateX(s * ang);
    sod.translate(0, (EAVE + RIDGE) / 2 + 0.14, s * ZE / 2);
    B.add(sod, 0xffffff, 'roof');
    const under = new THREE.BoxGeometry(XE * 2, 0.08, slopeLen + 0.12);
    under.rotateX(s * ang);
    under.translate(0, (EAVE + RIDGE) / 2 - 0.04, s * ZE / 2);
    B.add(under, 0x6b4a33);
  }
  for (const s of [-1, 1]) {
    // pignons en rondins
    const sh = new THREE.Shape();
    sh.moveTo(-6.35, 0); sh.lineTo(6.35, 0); sh.lineTo(0, RIDGE - EAVE + 0.05); sh.lineTo(-6.35, 0);
    const gable = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false });
    gable.rotateY(Math.PI / 2);
    gable.translate(s * 8.2 - 0.11, EAVE - 0.01, 0);
    B.add(gable, 0xb98a5c);
    for (let k = 1; k < 5; k++) {
      const y = EAVE + k * 0.45, w = 6.35 * (1 - (k * 0.45) / (RIDGE - EAVE));
      B.box(s * 8.2 - 0.13, y, -w, s * 8.2 + 0.13, y + 0.025, w, 0x8a6240);
    }
    // planches de rive
    const vb = new THREE.BoxGeometry(0.1, 0.32, slopeLen + 0.3);
    vb.rotateX(ang); vb.translate(s * XE, (EAVE + RIDGE) / 2 + 0.12, ZE / 2);
    B.add(vb, 0x5a3b26);
    const vb2 = new THREE.BoxGeometry(0.1, 0.32, slopeLen + 0.3);
    vb2.rotateX(-ang); vb2.translate(s * XE, (EAVE + RIDGE) / 2 + 0.12, -ZE / 2);
    B.add(vb2, 0x5a3b26);
  }
  // cheminée en pierre
  B.box(-0.15, 3.1, -6.05, 1.15, 6.35, -5.15, 0x8a847d);
  for (let y = 3.3; y < 6.3; y += 0.32) for (const [x0, x1] of [[-0.18, 0.45], [0.47, 1.18]]) B.box(x0 + (y * 7 % 1) * 0.1, y, -6.08, x1, y + 0.28, -5.12, pick([0x8f8a83, 0x9e978d, 0x7c7772, 0xa8a095]));
  B.box(-0.25, 6.35, -6.15, 1.25, 6.45, -5.05, 0x6f6a64);
  // soubassement en pierre
  for (const [x0, z0, x1, z1] of [[-8.3, 6.15, 8.3, 6.35], [-8.3, -6.35, 8.3, -6.15], [-8.35, -6.35, -8.15, 6.35], [8.15, -6.35, 8.35, 6.35]]) B.box(x0, -0.6, z0, x1, 0.05, z1, 0x7d7871);
  // terrasse en bois devant la porte + marche
  B.box(-1.25, -0.5, 6.2, 1.75, 0.02, 7.8, 0x7b5c41, 'plain');
  for (let k = 0; k < 10; k++) B.box(-1.25, 0.02, 6.2 + k * 0.16, 1.75, 0.03, 6.2 + k * 0.16 + 0.14, k % 2 ? 0x8a6a4c : 0x80613f);
  B.box(-0.5, -0.5, 7.8, 1.0, -0.1, 8.15, 0x6b4a33);
  // paillasson extérieur
  B.box(-0.15, 0.03, 6.3, 0.65, 0.04, 6.75, 0x5f6f5c);
  // chemin de pierres jusqu'au fjord
  const zShore = shoreNear(PATH_X(25));
  for (let z = 8.5; z < zShore - 1.2; z += 0.8) {
    const x = PATH_X(z) + (rnd() - 0.5) * 0.2;
    const g = new THREE.CylinderGeometry(0.3 + rnd() * 0.12, 0.34 + rnd() * 0.12, 0.1, 7);
    g.rotateY(rnd() * 3);
    g.translate(x, height(x, z) - 0.08, z);
    B.add(g, pick([0x9a948a, 0x8a8479, 0xa59e92]));
  }
  // lanterne au bord de la terrasse
  const lx = 1.95, lz = 8.05, ly = height(lx, lz) - 0.12;
  B.cyl(lx, ly, lz, 0.06, 0.08, 1.5, 0x3b2c22, 6);
  B.box(lx - 0.13, ly + 1.5, lz - 0.13, lx + 0.13, ly + 1.52, lz + 0.13, 0x2f2b28);
  B.box(lx - 0.1, ly + 1.52, lz - 0.1, lx + 0.1, ly + 1.78, lz + 0.1, 0xffffff, 'glow');
  const lroof = new THREE.ConeGeometry(0.2, 0.16, 4);
  lroof.rotateY(Math.PI / 4);
  lroof.translate(lx, ly + 1.86, lz);
  B.add(lroof, 0x2f2b28);
  // ponton droit vers le sud, banc face à la ville
  const PX = 2.6, pz0 = shoreNear(PX) - 2.5, PLEN = 14, deckY = WATER + 0.5;
  for (let k = 0; k < PLEN / 0.5; k++) B.box(PX - 0.8, deckY - 0.07, pz0 + k * 0.5, PX + 0.8, deckY, pz0 + k * 0.5 + 0.46, k % 3 ? 0x8a6a4c : 0x7b5c41);
  for (let k = 2; k <= PLEN; k += 3) for (const sx of [-0.75, 0.75]) B.cyl(PX + sx, WATER - 3, pz0 + k, 0.09, 0.09, 3.5, 0x5e4634, 6);
  B.box(PX - 0.85, deckY, pz0 + 2, PX - 0.8, deckY + 0.9, pz0 + PLEN, 0x6b4a33); // garde-corps léger
  const benchZ = pz0 + PLEN - 1.2;
  B.box(PX - 0.6, deckY, benchZ - 0.05, PX + 0.6, deckY + 0.45, benchZ + 0.3, 0x6b4a33);
  B.box(PX - 0.6, deckY + 0.45, benchZ - 0.12, PX + 0.6, deckY + 0.85, benchZ - 0.05, 0x6b4a33);
  // barque amarrée
  B.push(PX + 1.7, WATER + 0.05, pz0 + 8, 0.08);
  const hull = new THREE.CylinderGeometry(0.62, 0.44, 0.38, 10, 1, true);
  hull.scale(1, 1, 2.6);
  hull.translate(0, 0.19, 0);
  B.add(hull, 0xa64a36);
  B.box(-0.5, 0.06, -1.2, 0.5, 0.1, 1.2, 0x7b5c41);
  B.box(-0.55, 0.22, -0.15, 0.55, 0.27, 0.15, 0x7b5c41);
  B.pop();
  B.build(scene, { shadows });
  const lanternLight = new THREE.PointLight(0xffb366, 0, 9, 1.6);
  lanternLight.position.set(lx, ly + 1.65, lz);
  scene.add(lanternLight);

  // fumée de la cheminée
  const NSM = 36;
  const smGeo = new THREE.BufferGeometry();
  const smPos = new Float32Array(NSM * 3), smLife = new Float32Array(NSM);
  for (let i = 0; i < NSM; i++) smLife[i] = i / NSM;
  smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
  const smoke = new THREE.Points(smGeo, new THREE.PointsMaterial({ color: 0xd8d6d2, size: 0.9, transparent: true, opacity: 0.22, depthWrite: false }));
  smoke.frustumCulled = false;
  scene.add(smoke);

  // ------------------------------------------------------------------ ville sur l'autre rive
  const town = buildTown(scene, { height, shoreFar, WATER, mobile });

  // ------------------------------------------------------------------ nuages (3 couches)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, flatShading: true, fog: false, transparent: true, opacity: 0 });
  const clouds = new THREE.Group();
  const layers = [];
  for (let L = 0; L < 3; L++) {
    const parts = [];
    const n = [10, 14, 20][L];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 200 + rnd() * 1800, y = 260 + rnd() * 200 + L * 40;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, size = 30 + rnd() * 45;
      const puffs = 5 + Math.floor(rnd() * 5);
      for (let k = 0; k < puffs; k++) {
        const g = new THREE.IcosahedronGeometry(size * (0.55 + rnd() * 0.5), 1);
        g.scale(1.3, 0.55, 1);
        g.translate(cx + (k - puffs / 2) * size * 0.75 + rnd() * 10, y + rnd() * size * 0.3, cz + (rnd() - 0.5) * size);
        parts.push([g, 0xffffff]);
      }
    }
    const mesh = new THREE.Mesh(mergeColored(parts), cloudMat.clone());
    mesh.material.vertexColors = true;
    clouds.add(mesh);
    layers.push(mesh);
  }
  scene.add(clouds);

  // ------------------------------------------------------------------ pluie et neige : autour de toi, jamais dans la cabane
  const insideCabin = 'abs(vW.x) < 8.35 && abs(vW.z) < 6.35 && vW.y < 5.6';
  const NRAIN = mobile ? 7000 : 14000, BOX = 22;
  const rs = new Float32Array(NRAIN * 2 * 4), tip = new Float32Array(NRAIN * 2);
  for (let i = 0; i < NRAIN; i++) {
    const sx = (rnd() * 2 - 1) * BOX, sz = (rnd() * 2 - 1) * BOX, sy = rnd() * 30, w = rnd();
    for (let e = 0; e < 2; e++) { rs.set([sx, sz, sy, w], (i * 2 + e) * 4); tip[i * 2 + e] = e; }
  }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NRAIN * 6), 3));
  rgeo.setAttribute('seed', new THREE.BufferAttribute(rs, 4));
  rgeo.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
  const camU = { value: new THREE.Vector3() };
  const rainU = { uTime: uniforms.uTime, uCam: camU, uAmount: { value: 0 }, uWindXZ: { value: new THREE.Vector2(1.5, 0.5) }, uColor: { value: new THREE.Color(0xdde4ec) } };
  const wrapXZ = `vec2 c = uCam.xz; vec2 q = c + mod(seed.xy - c + ${BOX.toFixed(1)}, ${(2 * BOX).toFixed(1)}) - ${BOX.toFixed(1)};`;
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; uniform vec3 uCam; attribute vec4 seed; attribute float tip; varying vec3 vW; varying float vA;
      void main(){ ${wrapXZ} float y = uCam.y - 8.0 + mod(seed.z - uTime * 9.0, 30.0);
        vec3 p = vec3(q.x, y, q.y) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * ((y - uCam.y) * 0.06);
        p += vec3(uWindXZ.x * 0.07, 0.85, uWindXZ.y * 0.07) * tip;
        vA = step(seed.w, uAmount); vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vW; varying float vA;
      void main(){ if (vA < 0.5 || (${insideCabin})) discard; gl_FragColor = vec4(uColor, 0.5); }`,
  }));
  rain.frustumCulled = false;
  scene.add(rain);
  const NSNOW = mobile ? 3000 : 6000;
  const ss = new Float32Array(NSNOW * 4);
  for (let i = 0; i < NSNOW; i++) ss.set([(rnd() * 2 - 1) * BOX, (rnd() * 2 - 1) * BOX, rnd() * 24, rnd()], i * 4);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSNOW * 3), 3));
  sgeo.setAttribute('seed', new THREE.BufferAttribute(ss, 4));
  const snowU = { uTime: uniforms.uTime, uCam: camU, uAmount: { value: 0 }, uWindXZ: rainU.uWindXZ, uScale: { value: innerHeight * 0.5 } };
  const snow = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: snowU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; uniform float uScale; uniform vec3 uCam; attribute vec4 seed; varying vec3 vW; varying float vA;
      void main(){ ${wrapXZ} float t = uTime * (0.9 + seed.w * 0.6); float y = uCam.y - 6.0 + mod(seed.z - t, 24.0);
        vec3 p = vec3(q.x + sin(t * 0.7 + seed.w * 20.0) * 0.6, y, q.y + cos(t * 0.5 + seed.w * 13.0) * 0.6) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * ((y - uCam.y) * 0.08);
        vA = step(seed.w, uAmount); vW = p;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.11 + seed.w * 0.09) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vW; varying float vA;
      void main(){ if (vA < 0.5 || (${insideCabin})) discard; float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.85 * (1.0 - d * 1.6)); }`,
  }));
  snow.frustumCulled = false;
  scene.add(snow);

  // ------------------------------------------------------------------ où l'on peut marcher dehors (murs invisibles)
  const PONTOON = { x0: PX - 0.62, x1: PX + 0.62, z0: pz0 - 0.4, z1: pz0 + PLEN - 0.25, y: deckY };
  const DECK = { x0: -1.25, x1: 1.75, z0: 6.15, z1: 7.8, y: 0.03 };
  const walkEdge = new Map();
  const shoreWalk = (x) => {
    const k = Math.round(x * 2) / 2;
    if (walkEdge.has(k)) return walkEdge.get(k);
    let z = 8;
    while (z < 80 && height(k, z) > WATER + 0.35) z += 0.25;
    walkEdge.set(k, z - 0.5);
    return z - 0.5;
  };
  const inRect = (R, x, z) => x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1;
  function groundAt(x, z) {
    if (Math.abs(x) < 8.25 && z < 6.15 && z > -6.25) return 0;
    if (inRect(DECK, x, z)) return DECK.y;
    if (inRect(PONTOON, x, z)) return PONTOON.y;
    return height(x, z) - 0.06;
  }
  // garde la position dans la zone autorisée (de la porte jusqu'au fjord)
  function clampOutside(p) {
    if (p.z <= 6.12) return p;
    // sur le ponton : on y reste (on ne tombe pas à l'eau), jusqu'au bout
    const nearPontoon = p.x > PONTOON.x0 - 0.6 && p.x < PONTOON.x1 + 0.6;
    if (nearPontoon && p.z > PONTOON.z0 + 0.5 && p.z > shoreWalk(p.x) - 0.3) {
      p.x = Math.min(PONTOON.x1 - 0.05, Math.max(PONTOON.x0 + 0.05, p.x));
      p.z = Math.min(PONTOON.z1 - 0.05, p.z);
      return p;
    }
    const zz = Math.max(p.z, 6.2);
    const span = smooth(7.5, 22, zz);
    const xmin = lerp(-2.0, -15, span), xmax = lerp(2.6, 17, span);
    p.x = Math.min(xmax, Math.max(xmin, p.x));
    const edge = shoreWalk(p.x);
    if (p.z > edge && !inRect(PONTOON, p.x, p.z)) p.z = edge;
    return p;
  }

  // ------------------------------------------------------------------ mise à jour
  let snowShown = -1;
  const deep = new THREE.Color(), tmp = new THREE.Color(), sodCol = new THREE.Color();
  function update(t, dt, w, sky, cam) {
    uniforms.uTime.value = t;
    uniforms.uWind.value = 0.1 + w.wind * 0.9;
    camU.value.copy(cam);
    wU.uWave.value = 0.06 + w.wind * 0.3 + w.rain * 0.05;
    rainU.uAmount.value = w.rain;
    rainU.uWindXZ.value.set(0.6 + w.wind * 6, 0.3 + w.wind * 2);
    snowU.uAmount.value = w.snow;
    snowU.uScale.value = innerHeight * Math.min(devicePixelRatio, 2) * 0.5;
    const sAmt = Math.max(smooth(0.0, 0.06, w.snowDepth || 0), w.snow * 0.5);
    if (Math.abs(sAmt - snowShown) > 0.02) {
      snowShown = sAmt;
      for (let i = 0; i < curCol.length; i++) curCol[i] = lerp(baseCol[i], snowCol[i], sAmt);
      tgeo.attributes.color.needsUpdate = true;
      for (const c of caps) c.visible = sAmt > 0.25;
      grass.visible = sAmt < 0.6;
      if (flowers) flowers.visible = sAmt < 0.4;
      if (leaves) leaves.visible = sAmt < 0.5;
      // toit végétal : herbe de saison, blanc sous la neige
      sodCol.set(P.grass[0]).lerp(tmp.set(0xeef1f4), sAmt);
      roofMat.color.copy(sodCol);
    }
    // nuages
    clouds.rotation.y += dt * (0.0008 + w.wind * 0.003);
    const cov = w.cloud;
    const grey = Math.min(1, w.rain * 0.8 + w.snow * 0.5 + smooth(0.7, 1, cov) * 0.4);
    tmp.set(0xffffff).lerp(deep.set(0x8a929c), grey);
    layers.forEach((m, i) => {
      m.material.opacity = [smooth(0.05, 0.3, cov), smooth(0.3, 0.6, cov), smooth(0.6, 0.9, cov)][i] * (1 - w.fog * 0.6);
      m.visible = m.material.opacity > 0.01;
      m.material.color.copy(tmp);
      m.material.emissive.copy(sky.horizon).multiplyScalar(0.55 + grey * 0.3);
    });
    // fjord : eau sombre et profonde qui reflète le ciel
    const day = sky.day;
    deep.set(0x050d14).lerp(tmp.set(0x1b5361), day).lerp(tmp.set(0x46585c), Math.min(1, cov * 0.5 + w.rain * 0.4) * day);
    waterMat.color.copy(deep);
    wU.uSky.value.copy(sky.horizon);
    waterMat.roughness = 0.06 + w.rain * 0.3 + w.wind * 0.12;
    // lanterne
    lanternLight.intensity = 3 * (1 - day);
    B.materials.get('glow').emissiveIntensity = 0.15 + 1.6 * (1 - day);
    // fumée
    for (let i = 0; i < NSM; i++) {
      smLife[i] += dt * 0.06;
      if (smLife[i] > 1) smLife[i] -= 1;
      const L = smLife[i];
      smPos[i * 3] = 0.5 + Math.sin(i * 7.1 + t * 0.3) * 0.15 * L + (0.6 + w.wind * 4) * L * L;
      smPos[i * 3 + 1] = 6.5 + L * 7;
      smPos[i * 3 + 2] = -5.6 + Math.cos(i * 3.3) * 0.2 * L + (0.3 + w.wind * 1.5) * L * L;
    }
    smGeo.attributes.position.needsUpdate = true;
    town.update(t, dt, sky, w);
  }
  return { update, groundAt, clampOutside, pontoon: { x: PX, z0: pz0, len: PLEN, y: deckY, benchZ }, pathX: PATH_X, shoreWalk };
}
