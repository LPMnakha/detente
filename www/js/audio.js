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

  let on = true;
  return {
    ctx,
    async start() {
      if (ctx.state !== 'running') await ctx.resume();
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 1.2);
    },
    setDistance(dist, sameRoom) {
      const v = (1 / (1 + dist * dist * 0.09)) * (sameRoom ? 1 : 0.35);
      fireBus.gain.setTargetAtTime(Math.min(1, v * 1.3), ctx.currentTime, 0.25);
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
