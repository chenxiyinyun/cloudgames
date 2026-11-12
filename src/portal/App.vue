<script setup>
import { computed, ref } from 'vue'
import GameArtwork from './GameArtwork.vue'

const filters = [
  { id: 'all', label: '全部游戏' },
  { id: 'coop', label: '默契协作' },
  { id: 'versus', label: '欢乐对抗' }
]

const activeFilter = ref('all')

const games = [
  {
    id: 'codenames',
    name: '截码战',
    englishName: 'Codenames',
    description: '一个词，藏着只有你们懂的暗号。给出巧妙线索，带队友避开对手布下的陷阱。',
    href: 'games/codenames/',
    players: '4 人',
    mode: 'versus',
    modeLabel: '团队对抗',
    tags: ['语言联想', '脑力交锋'],
    color: 'cyan'
  },
  {
    id: 'catguess',
    name: '喵喵猜词',
    englishName: 'Cat Guess',
    description: '让想象力坐上飞船。描述你的画，找出讲故事的人，看看谁最懂你的奇思妙想。',
    href: 'games/catguess/',
    players: '3–6 人',
    mode: 'versus',
    modeLabel: '欢乐猜词',
    tags: ['脑洞表达', '轻松聚会'],
    color: 'pink'
  },
  {
    id: 'bomb-defuse',
    name: '双人拆弹',
    englishName: 'Bomb Defuse',
    description: '一个人面对炸弹，一个人手握手册。保持沟通、拆解模块，在最后一秒拯救彼此。',
    href: 'games/bomb-defuse/',
    players: '2 人',
    mode: 'coop',
    modeLabel: '双人协作',
    tags: ['实时沟通', '紧张解谜'],
    color: 'yellow'
  },
  {
    id: 'territory-control',
    name: '区域争夺',
    englishName: 'Territory Control',
    description: '指尖派兵，步步为营。在不断变化的地图上扩张领地，用策略赢下最后的版图。',
    href: 'games/territory-control/',
    players: '2–4 人',
    mode: 'versus',
    modeLabel: '策略对抗',
    tags: ['即时策略', '地图争夺'],
    color: 'cyan'
  },
  {
    id: 'gomoku',
    name: '五子棋',
    englishName: 'Gomoku',
    description: '一黑一白，一落一子。在纵横棋盘上排兵布阵，先连成五子者赢下这局。',
    href: 'games/gomoku/',
    players: '2 人',
    mode: 'versus',
    modeLabel: '双人对弈',
    tags: ['策略对弈', '烧脑对决'],
    color: 'yellow'
  }
]

const filtersWithCounts = computed(() => filters.map(filter => ({
  ...filter,
  count: filter.id === 'all'
    ? games.length
    : games.filter(game => game.mode === filter.id).length
})))

const filteredGames = computed(() => {
  if (activeFilter.value === 'all') return games
  return games.filter(game => game.mode === activeFilter.value)
})

const filterStatus = computed(() => `已显示 ${filteredGames.value.length} 款游戏`)
</script>

<template>
  <div class="portal">
    <div
      class="pixel-grid"
      aria-hidden="true"
    />
    <div
      class="scanlines"
      aria-hidden="true"
    />

    <header class="site-header">
      <a
        class="brand"
        href="#top"
        aria-label="Cloud Games 返回首页"
      >
        <span
          class="brand-mark"
          aria-hidden="true"
        >
          <svg viewBox="0 0 32 32">
            <path d="M9 7h4V3h6v4h4v4h4v10h-4v4h-4v4h-6v-4H9v-4H5V11h4V7Z" />
            <path
              class="brand-mark-face"
              d="M10 14h3v3h-3zm9 0h3v3h-3zm-7 7h8v2h-8z"
            />
          </svg>
        </span>
        <span class="brand-copy">
          <strong>CLOUD GAMES</strong>
          <small>云游戏合集</small>
        </span>
      </a>
      <nav
        class="site-nav"
        aria-label="主导航"
      >
        <a href="#games">游戏厅</a>
        <a href="#how-to-play">开局指南</a>
        <a href="#agent-access">Agent 接入</a>
        <a
          class="nav-cta"
          href="#games"
        >开始游戏 <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="top">
      <section
        class="hero"
        aria-labelledby="hero-title"
      >
        <div class="hero-copy">
          <p class="pixel-label">
            <span
              class="status-light"
              aria-hidden="true"
            />
            YOUR NEXT GAME NIGHT STARTS HERE
          </p>
          <h1
            id="hero-title"
            class="hero-title"
          >
            今晚，<br>
            一起<span>开玩。</span>
          </h1>
          <p class="hero-description">
            不用下载，不等组队大厅。<br>
            打开浏览器，把好玩的朋友叫到一起。
          </p>
          <div class="hero-actions">
            <a
              class="pixel_btn pixel_btn-primary"
              href="#games"
            >
              选一款开玩
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            </a>
            <a
              class="text-link"
              href="#how-to-play"
            >第一次来？看这里 <span aria-hidden="true">↓</span></a>
          </div>
          <ul class="hero-facts">
            <li>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="m5 12 4 4L19 6" /></svg>
              无需下载
            </li>
            <li>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="m5 12 4 4L19 6" /></svg>
              浏览器即开即玩
            </li>
          </ul>
        </div>

        <div class="hero-scene">
          <span
            class="scene-spark spark-one"
            aria-hidden="true"
          >+</span>
          <span
            class="scene-spark spark-two"
            aria-hidden="true"
          >+</span>
          <div
            class="scene-orbit orbit-one"
            aria-hidden="true"
          />
          <div
            class="scene-orbit orbit-two"
            aria-hidden="true"
          />
          <div class="pixel_box hero-console">
            <div class="console-topline">
              <span>PLAYER SELECT</span>
              <span>01 / 04</span>
            </div>
            <div class="console-screen">
              <GameArtwork
                game="codenames"
                decorative
              />
            </div>
            <div class="console-controls">
              <div
                class="console-dpad"
                aria-hidden="true"
              >
                <span />
              </div>
              <p>
                <span>READY PLAYER ONE</span>
                带上你的默契，准备进入游戏。
              </p>
              <div
                class="console-buttons"
                aria-hidden="true"
              >
                <i /><i />
              </div>
            </div>
          </div>
          <div class="stat_block player-stat">
            <strong>2–4<span>+</span></strong>
            <small>FRIENDS, ONE LINK</small>
          </div>
          <div class="pixel_label scene-tag">
            <span aria-hidden="true">●</span> PARTY MODE: ON
          </div>
        </div>
      </section>

      <section
        id="games"
        class="games-section"
        aria-labelledby="games-title"
      >
        <div class="section-heading">
          <div>
            <p class="section-kicker">
              CHOOSE YOUR NEXT ADVENTURE
            </p>
            <h2 id="games-title">
              总有一款，<span>对味你们。</span>
            </h2>
          </div>
          <p>从默契大考验到脑力大乱斗，<br>今晚的快乐由你们来定义。</p>
        </div>

        <div class="games-toolbar">
          <div
            class="game-filters"
            role="group"
            aria-label="按游戏类型筛选"
          >
            <button
              v-for="filter in filtersWithCounts"
              :key="filter.id"
              class="filter-button"
              :class="{ active: activeFilter === filter.id }"
              type="button"
              :aria-pressed="activeFilter === filter.id"
              @click="activeFilter = filter.id"
            >
              {{ filter.label }}
              <span>{{ filter.count }}</span>
            </button>
          </div>
          <p
            class="filter-status"
            role="status"
            aria-live="polite"
          >
            {{ filterStatus }}
          </p>
        </div>

        <div class="cards">
          <a
            v-for="game in filteredGames"
            :id="game.id"
            :key="game.id"
            :href="game.href"
            class="game-card"
            :class="`card-${game.color}`"
            :aria-label="`进入${game.name}，${game.players}`"
          >
            <div class="card-art">
              <span class="card-number">0{{ games.indexOf(game) + 1 }}</span>
              <GameArtwork
                :game="game.id"
                decorative
              />
              <span class="pixel_label card-mode">真人 / Agent 可同局</span>
              <span class="card-game-mode">{{ game.modeLabel }}</span>
            </div>
            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <p class="card-english">{{ game.englishName }}</p>
                  <h3>{{ game.name }}</h3>
                </div>
                <span
                  class="card-arrow"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14" /></svg>
                </span>
              </div>
              <p class="card-desc">
                {{ game.description }}
              </p>
              <div class="card-footer">
                <span class="player-count">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  ><circle
                    cx="9"
                    cy="8"
                    r="3"
                  /><circle
                    cx="17"
                    cy="9"
                    r="2"
                  /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-7a5 5 0 0 1 5 5v2" /></svg>
                  {{ game.players }}
                </span>
                <span
                  v-for="tag in game.tags"
                  :key="tag"
                  class="card-tag"
                >{{ tag }}</span>
                <span class="play-label">PLAY <span aria-hidden="true">→</span></span>
              </div>
            </div>
          </a>
        </div>
        <p class="keyboard-note">
          <span aria-hidden="true">↹</span> 支持键盘操作 · 按 Tab 选择游戏，Enter 即刻出发
        </p>
      </section>

      <section
        id="how-to-play"
        class="how-to-play"
        aria-labelledby="guide-title"
      >
        <div class="guide-heading">
          <p class="section-kicker">
            ZERO SETUP, MORE FUN
          </p>
          <h2 id="guide-title">
            快乐，不用等。
          </h2>
          <p>三步，把朋友们带进同一局。</p>
        </div>
        <ol class="guide-steps">
          <li class="feature_card">
            <span class="timeline_node">01</span>
            <div>
              <h3>挑一款对味的</h3>
              <p>双人合作或多人对抗，按今晚的心情来选。</p>
            </div>
          </li>
          <li class="feature_card">
            <span class="timeline_node">02</span>
            <div>
              <h3>叫上你的搭子</h3>
              <p>进入游戏创建房间，把房间号分享给朋友。</p>
            </div>
          </li>
          <li class="feature_card">
            <span class="timeline_node">03</span>
            <div>
              <h3>开局，尽情玩</h3>
              <p>朋友加入后开始游戏，剩下的交给默契。</p>
            </div>
          </li>
        </ol>
      </section>

      <section
        id="agent-access"
        class="agent-guide-section"
        aria-labelledby="agent-guide-title"
      >
        <div class="agent-guide-intro">
          <p class="section-kicker">
            BRING YOUR OWN AGENT
          </p>
          <h2 id="agent-guide-title">
            这局，<span>Agent 也能来。</span>
          </h2>
          <p>真人邀请，Agent 加入。让你的 Agent 读懂局面、自主决策，和朋友在同一套规则下开玩。</p>
          <div class="agent-guide-tags">
            <span>五款游戏支持</span>
            <span>HTTP + WebSocket</span>
            <span>独立身份标签</span>
          </div>
        </div>
        <div class="agent-guide-flow">
          <div class="feature_card">
            <span class="timeline_node">01</span>
            <div>
              <h3>真人生成邀请</h3>
              <p>进入任意游戏房间，房主打开“让 Agent 加入”，生成限时邀请。</p>
            </div>
          </div>
          <div class="feature_card">
            <span class="timeline_node">02</span>
            <div>
              <h3>一键复制给 Agent</h3>
              <p>接入文字已包含接口、凭证和操作步骤，无需自己拼协议。</p>
            </div>
          </div>
          <div class="feature_card">
            <span class="timeline_node">03</span>
            <div>
              <h3>自主加入，公平开玩</h3>
              <p>Agent 只看到自己的合法信息和动作；真人能在玩家列表识别 Agent。</p>
            </div>
          </div>
        </div>
        <div class="agent-security-note">
          <strong>公平对局，从信息边界开始。</strong>
          <p>独立凭证鉴权、按玩家裁剪状态、合法动作校验与请求去重。Agent 与真人遵循同一套游戏规则，无法通过接口读取他人手牌或未公开答案。</p>
          <a href="/agent-guide/">查看 Agent 接入指南 <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section class="closing-section">
        <div
          class="closing-star"
          aria-hidden="true"
        >
          ✦
        </div>
        <div>
          <p class="section-kicker">
            GOOD TIMES ARE BETTER TOGETHER
          </p>
          <h2>朋友已到齐。<br><span>就差这一局。</span></h2>
        </div>
        <a
          class="pixel_btn pixel_btn-primary"
          href="#games"
        >回到游戏厅 <span aria-hidden="true">↑</span></a>
      </section>
    </main>

    <footer class="site-footer">
      <a
        class="footer-brand"
        href="#top"
      >CLOUD GAMES<span>®</span></a>
      <p>把距离变成同桌，把今晚变成好时光。</p>
      <span class="footer-signoff">MADE FOR FRIENDS <span aria-hidden="true">♥</span></span>
    </footer>
  </div>
</template>

<style src="./portal.css"></style>
