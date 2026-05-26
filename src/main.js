import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createLogger } from './services/logger'
import { gameState } from './stores/gameStore'

const log = createLogger('Vue')

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  log.error('Unhandled Vue error:', err, info, 'in component:', instance)
  gameState.error = err instanceof Error ? err.message : String(err)
}

app.config.warnHandler = (msg, instance, trace) => {
  log.warn('Vue warning:', msg, 'in component:', instance, 'trace:', trace)
}

app.mount('#app')
