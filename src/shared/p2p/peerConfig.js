const METERED_TURN_USERNAME = import.meta.env.VITE_METERED_TURN_USERNAME;
const METERED_TURN_CREDENTIAL = import.meta.env.VITE_METERED_TURN_CREDENTIAL;
const REQUESTED_ICE_TRANSPORT_POLICY = import.meta.env.VITE_P2P_ICE_TRANSPORT_POLICY;

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

export const PEER_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  secure: true
};

export const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    ...METERED_TURN_SERVERS
  ]
};

export const HAS_METERED_TURN = METERED_TURN_SERVERS.length > 0;

// 启动诊断：没有 TURN 时，对称 NAT / 蜂窝网络（4G/5G，运营商级 NAT）的两端将无法连通。
// 把这个状态打到控制台，便于在部署版里一眼确认 TURN 是否真的生效。
if (typeof console !== 'undefined') {
  if (HAS_METERED_TURN) {
    console.info(`[P2P] TURN 中继已启用（${METERED_TURN_SERVERS.length} 个节点），跨网络/蜂窝应可连通。`);
  } else {
    console.warn(
      '[P2P] ⚠️ 未配置 TURN 中继（VITE_METERED_TURN_USERNAME / VITE_METERED_TURN_CREDENTIAL 为空）。' +
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
