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

export const DEFAULT_ICE_TRANSPORT_POLICY =
  REQUESTED_ICE_TRANSPORT_POLICY === 'relay' ? 'relay' : 'all';

export function createPeerConfig({ forceRelay = false } = {}) {
  return {
    ...PEER_CONFIG,
    iceTransportPolicy: forceRelay ? 'relay' : DEFAULT_ICE_TRANSPORT_POLICY
  };
}
