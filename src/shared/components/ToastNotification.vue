<template>
  <div
    v-if="toasts.length > 0"
    class="toast-container"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-item"
      :class="toast.type"
    >
      <span class="toast-icon">{{ typeIcons[toast.type] }}</span>
      <span class="toast-message">{{ toast.message }}</span>
    </div>
  </div>
</template>

<script>
import { reactive } from 'vue';

/**
 * 共享 Toast 通知 — 各游戏共用的全局提示条。
 *
 * 用法：任意模块 import { showToast } 即可弹出提示（模块级单例队列），
 * 在 App 根组件挂一次 <ToastNotification /> 负责渲染。
 *
 * 主题：通过 CSS 变量接入各游戏配色（--toast-* 优先，回退到 --paper-bg/--ink-*
 * 间谍电报风变量），无需修改组件本身。
 */

const typeIcons = {
  info: '·',
  error: '!',
  warning: '!',
  success: '=',
};

const toasts = reactive([]);
let toastId = 0;

export function showToast(message, type = 'info') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id);
    if (idx !== -1) toasts.splice(idx, 1);
  }, 3000);
}

export default {
  name: 'ToastNotification',
  setup() {
    return { toasts, typeIcons };
  },
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1.2rem;
  border: 2px solid;
  font-family: var(--typewriter, 'Courier New', monospace);
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--toast-bg, var(--paper-bg, #fffdf8));
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.15);
  animation: toast-slide-in 0.3s ease-out;
  pointer-events: auto;
  white-space: nowrap;
}

.toast-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

/* Type styles */
.toast-item.info {
  border-color: var(--toast-info, var(--ink-blue, #34618f));
  color: var(--toast-info, var(--ink-blue, #34618f));
}

.toast-item.info .toast-icon {
  background: var(--toast-info, var(--ink-blue, #34618f));
  color: var(--toast-bg, var(--paper-bg, #fffdf8));
}

.toast-item.error {
  border-color: var(--toast-error, var(--ink-red, #c0392b));
  color: var(--toast-error, var(--ink-red, #c0392b));
}

.toast-item.error .toast-icon {
  background: var(--toast-error, var(--ink-red, #c0392b));
  color: var(--toast-bg, var(--paper-bg, #fffdf8));
}

.toast-item.warning {
  border-color: var(--toast-warning, var(--ink-brown, #8a6d3b));
  color: var(--toast-warning, var(--ink-brown, #8a6d3b));
}

.toast-item.warning .toast-icon {
  background: var(--toast-warning, var(--ink-brown, #8a6d3b));
  color: var(--toast-bg, var(--paper-bg, #fffdf8));
}

.toast-item.success {
  border-color: var(--toast-success, var(--ink-green, #2e7d32));
  color: var(--toast-success, var(--ink-green, #2e7d32));
}

.toast-item.success .toast-icon {
  background: var(--toast-success, var(--ink-green, #2e7d32));
  color: var(--toast-bg, var(--paper-bg, #fffdf8));
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
