/** 从部署环境解析 Agent 服务地址；不生成或存储任何凭证。 */
export function getAgentServiceUrl(env = import.meta.env) {
  const injected = typeof __CLOUD_GAMES_AGENT_URL__ === 'string' ? __CLOUD_GAMES_AGENT_URL__ : ''
  const configured = injected || env.VITE_AGENT_SERVER_URL || env.VITE_WS_SERVER_URL || ''
  if (!configured) return ''
  try {
    const url = new URL(configured, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    url.protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.origin
  } catch {
    return ''
  }
}

export function getAgentWebSocketUrl(serviceUrl) {
  if (!serviceUrl) return ''
  const url = new URL(serviceUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}
