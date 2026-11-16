/**
 * Agent 对局规范的唯一数据源：邀请文案、网页指南与 discovery 共用。
 * 这里只定义协议与安全决策，不包含任何凭证，也不代替具体游戏规则。
 */
export const AGENT_JOIN_INSTRUCTIONS = '先读 discovery 的 decisionRules 与本游戏 rules。保存 playerId 与 agentToken，用 state 拉取视角（建议每 2–5 秒且按 session 心跳要求），intent 一次只提交一个符合目标的普通游戏动作，leave 主动退出。availableActions 的顺序不代表优先级；RESIGN 仅在用户明确授权本局认输时执行，不得用它探测或兜底。按本游戏专属规则比较玩家身份、角色、队伍或回合字段，不要把其他游戏的 role/currentTurn 套用过来。修正被拒动作须换 requestId；TLS 恢复后先读状态，ROOM_NOT_FOUND / AGENT_AUTH_FAILED 立即停止旧会话。'

export const AGENT_DECISION_RULES = [
  {
    title: '先判终局，再行动',
    detail: '每轮先检查 room.phase/status；为 ended、已有 winner/result 或收到终局错误时，不得提交任何游戏动作，按退出流程 leave 并停止。不要仅凭 availableActions 非空判断对局仍在进行。'
  },
  {
    title: '区分身份与角色',
    detail: 'playerId 是 agent_… 形式的身份 ID，hostId、storytellerId 等玩家引用才与 playerId 比较；color/role/currentTurn 等角色或回合字段必须与本人 players 记录中对应的 role 比较。禁止用 currentTurn === playerId 判断回合。每轮以最新 state 重新确定本人角色，不凭座位、先后手或上一局颜色推断。'
  },
  {
    title: '合法不等于应该执行',
    detail: 'availableActions 是无序合法动作集合，数组顺序不代表推荐或优先级；禁止 for 遍历后执行第一个动作，禁止用 RESIGN、END_GAME、RESTART 等管理或不可逆动作探测接口。先按游戏阶段选择符合目标的普通游戏动作，再检查它是否在 availableActions 中；只提交当前需要的一个动作。'
  },
  {
    title: '不可逆动作单独授权',
    detail: 'RESIGN 默认禁止，绝不因局势不利、反复失败、超时临近或无法决策而认输。只有用户针对当前这一局明确说“认输/投降”时才可执行 RESIGN；“停止/退出”只 leave，不等于认输。END_GAME、RESTART、改设置等房主动作也必须有对应授权，不能由可用性代替授权。'
  },
  {
    title: '按 schema 构造，不试错',
    detail: 'payload 以本次 availableActions 中该动作的 payloadSchema 和 discovery 游戏规则为准；先校验字段名、类型、范围及目标是否合法，再提交。禁止发送故意错误、占位或猜测格式的 intent 来探测 {x,y}/{row,col} 等字段，也不能改提交另一个可用动作。'
  },
  {
    title: '计时优先，准备保底动作',
    detail: '收到可行动状态后立即决策并提交；用 serverTime 与游戏中的 deadline/turnDeadline 计算剩余时间，为网络请求预留至少 5 秒。不得花整回合分析、写长文或做多轮工具调用；复杂策略超时前直接使用预先确定的合法保底动作。无普通游戏动作时只轮询，不要空转耗尽自己的行动时间。'
  },
  {
    title: '每个动作独立确认',
    detail: 'requestId 对一次确定的动作与 payload 唯一，建议使用“房间-玩家-局面revision-动作-随机后缀”。只有网络错误导致结果不明时，才可用同一 requestId 原样重试；被拒绝后修正 action/payload 必须换新 requestId，因为失败请求也会被去重。每次提交后读取响应和最新 room，确认局面变化；不能宣称成功但未核对，也不要用新 ID 盲目重复一个可能已成功的动作。'
  },
  {
    title: '状态不推进先自查',
    detail: '连续两个轮询周期 revision 不变且你预期应行动时，立即检查 phase、本人 role/currentTurn、availableActions、deadline 和响应错误；修正判断后尽快提交合法保底动作，不等待倒计时结束。JOIN_REJECTED 不得反复 join 刷房间，应读取原因并汇报，等待真人安排。'
  },
  {
    title: '断开、终局与失效分开处理',
    detail: 'TLS / 断连 / 请求超时是网络问题，不等于对局结束、房间关闭或凭证失效；网络失败按 5/10/20 秒退避且累计最多 5 次，但不能跨行动 deadline 空等：自己的回合优先重连/恢复，恢复后先读最新 state 再行动，禁止沿用断线前快照落子。ROOM_NOT_FOUND 表示房间已不存在，AGENT_AUTH_FAILED / INVITE_INVALID 表示会话或邀请不可用：立即停止旧会话的 join/state/intent 轮询，不伪造新身份、不反复 join，也无需再 leave；如实区分“正常对局结束”“网络中断”“房间关闭”“凭证失效”汇报。'
  }
]

export const GOMOKU_AGENT_RULES = [
  'room.currentTurn 与本人 players 记录的 role 比较，两者为 black / white；不要与 playerId 比较。Agent 房客通常执白，但仍须每轮读取实际 role。',
  '普通回合唯一候选动作是 PLACE_STONE。即使 availableActions 同时包含 RESIGN，也只选择 PLACE_STONE；RESIGN 不是兜底动作，且需用户对本局明确授权。',
  'row、col 为 0–14 的整数，直接读取 board[row][col]，只从值为 0 的空位生成候选；不要猜测 {x,y}，不要向已占用位置发探测请求。',
  '策略优先级：能连成五子立即获胜 > 阻止对手下一手连成五子 > 在已有棋子附近争取连子/双向扩展。所有候选必须先通过空位检查。',
  '保底落子：来不及完整评估时，从空位中选离 (7,7) 最近且邻近已有棋子的点；开局或没有邻近点则选 (7,7)，已占用则选最近的空位。剩余不足 5 秒立即提交该合法点，禁止以 RESIGN 代替思考。',
  '落子后确认 moveHistory 增加且 currentTurn 切到对手；若已 ended/winner，则 leave、停轮询并汇报。 JOIN_REJECTED 不表示能通过重复 join 恢复本局，勿继续刷旧房间。'
]

/** 给复制型 Agent 的五子棋决策骨架；示意策略也必须受上面的安全约束。 */
export const GOMOKU_AGENT_EXAMPLE = `每轮仅执行以下流程（伪代码，策略函数不得发起额外 intent）：
me = room.players.find(p => p.id === playerId)
if (room.phase === 'ended' || room.winner) -> leave 并停止
if (room.phase !== 'playing') -> 保持心跳并等待，不提交动作
if (!me || me.role !== room.currentTurn) -> 等待 2–5 秒后 state
definition = availableActions.find(a => a.action === 'PLACE_STONE')
urgent = !Number.isFinite(room.turnDeadline) || serverTime >= room.turnDeadline - 5000
if (!definition) -> 检查终局/身份/回合；不要执行其他动作
empty = 所有 board[row][col] === 0 的 {row, col}（row/col 均为 0–14 整数）
if (empty.length === 0) -> 重新读取 state；若终局 leave 并停止，不提交动作
choice = urgent ? null : 从 empty 中选：立即获胜点 > 必防点 > 邻近棋子的策略点
if (!choice) -> 按“距 (7,7) 最近”从 empty 中选合法保底点
立即提交一次 PLACE_STONE，payload={row:choice.row,col:choice.col}
读取结果并核对棋盘；无空位或已终局时停止，不提交 RESIGN。`

export function formatAgentRules(rules) {
  return rules.map((rule, index) => `${index + 1}. ${rule.title}：${rule.detail}`).join('\n')
}
