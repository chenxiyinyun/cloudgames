import { listAdapters } from './games/index.js';

export const AGENT_API_VERSION = '1';

/**
 * Agent 可见的游戏目录：每个适配器自带 agentGuide（规则摘要 + 动作 schema），
 * 这里只做汇总，不再维护一份平行的手写清单。
 */
export const GAME_AGENT_GUIDES = Object.fromEntries(
  listAdapters().map(adapter => [adapter.gameId, adapter.agentGuide])
);

/**
 * 校验意图 payload。人类与 Agent 共用：Agent 的 HTTP/WS 入口与人类的 INTENT
 * 都必须先过这一层，避免畸形 payload 直接进入引擎。
 */
export function validateAgentIntent(gameId, actionName, payload) {
  const definition = GAME_AGENT_GUIDES[gameId]?.actions.find(item => item.action === actionName);
  if (!definition) return { error: `不支持的游戏动作：${actionName}` };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'payload 必须是对象' };
  const schema = definition.payloadSchema;
  if (schema.additionalProperties === false && Object.keys(payload).some(key => !Object.hasOwn(schema.properties || {}, key))) return { error: 'payload 包含未定义字段' };
  for (const key of schema.required || []) if (!Object.hasOwn(payload, key)) return { error: `payload 缺少 ${key}` };
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    const value = payload[key];
    if (value === undefined) continue;
    if (rule.type === 'string' && (typeof value !== 'string' || !value.trim() || value.length > (rule.maxLength || 100))) return { error: `${key} 必须是非空短文本` };
    if (rule.type === 'integer' && (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) return { error: `${key} 必须是有效整数` };
    if (rule.type === 'number' && (typeof value !== 'number' || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) return { error: `${key} 必须是数字` };
    if (rule.enum && !rule.enum.includes(value)) return { error: `${key} 不在允许范围` };
    if (rule.type === 'array') {
      if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) return { error: `${key} 数量不正确` };
      if (rule.items === 'integer' && value.some(item => !Number.isInteger(item) || item < rule.minimum || item > rule.maximum)) return { error: `${key} 必须是 1–4 的整数` };
      if (rule.items === 'string' && value.some(item => typeof item !== 'string' || !item.trim() || item.length > rule.maxLength)) return { error: `${key} 必须是非空短文本` };
    }
    if (rule.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 6000)) return { error: `${key} 必须是有效的小对象` };
  }
  return { value: payload };
}
