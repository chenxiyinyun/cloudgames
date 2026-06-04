# Bomb Defuse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-player online bomb-defusing puzzle game where one player sees the bomb controls and the other player sees the manual, forcing fast verbal cooperation under a countdown timer.

**Architecture:** Follow the existing game pattern in this repo: each game is a standalone Vite/Vue entry under `games/<game-name>/`, with PeerJS/WebRTC room creation and host-authoritative game state. Keep all rules in pure `services/gameEngine.js` functions, keep networking in store/service adapters, and render separate role-based views from the same synchronized room state.

**Tech Stack:** Vue 3 Composition API, Vite, PeerJS/WebRTC, existing shared online/P2P helpers, Vitest, native CSS.

---

## Product Shape

**Game name:** `Bomb Defuse` / `双人拆弹`

**Directory:** `games/bomb-defuse/`

**MVP player count:** exactly 2 players.

**Roles:**
- `defuser`: sees bomb shell, modules, timer, strikes, serial number, batteries, indicators.
- `expert`: sees only the manual pages and role-neutral room status.

**Core loop:**
1. Host creates a room.
2. Guest joins with room code.
3. Host starts the game after 2 online players are present.
4. Roles are assigned randomly or manually.
5. Defuser describes visible bomb details.
6. Expert reads manual rules and tells the defuser what to press/cut.
7. Each wrong action adds a strike.
8. Solving all modules before the deadline wins; hitting 3 strikes or timer expiry loses.

**MVP modules:**
- `wires`: cut exactly one wire using color/count/serial rules.
- `symbols`: press four symbol buttons in the manual-defined order.
- `keypad`: choose one button based on display, labels, serial parity, and previous answers.

**Out of scope for MVP:**
- Built-in voice chat.
- More than 2 players.
- Anti-cheat secrecy against devtools inspection.
- Custom module editor.
- Persistent leaderboard.

---

## State Model

Add a game-specific state shape similar to existing `catguess` and `codenames` rooms.

```js
export const GAME_PHASES = {
  WAITING: 'waiting',
  ROLE_SELECT: 'role_select',
  PLAYING: 'playing',
  SOLVED: 'solved',
  EXPLODED: 'exploded',
  ENDED: 'ended'
};
```

Room shape:

```js
{
  id: roomCode,
  code: roomCode,
  hostId: hostPlayerId,
  status: GAME_PHASES.WAITING,
  phase: GAME_PHASES.WAITING,
  players: [
    {
      id,
      name,
      isHost,
      isOnline,
      order,
      role: null // 'defuser' | 'expert'
    }
  ],
  gameState: {
    seed,
    startedAt: null,
    deadlineAt: null,
    durationMs: 300000,
    strikeLimit: 3,
    strikes: [],
    serialNumber: '',
    batteries: 0,
    indicators: [],
    modules: [],
    solvedModuleIds: [],
    actionLog: [],
    result: null
  },
  disconnectedPlayers: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
}
```

Module shape:

```js
{
  id: 'module-1',
  type: 'wires',
  status: 'unsolved', // 'unsolved' | 'solved'
  bombView: {},       // visible to defuser
  manualView: {},     // visible to expert
  solution: {}        // rule result used by host-side validation
}
```

For MVP, both clients may receive the full room state because this is a casual P2P party game. The UI must still render only the current player's role view. If later secrecy matters, split `ROOM_STATE` into role-specific payloads.

---

## Implementation Tasks

### Task 1: Scaffold Game Folder

**Files:**
- Create: `games/bomb-defuse/index.html`
- Create: `games/bomb-defuse/src/main.js`
- Create: `games/bomb-defuse/src/App.vue`
- Create: `games/bomb-defuse/src/style.css`
- Create: `games/bomb-defuse/src/components/MenuScreen.vue`
- Create: `games/bomb-defuse/src/components/LobbyScreen.vue`
- Create: `games/bomb-defuse/src/components/GameScreen.vue`
- Create: `games/bomb-defuse/src/components/ResultScreen.vue`
- Create: `games/bomb-defuse/src/components/ToastNotification.vue`

**Step 1: Copy the existing standalone app structure**

Use `games/catguess/` as the starting reference because it already has diagnostics, overlays, reconnect, and split store modules. Keep imports local to `games/bomb-defuse/src`.

**Step 2: Replace visible copy and branding**

Use product labels:
- Chinese name: `双人拆弹`
- English name: `Bomb Defuse`
- Room actions: `创建任务`, `加入任务`, `开始拆弹`

**Step 3: Run build to catch import errors**

Run:

```bash
npm run build
```

Expected:
- Build still passes because the new game is not yet wired into Vite inputs.

**Step 4: Commit**

```bash
git add games/bomb-defuse
git commit -m "feat: scaffold bomb defuse game"
```

---

### Task 2: Add Pure Game Engine

**Files:**
- Create: `games/bomb-defuse/src/services/gameEngine.js`
- Create: `games/bomb-defuse/src/services/__tests__/gameEngine.test.js`

**Step 1: Write failing tests**

Create tests for:
- room creation allows exactly one host player.
- second player can join.
- third player is rejected.
- game cannot start with fewer than 2 online players.
- starting game assigns one `defuser` and one `expert`.
- wrong actions add strikes.
- 3 strikes sets phase to `exploded`.
- all modules solved sets phase to `solved`.

Example:

```js
import { describe, expect, it } from 'vitest';
import {
  GAME_PHASES,
  addPlayerToRoom,
  createInitialRoom,
  startGame
} from '../gameEngine';

describe('bomb defuse game engine', () => {
  it('starts only with two online players and assigns roles', () => {
    const room = createInitialRoom('p1', 'Host', 'ABCD');
    addPlayerToRoom(room, 'Guest', 'p2');

    const result = startGame(room, { seed: 'test-seed' });

    expect(result.error).toBeUndefined();
    expect(room.phase).toBe(GAME_PHASES.PLAYING);
    expect(room.players.map(p => p.role).sort()).toEqual(['defuser', 'expert']);
    expect(room.gameState.modules).toHaveLength(3);
  });
});
```

**Step 2: Run the test and verify failure**

Run:

```bash
npm test -- games/bomb-defuse/src/services/__tests__/gameEngine.test.js
```

Expected:
- FAIL because the engine file does not exist yet.

**Step 3: Implement minimal engine**

Export:
- `GAME_PHASES`
- `MODULE_TYPES`
- `generatePlayerId`
- `createInitialRoom`
- `addPlayerToRoom`
- `removePlayerFromRoom`
- `startGame`
- `assignRoles`
- `submitModuleAction`
- `recordStrike`
- `checkEndCondition`
- `restartGame`
- `getPlayerRole`

Keep all functions deterministic where possible. Accept optional `{ seed }` in `startGame` for repeatable tests.

**Step 4: Run tests**

Run:

```bash
npm test -- games/bomb-defuse/src/services/__tests__/gameEngine.test.js
```

Expected:
- PASS.

**Step 5: Commit**

```bash
git add games/bomb-defuse/src/services/gameEngine.js games/bomb-defuse/src/services/__tests__/gameEngine.test.js
git commit -m "feat: add bomb defuse game engine"
```

---

### Task 3: Implement Puzzle Generators And Validators

**Files:**
- Create: `games/bomb-defuse/src/services/modules/wires.js`
- Create: `games/bomb-defuse/src/services/modules/symbols.js`
- Create: `games/bomb-defuse/src/services/modules/keypad.js`
- Create: `games/bomb-defuse/src/services/modules/index.js`
- Create: `games/bomb-defuse/src/services/modules/__tests__/wires.test.js`
- Create: `games/bomb-defuse/src/services/modules/__tests__/symbols.test.js`
- Create: `games/bomb-defuse/src/services/modules/__tests__/keypad.test.js`

**Step 1: Write tests for each module**

Wires:
- if there are no red wires, cut the second wire.
- if last wire is white and serial is odd, cut the last wire.
- if more than one blue wire, cut the last blue wire.
- otherwise cut the last wire.

Symbols:
- manual has columns of symbols.
- generated symbols must all belong to at least one shared column.
- solution order follows that column order.

Keypad:
- display and button labels generate a single expected button id.
- validator accepts only that expected id.

**Step 2: Implement deterministic module APIs**

Each module exports:

```js
export function generateWiresModule(context, random) {
  return {
    id: context.id,
    type: 'wires',
    status: 'unsolved',
    bombView: {},
    manualView: {},
    solution: {}
  };
}

export function validateWiresAction(module, action) {
  return action.type === 'cut_wire' && action.wireId === module.solution.wireId;
}
```

Use a tiny seeded random helper in `modules/index.js` so tests can force outputs.

**Step 3: Connect module generation to `startGame`**

`startGame` should call `generateBombModules({ seed, serialNumber, batteries, indicators })` and store exactly 3 modules for MVP.

**Step 4: Run tests**

Run:

```bash
npm test -- games/bomb-defuse/src/services/modules
npm test -- games/bomb-defuse/src/services/__tests__/gameEngine.test.js
```

Expected:
- PASS.

**Step 5: Commit**

```bash
git add games/bomb-defuse/src/services
git commit -m "feat: add bomb puzzle modules"
```

---

### Task 4: Add Store And Network Layer

**Files:**
- Create: `games/bomb-defuse/src/stores/state.js`
- Create: `games/bomb-defuse/src/stores/cache.js`
- Create: `games/bomb-defuse/src/stores/timers.js`
- Create: `games/bomb-defuse/src/stores/network.js`
- Create: `games/bomb-defuse/src/stores/gameStore.js`
- Create: `games/bomb-defuse/src/services/p2p.js`
- Create: `games/bomb-defuse/src/services/online.js`
- Create: `games/bomb-defuse/src/services/logger.js`
- Create: `games/bomb-defuse/src/services/sanitize.js`
- Create: `games/bomb-defuse/src/services/stateCache.js`
- Create: `games/bomb-defuse/src/services/useIdempotency.js`
- Create: `games/bomb-defuse/src/stores/__tests__/roomState.test.js`
- Create: `games/bomb-defuse/src/stores/__tests__/reconnect.test.js`

**Step 1: Copy proven networking structure**

Start from `games/catguess/src/stores/` and `games/catguess/src/services/`. Replace:
- peer namespace: `catguess-${roomCode}` -> `bombdefuse-${roomCode}`
- max players: `6` -> `2`
- game actions: story/vote/card actions -> module actions and role controls.

**Step 2: Add message names**

In local `online.js`, export message constants:
- `START_GAME`
- `ASSIGN_ROLE`
- `SUBMIT_MODULE_ACTION`
- `TICK_TIMER`
- `END_GAME`
- `RESTART_GAME`
- existing join/reconnect/state messages from current games.

**Step 3: Implement high-level store API**

`gameStore.js` should export:
- `createRoom(name)`
- `joinRoom(name, code)`
- `reconnectRoom()`
- `leaveRoom()`
- `handleStartGame(options)`
- `handleAssignRoles(roleByPlayerId)`
- `handleSubmitModuleAction(moduleId, action)`
- `handleRestartGame()`
- `handleEndGame()`
- `cleanup()`
- `gameState`

**Step 4: Add host-authoritative action handling**

Only the host mutates room state. Guests send `SUBMIT_MODULE_ACTION` to the host. Host runs `submitModuleAction(room, playerId, moduleId, action)`, broadcasts full state, and schedules/clears timers.

**Step 5: Run network/store tests**

Run:

```bash
npm test -- games/bomb-defuse/src/stores
```

Expected:
- PASS after adapting existing room/reconnect behavior.

**Step 6: Commit**

```bash
git add games/bomb-defuse/src/stores games/bomb-defuse/src/services
git commit -m "feat: wire bomb defuse room networking"
```

---

### Task 5: Build Role-Based Screens

**Files:**
- Modify: `games/bomb-defuse/src/App.vue`
- Modify: `games/bomb-defuse/src/components/MenuScreen.vue`
- Modify: `games/bomb-defuse/src/components/LobbyScreen.vue`
- Modify: `games/bomb-defuse/src/components/GameScreen.vue`
- Modify: `games/bomb-defuse/src/components/ResultScreen.vue`
- Create: `games/bomb-defuse/src/components/BombPanel.vue`
- Create: `games/bomb-defuse/src/components/ManualPanel.vue`
- Create: `games/bomb-defuse/src/components/modules/WiresModule.vue`
- Create: `games/bomb-defuse/src/components/modules/SymbolsModule.vue`
- Create: `games/bomb-defuse/src/components/modules/KeypadModule.vue`
- Create: `games/bomb-defuse/src/components/ConnectionOverlay.vue`
- Create: `games/bomb-defuse/src/components/DiagnosticsPanel.vue`

**Step 1: Menu**

Render:
- player name input.
- create room button.
- room code input.
- join room button.
- restore/reconnect prompt when cache exists.

**Step 2: Lobby**

Render:
- room code copy UI.
- two player slots.
- role assignment preview.
- host-only start button enabled only at 2 online players.

**Step 3: Game screen**

Render common header:
- countdown timer.
- strikes.
- room code.
- player names and roles.

Render role area:
- `defuser`: `BombPanel` with modules and action controls.
- `expert`: `ManualPanel` with searchable tabs for Wires, Symbols, Keypad.

**Step 4: Result screen**

Render:
- solved/exploded result.
- elapsed time.
- strike count.
- action log.
- host-only restart button.

**Step 5: Manual test locally**

Run:

```bash
npm run dev
```

Open:
- `http://localhost:5173/games/bomb-defuse/`

Expected:
- menu renders without console errors.
- host and guest browser tabs can join the same room.
- after start, one tab sees bomb controls and the other sees manual.

**Step 6: Commit**

```bash
git add games/bomb-defuse/src
git commit -m "feat: add bomb defuse role screens"
```

---

### Task 6: Add Countdown And End Conditions

**Files:**
- Modify: `games/bomb-defuse/src/stores/timers.js`
- Modify: `games/bomb-defuse/src/stores/gameStore.js`
- Modify: `games/bomb-defuse/src/services/gameEngine.js`
- Modify: `games/bomb-defuse/src/services/__tests__/gameEngine.test.js`

**Step 1: Add failing tests**

Test:
- timer expiry changes phase to `exploded`.
- solving before expiry changes phase to `solved`.
- actions after ended phase are rejected.

**Step 2: Implement host timer**

Host sets `deadlineAt = Date.now() + durationMs` at start. Host runs a 250ms or 500ms interval locally. Guests compute display from synced `deadlineAt`, not from their own interval authority.

**Step 3: Broadcast only meaningful updates**

Broadcast when:
- game starts.
- a module action changes state.
- timer expires.
- host migrates/reconnects.

Avoid broadcasting every timer tick. Clients can render countdown locally.

**Step 4: Run tests**

Run:

```bash
npm test -- games/bomb-defuse/src/services/__tests__/gameEngine.test.js
```

Expected:
- PASS.

**Step 5: Commit**

```bash
git add games/bomb-defuse/src/stores games/bomb-defuse/src/services/gameEngine.js games/bomb-defuse/src/services/__tests__/gameEngine.test.js
git commit -m "feat: add bomb defuse countdown"
```

---

### Task 7: Style For Tense Two-Player Play

**Files:**
- Modify: `games/bomb-defuse/src/style.css`
- Modify: module components under `games/bomb-defuse/src/components/`

**Visual direction:**
- Dark utilitarian control room, not a marketing page.
- High-contrast timer.
- Clear module boundaries with 8px or smaller radius.
- Large touch targets for module actions.
- Manual pages should feel like a compact field manual.
- Avoid decorative orbs, oversized hero sections, and nested cards.

**Responsive targets:**
- Desktop: two-column split where bomb/manual panels have generous width.
- Mobile defuser: module stack with sticky timer.
- Mobile expert: tabs/search plus compact manual rules.

**Step 1: Add stable layout dimensions**

Use fixed module aspect ratios and stable button sizes so solved/hover states do not shift layout.

**Step 2: Check text fit**

Verify long room codes, player names, symbol labels, and manual rule text do not overflow on 360px width.

**Step 3: Manual QA**

Run:

```bash
npm run dev
```

Check:
- `http://localhost:5173/games/bomb-defuse/` at desktop width.
- browser device toolbar at 390x844.

**Step 4: Commit**

```bash
git add games/bomb-defuse/src
git commit -m "style: polish bomb defuse interface"
```

---

### Task 8: Wire Game Into Portal And Build Config

**Files:**
- Modify: `vite.config.js`
- Modify: `src/portal/App.vue`
- Modify: `README.md`

**Step 1: Add Vite input**

In `vite.config.js`:

```js
rollupOptions: {
  input: {
    main: resolve(__dirname, 'index.html'),
    codenames: resolve(__dirname, 'games/codenames/index.html'),
    catguess: resolve(__dirname, 'games/catguess/index.html'),
    bombDefuse: resolve(__dirname, 'games/bomb-defuse/index.html')
  }
}
```

**Step 2: Add test include**

In `vite.config.js` test includes:

```js
'games/bomb-defuse/src/**/*.test.js'
```

**Step 3: Add portal card**

Add:
- `name: '双人拆弹'`
- `englishName: 'Bomb Defuse'`
- `description: '一人看炸弹，一人看说明书，在倒计时内合作解除模块。'`
- `href: 'games/bomb-defuse/'`
- `color: '#f0523d'`

**Step 4: Update README**

Add game row:

```md
| [双人拆弹 (Bomb Defuse)](./games/bomb-defuse/) | 双人在线协作拆弹解谜游戏 |
```

**Step 5: Run full checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:
- PASS.

**Step 6: Commit**

```bash
git add vite.config.js src/portal/App.vue README.md
git commit -m "feat: publish bomb defuse entry"
```

---

### Task 9: Two-Tab Multiplayer QA

**Files:**
- No required code changes unless bugs are found.

**Step 1: Start dev server**

Run:

```bash
npm run dev
```

**Step 2: Test host and guest**

Open two browser tabs:
- host: `http://localhost:5173/games/bomb-defuse/`
- guest: `http://localhost:5173/games/bomb-defuse/`

Scenario:
1. Host creates room as `A`.
2. Guest joins room as `B`.
3. Host starts game.
4. Confirm role split.
5. Submit one wrong module action.
6. Confirm strikes increment on both tabs.
7. Solve all modules.
8. Confirm solved result on both tabs.
9. Restart.
10. Refresh guest tab and confirm reconnect flow.

**Step 3: Fix discovered issues**

If any issue appears, write a focused failing test first when it is engine/store behavior. UI-only visual bugs can be fixed directly with manual verification.

**Step 4: Final checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected:
- PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "fix: stabilize bomb defuse multiplayer flow"
```

---

## Acceptance Criteria

- Two players can create/join a room through WebRTC.
- A third player cannot join an active or waiting Bomb Defuse room.
- Host can start only when exactly two online players are present.
- Roles are visible and different for the two players.
- Defuser sees interactive bomb modules.
- Expert sees manual pages, not interactive bomb controls.
- Wrong actions add strikes.
- Three strikes explode the bomb.
- Solving all MVP modules wins the game.
- Timer expiry explodes the bomb.
- Refresh/reconnect preserves player identity when cache exists.
- `npm test`, `npm run lint`, and `npm run build` pass.

---

## Risk Notes

- Existing source files show some mojibake in Chinese text. New files should be saved as UTF-8 and should not copy garbled strings from older files.
- PeerJS/WebRTC reliability depends on the existing TURN/STUN configuration. This game should not add new backend requirements.
- Countdown should be host-authoritative but client-rendered to avoid noisy broadcasts.
- Puzzle secrecy is UI-level only in MVP. Do not market it as cheat-proof.
- Keep module rules simple first. The fun comes from communication pressure, not rule complexity.

