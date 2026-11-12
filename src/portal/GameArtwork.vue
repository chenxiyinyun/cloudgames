<!-- SVG 坐标属性保持紧凑，便于逐幅校对像素插画。 -->
<!-- eslint-disable vue/max-attributes-per-line, vue/attributes-order -->
<script setup>
defineProps({
  game: {
    type: String,
    default: 'codenames'
  },
  decorative: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <svg
    class="game-artwork"
    viewBox="0 0 480 320"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : `${game} 游戏像素插画`"
    :role="decorative ? undefined : 'img'"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern
        id="art-grid"
        width="24"
        height="24"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M24 0H0V24"
          fill="none"
          stroke="#E2D5F2"
          stroke-opacity=".1"
        />
      </pattern>
    </defs>
    <path
      fill="url(#art-grid)"
      d="M0 0h480v320H0z"
    />

    <g v-if="game === 'codenames'">
      <path
        fill="#F4D03F"
        d="m377 42 6 14 14 6-14 6-6 14-6-14-14-6 14-6 6-14Z"
      />
      <path
        fill="#5EDCF4"
        d="M59 240h8v8h-8zM93 58h6v6h-6zM415 239h8v8h-8z"
      />
      <g transform="rotate(-9 246 174)">
        <path
          fill="#F0A6CA"
          d="M168 69h171v171H168z"
        />
        <path
          fill="#FFFFFF"
          d="M151 54h171v171H151z"
          stroke="#0A0E27"
          stroke-width="5"
        />
        <path
          fill="#0A0E27"
          d="M166 68h12v12h-12z"
        />
        <path
          fill="#0A0E27"
          d="M184 78h88v5h-88z"
        />
        <path
          fill="#F0A6CA"
          d="M171 111h22v22h-22zM221 111h22v22h-22zM271 111h22v22h-22zM196 141h22v22h-22zM246 141h22v22h-22zM171 171h22v22h-22zM221 171h22v22h-22zM271 171h22v22h-22z"
        />
        <path
          fill="#5EDCF4"
          d="M196 111h22v22h-22zM246 111h22v22h-22zM171 141h22v22h-22zM221 141h22v22h-22zM271 141h22v22h-22zM196 171h22v22h-22zM246 171h22v22h-22z"
        />
        <path
          stroke="#E2D5F2"
          stroke-width="3"
          d="M282 80h24m-24 7h16"
        />
      </g>
      <g transform="rotate(24 126 192)">
        <path
          fill="#5EDCF4"
          d="M119 177h14v111h-14z"
          stroke="#0A0E27"
          stroke-width="5"
        />
        <path
          fill="#F4D03F"
          d="M102 99h48v68h-48z"
          stroke="#0A0E27"
          stroke-width="5"
        />
        <path
          fill="#0A0E27"
          d="M112 110h28v45h-28z"
        />
        <path
          fill="#5EDCF4"
          d="M116 115h20v29h-20z"
        />
      </g>
      <path
        fill="none"
        stroke="#F0A6CA"
        stroke-width="5"
        d="m329 231 20 10 20-10m-20 10v27"
      />
    </g>

    <g v-else-if="game === 'catguess'">
      <path
        fill="#F0A6CA"
        d="M361 48h8v8h-8zM85 73h10v10H85zM403 230h6v6h-6z"
      />
      <path
        fill="#F4D03F"
        d="m106 187 6 16 16 6-16 6-6 16-6-16-16-6 16-6 6-16Z"
      />
      <g transform="rotate(7 240 160)">
        <path
          fill="#5EDCF4"
          d="M157 80h196v184H157z"
        />
        <path
          fill="#F0A6CA"
          d="M141 62h196v184H141z"
          stroke="#0A0E27"
          stroke-width="5"
        />
        <path
          fill="#FFFFFF"
          d="M157 78h164v129H157z"
          stroke="#0A0E27"
          stroke-width="4"
        />
        <path
          fill="#5EDCF4"
          d="M183 164v-42l18-27 23 10 17-10 23 27v42c-8 25-73 25-81 0Z"
          stroke="#0A0E27"
          stroke-width="4"
        />
        <path
          fill="#0A0E27"
          d="M201 133h8v11h-8zM247 133h8v11h-8zM224 149h8v6h-8z"
        />
        <path
          fill="none"
          stroke="#0A0E27"
          stroke-width="3"
          d="M215 159q13 12 26 0m-56-14-19-6m19 17-21 4m112-15 19-6m-19 17 21 4"
        />
        <path
          fill="#F4D03F"
          d="m284 91 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z"
        />
        <path
          fill="#0A0E27"
          d="M185 222h43v6h-43zM239 222h25v6h-25z"
        />
      </g>
      <path
        fill="#FFFFFF"
        d="M63 105h83v38h-42l-13 13v-13H63z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#F0A6CA"
        d="M78 119h9v9h-9zM96 119h9v9h-9zM114 119h9v9h-9z"
      />
      <path
        fill="none"
        stroke="#5EDCF4"
        stroke-width="5"
        d="m367 142 26 0 12 12v52l-12 12h-52l-12-12v-26"
      />
    </g>

    <g v-else-if="game === 'bomb-defuse'">
      <path
        fill="#F4D03F"
        d="m376 48 5 14 14 5-14 5-5 14-5-14-14-5 14-5 5-14Z"
      />
      <path
        fill="#F0A6CA"
        d="M72 219h8v8h-8zM415 244h8v8h-8z"
      />
      <path
        fill="none"
        stroke="#F4D03F"
        stroke-width="8"
        d="M265 77V56c0-25 46-28 52 0l7 28"
      />
      <path
        fill="none"
        stroke="#F0A6CA"
        stroke-width="5"
        d="m325 30 12-10m0 29 17-2m-40 8-4-15"
      />
      <path
        fill="#F0A6CA"
        d="M148 102h187v144H148z"
      />
      <path
        fill="#FFFFFF"
        d="M131 84h187v144H131z"
        stroke="#0A0E27"
        stroke-width="5"
      />
      <path
        fill="#0A0E27"
        d="M149 103h151v44H149z"
      />
      <path
        fill="#F4D03F"
        d="M163 115h11v19h-11zM178 115h16v5h-16zM178 130h16v5h-16zM206 115h11v19h-11zM221 115h16v5h-16zM221 130h16v5h-16zM249 115h11v19h-11zM264 115h16v5h-16zM264 130h16v5h-16z"
      />
      <path
        fill="#5EDCF4"
        d="M151 166h47v42h-47z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#0A0E27"
        d="M164 179h21v16h-21z"
      />
      <path
        fill="#F0A6CA"
        d="M218 166h82v42h-82z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="none"
        stroke="#0A0E27"
        stroke-width="4"
        d="m233 178 20 18m-20 0 20-18m22-9h11v29h-11z"
      />
      <path
        fill="#0A0E27"
        d="M145 228h20v12h-20zM286 228h20v12h-20z"
      />
      <path
        fill="none"
        stroke="#5EDCF4"
        stroke-width="5"
        d="m60 122 27-11 20 18-7 32-33 4-15-23z"
      />
      <path
        fill="#F4D03F"
        d="M70 126h16v16H70z"
      />
    </g>

    <g v-else-if="game === 'gomoku'">
      <path
        fill="#F4D03F"
        d="m376 46 6 14 14 6-14 6-6 14-6-14-14-6 14-6 6-14Z"
      />
      <path
        fill="#F0A6CA"
        d="M62 219h8v8h-8zM405 239h8v8h-8z"
      />
      <g transform="rotate(-6 240 148)">
        <path
          fill="#E8BE7E"
          d="M146 54h188v188H146z"
        />
        <path
          fill="#F0D9A8"
          d="M146 54h188v188H146z"
          stroke="#0A0E27"
          stroke-width="5"
        />
        <path
          stroke="#5A3D1E"
          stroke-width="3"
          d="M162 70v156M188 70v156M214 70v156M240 70v156M266 70v156M292 70v156M318 70v156M162 70h156M162 96h156M162 122h156M162 148h156M162 174h156M162 200h156M162 226h156"
        />
        <path
          fill="#0A0E27"
          d="M236 144h8v8h-8z"
        />
        <circle
          cx="240"
          cy="122"
          r="11"
          fill="#181818"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="266"
          cy="122"
          r="11"
          fill="#F6F4EC"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="214"
          cy="148"
          r="11"
          fill="#181818"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="240"
          cy="148"
          r="11"
          fill="#F6F4EC"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="266"
          cy="174"
          r="11"
          fill="#181818"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="188"
          cy="174"
          r="11"
          fill="#181818"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="292"
          cy="148"
          r="11"
          fill="#F6F4EC"
          stroke="#0A0E27"
          stroke-width="3"
        />
        <circle
          cx="214"
          cy="200"
          r="11"
          fill="#F6F4EC"
          stroke="#0A0E27"
          stroke-width="3"
        />
      </g>
      <path
        fill="none"
        stroke="#F4D03F"
        stroke-width="5"
        stroke-dasharray="8 9"
        d="M64 260q88 46 176 8t176-4"
      />
    </g>

    <g v-else>
      <path
        fill="#5EDCF4"
        d="m385 50 6 14 14 6-14 6-6 14-6-14-14-6 14-6 6-14Z"
      />
      <path
        fill="#F0A6CA"
        d="M64 69h8v8h-8zM409 233h10v10h-10z"
      />
      <path
        fill="#F0A6CA"
        d="m164 93 73-42 73 42v84l-73 42-73-42z"
      />
      <path
        fill="#5EDCF4"
        d="m149 80 73-42 73 42v84l-73 42-73-42z"
        stroke="#0A0E27"
        stroke-width="5"
      />
      <path
        fill="#0A0E27"
        d="m149 80 73 42 73-42m-73 42v84"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#FFFFFF"
        d="m222 122 35-20 38 22-38 22z"
      />
      <path
        fill="#F4D03F"
        d="m205 191 64-37 63 37-64 37z"
        stroke="#0A0E27"
        stroke-width="5"
      />
      <path
        fill="#F0A6CA"
        d="m307 149 50-29 49 29v58l-49 29-50-29z"
        stroke="#0A0E27"
        stroke-width="5"
      />
      <path
        fill="#0A0E27"
        d="m307 149 50 29 49-29m-49 29v58"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#5EDCF4"
        d="M98 173h12v43H86v-43z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#F0A6CA"
        d="M98 135h58v27H98z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#F4D03F"
        d="M213 77h12v43h-12z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="#FFFFFF"
        d="M219 46h47v26h-47z"
        stroke="#0A0E27"
        stroke-width="4"
      />
      <path
        fill="none"
        stroke="#F4D03F"
        stroke-width="5"
        stroke-dasharray="8 9"
        d="M103 245q78 57 160 9t113-5"
      />
    </g>
  </svg>
</template>

<style scoped>
.game-artwork {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
