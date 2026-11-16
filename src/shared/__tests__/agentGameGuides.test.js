import { describe, expect, it } from 'vitest'
import { GAME_AGENT_GUIDES } from '../../../server/agentProtocol'
import {
  BOMBDEFUSE_AGENT_EXAMPLE,
  BOMBDEFUSE_AGENT_RULES,
  CATGUESS_AGENT_EXAMPLE,
  CATGUESS_AGENT_RULES,
  CODENAMES_AGENT_EXAMPLE,
  CODENAMES_AGENT_RULES,
  GAME_AGENT_PLAYBOOKS,
  TERRITORY_AGENT_EXAMPLE,
  TERRITORY_AGENT_RULES,
  formatGameAgentGuide
} from '../agentGameGuides'

describe('其他游戏的 Agent 专属规范', () => {
  it('截码战按 encryptor/team 路由，不套用 role/currentTurn', () => {
    const text = [...CODENAMES_AGENT_RULES, CODENAMES_AGENT_EXAMPLE].join('\n')
    expect(text).toContain('room.encryptor === playerId')
    expect(text).toContain('me.team === room.encryptorTeam')
    expect(text).toContain('SUBMIT_TEAM_GUESS')
    expect(text).toContain('SUBMIT_OPPONENT_GUESS')
    expect(text).toContain('SUBMIT_TEAM_VOTE')
    expect(text).toContain('SUBMIT_OPPONENT_VOTE')
    expect(text).toContain('usedClues')
    expect(text).toContain('paused')
  })

  it('喵喵猜词区分手牌下标和公开投票 id，并防止重复提交', () => {
    const text = [...CATGUESS_AGENT_RULES, CATGUESS_AGENT_EXAMPLE].join('\n')
    expect(text).toContain('room.gameState.storytellerId === playerId')
    expect(text).toContain('submittedCards.some(c => c.playerId === playerId)')
    expect(text).toContain('votes.some(v => v.voterId === playerId)')
    expect(text).toContain('votedCardId: card.id')
    expect(text).toContain('不提供 isSecret、secretCardId 或 submitterId')
    expect(text).toContain('不要虚构 room.turnDeadline')
  })

  it('拆弹按角色分离操作与指导，明确错误操作会记 strike', () => {
    const text = [...BOMBDEFUSE_AGENT_RULES, BOMBDEFUSE_AGENT_EXAMPLE].join('\n')
    expect(text).toContain('me.role === \'expert\'')
    expect(text).toContain('me.role === \'defuser\'')
    expect(text).toContain('不要写成 select_symbols')
    expect(text).toContain('accepted=false 也可能代表 correct=false')
    expect(text).toContain('不得随机剪线、按键、排序、输入密码或撞墙')
    expect(text).toContain('manualView.cells[y][x]')
    expect(text).toContain('gameState.deadlineAt - serverTime')
  })

  it('区域争夺校验归属、路径、兵力且允许等待', () => {
    const text = [...TERRITORY_AGENT_RULES, TERRITORY_AGENT_EXAMPLE].join('\n')
    expect(text).toContain('没有 currentTurn')
    expect(text).toContain('territory.ownerId === playerId')
    expect(text).toContain('floor(source.units * ratio)')
    expect(text).toContain('有效攻击大于有效防御，不是大于等于')
    expect(text).toContain('等待生产并观察 gameState.movingTroops 是合法决策')
    expect(text).toContain('无合理候选 -> 等待，不提交动作')
    expect(text).toContain('room.gameState.winnerId')
  })

  it('四款游戏均把专属规则注入 discovery', () => {
    expect(Object.keys(GAME_AGENT_PLAYBOOKS)).toEqual(['codenames', 'catguess', 'bombdefuse', 'territory'])
    for (const [gameId, playbook] of Object.entries(GAME_AGENT_PLAYBOOKS)) {
      expect(GAME_AGENT_GUIDES[gameId].rules).toEqual(expect.arrayContaining(playbook.rules))
      expect(formatGameAgentGuide(playbook)).toContain(playbook.example)
    }
  })
})
