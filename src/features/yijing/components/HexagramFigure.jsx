import { useState, useEffect, useRef } from 'react'
import { lineTitle } from '../engine/transforms.js'

const SIZE = {
  sm: { w: 40, h: 5, gap: 5 },
  md: { w: 72, h: 8, gap: 8 },
  lg: { w: 128, h: 13, gap: 12 },
}

export default function HexagramFigure({
  binary,
  size = 'md',
  movingLines = [],
  interactive = 'none', // 'none' | 'toggle-moving'
  onLineClick,
  label,
  highlightLine, // 1-indexed, for LineRow hover sync
}) {
  const cfg = SIZE[size]
  const yinGap = Math.round(cfg.w * 0.18)
  const totalH = 6 * cfg.h + 5 * cfg.gap
  // Extra width for moving markers
  const markerW = movingLines.length > 0 ? 20 : 0
  const svgW = cfg.w + markerW

  const [dispBinary, setDispBinary] = useState(binary)
  const [animLines, setAnimLines] = useState(new Set())
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    if (binary === dispBinary) return
    if (reduceMotion.current) {
      setDispBinary(binary)
      return
    }
    const changed = new Set()
    for (let i = 0; i < 6; i++) {
      if (binary[i] !== dispBinary[i]) changed.add(i)
    }
    if (changed.size === 0) {
      setDispBinary(binary)
      return
    }
    setAnimLines(changed)
    const raf = requestAnimationFrame(() => setDispBinary(binary))
    const maxIdx = Math.max(...changed)
    const timer = setTimeout(() => setAnimLines(new Set()), 400 + maxIdx * 60 + 80)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [binary])

  const movingSet = new Set(movingLines)
  const isInteractive = interactive !== 'none'

  return (
    <svg
      width={svgW}
      height={totalH}
      viewBox={`0 0 ${svgW} ${totalH}`}
      className="hexagram-figure"
      role={isInteractive ? 'group' : 'img'}
      aria-label={label || '卦画'}
    >
      {Array.from({ length: 6 }, (_, i) => {
        const pos = i + 1
        const isYang = dispBinary[i] === '1'
        const isMoving = movingSet.has(pos)
        const isHighlighted = highlightLine === pos
        const isAnim = animLines.has(i)
        // 上爻(i=5) 在顶部 y=0; 初爻(i=0) 在底部
        const y = (5 - i) * (cfg.h + cfg.gap)
        const color = isMoving ? 'var(--cinnabar)' : 'var(--ink)'
        const animDelay = i * 60 // 初爻先动

        const half = cfg.w / 2
        const yinSeg = (cfg.w - yinGap) / 2
        const leftW = isYang ? half : yinSeg
        const rightX = isYang ? half : cfg.w - yinSeg
        const rightW = isYang ? half : yinSeg
        const transProp = `x 0.4s cubic-bezier(0.25,0.1,0.25,1) ${animDelay}ms, width 0.4s cubic-bezier(0.25,0.1,0.25,1) ${animDelay}ms`
        const trans = isAnim ? transProp : 'none'

        return (
          <g
            key={i}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={isInteractive ? `${lineTitle(pos, isYang)}，${isYang ? '阳爻' : '阴爻'}，点击${isMoving ? '取消' : '设为'}动爻` : undefined}
            onClick={isInteractive ? () => onLineClick?.(pos) : undefined}
            onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLineClick?.(pos) } } : undefined}
            style={{ cursor: isInteractive ? 'pointer' : 'default' }}
          >
            {/* hover/highlight background */}
            {(isInteractive || isHighlighted) && (
              <rect
                x={0}
                y={y - 4}
                width={cfg.w}
                height={cfg.h + 8}
                fill={isHighlighted ? 'var(--cinnabar-bg)' : 'transparent'}
                className={isInteractive ? 'yao-hover-bg' : undefined}
              />
            )}
            {/* left segment */}
            <rect x={0} y={y} width={leftW} height={cfg.h} fill={color} style={{ transition: trans }} />
            {/* right segment */}
            <rect x={rightX} y={y} width={rightW} height={cfg.h} fill={color} style={{ transition: trans }} />
            {/* moving line marker */}
            {isMoving && (
              <text
                x={cfg.w + 4}
                y={y + cfg.h}
                className="yao-marker"
                style={{ fontSize: Math.max(9, cfg.h * 1.1), fill: 'var(--cinnabar)', fontFamily: 'var(--font-serif)' }}
              >
                {isYang ? '○' : '×'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
