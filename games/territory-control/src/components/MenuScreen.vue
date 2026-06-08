<template>
  <main class="screen menu-screen">
    <section class="command-panel">
      <p class="eyebrow">
        territory control
      </p>
      <h1>区域争夺</h1>
      <form
        class="menu-form"
        @submit.prevent="$emit('create-room', playerName)"
      >
        <label>
          <span>玩家名</span>
          <input
            v-model="playerName"
            maxlength="18"
            autocomplete="nickname"
            placeholder="输入你的代号"
          >
        </label>
        <button
          class="primary-button"
          type="submit"
          :disabled="connecting"
        >
          创建战局
        </button>
      </form>
      <form
        class="menu-form join-form"
        @submit.prevent="$emit('join-room', playerName, roomCode)"
      >
        <label>
          <span>房间号</span>
          <input
            v-model="roomCode"
            maxlength="6"
            placeholder="ABC123"
          >
        </label>
        <button
          class="secondary-button"
          type="submit"
          :disabled="connecting"
        >
          加入战局
        </button>
      </form>
      <button
        v-if="hasRestoreableState"
        class="ghost-button"
        type="button"
        :disabled="connecting"
        @click="$emit('restore-room')"
      >
        恢复上次战局
      </button>
      <p
        v-if="error"
        class="error-line"
      >
        {{ error }}
      </p>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { gameState } from '../stores/state'

defineProps({
  connecting: Boolean,
  error: {
    type: String,
    default: null
  },
  hasRestoreableState: Boolean
})

defineEmits(['create-room', 'join-room', 'restore-room'])

// 从 gameState 读初值:restoreFromCache 后回 menu 时,上次填的 playerName/roomCode
// 仍在 gameState 里,直接用,避免用户重新输入
const playerName = ref(gameState.playerName || '')
const roomCode = ref(gameState.roomCode || '')
</script>
