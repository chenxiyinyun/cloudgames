# 截码战 (Codenames) 架构与交互设计审查报告

## 执行摘要

截码战项目整体架构清晰、分层合理，采用了 P2P 权威节点模式、纯静态部署方案，技术栈选型得当。核心游戏逻辑（gameEngine.js）与通信层（p2p.js）实现了良好解耦。但在 **状态管理一致性、P2P 通信可靠性、游戏交互细节** 三方面存在若干值得关注的架构问题，以下逐一分析并给出建议。

---

## 一、架构优点（做得好的地方）

### 1.1 分层清晰
```
Vue 组件（UI 层）→ gameStore（状态+协议层）→ gameEngine（纯逻辑）+ p2p（通信层）
```
- gameEngine.js 是纯函数式设计，无副作用，可独立测试
- p2p.js 封装了 PeerJS 细节，上层无需关心 WebRTC 实现
- sanitize.js / stateCache.js / logger.js 各司其职，职责单一

### 1.2 权威节点模式
- 房主运行完整游戏逻辑，访客仅同步状态
- 避免了分布式一致性问题
- 所有操作经房主验证，防作弊

### 1.3 辅助设施完善
- 幂等性层（Idempotency Layer）防止 P2P 广播重复处理
- 心跳检测 + 死连接清理
- 断线重连 + 状态缓存（localStorage）
- 房主迁移机制
- 增量广播（delta）优化带宽
- 消息重试队列
- 输入消毒（XSS 防护）

### 1.4 视觉设计统一
- 二战电报风格贯穿始终
- CSS 变量体系完整
- 响应式适配

---

## 二、架构问题（需要关注）

### 🔴 P0 - 严重问题

#### 2.1 gameStore 双重执行 Bug：房主操作被重复处理

**位置**: `gameStore.js` 第 1013-1098 行

**问题**: 房主执行操作时，函数先 `broadcast` 再本地 `submitXxx`，这导致：
- 本地 `submitXxx` 修改 `cachedRoom` 后触发 `broadcastState()`
- 访客收到 `ROOM_STATE` 同步
- 但房主自己的 `handleHostMessage` 不会捕获本地广播
- 然而如果房主也是通过消息通道收到自己发的消息（PeerJS 某些配置下可能），则会导致重复执行

**更关键的问题**：`handleSubmitClues` / `handleSubmitTeamGuess` / `handleSubmitOpponentGuess` / `handleSubmitTeamVote` 都是先广播再本地执行。如果本地执行失败（返回 error），广播已经发出去了，访客收到的状态和房主实际状态不一致。

**建议**: 先本地执行，成功后再广播：
```js
export async function handleSubmitClues(clues) {
  const result = submitClues(cachedRoom, gameState.playerId, sanitizedClues);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  // 本地成功后才广播
  p2p.broadcast(MSG.SUBMIT_CLUES, { ... });
  broadcastState();
  return true;
}
```

#### 2.2 对方拦截时序问题

**位置**: `gameEngine.js` 第 450-490 行，`submitOpponentGuess`

**问题**: 对方队伍的拦截猜测在 `GUESSING` 或 `TEAM_VOTING` 阶段都可以提交，但游戏流程设计上：
- 队友两人各自猜 → 如果不一致进入 TEAM_VOTING
- 对方拦截在 GUESSING 就可以提交
- `canProcessRound()` 检查 `encryptorTeamHasFinal && opponentHasGuess`

这意味着对方可以在队友还没达成一致时就提交拦截，而拦截结果被暂存。这在逻辑上没问题，但存在 **信息泄露风险**：
- 对方提交后，`room.opponentGuess !== null`
- 如果 UI 层没有正确隐藏此信息，队友可能通过状态变化推断对方已提交

**建议**: 确保 UI 层不展示对方是否已提交的状态（目前 GameScreen.vue 的 `hasSubmittedOpponentGuess` 只用于控制对方自己的 UI，看起来没问题，但需要明确验证）。

#### 2.3 token 字段名不一致

**位置**: `gameEngine.js` vs `gameStore.js`

- gameEngine 使用 `interceptionTokens` / `miscommunicationTokens`
- gameStore.updateLocalState 第 995-998 行映射到 `interceptTokens` / `missTokens`
- GameScreen.vue / ResultScreen.vue 读取 `interceptTokens` / `missTokens`

这是一个隐性的数据映射层，增加了理解和维护成本。如果有人在 gameEngine 中直接读取 `interceptTokens` 会拿到 undefined。

**建议**: 统一字段名，要么全部用 `interceptionTokens`，要么全部用 `interceptTokens`。

---

### 🟡 P1 - 重要问题

#### 2.4 gameStore 职责过重（1165 行）

**问题**: gameStore.js 同时承担了：
1. 响应式状态管理
2. P2P 消息协议处理（handleHostMessage/handleGuestMessage）
3. 房主迁移逻辑
4. 断线重连逻辑
5. 状态缓存触发
6. 屏幕路由同步

这使得文件膨胀，修改任何一部分都有连带风险。

**建议**: 拆分为：
- `gameState.js` - 纯响应式状态定义
- `hostProtocol.js` - 房主消息处理
- `guestProtocol.js` - 访客消息处理
- `hostMigration.js` - 房主迁移逻辑
- `gameActions.js` - 对外暴露的操作函数

#### 2.5 cachedRoom 与 gameState.room 双状态源

**问题**: `cachedRoom` 是房主侧的权威数据源（普通 JS 对象），`gameState.room` 是 Vue 响应式对象。每次 `updateLocalState` 都要做一次 `deepClone` 到 `gameState.room`。这意味着：
- 存在两个 "真相来源"
- `deepClone` 每次广播都要执行，性能开销不小
- Vue 组件修改 `gameState.room` 不会影响 `cachedRoom`（还好），但容易让人误以为修改 gameState.room 就能改变游戏状态

**建议**: 考虑让 `cachedRoom` 本身就是 reactive 对象，或者在 gameEngine 层面返回新的 room 对象而非原地修改。

#### 2.6 投票机制的 UX 混乱

**问题**: 当前投票流程：
1. 队友两人各自在 `GUESSING` 阶段提交猜测
2. 如果两人猜测一致 → 自动作为 finalGuess
3. 如果不一致 → 进入 `TEAM_VOTING`
4. 投票时只能从两人已有的选项中选择

**问题点**:
- 投票时两个选项中选一个，但两个选项可能都不对。实际上队友应该讨论后得出新答案，而不是二选一
- 投票结果 `submitTeamFinalVote` 直接把选中的 guess 设为 `finalGuess`，但实际上两个人可能都想改
- 当前实现没有 "重新讨论" 的机制

**建议**: 增加自由输入模式，或者至少允许在投票阶段提交新的猜测组合。

#### 2.7 对方拦截只有一人提交

**问题**: `room.opponentGuess` 是单一值，意味着对方队伍的拦截猜测只由一个人提交。但在实际游戏中，对方两人应该各自思考。

**当前行为**: 谁先提交谁就是拦截结果，后提交的人会被拒绝（"拦截猜测已提交"）。

**建议**: 
- 方案 A：对方两人各提交一次，如果一致则采用，不一致则对方内部投票（与加密方对称）
- 方案 B：明确游戏规则，对方队指定一人负责拦截（需在 UI 上体现）

#### 2.8 情报官的队友在加密阶段看不到密码

**问题**: 在 `ENCRYPTING` 阶段，只有情报官能看到密码和自己的关键词。队友只能看到 "等待情报"。这是符合游戏规则的（截码战原版规则），但 **队友在整个阶段无所事事**，体验不好。

**建议**: 可以在等待界面展示队友自己的关键词（让队友提前思考可能的关联），或者展示一个倒计时。

#### 2.9 room.status 与 room.phase 混用

**问题**: 
- `room.status` 取值：`'waiting'`、`'playing'`、`'paused'`、`'ended'`
- `room.phase` 取值：`GAME_PHASES` 的 7 个值
- 两者有重叠语义，且 `room.status` 是字符串而非常量引用

**代码中的混乱**:
```js
// gameEngine.js 第 248 行
room.status = 'playing';  // 字符串而非 GAME_PHASES 常量

// gameStore.js 第 1005 行
if (room.status === 'playing' && gameState.screen === 'lobby') {
  gameState.screen = 'game';
}
```

**建议**: 统一使用 `room.phase` 来驱动所有逻辑，移除 `room.status`，或明确划分 `status` 只用于 "游戏是否在进行" 的粗粒度判断。

---

### 🟢 P2 - 改进建议

#### 2.10 关键词库重复词条

**位置**: `keywords.js`

- `春天`、`夏天`、`秋天`、`冬天` 同时出现在 `nature` 和 `time` 分类
- `西瓜` 在 `fruits` 出现两次
- `端午节` 在 `festivals` 出现两次
- `西安`、`南京`、`杭州`、`苏州` 在 `cities` 出现两次
- `游戏` 在 `entertainment` 出现两次
- `彩虹` 在 `nature` 出现两次

`getAllKeywords()` 用了 `Set` 去重，所以不会出 Bug，但关键词库本身不干净。

**建议**: 清理重复词条，或改为每个词只属于一个分类。

#### 2.11 没有使用 Pinia

**问题**: 手动实现了一个 reactive 对象作为全局状态管理，而不是使用 Vue 生态标准的 Pinia。

**当前做法可接受**，因为项目规模不大，但：
- 缺少 DevTools 集成
- 缺少标准的 action/mutation 模式
- 状态修改路径难以追踪

**建议**: 如果项目会持续迭代，迁移到 Pinia 会更规范。

#### 2.12 缺少单元测试

**位置**: `src/services/__tests__/` 目录存在但未查看内容

package.json 配置了 vitest，但核心 gameEngine.js 的纯函数非常适合测试。

**建议**: 至少为以下函数补充测试：
- `processRound()` - 所有4种结果组合
- `checkWinCondition()` - 所有胜利条件
- `submitClues()` - 线索验证逻辑
- `generateCode()` - 唯一性保证

#### 2.13 笔记功能过于简陋

**问题**: `notes` 区域只记录了历史线索和结果，但玩家在游戏中最需要的是：
- 记录自己对敌方关键词的推理
- 标记已确认/已排除的关键词

**建议**: 增加个人笔记输入区域（本地状态，不广播），以及关键词标记功能（标记已知/未知）。

#### 2.14 敌方关键词全部显示 "???"

**问题**: 敌方关键词卡片上只显示序号和 "???"，没有任何视觉区分。玩家需要自己记住哪些关键词对应哪些序号。

**建议**: 至少给敌方关键词显示真实的词（截码战原版规则中，双方都能看到所有 8 个词），或者根据游戏规则确认是否需要隐藏。

---

## 三、游戏规则与交互设计问题

### 3.1 ⚠️ 关键规则问题：双方应该都能看到所有关键词

截码战 (Decrypto) 原版规则中，**所有 8 个关键词对双方都是公开的**。每队有自己的 4 个词编号 1-4，但对方的词也是可以看到的。游戏的核心乐趣在于：
- 你知道对方词的编号，可以用对方的线索推断对方的密码
- 你需要给线索让队友理解，但不让对方理解

**当前实现**：敌方关键词显示为 "???"，这与原版规则不符。这实际上大幅削弱了拦截的推理乐趣。

### 3.2 密码规则

当前密码从 [1,2,3,4] 中取 3 个不重复数字（Fisher-Yates），但原版 Decrypto 的密码是可以重复的（如 1-1-3），而且每次可以是从 1-4 中选 3 个有放回的数字。需要确认是否故意改为不重复。

### 3.3 轮换顺序

当前顺序：黑A → 白A → 黑B → 白B，这与原版一致。但需要确认：在原版中，每队内部的情报官是轮换的，即同一队的两人交替担任情报官。当前实现 `encryptorIndex` 在每次 nextRound 时通过 `rotationIndex` 隐式轮换，逻辑正确。

### 3.4 胜利条件

当前：2 个拦截标记或 2 个失误标记。原版 Decrypto 也是如此。✅ 正确。

---

## 四、P2P 通信可靠性问题

### 4.1 房主迁移的竞态条件

**位置**: `gameStore.js` 第 466-575 行

**问题**: 多个访客可能同时检测到房主断开，同时触发迁移。虽然有 `_migrationInProgress` 互斥锁，但：
- 5 秒安全阀之后会重置，如果迁移还没完成就重置了
- 新房主选举基于 `order` 最小的在线玩家，但所有访客看到的 `cachedRoom` 可能不一致

**建议**: 增加选举确认阶段，或使用更可靠的选举算法（如基于 playerId 字典序）。

### 4.2 访客之间没有直接连接的必要性

**位置**: `PEER_LIST` / `CONNECT_TO_PEER` 消息

**问题**: 当前架构中访客互相连接，但实际数据流是星型（房主→所有访客）。访客间连接只在房主迁移时有意义。但维护这些连接增加了复杂度。

**建议**: 简化为纯星型拓扑，只在迁移时按需建立访客间连接。

---

## 五、综合评分

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| 架构分层 | 8 | 三层解耦清晰，但 gameStore 职责过重 |
| 代码质量 | 7 | 整体规范，但存在字段名不一致、双状态源等问题 |
| P2P 可靠性 | 7 | 心跳+重试+幂等+迁移都做了，但迁移有竞态风险 |
| 游戏规则准确性 | 5 | 关键词可见性、密码规则与原版不一致 |
| 交互体验 | 6 | 视觉出色，但投票机制混乱、等待阶段体验差 |
| 可维护性 | 6 | gameStore 1165 行单文件、缺少单元测试 |
| 安全性 | 8 | sanitize 做得到位，权威节点模式天然防作弊 |

**总体**: 项目基础扎实，架构方向正确。主要问题集中在 gameStore 膨胀、游戏规则偏差和交互细节上。建议优先修复 P0 问题（双重执行风险），然后逐步拆分 gameStore 和修正游戏规则。

---

## 六、推荐行动计划（按优先级）

1. **【紧急】** 修复房主操作先广播后执行的顺序问题（2.1）
2. **【重要】** 修正敌方关键词可见性规则，与原版 Decrypto 对齐（3.1）
3. **【重要】** 统一 token 字段名（2.3）
4. **【重要】** 确认密码是否允许重复（3.2）
5. **【改进】** 拆分 gameStore.js（2.4）
6. **【改进】** 优化投票机制交互（2.6）
7. **【改进】** 对方拦截流程对称化（2.7）
8. **【改进】** 清理关键词重复（2.10）
9. **【改进】** 补充 gameEngine 单元测试（2.12）
10. **【改进】** 增强笔记和标记功能（2.13）
