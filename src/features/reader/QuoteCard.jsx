import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { DEFAULT_SETTINGS, getQuoteTheme, saveQuoteTheme } from '../yijing/storage.js'

const CANONICAL_ORIGIN = 'https://hexa.gavin.pub'

// 分享卡主题 token：卡片 SVG 与浮层 swatch 共用一表；节气主题留待后续。
export const THEMES = Object.freeze({
  classic: Object.freeze({
    name: '朱印经典',
    background: '#f7f4ec', border: '#d8cfbb', original: '#26211a', translation: '#6b6155',
    sealBg: '#a03a2a', sealText: '#f7f4ec', ornament: '#a03a2a', signature: '#8a7f6f', qr: '#a03a2a',
  }),
  ink: Object.freeze({
    name: '水墨留白',
    background: '#ffffff', border: '#cbc7bf', original: '#242320', translation: '#64605a',
    sealBg: '#a03a2a', sealText: '#ffffff', ornament: '#8b8780', signature: '#77736d', qr: '#242320',
  }),
  moon: Object.freeze({
    name: '暗夜月白',
    background: '#171a1d', border: '#4a4f52', original: '#f1ede3', translation: '#c7c0b2',
    sealBg: '#a88a55', sealText: '#171a1d', ornament: '#a88a55', signature: '#b6afa2', qr: '#f1ede3',
  }),
})

export const DEFAULT_QUOTE_THEME = DEFAULT_SETTINGS.quoteTheme

// 金句卡(#147)——把一段原文 + 译文 + 书名渲成可分享的图。SVG 现卡 + 转 PNG 下载
// (await fonts.ready 保中文衬线已就绪;失败则用户仍可直接截图本卡)。无账号站的低成本传播面。
function wrap(text, per) {
  const out = []
  for (let i = 0; i < (text || '').length; i += per) out.push(text.slice(i, i + per))
  return out
}

// 无论从 dev、Capacitor 还是生产页生成，分享出去都指向唯一生产域名。
export function canonicalQuoteUrl(href = '/') {
  const parsed = new URL(href, CANONICAL_ORIGIN)
  return `${CANONICAL_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`
}

// node-qrcode 只负责本地生成矩阵；这里把连续 module 合成一个 SVG path，便于直接融入卡面。
export function qrPathFor(value) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'Q' })
  const { data, size } = qr.modules
  const quiet = 4
  let path = ''
  for (let row = 0; row < size; row += 1) {
    let start = -1
    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && data[row * size + col]
      if (dark && start < 0) start = col
      if ((!dark || col === size) && start >= 0) {
        const x = start + quiet, y = row + quiet, width = col - start
        path += `M${x} ${y}h${width}v1h-${width}z`
        start = -1
      }
    }
  }
  return { path, viewBoxSize: size + quiet * 2, modules: size, quiet }
}

export default function QuoteCard({ original, translation, source, href, onClose }) {
  const [busy, setBusy] = useState(false)
  const [themeId, setThemeId] = useState(getQuoteTheme)
  const svgRef = useRef(null)
  const theme = THEMES[themeId] || THEMES[DEFAULT_QUOTE_THEME]
  const deepLink = useMemo(() => canonicalQuoteUrl(
    href || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}${window.location.hash}` : '/'),
  ), [href])
  const qr = useMemo(() => qrPathFor(deepLink), [deepLink])
  const W = 560
  const oLH = 40, tLH = 28
  const oLines = wrap(original, 15)
  const tLines = wrap(translation, 22)
  const oTop = 104
  const lastO = oTop + (Math.max(oLines.length, 1) - 1) * oLH
  const tTop = lastO + 48
  const lastT = tTop + (Math.max(tLines.length, 1) - 1) * tLH
  const contentBottom = tLines.length ? lastT : lastO
  const H = contentBottom + 158
  const qrSize = 88, qrX = W - 128, qrY = H - 120
  const signatureX = 218

  function selectTheme(id) {
    setThemeId(saveQuoteTheme(id))
  }

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
        <div className="quote-modal__themes" role="radiogroup" aria-label="分享卡主题">
          <span className="quote-modal__themes-label">卡面</span>
          {Object.entries(THEMES).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={themeId === id}
              aria-label={preset.name}
              title={preset.name}
              className={`quote-swatch ${themeId === id ? 'quote-swatch--active' : ''}`}
              style={{
                '--quote-swatch-bg': preset.background,
                '--quote-swatch-ink': preset.original,
                '--quote-swatch-accent': preset.sealBg,
              }}
              onClick={() => selectTheme(id)}
            />
          ))}
          <span className="quote-modal__theme-name" aria-live="polite">{theme.name}</span>
        </div>
        <svg ref={svgRef} className="quote-card" width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
          <title>{`${source || '观象'}分享卡 · 扫码读原文`}</title>
          <rect x="0" y="0" width={W} height={H} fill={theme.background} />
          <rect x="12" y="12" width={W - 24} height={H - 24} fill="none" stroke={theme.border} strokeWidth="1" />
          <text x={W / 2} y="60" textAnchor="middle" fontFamily={FF} fontSize="20" letterSpacing="6" fill={theme.ornament}>观 象</text>
          {oLines.map((ln, i) => (
            <text key={`o${i}`} x={W / 2} y={oTop + i * oLH} textAnchor="middle" fontFamily={FF} fontSize="27" fill={theme.original}>{ln}</text>
          ))}
          {tLines.map((ln, i) => (
            <text key={`t${i}`} x={W / 2} y={tTop + i * tLH} textAnchor="middle" fontFamily={FF} fontSize="15" fill={theme.translation}>{ln}</text>
          ))}
          <line x1="68" y1={H - 104} x2="368" y2={H - 104} stroke={theme.ornament} strokeWidth="1" opacity="0.42" />
          <text x={signatureX} y={H - 76} textAnchor="middle" fontFamily={FF} fontSize="14" fill={theme.signature}>{source}</text>
          <text x={signatureX} y={H - 50} textAnchor="middle" fontFamily={FF} fontSize="11" letterSpacing="1" fill={theme.signature}>扫码读原文 · 观象</text>

          <g aria-label="原文二维码">
            <rect x={qrX} y={qrY} width={qrSize} height={qrSize} rx="2" fill="none" stroke={theme.qr} strokeWidth="1" />
            <svg x={qrX + 4} y={qrY + 4} width={qrSize - 8} height={qrSize - 8} viewBox={`0 0 ${qr.viewBoxSize} ${qr.viewBoxSize}`}>
              <path d={qr.path} fill={theme.qr} shapeRendering="crispEdges" />
            </svg>
            {/* 20×20 留白占二维码面积约 5.2%，Q 级纠错下保留充足余量。 */}
            <rect x={qrX + 34} y={qrY + 34} width="20" height="20" rx="2" fill={theme.background} />
            <rect x={qrX + 36} y={qrY + 36} width="16" height="16" rx="2" fill={theme.sealBg} />
            <text x={qrX + 44} y={qrY + 48.5} textAnchor="middle" fontFamily={FF} fontSize="10" fill={theme.sealText}>观</text>
          </g>
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
