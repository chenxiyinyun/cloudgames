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

The games use PeerJS/WebRTC for multiplayer. The shared P2P layer now only uses explicitly configured domestic/self-hosted signaling and TURN services. It does not fall back to public PeerJS or overseas relay services.

Configure a domestic/self-hosted PeerJS signaling server:

```bash
VITE_PEER_SERVER_HOST=<peer-server-host>
VITE_PEER_SERVER_PORT=9000
VITE_PEER_SERVER_PATH=/peerjs
VITE_PEER_SERVER_KEY=<peer-server-key>
VITE_PEER_SERVER_SECURE=true
```

For reliable relay fallback, configure domestic/self-hosted TURN. Multiple URLs can be comma-separated:

```bash
VITE_SELF_HOSTED_TURN_URLS=turn:your-turn-host:3478,turn:your-turn-host:3478?transport=tcp
VITE_SELF_HOSTED_TURN_USERNAME=<turn-username>
VITE_SELF_HOSTED_TURN_CREDENTIAL=<turn-credential>
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
