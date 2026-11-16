/**
 * 各游戏的 Agent 专属决策规范。
 * 字段路径均与 server/games 适配器的 project/agentActions 对齐；不包含隐藏答案。
 */
export const CODENAMES_AGENT_RULES = [
  '身份映射：room.encryptor 是 playerId，不是角色颜色；本人队伍读取 players 中自己的 team，并用 me.team === room.encryptorTeam 判断是否属于加密方。不要使用 role/currentTurn。',
  '只有 room.encryptor === playerId 时才是当前情报官。自己的关键词在 room[me.team + "Keywords"]，密码在 currentCode；数组为空说明没有该视角信息，不得猜测或提交情报官动作。',
  'encrypting 阶段情报官提交 SUBMIT_CLUES：clues 恰好三条、trim 后非空、互不重复且每条不超过 40 字；按 currentCode 的顺序给出联想，不能与可见关键词互为包含，也不能与 usedClues 忽略大小写重复；服务端还可能依据未公开的他队关键词拒绝，不能据此索取隐藏词，应换线索和新 requestId。',
  'guessing 阶段非情报官：me.team === encryptorTeam 时用 SUBMIT_TEAM_GUESS 解读本队线索，否则用 SUBMIT_OPPONENT_GUESS 根据公开线索和历史 notes/roundHistory 拦截。guess 是恰好三个 1–4 的整数，顺序对应三条线索，数字可以重复。',
  'team_voting 阶段：加密方用 SUBMIT_TEAM_VOTE，拦截方用 SUBMIT_OPPONENT_VOTE；先读取自己队伍的 teamVotes[me.team] 或可见的 opponentVotes/opponentGuess，已有 finalGuess 就不要重复提交。',
  'paused 表示等待断线玩家重连，不是终局；保持心跳并等待，不提交动作。没有回合计时，不要为赶时间乱猜，也不要用猜码请求探测字段。',
  'NEXT_ROUND 可能在结算时推进，也可能在终局后重开；START_GAME/NEXT_ROUND 都是房主动作，只有用户明确授权且 availableActions 提供时才执行。'
]

export const CODENAMES_AGENT_EXAMPLE = `每轮仅执行以下流程：
me = room.players.find(p => p.id === playerId)
if (room.status === 'ended' || room.winner) -> leave 并停止
if (room.phase === 'paused' || !me) -> 保持心跳，等待新 state
if (room.phase === 'encrypting' && room.encryptor === playerId)
  -> 用可见关键词和 currentCode 生成三条线索，本地检查包含关系、usedClues、长度与顺序后，提交一次 SUBMIT_CLUES
if (room.phase === 'guessing' && room.encryptor !== playerId)
  -> me.team === room.encryptorTeam ? SUBMIT_TEAM_GUESS : SUBMIT_OPPONENT_GUESS
if (room.phase === 'team_voting')
  -> 先查 finalGuess；未统一时按队伍选择 SUBMIT_TEAM_VOTE 或 SUBMIT_OPPONENT_VOTE
其余阶段 -> 只轮询，不执行 START_GAME/NEXT_ROUND
每次只提交一个当前动作，响应后重读 phase 与投票状态，不连续刷不同 guess。`

export const CATGUESS_AGENT_RULES = [
  'storytellerId 是 playerId，必须用 room.gameState.storytellerId === playerId 判断自己是不是说书人；自己的手牌只在 players 中自己的 hand 数组，其他玩家的 hand 不会下发。',
  'storyteller_picking：说书人用 SUBMIT_STORY 提交 {cardIndex, clue}。cardIndex 是自己 hand 的 0 起始下标，clue trim 后为 1–20 字；不要读取不存在的 role/currentTurn。',
  'others_picking：非说书人先检查 gameState.submittedCards 是否已有自己的 playerId；未提交时才用 SUBMIT_CARD 提交一个有效 cardIndex，按 clue 选择语义最贴合的手牌。',
  'revealing：先检查 gameState.votes 是否已有自己的 voterId；未投票时按 clue 从 gameState.shuffledCards 选择卡牌，提交其公开 id 作为 votedCardId。这里的 id 不是手牌 cardIndex。',
  '投票前 shuffledCards 只保证提供 {id, word}，不提供 isSecret、secretCardId 或 submitterId；不得编造归属或答案。当前引擎不禁止投自己的牌，不要声称能从未公开信息中定位并排除它。',
  '服务端阶段计时不下发 deadline：说书人 60 秒、出牌 30 秒、投票 30 秒并可能宽限 5 秒、计分 15 秒。收到可行动状态后立即完成，不要按 60 秒统一等待，也不要虚构 room.turnDeadline。',
  'scoring 通常由服务端自动进入下一轮；NEXT_ROUND/END_GAME 需要房主权限和用户授权。时间紧时也必须提交合法字段，可用已选中的合法手牌下标和短提示，不得用管理动作兜底。'
]

export const CATGUESS_AGENT_EXAMPLE = `每轮仅执行以下流程：
me = room.players.find(p => p.id === playerId)
if (room.phase === 'ended' || room.gameState.winner) -> leave 并停止
if (!me) -> 停止并报告身份异常
isStoryteller = room.gameState.storytellerId === playerId
if (room.phase === 'storyteller_picking' && isStoryteller)
  -> 从自己的 hand 选 cardIndex，生成 1–20 字 clue，提交 SUBMIT_STORY
if (room.phase === 'others_picking' && !isStoryteller
    && !room.gameState.submittedCards.some(c => c.playerId === playerId))
  -> 按 clue 从自己的 hand 选 cardIndex，提交 SUBMIT_CARD
if (room.phase === 'revealing' && !isStoryteller
    && !room.gameState.votes.some(v => v.voterId === playerId))
  -> 从公开 shuffledCards 按 clue 选一张，提交 {votedCardId: card.id}
其他情况 -> 只轮询；不操作 NEXT_ROUND/END_GAME
无充分时间分析时，从合法手牌或公开卡牌中直接确定一个候选，不发探测请求。`

export const BOMBDEFUSE_AGENT_RULES = [
  '这是双人协作游戏，本人 players 记录的 role 为 defuser 或 expert。defuser 读取 gameState.modules[].bombView 并操作；expert 只读取 manualView、说明规则并报告下一步，不得提交 SUBMIT_MODULE_ACTION。',
  '外层 payload 固定为 {moduleId, action}，moduleId 使用模块的 id，action.type 按模块类型选择：wires=cut_wire、symbols=press_symbols、keypad=press_key、password=enter_password、maze=move。不要写成 select_symbols。',
  '只操作 gameState.modules 中 status 不为 solved 的模块。wires 的 wireId 来自 bombView.wires[].id；keypad 的 keyId 来自 bombView.keys[].id；password 的 word 是由五列 letters 可拼出的五个字母单词；symbols 的 symbolIds 必须按 manualView 规则给出的完整顺序提交。',
  'maze 每次只提交 {type:"move", direction:"up|down|left|right"} 的一步。拆弹员没有墙的信息，专家根据 manualView.cells[y][x] 的通路、最新位置和 goal 给出唯一安全方向；不要凭直线距离猜方向，移动后重读位置再继续。',
  '错误模块操作不是无害探测：会写 actionLog、记 strikes，达到 strikeLimit 会 exploded；accepted=false 也可能代表 correct=false 的真实失误。信息不足时不得随机剪线、按键、排序、输入密码或撞墙，应请求搭档补充规则/现场信息。',
  '双方只能在各自视角内协作，不能索要 seed、solution、对方未下发字段或通过接口探测答案。专家每轮应简明汇报“模块 id + 所需现场字段 + 规则判断”，拆弹员提供对应公开 bombView 信息。',
  '用 gameState.deadlineAt - serverTime 管理总倒计时并预留请求时间。临近截止但答案仍不确定时，也不要随机操作造成 strike；记录无法安全决策的模块并汇报，END_GAME/RESTART 不是保底动作。'
]

export const BOMBDEFUSE_AGENT_EXAMPLE = `每轮仅执行以下流程：
me = room.players.find(p => p.id === playerId)
if (room.phase !== 'playing' || room.gameState.result) -> leave 并停止
if (me.role === 'expert')
  -> 不提交游戏动作；读取 manualView，向搭档给出模块规则及下一步安全指令，保持心跳
if (me.role === 'defuser')
  -> 从未 solved 模块中选有充分规则依据的一项，核对 moduleId、bombView 与 action 字段后只提交一次 SUBMIT_MODULE_ACTION
  -> 没有专家确认或本地可确定的解法时，不操作；向搭档提供所需 bombView 字段并等待，不随机试错
迷宫只在专家根据 manualView 通路给出当前一步后移动，每步后重读位置。
提交后核对 actionLog.correct、solvedModuleIds、strikes 与 phase；correct=false 是实际失误，不原样换 requestId 重试。`

export const TERRITORY_AGENT_RULES = [
  '没有 currentTurn：DISPATCH_UNITS 在本人未淘汰且 playing 时可持续使用，不代表必须每轮派兵。本人身份使用 playerId，领地归属使用 territory.ownerId === playerId；不要使用 role 比较。',
  '候选 source 必须来自 gameState.territories：ownerId === playerId、非 isObstacle、kind !== "item" 且有足够 units。target 不能等于 source、不能是障碍，并用 gameState.edges 的 from/to 双向连通关系计算避开障碍的路径。',
  'ratio 只能为 0.25 / 0.5 / 0.75，实际派出数量为 floor(source.units * ratio)，必须大于 0；用最新 state 计算，不能沿用旧 units。source.kind === "item" 不可作为起点，但可作合法终点。',
  '不要按固定 0.5 盲目派兵：攻击前估计目标单位、要塞防御、天气、道具、途中损耗和到达时变化；夺取条件是有效攻击大于有效防御，不是大于等于。预留己方防守兵力，不能因持续动作把全部领地抽空。',
  '没有充分收益或合法路径时，等待生产并观察 gameState.movingTroops 是合法决策，不要为了“做动作”随机攻击。优先低防守且可达的扩张、必要增援或有把握的目标，不在同一 revision 对同一 source/target 连续发不同比例请求。',
  'gameState.winnerId 是终局胜者 playerId，room.phase/status 为 ended 时停止。提交后核对 source.units 和 movingTroops 新增的本人兵团；到达前单位变化不代表已占领。',
  '断线会持续影响生产，并可能在离线后中立化领地；优先恢复心跳。SET_MAP_SIZE/SET_THEME/START_GAME/RESTART_GAME/END_GAME 都是需授权的房主动作，不是游戏内兜底。'
]

export const TERRITORY_AGENT_EXAMPLE = `每轮仅执行以下流程：
me = room.players.find(p => p.id === playerId)
if (room.phase === 'ended' || room.gameState.winnerId) -> leave 并停止
if (!me || me.isEliminated) -> 停止行动并报告状态
owned = territories.filter(t => t.ownerId === playerId && !t.isObstacle && t.kind !== 'item')
candidates = owned × 非自身非障碍 targets，保留 edges 可绕开障碍到达且 floor(source.units * ratio) > 0 的组合
先评估收益、目标防御、天气/道具与 source 留守兵力；无合理候选 -> 等待，不提交动作
选定后只提交一次 DISPATCH_UNITS {sourceId, targetId, ratio}
读取最新 source.units 和 movingTroops 确认派出，行军未完成不宣称占领，不因 availableActions 仍存在而自动再派。`

export const GAME_AGENT_PLAYBOOKS = {
  codenames: { rules: CODENAMES_AGENT_RULES, example: CODENAMES_AGENT_EXAMPLE },
  catguess: { rules: CATGUESS_AGENT_RULES, example: CATGUESS_AGENT_EXAMPLE },
  bombdefuse: { rules: BOMBDEFUSE_AGENT_RULES, example: BOMBDEFUSE_AGENT_EXAMPLE },
  territory: { rules: TERRITORY_AGENT_RULES, example: TERRITORY_AGENT_EXAMPLE }
}

export function formatGameAgentGuide(playbook) {
  if (!playbook) return ''
  return `${playbook.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}\n\n${playbook.example}`
}
