<template>
  <article
    class="module-tile password-module"
    :class="{ solved: module.status === 'solved' }"
  >
    <header>
      <h2>密码</h2>
      <span class="display-readout">{{ currentWord }}</span>
    </header>
    <div class="password-body">
      <div class="password-grid">
        <div
          v-for="(column, index) in module.bombView.columns"
          :key="column.id"
          class="password-column"
        >
          <button
            class="password-step"
            type="button"
            :disabled="module.status === 'solved'"
            aria-label="上一个字母"
            @click="cycle(index, -1)"
          >
            ▲
          </button>
          <span class="password-letter">{{ column.letters[indices[index]] }}</span>
          <button
            class="password-step"
            type="button"
            :disabled="module.status === 'solved'"
            aria-label="下一个字母"
            @click="cycle(index, 1)"
          >
            ▼
          </button>
        </div>
      </div>
      <button
        class="mini-button password-submit"
        type="button"
        :disabled="module.status === 'solved'"
        @click="submit"
      >
        提交密码
      </button>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  module: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['module-action'])

const indices = ref(props.module.bombView.columns.map(() => 0))

const currentWord = computed(() =>
  props.module.bombView.columns
    .map((column, index) => column.letters[indices.value[index]])
    .join('')
)

function cycle(columnIndex, direction) {
  const size = props.module.bombView.columns[columnIndex].letters.length
  indices.value[columnIndex] = (indices.value[columnIndex] + direction + size) % size
}

function submit() {
  emit('module-action', {
    moduleId: props.module.id,
    action: {
      type: 'enter_password',
      word: currentWord.value
    }
  })
}
</script>
