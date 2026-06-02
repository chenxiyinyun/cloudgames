# Catguess Reconnection Fix — Implementation Plan

**Status:** Ready for execution  
**Date:** 2026-05-31  
**Games affected:** catguess (喵喵猜词)  
**Shared code affected:** `src/shared/p2p/createP2PService.js`, `src/shared/p2p/peerConfig.js`  
**Test framework:** vitest

---

## Overview

Fix 9 root causes ranked by severity in the catguess game's reconnection system. The core thesis: make reconnection transparent (auto, fast, with visual feedback), make guest disconnection non-blocking, prevent the host's reconnect from killing all guests, fix race conditions in host migration, and add ICE restart capability to the shared P2P layer.

**Architecture constraint:** All changes must remain compatible with the codenames game's use of the shared P2P infrastructure. No server-side code possible (GitHub Pages static hosting).

---

## Prioritized Task List with Dependencies

```
Phase 1: Foundation (no deps)
  T1 — Add ICE restart + reactive connection state to shared P2PService
  T2 — Add Asian-region TURN servers to peerConfig.js

Phase 2: Reconnection Engine (depends on T1)
  T3 — Implement auto-reconnect with exponential backoff
  T4 — Soft-disconnect: don't destroy all peer connections on reconnectRoom()
  T5 — Full state snapshot protocol: REQUEST_STATE / full state on reconnect

Phase 3: Game Logic Fixes (depends on T2-T5)
  T6 — Fix host migration race condition (mutex in guest "wait" branch)
  T7 — Auto-skip disconnected players in game phases
  T8 — Refactor gameStore: extract useHostHandler / useGuestHandler / useHostMigration

Phase 4: UI/UX (depends on T3, T6-T7)
  T9 — Disconnection overlay component (ConnectionOverlay.vue)
  T10 — Wire overlay into GameScreen, LobbyScreen, MenuScreen, App.vue

Phase 5: Polish & Verification (depends on all above)
  T11 — Test suite: ICE restart, reconnect backoff, host migration race, auto-skip
  T12 — End-to-end manual test checklist
```

---

## Task Details

### T1 — Add ICE Restart + Reactive Connection State to Shared P2PService

**Files:** `src/shared/p2p/createP2PService.js`

**Current state:** `_watchConnectionState()` (L293-311) monitors `iceconnectionstatechange` but only logs state — no recovery action.

**Changes:**

1. Add `onConnectionStateChange` callback to constructor
2. Rewrite `_watchConnectionState()` with ICE restart logic:
   - On `disconnected`: start 3s guard timer → `pc.restartIce()` after timer
   - On `failed`: call `pc.restartIce()` immediately
   - On `connected`/`completed`: clear guard timer, reset recovery state
   - Fire `onConnectionStateChange({ peerId, iceState, connectionState, mode })` on every change
3. Add `_recoveryAttempts` (Map), `_iceGuardTimers` (Map) to constructor
4. Add `getPeerConnectionState(peerId)`, `resetRecoveryState(peerId)` methods
5. Clean up in `_setupConnection` close/error handlers and `disconnect()`

**Backward compatibility:** All additive. `onConnectionStateChange` is opt-in.

**Estimated effort:** 2.5 hours

---

### T2 — Add Asian-Region TURN Servers

**Files:** `src/shared/p2p/peerConfig.js`, `README.md`

**Changes:**

1. Add `VITE_METERED_TURN_REGION` env var (`'global' | 'sg' | 'jp' | 'seoul'`)
2. Build `METERED_TURN_SERVERS` with region-based host (`${region}.relay.metered.ca`)
3. Add `stun:stun.qq.com:3478` for redundancy (国内低延迟，避免依赖 Google STUN)
4. Document in README.md

**Estimated effort:** 0.5 hours

---

### T3 — Auto-Reconnect with Exponential Backoff

**Files:** `games/catguess/src/stores/gameStore.js`

**Changes:**

1. Add `_autoReconnectTimer`, `_reconnectAttempts`, `MAX_RECONNECT_ATTEMPTS = 8`
2. `registerAutoReconnectHandlers()` — wired to `p2p.onConnectionStateChange`
3. `startAutoReconnect()` — exponential backoff: 1s→2s→4s→8s→16s→32s with ±25% jitter
4. `cancelAutoReconnect()` — clear timer, reset counter
5. Periodic connection quality check (3s interval)
6. Clean up in `cleanup()`

**Estimated effort:** 3 hours

---

### T4 — Soft-Disconnect: Don't Destroy All Connections

**Files:** `src/shared/p2p/createP2PService.js`, `games/catguess/src/stores/gameStore.js`

**Changes:**

1. Add `disconnectPeer(peerId)` to P2PService — removes one connection, keeps others
2. Add `softDisconnect()` — destroys peer identity only, preserves connections array
3. Modify `reconnectRoom()` to use `softDisconnect()` instead of `disconnect()`
4. Add `reconnectRoomInternal()` — guest-targeted reconnect helper
5. Host `onPlayerDisconnected`: mark offline instead of removing (treat ALL disconnects as potentially temporary)

**Estimated effort:** 2 hours

---

### T5 — Full State Snapshot Protocol (REQUEST_STATE)

**Files:** `src/shared/online/messages.js`, `games/catguess/src/services/online.js`, `games/catguess/src/stores/gameStore.js`

**Changes:**

1. Add `REQUEST_STATE` to shared `ONLINE_MESSAGE_TYPES`
2. Add to catguess `MSG` and `makeCatguessOpKey`
3. Guest sends `REQUEST_STATE` immediately after reconnecting
4. Host responds with full `ROOM_STATE` (not delta)
5. Guest treats full state as authoritative on reconnect, clears reconnect counter

**Estimated effort:** 1.5 hours

---

### T6 — Fix Host Migration Race Condition

**Files:** `games/catguess/src/stores/gameStore.js`

**Root cause:** `_migrationInProgress = true` at L738 is set AFTER the order check (L732-736), leaving a window where the mutex is not held for the "wait for new host" branch.

**Changes:**

1. Move `_migrationInProgress = true` BEFORE the order check
2. Add 10s `_migrationWaitTimer` on wait branch — if HOST_MIGRATION doesn't arrive, re-evaluates
3. Clear `_migrationWaitTimer` in HOST_MIGRATION handler
4. Clean up in `cleanup()`

**Estimated effort:** 1.5 hours

---

### T7 — Auto-Skip Disconnected Players in Game Phases

**Files:** `games/catguess/src/stores/gameStore.js`, `games/catguess/src/services/gameEngine.js`

**Changes:**

1. Add `skipDisconnectedPlayer(room, playerId)` to gameEngine.js — handles all 3 phases
2. Modify `schedulePickingTimeout()`: if storyteller is offline → 3s delay instead of 60s
3. Add `scheduleDisconnectedSkipCheck()` — runs every 5s on host, skips offline players proactively
4. Voting phase: offline voters auto-marked as abstained (votedCardId: -1)

**Estimated effort:** 2.5 hours

---

### T8 — Refactor gameStore: Extract Composables

**Files:** New: `useHostHandler.js`, `useGuestHandler.js`, `useHostMigration.js` in `games/catguess/src/services/`  
Modify: `games/catguess/src/stores/gameStore.js` (reduce from 1413 → ~900 lines)

**Strategy:** Follow codenames' composable pattern. Each composable takes `{ cachedRoom, gameState, p2p, ...callbacks }` and returns `{ setupHandlers }`.

**New files:**
- `useHostHandler.js` (~280 lines): host message handling + `setupHostHandlers()`
- `useGuestHandler.js` (~180 lines): guest message handling + `setupGuestHandlers()`
- `useHostMigration.js` (~150 lines): `handleHostDisconnect()` + `becomeNewHost()`

**Estimated effort:** 3.5 hours

---

### T9 — Disconnection Overlay Component

**Files:** `games/catguess/src/components/ConnectionOverlay.vue` (new)

**Design:**
- Fixed overlay with frosted glass effect (z-index: 9000)
- States: connecting (🔗 + dots), reconnecting (🔄 + attempt count), disconnected (⚠️ + retry), error (❌ + retry + leave)
- Clean fade transition (0.3s)
- Uses existing `--cat-*` CSS variables
- Bouncing dot animation for progress states

**Estimated effort:** 1.5 hours

---

### T10 — Wire Overlay into All Screens

**Files:** `App.vue`, `GameScreen.vue`, `LobbyScreen.vue`, `MenuScreen.vue`, `gameStore.js`

**Changes:**

1. App.vue: add `<ConnectionOverlay>` at root level, wired to `gameState.connectionStatus`
2. GameScreen.vue: add thin reconnection banner (non-blocking, for transient reconnects)
3. MenuScreen/LobbyScreen: keep existing inline status bar; overlay covers for severe disconnects
4. Expose `RECONNECT_METADATA` from gameStore.js (attempt count + max)

**Behavior matrix:**

| connectionStatus | Overlay (App.vue) | Banner (GameScreen) | Status Bar (Menu/Lobby) |
|---|---|---|---|
| `connected` | Hidden | Hidden | Hidden |
| `connecting` | Visible + progress | — | Visible |
| `reconnecting` | Visible + progress + count | Visible ("🔄 重连中...") | Visible |
| `disconnected` | Visible + retry | Hidden (overlay covers) | Visible |
| `error` | Visible + retry + leave | Hidden | Visible |

**Estimated effort:** 1.5 hours

---

### T11 — Comprehensive Test Suite

**New test files (6):**
1. `src/shared/p2p/__tests__/createP2PService.test.js` (~200 lines)
2. `games/catguess/src/services/__tests__/reconnect.test.js` (~200 lines)
3. `games/catguess/src/services/__tests__/hostMigration.test.js` (~150 lines)
4. `games/catguess/src/services/__tests__/autoSkip.test.js` (~120 lines)
5. `games/catguess/src/services/__tests__/hostHandler.test.js` (~100 lines)
6. `games/catguess/src/services/__tests__/guestHandler.test.js` (~80 lines)

**Updated test files (3):**
- `p2p.test.js`, `online.test.js`, `vite.config.js` (test include pattern)

**Estimated effort:** 4 hours

---

### T12 — End-to-End Manual Test Checklist

**File:** `.sisyphus/plans/catguess-reconnect-checklist.md`

**15 test scenarios covering:**
- Host WiFi disconnect/reconnect (auto + manual)
- Guest WiFi disconnect/reconnect (auto + cache restore)
- Host browser close → migration
- Multiple guests disconnect simultaneously
- Storyteller disconnects mid-picking → auto-skip
- Voter disconnects mid-voting → abstained
- All guests disconnect → game pause
- ICE transient flip → guard timer prevents unnecessary action
- ICE failed → immediate restart
- Flapping network → exponential backoff
- Page refresh + cache restore
- TURN region testing (Singapore)
- Connection quality monitoring

**Estimated effort:** 1.5 hours

---

## Atomic Commit Strategy

```
Commit 1  [T1]  feat(p2p): add ICE restart + reactive connection state monitoring
Commit 2  [T2]  feat(p2p): add Asian-region TURN server configuration support
Commit 3  [T3]  feat(catguess): implement auto-reconnect with exponential backoff
Commit 4  [T4]  fix(catguess): soft-disconnect prevents reconnect from killing all peers
Commit 5  [T5]  feat(catguess): full state snapshot protocol on reconnect (REQUEST_STATE)
Commit 6  [T6]  fix(catguess): close host migration race condition mutex gap
Commit 7  [T7]  feat(catguess): auto-skip disconnected players in game phases
Commit 8  [T8]  refactor(catguess): extract host/guest/migration composables from gameStore
Commit 9  [T9]  feat(catguess): add ConnectionOverlay component
Commit 10 [T10] feat(catguess): wire connection overlay into all screens
Commit 11 [T11] test: comprehensive test suite for reconnect, ICE restart, migration, auto-skip
Commit 12 [T12] docs: end-to-end manual test checklist for reconnection
```

---

## Estimated Total Effort

| Phase | Hours |
|-------|-------|
| 1: Foundation (T1+T2) | 3.0 |
| 2: Reconnect Engine (T3+T4+T5) | 6.5 |
| 3: Game Logic (T6+T7+T8) | 7.5 |
| 4: UI/UX (T9+T10) | 3.0 |
| 5: Polish (T11+T12) | 5.5 |
| **Total** | **25.5 hours** |

---

## Files Summary

**NEW (9):**
- `src/shared/p2p/__tests__/createP2PService.test.js`
- `games/catguess/src/services/__tests__/reconnect.test.js`
- `games/catguess/src/services/__tests__/hostMigration.test.js`
- `games/catguess/src/services/__tests__/autoSkip.test.js`
- `games/catguess/src/services/useHostHandler.js`
- `games/catguess/src/services/useGuestHandler.js`
- `games/catguess/src/services/useHostMigration.js`
- `games/catguess/src/components/ConnectionOverlay.vue`
- `.sisyphus/plans/catguess-reconnect-checklist.md`

**MODIFIED (12):**
- `src/shared/p2p/createP2PService.js` [T1, T4]
- `src/shared/p2p/peerConfig.js` [T2]
- `src/shared/online/messages.js` [T5]
- `games/catguess/src/services/online.js` [T5]
- `games/catguess/src/services/gameEngine.js` [T7]
- `games/catguess/src/stores/gameStore.js` [T3,T4,T5,T6,T7,T8]
- `games/catguess/src/components/App.vue` [T10]
- `games/catguess/src/components/GameScreen.vue` [T10]
- `games/catguess/src/components/LobbyScreen.vue` [T10]
- `games/catguess/src/components/MenuScreen.vue` [T10]
- `README.md` [T2]
- `vite.config.js` [T11]

---

## Root Cause Coverage

| # | Root Cause | Addressed By | Severity |
|---|-----------|-------------|----------|
| 1 | TURN server overseas (Canada) | T2: Asian-region TURN config | High |
| 2 | No ICE restart | T1: ICE restart with 3s guard + immediate on failed | Critical |
| 3 | Manual-only reconnect | T3: Auto-reconnect with exponential backoff | Critical |
| 4 | No disconnection UI overlay | T9+T10: ConnectionOverlay + banner | High |
| 5 | Migration race condition | T6: Mutex before order check + waitTimeout | Critical |
| 6 | Host reconnect kills all guests | T4: softDisconnect + mark-offline handler | Critical |
| 7 | Disconnected players block game | T7: skipDisconnectedPlayer + proactive check | High |
| 8 | Passive state catch-up | T5: REQUEST_STATE for explicit snapshot | Medium |
| 9 | Duplicate code between games | T8: Extract composables | Low-Medium |
