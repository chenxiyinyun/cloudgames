<template>
  <section class="manual-layout">
    <div
      class="manual-tools"
      aria-label="说明书筛选"
    >
      <label class="manual-search">
        <span>检索</span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="线色 / SAFE / 符号"
        >
      </label>
      <div
        class="manual-tabs"
        role="tablist"
        aria-label="模块分类"
      >
        <button
          v-for="tab in moduleTabs"
          :key="tab.type"
          class="manual-tab"
          :class="{ active: activeType === tab.type }"
          type="button"
          :aria-selected="activeType === tab.type"
          @click="activeType = tab.type"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <article
      v-if="showOverview"
      class="manual-page manual-overview"
    >
      <h2>炸弹信息</h2>
      <p>序列号：{{ serialNumber }}</p>
      <p>电池：{{ batteries }}</p>
      <p>指示灯：{{ indicators.join(' / ') || '无' }}</p>
    </article>

    <article
      v-for="module in filteredModules"
      :key="module.id"
      class="manual-page"
    >
      <h2>{{ moduleTitle(module.type) }}</h2>
      <template v-if="module.type === 'wires'">
        <ol>
          <li>没有红线时，剪第二根线。</li>
          <li>最后一根是白线且序列号为奇数时，剪最后一根。</li>
          <li>蓝线超过一根时，剪最后一根蓝线。</li>
          <li>其他情况，剪最后一根线。</li>
        </ol>
      </template>
      <template v-else-if="module.type === 'symbols'">
        <p>找到包含全部四个符号的列，再按该列从上到下的顺序按下按钮。</p>
        <div class="manual-columns">
          <ol
            v-for="(column, index) in module.manualView.columns"
            :key="index"
          >
            <li
              v-for="symbolId in column"
              :key="symbolId"
            >
              {{ module.manualView.labels[symbolId] }}
            </li>
          </ol>
        </div>
      </template>
      <template v-else>
        <ol>
          <li>显示 READY 且序列号为偶数时，按 SAFE。</li>
          <li>电池不少于 3 个且有 CUT 时，按 CUT。</li>
          <li>有 HOLD 时，按 HOLD。</li>
          <li>其他情况按第一个按钮。</li>
        </ol>
      </template>
    </article>

    <p
      v-if="!showOverview && filteredModules.length === 0"
      class="manual-empty"
    >
      没有匹配的说明条目
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modules: {
    type: Array,
    required: true
  },
  serialNumber: {
    type: String,
    required: true
  },
  batteries: {
    type: Number,
    required: true
  },
  indicators: {
    type: Array,
    default: () => []
  }
})

const activeType = ref('all')
const searchQuery = ref('')

const moduleTabs = [
  { type: 'all', label: '全部' },
  { type: 'wires', label: '电线' },
  { type: 'symbols', label: '符号' },
  { type: 'keypad', label: '键盘' }
]

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

const filteredModules = computed(() =>
  props.modules.filter(module => {
    const matchesType = activeType.value === 'all' || module.type === activeType.value
    const matchesQuery = !normalizedQuery.value ||
      moduleSearchText(module).includes(normalizedQuery.value)
    return matchesType && matchesQuery
  })
)

const showOverview = computed(() =>
  activeType.value === 'all' &&
  (!normalizedQuery.value || overviewSearchText().includes(normalizedQuery.value))
)

function moduleTitle(type) {
  if (type === 'wires') return '电线模块'
  if (type === 'symbols') return '符号模块'
  return '密码键盘'
}

function moduleSearchText(module) {
  const chunks = [moduleTitle(module.type), module.type]

  if (module.type === 'wires') {
    chunks.push('红线 蓝线 白线 黄线 黑线 第二根 最后一根 序列号 奇数')
  } else if (module.type === 'symbols') {
    chunks.push('符号 顺序 列')
    chunks.push(...Object.values(module.manualView.labels || {}))
  } else {
    chunks.push('READY ALERT HOLD COUNT SAFE CUT SEND VENT ARM 电池 序列号 偶数')
    chunks.push(...(module.manualView.rules || []))
  }

  return chunks.join(' ').toLowerCase()
}

function overviewSearchText() {
  return [
    '炸弹信息',
    '序列号',
    props.serialNumber,
    '电池',
    String(props.batteries),
    '指示灯',
    ...props.indicators
  ].join(' ').toLowerCase()
}
</script>
