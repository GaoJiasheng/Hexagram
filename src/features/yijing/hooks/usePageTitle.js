import { useEffect } from 'react'

// 按页更新文档标题(v11 §3):易经侧缀「观象」,道藏侧传 brand='观道'
export function usePageTitle(title, brand = '观象') {
  useEffect(() => {
    document.title = title
      ? `${title} · ${brand}`
      : brand === '观道' ? '观道 · 道藏研读' : '观象 · 易经研习'
  }, [title, brand])
}
