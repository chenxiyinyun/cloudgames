<template>
  <main class="screen lobby-screen">
    <header class="top-bar">
      <div>
        <p class="eyebrow">
          部署战场
        </p>
        <h1>房间号</h1>
        <div
          v-if="isHost"
          class="room-code-block"
        >
          <code class="room-code">{{ roomCode }}</code>
          <button
            class="ghost-button room-code-copy"
            type="button"
            @click="copyRoomCode"
          >
            {{ copyButtonText }}
          </button>
        </div>
        <p
          v-else
          class="hint"
        >
          等待房主开始 — 房间号 <code class="room-code-inline">{{ roomCode }}</code>
        </p>
        <p
          v-if="isHost"
          class="hint"
        >
          把房间号发给朋友,2-4 人加入后开始
        </p>
      </div>
      <button
        class="ghost-button"
        type="button"
        @click="$emit('leave-room')"
      >
        离开
      </button>
    </header>

    <section class="lobby-grid">
      <article class="panel">
        <h2>玩家</h2>
        <div class="player-list">
          <div
            v-for="player in room.players"
            :key="player.id"
            class="player-row"
          >
            <span
              class="swatch"
              :style="{ background: player.color }"
            />
            <span>{{ player.name }}</span>
            <strong>{{ player.isHost ? '房主' : '参战' }}</strong>
          </div>
        </div>
      </article>

      <article class="panel">
        <h2>地图尺寸</h2>
        <div class="segmented">
          <button
            v-for="option in sizeOptions"
            :key="option.value"
            type="button"
            :class="{ active: room.settings?.mapSize === option.value }"
            :disabled="!isHost"
            @click="$emit('set-map-size', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="hint">
          {{ sizeHint }}
        </p>

        <h2 style="margin-top: 18px;">主题风格</h2>
        <div class="segmented">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            :class="{ active: room.settings?.theme === option.value }"
            :disabled="!isHost"
            @click="$emit('set-theme', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="hint">
          {{ themeHint }}
        </p>

        <button
          class="primary-button full"
          type="button"
          :disabled="!isHost || room.players.length < 2"
          @click="$emit('start-game')"
        >
          开始占领
        </button>
        <p
          v-if="error"
          class="error-line"
        >
          {{ error }}
        </p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  roomCode: {
    type: String,
    required: true
  },
  isHost: Boolean,
  error: {
    type: String,
    default: null
  }
})

defineEmits(['set-map-size', 'set-theme', 'start-game', 'leave-room'])

const sizeOptions = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' }
]

const themeOptions = [
  { value: 'default', label: '经典' },
  { value: 'catpaw', label: '猫爪' }
]

const sizeHint = computed(() => {
  const copy = {
    small: '10 块领地，节奏最快',
    medium: '16 块领地，标准战场',
    large: '24 块领地，适合 3-4 人'
  }
  return copy[props.room.settings?.mapSize || 'medium']
})

const themeHint = computed(() => {
  const copy = {
    default: '经典战场风格',
    catpaw: '可爱猫爪圈圈'
  }
  return copy[props.room.settings?.theme || 'default']
})

// 复制按钮文案 2s 内切回 "复制",给玩家反馈成功
const copyButtonText = ref('复制')
let copyResetTimer = null
async function copyRoomCode() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.roomCode)
    } else {
      // 后备方案:旧浏览器或非安全上下文
      const input = document.createElement('input')
      input.value = props.roomCode
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    copyButtonText.value = '已复制 ✓'
  } catch {
    copyButtonText.value = '复制失败,请手动选择'
  }
  if (copyResetTimer) clearTimeout(copyResetTimer)
  copyResetTimer = setTimeout(() => {
    copyButtonText.value = '复制'
    copyResetTimer = null
  }, 2000)
}
</script>
