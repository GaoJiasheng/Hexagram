import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// This is where React "mounts" onto the page.
// It finds the <div id="root"> in index.html and renders <App /> inside it.
// StrictMode is a development helper that flags potential problems in your code.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
