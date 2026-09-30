// 正文衬线字体(Noto Serif SC,@fontsource 分片)按需加载(2026-10-01「老师首次打开」T2 方案 A,owner 定)。
// 此前在 main.jsx 静态引入,首页首屏就要下 32 片约 1.2 MB 字体——对大陆 4G 用户是首字之前的大头。
// 现在:首页 / 门户 / 各组首页用系统衬线兜底(--font-serif 栈里 Noto 之后是 Songti SC / SimSun / Noto Serif CJK…),
// 进到阅读页(任何不是「首页」的路由)才动态引入三档字重的 @font-face;font-display: swap 已在分片 CSS 里,
// 先用系统字显字、Noto 到了再换。iOS 壳与 PWA 不受影响(资源仍是同源分片,运行时 CacheFirst)。
let loading = null
export function ensureSerifFont() {
  if (loading) return loading
  loading = Promise.all([
    import('@fontsource/noto-serif-sc/400.css'),
    import('@fontsource/noto-serif-sc/500.css'),
    import('@fontsource/noto-serif-sc/600.css'),
  ]).catch(() => { loading = null })
  return loading
}
