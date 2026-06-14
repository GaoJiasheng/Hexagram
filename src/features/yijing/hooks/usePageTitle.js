import { useEffect } from 'react'

// 各站品牌 → 首页标题(空 title 时的兜底);新站在此登记,否则落到「品牌」二字。
const BRAND_HOME = {
  观象: '观象 · 易经研习',
  观道: '观道 · 道藏研读',
  观仁: '观仁 · 儒典研读',
  观空: '观空 · 释典研读',
  观心: '观心 · 阳明心学',
  观法: '观法 · 法家研读',
  观兼: '观兼 · 墨家研读',
  观兵: '观兵 · 兵家研读',
  观衡: '观衡 · 纵横研读',
  观和: '观和 · 中医典籍',
  观谋: '观谋 · 谋略杂纂',
}

// 按页更新文档标题(v11 §3):易经缀「观象」、道藏「观道」、儒「观仁」、佛「观空」
export function usePageTitle(title, brand = '观象') {
  useEffect(() => {
    document.title = title ? `${title} · ${brand}` : BRAND_HOME[brand] || brand
  }, [title, brand])
}
