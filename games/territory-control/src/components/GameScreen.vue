<template>
  <main class="screen game-screen">
    <header class="top-bar">
      <div>
        <p class="eyebrow">
          room {{ roomCode }}
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
          按住自己的领地，拖到任意其他领地释放。
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
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
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
          </defs>

          <line
            v-for="edge in renderedEdges"
            :key="`${edge.from.id}-${edge.to.id}`"
            class="map-edge"
            :class="{ active: isEdgeActive(edge) }"
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
            @pointerdown="handlePointerDown($event, territory)"
          >
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
          </g>

          <line
            v-if="dragState.active"
            class="dispatch-line"
            :x1="dragState.start.x"
            :y1="dragState.start.y"
            :x2="dragState.pointer.x"
            :y2="dragState.pointer.y"
          />
        </svg>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

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

const svgRef = ref(null)
const dispatchRatio = ref(0.5)
const seq = ref(0)
let lastDispatchAt = 0
const DISPATCH_COOLDOWN_MS = 150
// 领地圆环 r=42(与模板里 territory-ring 一致),阈值 = r * 1.4,
// 给玩家 ~16px 容差,改 r 时只需改这一处
const TERRITORY_RING_RADIUS = 42
const DISPATCH_HIT_RADIUS = TERRITORY_RING_RADIUS * 1.4
const dragState = reactive({
  active: false,
  sourceId: null,
  start: { x: 0, y: 0 },
  pointer: { x: 0, y: 0 }
})

const ratios = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' }
]

const territories = computed(() => props.room.gameState.territories || [])

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
  (props.room.gameState.edges || [])
    .map(edge => ({
      from: territories.value.find(t => t.id === edge.from),
      to: territories.value.find(t => t.id === edge.to)
    }))
    .filter(edge => edge.from && edge.to)
)

function ownerColor(ownerId) {
  if (!ownerId) return '#f4f0e7'
  return playersById.value[ownerId]?.color || '#9ca3af'
}

function territoryClasses(territory) {
  return {
    owned: territory.ownerId === props.playerId,
    neutral: !territory.ownerId,
    enemy: territory.ownerId && territory.ownerId !== props.playerId,
    targetable: dragState.active && dragState.sourceId !== territory.id
  }
}

function isEdgeActive(edge) {
  return dragState.active && (edge.from.id === dragState.sourceId || edge.to.id === dragState.sourceId)
}

function handlePointerDown(event, territory) {
  if (territory.ownerId !== props.playerId || territory.units < 1) return
  event.preventDefault()
  const point = toSvgPoint(event)
  dragState.active = true
  dragState.sourceId = territory.id
  dragState.start = { x: territory.x, y: territory.y }
  dragState.pointer = point
}

function handlePointerMove(event) {
  if (!dragState.active) return
  dragState.pointer = toSvgPoint(event)
}

function handlePointerUp(event) {
  if (!dragState.active) return
  const point = toSvgPoint(event)
  const target = nearestTerritory(point)
  const sourceId = dragState.sourceId
  dragState.active = false
  dragState.sourceId = null

  if (!target || target.id === sourceId) return

  // 客户端 cooldown:防止 spam 点击/手抖狂点,让 host 端每秒处理 N 次 dispatch
  // 150ms 比人类正常"派一次兵"节奏快一档,不会阻断合法快速操作
  const now = Date.now()
  if (now - lastDispatchAt < DISPATCH_COOLDOWN_MS) return
  lastDispatchAt = now

  seq.value += 1
  emit('dispatch', {
    sourceId,
    targetId: target.id,
    ratio: dispatchRatio.value,
    seq: seq.value
  })
}

function nearestTerritory(point) {
  let best = null
  let bestDistance = Infinity
  territories.value.forEach(territory => {
    const d = Math.hypot(territory.x - point.x, territory.y - point.y)
    if (d < bestDistance) {
      best = territory
      bestDistance = d
    }
  })
  return bestDistance <= DISPATCH_HIT_RADIUS ? best : null
}

function toSvgPoint(event) {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse())
  return { x: transformed.x, y: transformed.y }
}
</script>
