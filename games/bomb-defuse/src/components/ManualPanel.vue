<template>
  <section class="manual-layout">
    <article class="manual-page manual-overview">
      <h2>炸弹信息</h2>
      <p>序列号：{{ serialNumber }}</p>
      <p>电池：{{ batteries }}</p>
      <p>指示灯：{{ indicators.join(' / ') || '无' }}</p>
    </article>

    <article
      v-for="module in modules"
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
  </section>
</template>

<script setup>
defineProps({
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

function moduleTitle(type) {
  if (type === 'wires') return '电线模块'
  if (type === 'symbols') return '符号模块'
  return '密码键盘'
}
</script>
