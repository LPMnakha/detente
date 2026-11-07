// Petite ville norvégienne sur l'autre rive du fjord : maisons en bois colorées,
// église blanche, quai et bateaux. Les fenêtres s'allument une à une le soir.
import * as THREE from '../vendor/three.module.min.js';

export function buildTown(scene, { height, shoreFar, WATER, mobile }) {
  let s = 31;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const group = new THREE.Group();
  scene.add(group);

  const WALLS = [0x9b3a2e, 0xc79a43, 0xe9e5dc, 0xd8b55a, 0x7d2f28, 0xe0d2b4, 0x7f93a3, 0xb2553f, 0xefe9de];
  const ROOFS = [0x3a3634, 0x55302a, 0x2f3b33, 0x463f3b];

  // --- maisons
  const N = mobile ? 60 : 95;
  const houses = [];
  let guard = 0;
  while (houses.length < N && guard++ < 4000) {
    const x = (rnd() + rnd() + rnd() - 1.5) * 300;
    const row = rnd() < 0.45 ? 0 : rnd() < 0.55 ? 1 : rnd() < 0.6 ? 2 : 3;
    const zf = shoreFar(x);
    const z = zf + 14 + row * 19 + rnd() * 6;
    if (Math.abs(x - 25) < 16 && row < 3) continue; // place de l'église
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 16)) continue;
    const w = 10 + rnd() * 4, d = 11 + rnd() * 4, hh = 7 + rnd() * 3.5;
    houses.push({ x, z, y: height(x, z), w, d, h: hh, yaw: (rnd() - 0.5) * 0.25, wall: pick(WALLS), roof: pick(ROOFS), lit: 0.15 + rnd() * 0.8 });
  }
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const tri = new THREE.Shape();
  tri.moveTo(-0.5, 0); tri.lineTo(0.5, 0); tri.lineTo(0, 0.6); tri.lineTo(-0.5, 0);
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const bodies = new THREE.InstancedMesh(bodyGeo, mat, houses.length + 2);
  const roofs = new THREE.InstancedMesh(roofGeo, mat, houses.length + 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  houses.forEach((h, i) => {
    q.setFromAxisAngle(up, h.yaw);
    bodies.setMatrixAt(i, m4.compose(v.set(h.x, h.y - 1, h.z), q, sc.set(h.w, h.h + 1, h.d)));
    bodies.setColorAt(i, c.set(h.wall));
    roofs.setMatrixAt(i, m4.compose(v.set(h.x, h.y + h.h, h.z), q, sc.set(h.w * 1.12, h.w * 0.9, h.d * 1.08)));
    roofs.setColorAt(i, c.set(h.roof));
  });
  // église blanche avec clocher
  const cx = 25, cz = shoreFar(25) + 22, cy = height(cx, cz);
  const ci = houses.length;
  bodies.setMatrixAt(ci, m4.compose(v.set(cx, cy - 1, cz), q.identity(), sc.set(10, 10, 20)));
  bodies.setColorAt(ci, c.set(0xf2efe8));
  roofs.setMatrixAt(ci, m4.compose(v.set(cx, cy + 9, cz), q, sc.set(11, 8, 21)));
  roofs.setColorAt(ci, c.set(0x3a3634));
  bodies.setMatrixAt(ci + 1, m4.compose(v.set(cx, cy - 1, cz - 11), q, sc.set(4.5, 17, 4.5)));
  bodies.setColorAt(ci + 1, c.set(0xf2efe8));
  roofs.setMatrixAt(ci + 1, m4.compose(v.set(cx, cy + 16, cz - 11), q, sc.set(0.01, 0.01, 0.01)));
  roofs.setColorAt(ci + 1, c.set(0x3a3634));
  group.add(bodies, roofs);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.4, 12, 4).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x3f4a44, roughness: 0.8, flatShading: true }));
  spire.position.set(cx, cy + 16 + 6, cz - 11);
  group.add(spire);

  // --- quai, bateaux
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8a85, roughness: 1, flatShading: true });
  for (let x = -160; x <= 160; x += 12) {
    const z = shoreFar(x);
    const m = new THREE.Mesh(new THREE.BoxGeometry(12.5, 4, 7), stone);
    m.position.set(x, WATER + 1.2, z - 1.5);
    group.add(m);
  }
  const boatCols = [0xefe9de, 0xa64a36, 0x4f6f8a, 0xefe9de];
  for (let i = 0; i < 10; i++) {
    const x = -110 + i * 24 + rnd() * 10;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 1.3, 8).scale(1, 1, 3.2), new THREE.MeshStandardMaterial({ color: boatCols[i % 4], roughness: 0.7, flatShading: true }));
    b.position.set(x, WATER + 0.4, shoreFar(x) - 9 - rnd() * 6);
    b.rotation.y = Math.PI / 2 + (rnd() - 0.5) * 0.4;
    group.add(b);
    if (i % 3 === 0) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 4), stone);
      mast.position.set(b.position.x, WATER + 4.5, b.position.z);
      group.add(mast);
    }
  }

  // --- lumières : fenêtres (vers le fjord), lampadaires du quai, église
  const L = [];
  houses.forEach((h) => {
    const cols = h.w > 12 ? 3 : 2, rows = h.h > 8.5 ? 2 : 1;
    const cy0 = Math.cos(h.yaw), sy0 = Math.sin(h.yaw);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      if (rnd() < 0.25) continue;
      const lx = (k - (cols - 1) / 2) * (h.w / cols), ly = h.y + 2.2 + r * 3.4, lz = -h.d / 2 - 0.15;
      L.push({ x: h.x + lx * cy0 + lz * sy0, y: ly, z: h.z - lx * sy0 + lz * cy0, t: h.lit + (rnd() - 0.5) * 0.12, warm: rnd() });
    }
  });
  for (let x = -150; x <= 150; x += 20) L.push({ x, y: WATER + 6.5, z: shoreFar(x) - 4.5, t: 0.08, warm: 1, lamp: true });
  for (const [dx, dy] of [[-3, 3], [3, 3], [-3, 6], [3, 6]]) L.push({ x: cx + dx, y: cy + dy, z: cz - 10.2, t: 0.2, warm: 0.6 });
  const lp = new Float32Array(L.length * 3), lc = new Float32Array(L.length * 3);
  L.forEach((l, i) => lp.set([l.x, l.y, l.z], i * 3));
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lgeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const lights = new THREE.Points(lgeo, new THREE.PointsMaterial({ size: mobile ? 3.4 : 3, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  lights.frustumCulled = false;
  group.add(lights);

  // --- reflets des lumières sur l'eau (longues traînées douces)
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,200,120,0.9)'); grd.addColorStop(0.35, 'rgba(255,190,110,0.35)'); grd.addColorStop(1, 'rgba(255,180,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 256);
  const img = g.getImageData(0, 0, 32, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 32; x++) {
    const k = (y * 32 + x) * 4, e = 1 - Math.pow(Math.abs(x - 15.5) / 16, 1.5);
    const ripple = 0.55 + 0.45 * Math.sin(y * 0.9 + Math.sin(y * 0.13) * 3);
    img.data[k + 3] *= e * ripple;
  }
  g.putImageData(img, 0, 0);
  const rtex = new THREE.CanvasTexture(cv);
  const rmat = new THREE.MeshBasicMaterial({ map: rtex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const streaks = [];
  for (let x = -150; x <= 150; x += 20 + rnd() * 14) {
    const zf = shoreFar(x);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + rnd() * 3, 160).rotateX(-Math.PI / 2), rmat);
    m.position.set(x, WATER + 0.08, zf - 84);
    group.add(m);
    streaks.push(m);
  }

  // --- mise à jour : les fenêtres s'allument une à une à la tombée du jour
  let timer = 0;
  const warmA = new THREE.Color(0xffc978), warmB = new THREE.Color(0xffe2a8), lampC = new THREE.Color(0xffd9a0);
  function update(t, dt, sky, w) {
    timer -= dt;
    rmat.opacity = (1 - sky.day) * 0.4 * (1 - w.fog * 0.85) * (0.85 + 0.15 * Math.sin(t * 0.7));
    if (timer > 0) return;
    timer = 0.6;
    const dusk = 1 - sky.day; // 0 en plein jour, 1 la nuit
    const vis = 1 - w.fog * 0.85 - Math.max(w.rain, w.snow) * 0.35;
    L.forEach((l, i) => {
      const on = Math.min(1, Math.max(0, (dusk - l.t) / 0.08));
      const col = l.lamp ? lampC : (l.warm > 0.5 ? warmA : warmB);
      const k = on * vis * (l.lamp ? 0.9 : 0.8);
      lc[i * 3] = col.r * k; lc[i * 3 + 1] = col.g * k; lc[i * 3 + 2] = col.b * k;
    });
    lgeo.attributes.color.needsUpdate = true;
  }
  return { update };
}
