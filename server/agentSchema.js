/** Agent 动作 schema 的构造辅助：各游戏适配器定义 agentGuide 时复用。 */
export const text = (max = 20) => ({ type: 'string', maxLength: max });
export const empty = { type: 'object', properties: {}, additionalProperties: false };
export const action = (id, description, payload = empty) => ({ action: id, description, payloadSchema: payload });
export const field = (type, extra = {}) => ({ type, ...extra });
