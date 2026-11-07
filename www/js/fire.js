// Feu de cheminée : bûches, braises, flammes low poly, lueur et lumière vacillante.
import * as THREE from '../vendor/three.module.min.js';
import { glow } from './textures.js';

// bruit doux (somme de sinus) : pas d'à-coups, pas de flash
const soft = (t, s) => 0.5 + 0.25 * Math.sin(t * 1.7 + s) + 0.15 * Math.sin(t * 3.1 + s * 2.3) + 0.1 * Math.sin(t * 5.3 + s * 0.7);

export function createFire(scene, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // bûches
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 1, flatShading: true });
  const charMat = new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 1, flatShading: true, emissive: 0xff5a1a, emissiveIntensity: 0.15 });
  const logs = [[-0.22, 0.07, 0.04, 0.35, 0.75], [0.22, 0.07, 0.0, -0.3, 0.72], [0.0, 0.16, -0.06, 1.45, 0.62]];
  for (const [lx, ly, lz, rot, len] of logs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, len, 7), rot > 1 ? charMat : logMat);
    m.position.set(lx, ly, lz);
    m.rotation.order = 'YXZ';
    m.rotation.set(Math.PI / 2, rot, 0);
    group.add(m);
  }

  // braises
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0c, emissive: 0xff6a20, emissiveIntensity: 1.2, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + Math.random() * 0.03, 0), emberMat);
    e.position.set((Math.random() - 0.5) * 0.6, 0.02, (Math.random() - 0.5) * 0.3);
    group.add(e);
  }

  // flammes
  const flames = [];
  const layers = [
    { n: 6, color: 0xff6a1f, r: 0.11, h: 0.5, spread: 0.42, op: 0.55 },
    { n: 5, color: 0xffa23a, r: 0.08, h: 0.38, spread: 0.32, op: 0.65 },
    { n: 3, color: 0xffe08a, r: 0.05, h: 0.24, spread: 0.18, op: 0.8 },
  ];
  layers.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const geo = new THREE.ConeGeometry(L.r, L.h, 5, 1);
      geo.translate(0, L.h / 2, 0);
      const mat = new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: L.op, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      const px = (i / Math.max(1, L.n - 1) - 0.5) * L.spread + (Math.random() - 0.5) * 0.04;
      m.position.set(px, 0.1, (Math.random() - 0.5) * 0.08 + li * 0.02);
      m.userData = { seed: Math.random() * 100, base: m.position.clone(), h: 0.75 + Math.random() * 0.4, speed: 0.9 + Math.random() * 0.6 };
      group.add(m);
      flames.push(m);
    }
  });

  // halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,170,90,0.9)', 'rgba(255,90,20,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  halo.scale.set(1.5, 1.1, 1);
  halo.position.set(0, 0.32, 0.15);
  group.add(halo);

  // étincelles qui montent doucement
  const N = 26;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const reset = (i, t = Math.random()) => {
    pp[i * 3] = (Math.random() - 0.5) * 0.5;
    pp[i * 3 + 1] = 0.1 + t * 0.7;
    pp[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    life[i] = t;
  };
  for (let i = 0; i < N; i++) reset(i);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffb060, size: 0.025, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(sparks);

  // lumière principale du feu
  const light = new THREE.PointLight(0xff9a50, 6, 11, 1.4);
  light.position.set(x, y + 0.45, z + 0.55);
  scene.add(light);
  const baseIntensity = 6;

  function update(t, dt) {
    for (const f of flames) {
      const u = f.userData;
      const k = soft(t * u.speed, u.seed);
      f.scale.set(0.85 + k * 0.3, u.h * (0.6 + k * 0.7), 0.85 + k * 0.3);
      f.position.x = u.base.x + Math.sin(t * 1.3 + u.seed) * 0.025;
      f.rotation.y = t * 0.3 + u.seed;
      f.rotation.z = Math.sin(t * 0.9 + u.seed) * 0.08;
    }
    for (let i = 0; i < N; i++) {
      life[i] += dt * (0.25 + (i % 5) * 0.04);
      if (life[i] > 1) reset(i, 0);
      pp[i * 3 + 1] += dt * 0.35;
      pp[i * 3] += Math.sin(t * 2 + i) * dt * 0.05;
    }
    pg.attributes.position.needsUpdate = true;
    const fl = soft(t * 1.4, 3.1);
    light.intensity = baseIntensity * (0.82 + fl * 0.3);
    halo.material.opacity = 0.42 + fl * 0.2;
    emberMat.emissiveIntensity = 1.0 + soft(t * 0.6, 8) * 0.6;
  }

  return { update, light, position: new THREE.Vector3(x, y, z) };
}
