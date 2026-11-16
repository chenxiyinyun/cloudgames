/**
 * 跨端平台桥接层（Web 浏览器 ↔ 微信小程序 / Uni-app 统一适配）
 * 封装存储、线性马达触感、程序化国风音景与云存档请求，使核心逻辑层零平台耦合。
 */

const getWx = () => (typeof globalThis !== 'undefined' ? globalThis.wx : undefined);
const isWechat = () => {
  const w = getWx();
  return !!w && typeof w.getSystemInfoSync === 'function';
};
const hasWindow = () => typeof window !== 'undefined';

/* ---------- 1. 存储桥 ---------- */
export const storageBridge = {
  get(key) {
    try {
      const w = getWx();
      if (isWechat() && typeof w.getStorageSync === 'function') {
        return w.getStorageSync(key) || null;
      }
      if (hasWindow() && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      return null;
    }
    return null;
  },
  set(key, val) {
    try {
      const w = getWx();
      if (isWechat() && typeof w.setStorageSync === 'function') {
        w.setStorageSync(key, val);
        return;
      }
      if (hasWindow() && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch {
      /* 存储配额或隐私模式忽略 */
    }
  },
  remove(key) {
    try {
      const w = getWx();
      if (isWechat() && typeof w.removeStorageSync === 'function') {
        w.removeStorageSync(key);
        return;
      }
      if (hasWindow() && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
};

/* ---------- 2. 触感反馈桥（Web / 小程序震动） ---------- */
let hapticsEnabled = true;

export const hapticsBridge = {
  setEnabled(enabled) {
    hapticsEnabled = enabled !== false;
  },
  trigger(level = 'light') {
    if (!hapticsEnabled) return;
    try {
      const w = getWx();
      if (isWechat() && typeof w.vibrateShort === 'function') {
        w.vibrateShort({ type: level });
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const ms = level === 'heavy' ? 28 : level === 'medium' ? 14 : 7;
        navigator.vibrate(ms);
      }
    } catch {
      /* 部分桌面浏览器禁止未手势触发震动 */
    }
  }
};

/* ---------- 3. 原生 Web Audio 程序化国风音景合成器 ---------- */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientMuted = false;
    this.ambientNodes = null;
    this.chimeTimer = null;
    this.currentScene = 'hall';
    this.currentWeather = 'sunny';
  }

  ensureCtx() {
    if (this.muted || !hasWindow()) return null;
    if (!this.ctx) {
      const w = getWx();
      if (isWechat() && typeof w.createWebAudioContext === 'function') {
        this.ctx = w.createWebAudioContext();
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
    }
    if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted) this.stopAmbient();
  }

  setAmbientMuted(ambientMuted) {
    this.ambientMuted = !!ambientMuted;
    if (this.ambientMuted) this.stopAmbient();
    else this.syncAmbient(this.currentScene, this.currentWeather);
  }

  tone(freq, dur = 0.18, type = 'sine', gainVal = 0.06, delay = 0) {
    const c = this.ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur = 0.1, freq = 1400, q = 1.2, gainVal = 0.045, delay = 0) {
    const c = this.ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(t0);
  }

  syncAmbient(scene, weather) {
    this.currentScene = scene;
    this.currentWeather = weather;
    if (this.muted || this.ambientMuted) return;
    const c = this.ensureCtx();
    if (!c) return;

    this.stopAmbient();
    // 2 秒循环粉红滤波噪声，营造檐下雨声 / 茶炉暖意 / 庭院竹风
    const dur = 2.5;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 2.4;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = weather === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = weather === 'rain' ? 1150 : scene === 'hall' ? 420 : 680;
    filter.Q.value = weather === 'rain' ? 0.7 : 0.9;

    const g = c.createGain();
    const targetGain = weather === 'rain' ? 0.038 : scene === 'hall' ? 0.02 : 0.025;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(targetGain, c.currentTime + 0.6);

    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start();
    this.ambientNodes = { src, g };

    // 随机空灵五声泛音点缀
    this.chimeTimer = setInterval(() => {
      if (this.muted || this.ambientMuted || (typeof document !== 'undefined' && document.hidden)) return;
      if (Math.random() > 0.55) return;
      const idx = Math.floor(Math.random() * 5);
      const base = PENTA[idx];
      this.tone(base, 0.95, 'sine', 0.018, 0);
      if (Math.random() < 0.45) {
        this.tone(PENTA[(idx + 2) % PENTA.length], 1.1, 'sine', 0.012, 0.24);
      }
    }, 4500);
  }

  stopAmbient() {
    if (this.chimeTimer) {
      clearInterval(this.chimeTimer);
      this.chimeTimer = null;
    }
    if (this.ambientNodes) {
      try {
        this.ambientNodes.src.stop();
        this.ambientNodes.src.disconnect();
      } catch {
        /* ignore */
      }
      this.ambientNodes = null;
    }
  }

  tap() {
    this.tone(440, 0.06, 'triangle', 0.045, 0);
    this.tone(620, 0.05, 'sine', 0.022, 0.014);
  }
  wood() {
    this.tone(260, 0.08, 'triangle', 0.065, 0);
    this.tone(390, 0.06, 'sine', 0.028, 0.018);
  }
  pack(on) {
    if (on) {
      this.tone(PENTA[2], 0.11, 'sine', 0.055, 0);
      this.tone(PENTA[4], 0.14, 'sine', 0.045, 0.05);
    } else {
      this.tone(PENTA[3], 0.09, 'sine', 0.042, 0);
      this.tone(PENTA[1], 0.11, 'sine', 0.036, 0.04);
    }
  }
  pet(idx = 0, combo = 1) {
    const base = PENTA[(idx + Math.min(combo, 4)) % 5];
    this.tone(base, 0.15, 'sine', 0.055, 0);
    this.tone(base * 1.25, 0.18, 'triangle', 0.04, 0.055);
  }
  depart() {
    [0, 2, 3, 5].forEach((n, i) => this.tone(PENTA[n], 0.26, 'sine', 0.052, i * 0.075));
  }
  waxBreak() {
    this.noise(0.08, 2600, 1.8, 0.065, 0);
    this.tone(310, 0.09, 'triangle', 0.05, 0.01);
    this.tone(620, 0.12, 'sine', 0.032, 0.05);
  }
  paperOpen() {
    this.noise(0.14, 1700, 1.0, 0.048, 0);
    this.tone(PENTA[3], 0.18, 'sine', 0.028, 0.03);
  }
  pageTurn() {
    this.noise(0.11, 2100, 1.1, 0.042, 0);
    this.tone(PENTA[2], 0.12, 'sine', 0.022, 0.02);
  }
  stampPress() {
    this.tone(135, 0.12, 'triangle', 0.095, 0);
    this.noise(0.07, 900, 1.4, 0.05, 0.01);
    this.tone(PENTA[4], 0.26, 'sine', 0.036, 0.07);
  }
  herb() {
    [2, 4, 5].forEach((n, i) => this.tone(PENTA[n], 0.16, 'sine', 0.048, i * 0.055));
  }
  craft() {
    [0, 2, 4, 6].forEach((n, i) => this.tone(PENTA[n], 0.22, 'sine', 0.05, i * 0.065));
  }
  arrive() {
    [0, 1, 2, 4].forEach((n, i) => this.tone(PENTA[n], 0.28, 'triangle', 0.05, i * 0.085));
  }
}

export const audioBridge = new SoundEngine();

/* ---------- 4. 网络请求桥（用于云存档 /api/shanhai） ---------- */
export async function httpRequest(url, opts = {}) {
  const headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const w = getWx();
  if (isWechat() && typeof w.request === 'function') {
    return new Promise((resolve, reject) => {
      w.request({
        url,
        method: opts.method || 'GET',
        header: headers,
        data: opts.body,
        success(res) {
          resolve({ status: res.statusCode, data: res.data || null });
        },
        fail(err) {
          reject(err);
        }
      });
    });
  }

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
    credentials: 'omit',
    keepalive: !!opts.keepalive
  });
  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  return { status: res.status, data };
}

export function platformInfo() {
  return {
    isWechat: isWechat(),
    isFile: hasWindow() && window.location && window.location.protocol === 'file:'
  };
}
