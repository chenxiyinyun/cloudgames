import Peer from 'peerjs';

const PEER_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  secure: true
};

class P2PService {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.onMessage = null;
    this.onPlayerConnected = null;
    this.onPlayerDisconnected = null;
    this.onError = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createHost(roomCode, playerName) {
    this.isHost = true;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const peerId = `codenames-${roomCode}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时，请重试'));
      }, 15000);

      this.peer = new Peer(peerId, {
        ...PEER_SERVER,
        debug: 0
      });

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('Host peer created:', id);
        resolve(id);
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Host peer error:', err);
        reject(err);
      });

      this.peer.on('connection', (conn) => {
        console.log('New connection from:', conn.peer);
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  async joinRoom(roomCode, playerName) {
    this.isHost = false;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const hostPeerId = `codenames-${roomCode}`;
    const guestPeerId = `codenames-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接房间超时，请确认房间号正确'));
      }, 15000);

      this.peer = new Peer(guestPeerId, {
        ...PEER_SERVER,
        debug: 0
      });

      this.peer.on('open', (id) => {
        console.log('Guest peer created:', id);

        const conn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        let resolved = false;

        conn.on('open', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.log('Connected to host:', hostPeerId);
            this._setupConnection(conn);
            resolve(id);
          }
        });

        conn.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.error('Connection error:', err);
            reject(new Error('无法连接到房间'));
          }
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Guest peer error:', err);
        reject(err);
      });

      // 访客也监听其他玩家的直连（用于托管模式）
      this.peer.on('connection', (conn) => {
        console.log('Direct connection from peer:', conn.peer);
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  // 连接到指定 peer（用于托管时互相连接）
  async connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      const existingConn = this.connections.find(c => c.peer === peerId);
      if (existingConn && existingConn.open) {
        resolve(existingConn);
        return;
      }

      const conn = this.peer.connect(peerId, { reliable: true });
      const timeout = setTimeout(() => {
        reject(new Error(`连接 ${peerId} 超时`));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to peer:', peerId);
        this._setupConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Peer connection error:', err);
        reject(err);
      });
    });
  }

  _setupConnection(conn) {
    if (this.connections.find(c => c.peer === conn.peer)) return;

    conn.on('data', (data) => {
      console.log('Received message:', data.type, 'from:', conn.peer);
      if (this.onMessage) {
        this.onMessage(data, conn.peer);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    this.connections.push(conn);
  }

  broadcast(type, payload) {
    const message = { type, payload, timestamp: Date.now() };
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  sendTo(peerId, type, payload) {
    const message = { type, payload, timestamp: Date.now() };
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  getConnectedPeers() {
    return this.connections.filter(c => c.open).map(c => c.peer);
  }

  getMyPeerId() {
    return this.peer?.id;
  }

  disconnect() {
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;
  }
}

export default new P2PService();
