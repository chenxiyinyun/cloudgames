<script setup>
const props = defineProps({
  type: {
    type: String,
    default: 'human'
  },
  compact: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <span
    class="participant-tag"
    :class="props.type === 'agent' ? 'agent' : 'human'"
    :title="props.type === 'agent' ? '由玩家授权的 Agent 通过接口加入' : '真人玩家'"
    :aria-label="props.type === 'agent' ? 'Agent 玩家' : '真人玩家'"
  >
    <svg
      v-if="props.type === 'agent'"
      viewBox="0 0 16 16"
      aria-hidden="true"
    ><path d="M8 1v3M4 5h8a2 2 0 0 1 2 2v5H2V7a2 2 0 0 1 2-2ZM1 8v2m14-2v2M5 8h1m4 0h1M6 11h4M5 15h6" /></svg>
    <svg
      v-else
      viewBox="0 0 16 16"
      aria-hidden="true"
    ><circle
      cx="8"
      cy="4"
      r="2.5"
    /><path d="M3 14v-2a5 5 0 0 1 10 0v2" /></svg>
    {{ props.compact && props.type === 'agent' ? 'AGENT' : props.type === 'agent' ? 'Agent' : '真人' }}
  </span>
</template>

<style scoped>
.participant-tag {
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .04em;
  line-height: 1.3;
  white-space: nowrap;
}

.agent {
  color: #075985;
  background: #e0f2fe;
}

.human {
  color: #4b5563;
  background: #f3f4f6;
}

svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.25;
}
</style>
