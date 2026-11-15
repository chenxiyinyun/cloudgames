/* 轻量木石/丝竹拟音（纯 Web Audio API，零外部音频依赖，离线可用） */
(function () {
  const SH = (window.SH = window.SH || {});

  let ctx = null;
  function getCtx() {
    if (SH.state && SH.state.settings && SH.state.settings.muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, dur, type, gainVal, delay) {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainVal || 0.08, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.18));
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.18) + 0.02);
  }

  function noiseBurst(dur, filterFreq, gainVal) {
    const c = getCtx();
    if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * (dur || 0.08)));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 1400;
    filter.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(gainVal || 0.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.08));
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start();
  }

  // 五声音阶频率：宫商角徵羽 (C5, D5, E5, G5, A5, C6)
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  SH.sound = {
    tap() {
      tone(420, 0.07, 'triangle', 0.055, 0);
      tone(580, 0.06, 'sine', 0.03, 0.015);
    },
    wood() {
      tone(290, 0.09, 'triangle', 0.075, 0);
      tone(440, 0.06, 'sine', 0.035, 0.02);
    },
    pack(on) {
      if (on) {
        tone(PENTA[2], 0.11, 'sine', 0.065, 0);
        tone(PENTA[4], 0.14, 'sine', 0.055, 0.05);
      } else {
        tone(PENTA[3], 0.1, 'sine', 0.05, 0);
        tone(PENTA[1], 0.12, 'sine', 0.045, 0.04);
      }
    },
    pet(idx) {
      const base = PENTA[(idx || 0) % 3];
      tone(base, 0.14, 'sine', 0.065, 0);
      tone(base * 1.25, 0.18, 'triangle', 0.05, 0.06);
    },
    depart() {
      [0, 2, 3, 5].forEach((n, i) => tone(PENTA[n], 0.24, 'sine', 0.06, i * 0.07));
    },
    paper() {
      noiseBurst(0.11, 1800, 0.055);
      tone(PENTA[3], 0.14, 'sine', 0.035, 0.02);
    },
    herb() {
      [2, 4, 5].forEach((n, i) => tone(PENTA[n], 0.15, 'sine', 0.055, i * 0.055));
    },
    arrive() {
      [0, 1, 2, 4].forEach((n, i) => tone(PENTA[n], 0.26, 'triangle', 0.055, i * 0.08));
    }
  };
})();
