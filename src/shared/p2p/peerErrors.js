export function translatePeerError(err) {
  const type = err?.type || '';
  switch (type) {
    case 'unavailable-id':
      return '房间已被占用（上一次连接的残影），请刷新页面重试';
    case 'peer-unavailable':
      return '无法找到房间，请确认房间号正确';
    case 'disconnected':
      return '与信号服务器断开连接，请检查网络';
    case 'network':
      return '网络连接失败，请检查网络设置或尝试切换网络';
    case 'server-error':
      return '信号服务器出错，请稍后重试';
    case 'browser-incompatible':
      return '当前浏览器不支持 WebRTC（请使用 Chrome/Edge/Firefox）';
    case 'webrtc':
      return '浏览器间连接失败（可能被防火墙阻止），请尝试切换网络';
    case 'socket-error':
      return 'WebSocket 连接失败，请检查网络';
    case 'socket-closed':
      return '与服务器连接中断，请刷新页面重试';
    default:
      return err?.message || '连接失败，请重试';
  }
}
