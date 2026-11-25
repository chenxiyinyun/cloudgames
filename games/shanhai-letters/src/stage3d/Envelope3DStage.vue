<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import { audioBridge, hapticsBridge } from '../bridge/platformBridge.js';
import {
  createOffscreenCanvas,
  createWebGLRenderer,
  disposeObject3D,
  isWebGLAvailable,
  prefersReducedMotion
} from './webglAdapter.js';

const props = defineProps({
  title: { type: String, required: true },
  fromText: { type: String, required: true },
  cityName: { type: String, default: '' },
  dateText: { type: String, default: '' },
  paperTint: { type: String, default: 'warm' }
});

const emit = defineEmits(['opened']);

const containerRef = ref(null);
const canvasRef = ref(null);
const useFallback = ref(!isWebGLAvailable());
const isOpening = ref(false);

let renderer = null;
let scene = null;
let camera = null;
let envelopeGroup = null;
let flapPivot = null;
let letterMesh = null;
let waxGroup = null;
let waxCoreMesh = null;
let shards = [];
let keyLight = null;
let rafId = 0;
let resizeObserver = null;
let disposed = false;

const pointerTarget = { x: 0, y: 0 };
const pointerSmooth = { x: 0, y: 0 };
const animState = { bend: 0.42 };

const TINT_PALETTE = {
  warm: ['#faf0d8', '#ead7b2', '#8f5f35'],
  cool: ['#f5f8f7', '#dfe8ea', '#486778'],
  jade: ['#f4f8f4', '#dce9e1', '#4b6c5a'],
  rose: ['#fbf2ed', '#edd7cd', '#8f5243']
};

function createEnvelopeFrontTexture() {
  const c = createOffscreenCanvas(1024, 640);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const [topCol, botCol, inkCol] = TINT_PALETTE[props.paperTint] || TINT_PALETTE.warm;

  const grad = ctx.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, topCol);
  grad.addColorStop(1, botCol);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 640);

  // 宣纸纤维肌理点缀
  ctx.fillStyle = 'rgba(139, 98, 57, 0.055)';
  for (let i = 0; i < 480; i += 1) {
    const x = (i * 173) % 1024;
    const y = (i * 251) % 640;
    ctx.fillRect(x, y, 2 + (i % 5), 1);
  }

  // 外圈描金暗纹框
  ctx.strokeStyle = 'rgba(196, 154, 108, 0.48)';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 968, 584);
  ctx.strokeStyle = 'rgba(192, 86, 63, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(42, 42, 940, 556);

  // 左下角朱砂邮驿戳（避开上方三角封盖斜边）
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 68, 47, 0.62)';
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(205, 526, 128, 32, -0.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#a8442f';
  ctx.font = '22px "Kaiti SC", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${props.cityName || '山海'}邮驿 · ${props.dateText || ''}`, 205, 533);
  ctx.restore();

  // 下方正中来信标题与寄件署名
  ctx.fillStyle = inkCol;
  ctx.textAlign = 'center';
  ctx.font = '25px "Kaiti SC", "STKaiti", serif';
  ctx.fillText(props.fromText, 560, 468);

  ctx.fillStyle = '#453729';
  ctx.font = 'bold 40px "Kaiti SC", "STKaiti", serif';
  ctx.fillText(props.title, 560, 534);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function createInnerLetterTexture() {
  const c = createOffscreenCanvas(896, 560);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fdf8eb';
  ctx.fillRect(0, 0, 896, 560);

  // 朱丝栏竖线
  ctx.strokeStyle = 'rgba(192, 86, 63, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, 824, 488);
  for (let x = 116; x <= 780; x += 66) {
    ctx.beginPath();
    ctx.moveTo(x, 54);
    ctx.lineTo(x, 506);
    ctx.stroke();
  }

  ctx.fillStyle = '#7a6552';
  ctx.font = '24px "Kaiti SC", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.fillText(props.title, 448, 220);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaxFaceTexture() {
  const c = createOffscreenCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(102, 92, 12, 128, 128, 124);
  grad.addColorStop(0, '#d8664e');
  grad.addColorStop(0.65, '#a83c27');
  grad.addColorStop(1, '#7c2516');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(248, 220, 166, 0.72)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 226, 180, 0.9)';
  ctx.font = 'bold 64px "Kaiti SC", "STKaiti", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('山海', 128, 132);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function updateLetterBend() {
  if (!letterMesh) return;
  const pos = letterMesh.geometry.attributes.position;
  const bend = animState.bend;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const curveZ = Math.cos((x / 1.62) * Math.PI * 0.5) * bend * 0.24 - Math.abs(y) * bend * 0.08;
    pos.setZ(i, curveZ);
  }
  pos.needsUpdate = true;
  letterMesh.geometry.computeVertexNormals();
}

function init3D() {
  if (useFallback.value || !canvasRef.value) return;
  try {
    renderer = createWebGLRenderer(canvasRef.value, {
      alpha: true,
      antialias: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.06
    });
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 30);
    camera.position.set(0, 0.18, 6.1);
    camera.lookAt(0, 0.05, 0);

    const hemi = new THREE.HemisphereLight(0xfff5e2, 0x6b4829, 1.35);
    scene.add(hemi);

    keyLight = new THREE.DirectionalLight(0xfff0d4, 1.65);
    keyLight.position.set(2.4, 3.2, 4.5);
    scene.add(keyLight);

    const rim = new THREE.PointLight(0xffb56a, 0.85, 14);
    rim.position.set(-2.5, -1.5, 3.2);
    scene.add(rim);

    envelopeGroup = new THREE.Group();
    scene.add(envelopeGroup);

    // 1. 信封主体背板与正面
    const frontTex = createEnvelopeFrontTexture();
    const backMat = new THREE.MeshStandardMaterial({
      color: 0xe7d2ac,
      roughness: 0.84,
      metalness: 0.02
    });
    const bodyGeo = new THREE.BoxGeometry(3.6, 2.25, 0.05);
    const bodyMesh = new THREE.Mesh(bodyGeo, backMat);
    bodyMesh.position.z = -0.04;
    envelopeGroup.add(bodyMesh);

    const frontGeo = new THREE.PlaneGeometry(3.6, 2.25);
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.82,
      metalness: 0.03
    });
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    frontMesh.position.z = 0.028;
    envelopeGroup.add(frontMesh);

    // 2. 封内卷曲宣纸信笺（拆封后顺势抽展）
    const letterTex = createInnerLetterTexture();
    const letterGeo = new THREE.PlaneGeometry(3.2, 1.94, 24, 10);
    const letterMat = new THREE.MeshStandardMaterial({
      map: letterTex,
      roughness: 0.86,
      metalness: 0.01,
      side: THREE.DoubleSide
    });
    letterMesh = new THREE.Mesh(letterGeo, letterMat);
    letterMesh.position.set(0, -0.02, -0.004);
    updateLetterBend();
    envelopeGroup.add(letterMesh);

    // 3. 顶部三角折盖（绕顶边铰链向上掀起）
    flapPivot = new THREE.Group();
    flapPivot.position.set(0, 1.125, 0.036);
    envelopeGroup.add(flapPivot);

    const flapShape = new THREE.Shape();
    flapShape.moveTo(-1.8, 0);
    flapShape.lineTo(1.8, 0);
    flapShape.quadraticCurveTo(0.24, -1.24, 0, -1.24);
    flapShape.quadraticCurveTo(-0.24, -1.24, -1.8, 0);
    const flapGeo = new THREE.ShapeGeometry(flapShape, 18);
    const flapMat = new THREE.MeshStandardMaterial({
      color: 0xf4e4c4,
      roughness: 0.78,
      metalness: 0.03,
      side: THREE.DoubleSide
    });
    const flapMesh = new THREE.Mesh(flapGeo, flapMat);
    flapPivot.add(flapMesh);

    // 4. 3D 立体火漆封章 + 碎裂蜡片
    waxGroup = new THREE.Group();
    waxGroup.position.set(0, -0.1, 0.068);
    envelopeGroup.add(waxGroup);

    const waxGeo = new THREE.CylinderGeometry(0.41, 0.46, 0.08, 28);
    waxGeo.rotateX(Math.PI / 2);
    // 给火漆外缘制造微弱手滴熔蜡起伏
    const wPos = waxGeo.attributes.position;
    for (let i = 0; i < wPos.count; i += 1) {
      const vx = wPos.getX(i);
      const vy = wPos.getY(i);
      const r = Math.hypot(vx, vy);
      if (r > 0.32) {
        const ang = Math.atan2(vy, vx);
        const wobble = 1 + 0.075 * Math.sin(ang * 7.0) + 0.045 * Math.cos(ang * 11.0);
        wPos.setX(i, vx * wobble);
        wPos.setY(i, vy * wobble);
      }
    }
    waxGeo.computeVertexNormals();

    const waxMat = new THREE.MeshStandardMaterial({
      color: 0xa63824,
      roughness: 0.25,
      metalness: 0.14
    });
    waxCoreMesh = new THREE.Mesh(waxGeo, waxMat);
    waxGroup.add(waxCoreMesh);

    const ringGeo = new THREE.TorusGeometry(0.32, 0.036, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xc24831,
      roughness: 0.22,
      metalness: 0.18
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.z = 0.035;
    waxGroup.add(ringMesh);

    const faceTex = createWaxFaceTexture();
    const faceGeo = new THREE.CircleGeometry(0.31, 28);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.28,
      metalness: 0.16
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.044;
    waxGroup.add(faceMesh);

    // 预构建 6 片飞散火漆碎片
    shards = [];
    for (let i = 0; i < 6; i += 1) {
      const sGeo = new THREE.DodecahedronGeometry(0.11, 0);
      const sMat = new THREE.MeshStandardMaterial({
        color: 0xa63824,
        roughness: 0.28,
        metalness: 0.12,
        transparent: true,
        opacity: 0
      });
      const sm = new THREE.Mesh(sGeo, sMat);
      sm.visible = false;
      waxGroup.add(sm);
      shards.push(sm);
    }

    syncSize();
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(containerRef.value);
    }

    const tick = (ts) => {
      if (disposed) return;
      const t = ts / 1000;
      pointerSmooth.x += (pointerTarget.x - pointerSmooth.x) * 0.09;
      pointerSmooth.y += (pointerTarget.y - pointerSmooth.y) * 0.09;

      if (envelopeGroup && !isOpening.value) {
        envelopeGroup.rotation.y = pointerSmooth.x * 0.22 + Math.sin(t * 1.1) * 0.025;
        envelopeGroup.rotation.x = -pointerSmooth.y * 0.15 + Math.cos(t * 0.9) * 0.015;
        envelopeGroup.position.y = Math.sin(t * 1.6) * 0.035;
      }
      if (keyLight) {
        keyLight.position.x = 2.4 + pointerSmooth.x * 1.8;
        keyLight.position.y = 3.2 - pointerSmooth.y * 1.2;
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
  pointerTarget.x = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
  pointerTarget.y = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
}

function handlePointerLeave() {
  pointerTarget.x = 0;
  pointerTarget.y = 0;
}

function triggerOpen() {
  if (isOpening.value) return;
  isOpening.value = true;
  audioBridge.waxBreak();
  hapticsBridge.trigger('heavy');

  if (useFallback.value || !envelopeGroup) {
    setTimeout(() => emit('opened'), 260);
    return;
  }

  const reduced = prefersReducedMotion();
  const tl = gsap.timeline({
    onComplete: () => emit('opened')
  });

  // 1. 轻按碎裂火漆
  tl.to(waxGroup.scale, { x: 0.88, y: 0.88, z: 0.72, duration: reduced ? 0.05 : 0.09, ease: 'power2.in' });
  tl.add(() => {
    waxGroup.children.forEach((ch) => {
      if (!shards.includes(ch)) ch.visible = false;
    });
    shards.forEach((sm, idx) => {
      const ang = (idx / shards.length) * Math.PI * 2 + 0.3;
      sm.visible = true;
      sm.position.set(0, 0, 0.04);
      sm.material.opacity = 1;
      gsap.to(sm.position, {
        x: Math.cos(ang) * (0.9 + (idx % 2) * 0.35),
        y: Math.sin(ang) * 0.75 - 0.35,
        z: 0.45 + Math.random() * 0.35,
        duration: reduced ? 0.15 : 0.42,
        ease: 'power2.out'
      });
      gsap.to(sm.rotation, { x: 4, y: 5, duration: 0.42 });
      gsap.to(sm.material, { opacity: 0, duration: 0.38, delay: 0.06 });
    });
  });

  // 2. 信封平正归位并掀开顶盖
  tl.to(envelopeGroup.rotation, { x: 0.12, y: 0, duration: reduced ? 0.1 : 0.28, ease: 'power2.out' }, '<');
  tl.to(
    flapPivot.rotation,
    {
      x: -2.65,
      duration: reduced ? 0.15 : 0.42,
      ease: 'power3.inOut',
      onStart: () => audioBridge.paperOpen()
    },
    '-=0.14'
  );

  // 3. 宣纸信笺抽出并展平
  tl.to(
    letterMesh.position,
    { y: 1.08, z: 0.36, duration: reduced ? 0.18 : 0.44, ease: 'power2.out' },
    '-=0.18'
  );
  tl.to(
    animState,
    {
      bend: 0,
      duration: reduced ? 0.18 : 0.44,
      ease: 'power2.out',
      onUpdate: updateLetterBend
    },
    '<'
  );
}

onMounted(init3D);

onUnmounted(() => {
  disposed = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (envelopeGroup) gsap.killTweensOf(envelopeGroup.rotation);
  if (flapPivot) gsap.killTweensOf(flapPivot.rotation);
  if (letterMesh) gsap.killTweensOf(letterMesh.position);
  if (waxGroup) gsap.killTweensOf(waxGroup.scale);
  gsap.killTweensOf(animState);
  shards.forEach((s) => {
    gsap.killTweensOf(s.position);
    gsap.killTweensOf(s.rotation);
    gsap.killTweensOf(s.material);
  });
  if (scene) disposeObject3D(scene);
  if (renderer) renderer.dispose();
  renderer = null;
});
</script>

<template>
  <div
    ref="containerRef"
    class="envelope-3d-wrap"
    :class="{ 'is-opening': isOpening }"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <!-- 降级 2D/CSS 展示（无头或低配环境） -->
    <div
      v-if="useFallback"
      class="sealed-envelope"
      :class="{ 'is-breaking': isOpening }"
      @click="triggerOpen"
    >
      <div class="se-postmark">
        <span>{{ cityName }}邮驿</span>
        <em>{{ dateText }}</em>
      </div>
      <div class="se-flap" />
      <div class="se-body">
        <p class="se-from">
          {{ fromText }}
        </p>
        <h3>{{ title }}</h3>
      </div>
      <span class="ws-ring">山海</span>
    </div>

    <!-- 3D 交互画布 -->
    <canvas
      v-else
      ref="canvasRef"
      class="envelope-3d-canvas"
      @click="triggerOpen"
    />

    <button
      type="button"
      class="envelope-3d-action"
      :disabled="isOpening"
      @click="triggerOpen"
    >
      <span>{{ isOpening ? '正启火漆展卷…' : '轻触火漆 · 拆启此信' }}</span>
    </button>
  </div>
</template>
