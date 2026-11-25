<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import {
  BEAST_SVGS,
  CITY_GRADIENTS,
  ITEM_SVGS,
  MATERIAL_SVGS,
  SOUVENIR_EXTRA_SVGS,
  beastImgUrl,
  cityImgUrl,
  souvenirImgUrl
} from '../data/artwork.js';
import {
  createOffscreenCanvas,
  createWebGLRenderer,
  disposeObject3D,
  isWebGLAvailable,
  loadImageTexture,
  prefersReducedMotion
} from './webglAdapter.js';
import { RELIC_FOIL_FRAG, RELIC_FOIL_VERT } from './shaders.js';

const props = defineProps({
  kind: { type: String, required: true }, // 'souvenir' | 'city'
  artId: { type: String, required: true },
  title: { type: String, default: '' },
  rarity: { type: String, default: 'common' } // 'common' | 'rare' | 'legend'
});

const containerRef = ref(null);
const canvasRef = ref(null);
const useFallback = ref(!isWebGLAvailable());
const fallbackRot = ref({ rx: 0, ry: 0 });

let renderer = null;
let scene = null;
let camera = null;
let plaqueGroup = null;
let foilUniforms = null;
let artTex = null;
let dustPoints = null;
let rafId = 0;
let resizeObserver = null;
let disposed = false;

const tiltTarget = { x: 0, y: 0 };
const tiltSmooth = { x: 0, y: 0 };

function createFallbackCanvasTexture() {
  const c = createOffscreenCanvas(512, 512);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  if (props.kind === 'city') {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    if (props.artId === 'quanzhou') {
      grad.addColorStop(0, '#4b7d93');
      grad.addColorStop(0.65, '#c86f54');
      grad.addColorStop(1, '#f3d5a5');
    } else if (props.artId === 'dali') {
      grad.addColorStop(0, '#5d869c');
      grad.addColorStop(0.55, '#8eb4ad');
      grad.addColorStop(1, '#f2ebd8');
    } else {
      grad.addColorStop(0, '#ece2cc');
      grad.addColorStop(1, '#c7b696');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#fdf8eb';
    ctx.font = 'bold 46px "Kaiti SC", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.title || props.artId, 256, 256);
  } else {
    ctx.clearRect(0, 0, 512, 512);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  let svgStr = '';
  if (props.kind === 'souvenir') svgStr = SOUVENIR_EXTRA_SVGS[props.artId] || '';
  else if (props.kind === 'item') svgStr = ITEM_SVGS[props.artId] || '';
  else if (props.kind === 'material') svgStr = MATERIAL_SVGS[props.artId] || '';
  else if (props.kind === 'beast') svgStr = BEAST_SVGS[props.artId] || '';

  if (svgStr && typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(img, 56, 56, 400, 400);
      tex.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  }

  return tex;
}

function resolveArtTexture() {
  let url = null;
  if (props.kind === 'souvenir') url = souvenirImgUrl(props.artId);
  else if (props.kind === 'city') url = cityImgUrl(props.artId);
  else if (props.kind === 'beast') url = beastImgUrl(props.artId);
  if (url) return loadImageTexture(url, { srgb: true });
  return createFallbackCanvasTexture();
}

function rarityValue(r) {
  if (r === 'legend') return 2;
  if (r === 'rare') return 1;
  return 0;
}

function init3D() {
  if (useFallback.value || !canvasRef.value) return;
  try {
    renderer = createWebGLRenderer(canvasRef.value, { alpha: true, antialias: true });
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1.4, 0.1, 30);
    camera.position.set(0, -0.06, 5.75);
    camera.lookAt(0, -0.08, 0);

    scene.add(new THREE.HemisphereLight(0xfff5e2, 0x5c3b1e, 1.45));
    const dir = new THREE.DirectionalLight(0xffefc9, 1.3);
    dir.position.set(2.2, 3.0, 4.0);
    scene.add(dir);

    plaqueGroup = new THREE.Group();
    scene.add(plaqueGroup);

    const isWide = props.kind === 'city';
    const w = isWide ? 3.2 : 2.38;
    const h = isWide ? 2.02 : 2.38;

    // 酸枝木描金展牌底座
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x623b22, roughness: 0.42, metalness: 0.12 })
    );
    frameMesh.position.z = -0.068;
    plaqueGroup.add(frameMesh);

    const goldRim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xd4a24e, roughness: 0.3, metalness: 0.65 })
    );
    goldRim.position.z = -0.018;
    plaqueGroup.add(goldRim);

    artTex = resolveArtTexture();
    foilUniforms = {
      uArtMap: { value: artTex },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uRarity: { value: rarityValue(props.rarity) }
    };

    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        uniforms: foilUniforms,
        vertexShader: RELIC_FOIL_VERT,
        fragmentShader: RELIC_FOIL_FRAG
      })
    );
    faceMesh.position.z = 0.008;
    plaqueGroup.add(faceMesh);

    // 稀有与传说藏品微金尘点缀
    const pts = new Float32Array(18 * 3);
    for (let i = 0; i < 18; i += 1) {
      pts[i * 3] = (Math.random() - 0.5) * 4.2;
      pts[i * 3 + 1] = (Math.random() - 0.5) * 2.8;
      pts[i * 3 + 2] = -0.4 + Math.random() * 1.0;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xf4cf76, size: 0.045, transparent: true, opacity: 0.55 })
    );
    dustPoints.visible = props.rarity !== 'common';
    scene.add(dustPoints);

    syncSize();
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(containerRef.value);
    }

    const reduced = prefersReducedMotion();
    const tick = (ts) => {
      if (disposed) return;
      const t = ts / 1000;
      tiltSmooth.x += (tiltTarget.x - tiltSmooth.x) * 0.1;
      tiltSmooth.y += (tiltTarget.y - tiltSmooth.y) * 0.1;

      if (plaqueGroup) {
        const idleY = reduced ? 0 : Math.sin(t * 1.35) * 0.08;
        const idleX = reduced ? 0 : Math.cos(t * 1.1) * 0.04;
        plaqueGroup.rotation.y = tiltSmooth.x * 0.36 + idleY;
        plaqueGroup.rotation.x = -tiltSmooth.y * 0.28 + idleX;
        plaqueGroup.position.y = reduced ? 0 : Math.sin(t * 1.9) * 0.035;
      }
      if (foilUniforms) {
        foilUniforms.uTime.value = t;
        foilUniforms.uTilt.value.set(tiltSmooth.x, tiltSmooth.y);
      }
      if (dustPoints && dustPoints.visible) {
        dustPoints.rotation.y = t * 0.15;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    useFallback.value = true;
  }
}

function syncSize() {
  if (!renderer || !containerRef.value || !camera) return;
  const r = containerRef.value.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}

function handlePointerMove(e) {
  if (!containerRef.value) return;
  const r = containerRef.value.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  tiltTarget.x = THREE.MathUtils.clamp(nx, -1, 1);
  tiltTarget.y = THREE.MathUtils.clamp(ny, -1, 1);
  fallbackRot.value = { rx: -ny * 10, ry: nx * 14 };
}

function handlePointerLeave() {
  tiltTarget.x = 0;
  tiltTarget.y = 0;
  fallbackRot.value = { rx: 0, ry: 0 };
}

watch(
  () => [props.kind, props.artId, props.rarity, props.title],
  () => {
    if (!foilUniforms) return;
    const nextTex = resolveArtTexture();
    if (nextTex) {
      if (artTex) artTex.dispose();
      artTex = nextTex;
      foilUniforms.uArtMap.value = nextTex;
    }
    foilUniforms.uRarity.value = rarityValue(props.rarity);
    if (dustPoints) dustPoints.visible = props.rarity !== 'common';
  }
);

onMounted(init3D);

onUnmounted(() => {
  disposed = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (scene) disposeObject3D(scene);
  if (renderer) renderer.dispose();
  renderer = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="relic-3d-wrap"
    :class="`r-${rarity}`"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <div
      v-if="useFallback"
      class="relic-3d-fallback"
      :style="{ transform: `perspective(600px) rotateX(${fallbackRot.rx}deg) rotateY(${fallbackRot.ry}deg)` }"
    >
      <div
        v-if="kind === 'city' && !cityImgUrl(artId)"
        class="relic-city-grad"
        :style="{ background: CITY_GRADIENTS[artId] || 'linear-gradient(150deg,#ece2cc,#c7b696)' }"
      >
        {{ title }}
      </div>
      <img
        v-else-if="kind === 'souvenir' ? souvenirImgUrl(artId) : cityImgUrl(artId)"
        :src="kind === 'souvenir' ? souvenirImgUrl(artId) : cityImgUrl(artId)"
        :alt="title"
        class="relic-fb-img"
      >
      <span v-else>{{ title }}</span>
    </div>
    <canvas
      v-else
      ref="canvasRef"
      class="relic-3d-canvas"
    />
    <span class="relic-3d-hint">拨动把玩 · 细观器物釉彩</span>
  </div>
</template>
