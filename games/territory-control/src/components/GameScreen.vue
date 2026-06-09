<template>
  <main
    class="screen game-screen"
    :data-theme="currentTheme"
  >
    <header class="top-bar">
      <div>
        <p class="eyebrow">
          房间号 <code class="room-code-inline">{{ roomCode }}</code>
        </p>
        <h1>战场控制台</h1>
      </div>
      <div class="toolbar">
        <div
          class="ratio-control"
          role="group"
          aria-label="派遣比例"
        >
          <button
            v-for="option in ratios"
            :key="option.value"
            type="button"
            :class="{ active: dispatchRatio === option.value }"
            @click="dispatchRatio = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <button
          v-if="isHost"
          class="danger-button"
          type="button"
          @click="$emit('end-game')"
        >
          结束
        </button>
        <button
          class="ghost-button"
          type="button"
          @click="$emit('leave-room')"
        >
          离开
        </button>
      </div>
    </header>

    <section class="battle-layout">
      <aside class="status-panel">
        <h2>势力</h2>
        <div class="player-list compact">
          <div
            v-for="player in playerStats"
            :key="player.id"
            class="player-row"
            :class="{ eliminated: player.isEliminated }"
          >
            <span
              class="swatch"
              :style="{ background: player.color }"
            />
            <span>{{ player.name }}</span>
            <strong>{{ player.territories }}</strong>
          </div>
        </div>
        <p class="hint">
          点击自己的领地选中，再点击目标领地派兵。
        </p>
        <p
          v-if="selectedId"
          class="hint selected-hint"
        >
          已选中领地，点击目标派兵（再点一次取消）
        </p>
        <p
          v-if="error"
          class="error-line"
        >
          {{ error }}
        </p>
      </aside>

      <section class="map-shell">
        <svg
          ref="svgRef"
          class="battle-map"
          :viewBox="`0 0 ${room.gameState.width} ${room.gameState.height}`"
          role="img"
          aria-label="区域争夺地图"
        >
          <defs>
            <filter
              id="soft-shadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="12"
                flood-color="#000"
                flood-opacity="0.32"
              />
            </filter>
            <filter
              id="catpaw-shadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="8"
                stdDeviation="8"
                flood-color="#000"
                flood-opacity="0.18"
              />
            </filter>
          </defs>

          <line
            v-for="edge in renderedEdges"
            :key="`${edge.from.id}-${edge.to.id}`"
            class="map-edge"
            :class="{ active: isEdgeOnPath(edge) }"
            :x1="edge.from.x"
            :y1="edge.from.y"
            :x2="edge.to.x"
            :y2="edge.to.y"
          />

          <g
            v-for="territory in territories"
            :key="territory.id"
            class="territory"
            :class="territoryClasses(territory)"
            :transform="`translate(${territory.x}, ${territory.y})`"
            @click="handleTerritoryClick(territory)"
          >
            <!-- 障碍领地 -->
            <template v-if="territory.isObstacle">
              <template v-if="isCatpawTheme">
                <!-- 猫爪主题：毛线球障碍 -->
                <circle
                  class="obstacle-ring catpaw-obstacle-ring"
                  :r="TERRITORY_RING_RADIUS"
                />
                <circle
                  class="obstacle-core catpaw-obstacle-core"
                  r="31"
                />
                <path
                  d="M-10,-10 Q0,-18 10,-10 Q18,0 10,10 Q0,18 -10,10 Q-18,0 -10,-10 Z"
                  class="yarn-ball-line"
                  fill="none"
                />
                <path
                  d="M-6,-14 Q6,-6 -6,2 Q6,10 -2,14"
                  class="yarn-ball-line"
                  fill="none"
                />
              </template>
              <template v-else>
                <circle
                  class="territory-ring obstacle-ring"
                  :r="TERRITORY_RING_RADIUS"
                />
                <circle
                  class="territory-core obstacle-core"
                  r="31"
                />
                <line x1="-12" y1="-12" x2="12" y2="12" class="obstacle-mark" />
                <line x1="12" y1="-12" x2="-12" y2="12" class="obstacle-mark" />
              </template>
            </template>

            <!-- 猫爪主题领地 -->
            <template v-else-if="isCatpawTheme">
              <!-- 大肉垫（掌心） -->
              <circle
                class="territory-ring catpaw-ring"
                :r="TERRITORY_RING_RADIUS"
                :fill="ownerColor(territory.ownerId)"
              />
              <ellipse
                class="catpaw-pad catpaw-main-pad"
                rx="24"
                ry="22"
                :fill="ownerColor(territory.ownerId)"
              />
              <!-- 4 个小肉垫 -->
              <ellipse
                class="catpaw-pad"
                cx="-18"
                cy="-18"
                rx="10"
                ry="9"
                :fill="ownerColor(territory.ownerId)"
              />
              <ellipse
                class="catpaw-pad"
                cx="0"
                cy="-24"
                rx="10"
                ry="9"
                :fill="ownerColor(territory.ownerId)"
              />
              <ellipse
                class="catpaw-pad"
                cx="18"
                cy="-18"
                rx="10"
                ry="9"
                :fill="ownerColor(territory.ownerId)"
              />
              <ellipse
                class="catpaw-pad"
                cx="24"
                cy="-4"
                rx="9"
                ry="8"
                :fill="ownerColor(territory.ownerId)"
              />
              <text
                class="territory-units catpaw-units"
                text-anchor="middle"
                dominant-baseline="central"
                y="6"
              >
                {{ territory.units }}
              </text>
            </template>

            <!-- 经典主题领地 -->
            <template v-else>
              <circle
                class="territory-ring"
                :r="TERRITORY_RING_RADIUS"
                :fill="ownerColor(territory.ownerId)"
              />
              <circle
                class="territory-core"
                r="31"
                :fill="ownerColor(territory.ownerId)"
              />
              <text
                class="territory-units"
                text-anchor="middle"
                dominant-baseline="central"
              >
                {{ territory.units }}
              </text>
            </template>
          </g>

          <g
            v-for="troop in movingTroopVisuals"
            :key="troop.id"
            class="moving-troop"
            :transform="`translate(${troop.x}, ${troop.y})`"
          >
            <template v-if="isCatpawTheme">
              <!-- 猫爪主题：小猫爪移动标记 -->
              <circle
                class="moving-troop-bg catpaw-troop-bg"
                r="18"
                :fill="ownerColor(troop.playerId)"
              />
              <ellipse
                class="catpaw-troop-pad"
                rx="6"
                ry="5"
                cy="2"
                :fill="ownerColor(troop.playerId)"
              />
              <ellipse
                class="catpaw-troop-pad"
                cx="-5"
                cy="-5"
                rx="3.5"
                ry="3"
                :fill="ownerColor(troop.playerId)"
              />
              <ellipse
                class="catpaw-troop-pad"
                cx="0"
                cy="-7"
                rx="3.5"
                ry="3"
                :fill="ownerColor(troop.playerId)"
              />
              <ellipse
                class="catpaw-troop-pad"
                cx="5"
                cy="-5"
                rx="3.5"
                ry="3"
                :fill="ownerColor(troop.playerId)"
              />
              <text
                class="moving-troop-text catpaw-troop-text"
                text-anchor="middle"
                dominant-baseline="central"
                y="4"
              >
                {{ troop.amount }}
              </text>
            </template>
            <template v-else>
              <circle
                class="moving-troop-bg"
                r="18"
                :fill="ownerColor(troop.playerId)"
              />
              <text
                class="moving-troop-text"
                text-anchor="middle"
                dominant-baseline="central"
              >
                {{ troop.amount }}
              </text>
            </template>
          </g>
        </svg>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { findPath } from '../services/gameEngine'

const props = defineProps({
  room: {
    type: Object,
    required: true
  },
  roomCode: {
    type: String,
    required: true
  },
  playerId: {
    type: String,
    default: null
  },
  isHost: Boolean,
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['dispatch', 'end-game', 'leave-room'])

const dispatchRatio = ref(0.5)
const seq = ref(0)
let lastDispatchAt = 0
const DISPATCH_COOLDOWN_MS = 400
const TERRITORY_RING_RADIUS = 42
const TRAVEL_TIME_PER_EDGE = 1500

const selectedId = ref(null)
const previewPath = ref(null)
const animFrame = ref(null)
const now = ref(Date.now())
const localTroopAnim = ref({})

const ratios = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' }
]

const territories = computed(() => props.room.gameState.territories || [])
const edges = computed(() => props.room.gameState.edges || [])
const movingTroops = computed(() => props.room.gameState.movingTroops || [])
const currentTheme = computed(() => props.room.gameState?.theme || 'default')
const isCatpawTheme = computed(() => currentTheme.value === 'catpaw')

const playersById = computed(() =>
  Object.fromEntries(props.room.players.map(player => [player.id, player]))
)

const playerStats = computed(() =>
  props.room.players.map(player => ({
    ...player,
    territories: territories.value.filter(t => t.ownerId === player.id).length
  }))
)

const renderedEdges = computed(() =>
  edges.value
    .map(edge => ({
      from: territories.value.find(t => t.id === edge.from),
      to: territories.value.find(t => t.id === edge.to)
    }))
    .filter(edge => edge.from && edge.to)
)

watch(movingTroops, (newTroops) => {
  const currentNow = Date.now()
  const validIds = new Set()
  
  newTroops.forEach(troop => {
    validIds.add(troop.id)
    const state = localTroopAnim.value[troop.id]
    if (!state) {
      localTroopAnim.value[troop.id] = {
        step: troop.currentStep,
        stepStartTime: currentNow
      }
    } else if (state.step !== troop.currentStep) {
      state.step = troop.currentStep
      state.stepStartTime = currentNow
    }
  })
  
  Object.keys(localTroopAnim.value).forEach(id => {
    if (!validIds.has(id)) {
      delete localTroopAnim.value[id]
    }
  })
}, { deep: true, immediate: true })

const movingTroopVisuals = computed(() => {
  return movingTroops.value.map(troop => {
    const fromId = troop.path[troop.currentStep]
    const toId = troop.path[Math.min(troop.currentStep + 1, troop.path.length - 1)]
    const from = territories.value.find(t => t.id === fromId)
    const to = territories.value.find(t => t.id === toId)
    if (!from || !to) return null

    const animState = localTroopAnim.value[troop.id]
    const stepStartTime = animState ? animState.stepStartTime : now.value
    const elapsed = now.value - stepStartTime
    const progress = Math.min(1, Math.max(0, elapsed / TRAVEL_TIME_PER_EDGE))

    return {
      id: troop.id,
      playerId: troop.playerId,
      amount: troop.amount,
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    }
  }).filter(Boolean)
})

function ownerColor(ownerId) {
  if (!ownerId) return isCatpawTheme.value ? '#fce4ec' : '#f4f0e7'
  return playersById.value[ownerId]?.color || '#9ca3af'
}

function territoryClasses(territory) {
  if (territory.isObstacle) {
    return { obstacle: true }
  }
  return {
    owned: territory.ownerId === props.playerId,
    neutral: !territory.ownerId,
    enemy: territory.ownerId && territory.ownerId !== props.playerId,
    selected: selectedId.value === territory.id,
    targetable: selectedId.value && selectedId.value !== territory.id
  }
}

function isEdgeOnPath(edge) {
  if (!previewPath.value) return false
  for (let i = 0; i < previewPath.value.length - 1; i++) {
    const a = previewPath.value[i]
    const b = previewPath.value[i + 1]
    if ((edge.from.id === a && edge.to.id === b) || (edge.from.id === b && edge.to.id === a)) {
      return true
    }
  }
  return false
}

function handleTerritoryClick(territory) {
  if (territory.isObstacle) return
  if (territory.ownerId === props.playerId && territory.units >= 1) {
    if (selectedId.value === territory.id) {
      selectedId.value = null
      previewPath.value = null
    } else {
      selectedId.value = territory.id
      previewPath.value = null
    }
  } else if (selectedId.value && territory.id !== selectedId.value) {
    const path = findPath(edges.value, selectedId.value, territory.id, territories.value)
    if (!path) {
      previewPath.value = null
      return
    }
    previewPath.value = path

    const nowMs = Date.now()
    if (nowMs - lastDispatchAt < DISPATCH_COOLDOWN_MS) return
    lastDispatchAt = nowMs

    seq.value += 1
    emit('dispatch', {
      sourceId: selectedId.value,
      targetId: territory.id,
      ratio: dispatchRatio.value,
      seq: seq.value
    })
    selectedId.value = null
    previewPath.value = null
  }
}

function tickAnimation() {
  now.value = Date.now()
  animFrame.value = requestAnimationFrame(tickAnimation)
}

onMounted(() => {
  tickAnimation()
})

onUnmounted(() => {
  if (animFrame.value) {
    cancelAnimationFrame(animFrame.value)
  }
})
</script>
