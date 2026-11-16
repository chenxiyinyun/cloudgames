<script setup>
import { computed, ref } from 'vue';
import {
  beastImgUrl,
  cityImgUrl,
  souvenirImgUrl,
  imageUrl,
  BEAST_SVGS,
  ITEM_SVGS,
  MATERIAL_SVGS,
  SOUVENIR_EXTRA_SVGS,
  CITY_GRADIENTS
} from '../data/artwork.js';

const props = defineProps({
  kind: { type: String, required: true }, // 'beast' | 'item' | 'material' | 'souvenir' | 'city' | 'ui'
  id: { type: String, required: true },
  alt: { type: String, default: '' }
});

const failed = ref(false);

const imgSrc = computed(() => {
  if (failed.value) return null;
  if (props.kind === 'beast') return beastImgUrl(props.id);
  if (props.kind === 'city') return cityImgUrl(props.id);
  if (props.kind === 'souvenir') return souvenirImgUrl(props.id);
  if (props.kind === 'ui') return imageUrl(props.id);
  return null;
});

const svgMarkup = computed(() => {
  if (props.kind === 'beast') return BEAST_SVGS[props.id] || BEAST_SVGS.baize;
  if (props.kind === 'item') return ITEM_SVGS[props.id] || '';
  if (props.kind === 'material') return MATERIAL_SVGS[props.id] || '';
  if (props.kind === 'souvenir') return SOUVENIR_EXTRA_SVGS[props.id] || '';
  return '';
});

const cityGradient = computed(() => CITY_GRADIENTS[props.id] || 'linear-gradient(150deg, #ece2cc, #c7b696)');
</script>

<template>
  <span class="art-sprite">
    <img
      v-if="imgSrc"
      :src="imgSrc"
      :alt="alt"
      class="as-img"
      :class="{ 'as-cover': kind === 'city' || kind === 'ui' }"
      draggable="false"
      @error="failed = true"
    >
    <!-- eslint-disable vue/no-v-html -->
    <span
      v-else-if="svgMarkup"
      class="as-svg"
      aria-hidden="true"
      v-html="svgMarkup"
    />
    <!-- eslint-enable vue/no-v-html -->
    <span
      v-else-if="kind === 'city'"
      class="as-city-fallback"
      :style="{ background: cityGradient }"
    >
      <span>{{ alt || id }}</span>
    </span>
    <span
      v-else
      class="as-glyph"
      aria-hidden="true"
    >✦</span>
  </span>
</template>

<style scoped>
.art-sprite {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  pointer-events: none;
  user-select: none;
}

.as-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.as-img.as-cover {
  object-fit: cover;
}

.as-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.as-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.as-city-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #fffaf0;
  font-family: var(--font-hand);
  font-size: 16px;
  letter-spacing: 3px;
  text-shadow: 0 2px 8px rgba(42, 26, 12, 0.4);
}

.as-glyph {
  font-size: 18px;
  color: var(--wood-dark);
}
</style>
