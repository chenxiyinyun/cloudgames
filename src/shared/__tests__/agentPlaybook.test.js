import { describe, expect, it } from 'vitest'
import {
  AGENT_DECISION_RULES,
  AGENT_JOIN_INSTRUCTIONS,
  GOMOKU_AGENT_EXAMPLE,
  GOMOKU_AGENT_RULES,
  formatAgentRules
} from '../agentPlaybook'

const allRules = AGENT_DECISION_RULES.map(rule => `${rule.title} ${rule.detail}`).join('\n')

describe('Agent 对局决策规范', () => {
  it('禁止按 availableActions 顺序选中不可逆动作', () => {
    expect(allRules).toContain('数组顺序不代表推荐或优先级')
    expect(allRules).toContain('RESIGN 默认禁止')
    expect(allRules).toContain('明确说“认输/投降”')
    expect(allRules).toContain('“停止/退出”只 leave，不等于认输')
  })

  it('明确区分 playerId、role 与 currentTurn', () => {
    expect(allRules).toContain('禁止用 currentTurn === playerId 判断回合')
    expect(allRules).toContain('本人 players 记录中对应的 role')
    expect(GOMOKU_AGENT_RULES.join('\n')).toContain('black / white')
  })

  it('提供超时保底、状态确认和修正请求的新 requestId', () => {
    expect(allRules).toContain('预留至少 5 秒')
    expect(allRules).toContain('合法保底动作')
    expect(allRules).toContain('修正 action/payload 必须换新 requestId')
    expect(allRules).toContain('失败请求也会被去重')
  })

  it('将网络失败、房间关闭、会话失效和正常终局分别处理', () => {
    expect(allRules).toContain('TLS / 断连 / 请求超时是网络问题')
    expect(allRules).toContain('恢复后先读最新 state 再行动')
    expect(allRules).toContain('ROOM_NOT_FOUND 表示房间已不存在')
    expect(allRules).toContain('AGENT_AUTH_FAILED / INVITE_INVALID 表示会话或邀请不可用')
    expect(allRules).toContain('“正常对局结束”“网络中断”“房间关闭”“凭证失效”')
  })

  it('五子棋流程只产生合法落子，不用探测或认输兜底', () => {
    const rules = GOMOKU_AGENT_RULES.join('\n')
    expect(rules).toContain('唯一候选动作是 PLACE_STONE')
    expect(rules).toContain('board[row][col]')
    expect(rules).toContain('不要猜测 {x,y}')
    expect(rules).toContain('能连成五子立即获胜 > 阻止对手下一手连成五子')
    expect(rules).toContain('剩余不足 5 秒立即提交')
    expect(GOMOKU_AGENT_EXAMPLE).toContain("a.action === 'PLACE_STONE'")
    expect(GOMOKU_AGENT_EXAMPLE).toContain('me.role !== room.currentTurn')
    expect(GOMOKU_AGENT_EXAMPLE).toContain('leave 并停止')
    expect(GOMOKU_AGENT_EXAMPLE).not.toContain('action === \'RESIGN\'')
  })

  it('邀请和 join 摘要也保留关键防线', () => {
    const inviteRules = formatAgentRules(AGENT_DECISION_RULES)
    expect(inviteRules).toContain('1. 先判终局，再行动')
    expect(AGENT_JOIN_INSTRUCTIONS).toContain('decisionRules')
    expect(AGENT_JOIN_INSTRUCTIONS).toContain('RESIGN 仅在用户明确授权')
    expect(AGENT_JOIN_INSTRUCTIONS).toContain('按本游戏专属规则比较玩家身份、角色、队伍或回合字段')
    expect(AGENT_JOIN_INSTRUCTIONS).toContain('ROOM_NOT_FOUND / AGENT_AUTH_FAILED 立即停止')
  })
})
