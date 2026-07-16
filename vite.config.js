import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Vite config — https://vite.dev/config/
// The React plugin enables JSX and Fast Refresh (instant updates while you edit).
// VITE_CAP=1 时为 Capacitor 原生壳构建:禁用 PWA service worker
// (壳内由原生 WebView 本地服务托管 + 资源已打包进 app,离线天然成立;SW 会与本地服务冲突致白屏)
const isCapacitor = process.env.VITE_CAP === '1'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const licenseSource = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8')
const buildDate = new Date().toISOString()

function licenseAsset() {
  return {
    name: 'license-asset',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/LICENSE') return next()
        response.statusCode = 200
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        response.end(licenseSource)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE', source: licenseSource })
    },
  }
}

export default defineConfig({
  plugins: [
    licenseAsset(),
    react(),
    // PWA(v10 §7):纯静态站,precache 构建产物,首访后全站离线。原生构建跳过。
    ...(isCapacitor ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['hexagram.svg'],
      manifest: {
        name: '观象 · 个人学习站',
        short_name: '观象',
        description: '易经研习与道藏研读——六十四卦、推演、经传、筮例',
        lang: 'zh-CN',
        theme_color: '#c3272b',
        background_color: '#faf6ec',
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
    })]),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
