# 云游戏合集 (Cloud Games)

A collection of browser-based party games built with Vue 3 + Vite, deployed on GitHub Pages.

## Games

| Game | Description |
|------|-------------|
| [截码战 (Codenames)](./games/codenames/) | 双人猜词对战游戏 - 截码战 / Codenames word-guessing game |

## Development

```bash
# Install dependencies
npm install

# Start dev server (portal at /, games at /games/<name>/)
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Adding a New Game

1. Create `games/<game-name>/` with `index.html` and `src/` directory
2. Add your game entry in `src/portal/App.vue`
3. Add the HTML entry to `build.rollupOptions.input` in `vite.config.js`

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions on push to `main`.
