import * as THREE from '../vendor/three.module.min.js';
import { buildCabin } from './cabin.js';
import { createFire } from './fire.js';
import { createSky, makeClock } from './sky.js';
import { createControls } from './controls.js';
import { createFireAudio } from './audio.js';
import { createOutside } from './outside.js';
import { createWeather, seasonOf } from './weather.js';
import { createRomi } from './romi.js';
import { createInteract } from './interact.js';
import { createEvents } from './events.js';

const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const canvas = document.getElementById('c');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 2600);

const sky = createSky(scene, renderer, { shadows: true, mobile });
const cabin = buildCabin(scene, { shadows: true });
const fire = createFire(scene, 0.5, 0.22, -5.62);
const season = seasonOf();
const outside = createOutside(scene, { season, mobile, shadows: true });

// lumière renvoyée par le bois (douce et chaude), pour qu'aucun recoin ne soit noir
const fill = new THREE.AmbientLight(0xffe0c2, 0.3);
scene.add(fill);

// lampes de la maison : discrètes le jour, chaleureuses la nuit
const lamps = cabin.lights.map((l) => {
  const p = new THREE.PointLight(0xffbe80, 1, 7, 1.5);
  p.position.copy(l.pos);
  scene.add(p);
  return { light: p, strength: l.strength };
});

// fêtes de l'année (avant Romi : le sapin de Noël devient un obstacle)
const events = createEvents(scene, { colliders: cabin.colliders });

const controls = createControls(camera, canvas, cabin.colliders);

// Romi, la chatte de la maison
let audio = null;
const romi = createRomi(scene, {
  colliders: cabin.colliders,
  onMeow: (v, s) => {
    if (!audio) return;
    const p = controls.state.pos;
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    audio.meow(v / (1 + d * d * 0.12));
  },
});
const interact = createInteract({ camera, canvas, scene, romi, controls, colliders: cabin.colliders, getAudio: () => audio });
const clock = makeClock();

// météo en direct à Annecy (affichée discrètement sur l'écran d'accueil)
const meteoLine = document.getElementById('meteo');
const SAISONS = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
const weather = createWeather((w, forced) => {
  const temp = w.temp != null ? `${Math.round(w.temp)}°, ` : '';
  meteoLine.textContent = `Annecy · ${temp}${w.label} · ${SAISONS[season.name]}${forced ? ' (simulé)' : ''}`;
  meteoLine.classList.add('on');
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 80 : 68;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ---------- interface ----------
const intro = document.getElementById('intro');
const soundBtn = document.getElementById('sound');
document.getElementById('hint').textContent = mobile
  ? 'Pouce gauche pour marcher, glisse à droite pour regarder autour de toi.'
  : 'Flèches ou ZQSD pour marcher, clique-glisse pour regarder autour de toi.';
document.getElementById('enter').addEventListener('click', async () => {
  intro.classList.add('gone');
  controls.state.enabled = true;
  soundBtn.hidden = false;
  // accueil : Romi vient te voir
  setTimeout(() => romi.welcome(controls.state.pos), 900);
  try {
    audio = audio || createFireAudio();
    await audio?.start();
  } catch (e) { /* pas de son : tant pis */ }
});
soundBtn.addEventListener('click', () => {
  if (!audio) return;
  const on = audio.toggle();
  soundBtn.classList.toggle('muted', !on);
  soundBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Remettre le son');
});
document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.ctx.suspend(); else if (audio.on) audio.ctx.resume();
});

// ---------- sols (pour les bruits de pas)
let lastStep = null, stepDist = 0;
function floorAt(x, z) {
  const inRect = (x0, z0, x1, z1) => x > x0 && x < x1 && z > z0 && z < z1;
  if (inRect(-1, -4.7, 2, -1.6) || inRect(0.6, 2.2, 3.6, 5.2) || inRect(4.7, 2.2, 7.6, 5.0) || inRect(-6.65, -5.35, -4.05, -4.8) || Math.hypot(x - 6.0, z + 3.15) < 1.45) return 'tapis';
  if (x < -3) return 'carrelage';
  return 'bois';
}

// ---------- boucle ----------
let last = performance.now(), skyTimer = 0, t = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;

  const wNow = weather.update(dt);
  skyTimer -= dt;
  if (skyTimer <= 0) {
    skyTimer = 1; // le soleil bouge lentement : une mise à jour par seconde suffit
    const s = sky.update(clock(), wNow);
    const n = s.night, d = s.day;
    for (const l of lamps) l.light.intensity = l.strength * (0.35 + 1.9 * (1 - d) + 0.4 * n);
    fill.intensity = 0.22 + 0.16 * d;
    cabin.glowMat.emissiveIntensity = 0.25 + 1.1 * (1 - d);
  }

  outside.update(t, dt, wNow, sky.state);
  controls.update(dt);
  // bruits de pas : un pas tous les ~65 cm, selon le sol
  {
    const p = controls.state.pos;
    if (lastStep) {
      const moved = Math.hypot(p.x - lastStep.x, p.z - lastStep.z);
      if (controls.state.enabled && !controls.state.override && moved < 0.5) stepDist += moved;
      if (stepDist > 0.65) { stepDist = 0; if (audio) audio.step(floorAt(p.x, p.z)); }
      const speed = moved / Math.max(dt, 1e-3);
      if (speed < 0.15) stepDist = Math.min(stepDist, 0.45); // premier pas rapide quand on repart
    }
    lastStep = { x: p.x, z: p.z };
  }
  {
    const p = controls.state.pos, rs = romi.state;
    const dRomi = Math.hypot(p.x - rs.x, p.z - rs.z);
    romi.update(dt, { player: p, playerNear: dRomi < 4.5 && controls.state.enabled, night: sky.state.night > 0.6, cam: interact.mode === 'explore' ? null : camera.position });
    interact.update(dt);
    if (audio) audio.setPurr(rs.purr / (1 + dRomi * dRomi * 0.3));
  }
  fire.update(t, dt);
  events.update(t, dt, sky.state);
  if (audio) {
    const p = controls.state.pos;
    const dist = Math.hypot(p.x - fire.position.x, p.z - fire.position.z);
    const sameRoom = p.x > -3 && (p.x < 4 || p.z < 0);
    audio.setDistance(dist, sameRoom);
    audio.setWeather(wNow.rain, wNow.wind);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__detente = { events, controls, sky, scene, camera, renderer, weather, romi, interact, ready: true };
