<script setup>
import ArtSprite from './ArtSprite.vue';

defineProps({
  flights: { type: Array, default: () => [] }
});
</script>

<template>
  <div
    class="flight-fx-layer"
    aria-hidden="true"
  >
    <div
      v-for="fl in flights"
      :key="fl.id"
      class="flight-node"
      :style="{
        '--fx-x0': `${fl.fromX}px`,
        '--fx-y0': `${fl.fromY}px`,
        '--fx-dx': `${fl.toX - fl.fromX}px`,
        '--fx-dy': `${fl.toY - fl.fromY}px`
      }"
    >
      <div class="flight-arc-y">
        <div class="flight-chip">
          <span class="fc-art">
            <ArtSprite
              :id="fl.itemId"
              :kind="fl.kind"
              :alt="fl.label || ''"
            />
          </span>
          <span
            v-if="fl.label"
            class="fc-label"
          >{{ fl.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flight-fx-layer {
  position: fixed;
  inset: 0;
  z-index: 120;
  pointer-events: none;
  overflow: hidden;
}

.flight-node {
  position: fixed;
  left: 0;
  top: 0;
  transform: translate3d(var(--fx-x0), var(--fx-y0), 0);
  animation: flightMoveX 0.56s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.flight-arc-y {
  animation: flightArcY 0.56s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.flight-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px 5px 6px;
  border-radius: 999px;
  background: rgba(253, 247, 234, 0.96);
  box-shadow: 0 10px 24px rgba(56, 34, 14, 0.28), 0 0 0 1.5px rgba(212, 162, 78, 0.65);
  transform: translate(-50%, -50%);
}

.fc-art {
  width: 24px;
  height: 24px;
  display: inline-flex;
}

.fc-label {
  font-family: var(--font-hand);
  font-size: 12px;
  color: var(--wood-deep);
  white-space: nowrap;
}

@keyframes flightMoveX {
  0% {
    transform: translate3d(var(--fx-x0), var(--fx-y0), 0) scale(0.92);
    opacity: 0.95;
  }
  85% {
    opacity: 1;
  }
  100% {
    transform: translate3d(calc(var(--fx-x0) + var(--fx-dx)), calc(var(--fx-y0) + var(--fx-dy)), 0) scale(0.62);
    opacity: 0;
  }
}

@keyframes flightArcY {
  0% {
    transform: translate3d(0, 0, 0);
  }
  42% {
    transform: translate3d(0, -48px, 0) scale(1.08);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(0.85);
  }
}
</style>
