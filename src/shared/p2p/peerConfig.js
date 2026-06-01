const METERED_TURN_USERNAME = import.meta.env.VITE_METERED_TURN_USERNAME;
const METERED_TURN_CREDENTIAL = import.meta.env.VITE_METERED_TURN_CREDENTIAL;
const SELF_HOSTED_TURN_URLS = import.meta.env.VITE_SELF_HOSTED_TURN_URLS;
const SELF_HOSTED_TURN_USERNAME = import.meta.env.VITE_SELF_HOSTED_TURN_USERNAME;
const SELF_HOSTED_TURN_CREDENTIAL = import.meta.env.VITE_SELF_HOSTED_TURN_CREDENTIAL;
const REQUESTED_ICE_TRANSPORT_POLICY = import.meta.env.VITE_P2P_ICE_TRANSPORT_POLICY;

const SELF_HOSTED_TURN_SERVERS = SELF_HOSTED_TURN_URLS && SELF_HOSTED_TURN_USERNAME && SELF_HOSTED_TURN_CREDENTIAL
  ? SELF_HOSTED_TURN_URLS.split(',')
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => ({
      urls: url,
      username: SELF_HOSTED_TURN_USERNAME,
      credential: SELF_HOSTED_TURN_CREDENTIAL
    }))
  : [];

// Metered.ca TURN 作为海外兜底（加拿大，免费计划仅 standard.relay.metered.ca）
const METERED_TURN_SERVERS = METERED_TURN_USERNAME && METERED_TURN_CREDENTIAL
  ? [
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    }
  ]
  : [];

// 信令服务器：优先用 VITE_PEER_SERVER_HOST（自托管），缺失时回退到公共 0.peerjs.com
// 这样 secret 全部清空也能跑（开发期兜底），加了 secret 就走阿里云
const ENV_PEER_HOST = import.meta.env.VITE_PEER_SERVER_HOST;
const USE_CUSTOM_SIGNALING = Boolean(ENV_PEER_HOST);

export const PEER_SERVER = USE_CUSTOM_SIGNALING ? {
  host: ENV_PEER_HOST,
  port: Number(import.meta.env.VITE_PEER_SERVER_PORT) || 9000,
  path: import.meta.env.VITE_PEER_SERVER_PATH || '/peerjs',
  key: import.meta.env.VITE_PEER_SERVER_KEY || 'catguess-2026',
  secure: import.meta.env.VITE_PEER_SERVER_SECURE !== 'false'
} : {
  host: '0.peerjs.com',
  port: 443,
  secure: true
};

// 信令源启动诊断：只暴露模式（自托管/公共）+ 路径，不暴露 host/port/IP
// 真实 IP/端口/域名已经写死在客户端 bundle 里、network 面板也藏不住，本行只是减少显眼度
if (typeof console !== 'undefined') {
  const path = PEER_SERVER.path || '/peerjs';
  const tag = USE_CUSTOM_SIGNALING ? '自托管' : '公共 PeerJS';
  console.info(`[P2P] 📡 信令模式: ${tag} (path=${path})`);
}

export const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    ...SELF_HOSTED_TURN_SERVERS,
    ...METERED_TURN_SERVERS
  ]
};

export const HAS_METERED_TURN = METERED_TURN_SERVERS.length > 0;
export const HAS_SELF_HOSTED_TURN = SELF_HOSTED_TURN_SERVERS.length > 0;
export const HAS_TURN_RELAY = HAS_SELF_HOSTED_TURN || HAS_METERED_TURN;

// 启动诊断
if (typeof console !== 'undefined') {
  if (HAS_SELF_HOSTED_TURN) {
    console.info(`[P2P] 🏠 自建 TURN 中继已启用（${SELF_HOSTED_TURN_SERVERS.length} 个节点），国内低延迟。`);
  }
  if (HAS_METERED_TURN) {
    console.info(`[P2P] ☁️ 海外 TURN 兜底已启用（${METERED_TURN_SERVERS.length} 个节点，Metered.ca），海外用户兜底。`);
  }
  if (!HAS_SELF_HOSTED_TURN && HAS_METERED_TURN) {
    console.warn('[P2P] 未检测到自建 TURN 配置，当前只能使用 Metered 海外中继兜底。');
  }
  if (!HAS_TURN_RELAY) {
    console.warn(
      '[P2P] ⚠️ 未配置任何 TURN 中继。' +
      '对称 NAT / 手机流量（4G/5G）的玩家将无法连接，只有同设备/同局域网能连。' +
      '请确认 GitHub 仓库 Secrets 已设置且构建时已注入。'
    );
  }
}

export const DEFAULT_ICE_TRANSPORT_POLICY =
  REQUESTED_ICE_TRANSPORT_POLICY === 'relay' ? 'relay' : 'all';

export function createPeerConfig({ forceRelay = false } = {}) {
  return {
    ...PEER_CONFIG,
    iceTransportPolicy: forceRelay ? 'relay' : DEFAULT_ICE_TRANSPORT_POLICY
  };
}
