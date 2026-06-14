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
        // 只预缓存「壳」(html/css/图标)——小而稳;JS/JSON/数据分片改 runtime 按需缓存。
        // 旧配置把全部 11 分站的 js/json(~数 MB)一次性预缓存:单站访客首装拉满带宽,
        // 且在网络层打穿了分组隔离(别组数据全下到本地)。现仅按实际访问逐片缓存。
        globPatterns: ['**/*.{css,html,svg,webmanifest}', 'hexagram.svg', 'pwa-*.png', 'apple-touch-icon*.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          {
            // 路由/数据分片:按需取、就近缓存,后台再校验更新。单站只缓存本站访问过的内容。
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.json')),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-chunks',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
})
