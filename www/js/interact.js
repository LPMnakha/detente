// Interactions avec Romi : vue rapprochée, caresses au doigt, canne à ruban,
// gamelles à remplir. Tout se fait d'un simple toucher (ou clic).
import * as THREE from '../vendor/three.module.min.js';

export function createInteract({ camera, canvas, scene, romi, controls, colliders, getAudio }) {
  const $ = (id) => document.getElementById(id);
  const ui = { bar: $('actions'), pet: $('btn-pet'), play: $('btn-play'), back: $('btn-back'), tag: $('romi-tag'), hint: $('hint-pill'), cursor: $('pet-cursor') };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let mode = 'explore'; // explore | pet | play | returning
  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const qGoal = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  let interactions = 0;

  const segClear = (ax, az, bx, bz, r = 0.05) => {
    for (const c of colliders) {
      const x0 = c.x0 - r, x1 = c.x1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, d, lo, hi] of [[ax, bx - ax, x0, x1], [az, bz - az, z0, z1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { ok = false; break; } }
        else { let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) { ok = false; break; } }
      }
      if (ok) return false;
    }
    return true;
  };

  // ---------- canne et ruban (visibles en mode jeu)
  const { stickMat, ribbonMat } = romi.wandMats || {};
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 1, 5).translate(0, 0.5, 0), stickMat || new THREE.MeshStandardMaterial({ color: 0xd9b07a }));
  stick.visible = false;
  scene.add(stick);
  const NR = 16, SEG = 0.055;
  const rp = [], rpp = [];
  for (let i = 0; i < NR; i++) { rp.push(new THREE.Vector3()); rpp.push(new THREE.Vector3()); }
  const rGeo = new THREE.BufferGeometry();
  const rPos = new Float32Array(NR * 2 * 3);
  const rIdx = [];
  for (let i = 0; i < NR - 1; i++) rIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  rGeo.setIndex(rIdx);
  const ribbon = new THREE.Mesh(rGeo, ribbonMat || new THREE.MeshStandardMaterial({ color: 0xd8a542, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.35 }));
  ribbon.visible = false;
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  const tipGoal = new THREE.Vector3(), tip = new THREE.Vector3();
  let toySpeed = 0;
  const lastEnd = new THREE.Vector3();

  function resetRibbon(at) {
    for (let i = 0; i < NR; i++) { rp[i].set(at.x, Math.max(at.y - i * SEG, 0.01), at.z); rpp[i].copy(rp[i]); }
  }

  // ---------- interface
  function showUI(on) {
    ui.bar.classList.toggle('on', on);
    ui.tag.classList.toggle('on', on);
  }
  function setModeButtons() {
    ui.pet.classList.toggle('active', mode === 'pet');
    ui.play.classList.toggle('active', mode === 'play');
  }
  ui.pet.addEventListener('click', () => switchMode('pet'));
  ui.play.addEventListener('click', () => switchMode('play'));
  ui.back.addEventListener('click', () => exit());

  function enter() {
    interactions++;
    saved.pos.copy(camera.position);
    saved.quat.copy(camera.quaternion);
    controls.state.enabled = false;
    controls.state.override = true;
    controls.state.keys.clear();
    romi.beginInteraction(camera.position);
    mode = 'pet';
    setModeButtons();
    showUI(true);
    ui.hint.classList.remove('on');
  }
  function switchMode(m) {
    if (mode !== 'pet' && mode !== 'play') return;
    mode = m;
    romi.setMode(m);
    setModeButtons();
    const on = m === 'play';
    stick.visible = ribbon.visible = on;
    romi.wandRest.visible = !on;
    if (on) {
      const c = romi.state;
      tipGoal.set(c.x + Math.sin(c.yaw) * 0.7, 0.45, c.z + Math.cos(c.yaw) * 0.7);
      tip.copy(tipGoal);
      resetRibbon(tip);
    } else romi.setToy(null);
  }
  function exit() {
    if (mode !== 'pet' && mode !== 'play') return;
    romi.setToy(null);
    romi.endInteraction();
    stick.visible = ribbon.visible = false;
    romi.wandRest.visible = true;
    mode = 'returning';
    showUI(false);
    ui.cursor.classList.remove('on');
  }

  // ---------- toucher / clic
  let down = null;
  const pointers = new Map();
  function rayFrom(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  }
  function hitRomi(x, y) {
    const hits = rayFrom(x, y).intersectObjects(romi.meshes, false);
    return hits[0] || null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!down) down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (mode === 'pet' || mode === 'play') {
      canvas.setPointerCapture?.(e.pointerId);
      handleDrag(e, true);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (mode === 'pet' && prev) handleDrag(e, false, prev);
    if (mode === 'play' && (prev || e.pointerType === 'mouse')) handleDrag(e, false, prev);
    if (prev) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    ui.cursor.classList.remove('on');
    if (down && down.id === e.pointerId) {
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 12 && performance.now() - down.t < 450 && mode === 'explore') tap(e.clientX, e.clientY);
      down = null;
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function tap(x, y) {
    const h = hitRomi(x, y);
    if (h && h.distance < 4.5) { enter(); return; }
    const b = rayFrom(x, y).intersectObjects(romi.bowls.pick, false)[0];
    if (b && b.distance < 3.4) {
      const which = b.object.userData.bowl;
      romi.fill(which);
      const a = getAudio();
      if (a) which === 'food' ? a.kibble() : a.pour();
    }
  }

  function handleDrag(e, first, prev) {
    if (mode === 'pet') {
      const h = hitRomi(e.clientX, e.clientY);
      ui.cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      ui.cursor.classList.toggle('on', !!h);
      if (h && prev) {
        const d = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
        if (d > 0.5) romi.pet(Math.min(0.06, d * 0.0025), h.object.userData.part || 'corps');
      }
    } else if (mode === 'play') {
      // la pointe du ruban suit le doigt, au sol devant Romi
      const r = rayFrom(e.clientX, e.clientY);
      const fy = romi.floorY();
      if (Math.abs(r.ray.direction.y) < 1e-3) return;
      const t = (fy - r.ray.origin.y) / r.ray.direction.y;
      if (t <= 0) return;
      tmp.copy(r.ray.origin).addScaledVector(r.ray.direction, t);
      const c = romi.state;
      const dx = tmp.x - c.x, dz = tmp.z - c.z, d = Math.hypot(dx, dz);
      const maxR = 2.0;
      if (d > maxR) { tmp.x = c.x + dx / d * maxR; tmp.z = c.z + dz / d * maxR; }
      if (!segClear(c.x, c.z, tmp.x, tmp.z, 0.08)) return;
      tipGoal.set(tmp.x, fy + 0.42, tmp.z);
    }
  }

  // ---------- indices discrets
  let hintTxt = '';
  function setHint(t) {
    if (t === hintTxt) return;
    hintTxt = t;
    ui.hint.textContent = t;
    ui.hint.classList.toggle('on', !!t);
  }

  // ---------- boucle
  let tagT = 0;
  function update(dt) {
    const c = romi.state;
    if (mode === 'pet' || mode === 'play') {
      if (controls.state.keys.size) exit();
      const head = romi.headWorld(tmp2);
      // la caméra se place entre Romi et toi, à hauteur de chat
      tmp.set(saved.pos.x - head.x, 0, saved.pos.z - head.z);
      if (tmp.lengthSq() < 1e-4) tmp.set(0, 0, 1);
      tmp.normalize();
      let dist = mode === 'play' ? 1.55 : 0.8;
      while (dist > 0.4 && !segClear(head.x, head.z, head.x + tmp.x * dist, head.z + tmp.z * dist, 0.12)) dist -= 0.05;
      camGoal.set(head.x + tmp.x * dist, (mode === 'play' ? c.y + 1.0 : head.y + 0.22), head.z + tmp.z * dist);
      lookGoal.copy(head);
      if (mode === 'play') lookGoal.set(c.x, c.y + 0.12, c.z);
      else lookGoal.y -= 0.04;
      const k = 1 - Math.exp(-dt * 3.2);
      camera.position.lerp(camGoal, k);
      m4.lookAt(camera.position, lookGoal, THREE.Object3D.DEFAULT_UP);
      qGoal.setFromRotationMatrix(m4);
      camera.quaternion.slerp(qGoal, k);
      // nom + humeur
      tagT -= dt;
      if (tagT < 0) { tagT = 0.5; ui.tag.textContent = `Romi · ${romi.mood}`; }
    } else if (mode === 'returning') {
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(saved.pos, k);
      camera.quaternion.slerp(saved.quat, k);
      if (camera.position.distanceTo(saved.pos) < 0.02) {
        controls.state.override = false;
        controls.state.enabled = true;
        mode = 'explore';
      }
    } else {
      // indices : toucher Romi, remplir les gamelles
      const p = controls.state.pos;
      const dC = Math.hypot(p.x - c.x, p.z - c.z);
      const dB = Math.hypot(p.x - (-4.12), p.z - (-0.4));
      const st = romi.state;
      if (dB < 2.4 && (st.food < 0.9 || st.water < 0.9)) setHint('Touche une gamelle pour la remplir');
      else if (dC < 3.2 && interactions < 2 && controls.state.enabled) setHint('Touche Romi pour la caresser');
      else setHint('');
    }

    // ruban : simulation souple
    if (mode === 'play') {
      tip.lerp(tipGoal, 1 - Math.exp(-dt * 10));
      const fy = romi.floorY();
      rp[0].copy(tip);
      const g = -9.8 * dt * dt;
      for (let i = 1; i < NR; i++) {
        const p = rp[i], q = rpp[i];
        const vx = (p.x - q.x) * 0.92, vy = (p.y - q.y) * 0.92, vz = (p.z - q.z) * 0.92;
        q.copy(p);
        p.x += vx; p.y += vy + g; p.z += vz;
        if (p.y < fy + 0.008) { p.y = fy + 0.008; p.x -= vx * 0.5; p.z -= vz * 0.5; }
      }
      for (let it = 0; it < 6; it++) {
        for (let i = 1; i < NR; i++) {
          const a = rp[i - 1], b = rp[i];
          tmp.subVectors(b, a);
          const l = tmp.length() || 1e-6;
          const corr = (l - SEG) / l;
          if (i === 1) b.addScaledVector(tmp, -corr);
          else { a.addScaledVector(tmp, corr * 0.5); b.addScaledVector(tmp, -corr * 0.5); }
        }
        rp[0].copy(tip);
      }
      // bande dorée orientée vers la caméra
      const camDir = tmp2.subVectors(camera.position, rp[NR >> 1]).normalize();
      for (let i = 0; i < NR; i++) {
        const a = rp[Math.max(0, i - 1)], b = rp[Math.min(NR - 1, i + 1)];
        tmp.subVectors(b, a).cross(camDir).normalize().multiplyScalar(0.012);
        rPos.set([rp[i].x + tmp.x, rp[i].y + tmp.y, rp[i].z + tmp.z, rp[i].x - tmp.x, rp[i].y - tmp.y, rp[i].z - tmp.z], i * 6);
      }
      rGeo.attributes.position.needsUpdate = true;
      rGeo.computeVertexNormals();
      rGeo.computeBoundingSphere();
      // canne : de la main (en bas à droite de l'écran) jusqu'à la pointe
      const base = tmp.set(0.22, -0.3, -0.35).applyQuaternion(camera.quaternion).add(camera.position);
      const dir = tmp2.subVectors(tip, base);
      const len = dir.length();
      stick.position.copy(base);
      stick.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, dir.normalize());
      stick.scale.set(1, len, 1);
      // la proie, pour Romi : le bout du ruban
      const end = rp[NR - 1];
      const sp = end.distanceTo(lastEnd) / Math.max(dt, 1e-3);
      toySpeed = toySpeed + (sp - toySpeed) * (1 - Math.exp(-dt * 6));
      lastEnd.copy(end);
      romi.setToy(end, toySpeed);
    }
  }

  return { update, get mode() { return mode; }, enter, exit, switchMode };
}
