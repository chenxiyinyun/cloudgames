import { MAP_ASPECT_RATIO, TRAVEL_TIME_PER_EDGE } from './gameEngine'

export { MAP_ASPECT_RATIO, TRAVEL_TIME_PER_EDGE }

export function getMovingTroopVisuals({
  movingTroops = [],
  territories = [],
  animationStateById = {},
  now = Date.now()
}) {
  const territoryById = new Map(territories.map(territory => [territory.id, territory]))
  const visuals = []

  movingTroops.forEach(troop => {
    const fromId = troop.path[troop.currentStep]
    const toId = troop.path[Math.min(troop.currentStep + 1, troop.path.length - 1)]
    const from = territoryById.get(fromId)
    const to = territoryById.get(toId)
    if (!from || !to) return

    const stepStartTime = animationStateById[troop.id]?.stepStartTime ?? now
    const elapsed = now - stepStartTime
    
    const visualCount = troop.amount
    // 我们让小兵在整个 TRAVEL_TIME_PER_EDGE 中，前 600ms 内陆续出发
    const streamDuration = 600
    // 每一个小兵自身的行走时间
    const individualDuration = TRAVEL_TIME_PER_EDGE - streamDuration

    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    // 单位法向量：把同一波小兵排进几条固定的“行军道”，整齐并行而非散乱
    const nx = dist > 0 ? -dy / dist : 0
    const ny = dist > 0 ? dx / dist : 0

    for (let i = 0; i < visualCount; i++) {
      // 计算这个小兵延迟多久出发
      const delay = visualCount > 1 ? (i / (visualCount - 1)) * streamDuration : 0
      const soldierElapsed = elapsed - delay

      // 还没轮到这个小兵出发
      if (soldierElapsed < 0) continue

      const progress = clamp(soldierElapsed / individualDuration, 0, 1)
      // 如果这个小兵已经到达终点，就不再渲染（直接“进入”基地消失）
      if (progress >= 1) continue

      // 平地行走：匀速直线，无抛物线跳跃、不沿途放大
      const lane = (i % 5) - 2 // -2..2，固定的横向行军道
      const lateralOffset = lane * 7

      // 仅在出生/到达瞬间轻微淡入淡出，避免突兀地弹出/消失
      let scale = 1
      if (progress < 0.12) scale = progress / 0.12
      else if (progress > 0.88) scale = (1 - progress) / 0.12

      visuals.push({
        id: `${troop.id}-${i}`,
        playerId: troop.playerId,
        x: from.x + dx * progress + nx * lateralOffset,
        y: from.y + dy * progress + ny * lateralOffset,
        scale,
        progress
      })
    }
  })

  return visuals
}

export function getMovingTroopProgress({
  movingTroops = [],
  animationStateById = {},
  now = Date.now()
}) {
  const streamDuration = 600
  const individualDuration = TRAVEL_TIME_PER_EDGE - streamDuration
  const result = []

  movingTroops.forEach(troop => {
    const stepStartTime = animationStateById[troop.id]?.stepStartTime ?? now
    const elapsed = now - stepStartTime
    const sourceId = troop.path[troop.currentStep]
    const destId = troop.path[Math.min(troop.currentStep + 1, troop.path.length - 1)]
    if (sourceId === destId) return

    let departedCount = 0
    let arrivedCount = 0

    for (let i = 0; i < troop.amount; i++) {
      const delay = troop.amount > 1 ? (i / (troop.amount - 1)) * streamDuration : 0
      if (elapsed >= delay) departedCount++
      if (elapsed >= delay + individualDuration) arrivedCount++
    }

    result.push({
      troopId: troop.id,
      playerId: troop.playerId,
      sourceId,
      destId,
      departedCount,
      arrivedCount,
      amount: troop.amount
    })
  })

  return result
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
