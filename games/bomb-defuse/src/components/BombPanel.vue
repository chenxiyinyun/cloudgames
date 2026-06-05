<template>
  <section class="bomb-layout">
    <article class="bomb-shell">
      <div class="bomb-meta">
        <span class="serial">SN: {{ serialNumber }}</span>
        <span>{{ batteries }} BAT</span>
        <span>{{ indicators.join(' / ') || 'NO IND' }}</span>
      </div>

      <div class="module-grid">
        <WiresModule
          v-for="module in wiresModules"
          :key="module.id"
          :module="module"
          @module-action="$emit('module-action', $event)"
        />
        <SymbolsModule
          v-for="module in symbolsModules"
          :key="module.id"
          :module="module"
          @module-action="$emit('module-action', $event)"
        />
        <KeypadModule
          v-for="module in keypadModules"
          :key="module.id"
          :module="module"
          @module-action="$emit('module-action', $event)"
        />
        <PasswordModule
          v-for="module in passwordModules"
          :key="module.id"
          :module="module"
          @module-action="$emit('module-action', $event)"
        />
        <MazeModule
          v-for="module in mazeModules"
          :key="module.id"
          :module="module"
          @module-action="$emit('module-action', $event)"
        />
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import KeypadModule from './modules/KeypadModule.vue'
import MazeModule from './modules/MazeModule.vue'
import PasswordModule from './modules/PasswordModule.vue'
import SymbolsModule from './modules/SymbolsModule.vue'
import WiresModule from './modules/WiresModule.vue'

const props = defineProps({
  modules: {
    type: Array,
    required: true
  },
  serialNumber: {
    type: String,
    required: true
  },
  batteries: {
    type: Number,
    required: true
  },
  indicators: {
    type: Array,
    default: () => []
  }
})

defineEmits(['module-action'])

const wiresModules = computed(() => props.modules.filter(module => module.type === 'wires'))
const symbolsModules = computed(() => props.modules.filter(module => module.type === 'symbols'))
const keypadModules = computed(() => props.modules.filter(module => module.type === 'keypad'))
const passwordModules = computed(() => props.modules.filter(module => module.type === 'password'))
const mazeModules = computed(() => props.modules.filter(module => module.type === 'maze'))
</script>
