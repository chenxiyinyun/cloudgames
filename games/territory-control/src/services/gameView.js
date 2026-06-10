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
    // 每一个小兵自身的飞行时间
    const individualDuration = TRAVEL_TIME_PER_EDGE - streamDuration

    for (let i = 0; i < visualCount; i++) {
      // 计算这个小兵延迟多久出发
      const delay = visualCount > 1 ? (i / (visualCount - 1)) * streamDuration : 0
      const soldierElapsed = elapsed - delay
      
      // 还没轮到这个小兵出发
      if (soldierElapsed < 0) continue
      
      const progress = clamp(soldierElapsed / individualDuration, 0, 1)
      // 如果这个小兵已经到达终点，就不再渲染（直接“进入”基地消失）
      if (progress >= 1) continue
      
      // 使用 ease-in-out (二次方) 让起步和停止更平滑
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.hypot(dx, dy)
      
      // 法向量，用于产生横向散开效果
      const px = dist > 0 ? -dy / dist : 0
      const py = dist > 0 ? dx / dist : 0
      
      // 根据索引生成伪随机的横向偏移（正负 16px），让小兵像蜂群一样散开，而不是连成一条直线
      const hash = Math.sin(i * 12.9898 + troop.id.charCodeAt(troop.id.length - 1))
      const lateralOffset = hash * 16

      // 添加跳跃/抛物线高度
      const jumpHeight = Math.min(40, dist * 0.25)
      const jumpOffset = Math.sin(progress * Math.PI) * -jumpHeight

      // 出生和到达时有缩放动画，飞行途中稍微变大
      let baseScale = 1
      if (progress < 0.1) baseScale = progress / 0.1
      else if (progress > 0.9) baseScale = (1 - progress) / 0.1
      const scale = baseScale + Math.sin(progress * Math.PI) * 0.3

      visuals.push({
        id: `${troop.id}-${i}`,
        playerId: troop.playerId,
        x: from.x + dx * easeProgress + px * lateralOffset,
        y: from.y + dy * easeProgress + py * lateralOffset + jumpOffset,
        scale,
        progress
      })
    }
  })

  return visuals
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
