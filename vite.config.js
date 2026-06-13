import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite config — https://vite.dev/config/
// The React plugin enables JSX and Fast Refresh (instant updates while you edit).
export default defineConfig({
  plugins: [
    react(),
    // PWA(v10 §7):纯静态站,precache 构建产物,首访后全站离线
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['hexagram.svg'],
      manifest: {
        name: '观象 · 个人学习站',
        short_name: '观象',
        description: '易经研习与道藏研读——六十四卦、推演、经传、筮例',
        lang: 'zh-CN',
        theme_color: '#a03a2a',
        background_color: '#f7f4ec',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2 不进 precache(全集分片数 MB),走下方 runtime CacheFirst
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        // 数据 chunk 较大,放宽单文件上限
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
})
