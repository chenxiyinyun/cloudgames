<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 }
});
</script>

<template>
  <svg
    class="game-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <!-- 行囊包袱 -->
    <template v-if="name === 'pack'">
      <path d="M8.5 7.5C9.5 5 11.2 4 12 4s2.5 1 3.5 3.5" />
      <path d="M5 12c0-3 3-4.5 7-4.5s7 1.5 7 4.5c0 4.5-2.5 8-7 8s-7-3.5-7-8Z" />
      <path d="M8.5 8c2 2.2 5 2.2 7 0" />
      <circle
        cx="12"
        cy="12.5"
        r="1.3"
      />
    </template>

    <!-- 驿站火漆信笺 -->
    <template v-else-if="name === 'mail'">
      <rect
        x="3.2"
        y="5.5"
        width="17.6"
        height="13"
        rx="2.2"
      />
      <path d="m3.8 6.5 8.2 6.2 8.2-6.2" />
      <circle
        cx="12"
        cy="12.6"
        r="1.8"
        fill="currentColor"
      />
    </template>

    <!-- 泥炉茶壶 -->
    <template v-else-if="name === 'tea'">
      <path d="M6.5 11.5h9.5a1 1 0 0 1 1 1c0 3.6-2.2 6-5.7 6s-5.8-2.4-5.8-6a1 1 0 0 1 1-1Z" />
      <path d="M16.5 12.5h1.8a1.7 1.7 0 0 1 0 3.4H16" />
      <path d="M5.5 13 3.5 11.5" />
      <path d="M9.5 9.2h3.5M11.2 7.5v1.7" />
      <path d="M9 5.5c.6-.9.2-1.7-.4-2.3M13.5 5.5c.6-.9.2-1.7-.4-2.3" />
    </template>

    <!-- 博古架多宝瓶 -->
    <template v-else-if="name === 'shelf'">
      <path d="M4 5.5h16M4 19h16M5.5 5.5V19M18.5 5.5V19" />
      <path d="M10.2 8.5h3.6l-.6 2c1.2 1.1 1.6 2.5 1.3 4.1-.3 1.4-1.2 2.1-2.5 2.1s-2.2-.7-2.5-2.1c-.3-1.6.1-3 1.3-4.1l-.6-2Z" />
    </template>

    <!-- 神兽云纹心境印 -->
    <template v-else-if="name === 'beast'">
      <path d="M6.5 9.5 5.2 4.5l4.3 2.7a7.2 7.2 0 0 1 5 0l4.3-2.7-1.3 5c1 1.5 1.2 3.8.2 5.9-1.1 2.2-3.2 3.6-5.7 3.6s-4.6-1.4-5.7-3.6c-1-2.1-.8-4.4.2-5.9Z" />
      <circle
        cx="9.5"
        cy="12"
        r="0.9"
        fill="currentColor"
      />
      <circle
        cx="14.5"
        cy="12"
        r="0.9"
        fill="currentColor"
      />
      <path d="M10.5 14.8c.9.8 2.1.8 3 0" />
    </template>

    <!-- 线装《新山海经》典籍 -->
    <template v-else-if="name === 'codex'">
      <path d="M5 4.5h12.5a2 2 0 0 1 2 2v12.5a1.5 1.5 0 0 1-1.5 1.5H5.8a1.8 1.8 0 0 1-1.8-1.8V5.5a1 1 0 0 1 1-1Z" />
      <path d="M8.2 4.5v16M4 17.5h15.5" />
      <rect
        x="11"
        y="7.8"
        width="5"
        height="6.8"
        rx="0.6"
      />
    </template>

    <!-- 出门月洞院门 -->
    <template v-else-if="name === 'door-out'">
      <path d="M4 19h16M7 19a5.8 5.8 0 1 1 10 0" />
      <path d="M10.5 12h4.2M13.2 9.8l2 2.2-2 2.2" />
    </template>

    <!-- 回屋廊门 -->
    <template v-else-if="name === 'door-in'">
      <path d="M4 19h16M7 19V7.5L12 4.5l5 3V19" />
      <path d="M14.5 13h-4.2M11.8 10.8 9.8 13l2 2.2" />
    </template>

    <!-- 檐下铜风铃 -->
    <template v-else-if="name === 'bell'">
      <path d="M12 3.5v2M7.5 10.5a4.5 4.5 0 0 1 9 0l1.5 5.5H6l1.5-5.5Z" />
      <path d="M12 16v3.5M10.5 20.5h3" />
    </template>

    <!-- 静默风铃 -->
    <template v-else-if="name === 'bell-mute'">
      <path d="M12 3.5v2M7.8 10a4.5 4.5 0 0 1 8.5.5l1.2 4.5M6.2 16h8.8" />
      <path d="M4.5 4.5 19.5 19.5" />
    </template>

    <!-- 驿站云纹方印（设置/杂记） -->
    <template v-else-if="name === 'settings'">
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="3"
      />
      <path d="M8.5 9.5h7M8.5 14.5h7M12 7.5v9" />
    </template>

    <!-- 静心沙漏 -->
    <template v-else-if="name === 'hourglass'">
      <path d="M6.5 4h11M6.5 20h11" />
      <path d="M8 4v3.4c0 1.8 2 3.4 4 4.6 2-1.2 4-2.8 4-4.6V4M8 20v-3.4c0-1.8 2-3.4 4-4.6 2 1.2 4 2.8 4 4.6V20" />
      <path d="M10 18.5h4" />
    </template>

    <!-- 茶客青瓷盖碗 -->
    <template v-else-if="name === 'teacup'">
      <path d="M5 11.5h14c0 4.2-2.7 7-7 7s-7-2.8-7-7Z" />
      <path d="M6.5 9.5h11M11 6.5h2M8.5 20h7" />
    </template>

    <!-- 精卫栖枝印记 -->
    <template v-else-if="name === 'bird-lock'">
      <path d="M15.5 7.5a3 3 0 0 0-5.4 1.2c0 2.5-3.2 4.1-5.6 5.3 2.4 1.3 5.8 1.5 8.8-.2 2-1.2 3.1-3.2 2.9-5.3l2.3-1-3-0Z" />
      <path d="M5 18.5c4.5-1.2 9.5-1.2 14 0" />
    </template>

    <!-- 收起卷轴印纹 -->
    <template v-else-if="name === 'close-tab'">
      <path d="M5.5 7.5h13M8.5 12h7M12 8.5v7M6.5 16.5h11" />
    </template>

    <!-- 四时日晷 -->
    <template v-else-if="name === 'sundial'">
      <circle
        cx="12"
        cy="12"
        r="7.8"
      />
      <circle
        cx="12"
        cy="12"
        r="1.4"
        fill="currentColor"
      />
      <path d="M12 12 16 8M12 4.2V6M12 18v1.8M4.2 12H6M18 12h1.8" />
    </template>

    <!-- 节气灵草 -->
    <template v-else-if="name === 'herb'">
      <path d="M12 19.5V9.5M12 14.5c-3.8 0-6-2.2-6-5.5 3.3 0 6 2 6 5.5ZM12 12.5c3.8 0 6-2.2 6-5.5-3.3 0-6 2-6 5.5Z" />
      <path d="M12 4.5c1.1 1.4 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.4-1.8 1.5-3.2Z" />
    </template>

    <!-- 朱砂闲章 -->
    <template v-else-if="name === 'seal'">
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2"
      />
      <path d="M8.5 8.5h7v7h-7zM12 8.5v7" />
    </template>

    <!-- 天气：晴朗 -->
    <template v-else-if="name === 'weather-sunny'">
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </template>

    <!-- 天气：多云 -->
    <template v-else-if="name === 'weather-cloudy'">
      <path d="M7.5 17.5h9.5a3.5 3.5 0 0 0 .4-6.98A4.8 4.8 0 0 0 8.1 9.4 3.6 3.6 0 0 0 7.5 17.5Z" />
    </template>

    <!-- 天气：细雨 -->
    <template v-else-if="name === 'weather-rain'">
      <path d="M7 14.5h10a3 3 0 0 0 .4-5.98A4.3 4.3 0 0 0 8.6 7.6 3.2 3.2 0 0 0 7 14.5Z" />
      <path d="M8.5 17.5 7.5 20M12 17.5 11 20M15.5 17.5 14.5 20" />
    </template>

    <!-- 天气：飘雪 -->
    <template v-else-if="name === 'weather-snow'">
      <path d="M12 4v16M5.1 8l13.8 8M18.9 8 5.1 16" />
      <circle
        cx="12"
        cy="12"
        r="1.4"
      />
    </template>

    <!-- 天气：夜色 -->
    <template v-else-if="name === 'weather-night'">
      <path d="M17.5 14.2A6.5 6.5 0 0 1 9.8 6.5a6.5 6.5 0 1 0 7.7 7.7Z" />
      <path d="M17.5 5.5v2M16.5 6.5h2" />
    </template>

    <!-- 兜底星纹 -->
    <template v-else>
      <path d="M12 4.5 13.8 10.2 19.5 12 13.8 13.8 12 19.5 10.2 13.8 4.5 12 10.2 10.2Z" />
    </template>
  </svg>
</template>

<style scoped>
.game-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
