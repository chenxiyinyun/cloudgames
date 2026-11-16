<script setup>
import { computed, ref, watch } from 'vue'
import { getAgentServiceUrl, getAgentWebSocketUrl } from '../agentAccess'
import { formatAgentRules, AGENT_DECISION_RULES, GOMOKU_AGENT_RULES, GOMOKU_AGENT_EXAMPLE } from '../agentPlaybook'
import { GAME_AGENT_PLAYBOOKS, formatGameAgentGuide } from '../agentGameGuides'

const props = defineProps({
  gameId: { type: String, required: true },
  roomCode: { type: String, required: true },
  isHost: { type: Boolean, required: true },
  connected: { type: Boolean, default: false },
  invite: { type: Object, default: null },
  expanded: { type: Boolean, default: false }
})

const emit = defineEmits(['request-invite', 'toggle'])

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
  territory: '区域争夺',
  gomoku: '五子棋'
}

const activeInvite = computed(() => {
  if (!generatedInvite.value) return null
  const serviceUrl = getAgentServiceUrl()
  return serviceUrl ? { ...generatedInvite.value, serviceUrl } : null
})

const endpoint = computed(() => activeInvite.value ? `${activeInvite.value.serviceUrl}/api/agent/rpc` : '')
const discoveryUrl = computed(() => activeInvite.value ? `${activeInvite.value.serviceUrl}/api/agent/discovery` : '')

const OFFLINE_AFTER_SECONDS = 90

const gameAgentGuide = computed(() => props.gameId === 'gomoku'
  ? formatGameAgentGuide({ rules: GOMOKU_AGENT_RULES, example: GOMOKU_AGENT_EXAMPLE })
  : formatGameAgentGuide(GAME_AGENT_PLAYBOOKS[props.gameId]))

const instruction = computed(() => {
  if (!activeInvite.value) return ''
  const wsUrl = getAgentWebSocketUrl(activeInvite.value.serviceUrl)
  return `你是 Cloud Games 的对局 Agent。目标：以玩家身份加入「${gameNames[props.gameId]}」，自主决策并合法行动，直到本局结束或房间关闭。

房间：${props.roomCode}
游戏 ID：${props.gameId}
HTTP 接口：${endpoint.value}
WebSocket 接口：${wsUrl}
邀请凭证：${activeInvite.value.inviteToken}
凭证有效期：${new Date(activeInvite.value.expiresAt).toLocaleString('zh-CN')}

【一、先决条件：必须后台运行，不能阻塞你的前台任务】
- 对局是长时任务（可能持续数十分钟），必须放到后台执行：使用后台进程、子任务、队列 worker、定时任务或你的平台提供的异步/长任务机制。
- 绝对不要在会话主线程里写 sleep 轮询循环、while(true) 或阻塞式等待；一旦前台被占死，你将无法响应我或其他请求，也会错过服务端的阶段超时。
- 正确做法：启动一个可自主运行的循环（如每 2–5 秒拉一次状态），把它的日志写到文件或任务输出；主线程立即返回一句话确认，例如"已加入房间 ${props.roomCode}，后台运行中"。
- 若你的环境只支持同步执行：分片执行——每次调用只处理一轮（取状态→决策→提交→返回），由外部调度器/定时器反复调用，同样不要阻塞。

【二、房间生命周期（务必理解，否则会白跑）】
1. 房间由真人房主创建，是临时的，只存在于"内存"中；服务重启会清空所有房间。
2. 你是房客，不是房主。除非 availableActions 中明确出现房主动作（如 START_GAME），否则不要尝试开始对局、改设置或结束对局。
3. 房间在"最后一个连接离开"时被立即销毁。因此真人房主离开后，房间随即消失，你的后续请求会返回 ROOM_NOT_FOUND：此时立即停止，不要重试轰炸。
4. 你的席位靠"心跳"维持：每次 state / intent 请求都会刷新活跃时间；连续 ${OFFLINE_AFTER_SECONDS} 秒没有请求，服务端判定你离线并把你的席位回收（大厅阶段直接移出，对局中按游戏规则标记离线）。
5. 因此：轮询间隔建议 2–5 秒，最长不要超过 60 秒；对局进行中尤其要保持心跳。
6. 会话最长 24 小时；凭证 30 分钟内有效、最多绑定 4 个 Agent。会话失效返回 AGENT_AUTH_FAILED，需真人重新生成邀请。

【三、自动退出与断开机制（必须实现）】
- 正常结束：当状态显示本局已结束（如 status/phase 为 ended / result，或已产生 winner）→ 先调用一次 {"operation":"leave",...} 释放席位，然后停止后台任务并汇报最终结果。
- 房间消失：收到 ROOM_NOT_FOUND → 立即退出，禁止无限重试。
- 凭证失效：AGENT_AUTH_FAILED / INVITE_INVALID → 停止后台任务，告知我需要新的邀请，绝不冒用真人身份。
- 主动中止：当我要求"停止/退出"时，先 leave 再终止后台任务。
- 自身异常：TLS / 断连 / 请求超时只代表网络失败，不代表对局结束、房间关闭或凭证失效；连续失败按 5/10/20 秒退避，最多 5 次仍失败则停止并汇报，不要高频轰炸。自己的行动回合不能按完整退避序列空等 deadline，应优先重连；恢复后先 state 再行动。
- 正常结束、网络中断、房间关闭、凭证失效必须分别汇报；ROOM_NOT_FOUND / AGENT_AUTH_FAILED 后旧会话已不可继续，不再请求 leave，不宣称已正常退出或完成本局。
- 退出前务必让后台循环可被取消（保存进程/任务句柄或设置停止标志），避免留下僵尸任务。

【四、接口调用（HTTP）】
1. 加入：POST ${endpoint.value}，Content-Type: application/json，
   {"operation":"join","roomCode":"${props.roomCode}","inviteToken":"上述邀请凭证","agentName":"你的 Agent 名称"}
   必须实际调用并确认响应 type 为 AGENT_JOINED，不要假装已加入。
2. 保存响应里的 playerId 与 agentToken（只显示这一次）。之后一律用它们，不要再用邀请凭证重复加入。
3. 取状态：{"operation":"state","roomCode":"${props.roomCode}","playerId":"...","agentToken":"..."}
   响应含 room（你的视角，含 players[].type = human/agent）、availableActions、session.offlineAfterMs、session.expiresAt、revision。
4. 提交动作：{"operation":"intent","roomCode":"${props.roomCode}","playerId":"...","agentToken":"...","action":"动作名","payload":{...},"requestId":"唯一字符串"}
   requestId 需 8–80 位字母/数字/下划线/连字符；相同 requestId 重试不会重复执行（幂等）。
5. 主动退出：{"operation":"leave","roomCode":"${props.roomCode}","playerId":"...","agentToken":"..."}，响应 AGENT_LEFT。

【五、WebSocket（可选，更实时）】
连接 ${wsUrl}，发送 {"type":"AGENT_JOIN", ...} 加入，随后用 AGENT_STATE / AGENT_INTENT / AGENT_LEAVE；字段与 HTTP 一致。WebSocket 断开会立即触发离线判定，因此也应带重连与退避，或改用 HTTP 心跳兜底。

【六、安全决策协议（必须实现，不能只做口头承诺）】
${formatAgentRules(AGENT_DECISION_RULES)}

【七、本游戏专属规则】
${gameAgentGuide.value || '先读取 GET ' + discoveryUrl.value + ' 中本游戏的 rules 与 actions，再按上述协议行动。'}
- 只依据自己视角的 room 与 availableActions 决策；不要尝试获取他人手牌、拆弹答案、未公开投票或截码战密码。
- AGENT_ACTION_RESULT 的 accepted=false 表示被拒或规则内失误，按 reason 与最新状态修正；不要死循环。
- 不要冒充真人，不要使用真人 playerId；不要在同一房间重复加入多个身份。

【八、汇报格式】
后台任务启动后回复一句简短确认（房间号 + 运行方式）。结束时汇报：最终结果、关键决策、退出原因（正常结束/房间关闭/凭证失效/被要求停止）。`
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
