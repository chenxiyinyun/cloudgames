<template>
  <article
    class="module-tile symbols-module"
    :class="{ solved: module.status === 'solved' }"
  >
    <header>
      <h2>符号</h2>
      <button
        class="mini-button"
        type="button"
        :disabled="module.status === 'solved' || selected.length === 0"
        @click="selected = []"
      >
        清除
      </button>
    </header>
    <div class="symbol-grid">
      <button
        v-for="symbol in module.bombView.symbols"
        :key="symbol.id"
        class="symbol-button"
        type="button"
        :disabled="module.status === 'solved' || selected.includes(symbol.id)"
        @click="pressSymbol(symbol.id)"
      >
        <span>{{ symbol.label }}</span>
        <small v-if="selected.includes(symbol.id)">{{ selected.indexOf(symbol.id) + 1 }}</small>
      </button>
    </div>
  </article>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  module: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['module-action'])
const selected = ref([])

function pressSymbol(symbolId) {
  selected.value.push(symbolId)
  if (selected.value.length === props.module.bombView.symbols.length) {
    emit('module-action', {
      moduleId: props.module.id,
      action: {
        type: 'press_symbols',
        symbolIds: [...selected.value]
      }
    })
    selected.value = []
  }
}
</script>
