import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config — https://vite.dev/config/
// The React plugin enables JSX and Fast Refresh (instant updates while you edit).
export default defineConfig({
  plugins: [react()],
})
