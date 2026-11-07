import * as THREE from '../vendor/three.module.min.js';
import { buildCabin } from './cabin.js';
import { createFire } from './fire.js';
import { createSky, makeClock } from './sky.js';
import { createControls } from './controls.js';
import { createFireAudio } from './audio.js';
import { createOutside } from './outside.js';
import { createWeather, seasonOf } from './weather.js';

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

const controls = createControls(camera, canvas, cabin.colliders);
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
let audio = null;
document.getElementById('enter').addEventListener('click', async () => {
  intro.classList.add('gone');
  controls.state.enabled = true;
  soundBtn.hidden = false;
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
  fire.update(t, dt);
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

window.__detente = { controls, sky, scene, camera, renderer, weather, ready: true };
