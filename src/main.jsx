import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// 正文衬线字体自托管(v11 §1):unicode-range 分片,同源按需加载
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import './index.css'

// This is where React "mounts" onto the page.
// It finds the <div id="root"> in index.html and renders <App /> inside it.
// StrictMode is a development helper that flags potential problems in your code.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
