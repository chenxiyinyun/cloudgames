# 云游戏合集 (Cloud Games)

A collection of browser-based party games built with Vue 3 + Vite, deployed on GitHub Pages.

## Games

| Game | Description |
|------|-------------|
| [截码战 (Codenames)](./games/codenames/) | 双人猜词对战游戏 - 截码战 / Codenames word-guessing game |
| [双人拆弹 (Bomb Defuse)](./games/bomb-defuse/) | 双人在线协作拆弹解谜游戏 |

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

## P2P Reliability

The games use PeerJS/WebRTC for multiplayer. By default the shared P2P layer gives the browser both STUN and TURN candidates, so ICE will prefer a direct peer-to-peer path when it works and automatically fall back to a relay candidate when needed.

For reliable relay fallback, configure the self-hosted TURN first. Multiple URLs can be comma-separated; these are passed to WebRTC before the Metered fallback:

```bash
VITE_SELF_HOSTED_TURN_URLS=turn:your-turn-host:3478,turn:your-turn-host:3478?transport=tcp
VITE_SELF_HOSTED_TURN_USERNAME=<turn-username>
VITE_SELF_HOSTED_TURN_CREDENTIAL=<turn-credential>
```

Metered TURN can still be configured as an overseas fallback:

```bash
VITE_METERED_TURN_USERNAME=<metered-username>
VITE_METERED_TURN_CREDENTIAL=<metered-credential>
```

If a network is especially strict and direct ICE candidates keep failing, force all WebRTC traffic through TURN:

```bash
VITE_P2P_ICE_TRANSPORT_POLICY=relay
```

Use relay-only as an operational fallback, not the default, because it is more reliable across difficult NAT/firewall environments but adds latency and consumes TURN bandwidth.

## Adding a New Game

1. Create `games/<game-name>/` with `index.html` and `src/` directory
2. Add your game entry in `src/portal/App.vue`
3. Add the HTML entry to `build.rollupOptions.input` in `vite.config.js`

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions on push to `main`.
