<template>
  <main class="screen menu-screen">
    <section class="mission-brief">
      <p class="eyebrow">
        Two-player online puzzle
      </p>
      <h1>双人拆弹</h1>
      <p class="brief-copy">
        一人面对炸弹模块，一人翻阅说明书。倒计时开始后，只能靠沟通完成拆解。
      </p>
    </section>

    <section
      class="command-panel"
      aria-label="创建或加入任务"
    >
      <label class="field">
        <span>玩家代号</span>
        <input
          v-model="playerName"
          maxlength="16"
          placeholder="例如：拆弹员 A"
        >
      </label>

      <div class="action-row">
        <button
          class="primary-button"
          type="button"
          @click="$emit('create-room', playerName)"
        >
          创建任务
        </button>
      </div>

      <div class="divider">
        或
      </div>

      <label class="field">
        <span>任务代码</span>
        <input
          v-model="roomCode"
          class="code-input"
          maxlength="6"
          placeholder="ABCD"
          @input="roomCode = roomCode.toUpperCase()"
        >
      </label>

      <button
        class="secondary-button"
        type="button"
        @click="$emit('join-room', { playerName, code: roomCode })"
      >
        加入任务
      </button>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'

defineEmits(['create-room', 'join-room'])

const playerName = ref('')
const roomCode = ref('')
</script>
