import { createApp } from 'vue';
import './styles/shanhai.css';
import App from './App.vue';

const app = createApp(App);

app.config.errorHandler = (err) => {
  console.error('[山海来信] 界面运行异常:', err);
};

app.mount('#app');
