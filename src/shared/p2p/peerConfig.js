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

// 信令服务器：只允许显式配置的国内/自建 PeerServer。
// 不再回退到公共 PeerJS，避免国内链路抖动和不可控外部依赖。
const ENV_PEER_HOST = import.meta.env.VITE_PEER_SERVER_HOST;
const HAS_PRIVATE_SIGNALING = Boolean(ENV_PEER_HOST);

export const PEER_SERVER = HAS_PRIVATE_SIGNALING ? {
  host: ENV_PEER_HOST,
  port: Number(import.meta.env.VITE_PEER_SERVER_PORT) || 9000,
  path: import.meta.env.VITE_PEER_SERVER_PATH || '/peerjs',
  key: import.meta.env.VITE_PEER_SERVER_KEY || 'catguess-2026',
  secure: import.meta.env.VITE_PEER_SERVER_SECURE !== 'false'
} : null;

// 暴露给 UI 诊断面板使用（不暴露 host/port/IP，仅暴露模式 + 关键路径）
export const SIGNALING_INFO = {
  mode: HAS_PRIVATE_SIGNALING ? 'self-hosted' : 'not-configured',
  label: HAS_PRIVATE_SIGNALING ? '国内/自建信令' : '未配置国内/自建信令',
  isConfigured: HAS_PRIVATE_SIGNALING,
  isRisky: !HAS_PRIVATE_SIGNALING,
  path: PEER_SERVER?.path || '/peerjs',
  secure: PEER_SERVER?.secure !== false
};

// 信令源启动诊断：控制台 + 让 UI 可读
if (typeof console !== 'undefined') {
  const tag = HAS_PRIVATE_SIGNALING ? '国内/自建' : '未配置';
  console.info(`[P2P] 📡 信令模式: ${tag} (path=${SIGNALING_INFO.path})`);
  if (!HAS_PRIVATE_SIGNALING) {
    console.warn(
      '[P2P] ⚠️ 未配置国内/自建 PeerJS 信令。' +
      '不会回退到公共 PeerJS；创建或加入房间会失败。'
    );
  }
}

export const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    ...SELF_HOSTED_TURN_SERVERS
  ]
};

export const HAS_SELF_HOSTED_TURN = SELF_HOSTED_TURN_SERVERS.length > 0;
export const HAS_TURN_RELAY = HAS_SELF_HOSTED_TURN;
export const HAS_PRIVATE_SIGNALING_SERVER = HAS_PRIVATE_SIGNALING;

// 暴露给 UI 诊断面板使用
export const TURN_RELAY_INFO = {
  hasSelfHosted: HAS_SELF_HOSTED_TURN,
  hasMetered: false,
  selfHostedCount: SELF_HOSTED_TURN_SERVERS.length,
  meteredCount: 0,
  totalCount: SELF_HOSTED_TURN_SERVERS.length,
  tier: HAS_SELF_HOSTED_TURN ? 'excellent' : 'none',
  label: HAS_SELF_HOSTED_TURN
    ? `国内/自建 TURN (${SELF_HOSTED_TURN_SERVERS.length} 节点)`
    : '无 TURN 中继'
};

// 启动诊断
if (typeof console !== 'undefined') {
  if (HAS_SELF_HOSTED_TURN) {
    console.info(`[P2P] 🏠 国内/自建 TURN 中继已启用（${SELF_HOSTED_TURN_SERVERS.length} 个节点）。`);
  }
  if (!HAS_TURN_RELAY) {
    console.warn(
      '[P2P] ⚠️ 未配置任何 TURN 中继。' +
      '不会回退到海外中继；对称 NAT / 手机流量（4G/5G）的玩家可能无法连接。'
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
