import { useId } from 'react'
import { artForSeed, seedHash } from './avatarArt.js'

// 用户头像:十一枚**流派印记** + 生成式线条几何图案(2026-10-06,种子形态见 avatarArt.js)。
//
// 取代原先的 PixelAvatar —— 那是 identicon 式的随机像素块,像二维码,与站点气质不搭。
// 这一组每枚对应站内一个组,用最少的线条取其意象,并各披本组主色
// (那些 accent token 在 :root 定义且有暗色覆盖,所以明暗两主题都自动成立)。
//
// 改这里要守两条:
// 1. **只用线条与基本几何**,不写字、不描实心块。头像最小 24px,笔画一多就糊成一团。
// 2. 颜色只走 CSS 变量,不写死 hex —— 否则暗色主题下会瞎。

const MARKS = [
  {
    key: 'yijing', accent: 'cinnabar-pure', label: '爻画',
    // 三爻自下而上:阳 — 阴 -- 阳
    paths: ['M9 11H23', 'M9 16H14', 'M18 16H23', 'M9 21H23'],
  },
  {
    key: 'dao', accent: 'azure', label: '抱一',
    // 圆中一道 S 曲:一分为二而不相离
    circles: [[16, 16, 7]],
    paths: ['M16 9a3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 0 0 7'],
  },
  {
    key: 'fo', accent: 'buddha', label: '圆相',
    // 禅宗圆相:一笔不闭合
    paths: ['M21.4 10.6A7 7 0 1 0 22.8 18.4'],
  },
  {
    key: 'ru', accent: 'confucian', label: '中',
    // 方正之中:一竖贯方
    rects: [[11, 11, 10, 10]],
    paths: ['M16 7.5V24.5'],
  },
  {
    key: 'xin', accent: 'xinxue', label: '月印',
    // 月印万川:大圆含一点
    circles: [[16, 16, 7.5]],
    dots: [[16, 16, 2.6]],
  },
  {
    key: 'fa', accent: 'legalist', label: '权衡',
    // 权衡:横杆 + 立柱 + 底座
    paths: ['M8 12.5H24', 'M16 12.5V21.5', 'M11.5 21.5H20.5'],
  },
  {
    key: 'mo', accent: 'mohist', label: '规',
    // 规:两脚交于一顶
    paths: ['M11 23L16 9.5L21 23'],
    dots: [[16, 9.5, 1.6]],
  },
  {
    key: 'bing', accent: 'military', label: '镞',
    // 箭镞
    paths: ['M16 8.5L22.5 21.5L16 18.5L9.5 21.5Z'],
  },
  {
    key: 'zong', accent: 'zongheng', label: '纵横',
    // 一纵一横一斜:合纵连横
    paths: ['M16 8V24', 'M8 16H24', 'M10.5 10.5L21.5 21.5'],
  },
  {
    key: 'zhongyi', accent: 'zhongyi', label: '脉',
    // 脉波
    paths: ['M8 17C11 9.5 13.5 9.5 16 16S21 23.5 24 15.5'],
  },
  {
    key: 'moulue', accent: 'moulue', label: '局',
    // 棋局一角 + 一子
    paths: ['M12 9.5V22.5', 'M20 9.5V22.5', 'M9.5 13H22.5', 'M9.5 20H22.5'],
    dots: [[20, 13, 2.2]],
  },
]

// 'm:<key>' 指定一枚;其余(老账号的 UUID)按 FNV-1a 散列分配——与原 PixelAvatar 同一套散列,
// 换头像功能上线前注册的人,头像一枚不变。
export function markForSeed(seed) {
  const key = typeof seed === 'string' && seed.startsWith('m:') ? seed.slice(2) : null
  return (key && MARKS.find((m) => m.key === key)) || MARKS[seedHash(seed) % MARKS.length]
}

export const AVATAR_MARKS = MARKS

export default function SchoolAvatar({ seed, size = 32 }) {
  if (typeof seed === 'string' && seed.startsWith('g:')) return <ArtAvatar seed={seed} size={size} />
  const mark = markForSeed(seed)
  const color = `var(--${mark.accent})`
  return (
    <svg
      className="school-avatar"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={`头像 · ${mark.label}`}
    >
      <circle cx="16" cy="16" r="15.2" style={{ fill: `color-mix(in srgb, ${color} 12%, var(--paper-raised))` }} />
      <circle cx="16" cy="16" r="15.2" fill="none" style={{ stroke: `color-mix(in srgb, ${color} 34%, transparent)` }} strokeWidth="1" />
      <g
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {(mark.paths || []).map((d) => <path key={d} d={d} />)}
        {(mark.circles || []).map(([cx, cy, r]) => <circle key={`c${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />)}
        {(mark.rects || []).map(([x, y, w, h]) => <rect key={`r${x}-${y}`} x={x} y={y} width={w} height={h} />)}
      </g>
      {(mark.dots || []).map(([cx, cy, r]) => (
        <circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r={r} style={{ fill: color }} />
      ))}
    </svg>
  )
}

// 生成式图案:纹理(次色、细)在下,结构(主色)在上,都裁进内圈;点为实心小圆。
function ArtAvatar({ seed, size }) {
  const clipId = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const art = artForSeed(seed)
  const color = `var(--${art.accent})`
  const color2 = `color-mix(in srgb, var(--${art.accent2}) 55%, transparent)`
  const { texture, structure } = art
  return (
    <svg className="school-avatar" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="头像 · 图案">
      <defs><clipPath id={clipId}><circle cx="16" cy="16" r="12.6" /></clipPath></defs>
      <circle cx="16" cy="16" r="15.2" style={{ fill: `color-mix(in srgb, ${color} 12%, var(--paper-raised))` }} />
      <circle cx="16" cy="16" r="15.2" fill="none" style={{ stroke: `color-mix(in srgb, ${color} 34%, transparent)` }} strokeWidth="1" />
      <g clipPath={`url(#${clipId})`}>
        <g fill="none" style={{ stroke: color2 }} strokeWidth="1.2" strokeLinecap="round" strokeDasharray={texture.dashed ? '1.6 2.4' : undefined}>
          {(texture.paths || []).map((d) => <path key={d} d={d} />)}
          {(texture.circles || []).map(([cx, cy, r]) => <circle key={`c${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />)}
        </g>
        {(texture.dots || []).map(([cx, cy, r]) => <circle key={`t${cx}-${cy}`} cx={cx} cy={cy} r={r} style={{ fill: color2 }} />)}
        <g fill="none" style={{ stroke: color }} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {(structure.paths || []).map((d) => <path key={d} d={d} />)}
          {(structure.circles || []).map(([cx, cy, r]) => <circle key={`c${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />)}
          {(structure.rects || []).map(([x, y, w]) => <rect key={`r${x}-${y}`} x={x} y={y} width={w} height={w} />)}
        </g>
        {art.dots.map(([cx, cy, r]) => <circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r={r} style={{ fill: color }} />)}
      </g>
    </svg>
  )
}
