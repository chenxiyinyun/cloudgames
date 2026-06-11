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
          点击自己的领地选中，再点击目标领地派兵。移动端支持双指缩放与拖动战场。<br>
          <span class="granary-hint">粮</span> 粮仓：占领后产兵翻倍 &nbsp;
          <span class="fortress-hint">垒</span> 要塞：占领后防御 +30%
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

      <section
        ref="mapShellRef"
        class="map-shell"
        :class="{ interacting: isMapGestureActive }"
        :style="{ '--map-aspect-ratio': MAP_ASPECT_RATIO }"
      >
        <svg
          ref="svgRef"
          class="battle-map"
          :class="{ zoomed: isMapZoomed }"
          :viewBox="`0 0 ${room.gameState.width} ${room.gameState.height}`"
          :style="battleMapStyle"
          role="img"
          aria-label="区域争夺地图"
          @pointerdown="handleMapPointerDown"
          @pointermove="handleMapPointerMove"
          @pointerup="handleMapPointerUp"
          @pointercancel="handleMapPointerUp"
          @click.capture="handleMapClickCapture"
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
                :class="{ 'granary-ring': territory.type === 'granary', 'fortress-ring': territory.type === 'fortress' }"
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
                {{ getDisplayUnits(territory) }}
              </text>
              <!-- 粮仓/要塞类型标识 -->
              <text
                v-if="territory.type === 'granary'"
                class="territory-type-badge granary-badge"
                text-anchor="middle"
                dominant-baseline="central"
                x="0"
                y="-36"
              >粮</text>
              <text
                v-if="territory.type === 'fortress'"
                class="territory-type-badge fortress-badge"
                text-anchor="middle"
                dominant-baseline="central"
                x="0"
                y="-36"
              >垒</text>
            </template>

            <!-- 经典主题领地 -->
            <template v-else>
              <circle
                class="territory-ring"
                :class="{ 'granary-ring': territory.type === 'granary', 'fortress-ring': territory.type === 'fortress' }"
                :r="TERRITORY_RING_RADIUS"
                :fill="ownerColor(territory.ownerId)"
              />
              <circle
                class="territory-core"
                :class="{ 'granary-core': territory.type === 'granary', 'fortress-core': territory.type === 'fortress' }"
                r="31"
                :fill="ownerColor(territory.ownerId)"
              />
              <text
                class="territory-units"
                text-anchor="middle"
                dominant-baseline="central"
              >
                {{ getDisplayUnits(territory) }}
              </text>
              <!-- 粮仓/要塞类型标识 -->
              <text
                v-if="territory.type === 'granary'"
                class="territory-type-badge granary-badge"
                text-anchor="middle"
                dominant-baseline="central"
                x="0"
                y="-36"
              >粮</text>
              <text
                v-if="territory.type === 'fortress'"
                class="territory-type-badge fortress-badge"
                text-anchor="middle"
                dominant-baseline="central"
                x="0"
                y="-36"
              >垒</text>
            </template>
          </g>

          <g
            v-for="soldier in movingTroopVisuals"
            :key="soldier.id"
            class="moving-soldier"
            :transform="`translate(${soldier.x}, ${soldier.y}) scale(${soldier.scale || 1})`"
          >
            <template v-if="isCatpawTheme">
              <!-- 猫爪主题：小猫爪移动标记 -->
              <circle
                class="moving-soldier-bg catpaw-soldier-bg"
                r="7"
                :fill="ownerColor(soldier.playerId)"
              />
              <ellipse
                class="catpaw-soldier-pad"
                rx="2.5"
                ry="2"
                cy="1"
                :fill="ownerColor(soldier.playerId)"
              />
              <ellipse
                class="catpaw-soldier-pad"
                cx="-2.5"
                cy="-2"
                rx="1.5"
                ry="1.2"
                :fill="ownerColor(soldier.playerId)"
              />
              <ellipse
                class="catpaw-soldier-pad"
                cx="0"
                cy="-3"
                rx="1.5"
                ry="1.2"
                :fill="ownerColor(soldier.playerId)"
              />
              <ellipse
                class="catpaw-soldier-pad"
                cx="2.5"
                cy="-2"
                rx="1.5"
                ry="1.2"
                :fill="ownerColor(soldier.playerId)"
              />
            </template>
            <template v-else>
              <circle
                class="moving-soldier-bg"
                r="6"
                :fill="ownerColor(soldier.playerId)"
              />
            </template>
          </g>
        </svg>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import { findPath } from '../services/gameEngine'
import { MAP_ASPECT_RATIO, getMovingTroopVisuals, getMovingTroopProgress } from '../services/gameView'
import {
  MIN_MAP_SCALE,
  clampViewport,
  isTapGesture,
  panViewport,
  zoomViewport
} from '../services/mapViewport'

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
let resizeObserver = null
const DISPATCH_COOLDOWN_MS = 400
const TERRITORY_RING_RADIUS = 42

const mapShellRef = ref(null)
const svgRef = ref(null)
const selectedId = ref(null)
const previewPath = ref(null)
const animFrame = ref(null)
const now = ref(Date.now())
const localTroopAnim = ref({})
const suppressClickUntil = ref(0)
const isMapGestureActive = ref(false)
const mapViewport = reactive({
  scale: 1,
  offsetX: 0,
  offsetY: 0
})
const gestureState = reactive({
  startOffsetX: 0,
  startOffsetY: 0,
  startScale: 1,
  startDistance: 0,
  startX: 0,
  startY: 0,
  startAt: 0,
  moved: false
})
const activePointers = new Map()
const displayUnits = ref({})

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

watch(territories, (newTerritories) => {
  newTerritories.forEach(t => {
    if (displayUnits.value[t.id] === undefined) {
      displayUnits.value[t.id] = t.units
    }
  })
}, { deep: true, immediate: true })

const movingTroopVisuals = computed(() => {
  return getMovingTroopVisuals({
    movingTroops: movingTroops.value,
    territories: territories.value,
    animationStateById: localTroopAnim.value,
    now: now.value
  })
})

const isMapZoomed = computed(() => mapViewport.scale > MIN_MAP_SCALE + 0.01)

const battleMapStyle = computed(() => ({
  transform: `translate(${mapViewport.offsetX}px, ${mapViewport.offsetY}px) scale(${mapViewport.scale})`,
  transformOrigin: 'center center',
  transition: isMapGestureActive.value ? 'none' : 'transform 140ms ease-out'
}))

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
    targetable: selectedId.value && selectedId.value !== territory.id,
    granary: territory.type === 'granary',
    fortress: territory.type === 'fortress'
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

function handleMapPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // 仅对触控设备设置 pointer capture；鼠标设置 capture 会导致 click 事件
  // 无法到达子元素（领地 <g>），使 PC 端派兵交互失效
  if (event.pointerType !== 'mouse') {
    svgRef.value?.setPointerCapture?.(event.pointerId)
  }
  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  })

  if (activePointers.size === 1) {
    gestureState.startOffsetX = mapViewport.offsetX
    gestureState.startOffsetY = mapViewport.offsetY
    gestureState.startScale = mapViewport.scale
    gestureState.startX = event.clientX
    gestureState.startY = event.clientY
    gestureState.startAt = Date.now()
    gestureState.moved = false
  } else if (activePointers.size === 2) {
    const [first, second] = [...activePointers.values()]
    gestureState.startOffsetX = mapViewport.offsetX
    gestureState.startOffsetY = mapViewport.offsetY
    gestureState.startScale = mapViewport.scale
    gestureState.startDistance = getDistance(first, second)
    gestureState.moved = true
    isMapGestureActive.value = true
    queueClickSuppression()
  }
}

function handleMapPointerMove(event) {
  if (!activePointers.has(event.pointerId)) return
  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  })

  if (activePointers.size === 1) {
    const deltaX = event.clientX - gestureState.startX
    const deltaY = event.clientY - gestureState.startY
    const movementPx = Math.hypot(deltaX, deltaY)
    const metrics = getViewportMetrics()
    if (!metrics) return
    if (movementPx <= 4) return

    gestureState.moved = true
    isMapGestureActive.value = true
    queueClickSuppression()

    applyViewport(panViewport({
      scale: mapViewport.scale,
      offsetX: gestureState.startOffsetX,
      offsetY: gestureState.startOffsetY,
      deltaX,
      deltaY,
      ...metrics,
      aspectRatio: MAP_ASPECT_RATIO
    }))
    return
  }

  if (activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()]
    const metrics = getViewportMetrics()
    const localFocal = getLocalPoint(getMidpoint(first, second))
    if (!metrics || !localFocal || gestureState.startDistance === 0) return

    gestureState.moved = true
    isMapGestureActive.value = true
    queueClickSuppression()

    applyViewport(zoomViewport({
      scale: gestureState.startScale,
      offsetX: gestureState.startOffsetX,
      offsetY: gestureState.startOffsetY,
      nextScale: gestureState.startScale * (getDistance(first, second) / gestureState.startDistance),
      focalX: localFocal.x,
      focalY: localFocal.y,
      ...metrics,
      aspectRatio: MAP_ASPECT_RATIO
    }))
  }
}

function handleMapPointerUp(event) {
  activePointers.delete(event.pointerId)
  if (event.pointerType !== 'mouse') {
    svgRef.value?.releasePointerCapture?.(event.pointerId)
  }

  if (activePointers.size === 1) {
    const [remaining] = [...activePointers.values()]
    gestureState.startOffsetX = mapViewport.offsetX
    gestureState.startOffsetY = mapViewport.offsetY
    gestureState.startX = remaining.x
    gestureState.startY = remaining.y
    gestureState.startAt = Date.now()
    gestureState.moved = true
    return
  }

  if (activePointers.size === 0) {
    if (event.pointerType === 'mouse') {
      // 鼠标：浏览器已区分 click 与拖拽，按住时长不应影响派兵；
      // 仅在确实平移过地图时才抑制随后的 click。否则一次稍慢（>220ms）的
      // 鼠标点击会被误判为非轻点而吞掉，导致 PC 端点击基地无反应。
      if (gestureState.moved) {
        queueClickSuppression()
      }
    } else {
      const durationMs = Date.now() - gestureState.startAt
      const movementPx = Math.hypot(event.clientX - gestureState.startX, event.clientY - gestureState.startY)
      if (!isTapGesture({ durationMs, movementPx }) || gestureState.moved) {
        queueClickSuppression()
      }
    }
    isMapGestureActive.value = false
  }
}

function handleMapClickCapture(event) {
  if (Date.now() < suppressClickUntil.value) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function applyViewport(nextViewport) {
  mapViewport.scale = nextViewport.scale
  mapViewport.offsetX = nextViewport.offsetX
  mapViewport.offsetY = nextViewport.offsetY
}

function syncViewportBounds() {
  const metrics = getViewportMetrics()
  if (!metrics) return
  applyViewport(clampViewport({
    scale: mapViewport.scale,
    offsetX: mapViewport.offsetX,
    offsetY: mapViewport.offsetY,
    ...metrics,
    aspectRatio: MAP_ASPECT_RATIO
  }))
}

function queueClickSuppression() {
  suppressClickUntil.value = Date.now() + 250
}

function getViewportMetrics() {
  const shell = mapShellRef.value
  if (!shell) return null
  const styles = window.getComputedStyle(shell)
  const horizontalPadding = parseFloat(styles.paddingLeft || 0) + parseFloat(styles.paddingRight || 0)
  const verticalPadding = parseFloat(styles.paddingTop || 0) + parseFloat(styles.paddingBottom || 0)
  return {
    viewportWidth: Math.max(0, shell.clientWidth - horizontalPadding),
    viewportHeight: Math.max(0, shell.clientHeight - verticalPadding)
  }
}

function getLocalPoint(point) {
  const shell = mapShellRef.value
  if (!shell) return null
  const rect = shell.getBoundingClientRect()
  const styles = window.getComputedStyle(shell)
  const paddingLeft = parseFloat(styles.paddingLeft || 0)
  const paddingTop = parseFloat(styles.paddingTop || 0)
  return {
    x: point.x - rect.left - paddingLeft,
    y: point.y - rect.top - paddingTop
  }
}

function getDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function getMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  }
}

function getDisplayUnits(territory) {
  if (territory.isObstacle) return territory.units
  return displayUnits.value[territory.id] ?? territory.units
}

function tickAnimation() {
  const currentNow = Date.now()
  now.value = currentNow

  const troopProgress = getMovingTroopProgress({
    movingTroops: movingTroops.value,
    animationStateById: localTroopAnim.value,
    now: currentNow
  })

  const territoryById = new Map(territories.value.map(t => [t.id, t]))

  // 源头：在途部队从各自当前所在领地“分批离开”，已出发的逐个扣减
  const sourceTotalAmount = {}
  movingTroops.value.forEach(troop => {
    const src = troop.path[troop.currentStep]
    sourceTotalAmount[src] = (sourceTotalAmount[src] || 0) + troop.amount
  })

  const sourceDeparted = {}
  troopProgress.forEach(p => {
    sourceDeparted[p.sourceId] = (sourceDeparted[p.sourceId] || 0) + p.departedCount
  })

  // 终点：把抵达拆成“友方增援(+)”与“敌方/中立交战(-)”，随每个小兵抵达逐个结算
  const friendlyArrived = {}
  const hostileArrived = {}
  troopProgress.forEach(p => {
    if (p.arrivedCount <= 0) return
    const dest = territoryById.get(p.destId)
    if (dest && dest.ownerId === p.playerId) {
      friendlyArrived[p.destId] = (friendlyArrived[p.destId] || 0) + p.arrivedCount
    } else {
      hostileArrived[p.destId] = (hostileArrived[p.destId] || 0) + p.arrivedCount
    }
  })

  territories.value.forEach(t => {
    const srcTotal = sourceTotalAmount[t.id] || 0
    const srcDep = sourceDeparted[t.id] || 0
    const fAdd = friendlyArrived[t.id] || 0
    const hSub = hostileArrived[t.id] || 0

    // 源头扣减：还原派遣前总量，再随出发逐个减少
    let value = (srcTotal > 0 || srcDep > 0) ? (t.units + srcTotal - srcDep) : t.units

    // 友方增援：逐个加上
    value += fAdd

    // 交战：守军被逐个消耗；攻方一旦超过守军即翻面，改为攻方逐个累加
    if (hSub > 0) {
      const net = value - hSub
      value = net >= 0 ? net : -net
    }

    displayUnits.value[t.id] = Math.max(0, value)
  })

  animFrame.value = requestAnimationFrame(tickAnimation)
}

onMounted(() => {
  tickAnimation()
  syncViewportBounds()
  if (typeof ResizeObserver !== 'undefined' && mapShellRef.value) {
    resizeObserver = new ResizeObserver(() => syncViewportBounds())
    resizeObserver.observe(mapShellRef.value)
  }
  window.addEventListener('resize', syncViewportBounds, { passive: true })
})

onUnmounted(() => {
  if (animFrame.value) {
    cancelAnimationFrame(animFrame.value)
  }
  resizeObserver?.disconnect?.()
  window.removeEventListener('resize', syncViewportBounds)
  activePointers.clear()
})
</script>
