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

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);
const P = {
  night: { top: col(0x070b1c), hor: col(0x18203a), ground: col(0x1a2128) },
  twilight: { top: col(0x2e3d6e), hor: col(0xe89a6c), ground: col(0x3d3b33) },
  day: { top: col(0x5f9fd8), hor: col(0xd7e6ee), ground: col(0x6c7a4c) },
};

export function createSky(scene, renderer, { shadows = true, mobile = false } = {}) {
  // dôme de ciel
  const uniforms = {
    top: { value: new THREE.Color() }, hor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xffd9a0) }, sunVis: { value: 1 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(hor, top, pow(max(h,0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.25) * sunVis;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat);
  scene.add(sky);

  // étoiles
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random(), v = Math.random() * 0.9 + 0.08;
    const th = u * Math.PI * 2, y = v;
    const r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(th) * r * 280, y * 280, Math.sin(th) * r * 280);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6e8, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // sol, collines, sapins, montagnes
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6c7a4c, roughness: 1 }));
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  const nature = new THREE.Group();
  scene.add(nature);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1, flatShading: true });
  const pineMats = [0x3f5d43, 0x4a6b49, 0x36513c, 0x56744f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  const rnd = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const pine = (x, z, s) => {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6), trunkMat);
    tr.position.y = 0.6 * s;
    g.add(tr);
    const m = pineMats[Math.floor(rnd() * pineMats.length)];
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.38) * s, (1.9 - k * 0.3) * s, 7), m);
      c.position.y = (1.6 + k * 1.05) * s;
      c.rotation.y = rnd() * 3;
      g.add(c);
    }
    g.position.set(x, -0.12, z);
    g.traverse((o) => { o.castShadow = shadows; });
    nature.add(g);
  };
  // forêt autour (hors cabane)
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, r = 13 + Math.pow(rnd(), 0.7) * 70;
    pine(Math.cos(a) * r, Math.sin(a) * r, 0.9 + rnd() * 1.1);
  }
  // quelques sapins proches des fenêtres
  [[-9.5, -10], [6.5, -11], [12.5, -4.5], [13, 3], [-12, -3], [2, 12.5], [-6, 12], [10, 10], [-11, 7]].forEach(([x, z]) => pine(x, z, 1.1 + rnd() * 0.5));
  // rochers et buissons
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 1, flatShading: true });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 1, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = 9.5 + rnd() * 25;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + rnd() * 0.6, 0), rnd() < 0.5 ? rockMat : bushMat);
    m.scale.y = 0.6;
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.rotation.y = rnd() * 3;
    nature.add(m);
  }
  // montagnes lointaines
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x6e7f94, roughness: 1, flatShading: true, fog: true });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.2, r = 150 + rnd() * 40;
    const h = 25 + rnd() * 35;
    const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rnd() * 25, h, 5), mountMat);
    m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r);
    m.rotation.y = rnd() * 3;
    nature.add(m);
  }

  scene.fog = new THREE.Fog(0xd7e6ee, 35, 210);

  // lumières globales
  const hemi = new THREE.HemisphereLight(0xbcd2e8, 0x6a5a48, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const state = { night: 0, day: 1, elev: 0 };

  function update(date) {
    const { altitude, dir } = sunPosition(date);
    const elev = altitude / rad;
    const day = smooth(-6, 8, elev); // jour (crépuscule civil -> plein jour)
    const twi = Math.exp(-Math.pow((elev - 1) / 6, 2)); // lueur aube/crépuscule
    const night = 1 - smooth(-12, -2, elev);
    state.day = day; state.night = night; state.elev = elev;

    // couleurs du ciel
    const mix3 = (k) => {
      tmp.copy(P.night[k]).lerp(P.day[k], day);
      return tmp.lerp(P.twilight[k], twi * 0.75).clone();
    };
    uniforms.top.value.copy(mix3('top'));
    uniforms.hor.value.copy(mix3('hor'));
    uniforms.sunDir.value.copy(dir);
    uniforms.sunVis.value = smooth(-3, 1, elev);
    uniforms.sunCol.value.set(0xffcf8a).lerp(tmp2.set(0xfff5e6), smooth(5, 30, elev));
    scene.fog.color.copy(uniforms.hor.value);
    ground.material.color.copy(mix3('ground'));
    starMat.opacity = night * 0.9;

    // soleil direct
    const sunUp = smooth(-1.5, 4, elev);
    sun.position.copy(dir).multiplyScalar(40);
    sun.target.position.set(0, 0, 0);
    sun.intensity = 3.2 * sunUp;
    sun.color.copy(uniforms.sunCol.value).lerp(tmp2.set(0xff9a55), (1 - smooth(2, 18, elev)) * 0.7);
    sun.visible = sunUp > 0.001;

    // lumière d'ambiance : jour clair, nuit bleutée très douce
    hemi.intensity = 0.06 + 0.55 * day;
    hemi.color.set(0x3a4a78).lerp(tmp2.set(0xc9dcec), day).lerp(tmp2.set(0xf0b48a), twi * 0.4);
    hemi.groundColor.set(0x1c1a20).lerp(tmp2.set(0x6a5a48), day);
    renderer.toneMappingExposure = 1.0;
    return state;
  }

  return { update, state, sun };
}
