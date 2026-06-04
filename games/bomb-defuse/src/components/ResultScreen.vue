<template>
  <main class="screen result-screen">
    <section
      class="result-panel"
      :class="result"
    >
      <p class="eyebrow">
        room {{ roomCode }}
      </p>
      <h1>{{ result === 'solved' ? '炸弹已解除' : '任务失败' }}</h1>
      <p>
        {{ result === 'solved'
          ? '所有模块都已完成。后续任务会接入真实模块验证和倒计时。'
          : '炸弹已爆炸。后续任务会接入错误次数和计时失败条件。' }}
      </p>
      <div class="result-actions">
        <button
          class="primary-button"
          type="button"
          @click="$emit('restart')"
        >
          返回等待室
        </button>
        <button
          class="secondary-button"
          type="button"
          @click="$emit('back-to-menu')"
        >
          回到菜单
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
defineProps({
  result: {
    type: String,
    required: true
  },
  roomCode: {
    type: String,
    required: true
  }
})

defineEmits(['restart', 'back-to-menu'])
</script>
