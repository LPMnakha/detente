// Ciel, paysage extérieur et soleil réel calculé pour Paris.
import * as THREE from '../vendor/three.module.min.js';

export const PARIS = { lat: 48.8566, lng: 2.3522 };

// --- position du soleil (algorithme de SunCalc, V. Agafonkin) ---
const rad = Math.PI / 180, e = rad * 23.4397;
export function sunPosition(date, lat = PARIS.lat, lng = PARIS.lng) {
  const d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const lw = rad * -lng, phi = rad * lat;
  const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azimuth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  // azimut compté depuis le sud vers l'ouest. Scène : nord = -z, est = +x
  const dir = new THREE.Vector3(-Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), Math.cos(azimuth) * Math.cos(altitude));
  return { altitude, azimuth, dir };
}

// Heure courante, ou heure forcée via ?heure=21 ou ?heure=7:30 (heure de Paris)
export function makeClock() {
  const q = new URLSearchParams(location.search).get('heure');
  if (!q) return () => new Date();
  const [h, m = 0] = q.split(/[:hH]/).map(Number);
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  const parisAsUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offset = parisAsUTC - Math.floor(now.getTime() / 60000) * 60000;
  const target = Date.UTC(+parts.year, +parts.month - 1, +parts.day, h || 0, m || 0) - offset;
  const start = performance.now();
  return () => new Date(target + (performance.now() - start));
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);
const P = {
  night: { top: col(0x060a1a), hor: col(0x161d36) },
  twilight: { top: col(0x34457a), hor: col(0xeb9a6a) },
  day: { top: col(0x4f93d6), hor: col(0xcfe2ee) },
  // ciel couvert
  greyDay: { top: col(0x8d98a5), hor: col(0xb9c1c8) },
  greyNight: { top: col(0x0e1116), hor: col(0x1b1f26) },
};

export function createSky(scene, renderer, { shadows = true, mobile = false } = {}) {
  const R = 1200;
  const uniforms = {
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xffd9a0) }, sunVis: { value: 1 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(hor, top, pow(max(h,0.0), 0.5));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.08) * sunVis;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  // étoiles (scintillement très lent, pas de clignotement)
  const sp = [], sz = [];
  for (let i = 0; i < 1400; i++) {
    const th = Math.random() * Math.PI * 2, y = 0.06 + Math.random() * 0.94;
    const r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(th) * r * R * 0.95, y * R * 0.95, Math.sin(th) * r * R * 0.95);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6e8, size: mobile ? 1.6 : 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));

  scene.fog = new THREE.Fog(0xcfe2ee, 80, 900);

  // lumières globales
  const hemi = new THREE.HemisphereLight(0xbcd2e8, 0x6a5a48, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  // clair de lune très doux la nuit
  const moon = new THREE.DirectionalLight(0x9fb4d8, 0);
  moon.position.set(-30, 50, 40);
  scene.add(moon);

  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const state = { night: 0, day: 1, elev: 0, horizon: new THREE.Color() };
  const W0 = { cloud: 0.3, rain: 0, snow: 0, fog: 0, wind: 0.2 };

  function update(date, w = W0) {
    const { altitude, dir } = sunPosition(date);
    const elev = altitude / rad;
    const day = smooth(-6, 8, elev);
    const twi = Math.exp(-Math.pow((elev - 1) / 6, 2));
    const night = 1 - smooth(-12, -2, elev);
    // couverture : nuages, pluie, neige, brouillard
    const oc = Math.min(1, smooth(0.45, 1.0, w.cloud) * 0.85 + w.rain * 0.3 + w.snow * 0.3 + w.fog * 0.6);
    state.day = day; state.night = night; state.elev = elev; state.overcast = oc;

    const mix = (k) => {
      tmp.copy(P.night[k]).lerp(P.day[k], day).lerp(P.twilight[k], twi * 0.75 * (1 - oc * 0.8));
      tmp2.copy(P.greyNight[k]).lerp(P.greyDay[k], day);
      return tmp.lerp(tmp2, oc).clone();
    };
    uniforms.top.value.copy(mix('top'));
    uniforms.hor.value.copy(mix('hor'));
    state.horizon.copy(uniforms.hor.value);
    uniforms.sunDir.value.copy(dir);
    uniforms.sunVis.value = smooth(-3, 1, elev) * (1 - oc * 0.92);
    uniforms.sunCol.value.set(0xffc985).lerp(tmp2.set(0xfff5e6), smooth(5, 30, elev));
    starMat.opacity = night * 0.95 * (1 - smooth(0.2, 0.8, w.cloud)) * (1 - w.fog);

    // brouillard atmosphérique (léger par beau temps, dense par brouillard)
    scene.fog.color.copy(uniforms.hor.value);
    scene.fog.near = lerp(lerp(90, 25, Math.max(w.rain, w.snow)), 12, w.fog);
    scene.fog.far = lerp(lerp(950, 240, Math.max(w.rain, w.snow * 1.2)), 75, w.fog);

    // soleil direct (voilé par les nuages)
    const sunUp = smooth(-1.5, 4, elev);
    sun.position.copy(dir).multiplyScalar(60);
    sun.target.position.set(0, 0, 0);
    sun.intensity = 3.2 * sunUp * (1 - oc * 0.88);
    sun.color.copy(uniforms.sunCol.value).lerp(tmp2.set(0xff9a55), (1 - smooth(2, 18, elev)) * 0.7);
    sun.visible = sun.intensity > 0.01;
    moon.intensity = 0.22 * night * (1 - oc * 0.7);

    // ambiance : jour clair, nuit bleutée ; plus diffuse sous les nuages
    hemi.intensity = 0.06 + 0.55 * day + 0.15 * oc * day;
    hemi.color.set(0x3a4a78).lerp(tmp2.set(0xc9dcec), day).lerp(tmp2.set(0xf0b48a), twi * 0.4 * (1 - oc)).lerp(tmp2.set(0xb8c0c8), oc * day * 0.6);
    hemi.groundColor.set(0x1c1a20).lerp(tmp2.set(0x6a5a48), day);
    return state;
  }

  return { update, state, sun };
}
