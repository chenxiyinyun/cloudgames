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
  font-family: var(--typewriter);
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--paper-bg);
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
  font-family: var(--typewriter);
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

/* Type styles */
.toast-item.info {
  border-color: var(--ink-blue);
  color: var(--ink-blue);
}

.toast-item.info .toast-icon {
  background: var(--ink-blue);
  color: var(--paper-bg);
}

.toast-item.error {
  border-color: var(--ink-red);
  color: var(--ink-red);
}

.toast-item.error .toast-icon {
  background: var(--ink-red);
  color: var(--paper-bg);
}

.toast-item.warning {
  border-color: var(--ink-brown);
  color: var(--ink-brown);
}

.toast-item.warning .toast-icon {
  background: var(--ink-brown);
  color: var(--paper-bg);
}

.toast-item.success {
  border-color: var(--ink-green);
  color: var(--ink-green);
}

.toast-item.success .toast-icon {
  background: var(--ink-green);
  color: var(--paper-bg);
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
