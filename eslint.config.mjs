import js from '@eslint/js';
import vuePlugin from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      'no-console': 'off',           // console is used for debugging in P2P app
      'no-unused-vars': 'warn',
      'no-useless-assignment': 'warn',
      'vue/multi-word-component-names': 'off',  // single-word components like MenuScreen
      'vue/no-export-in-script-setup': 'warn',
    }
  },
  {
    // WebSocket 服务器：Node 运行时，使用 Node 全局（process / setInterval 等）
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node
    }
  }
];
