import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// 正文衬线字体自托管(v11 §1):unicode-range 分片,同源按需加载
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import './index.css'

// 懒加载 chunk 预载失败(发版后旧 hash 已失效):自动刷新取最新资源,带循环保护。
const CHUNK_RELOAD_KEY = 'guanxiang.v1.chunk-reloaded'
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      event.preventDefault()
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
    }
  } catch { /* sessionStorage 不可用时放任默认行为 */ }
})
// 稳定运行数秒后清除标记,使下次发版仍可自动刷新(短时间内连续失败则不再刷,交错误边界兜底)
window.addEventListener('load', () => {
  setTimeout(() => { try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* noop */ } }, 5000)
})

// This is where React "mounts" onto the page.
// It finds the <div id="root"> in index.html and renders <App /> inside it.
// StrictMode is a development helper that flags potential problems in your code.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
