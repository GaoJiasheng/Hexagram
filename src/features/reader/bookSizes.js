import sizes from '../../data/bookSizes.json'

// 篇幅档(#148)——按原文实际字数粗分 短/中/长,给书架「选哪本读」一个横向可比的读时信号
// (sectionUnit 口径不一:1 卷 vs 81 难 vs 555 段无法横比,字数可)。bookSizes.json 由
// scripts 离线统计各 classics 原文字数生成(加书后重跑统计即纳入)。
export function sizeTier(slug) {
  const n = sizes[slug]
  if (!n) return null
  if (n < 4000) return { label: '短篇', cls: 'short', chars: n }
  if (n < 20000) return { label: '中篇', cls: 'mid', chars: n }
  return { label: '长篇', cls: 'long', chars: n }
}
