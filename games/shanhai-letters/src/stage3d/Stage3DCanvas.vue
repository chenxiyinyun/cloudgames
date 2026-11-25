<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import StageCanvas from '../stage/StageCanvas.vue';
import { DioramaEngine } from './DioramaEngine.js';
import { isWebGLAvailable } from './webglAdapter.js';

const props = defineProps({
  scene: { type: String, required: true },
  timeOfDay: { type: String, required: true },
  particleMode: { type: String, default: 'petals' },
  homeBeastIds: { type: Array, default: () => [] },
  petTriggers: { type: Object, default: () => ({}) },
  focusTarget: { type: String, default: null },
  cameraShake: { type: Boolean, default: false }
});

const emit = defineEmits(['actor-positions']);

const containerRef = ref(null);
const canvasRef = ref(null);
const useFallback2D = ref(!isWebGLAvailable());

let engine = null;
let resizeObserver = null;
const lastPetMarks = {};

function syncSize() {
  if (!engine || !containerRef.value) return;
  const r = containerRef.value.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) {
    engine.resize(r.width, r.height);
  }
}

function handlePointerMove(e) {
  if (!engine || !containerRef.value) return;
  const r = containerRef.value.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  engine.setPointer(nx, ny);
}

function handlePointerLeave() {
  if (engine) engine.resetPointer();
}

watch(
  () => [props.scene, props.timeOfDay, props.particleMode, props.homeBeastIds],
  () => {
    if (!engine) return;
    engine.updateProps({
      scene: props.scene,
      timeOfDay: props.timeOfDay,
      particleMode: props.particleMode,
      homeBeastIds: props.homeBeastIds
    });
  },
  { deep: true }
);

watch(
  () => props.focusTarget,
  (val) => {
    if (engine) engine.setFocusTarget(val);
  }
);

watch(
  () => props.cameraShake,
  (shaking) => {
    if (shaking && engine) engine.triggerCameraShake();
  }
);

watch(
  () => props.petTriggers,
  (map) => {
    if (!engine || !map) return;
    Object.entries(map).forEach(([id, ts]) => {
      if (ts && ts > (lastPetMarks[id] || 0)) {
        lastPetMarks[id] = ts;
        engine.triggerPet(id);
      }
    });
  },
  { deep: true }
);

onMounted(() => {
  if (useFallback2D.value || !canvasRef.value) return;
  try {
    engine = new DioramaEngine(
      canvasRef.value,
      {
        scene: props.scene,
        timeOfDay: props.timeOfDay,
        particleMode: props.particleMode,
        homeBeastIds: props.homeBeastIds,
        focusTarget: props.focusTarget
      },
      {
        onActorPositions: (pos) => emit('actor-positions', pos)
      }
    );
    syncSize();
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(containerRef.value);
    } else {
      window.addEventListener('resize', syncSize);
    }
  } catch {
    useFallback2D.value = true;
    engine = null;
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  } else if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncSize);
  }
  if (engine) {
    engine.dispose();
    engine = null;
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="stage-3d-wrap"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <StageCanvas
      v-if="useFallback2D"
      :scene="scene"
      :time-of-day="timeOfDay"
      :particle-mode="particleMode"
      :home-beast-ids="homeBeastIds"
      :pet-triggers="petTriggers"
      @actor-positions="(p) => emit('actor-positions', p)"
    />
    <canvas
      v-else
      ref="canvasRef"
      class="stage-3d-canvas"
    />
  </div>
</template>

<style scoped>
.stage-3d-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.stage-3d-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
