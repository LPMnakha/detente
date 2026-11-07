// Crépitement du feu, entièrement synthétisé (aucun fichier son).
// Le volume dépend de la distance à la cheminée.
export function createFireAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const fireBus = ctx.createGain();
  fireBus.gain.value = 0;
  fireBus.connect(master);

  // bruit rose (plus doux que le bruit blanc)
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }

  // souffle grave du feu
  const roar = ctx.createBufferSource();
  roar.buffer = buf;
  roar.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const roarGain = ctx.createGain();
  roarGain.gain.value = 0.35;
  roar.connect(lp).connect(roarGain).connect(fireBus);
  roar.start();
  // lente respiration du souffle
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain).connect(roarGain.gain);
  lfo.start();

  // petits craquements
  const pop = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
  const pd = pop.getChannelData(0);
  for (let i = 0; i < pd.length; i++) pd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));

  function crackle(t, strength) {
    const s = ctx.createBufferSource();
    s.buffer = pop;
    s.playbackRate.value = 0.6 + Math.random() * 1.2;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200 + Math.random() * 3200;
    f.Q.value = 0.8 + Math.random() * 2;
    const g = ctx.createGain();
    g.gain.value = strength * (0.15 + Math.random() * 0.5);
    s.connect(f).connect(g).connect(fireBus);
    s.start(t);
  }

  let next = 0;
  function schedule() {
    const now = ctx.currentTime;
    if (next < now) next = now + 0.05;
    while (next < now + 0.4) {
      const burst = Math.random() < 0.12;
      if (burst) {
        const n = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) crackle(next + i * (0.015 + Math.random() * 0.05), 0.6);
      } else crackle(next, 0.45 + Math.random() * 0.4);
      next += 0.06 + Math.random() * Math.random() * 0.6;
    }
  }
  const timer = setInterval(schedule, 120);

  // pluie sur le toit (assourdie par la cabane) et vent dehors, très discrets
  const rainSrc = ctx.createBufferSource();
  rainSrc.buffer = buf;
  rainSrc.loop = true;
  rainSrc.playbackRate.value = 1.3;
  const rainHp = ctx.createBiquadFilter();
  rainHp.type = 'highpass';
  rainHp.frequency.value = 500;
  const rainLp = ctx.createBiquadFilter();
  rainLp.type = 'lowpass';
  rainLp.frequency.value = 2600;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0;
  rainSrc.connect(rainHp).connect(rainLp).connect(rainGain).connect(master);
  rainSrc.start(0, 1.7);
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = buf;
  windSrc.loop = true;
  windSrc.playbackRate.value = 0.5;
  const windBp = ctx.createBiquadFilter();
  windBp.type = 'bandpass';
  windBp.frequency.value = 380;
  windBp.Q.value = 0.7;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  windSrc.connect(windBp).connect(windGain).connect(master);
  windSrc.start(0, 0.9);
  const windLfo = ctx.createOscillator();
  windLfo.frequency.value = 0.07;
  const windLfoGain = ctx.createGain();
  windLfoGain.gain.value = 120;
  windLfo.connect(windLfoGain).connect(windBp.frequency);
  windLfo.start();

  // ---------- Romi : ronronnement, miaulements, croquettes, eau
  const purrNoise = ctx.createBufferSource();
  purrNoise.buffer = buf;
  purrNoise.loop = true;
  const purrBp = ctx.createBiquadFilter();
  purrBp.type = 'lowpass';
  purrBp.frequency.value = 260;
  const purrAm = ctx.createGain();
  purrAm.gain.value = 0.5;
  const purrOsc = ctx.createOscillator();
  purrOsc.type = 'triangle';
  purrOsc.frequency.value = 26;
  const purrDepth = ctx.createGain();
  purrDepth.gain.value = 0.5;
  purrOsc.connect(purrDepth).connect(purrAm.gain);
  const purrBreath = ctx.createGain();
  purrBreath.gain.value = 0.75;
  const breathOsc = ctx.createOscillator();
  breathOsc.frequency.value = 0.38;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.25;
  breathOsc.connect(breathDepth).connect(purrBreath.gain);
  const purrGain = ctx.createGain();
  purrGain.gain.value = 0;
  purrNoise.connect(purrBp).connect(purrAm).connect(purrBreath).connect(purrGain).connect(master);
  // un peu de grave tonal pour les petits haut-parleurs
  const purrTone = ctx.createOscillator();
  purrTone.type = 'sawtooth';
  purrTone.frequency.value = 52;
  const toneLp = ctx.createBiquadFilter();
  toneLp.type = 'lowpass';
  toneLp.frequency.value = 180;
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.18;
  purrTone.connect(toneLp).connect(toneGain).connect(purrAm);
  purrNoise.start(0, 2.3); purrOsc.start(); breathOsc.start(); purrTone.start();

  function meow(vol = 1) {
    const t = ctx.currentTime;
    const short = Math.random() < 0.45; // « mrrp » ou « miaou »
    const dur = short ? 0.28 : 0.55 + Math.random() * 0.2;
    const base = 460 + Math.random() * 120;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * (short ? 0.9 : 1), t);
    osc.frequency.linearRampToValueAtTime(base * (short ? 1.25 : 1.55), t + dur * 0.35);
    osc.frequency.linearRampToValueAtTime(base * (short ? 1.1 : 0.95), t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibG = ctx.createGain();
    vibG.gain.value = 9;
    vib.connect(vibG).connect(osc.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1900; f2.Q.value = 4;
    f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1150, t + dur * 0.4); f1.frequency.linearRampToValueAtTime(800, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.05);
    g.gain.setValueAtTime(0.09 * vol, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(f1).connect(g);
    osc.connect(f2).connect(g);
    g.connect(master);
    osc.start(t); vib.start(t);
    osc.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }
  function kibble() {
    const t = ctx.currentTime;
    for (let i = 0; i < 28; i++) {
      const s = ctx.createBufferSource();
      s.buffer = pop;
      s.playbackRate.value = 1.4 + Math.random();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 2500; f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.value = 0.18 + Math.random() * 0.2;
      s.connect(f).connect(g).connect(master);
      s.start(t + i * 0.03 + Math.random() * 0.03);
    }
  }
  function pour() {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lg = ctx.createGain(); lg.gain.value = 350;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1); g.gain.setValueAtTime(0.25, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 1.3);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 2); s.stop(t + 1.4); lfo.start(t); lfo.stop(t + 1.4);
  }

  let on = true;
  return {
    meow, kibble, pour,
    setPurr(level) { purrGain.gain.setTargetAtTime(level * 0.55, ctx.currentTime, 0.3); },
    ctx,
    async start() {
      if (ctx.state !== 'running') await ctx.resume();
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 1.2);
    },
    setDistance(dist, sameRoom) {
      const v = (1 / (1 + dist * dist * 0.09)) * (sameRoom ? 1 : 0.35);
      fireBus.gain.setTargetAtTime(Math.min(1, v * 1.3), ctx.currentTime, 0.25);
    },
    setWeather(rain, wind) {
      rainGain.gain.setTargetAtTime(rain * 0.22, ctx.currentTime, 2);
      windGain.gain.setTargetAtTime(Math.max(0, wind - 0.2) * 0.12, ctx.currentTime, 2);
    },
    toggle() {
      on = !on;
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.3);
      return on;
    },
    get on() { return on; },
    stop() { clearInterval(timer); ctx.close(); },
  };
}
