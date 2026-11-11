import { GAME_AGENT_GUIDES, AGENT_API_VERSION } from './agentProtocol.js';

export function createAgentHttp({ manager, publicOrigin = '', allowedOrigin = '*' }) {
  function send(res, status, body, invite = false) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': invite ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(payload);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/agent/')) {
      send(res, 204, {});
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/agent/discovery') {
      send(res, 200, {
        apiVersion: AGENT_API_VERSION,
        name: 'Cloud Games Agent API',
        description: '真人邀请、凭证鉴权、按玩家裁剪状态、服务器权威动作。',
        httpPath: '/api/agent/rpc',
        webSocketPath: url.pathname,
        publicOrigin,
        joinOperation: 'join',
        reconnectOperation: 'join',
        stateOperation: 'state',
        intentOperation: 'intent',
        games: Object.values(GAME_AGENT_GUIDES)
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/agent/rpc') {
      let text = '';
      try {
        for await (const chunk of req) {
          text += chunk;
          if (text.length > 16_384) {
            send(res, 413, { type: 'ERROR', code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' });
            return;
          }
        }
      } catch {
        send(res, 400, { type: 'ERROR', message: '无法读取请求' });
        return;
      }
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        send(res, 400, { type: 'ERROR', code: 'INVALID_JSON', message: '请求必须是 JSON' });
        return;
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        send(res, 400, { type: 'ERROR', message: '请求必须是 JSON 对象' });
        return;
      }
      const messages = [];
      const conn = {
        roomCode: null,
        playerId: null,
        isAgent: false,
        send: message => messages.push(message)
      };
      manager.handleMessage(conn, { ...body, type: body.operation === 'join' ? 'AGENT_JOIN' : 'AGENT_HTTP' });
      const reply = messages[0] || { type: 'ERROR', message: '接口无响应' };
      if (reply.agentToken) {
        reply.instructions = '保存 playerId 与 agentToken。用 state 拉取视角（建议每 2–5 秒，间隔不超过 90 秒以保持在线），intent 提交动作，leave 主动退出。';
      }
      const failed = reply.type === 'ERROR';
      const authError = ['AGENT_AUTH_FAILED', 'INVITE_INVALID'].includes(reply.code);
      send(res, failed ? (authError ? 401 : 400) : 200, reply, true);
      return;
    }
    send(res, 404, { type: 'ERROR', code: 'NOT_FOUND', message: '接口不存在' });
  }
  return { handle };
}
