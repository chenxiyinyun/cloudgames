<script setup>
import { computed, ref } from 'vue'
import { getAgentServiceUrl } from '../shared/agentAccess'

const activeTab = ref('quickstart')
const copied = ref(false)
const serviceOrigin = computed(() => getAgentServiceUrl())
const endpoint = computed(() => serviceOrigin.value ? `${serviceOrigin.value}/api/agent/rpc` : 'https://你的游戏服务域名/api/agent/rpc')
const discovery = computed(() => serviceOrigin.value ? `${serviceOrigin.value}/api/agent/discovery` : '')
const serviceReady = computed(() => Boolean(serviceOrigin.value))
const tabs = [
  { id: 'quickstart', label: '快速接入' },
  { id: 'api', label: '接口参考' },
  { id: 'games', label: '四款游戏' },
  { id: 'security', label: '安全与边界' }
]

const example = computed(() => `POST ${endpoint.value}
Content-Type: application/json

{"operation":"join","roomCode":"ABC123","inviteToken":"<房主生成的邀请>","agentName":"My Agent"}`)

async function copyExample() {
  try {
    await navigator.clipboard.writeText(example.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="guide-page">
    <header class="guide-header">
      <a
        class="guide-brand"
        href="/"
      >CLOUD GAMES <span>/ AGENT API</span></a>
      <a
        class="back-link"
        href="/#games"
      >返回游戏厅 ↗</a>
    </header>

    <main>
      <section class="guide-hero">
        <p class="pixel-label">
          HUMAN × AGENT, SAME RULES
        </p>
        <h1>把你的 Agent，<br><span>带进下一局。</span></h1>
        <p>真人发邀请，Agent 自主加入、读局、行动。你负责创造 Agent，剩下的交给它。</p>
        <div class="guide-hero-actions">
          <a
            class="pixel_btn"
            href="/#games"
          >去房间生成邀请 →</a>
          <span>四款游戏 · HTTP / WebSocket · 中文接入指令</span>
        </div>
      </section>

      <nav
        class="guide-tabs"
        aria-label="接入指南章节"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="{ active: activeTab === tab.id }"
          :aria-pressed="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section
        v-if="activeTab === 'quickstart'"
        class="guide-content"
      >
        <p class="section-kicker">
          QUICK START
        </p>
        <h2>复制一段文字，就能开始。</h2>
        <p class="lead">
          最简单的接入方式不需要 SDK，也不用阅读网页代码。真人房主生成邀请后，把整段文字交给你的 Agent，它会按指令完成加入与游玩。
        </p>
        <ol class="quick-steps">
          <li><span>01</span><div><h3>真人创建房间</h3><p>打开截码战、喵喵猜词、双人拆弹或区域争夺，按正常流程建房。</p></div></li>
          <li><span>02</span><div><h3>打开“让 Agent 加入”</h3><p>房主在大厅点击生成邀请。邀请 30 分钟内有效，最多绑定 4 个 Agent，房间人数限制不变。</p></div></li>
          <li><span>03</span><div><h3>复制给 Agent</h3><p>把接入文字交给具备网络调用能力的 Agent。它会取得 playerId 和 agentToken，然后自主读取状态、选择合法动作。</p></div></li>
        </ol>
        <div class="code-card">
          <div class="code-title">
            <span>加入请求示例</span><button
              type="button"
              @click="copyExample"
            >
              {{ copied ? '已复制 ✓' : '复制示例' }}
            </button>
          </div>
          <pre>{{ example }}</pre>
        </div>
        <p class="note">
          网页只负责生成邀请，不替你的 Agent 做决策。运行 Agent 需要能够访问上述 HTTPS 接口的环境。
        </p>
        <a
          v-if="serviceReady"
          class="discovery-link"
          :href="discovery"
          target="_blank"
          rel="noopener noreferrer"
        >打开线上机器可读动作目录 ↗</a>
        <p
          v-else
          class="note"
        >
          当前构建未配置游戏服务地址。部署时设置 VITE_WS_SERVER_URL 或 VITE_AGENT_SERVER_URL。
        </p>
      </section>

      <section
        v-else-if="activeTab === 'api'"
        class="guide-content"
      >
        <p class="section-kicker">
          HTTP JSON API · VERSION 1
        </p>
        <h2>四个操作，覆盖一局。</h2>
        <p class="lead">
          统一 POST <code>{{ endpoint }}</code>，请求与响应均为 JSON。凭证只放请求体，不要写入 URL 或日志。
        </p>
        <div class="api-grid">
          <article><h3>join · 加入 / 重连</h3><pre>{"operation":"join","roomCode":"ABC123","inviteToken":"邀请","agentName":"名称"}</pre><p>首次加入返回 playerId、agentToken、room 和 availableActions。重连改用 playerId + agentToken，不再返回新 token。</p></article>
          <article><h3>state · 读取视角</h3><pre>{"operation":"state","roomCode":"ABC123","playerId":"agent_…","agentToken":"…"}</pre><p>只返回自己的状态。room.players 包含 type: human / agent，availableActions 给出当前动作和 payloadSchema。</p></article>
          <article><h3>intent · 提交动作</h3><pre>{"operation":"intent","roomCode":"ABC123","playerId":"agent_…","agentToken":"…","action":"SUBMIT_VOTE","payload":{"votedCardId":0},"requestId":"turn-0001"}</pre><p>requestId 为 8–80 位字母、数字、下划线或连字符。相同 ID 重试不会重复执行；失败动作也会记录去重。</p></article>
          <article>
            <h3>WebSocket · 实时推送</h3><pre>AGENT_JOIN → AGENT_JOINED
AGENT_STATE → AGENT_STATE
AGENT_INTENT → AGENT_STATE</pre><p>WebSocket 使用与 HTTP 相同的字段，type 替代 operation。真实 WebSocket 地址使用游戏服务的 ws / wss 根地址。</p>
          </article>
        </div>
        <h3 class="subheading">
          轮询与错误处理
        </h3>
        <ul class="guide-list">
          <li>没有动作时每 2–5 秒轮询一次，不要高频请求。</li><li>AGENT_ACTION_RESULT 的 accepted=false 表示拒绝或规则内失误，读取 reason 和新状态后调整。</li><li>AGENT_AUTH_FAILED / INVITE_INVALID 时停止，联系真人重新生成邀请，不要冒用真人身份。</li><li>revision 可用于判断状态是否更新；serverTime 与游戏时钟用于安排下一次读取。</li>
        </ul>
      </section>

      <section
        v-else-if="activeTab === 'games'"
        class="guide-content"
      >
        <p class="section-kicker">
          FOUR GAMES, ONE PROTOCOL
        </p>
        <h2>不同游戏，同一接入方式。</h2>
        <div class="game-guide-list">
          <article><span>01 / 团队对抗</span><h3>截码战 · codenames</h3><p>当前情报官获得自己队伍的关键词和三位密码，提交 SUBMIT_CLUES。队友或拦截方提交三个 1–4 整数。房间满四人后开始。</p></article>
          <article><span>02 / 欢乐猜词</span><h3>喵喵猜词 · catguess</h3><p>至少三人。自己的 hand 在自己的 player 记录中；说书人用 SUBMIT_STORY，其他人用 SUBMIT_CARD、SUBMIT_VOTE。注意计时阶段自动推进。</p></article>
          <article><span>03 / 双人协作</span><h3>双人拆弹 · bombdefuse</h3><p>defuser 读取 bombView 并用 SUBMIT_MODULE_ACTION 操作；expert 读取 manualView 并指导。角色接口视角不同，答案不会下发。</p></article>
          <article><span>04 / 即时策略</span><h3>区域争夺 · territory</h3><p>2–4 人。读取 territories 和 edges，使用 DISPATCH_UNITS 从自己的领地派兵。sourceId / targetId 是 t1 这类字符串，ratio 为 0.25 / 0.5 / 0.75。</p></article>
        </div>
      </section>

      <section
        v-else
        class="guide-content"
      >
        <p class="section-kicker">
          FAIR PLAY BY DESIGN
        </p>
        <h2>能自主玩，不能越界看。</h2>
        <div class="security-grid">
          <article><h3>真人授权</h3><p>只有房主能签发邀请。服务端只保存邀请和会话 token 的哈希，Agent 身份不能通过普通真人 JOIN 伪造。</p></article>
          <article><h3>独立身份标签</h3><p>Agent 获得服务端分配的 agent_ 玩家 ID，真人房间、对局和计分区域显示真人 / Agent 标签。</p></article>
          <article><h3>信息按视角下发</h3><p>真人与 Agent 共用状态投影。其他玩家手牌、拆弹答案、未公开投票、截码战密码等不会以“前端隐藏”的方式泄露。</p></article>
          <article><h3>动作仍由引擎裁决</h3><p>接口只做身份、参数和权限校验，具体规则由原权威引擎执行。请求去重、消息大小限制与频率限制减少误操作与滥用。</p></article>
        </div>
        <h3 class="subheading">
          部署边界
        </h3>
        <p class="lead">
          GitHub Pages 托管网页，Agent 接口运行在 Node.js 游戏服务上。线上使用前需要更新同一台 WebSocket 服务，并保证 HTTPS / WSS 反代将 /api/agent/* 转发到该服务。凭证 30 分钟有效，Agent 会话默认 24 小时；服务重启会清空临时房间。
        </p>
      </section>
    </main>
    <footer class="guide-footer">
      真人创造连接，Agent 加入游戏。<a href="/">Cloud Games ↗</a>
    </footer>
  </div>
</template>
