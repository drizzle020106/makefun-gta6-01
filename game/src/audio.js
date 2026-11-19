// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, punches, pickups and cash chimes.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.05;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
    let high = true;
    sirenTimer = window.setInterval(() => {
      if (!sirenOsc) return;
      high = !high;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.05);
    }, 450);
  }

  function stopSiren() {
    if (sirenTimer) window.clearInterval(sirenTimer);
    sirenTimer = null;
    if (sirenOsc) {
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  return {
    unlock() {
      ensureContext();
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
    },
    // speedRatio 0..1 while driving; 0 silences the engine.
    setEngine(speedRatio, driving) {
      if (!ctx) return;
      if (driving) startEngine();
      if (!engineOsc || !engineGain) return;
      const target = muted ? 0 : driving ? 0.045 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    setSirenOn(on) {
      if (!ctx) return;
      if (on) startSiren();
      else stopSiren();
    },
    gunshot() {
      noiseBurst(0.16, 0.5, 1400);
    },
    punch() {
      noiseBurst(0.09, 0.35, 500);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.25);
      blip(990, 0.18, 'sine', 0.25, 0.09);
    },
    cash() {
      blip(880, 0.1, 'triangle', 0.22);
      blip(1174, 0.1, 'triangle', 0.22, 0.08);
      blip(1568, 0.22, 'triangle', 0.22, 0.16);
    },
    crash() {
      noiseBurst(0.25, 0.45, 300);
    },
    missionStart() {
      blip(523, 0.14, 'square', 0.12);
      blip(784, 0.2, 'square', 0.12, 0.12);
    },
  };
}
