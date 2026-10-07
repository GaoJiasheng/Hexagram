import { useEffect, useState } from 'react'
import './BookArt.css'

// 书的题头插图。
//
// 图是单通道 alpha PNG(只有墨色浓淡),不直接 <img> 显示,而是当 CSS 遮罩、
// 底色填主题 token——同一张图在宣纸/素白/暗色三套主题下都是「那套主题的墨」,
// 不必出明暗两版图。
//
// 遮罩图载不到时 background 会整块露出来,所以先用隐藏的 Image 预载:
// 载到了才渲染,载不到就什么也不渲染(不留空色块)。

const TONES = new Set(['soft', 'ink', 'accent'])

export default function BookArt({ src, alt, size = 200, tone = 'soft' }) {
  // 记下「哪个 src 的结果」,换 src 时旧结果自动作废,不必在 effect 里同步重置
  const [loaded, setLoaded] = useState({ src: null, ok: false })

  useEffect(() => {
    if (!src) return undefined
    let alive = true
    const img = new Image()
    img.onload = () => { if (alive) setLoaded({ src, ok: true }) }
    img.onerror = () => { if (alive) setLoaded({ src, ok: false }) }
    img.src = src
    return () => {
      alive = false
      img.onload = null
      img.onerror = null
    }
  }, [src])

  if (!src || loaded.src !== src || !loaded.ok) return null

  const t = TONES.has(tone) ? tone : 'soft'
  const mask = `url(${JSON.stringify(src)})`
  return (
    <span
      className={`book-art${t === 'soft' ? '' : ` book-art--${t}`}`}
      role="img"
      aria-label={alt}
      style={{ width: size, height: size, WebkitMaskImage: mask, maskImage: mask }}
    />
  )
}
