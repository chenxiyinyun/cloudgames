<template>
  <main class="screen game-screen">
    <header class="game-header">
      <div>
        <p class="eyebrow">
          room {{ roomCode }}
        </p>
        <h1>{{ currentRole === 'expert' ? '说明书终端' : '炸弹面板' }}</h1>
      </div>
      <div
        class="timer"
        aria-label="倒计时"
      >
        05:00
      </div>
    </header>

    <section class="status-strip">
      <span>错误次数 0 / 3</span>
      <span>{{ currentRole === 'expert' ? '只显示规则' : '只显示模块' }}</span>
      <span>{{ onlineNames }}</span>
    </section>

    <section
      v-if="currentRole === 'expert'"
      class="manual-layout"
    >
      <article class="manual-page">
        <h2>电线模块</h2>
        <ol>
          <li>没有红线时，剪第二根线。</li>
          <li>最后一根是白线且序列号为奇数时，剪最后一根。</li>
          <li>蓝线超过一根时，剪最后一根蓝线。</li>
          <li>其他情况，剪最后一根线。</li>
        </ol>
      </article>
      <article class="manual-page">
        <h2>符号模块</h2>
        <p>找到包含全部四个符号的列，再按说明书从上到下的顺序按下按钮。</p>
      </article>
      <article class="manual-page">
        <h2>密码键盘</h2>
        <p>根据显示屏、按钮标签和炸弹序列号奇偶性，选择唯一正确按钮。</p>
      </article>
    </section>

    <section
      v-else
      class="bomb-layout"
    >
      <article class="bomb-shell">
        <div class="serial">
          SN: VX-2049
        </div>
        <div class="module-grid">
          <button
            class="module-tile wire-tile"
            type="button"
          >
            红 黄 蓝 白
          </button>
          <button
            class="module-tile symbol-tile"
            type="button"
          >
            符号面板
          </button>
          <button
            class="module-tile keypad-tile"
            type="button"
          >
            数字键盘
          </button>
        </div>
      </article>
    </section>

    <footer class="debug-actions">
      <button
        class="secondary-button"
        type="button"
        @click="$emit('solve')"
      >
        模拟解除
      </button>
      <button
        class="danger-button"
        type="button"
        @click="$emit('explode')"
      >
        模拟爆炸
      </button>
      <button
        class="ghost-button"
        type="button"
        @click="$emit('leave-room')"
      >
        离开
      </button>
    </footer>
  </main>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  roomCode: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  currentRole: {
    type: String,
    required: true
  }
})

defineEmits(['solve', 'explode', 'leave-room'])

const onlineNames = computed(() =>
  props.players
    .filter(player => player.isOnline)
    .map(player => player.name)
    .join(' / ')
)
</script>
