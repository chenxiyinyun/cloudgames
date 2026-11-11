<script setup>
import { computed, ref, watch } from 'vue'
import { getAgentServiceUrl, getAgentWebSocketUrl } from '../agentAccess'

const props = defineProps({
  gameId: { type: String, required: true },
  roomCode: { type: String, required: true },
  isHost: { type: Boolean, required: true },
  connected: { type: Boolean, default: false },
  invite: { type: Object, default: null },
  expanded: { type: Boolean, default: false }
})

const emit = defineEmits(['request-invite'])

const open = ref(props.expanded)
watch(() => props.expanded, value => { open.value = value })
const generating = ref(false)
const generatedInvite = ref(null)
const error = ref('')
const copied = ref(false)
let copyTimer = null
let generateTimer = null

const gameNames = {
  codenames: '截码战',
  catguess: '喵喵猜词',
  bombdefuse: '双人拆弹',
  territory: '区域争夺'
}

const activeInvite = computed(() => {
  if (!generatedInvite.value) return null
  const serviceUrl = getAgentServiceUrl()
  return serviceUrl ? { ...generatedInvite.value, serviceUrl } : null
})

const endpoint = computed(() => activeInvite.value ? `${activeInvite.value.serviceUrl}/api/agent/rpc` : '')
const discoveryUrl = computed(() => activeInvite.value ? `${activeInvite.value.serviceUrl}/api/agent/discovery` : '')

const instruction = computed(() => {
  if (!activeInvite.value) return ''
  return `你是一个游戏 Agent。请自主加入 Cloud Games 的「${gameNames[props.gameId]}」对局，并根据游戏状态持续做出合法行动，直到本局结束。不要假装已经加入，必须实际调用接口确认 AGENT_JOINED。

房间：${props.roomCode}
游戏 ID：${props.gameId}
HTTP 接口：${endpoint.value}
邀请凭证：${activeInvite.value.inviteToken}
凭证有效期：${new Date(activeInvite.value.expiresAt).toLocaleString('zh-CN')}

1. POST 上述接口，Content-Type: application/json，body 为 {"operation":"join","roomCode":"${props.roomCode}","inviteToken":"上述邀请凭证","agentName":"你的 Agent 名称"}。
2. 保存响应中的 playerId 与 agentToken，不要再次使用邀请凭证重复加入。断线后用 {"operation":"join","roomCode":"${props.roomCode}","playerId":"你的 playerId","agentToken":"你的 agentToken"} 重连。
3. 用 {"operation":"state","roomCode":"${props.roomCode}","playerId":"你的 playerId","agentToken":"你的 agentToken"} 获取自己的状态与 availableActions。只依据自己的视角决策，不尝试获取其他玩家私密信息。
4. 从 availableActions 选择动作，POST {"operation":"intent","roomCode":"${props.roomCode}","playerId":"你的 playerId","agentToken":"你的 agentToken","action":"动作名","payload":{},"requestId":"至少 8 位的唯一字符串"}。相同 requestId 重试不会重复行动。
5. 没有可行动作时等待 2–5 秒再获取状态；ACTION_REJECTED 时读取新状态后重新选择；AGENT_ACTION_RESULT 的 accepted=false 表示失败或规则内失误，按 reason 调整；AGENT_AUTH_FAILED 时停止并告知我，不要冒用真人身份。状态中的 availableActions 已包含 payloadSchema。
6. 可使用 WebSocket 替代轮询：连接 ${getAgentWebSocketUrl(activeInvite.value.serviceUrl)} 后发送 type=AGENT_JOIN 的加入消息，再使用 AGENT_STATE / AGENT_INTENT；字段与 HTTP 相同。
7. 请自行推理并完成游戏行动，无需我逐步点击网页。你是房客的 Agent，不要代替真人房主开始游戏，除非该权限明确出现在你的 availableActions 中。`
})

function onInvite(message) {
  clearTimeout(generateTimer)
  generating.value = false
  if (!message || message.gameId !== props.gameId || message.roomCode !== props.roomCode) return
  if (!getAgentServiceUrl()) {
    error.value = '服务端尚未配置 Agent 接入地址，请联系房主部署新版服务。'
    return
  }
  generatedInvite.value = { ...message }
  copied.value = false
  error.value = ''
}

if (props.invite) onInvite(props.invite)

function generate() {
  if (!props.connected) {
    error.value = '连接恢复后才能生成邀请。'
    return
  }
  error.value = ''
  copied.value = false
  generatedInvite.value = null
  generating.value = true
  emit('request-invite')
  clearTimeout(generateTimer)
  generateTimer = setTimeout(() => {
    if (!generating.value) return
    generating.value = false
    error.value = '邀请未返回，请确认游戏服务已更新到支持 Agent 的版本后重试。'
  }, 8000)
}

async function copyInstruction() {
  try {
    await navigator.clipboard.writeText(instruction.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = instruction.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const succeeded = document.execCommand('copy')
    textarea.remove()
    if (!succeeded) {
      error.value = '复制失败，请手动选择下方文字复制。'
      return
    }
  }
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = false }, 2500)
}

function toggle() {
  open.value = !open.value
  emit('toggle', open.value)
}

defineExpose({ open, onInvite })
</script>

<template>
  <section class="agent-access">
    <button
      class="agent-access-trigger"
      type="button"
      :aria-expanded="open"
      aria-controls="agent-access-content"
      @click="toggle"
    >
      <span aria-hidden="true">◇</span>
      让 Agent 加入
      <small>真人 + Agent 对局</small>
      <span aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>
    <div
      v-if="open"
      id="agent-access-content"
      class="agent-access-content"
    >
      <template v-if="isHost">
        <h2>把你的 Agent 带进这局</h2>
        <p>生成一次性邀请，复制给你的 Agent。它会自主加入、读取自己的状态并合法行动；你仍是真人房主。</p>
        <button
          class="agent-generate"
          type="button"
          :disabled="generating || !connected"
          @click="generate"
        >
          {{ generating ? '正在生成…' : activeInvite ? '生成新邀请' : '生成 Agent 邀请' }}
        </button>
        <p
          v-if="error"
          class="agent-error"
          role="alert"
        >
          {{ error }}
        </p>
        <template v-if="activeInvite">
          <p class="agent-invite-note">
            凭证 30 分钟内有效，最多绑定 4 个 Agent（仍受房间人数限制）。只发给你信任的 Agent。
          </p>
          <textarea
            class="agent-instruction"
            :value="instruction"
            aria-label="给 Agent 的完整接入指令"
            readonly
            rows="9"
            @focus="$event.target.select()"
          />
          <button
            class="agent-copy"
            type="button"
            @click="copyInstruction"
          >
            {{ copied ? '已复制接入指令 ✓' : '复制给 Agent' }}
          </button>
          <a
            class="agent-docs-link"
            :href="discoveryUrl"
            target="_blank"
            rel="noopener noreferrer"
          >查看机器可读动作目录 ↗</a>
        </template>
      </template>
      <p v-else>
        想让自己的 Agent 加入？请真人房主在此面板生成专属邀请。玩家列表中的“真人 / Agent”标签由服务端身份决定。
      </p>
    </div>
  </section>
</template>

<style scoped>
.agent-access {
  margin: 16px 0;
  border: 1px solid rgba(7, 89, 133, .35);
  border-radius: 8px;
  background: rgba(224, 242, 254, .8);
  color: #172554;
  text-align: left;
}

.agent-access-trigger {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: #075985;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-align: left;
}

.agent-access-trigger small {
  margin-left: auto;
  color: #374151;
  font-size: 11px;
  font-weight: 400;
}

.agent-access-content {
  padding: 0 16px 16px;
  font-size: 13px;
  line-height: 1.7;
}

.agent-access-content h2 {
  margin-bottom: 6px;
  font-size: 16px;
}

.agent-generate,
.agent-copy {
  min-height: 40px;
  margin-top: 12px;
  padding: 8px 16px;
  border: 1px solid #075985;
  border-radius: 5px;
  background: #075985;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.agent-generate:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.agent-invite-note {
  margin-top: 12px;
  font-size: 12px;
}

.agent-instruction {
  display: block;
  width: 100%;
  min-height: 160px;
  margin-top: 10px;
  padding: 12px;
  resize: vertical;
  border: 1px solid rgba(7, 89, 133, .3);
  border-radius: 5px;
  background: #fff;
  color: #172554;
  font: 12px/1.6 ui-monospace, monospace;
}

.agent-copy {
  display: block;
  width: 100%;
}

.agent-docs-link {
  display: inline-block;
  margin-top: 10px;
  color: #075985;
}

.agent-error {
  margin-top: 8px;
  color: #b91c1c;
}

button:focus-visible,
a:focus-visible,
textarea:focus-visible {
  outline: 3px solid #075985;
  outline-offset: 3px;
}
</style>
