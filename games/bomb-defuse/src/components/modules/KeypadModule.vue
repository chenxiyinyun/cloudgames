<template>
  <article
    class="module-tile keypad-module"
    :class="{ solved: module.status === 'solved' }"
  >
    <header>
      <h2>键盘</h2>
      <span class="display-readout">{{ module.bombView.display }}</span>
    </header>
    <div class="keypad-grid">
      <button
        v-for="key in module.bombView.keys"
        :key="key.id"
        class="key-button"
        type="button"
        :disabled="module.status === 'solved'"
        @click="pressKey(key.id)"
      >
        {{ key.label }}
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

function pressKey(keyId) {
  emit('module-action', {
    moduleId: props.module.id,
    action: {
      type: 'press_key',
      keyId
    }
  })
}
</script>
