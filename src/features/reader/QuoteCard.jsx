import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 金句卡(#147)——把一段原文 + 译文 + 书名渲成可分享的图。SVG 现卡 + 转 PNG 下载
// (await fonts.ready 保中文衬线已就绪;失败则用户仍可直接截图本卡)。无账号站的低成本传播面。
function wrap(text, per) {
  const out = []
  for (let i = 0; i < (text || '').length; i += per) out.push(text.slice(i, i + per))
  return out
}

export default function QuoteCard({ original, translation, source, onClose }) {
  const [busy, setBusy] = useState(false)
  const svgRef = useRef(null)
  const W = 560
  const oLH = 40, tLH = 28
  const oLines = wrap(original, 15)
  const tLines = wrap(translation, 22)
  const oTop = 104
  const lastO = oTop + (oLines.length - 1) * oLH
  const tTop = lastO + 48
  const lastT = tTop + (Math.max(tLines.length, 1) - 1) * tLH
  const H = (tLines.length ? lastT : lastO) + 72

  async function download() {
    setBusy(true)
    try {
      if (document.fonts?.ready) await document.fonts.ready
      const xml = new XMLSerializer().serializeToString(svgRef.current)
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = W * scale; canvas.height = H * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = '观象金句.png'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }, 'image/png')
    } catch { /* 静默:截图兜底 */ }
    setBusy(false)
  }

  const FF = "'Noto Serif SC', serif"
  // createPortal 到 body:逃出阅读器里带 content-visibility/transform 的祖先，
  // 否则 .quote-overlay 的 position:fixed 遮罩盖不满视口、按钮区会透出页面正文（与注释气泡/白话抽屉同款修法）。
  return createPortal(
    <div className="quote-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="quote-modal" role="dialog" aria-modal="true" aria-label="金句卡">
        <svg ref={svgRef} className="quote-card" width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#f7f4ec" />
          <rect x="12" y="12" width={W - 24} height={H - 24} fill="none" stroke="#d8cfbb" strokeWidth="1" />
          <text x={W / 2} y="60" textAnchor="middle" fontFamily={FF} fontSize="20" letterSpacing="6" fill="#a03a2a">观 象</text>
          {oLines.map((ln, i) => (
            <text key={`o${i}`} x={W / 2} y={oTop + i * oLH} textAnchor="middle" fontFamily={FF} fontSize="27" fill="#26211a">{ln}</text>
          ))}
          {tLines.map((ln, i) => (
            <text key={`t${i}`} x={W / 2} y={tTop + i * tLH} textAnchor="middle" fontFamily={FF} fontSize="15" fill="#6b6155">{ln}</text>
          ))}
          <text x={W / 2} y={H - 34} textAnchor="middle" fontFamily={FF} fontSize="14" fill="#8a7f6f">{source}</text>
        </svg>
        <div className="quote-modal__actions">
          <button className="btn btn--secondary" onClick={download} disabled={busy}>{busy ? '生成中…' : '下载图片'}</button>
          <button className="btn btn--ghost" onClick={onClose}>关闭</button>
        </div>
        <p className="quote-modal__hint text-faint">下载图片,或直接截图本卡分享。</p>
      </div>
    </div>,
    document.body,
  )
}
