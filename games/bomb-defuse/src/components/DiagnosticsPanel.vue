<template>
  <details class="diagnostics-panel">
    <summary>连接诊断</summary>
    <dl>
      <div>
        <dt>模式</dt>
        <dd>{{ diagnostics.mode || 'unknown' }}</dd>
      </div>
      <div>
        <dt>TURN</dt>
        <dd>{{ diagnostics.hasTurnRelay ? 'available' : 'not configured' }}</dd>
      </div>
      <div>
        <dt>Peers</dt>
        <dd>{{ peerCount }}</dd>
      </div>
    </dl>
  </details>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  diagnostics: {
    type: Object,
    required: true
  }
})

const peerCount = computed(() => Object.keys(props.diagnostics.peers || {}).length)
</script>
