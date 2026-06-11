# Bomb Defuse Implementation Plan

**Status:** Completed
**Date:** 2026-06-05
**Games affected:** bomb-defuse (双人拆弹)

---

## Architecture Note

This plan was originally written for the PeerJS/WebRTC P2P architecture. The game has since been migrated to the **server-authoritative WebSocket** model along with all other games. Key differences from the original plan:

- **Networking**: PeerJS/WebRTC → WebSocket (`src/shared/ws/createWebSocketService.js`)
- **State authority**: Host client → Server (`server/roomManager.js` + `server/games/bombdefuse.js`)
- **Client store**: 1000+ lines with P2P protocol → ~130 lines, only sends intents
- **No host migration**: Server is the single authority
- **No ICE/TURN/STUN**: Pure WebSocket, no NAT traversal needed
- **Reconnection**: Exponential backoff auto-reconnect + re-JOIN (server identifies by playerId)
- **Server tick**: `bombdefuse.js` adapter has a `tick()` method for countdown/end-condition checks

---

## Product Shape (unchanged)

**Game name:** `Bomb Defuse` / `双人拆弹`

**Directory:** `games/bomb-defuse/`

**Player count:** exactly 2 players.

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

**Implemented modules:**
- `wires`: cut exactly one wire using color/count/serial rules.
- `symbols`: press four symbol buttons in the manual-defined order.
- `keypad`: choose one button based on display, labels, serial parity, and previous answers.
- `password`: find the correct password from a list based on display characters.
- `maze`: navigate a visible path through a hidden maze grid.

---

## Completed Implementation

All tasks from the original plan have been completed. The game follows the standard server-authoritative pattern used by all games in this repo:

- `games/bomb-defuse/src/services/gameEngine.js` — Pure function engine (shared with server)
- `games/bomb-defuse/src/stores/gameStore.js` — Thin client store (sends intents only)
- `games/bomb-defuse/src/stores/network.js` — `createGameNetwork` wrapper
- `server/games/bombdefuse.js` — Server adapter (imports gameEngine, handles intents + tick)
