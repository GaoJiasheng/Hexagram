// 段落操作按钮的线性图标(T7,2026-10-01):原来是 ★ ✎ 🔗 🖼 四个字符,后两个是系统 emoji,
// iOS 上渲染成彩色贴纸,与墨色/纸色不协调,也与顶栏放大镜、齿轮(1.6 描边的线性 SVG)不是一套。
// 四枚统一成同一笔画粗细的线性图标;stroke 用 currentColor,随 .para-act / .para-act--on 的颜色走。
const base = {
  width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
}

export function StarIcon({ on }) {
  return (
    <svg {...base} style={on ? { fill: 'currentColor' } : undefined}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />
    </svg>
  )
}

export function PenIcon() {
  return (
    <svg {...base}>
      <path d="M4 20l4.2-1 10.3-10.3a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

export function LinkIcon() {
  return (
    <svg {...base}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  )
}

// 金句卡:一张卡片,卡上一枚小印
export function CardIcon() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 15.5h6" />
      <rect x="14.5" y="8" width="3" height="3" rx="0.5" style={{ fill: 'currentColor' }} stroke="none" />
    </svg>
  )
}
