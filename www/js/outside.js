// Paysage autour de la cabane : prairie, lac et montagnes façon Annecy,
// forêt qui change avec les saisons, nuages, pluie, neige et vent en direct.
import * as THREE from '../vendor/three.module.min.js';
import { makeNoise } from './noise.js';
import { Builder, mergeColored } from './builder.js';

export const WATER = -2.6;
const NZ = makeNoise(7);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// --- le lac, au nord de la cabane (visible depuis la cuisine et le coin lecture)
const LC = { x: 8, z: -70 }, LA = 0.24, LU = 140, LV = 32;
function lakeD(x, z) {
  const dx = x - LC.x, dz = z - LC.z, c = Math.cos(LA), s = Math.sin(LA);
  const u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.hypot(u / LU, v / LV) + NZ.fbm(x * 0.018, z * 0.018, 3) * 0.16;
}

// Relief : plat autour de la cabane, collines douces, lac, puis montagnes
export function height(x, z) {
  const r = Math.hypot(x, z);
  const d = lakeD(x, z);
  const nearLake = 1 - smooth(1.0, 2.0, d);
  let h = (NZ.fbm(x * 0.011, z * 0.011) * 5.5 + NZ.fbm(x * 0.05, z * 0.05, 3) * 0.7) * (1 - nearLake * 0.85);
  const m1 = smooth(110, 300, r), m2 = smooth(280, 700, r);
  const ridge = NZ.ridge(x * 0.0055 + 3.1, z * 0.0055 - 1.7, 3);
  const massif = NZ.ridge(x * 0.0028 - 4.3, z * 0.0028 + 2.2, 3);
  h += m1 * (16 + 60 * ridge) + m2 * (50 + 190 * massif * massif + 30 * ridge);
  h *= smooth(9, 26, r);
  h = Math.max(h - 0.12, -1.4) - 1.6 * nearLake * smooth(12, 34, r);
  const inLake = smooth(1.3, 0.86, d);
  return lerp(h, -8 - 4 * smooth(0.8, 0.2, d), inLake);
}

// --- palettes de saison
const PAL = {
  printemps: { grass: [0x7fae58, 0x96bd63, 0x6d9a4c], dry: 0x8fa35a, leaves: [0x8fc25a, 0xa7cf6a, 0xf3c6d0, 0xfbe7ee, 0x9acb63], flowers: [0xfff4e0, 0xf6d24a, 0xe6a1c4, 0xb9a3e6, 0x9fc7f0], snowline: 150, grassH: 1 },
  ete: { grass: [0x6c9a46, 0x7fa84f, 0x5d8a3e], dry: 0x9d9b55, leaves: [0x5e8a3e, 0x6d9746, 0x4f7a37, 0x76a04c], flowers: [0xfff4e0, 0xf2c94c, 0xe58fb0, 0x9b8fe0, 0xff9a62], snowline: 215, grassH: 1.15 },
  automne: { grass: [0x7d9a4d, 0x8ea456, 0x6d8a45], dry: 0xb39a5a, leaves: [0xd9822b, 0xc4502c, 0xe6b23a, 0xb8692f, 0x9a7a35, 0xe09a3a], flowers: [0xd9b45a], snowline: 160, grassH: 0.9 },
  hiver: { grass: [0x7f805e, 0x8c8a66, 0x707356], dry: 0x8f8a6a, leaves: [0x6e5a3a], flowers: [], snowline: 95, grassH: 0.6 },
};

export function createOutside(scene, { season, mobile = false, shadows = true }) {
  const P = PAL[season.name];
  const rnd = NZ.rnd;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const col = new THREE.Color(), c2 = new THREE.Color();
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.2 } };

  // ------------------------------------------------------------------ relief
  const NR = mobile ? 90 : 120, NA = mobile ? 150 : 200, RMAX = 950;
  const pos = [], idx = [];
  const ring = (i) => (i === 0 ? 0 : 4 + (RMAX - 4) * Math.pow((i - 1) / (NR - 1), 2.1));
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
  for (let i = 1; i < NR; i++) {
    for (let j = 0; j < NA; j++) {
      const a = 1 + (i - 1) * NA + j, b = 1 + (i - 1) * NA + ((j + 1) % NA);
      const c = a + NA, d = b + NA;
      idx.push(a, b, c, b, d, c);
    }
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
    col.lerp(c2.set(P.dry), smooth(0.6, 0.85, NZ.fbm(x * 0.02 - 5, z * 0.02, 2) * 0.5 + 0.5) * 0.5);
    // forêt de montagne (bandes sombres)
    const forest = smooth(10, 26, y) * (1 - smooth(70, 120, y)) * smooth(-0.1, 0.3, NZ.fbm(x * 0.012, z * 0.012 - 7, 3));
    if (forest > 0) {
      c2.set(season.name === 'automne' ? (patch > 0.6 ? 0x9a6a32 : 0x3f5a3a) : 0x3c573a);
      col.lerp(c2, forest * 0.9);
    }
    // roche : pentes raides et altitude
    const rock = Math.max(smooth(0.35, 0.6, slope), smooth(60, 110, y));
    col.lerp(c2.set(patch > 0.5 ? 0x8b857c : 0x7a756f), rock);
    // grève et fond du lac
    col.lerp(c2.set(0xb9ab88), smooth(WATER + 0.7, WATER + 0.1, y) * (y > WATER - 1.5 ? 1 : 0));
    if (y < WATER - 0.4) col.set(0x3e5550).lerp(c2.set(0x2c403e), smooth(WATER - 1, WATER - 6, y));
    // neiges éternelles selon la saison
    const snowL = P.snowline + NZ.fbm(x * 0.02, z * 0.02, 2) * 25;
    col.lerp(c2.set(0xf2f4f6), smooth(snowL, snowL + 18, y) * (slope < 0.75 ? 1 : 0.5));
    baseCol[v * 3] = col.r; baseCol[v * 3 + 1] = col.g; baseCol[v * 3 + 2] = col.b;
    // version enneigée (neige au sol en direct)
    c2.set(0xeef1f4).lerp(col, (y < WATER - 0.2 ? 1 : 0) + smooth(0.5, 0.8, slope) * 0.6 + (patch < 0.2 ? 0.15 : 0));
    snowCol[v * 3] = c2.r; snowCol[v * 3 + 1] = c2.g; snowCol[v * 3 + 2] = c2.b;
  }
  curCol.set(baseCol);
  tgeo.setAttribute('color', new THREE.BufferAttribute(curCol, 3));
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ------------------------------------------------------------------ lac
  const wgeo = new THREE.PlaneGeometry(LU * 2.6, LV * 3.4, mobile ? 70 : 110, mobile ? 20 : 30);
  wgeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e6b73, roughness: 0.12, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.93 });
  const wU = { uTime: uniforms.uTime, uWave: { value: 0.12 }, uSky: { value: new THREE.Color(0xcfe2ee) } };
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wU);
    sh.fragmentShader = 'uniform vec3 uSky;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 4.0);
      outgoingLight = mix(outgoingLight, uSky, clamp(fres * 0.7, 0.0, 0.7));
      #include <opaque_fragment>`);
    sh.vertexShader = 'uniform float uTime; uniform float uWave;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += (sin(position.x * 0.21 + uTime * 0.9) * 0.5 + sin(position.z * 0.33 - uTime * 1.2) * 0.4 + sin((position.x + position.z) * 0.5 + uTime * 1.9) * 0.25) * uWave;`);
  };
  const water = new THREE.Mesh(wgeo, waterMat);
  water.position.set(LC.x, WATER, LC.z);
  water.rotation.y = LA;
  scene.add(water);

  // ------------------------------------------------------------------ arbres
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
  const treeMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.012);
  const leafMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.016);
  const snowCapMat = sway(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.9, flatShading: true }), 0.012);

  // sapin : tronc + 4 étages ; chapeaux de neige séparés
  const pineParts = [[new THREE.CylinderGeometry(0.14, 0.22, 1.4, 6).translate(0, 0.7, 0), 0x5a3f2c]];
  const capParts = [];
  for (let k = 0; k < 4; k++) {
    const r = 1.55 - k * 0.33, h = 1.9 - k * 0.25, y = 1.2 + k * 0.95;
    pineParts.push([new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0), [0x3f6345, 0x46704b, 0x3a5c41, 0x4b744d][k]]);
    // chapeau de neige : épouse le haut de l'étage, légèrement plus large
    const ch = h * 0.55 + 0.06;
    capParts.push([new THREE.ConeGeometry(r * 0.55 * 1.07, ch, 7).translate(0, y + h * 0.45 + ch / 2, 0), 0xffffff]);
  }
  const pineGeo = mergeColored(pineParts), capGeo = mergeColored(capParts);
  // feuillu : tronc + branches, houppier en boules
  const trunkParts = [[new THREE.CylinderGeometry(0.13, 0.22, 2.6, 6).translate(0, 1.3, 0), 0x6b4a33]];
  for (const [a, t] of [[0.6, 0.5], [2.6, -0.6], [4.4, 0.55]]) {
    const b = new THREE.CylinderGeometry(0.04, 0.08, 1.5, 5).translate(0, 0.75, 0);
    b.rotateZ(t);
    b.rotateY(a);
    b.translate(0, 2.0, 0);
    trunkParts.push([b, 0x6b4a33]);
  }
  const trunkGeo = mergeColored(trunkParts);
  const crownParts = [];
  for (const [x, y, z, s] of [[0, 3.6, 0, 1.45], [0.85, 3.1, 0.3, 1.0], [-0.8, 3.2, -0.2, 1.05], [0.1, 4.4, -0.3, 0.95], [-0.2, 3.0, 0.8, 0.9]]) {
    crownParts.push([new THREE.IcosahedronGeometry(s, 0).translate(x, y, z), 0xffffff]);
  }
  const crownGeo = mergeColored(crownParts);

  const nPine = mobile ? 420 : 760, nDec = mobile ? 150 : 280;
  const spots = { pine: [], dec: [] };
  const okSpot = (x, z, maxH) => {
    const r = Math.hypot(x, z);
    if (r < 11.5) return null;
    if (Math.abs(x - 0.3) < 2.4 && z > 5 && z < 32) return null; // chemin
    const h = height(x, z);
    if (h < WATER + 0.5 || h > maxH) return null;
    const e = 1.2, slope = Math.abs(height(x + e, z) - h) + Math.abs(height(x, z + e) - h);
    if (slope > 1.6) return null;
    return h;
  };
  let guard = 0;
  while ((spots.pine.length < nPine || spots.dec.length < nDec) && guard++ < 40000) {
    const a = rnd() * Math.PI * 2, r = 11.5 + Math.pow(rnd(), 1.6) * 330;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // bosquets : plus dense là où le bruit est positif
    const g = NZ.fbm(x * 0.03 + 11, z * 0.03, 2);
    if (g < -0.05 && rnd() < 0.8) continue;
    // vues dégagées : vers le lac au nord, prairie tout autour de la cabane
    if (z < -6 && Math.abs(x - 2) < 0.8 * -z + 7 && lakeD(x, z) > 0.9 && lakeD(x, z) < 1.6) continue;
    if (z < -6 && Math.abs(x - 2) < 0.8 * -z + 7 && -z < 45) continue;
    if (r < 26 && rnd() < 0.85) continue;
    const isDec = rnd() < (r < 90 ? 0.4 : 0.15);
    const h = okSpot(x, z, isDec ? 40 : 95);
    if (h === null) continue;
    const list = isDec ? spots.dec : spots.pine;
    if (list.length >= (isDec ? nDec : nPine)) continue;
    list.push({ x, z, h, s: (0.8 + rnd() * 0.75) * (r < 40 ? 1.15 : 1), rot: rnd() * 6.28, r });
  }
  // quelques arbres choisis pour encadrer les fenêtres
  for (const [x, z, dec] of [[13.5, 2.5], [-12.5, 2, 1], [11, 13], [-8, 14.5], [-22, -9, 1], [24, -10, 1], [18, -4]]) {
    const h = height(x, z);
    (dec ? spots.dec : spots.pine).push({ x, z, h, s: 1.25 + rnd() * 0.3, rot: rnd() * 6.28, r: Math.hypot(x, z) });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const setM = (s) => m4.compose(v3.set(s.x, s.h - 0.15, s.z), q.setFromAxisAngle(up, s.rot), sc.setScalar(s.s));
  const instanced = (geo, mat, list, castNear, fn) => {
    const out = [];
    for (const near of [true, false]) {
      const L = list.filter((s) => (s.r < 40) === near);
      if (!L.length) continue;
      const m = new THREE.InstancedMesh(geo, mat, L.length);
      L.forEach((s, i) => { setM(s); m.setMatrixAt(i, m4); if (fn) { m.setColorAt(i, fn(s, i)); } });
      m.castShadow = shadows && near && castNear;
      m.receiveShadow = true;
      scene.add(m);
      out.push(m);
    }
    return out;
  };
  const tint = new THREE.Color();
  instanced(pineGeo, treeMat, spots.pine, true, () => tint.setHSL(0, 0, 0.88 + rnd() * 0.22));
  const caps = instanced(capGeo, snowCapMat, spots.pine, false);
  instanced(trunkGeo, treeMat, spots.dec, true);
  // houppiers selon la saison (en hiver : branches nues)
  const crownSpots = spots.dec.filter(() => season.name !== 'hiver' && rnd() >= season.autumnBare * 0.9);
  if (crownSpots.length) instanced(crownGeo, leafMat, crownSpots, true, () => tint.set(pick(P.leaves)).multiplyScalar(0.85 + rnd() * 0.3));

  // ------------------------------------------------------------------ sol : herbe, fleurs, feuilles, rochers
  const scatter = (count, rmin, rmax, avoidPath = true) => {
    const out = [];
    let g2 = 0;
    while (out.length < count && g2++ < count * 20) {
      const a = rnd() * Math.PI * 2, r = rmin + Math.pow(rnd(), 1.4) * (rmax - rmin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 8.6 && Math.abs(z) < 6.6) continue;
      if (avoidPath && Math.abs(x - 0.3 - Math.sin(z * 0.25) * 1.4) < 0.8 && z > 6 && z < 30) continue;
      const h = height(x, z);
      if (h < WATER + 0.35) continue;
      out.push({ x, z, h, r });
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
  const tufts = scatter(mobile ? 1600 : 3200, 8.5, 70);
  const grass = new THREE.InstancedMesh(tuftGeo, grassMat, tufts.length);
  tufts.forEach((t, i) => {
    m4.compose(v3.set(t.x, t.h - 0.12, t.z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(1, P.grassH * (0.7 + rnd() * 0.7), 1));
    grass.setMatrixAt(i, m4);
    grass.setColorAt(i, tint.set(pick(P.grass)).multiplyScalar(1.05 + rnd() * 0.25));
  });
  scene.add(grass);

  let flowers = null;
  if (P.flowers.length && season.name !== 'automne') {
    const fl = scatter(mobile ? 400 : 800, 9, 45);
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
    const lv = scatter(mobile ? 700 : 1400, 8.5, 40, false);
    const lGeo = new THREE.CircleGeometry(0.09, 4).rotateX(-Math.PI / 2);
    leaves = new THREE.InstancedMesh(lGeo, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), lv.length);
    lv.forEach((t, i) => {
      m4.compose(v3.set(t.x, t.h - 0.1 + rnd() * 0.02, t.z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(1 + rnd(), 1, 0.6 + rnd() * 0.6));
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, tint.set(pick(P.leaves)));
    });
    scene.add(leaves);
  }
  const rocks = scatter(mobile ? 90 : 160, 10, 140, true);
  const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x8c877f, roughness: 1, flatShading: true }), rocks.length);
  rocks.forEach((t, i) => {
    const s = 0.4 + Math.pow(rnd(), 2) * 2.2;
    m4.compose(v3.set(t.x, t.h - 0.15 * s, t.z), q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), sc.set(s * (0.8 + rnd() * 0.5), s * 0.6, s));
    rockMesh.setMatrixAt(i, m4);
  });
  rockMesh.castShadow = shadows;
  rockMesh.receiveShadow = true;
  scene.add(rockMesh);

  // ------------------------------------------------------------------ chemin, lanterne, ponton, barque
  const B = new Builder();
  B.defineMaterial('plain', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  B.defineMaterial('glow', new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffbe72, emissiveIntensity: 1, roughness: 1 }));
  for (let i = 0; i < 26; i++) {
    const z = 6.9 + i * 0.85, x = 0.3 + Math.sin(z * 0.25) * 1.4 + (rnd() - 0.5) * 0.2;
    const g = new THREE.CylinderGeometry(0.32 + rnd() * 0.12, 0.36 + rnd() * 0.12, 0.08, 7);
    g.rotateY(rnd() * 3);
    g.translate(x, height(x, z) - 0.08, z);
    B.add(g, pick([0x9a948a, 0x8a8479, 0xa59e92]));
  }
  // lanterne près de la porte
  const lx = 1.6, lz = 7.6, ly = height(lx, lz) - 0.12;
  B.cyl(lx, ly, lz, 0.06, 0.08, 1.5, 0x3b2c22, 6);
  B.box(lx - 0.13, ly + 1.5, lz - 0.13, lx + 0.13, ly + 1.52, lz + 0.13, 0x2f2b28);
  B.box(lx - 0.1, ly + 1.52, lz - 0.1, lx + 0.1, ly + 1.78, lz + 0.1, 0xffffff, 'glow');
  const roof = new THREE.ConeGeometry(0.2, 0.16, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(lx, ly + 1.86, lz);
  B.add(roof, 0x2f2b28);
  // ponton sur la rive la plus proche (vers le nord-est)
  let px = 4, pz = -12;
  const dir = new THREE.Vector2(0.28, -1).normalize();
  for (let k = 0; k < 120 && height(px, pz) > WATER - 0.2; k++) { px += dir.x; pz += dir.y; }
  const jy = WATER + 0.55, jang = Math.atan2(dir.x, dir.y);
  B.push(px - dir.x * 4, 0, pz - dir.y * 4, jang);
  for (let k = 0; k < 18; k++) B.box(-0.75, jy, k * 0.6, 0.75, jy + 0.07, k * 0.6 + 0.55, k % 3 ? 0x8a6a4c : 0x7b5c41);
  for (let k = 0; k <= 10; k += 2.5) for (const sx of [-0.7, 0.7]) B.cyl(sx, WATER - 2, k, 0.08, 0.08, 2.65, 0x5e4634, 6);
  // banc au bout
  B.box(-0.6, jy + 0.07, 9.6, 0.6, jy + 0.47, 9.95, 0x6b4a33);
  B.box(-0.6, jy + 0.47, 9.85, 0.6, jy + 0.85, 9.95, 0x6b4a33);
  // barque amarrée
  B.push(1.6, WATER + 0.05, 6.2, 0.15);
  const hull = new THREE.CylinderGeometry(0.62, 0.44, 0.38, 10, 1, true, 0, Math.PI * 2);
  hull.scale(1, 1, 2.6);
  hull.translate(0, 0.19, 0);
  B.add(hull, 0x9a6a46);
  B.box(-0.5, 0.06, -1.2, 0.5, 0.1, 1.2, 0x7b5c41);
  B.box(-0.55, 0.22, -0.15, 0.55, 0.27, 0.15, 0x7b5c41);
  B.box(-0.5, 0.36, -1.6, 0.5, 0.4, -1.55, 0x6b4a33);
  B.pop();
  B.pop();
  B.build(scene, { shadows });
  const lanternLight = new THREE.PointLight(0xffb366, 0, 9, 1.6);
  lanternLight.position.set(lx, ly + 1.65, lz);
  scene.add(lanternLight);

  // ------------------------------------------------------------------ nuages (3 couches)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, flatShading: true, fog: false, transparent: true, opacity: 0 });
  const clouds = new THREE.Group();
  const layers = [];
  for (let L = 0; L < 3; L++) {
    const parts = [];
    const n = [9, 12, 18][L];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 120 + rnd() * 520, y = 90 + rnd() * 70 + L * 12;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, size = 9 + rnd() * 14;
      const puffs = 5 + Math.floor(rnd() * 5);
      for (let k = 0; k < puffs; k++) {
        const g = new THREE.IcosahedronGeometry(size * (0.55 + rnd() * 0.5), 1);
        g.scale(1.3, 0.62, 1);
        g.translate(cx + (k - puffs / 2) * size * 0.75 + rnd() * 4, y + rnd() * size * 0.3, cz + (rnd() - 0.5) * size);
        parts.push([g, 0xffffff]);
      }
    }
    const mesh = new THREE.Mesh(mergeColored(parts), cloudMat.clone());
    mesh.material.vertexColors = true;
    clouds.add(mesh);
    layers.push(mesh);
  }
  scene.add(clouds);

  // ------------------------------------------------------------------ pluie et neige (jamais dans la cabane)
  const insideCabin = 'abs(vW.x) < 8.35 && abs(vW.z) < 6.35 && vW.y < 3.0';
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
  const rainU = { uTime: uniforms.uTime, uAmount: { value: 0 }, uWindXZ: { value: new THREE.Vector2(1.5, 0.5) }, uColor: { value: new THREE.Color(0xdde4ec) } };
  const rain = new THREE.LineSegments(rgeo, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; attribute vec4 seed; attribute float tip; varying vec3 vW; varying float vA;
      void main(){ float y = mod(seed.z - uTime * 9.0, 30.0) - 4.0;
        vec3 p = vec3(seed.x, y, seed.y) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * (y * 0.06);
        p += vec3(uWindXZ.x * 0.07, 0.85, uWindXZ.y * 0.07) * tip;
        vA = step(seed.w, uAmount); vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vW; varying float vA;
      void main(){ if (vA < 0.5 || (${insideCabin})) discard; gl_FragColor = vec4(uColor, 0.55); }`,
  }));
  rain.frustumCulled = false;
  scene.add(rain);

  const NSNOW = mobile ? 3000 : 6000;
  const ss = new Float32Array(NSNOW * 4);
  for (let i = 0; i < NSNOW; i++) ss.set([(rnd() * 2 - 1) * BOX, (rnd() * 2 - 1) * BOX, rnd() * 24, rnd()], i * 4);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSNOW * 3), 3));
  sgeo.setAttribute('seed', new THREE.BufferAttribute(ss, 4));
  const snowU = { uTime: uniforms.uTime, uAmount: { value: 0 }, uWindXZ: rainU.uWindXZ, uScale: { value: innerHeight * 0.5 } };
  const snow = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: snowU, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uAmount; uniform vec2 uWindXZ; uniform float uScale; attribute vec4 seed; varying vec3 vW; varying float vA;
      void main(){ float t = uTime * (0.9 + seed.w * 0.6); float y = mod(seed.z - t, 24.0) - 3.0;
        vec3 p = vec3(seed.x + sin(t * 0.7 + seed.w * 20.0) * 0.6, y, seed.y + cos(t * 0.5 + seed.w * 13.0) * 0.6) + vec3(uWindXZ.x, 0.0, uWindXZ.y) * (y * 0.08);
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

  // ------------------------------------------------------------------ mise à jour
  let snowShown = -1;
  const deep = new THREE.Color(), tmp = new THREE.Color();
  function update(t, dt, w, sky) {
    uniforms.uTime.value = t;
    uniforms.uWind.value = 0.1 + w.wind * 0.9;
    wU.uWave.value = 0.06 + w.wind * 0.3 + w.rain * 0.05;
    rainU.uAmount.value = w.rain;
    rainU.uWindXZ.value.set(0.6 + w.wind * 6, 0.3 + w.wind * 2);
    snowU.uAmount.value = w.snow;
    snowU.uScale.value = innerHeight * Math.min(devicePixelRatio, 2) * 0.5;
    // neige au sol (épaisseur en direct + chute en cours)
    const sAmt = Math.max(smooth(0.0, 0.06, w.snowDepth || 0), w.snow * 0.5);
    if (Math.abs(sAmt - snowShown) > 0.02) {
      snowShown = sAmt;
      for (let i = 0; i < curCol.length; i++) curCol[i] = lerp(baseCol[i], snowCol[i], sAmt);
      tgeo.attributes.color.needsUpdate = true;
      for (const c of caps) c.visible = sAmt > 0.25;
      grass.visible = sAmt < 0.6;
      if (flowers) flowers.visible = sAmt < 0.4;
      if (leaves) leaves.visible = sAmt < 0.5;
    }
    // nuages
    clouds.rotation.y += dt * (0.0015 + w.wind * 0.006);
    const cov = w.cloud;
    const grey = Math.min(1, w.rain * 0.8 + w.snow * 0.5 + smooth(0.7, 1, cov) * 0.4);
    tmp.set(0xffffff).lerp(deep.set(0x8a929c), grey);
    layers.forEach((m, i) => {
      m.material.opacity = [smooth(0.05, 0.3, cov), smooth(0.3, 0.6, cov), smooth(0.6, 0.9, cov)][i] * (1 - w.fog * 0.6);
      m.visible = m.material.opacity > 0.01;
      m.material.color.copy(tmp);
      // les nuages prennent la lumière du ciel (pas de « blocs sombres » sous un ciel gris)
      m.material.emissive.copy(sky.horizon).multiplyScalar(0.55 + grey * 0.3);
    });
    // couleur du lac : reflet du ciel
    const night = sky.night, day = sky.day;
    deep.set(0x07121a).lerp(tmp.set(0x1f7d8c), day).lerp(tmp.set(0x4e6468), Math.min(1, cov * 0.5 + w.rain * 0.4) * day);
    waterMat.color.copy(deep);
    wU.uSky.value.copy(sky.horizon);
    waterMat.roughness = 0.06 + w.rain * 0.3 + w.wind * 0.12;
    // lanterne du jardin : s'allume au crépuscule
    lanternLight.intensity = 3 * (1 - day);
    B.materials.get('glow').emissiveIntensity = 0.15 + 1.6 * (1 - day);
  }
  return { update };
}
