<template>
  <article
    class="module-tile wires-module"
    :class="{ solved: module.status === 'solved' }"
  >
    <header>
      <h2>电线</h2>
      <span>{{ module.status === 'solved' ? 'SOLVED' : 'ARMED' }}</span>
    </header>
    <div class="wire-stack">
      <button
        v-for="wire in module.bombView.wires"
        :key="wire.id"
        class="wire-button"
        :class="`wire-${wire.color}`"
        type="button"
        :disabled="module.status === 'solved'"
        @click="cutWire(wire.id)"
      >
        {{ colorLabel(wire.color) }}
      </button>
    </div>
  </article>
</template>

<script setup>
const props = defineProps({
  module: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['module-action'])

function cutWire(wireId) {
  emit('module-action', {
    moduleId: props.module.id,
    action: {
      type: 'cut_wire',
      wireId
    }
  })
}

function colorLabel(color) {
  return {
    red: '红',
    blue: '蓝',
    yellow: '黄',
    white: '白',
    black: '黑'
  }[color] || color
}
</script>
