// Porte d'entrée : s'ouvre au toucher, reste ouverte un moment puis se referme
// doucement — jamais tant que Romi est de l'autre côté ou dans l'encadrement.
import * as THREE from '../vendor/three.module.min.js';

const HX = -0.25, HZ = 6.1, W = 1.0, HGT = 2.1; // charnière (côté ouest), largeur, hauteur

export function createDoor(scene, colliders, { onSound } = {}) {
  const pivot = new THREE.Group();
  pivot.position.set(HX, 0, HZ);
  scene.add(pivot);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5a3b26, roughness: 0.9, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.4, metalness: 0.5 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, HGT - 0.02, 0.07).translate(W / 2, HGT / 2, 0), wood);
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  pivot.add(leaf);
  for (let k = 1; k < 4; k++) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, HGT - 0.12, 0.012), dark);
      p.position.set((W * k) / 4, HGT / 2, s * 0.04);
      pivot.add(p);
    }
  }
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.08, 0.012), dark);
    bar.position.set(W / 2, 0.94, s * 0.042);
    pivot.add(bar);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), brass);
    knob.position.set(W - 0.12, 1.02, s * 0.07);
    pivot.add(knob);
  }
  const pick = [];
  pivot.traverse((o) => { if (o.isMesh) { o.userData.door = true; pick.push(o); } });

  // collisions : porte fermée (bloque l'encadrement) / porte ouverte (le battant contre le mur)
  const FAR = { x0: 1e5, x1: 1e5 + 1, z0: 1e5, z1: 1e5 + 1 };
  const closedCol = { x0: HX, x1: HX + W, z0: HZ - 0.06, z1: HZ + 0.06 };
  const openCol = { ...FAR };
  colliders.push(closedCol, openCol);
  const setCol = (c, v) => Object.assign(c, v);

  let angle = 0, target = 0, timer = 0;
  const st = { get open() { return target > 0; }, get angle() { return angle; } };

  function open() {
    if (target === 0) onSound?.('open');
    target = 1.5;
    timer = 14;
  }
  function inDoorway(p) { return p && Math.abs(p.x - (HX + W / 2)) < 0.95 && Math.abs(p.z - HZ) < 1.0; }

  function update(dt, { player, romi, keepOpen }) {
    if (target > 0) {
      timer -= dt;
      if (timer < 0 && !keepOpen && !inDoorway(player) && !inDoorway(romi)) { target = 0; onSound?.('close'); }
    }
    const prev = angle;
    angle += (target - angle) * (1 - Math.exp(-dt * (target > 0 ? 2.6 : 1.8)));
    if (Math.abs(target - angle) < 0.002) angle = target;
    pivot.rotation.y = angle; // s'ouvre vers l'intérieur
    if (angle > 0.25) {
      setCol(closedCol, FAR);
      // battant ouvert : fin obstacle le long de sa position
      const ex = HX + Math.cos(angle) * W, ez = HZ - Math.sin(angle) * W;
      setCol(openCol, { x0: Math.min(HX, ex) - 0.04, x1: Math.max(HX, ex) + 0.04, z0: Math.min(HZ, ez) - 0.04, z1: Math.max(HZ, ez) + 0.04 });
      if (angle < 1.2) setCol(openCol, FAR);
    } else {
      setCol(closedCol, { x0: HX, x1: HX + W, z0: HZ - 0.06, z1: HZ + 0.06 });
      setCol(openCol, FAR);
    }
    if (prev > 0.02 && angle <= 0.02 && target === 0) onSound?.('shut');
  }
  return { open, update, pick, state: st, center: new THREE.Vector3(HX + W / 2, 1.0, HZ) };
}
