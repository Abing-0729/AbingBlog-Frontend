import { createApp } from 'vue'
import App from './App.vue'
import { installVisitorHeaders } from './services/visitor'
import './styles.css'

// 访客身份头要在任何 API 请求发出前装好（对 window.fetch 的包装）
installVisitorHeaders()

createApp(App).mount('#app')
