import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Vite config — https://vite.dev/config/
// The React plugin enables JSX and Fast Refresh (instant updates while you edit).
// VITE_CAP=1 时为 Capacitor 原生壳构建:禁用 PWA service worker
// (壳内由原生 WebView 本地服务托管 + 资源已打包进 app,离线天然成立;SW 会与本地服务冲突致白屏)
const isCapacitor = process.env.VITE_CAP === '1'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const licenseSource = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8')
const buildDate = new Date().toISOString()
// 跋里显示的不再是 package.json 的版本号(它停在 1.34.0 很久了、tag 也停在 v1.68.0,都不是真的),
// 改显示当次构建的提交号:零维护、永远真。取不到(无 git)则空,跋里那一格不渲染。
let appCommit = ''
try { appCommit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* 无 git 时留空 */ }

// index.html 的 description / og:description 数字(N 部典籍、N 组书架)由 stats.json 注入 ——
// 手写的那份从「七十四部…十三组」一路过期到 83 部 / 15 组没人改(2026-10-01 T9)。
// stats.json 由 build-content-assets 生成,dev / build 都前置跑了 content:build;取不到就写不带数字的句子。
function statsMeta() {
  const read = () => {
    try {
      const f = new URL('./public/content/stats.json', import.meta.url)
      return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
    } catch { return null }
  }
  return {
    name: 'stats-meta',
    transformIndexHtml(html) {
      const s = read()
      const books = s?.books ? `${s.books} 部典籍` : '诸多典籍'
      const shelves = s?.shelves ? `${s.shelves} 组书架` : '诸组书架'
      const long = `${books}的原文、白话译注、每章延伸与深读。易经、道藏、儒释、诸子百家、中医、谋略、命理、唐诗宋词元曲，${shelves}同站。引文逐字校验为原文精确子串。`
      const short = `${books}的原文、白话译注与深读，${shelves}同站。引文逐字校验。`
      return html.replaceAll('__STATS_DESC_SHORT__', short).replaceAll('__STATS_DESC__', long)
    },
  }
}

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
    statsMeta(),
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
        // /api/* 必须排除:navigateFallback 会拦**所有导航请求**,包括
        // `/api/auth/google/start` 这种「靠服务端 302 跳走」的接口 —— 装了 SW 的回访用户
        // 点「用 Google 登录」会被喂一份缓存的 index.html,渲染成假的「页面不存在」,永远登不进去。
        // curl 看不出来(没有 SW),只有真在浏览器里走一遍才会暴露。
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // 白话 / 导读 / 搜索分片 / og 分片等构建期拆出的小文件(/content/):运行时 SWR 缓存——
            // 装了 PWA 的手机离线也能翻已读过的白话与搜索(原只预缓存 app 壳,离线开白话是白屏;M2,2026-10-01)
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/content/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'content',
              expiration: { maxEntries: 1200, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
  // vitest:排除 .claude/worktrees(app 为隔离代理建的镜像目录,不排除会把全部测试跑两遍)与 iOS 壳目录
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/ios/**', '**/android/**'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __APP_COMMIT__: JSON.stringify(appCommit),
  },
})
