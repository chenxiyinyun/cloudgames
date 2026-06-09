import { MAP_ASPECT_RATIO, TRAVEL_TIME_PER_EDGE } from './gameEngine'

export { MAP_ASPECT_RATIO, TRAVEL_TIME_PER_EDGE }

export function getMovingTroopVisuals({
  movingTroops = [],
  territories = [],
  animationStateById = {},
  now = Date.now()
}) {
  const territoryById = new Map(territories.map(territory => [territory.id, territory]))

  return movingTroops
    .map(troop => {
      const fromId = troop.path[troop.currentStep]
      const toId = troop.path[Math.min(troop.currentStep + 1, troop.path.length - 1)]
      const from = territoryById.get(fromId)
      const to = territoryById.get(toId)
      if (!from || !to) return null

      const stepStartTime = animationStateById[troop.id]?.stepStartTime ?? now
      const elapsed = now - stepStartTime
      const progress = clamp(elapsed / TRAVEL_TIME_PER_EDGE, 0, 1)

      return {
        id: troop.id,
        playerId: troop.playerId,
        amount: troop.amount,
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        progress
      }
    })
    .filter(Boolean)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
