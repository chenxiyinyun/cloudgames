/**
 * WebGL 与 Three.js 跨端适配层（Web 浏览器 ↔ 微信小程序 three-platformize）
 * 所有 Three.js 渲染器、纹理加载与资源销毁均通过此层中转，
 * 使上层 2.5D 舞台与 3D 器物交互零平台硬耦合。
 */
import * as THREE from 'three';

let customAdapter = null;
let cachedWebGLSupport = null;

/**
 * 注册自定义平台适配器（例如微信小程序传入 three-platformize 的 WechatPlatform 包装）。
 */
export function registerPlatformAdapter(adapter) {
  customAdapter = adapter || null;
  cachedWebGLSupport = null;
}

export function getPlatformAdapter() {
  return customAdapter;
}

/**
 * 检测当前环境是否具备可用的 WebGL 上下文；无头测试或低端环境返回 false 以优雅回退。
 */
export function isWebGLAvailable() {
  if (customAdapter && typeof customAdapter.isWebGLAvailable === 'function') {
    return !!customAdapter.isWebGLAvailable();
  }
  if (cachedWebGLSupport !== null) return cachedWebGLSupport;
  if (typeof document === 'undefined') {
    cachedWebGLSupport = false;
    return false;
  }
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    cachedWebGLSupport = !!gl;
    if (gl && typeof gl.getExtension === 'function') {
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose && typeof lose.loseContext === 'function') lose.loseContext();
    }
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

export function getDevicePixelRatio(maxDpr = 2) {
  if (customAdapter && typeof customAdapter.getDevicePixelRatio === 'function') {
    return Math.min(customAdapter.getDevicePixelRatio(), maxDpr);
  }
  const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
  return Math.min(dpr, maxDpr);
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * 创建统一配置的 WebGLRenderer。
 */
export function createWebGLRenderer(canvas, options = {}) {
  const {
    alpha = true,
    antialias = true,
    maxDpr = 2,
    toneMapping = THREE.NoToneMapping,
    toneMappingExposure = 1.0
  } = options;

  let renderer;
  if (customAdapter && typeof customAdapter.createRenderer === 'function') {
    renderer = customAdapter.createRenderer(canvas, { alpha, antialias });
  } else {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha,
      antialias,
      powerPreference: 'high-performance'
    });
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;
  renderer.setPixelRatio(getDevicePixelRatio(maxDpr));
  return renderer;
}

/**
 * 加载插画纹理（关闭 mipmap 与 2 的幂次缩放，确保手绘国风线条锐利且兼容小程序 WebGL1）。
 */
export function loadImageTexture(url, { srgb = true } = {}) {
  if (!url) return null;
  if (customAdapter && typeof customAdapter.loadTexture === 'function') {
    return customAdapter.loadTexture(url, { srgb });
  }
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * 创建离屏 Canvas（兼容自定义适配器）。
 */
export function createOffscreenCanvas(width, height) {
  if (customAdapter && typeof customAdapter.createCanvas === 'function') {
    return customAdapter.createCanvas(width, height);
  }
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * 递归释放 Three.js 层级内的几何体、材质与纹理资源。
 */
export function disposeObject3D(root) {
  if (!root) return;
  const disposedTex = new Set();
  const disposeMat = (mat) => {
    if (!mat) return;
    Object.values(mat).forEach((val) => {
      if (val && val.isTexture && !disposedTex.has(val)) {
        disposedTex.add(val);
        val.dispose();
      }
    });
    if (mat.uniforms) {
      Object.values(mat.uniforms).forEach((u) => {
        if (u && u.value && u.value.isTexture && !disposedTex.has(u.value)) {
          disposedTex.add(u.value);
          u.value.dispose();
        }
      });
    }
    if (typeof mat.dispose === 'function') mat.dispose();
  };

  root.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === 'function') {
      obj.geometry.dispose();
    }
    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMat);
    } else if (obj.material) {
      disposeMat(obj.material);
    }
  });
}
