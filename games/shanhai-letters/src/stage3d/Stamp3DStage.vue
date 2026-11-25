<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import { triggerShake } from '../stores/gameStore.js';
import {
  createOffscreenCanvas,
  createWebGLRenderer,
  disposeObject3D,
  isWebGLAvailable,
  prefersReducedMotion
} from './webglAdapter.js';
import { INK_BLEED_FRAG, INK_BLEED_VERT } from './shaders.js';

const props = defineProps({
  stampName: { type: String, required: true },
  stampMotto: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['stamped']);

const containerRef = ref(null);
const canvasRef = ref(null);
const useFallback = ref(!isWebGLAvailable());
const isStamping = ref(false);

let renderer = null;
let scene = null;
let camera = null;
let sealGroup = null;
let shadowMesh = null;
let inkMesh = null;
let inkUniforms = null;
let stampTexture = null;
let rafId = 0;
let resizeObserver = null;
let disposed = false;

const hoverTarget = { x: 0.35, z: -0.15 };
const hoverSmooth = { x: 0.35, z: -0.15 };

function createDeskPaperTexture() {
  const c = createOffscreenCanvas(512, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#faf2de';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(192, 86, 63, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, 476, 220);
  for (let x = 56; x <= 456; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x, 228);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(139, 98, 57, 0.36)';
  ctx.font = '14px "Kaiti SC", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.fillText('铃印处', 256, 212);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStampMaskTexture(name) {
  const c = createOffscreenCanvas(512, 512);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 512);

  // 外框线（印章阳刻框 + 微弱雕凿缺口）
  ctx.strokeStyle = '#c03828';
  ctx.lineWidth = 26;
  ctx.strokeRect(46, 46, 420, 420);

  ctx.lineWidth = 8;
  ctx.strokeRect(72, 72, 368, 368);

  const chars = Array.from(String(name || '山海')).slice(0, 4);
  ctx.fillStyle = '#c03828';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (chars.length === 4) {
    ctx.font = 'bold 126px "Kaiti SC", "STKaiti", serif';
    // 传统印章右起竖排：右上、右下、左上、左下
    ctx.fillText(chars[0], 328, 182);
    ctx.fillText(chars[1], 328, 336);
    ctx.fillText(chars[2], 184, 182);
    ctx.fillText(chars[3], 184, 336);
  } else if (chars.length === 3) {
    ctx.font = 'bold 120px "Kaiti SC", "STKaiti", serif';
    ctx.fillText(chars[0], 324, 184);
    ctx.fillText(chars[1], 324, 334);
    ctx.fillText(chars[2], 184, 258);
  } else {
    ctx.font = 'bold 165px "Kaiti SC", "STKaiti", serif';
    ctx.fillText(chars.join(''), 256, 260);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function init3D() {
  if (useFallback.value || !canvasRef.value) return;
  try {
    renderer = createWebGLRenderer(canvasRef.value, {
      alpha: true,
      antialias: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.04
    });
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 2.8, 0.1, 30);
    camera.position.set(0, 3.7, 4.45);
    camera.lookAt(0, 0.36, 0);

    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b4829, 1.4));
    const dir = new THREE.DirectionalLight(0xfff2da, 1.55);
    dir.position.set(2.4, 4.6, 2.8);
    scene.add(dir);

    // 1. 铺展于案上的宣纸信尾
    const deskTex = createDeskPaperTexture();
    const paperMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 3.4),
      new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.9, metalness: 0.01 })
    );
    paperMesh.rotation.x = -Math.PI / 2;
    scene.add(paperMesh);

    // 2. GLSL 宣纸纤维朱砂渗透印泥层
    stampTexture = createStampMaskTexture(props.stampName);
    inkUniforms = {
      uStampMap: { value: stampTexture },
      uProgress: { value: 0 },
      uTime: { value: 0 }
    };
    inkMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 1.42),
      new THREE.ShaderMaterial({
        uniforms: inkUniforms,
        vertexShader: INK_BLEED_VERT,
        fragmentShader: INK_BLEED_FRAG,
        transparent: true,
        depthWrite: false
      })
    );
    inkMesh.rotation.x = -Math.PI / 2;
    inkMesh.position.set(0, 0.012, 0.05);
    scene.add(inkMesh);

    // 3. 印章投影柔影
    const shadowCanvas = createOffscreenCanvas(128, 128);
    if (shadowCanvas) {
      const sctx = shadowCanvas.getContext('2d');
      const g = sctx.createRadialGradient(64, 64, 8, 64, 64, 58);
      g.addColorStop(0, 'rgba(54, 32, 14, 0.42)');
      g.addColorStop(1, 'rgba(54, 32, 14, 0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.72, depthWrite: false })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(hoverSmooth.x, 0.008, hoverSmooth.z);
    scene.add(shadowMesh);

    // 4. 3D 酸枝木青玉纽闲章
    sealGroup = new THREE.Group();
    sealGroup.position.set(hoverSmooth.x, 0.84, hoverSmooth.z);
    scene.add(sealGroup);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c331e, roughness: 0.36, metalness: 0.08 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a24e, roughness: 0.25, metalness: 0.72 });
    const jadeMat = new THREE.MeshStandardMaterial({ color: 0x7ba193, roughness: 0.2, metalness: 0.06 });
    const inkFootMat = new THREE.MeshStandardMaterial({ color: 0xb23624, roughness: 0.5 });

    const baseCube = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.72, 0.84), [
      woodMat,
      woodMat,
      woodMat,
      inkFootMat,
      woodMat,
      woodMat
    ]);
    sealGroup.add(baseCube);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 24), brassMat);
    collar.position.y = 0.41;
    sealGroup.add(collar);

    const knobPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.22, 0.02),
      new THREE.Vector2(0.27, 0.18),
      new THREE.Vector2(0.21, 0.35),
      new THREE.Vector2(0.08, 0.44),
      new THREE.Vector2(0.0, 0.46)
    ];
    const knob = new THREE.Mesh(new THREE.LatheGeometry(knobPoints, 24), jadeMat);
    knob.position.y = 0.47;
    sealGroup.add(knob);

    syncSize();
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(containerRef.value);
    }

    const tick = (ts) => {
      if (disposed) return;
      const t = ts / 1000;
      if (!isStamping.value && sealGroup) {
        hoverSmooth.x += (hoverTarget.x - hoverSmooth.x) * 0.12;
        hoverSmooth.z += (hoverTarget.z - hoverSmooth.z) * 0.12;
        const bob = Math.sin(t * 2.2) * 0.035;
        sealGroup.position.set(hoverSmooth.x, 0.84 + bob, hoverSmooth.z);
        sealGroup.rotation.z = -(hoverTarget.x - hoverSmooth.x) * 0.25;
        sealGroup.rotation.x = (hoverTarget.z - hoverSmooth.z) * 0.25;
      }
      if (shadowMesh && sealGroup) {
        shadowMesh.position.x = sealGroup.position.x;
        shadowMesh.position.z = sealGroup.position.z;
        const hRatio = THREE.MathUtils.clamp(sealGroup.position.y / 1.15, 0.3, 1);
        shadowMesh.scale.setScalar(0.76 + hRatio * 0.32);
        shadowMesh.material.opacity = 0.9 - hRatio * 0.38;
      }
      if (inkUniforms) inkUniforms.uTime.value = t;
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
  if (!containerRef.value || isStamping.value) return;
  const r = containerRef.value.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  hoverTarget.x = THREE.MathUtils.clamp(nx * 0.95, -0.95, 0.95);
  hoverTarget.z = THREE.MathUtils.clamp(ny * 0.42, -0.42, 0.42);
}

function handlePointerLeave() {
  if (isStamping.value) return;
  hoverTarget.x = 0.45;
  hoverTarget.z = -0.16;
}

function triggerStamp() {
  if (isStamping.value || props.disabled) return;
  isStamping.value = true;

  if (useFallback.value || !sealGroup || !inkUniforms) {
    audioBridge.stampPress();
    hapticsBridge.trigger('heavy');
    triggerShake(260);
    setTimeout(() => {
      isStamping.value = false;
      emit('stamped');
    }, 240);
    return;
  }

  const reduced = prefersReducedMotion();
  inkUniforms.uProgress.value = 0;

  const tl = gsap.timeline({
    onComplete: () => {
      isStamping.value = false;
      emit('stamped');
    }
  });

  // 1. 对准印位悬停蓄力
  tl.to(sealGroup.position, { x: 0, y: 1.18, z: 0.05, duration: reduced ? 0.05 : 0.14, ease: 'power2.out' });
  tl.to(sealGroup.rotation, { x: 0, z: 0, duration: reduced ? 0.05 : 0.14 }, '<');

  // 2. 重印砸落宣纸并触发物理震感与朱砂纤维渗透
  tl.to(sealGroup.position, {
    y: 0.37,
    duration: reduced ? 0.06 : 0.1,
    ease: 'power4.in',
    onComplete: () => {
      audioBridge.stampPress();
      hapticsBridge.trigger('heavy');
      triggerShake(260);
    }
  });
  tl.to(inkUniforms.uProgress, { value: 1.0, duration: reduced ? 0.12 : 0.36, ease: 'power2.out' });

  // 3. 提印微旋收起，显露湿润朱砂方印
  tl.to(
    sealGroup.position,
    { x: 0.85, y: 1.05, z: -0.22, duration: reduced ? 0.08 : 0.26, ease: 'power2.out' },
    '-=0.1'
  );
}

watch(
  () => props.stampName,
  (name) => {
    if (!inkUniforms) return;
    const nextTex = createStampMaskTexture(name);
    if (nextTex) {
      if (stampTexture) stampTexture.dispose();
      stampTexture = nextTex;
      inkUniforms.uStampMap.value = nextTex;
      inkUniforms.uProgress.value = 0;
    }
  }
);

defineExpose({ triggerStamp });

onMounted(init3D);

onUnmounted(() => {
  disposed = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (sealGroup) {
    gsap.killTweensOf(sealGroup.position);
    gsap.killTweensOf(sealGroup.rotation);
  }
  if (inkUniforms) gsap.killTweensOf(inkUniforms.uProgress);
  if (scene) disposeObject3D(scene);
  if (renderer) renderer.dispose();
  renderer = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="stamp-3d-wrap"
    :class="{ 'is-stamping': isStamping }"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
    @click="triggerStamp"
  >
    <div
      v-if="useFallback"
      class="stamp-3d-fallback"
    >
      <span class="s3f-seal">{{ stampName }}</span>
      <em>点击即可落印</em>
    </div>
    <canvas
      v-else
      ref="canvasRef"
      class="stamp-3d-canvas"
    />
    <span class="stamp-3d-hint">{{ isStamping ? '朱砂落印中…' : `悬印「${stampName}」· 点击印台直接钤印` }}</span>
  </div>
</template>
