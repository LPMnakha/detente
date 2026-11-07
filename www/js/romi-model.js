// Modèle de Romi : corps lisse, pelage peint dans les sommets (taches tigrées
// grises, liseré blanc, museau blanc), colonne en deux parties pour se plier.
import * as THREE from '../vendor/three.module.min.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WHITE = new THREE.Color(0xf4f0e8), GREY = new THREE.Color(0x7b7168), DARK = new THREE.Color(0x433c37), PINKC = new THREE.Color(0xe3a3a0);
const tmp = new THREE.Color();

// petit bruit déterministe pour des bords de taches organiques
const n3 = (x, y, z) => Math.sin(x * 41.3 + y * 13.1) * 0.5 + Math.sin(y * 37.7 - z * 29.3) * 0.3 + Math.sin(z * 23.9 + x * 17.7) * 0.2;
const ell = (x, y, z, c, r) => Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]);

function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), tmp);
    c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// pelage tigré : gris avec rayures sombres
function tabby(x, y, z, out, along = 'z') {
  const u = along === 'z' ? z * 95 + Math.sin(x * 25) * 1.4 : x * 110 + Math.sin(y * 30);
  const s = smooth(0.35, 0.8, Math.sin(u) * 0.5 + 0.5);
  return out.copy(GREY).lerp(DARK, s * 0.88);
}

// Corps (coordonnées du corps : avant = +z, gauche du chat = +x)
function furBody(x, y, z, out) {
  let m = 0;
  const nn = n3(x, y, z) * 0.13;
  m = Math.max(m, 1 - smooth(0.82, 1.02, ell(x, y, z, [0.075, 0.07, 0.015], [0.085, 0.075, 0.12]) + nn));
  m = Math.max(m, 1 - smooth(0.82, 1.02, ell(x, y, z, [-0.068, 0.065, -0.095], [0.08, 0.07, 0.085]) + nn));
  m = Math.max(m, 1 - smooth(0.8, 1.0, ell(x, y, z, [0, 0.085, -0.205], [0.075, 0.07, 0.07]) + nn));
  m *= smooth(-0.025, 0.03, y); // jamais sur le ventre
  tabby(x, y, z, out);
  return out.lerp(WHITE, 1 - m);
}

// Tête (coordonnées de la tête : yeux vers +z)
function furHead(x, y, z, out) {
  const nn = n3(x * 1.3, y * 1.3, z) * 0.006;
  // calotte grise : haut et arrière de la tête + tour des yeux
  let m = smooth(0.034, 0.046, y + nn);
  m = Math.max(m, smooth(0.024, 0.036, Math.abs(x)) * smooth(0.012, 0.024, y) * smooth(0.11, 0.09, z));
  m = Math.max(m, smooth(0.03, 0.0, z) * smooth(0.0, 0.02, y));
  // liseré blanc au milieu du front, qui s'élargit vers le nez
  const blaze = smooth(0.012 + Math.max(0, 0.07 - y) * 0.3, 0.006 + Math.max(0, 0.07 - y) * 0.3, Math.abs(x)) * smooth(0.035, 0.06, z);
  m *= 1 - blaze;
  // museau et menton blancs
  m *= 1 - smooth(0.07, 0.085, z) * smooth(0.03, 0.015, y);
  tabby(x, y, z, out, 'x');
  if (y > 0.05 && z > 0.03 && Math.abs(x) < 0.03) out.lerp(DARK, smooth(0.6, 0.9, Math.sin(x * 260) * 0.5 + 0.5) * 0.5); // petit « M » du front
  return out.lerp(WHITE, 1 - m);
}

export function buildRomiModel() {
  const fur = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const mat = {
    fur,
    pink: new THREE.MeshStandardMaterial({ color: 0xe5a19e, roughness: 0.8 }),
    eye: new THREE.MeshStandardMaterial({ color: 0xb9c76b, roughness: 0.25, emissive: 0x262c0e }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x15120f }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x5a2f2d, roughness: 1 }),
  };
  const meshes = [];
  const add = (parent, geo, m, part) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.userData.part = part;
    parent.add(mesh);
    if (part) meshes.push(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); // bassin
  root.add(body);

  // --- torse : un seul maillage lisse, déformé par deux os (bassin / thorax)
  const tg = new THREE.SphereGeometry(1, 34, 24);
  tg.scale(0.1, 0.097, 0.235);
  {
    const p = tg.attributes.position;
    const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // taille un peu plus fine, poitrail plus profond, ventre plat
      const waist = 1 - 0.07 * Math.exp(-(((z + 0.02) / 0.07) ** 2));
      x *= waist;
      if (z > 0.06 && y < 0) y *= 1.06;
      if (y < -0.052) y = -0.052 + (y + 0.052) * 0.6;
      p.setXYZ(i, x, y, z);
      const w = smooth(-0.07, 0.1, z);
      si.set([0, 1, 0, 0], i * 4);
      sw.set([1 - w, w, 0, 0], i * 4);
    }
    tg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    tg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    tg.computeVertexNormals();
    paint(tg, furBody);
  }
  const bPelvis = new THREE.Bone(), chest = new THREE.Bone();
  bPelvis.add(chest);
  const torso = new THREE.SkinnedMesh(tg, fur);
  torso.add(bPelvis);
  torso.bind(new THREE.Skeleton([bPelvis, chest]));
  torso.castShadow = true;
  torso.userData.part = 'corps';
  body.add(torso);
  meshes.push(torso);

  // --- tête
  const neck = new THREE.Group();
  neck.position.set(0, 0.07, 0.19);
  chest.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  {
    const g = new THREE.SphereGeometry(1, 28, 20);
    g.scale(0.068, 0.063, 0.064);
    g.translate(0, 0.03, 0.026);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // museau : bosse douce devant-bas
      const b = Math.exp(-((x / 0.034) ** 2) - (((y - 0.012) / 0.022) ** 2));
      if (z > 0.03) z += 0.018 * b;
      // joues un peu plus larges
      x *= 1 + 0.12 * Math.exp(-(((y - 0.018) / 0.02) ** 2)) * (z > 0 ? 1 : 0.6);
      // front légèrement aplati
      if (z > 0.06 && y > 0.04) z -= (y - 0.04) * 0.25;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    add(head, paint(g, furHead), fur, 'tete');
  }
  // nez rose, à fleur du museau
  add(head, new THREE.SphereGeometry(1, 10, 8).scale(0.011, 0.007, 0.006).translate(0, 0.024, 0.111), mat.pink, 'tete');
  const mouth = add(head, new THREE.SphereGeometry(1, 10, 6).scale(0.014, 0.01, 0.005).translate(0, -0.006, 0.104), mat.mouth, 'menton');
  mouth.scale.y = 0.01;
  // yeux (légèrement enfoncés)
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.029, 0.041, 0.08);
    eg.rotation.y = s * 0.35;
    head.add(eg);
    eg.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.0145, 0.0135, 0.008), mat.eye));
    const pu = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6).scale(0.0035, 0.011, 0.004), mat.pupil);
    pu.position.z = 0.0055;
    eg.add(pu);
    eyes.push(eg);
  }
  // oreilles : triangles fins, gris à pointe sombre, intérieur rose
  const ears = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.038, 0.074, 0.012);
    head.add(eg);
    const og = new THREE.ConeGeometry(0.027, 0.058, 10, 2).translate(0, 0.029, 0);
    og.scale(1, 1, 0.55);
    paint(og, (x, y, z, out) => out.copy(GREY).lerp(DARK, smooth(0.035, 0.055, y)));
    add(eg, og, fur, 'tete');
    const ig = new THREE.ConeGeometry(0.017, 0.042, 8).translate(0, 0.021, 0);
    ig.scale(1, 1, 0.3);
    const inner = new THREE.Mesh(ig, mat.pink);
    inner.position.set(0, 0.002, 0.009);
    eg.add(inner);
    ears.push(eg);
  }
  // moustaches
  {
    const wp = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) wp.push(s * 0.026, 0.014, 0.1, s * 0.115, 0.025 - k * 0.014, 0.088 - k * 0.006);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })));
  }

  // --- pattes (avant attachées au thorax, arrière au bassin)
  const legs = {};
  // le haut des pattes est en partie dans le corps (comme un vrai chat)
  const LU = 0.1, LL = 0.085;
  const legDef = { lf: [chest, 0.05, -0.015, 0.145, false], rf: [chest, -0.05, -0.015, 0.145, false], lh: [body, 0.056, -0.02, -0.13, true], rh: [body, -0.056, -0.02, -0.13, true] };
  for (const [k, [parent, x, y, z, hind]] of Object.entries(legDef)) {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    parent.add(hip);
    const whiteOrPatch = (gx, gy, gz, out) => {
      // la cuisse arrière gauche prolonge la tache du flanc
      if (hind && k === 'rh') { const m = smooth(-0.06, 0.0, gy) * 0.8; tabby(gx, gy, gz, out); return out.lerp(WHITE, 1 - m); }
      return out.copy(WHITE);
    };
    if (hind) {
      const th = new THREE.SphereGeometry(1, 16, 12).scale(0.046, 0.078, 0.06).translate(0, -0.04, 0.006);
      add(hip, paint(th, whiteOrPatch), fur, 'corps');
    }
    const ug = new THREE.CylinderGeometry(hind ? 0.034 : 0.036, 0.025, LU, 12).translate(0, -LU / 2, 0);
    add(hip, paint(ug, whiteOrPatch), fur, 'patte');
    const knee = new THREE.Group();
    knee.position.y = -LU;
    hip.add(knee);
    add(knee, paint(new THREE.SphereGeometry(1, 12, 10).scale(0.025, 0.025, 0.025), (a, b, c, o) => o.copy(WHITE)), fur, 'patte');
    add(knee, paint(new THREE.CylinderGeometry(0.0235, 0.019, LL, 12).translate(0, -LL / 2, 0), (a, b, c, o) => o.copy(WHITE)), fur, 'patte');
    const paw = add(knee, paint(new THREE.SphereGeometry(1, 14, 10).scale(0.026, 0.016, 0.034).translate(0, -LL - 0.002, 0.01), (a, b, c, o) => o.copy(WHITE)), fur, 'patte');
    legs[k] = { hip, knee, paw };
  }

  // --- queue : segments lisses, anneaux sombres
  const tail = [];
  const NT = 10, seg = 0.034;
  const tb = new THREE.Group();
  tb.position.set(0, 0.05, -0.2);
  body.add(tb);
  let parent = tb;
  for (let i = 0; i < NT; i++) {
    const s = new THREE.Group();
    if (i > 0) s.position.z = -seg;
    parent.add(s);
    const r0 = 0.021 - i * 0.0011, r1 = 0.021 - (i + 1) * 0.0011;
    const g = new THREE.CylinderGeometry(r1, r0, seg + 0.004, 10).rotateX(Math.PI / 2).translate(0, 0, -seg / 2);
    const j = new THREE.SphereGeometry(r0, 10, 8);
    for (const gg of [g, j]) {
      paint(gg, (x, y, z, out) => {
        const d = i * seg - z;
        const ring = smooth(0.25, 0.65, Math.sin(d * 48) * 0.5 + 0.5);
        out.copy(GREY).lerp(DARK, ring * 0.85 + (i >= NT - 2 ? 0.4 : 0));
        return out;
      });
      add(s, gg, fur, 'queue');
    }
    tail.push(s);
    parent = s;
  }

  // ombre douce au sol
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.position.y = 0.006;
  shadow.scale.z = 1.6;
  root.add(shadow);
  root.scale.setScalar(0.88);
  return { root, body, chest, torso, neck, head, eyes, ears, mouth, legs, tail, shadow, meshes };
}
