<template>
  <div
    v-if="visible"
    class="rules-overlay"
    @click.self="$emit('close')"
  >
    <div class="rules-modal">
      <button
        class="rules-close"
        @click="$emit('close')"
      >
        ✕
      </button>
      <h2 class="rules-title">
        ⚫ 五子棋
      </h2>
      <p class="rules-subtitle">
        游戏规则简介
      </p>

      <div class="rules-section">
        <h3>🎯 目标</h3>
        <p>在 15×15 的棋盘上，先将 <strong>5 颗棋子</strong>连成一线（横、竖、斜均可）者获胜。</p>
      </div>

      <div class="rules-section">
        <h3>⚫⚪ 先后手</h3>
        <p>房主执 <strong>黑棋</strong>先行，对手执 <strong>白棋</strong>。每局结束后再来一局会自动交换先后手。</p>
      </div>

      <div class="rules-section">
        <h3>⏱ 回合计时</h3>
        <p>每手限时 <strong>60 秒</strong>。超时未落子判负，对手直接获胜。</p>
      </div>

      <div class="rules-section">
        <h3>🏳 认输与结束</h3>
        <p>对局中可随时认输；房主也可以提前结束对局。棋盘下满仍无人获胜则为平局。</p>
      </div>

      <button
        class="btn btn-primary rules-got-it"
        @click="$emit('close')"
      >
        <span>知道了！</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
});

defineEmits(['close']);
</script>

<style scoped>
.rules-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.rules-modal {
  background: var(--paper-bg);
  border: 3px solid var(--telegram-border);
  padding: 32px 28px;
  max-width: 480px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.rules-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: 2px solid var(--telegram-border);
  font-size: 16px;
  cursor: pointer;
  color: var(--ink-brown);
  padding: 2px 8px;
  transition: all 0.2s;
}

.rules-close:hover {
  background: var(--ink-red);
  color: var(--paper-bg);
  border-color: var(--ink-red);
}

.rules-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--ink-black);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.rules-subtitle {
  font-size: 13px;
  color: var(--ink-brown);
  margin-bottom: 20px;
}

.rules-section {
  margin-bottom: 16px;
}

.rules-section h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-black);
  margin-bottom: 6px;
}

.rules-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-black);
}

.rules-got-it {
  margin-top: 8px;
  width: 100%;
}
</style>
