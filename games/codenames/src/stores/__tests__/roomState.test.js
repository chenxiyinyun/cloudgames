import { beforeEach, describe, expect, it, vi } from 'vitest';

// roomState 在模块加载时注册 window.beforeunload，node 环境需要 window 垫片。
// 必须在 import 之前生效，故用 vi.hoisted（会被提升到所有 import 之上）。
vi.hoisted(() => {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
});

// 隔离缓存副作用（watch 触发时会调用，且 node 环境无 localStorage）
vi.mock('../../services/stateCache', () => ({
  saveStateToCache: vi.fn(),
  loadStateFromCache: vi.fn(() => null),
  clearStateCache: vi.fn(),
  hasCachedState: vi.fn(() => false),
  flushStateCache: vi.fn(),
  cancelPendingSave: vi.fn()
}));

import { gameState, getRoom, setRoom, updateLocalState, resetGameState } from '../roomState';

describe('codenames roomState accessors', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('returns the latest room reference after reassignment (no stale binding)', () => {
    const roomA = { code: 'ABCDEF', players: [] };
    const roomB = { code: 'GHIJKL', players: [] };

    setRoom(roomA);
    expect(getRoom()).toBe(roomA);

    // 整体重新赋值后，getRoom 必须返回新引用——这是拆分后的头号回归风险
    setRoom(roomB);
    expect(getRoom()).toBe(roomB);
    expect(getRoom().code).toBe('GHIJKL');
  });

  it('derives local player-facing state from the authoritative room', () => {
    gameState.playerId = 'p1';
    const room = {
      code: 'ABCDEF',
      hostId: 'p1',
      encryptorTeam: 'white',
      players: [
        { id: 'p1', team: 'white', isEncryptor: true, isOnline: true },
        { id: 'p2', team: 'black', isOnline: true }
      ],
      currentRound: 2,
      phase: 'guessing',
      status: 'playing'
    };

    updateLocalState(room);

    expect(gameState.isHost).toBe(true);
    expect(gameState.team).toBe('white');
    expect(gameState.isEncryptor).toBe(true);
    expect(gameState.room.players).toHaveLength(2);
    expect(gameState.room.currentRound).toBe(2);
  });

  it('resetGameState clears room and resets player identity', () => {
    gameState.playerId = 'p1';
    setRoom({ code: 'ABCDEF', players: [{ id: 'p1' }] });

    resetGameState();

    expect(getRoom()).toBeNull();
    expect(gameState.playerId).toBeNull();
    expect(gameState.roomCode).toBeNull();
    expect(gameState.isHost).toBe(false);
    expect(gameState.room.players).toHaveLength(0);
    expect(gameState.connectionStatus).toBe('disconnected');
  });
});
