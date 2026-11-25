import { describe, it, expect } from 'vitest';
import {
  createFreshState,
  normalizeState,
  isFreshState,
  grantStarterItems,
  grantWelcomeLetter,
  syncDiscoveredSouvenirs,
  isSouvenirDiscovered,
  ownedSouvenirCount,
  harvestGarden,
  craftItem,
  startTrip,
  resolveTrip,
  replyLetter,
  equipQuirk,
  placeSouvenir,
  computeRoomAura,
  tradeWithVisitor,
  petBeast,
  getBeastStampBlessing,
  forceReturn,
  hourglassLeft,
  CONSTANTS,
  EVENTS
} from '../gameSystems.js';

describe('山海来信 v2.0 规则引擎', () => {
  it('初始存档：三只初始神兽已解锁、精卫未解锁，兼容迁移 v1 存档', () => {
    const state = createFreshState();
    expect(state.beasts.baize.unlocked).toBe(true);
    expect(state.beasts.jiuweihu.unlocked).toBe(true);
    expect(state.beasts.qingniao.unlocked).toBe(true);
    expect(state.beasts.jingwei.unlocked).toBe(false);
    expect(state.stamps).toEqual(['jianzi', 'pingan', 'shanhai']);

    const v1 = {
      v: 1,
      beasts: { baize: { insight: 2, insightExp: 9, travels: 4, memory: { look_out: 1 } } },
      souvenirs: { 'sou-silk': 2 },
      letters: [{ id: 'L1', beastId: 'baize', beastName: '白泽', title: '旧信', body: '正文', reply: [{ text: '好', memory: { brave: 1 } }], replied: 0 }]
    };
    const migrated = normalizeState(v1, false);
    expect(migrated.beasts.baize.insight).toBe(2);
    expect(migrated.beasts.baize.traits).toEqual({ scholar: 0, empathy: 0, calm: 0, food: 0, brave: 0 });
    expect(migrated.beasts.jingwei.unlocked).toBe(false);
    expect(migrated.letters[0].opened).toBe(true);
    expect(migrated.souvenirs['sou-silk']).toBe(2);
  });

  it('庭院采摘与茶案手作闭环', () => {
    const state = createFreshState();
    const now = 1_760_000_000_000;
    const h1 = harvestGarden(state, now);
    expect(h1.ok).toBe(true);
    expect(h1.gotMaterials.length).toBeGreaterThanOrEqual(3);

    const hCooldown = harvestGarden(state, now + 1000);
    expect(hCooldown.ok).toBe(false);
    expect(hCooldown.remain).toBeGreaterThan(0);

    state.materials.cinnabar = 2;
    state.materials.bamboo_shoot = 1;
    state.materials.dew = 1;
    const craftRes = craftItem(state, 'compass');
    expect(craftRes.ok).toBe(true);
    expect(state.inventory.compass).toBe(1);
    expect(state.materials.cinnabar).toBeUndefined();
  });

  it('跨城捎物委托：携带信物直达目标城，收获传家宝与闲章', () => {
    const state = createFreshState();
    grantStarterItems(state);
    state.souvenirs['sou-silk'] = 1;

    const now = 1_760_000_000_000;
    const started = startTrip(state, 'baize', 'ancient', ['camera'], {
      giftSouvenir: 'sou-silk',
      now
    });
    expect(started.ok).toBe(true);
    expect(started.trip.stops[0].city).toBe('dunhuang');
    expect(state.souvenirs['sou-silk']).toBeUndefined();

    const res = resolveTrip(state, 'baize', now + 60 * 60 * 1000);
    expect(res).toBeTruthy();
    expect(state.commissions['comm-dunhuang-silk'].completed).toBe(true);
    expect(state.souvenirs['sou-hearth-stone']).toBe(1);
    expect(state.stamps).toContain('xinghe');
    expect(res.letters.some((l) => l.commissionId === 'comm-dunhuang-silk')).toBe(true);
  });

  it('双兽结伴出行：产出合写家书并提升双方羁绊，解锁精卫', () => {
    const state = createFreshState();
    grantStarterItems(state);
    state.beasts.baize.travels = 3;

    const now = 1_760_000_000_000;
    const started = startTrip(state, 'baize', 'free', ['waxseal'], {
      partnerId: 'jiuweihu',
      now
    });
    expect(started.ok).toBe(true);
    expect(state.trips.jiuweihu.companionOf).toBe('baize');

    const res = resolveTrip(state, 'baize', now + 60 * 60 * 1000);
    expect(state.beasts.baize.bonds.jiuweihu).toBe(1);
    expect(state.beasts.jiuweihu.bonds.baize).toBe(1);
    expect(res.letters.some((l) => l.coAuthorId === 'jiuweihu')).toBe(true);
    expect(state.beasts.jingwei.unlocked).toBe(true);
    expect(state.trips.jiuweihu).toBeUndefined();
  });

  it('盖印回信培养五维心境并觉醒可切换的后天性格印记', () => {
    const state = createFreshState();
    state.letters.push(
      { id: 'L1', beastId: 'baize', beastName: '白泽', title: '1', body: 'a', reply: [{ text: '吃好', trait: 'food', memory: { enjoy_now: 1 } }], replied: null },
      { id: 'L2', beastId: 'baize', beastName: '白泽', title: '2', body: 'b', reply: [{ text: '吃好', trait: 'food', memory: { enjoy_now: 1 } }], replied: null },
      { id: 'L3', beastId: 'baize', beastName: '白泽', title: '3', body: 'c', reply: [{ text: '吃好', trait: 'food', memory: { enjoy_now: 1 } }], replied: null }
    );

    replyLetter(state, 'L1', 0, 'jianzi');
    const r2 = replyLetter(state, 'L2', 0, 'pingan');
    const r3 = replyLetter(state, 'L3', 0, 'shanhai');

    expect(state.beasts.baize.traits.food).toBe(3);
    expect(state.beasts.baize.unlockedQuirks).toContain('quirk-gourmet');
    expect(state.beasts.baize.equippedQuirk).toBe('quirk-gourmet');
    expect(r3.letter.stamp).toBe('shanhai');
    expect(r2.newlyUnlockedQuirks.length).toBeGreaterThanOrEqual(1);

    const eq = equipQuirk(state, 'baize', null);
    expect(eq.ok).toBe(true);
    expect(state.beasts.baize.equippedQuirk).toBeNull();
  });

  it('博古架堂前雅韵气场激活、动态访客茶会与以物易物', () => {
    const state = createFreshState();
    state.souvenirs['sou-rain-bottle'] = 2;
    state.souvenirs['sou-paper-umbrella'] = 1;
    state.souvenirs['sou-boat-paddle'] = 1;
    state.souvenirs['sou-postcard'] = 3;

    placeSouvenir(state, 0, 'sou-rain-bottle');
    const second = placeSouvenir(state, 1, 'sou-paper-umbrella');
    const third = placeSouvenir(state, 2, 'sou-boat-paddle');

    const aura = computeRoomAura(state);
    expect(aura.primary.id).toBe('aura-jiangnan');
    expect(second.unlocked.some((v) => v.id === 'grandma')).toBe(true);
    expect(third.aura.primary.id).toBe('aura-jiangnan');
    expect(state.activeVisitors).toContain('grandma');

    const tradeRes = tradeWithVisitor(state, 'grandma', 'tr-gm-1');
    expect(tradeRes.ok).toBe(true);
    // 初始 3 张 + 老奶奶初见礼赠 1 张 - 交换消耗 2 张 = 2 张
    expect(state.souvenirs['sou-postcard']).toBe(2);
    expect(state.inventory.waxseal).toBe(1);
  });

  it('静心沙漏限次与全事件看完后的动态组合短笺兜底', () => {
    const state = createFreshState();
    EVENTS.forEach((e) => { state.seenEvents[e.id] = true; });
    const now = 1_760_000_000_000;

    for (let i = 0; i < 4; i += 1) {
      startTrip(state, 'qingniao', 'free', [], { now: now + i * 1000 });
      const res = forceReturn(state, 'qingniao', now + i * 1000);
      expect(res.letters.length).toBeGreaterThanOrEqual(1);
    }
    expect(hourglassLeft(state, now)).toBe(0);
    startTrip(state, 'qingniao', 'free', [], { now: now + 5000 });
    const blocked = forceReturn(state, 'qingniao', now + 5000);
    expect(blocked.limited).toBe(true);
  });

  it('迎新首信不影响新档判定，且首趟普通模式出行固定约 45 秒归来', () => {
    const state = createFreshState();
    const now = 1_760_000_000_000;
    const wl = grantWelcomeLetter(state, now);
    expect(wl).toBeTruthy();
    expect(wl.welcome).toBe(true);
    expect(wl.opened).toBe(false);
    expect(isSouvenirDiscovered(state, 'sou-postcard')).toBe(true);
    expect(isFreshState(state)).toBe(true);

    // 重复调用不会重复发放
    expect(grantWelcomeLetter(state, now + 1000)).toBeNull();

    const first = startTrip(state, 'baize', 'free', [], { now });
    expect(first.ok).toBe(true);
    expect(first.trip.isFirstTrip).toBe(true);
    expect(first.trip.returnAt - now).toBe(CONSTANTS.FIRST_TRIP_MS);
  });

  it('图鉴与库存解耦：消耗光唯一纪念品后图鉴仍永久点亮，非委托捎带触发顺路赠礼且委托不重复刷', () => {
    const state = createFreshState();
    const now = 1_760_000_000_000;
    state.souvenirs['sou-silk'] = 1;
    state.souvenirs['sou-panda-ear'] = 1;
    syncDiscoveredSouvenirs(state);

    // 1. 完成跨城委托，消耗最后 1 件苏绣手帕，图鉴依然保持收录
    startTrip(state, 'baize', 'free', [], { giftSouvenir: 'sou-silk', now });
    resolveTrip(state, 'baize', now + 60 * 60 * 1000);
    expect(state.souvenirs['sou-silk']).toBeUndefined();
    expect(isSouvenirDiscovered(state, 'sou-silk')).toBe(true);
    expect(ownedSouvenirCount(state)).toBeGreaterThanOrEqual(2);

    // 2. 用非委托纪念品（熊猫耳朵）放第 4 格，不吞噬，触发顺路赠礼
    const matBefore = Object.values(state.materials).reduce((a, b) => a + b, 0);
    startTrip(state, 'jiuweihu', 'free', [], { giftSouvenir: 'sou-panda-ear', now: now + 1000 });
    const casualRes = resolveTrip(state, 'jiuweihu', now + 2 * 60 * 60 * 1000);
    expect(isSouvenirDiscovered(state, 'sou-panda-ear')).toBe(true);
    const matAfter = Object.values(state.materials).reduce((a, b) => a + b, 0);
    expect(matAfter - matBefore).toBe(2);
    expect(casualRes.letters.some((l) => l.body.includes('顺路赠礼'))).toBe(true);

    // 3. 已完成委托即使再携带同一物品也不重复触发完成信与奖品
    state.souvenirs['sou-silk'] = 1;
    const commLetterBefore = state.letters.filter((l) => l.commissionId === 'comm-dunhuang-silk').length;
    startTrip(state, 'baize', 'free', [], { giftSouvenir: 'sou-silk', now: now + 3000 });
    resolveTrip(state, 'baize', now + 4 * 60 * 60 * 1000);
    const commLetterAfter = state.letters.filter((l) => l.commissionId === 'comm-dunhuang-silk').length;
    expect(commLetterAfter).toBe(commLetterBefore);
  });

  it('回信即时触发升阶与精卫入驻、朱砂闲章余温生效、大寒羁绊+2及合写信去重、摸头每日首礼', () => {
    const state = createFreshState();
    const now = 1_760_000_000_000;
    state.stamps.push('yanyu');
    state.beasts.baize.insightExp = 3;
    state.letters.push({
      id: 'L_UP', beastId: 'baize', beastName: '白泽', title: '将升阶', body: '正文',
      reply: [{ text: '记下来', trait: 'scholar', memory: { record_habit: 1 } }],
      replied: null
    });

    const rep = replyLetter(state, 'L_UP', 0, 'yanyu', now);
    expect(state.beasts.baize.insight).toBe(1);
    expect(rep.stages.length).toBe(1);
    expect(rep.unlockedBeast.id).toBe('jingwei');
    expect(state.beasts.jingwei.unlocked).toBe(true);
    expect(getBeastStampBlessing(state, 'baize').id).toBe('yanyu');

    // 岁岁平安余温触发额外灵材并消费余温标记
    state.worldFlags['stamp_blessing:qingniao'] = 'pingan';
    const m0 = Object.values(state.materials).reduce((a, b) => a + b, 0);
    const tPingan = startTrip(state, 'qingniao', 'free', [], { now: now + 1000 });
    expect(tPingan.trip.stampBlessing).toBe('pingan');
    expect(getBeastStampBlessing(state, 'qingniao')).toBeNull();
    resolveTrip(state, 'qingniao', now + 60 * 60 * 1000);
    expect(Object.values(state.materials).reduce((a, b) => a + b, 0)).toBe(m0 + 1);

    // 大寒节气双兽结伴羁绊 +2，且第二次结伴改写动态合写短笺不复读
    state.seasonIdx = 7; // 大寒·守岁
    startTrip(state, 'baize', 'free', [], { partnerId: 'jiuweihu', now: now + 2000 });
    resolveTrip(state, 'baize', now + 2 * 60 * 60 * 1000);
    expect(state.beasts.baize.bonds.jiuweihu).toBe(2);
    expect(state.worldFlags['coauthor_seen:baize_jiuweihu']).toBe(true);

    startTrip(state, 'baize', 'free', [], { partnerId: 'jiuweihu', now: now + 3000 });
    const res2 = resolveTrip(state, 'baize', now + 3 * 60 * 60 * 1000);
    expect(res2.letters.some((l) => l.id.startsWith('CAD_'))).toBe(true);

    // 每日首次摸头赠礼，同日二次摸头不重复赠送
    const p1 = petBeast(state, 'baize', now);
    expect(p1.giftedMaterial).toBeTruthy();
    const p2 = petBeast(state, 'baize', now + 1000);
    expect(p2.giftedMaterial).toBeNull();
  });
});
