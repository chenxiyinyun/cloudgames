<script setup>
const games = [
  {
    name: '截码战',
    englishName: 'Codenames',
    description: '双人猜词对战游戏。通过代码提示，帮助队友猜出正确的关键词。',
    href: 'games/codenames/',
    color: '#4a90d9'
  },
  {
    name: '喵喵猜词',
    englishName: 'Cat Guess',
    description: '在线 Dixit 猜词游戏。讲故事者出题，众人猜词投票，先满 10 分者获胜！',
    href: 'games/catguess/',
    color: '#ff9a76'
  },
  {
    name: '双人拆弹',
    englishName: 'Bomb Defuse',
    description: '一人看炸弹，一人看说明书，在倒计时内合作解除模块。',
    href: 'games/bomb-defuse/',
    color: '#f0523d'
  },
  {
    name: '区域争夺',
    englishName: 'Territory Control',
    description: '2-4 人拖拽派兵占领地图，小中大随机战场，消灭所有对手获胜。',
    href: 'games/territory-control/',
    color: '#23a66f'
  }
]
</script>

<template>
  <div class="portal">
    <header class="header">
      <h1 class="title">
        云游戏合集
      </h1>
      <p class="subtitle">
        Cloud Games
      </p>
    </header>
    <main class="cards">
      <a
        v-for="game in games"
        :key="game.name"
        :href="game.href"
        class="card"
        :style="{ '--card-color': game.color }"
      >
        <div class="card-icon">{{ game.name.charAt(0) }}</div>
        <div class="card-body">
          <h2 class="card-name">{{ game.name }}</h2>
          <p class="card-english">{{ game.englishName }}</p>
          <p class="card-desc">{{ game.description }}</p>
        </div>
      </a>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Serif SC', 'Courier Prime', serif;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  min-height: 100vh;
  color: #e0e0e0;
}

.portal {
  max-width: 800px;
  margin: 0 auto;
  padding: 60px 24px;
}

.header {
  text-align: center;
  margin-bottom: 60px;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-family: 'Courier Prime', monospace;
  font-size: 1.1rem;
  color: #888;
  margin-top: 8px;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
  cursor: pointer;
}

.card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--card-color, #667eea);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--card-color), color-mix(in srgb, var(--card-color) 60%, #000));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.card-english {
  font-family: 'Courier Prime', monospace;
  font-size: 0.85rem;
  color: var(--card-color, #667eea);
  margin-bottom: 6px;
}

.card-desc {
  font-size: 0.9rem;
  color: #aaa;
  line-height: 1.5;
}
</style>
