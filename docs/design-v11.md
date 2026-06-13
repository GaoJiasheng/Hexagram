# 观象 · 十一期设计稿 — 工程打磨期(v11)

> 主题:纯工程优化,零内容、零功能语义变化。四批:字体自托管 / 路由懒加载与数据分包 / 按页标题与 iOS 图标 / 暗色走查。发版 v1.10.0。

## 1. 字体自托管(批次 1)

- 弃 fonts.googleapis.com(国内不稳;跨域字体不进 precache,离线即缺字),改 `@fontsource/noto-serif-sc`(unicode-range 分片,同源按需加载),index.html 删 Google 三行,main.jsx import 400/600 两档。
- workbox:woff2 **不进 precache**(全集数 MB),加 runtimeCaching CacheFirst(`/assets/*.woff2`,30 天)——离线时已访问过的分片可用,未缓存分片优雅回退系统衬线(--font-serif 栈不变)。

## 2. 路由懒加载与数据分包(批次 2)

- App.jsx 两模块全部页面改 `React.lazy`,`<Suspense>` 包 Routes,fallback 用极简居中占位。
- 数据分包以 Rollup 自动 hoist 为准,只在共享 chunk 不理想时用 manualChunks,且**仅限 src/data/yijing**——道藏分书 chunk(loadClassics/道藏阅读器动态 import)严禁合并。
- 验收:主包(入口 JS)较 780KB 显著下降;全路由走查无白屏/闪烁异常;PWA precache 项数增多但总量近似。

## 3. 按页标题与 iOS 图标(批次 3)

- `usePageTitle(title)` hook:挂载时 `document.title = title ? title + ' · ' + 模块名 : 默认`;易经侧缀「观象」、道藏侧缀「观道」。接入:卦页(fullName)/筮例详情/经传与道藏阅读器(书·第N章)/学堂各篇/总览/工作台/我的/搜索落地页等。
- `public/apple-touch-icon.png`(180px,由 512 重采样)+ index.html `<link rel="apple-touch-icon">`。

## 4. 暗色走查(批次 4)

375px+1280px 两档 × dark:方圆图(高亮可辨/参考线不刺眼)、闪卡(选项对错三态)、验占徽章三色、搜索面板高亮、史事/人物章、道藏撰人小传。发现即修;硬编码色一律改 token。

## 验收(批次 4 收尾)

- [ ] 字体请求全部同源;断网刷新已访问页字形正常
- [ ] 入口 JS < 400KB;逐路由走查通过
- [ ] 卦页/筮例/阅读器标题正确;iPhone 加主屏图标为朱砂卦象
- [ ] 暗色两端走查零遗留
- [ ] test/build/check-data 全过;CLAUDE.md/README 更新;tag v1.10.0 推送
