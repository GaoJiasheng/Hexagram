// 头像种子的三种形态(2026-10-06 起可换头像;**不收上传**,头像永远是种子算出来的图):
//   'g:<token>'  生成式图案 —— 线条 + 基本几何,由 token 决定性地算出(本文件)
//   'm:<key>'    指定一枚流派印记(SchoolAvatar 的 MARKS)
//   其他(老账号注册时的 UUID)→ 按散列落到一枚流派印记,与换头像功能上线前一致
//
// 生成式图案守 SchoolAvatar 的两条:只用线条与基本几何、颜色只走 CSS 变量(明暗主题自动成立)。
// 头像最小 22px,所以每张图只放「一个结构 + 一层纹理 + 至多两个点」,不堆。

export const AVATAR_SEED_RE = /^(g:[a-z0-9]{6,24}|m:[a-z]{2,12})$/

// FNV-1a:与 SchoolAvatar 同一套散列
export function seedHash(seed) {
  let hash = 2166136261
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 各组主色 token(:root 定义且有暗色覆盖)
export const ART_ACCENTS = [
  'cinnabar-pure', 'azure', 'buddha', 'confucian', 'xinxue', 'legalist', 'mohist', 'military',
  'zongheng', 'zhongyi', 'moulue', 'tangshi', 'songci', 'guwen', 'mingli',
]

const C = 16          // 圆心
const R = 12          // 内圈(裁切半径)
const r2 = (n) => Math.round(n * 100) / 100

function polygon(cx, cy, radius, sides, rotDeg) {
  const pts = []
  for (let i = 0; i < sides; i += 1) {
    const a = ((rotDeg + (360 / sides) * i) * Math.PI) / 180
    pts.push(`${r2(cx + radius * Math.cos(a))} ${r2(cy + radius * Math.sin(a))}`)
  }
  return `M${pts.join('L')}Z`
}

function arc(cx, cy, radius, startDeg, sweepDeg) {
  const a0 = (startDeg * Math.PI) / 180
  const a1 = ((startDeg + sweepDeg) * Math.PI) / 180
  const x0 = r2(cx + radius * Math.cos(a0)); const y0 = r2(cy + radius * Math.sin(a0))
  const x1 = r2(cx + radius * Math.cos(a1)); const y1 = r2(cy + radius * Math.sin(a1))
  return `M${x0} ${y0}A${radius} ${radius} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

// 结构层:决定图案的「骨」
const STRUCTURES = [
  // 同心 / 偏心双圆
  (rnd) => {
    const big = 6 + Math.floor(rnd() * 3)
    const small = 2.5 + Math.floor(rnd() * 2)
    const off = rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1) * (big - small - 0.5)
    return { circles: [[C, C, big], [r2(C + off), C, small]] }
  },
  // 正多边形(三角 / 方 / 六边),转一个整 15° 角
  (rnd) => {
    const sides = [3, 4, 6][Math.floor(rnd() * 3)]
    return { paths: [polygon(C, C, 7 + Math.floor(rnd() * 2), sides, -90 + 15 * Math.floor(rnd() * 6))] }
  },
  // 圆弧:不闭合的一笔
  (rnd) => {
    const radius = 6 + Math.floor(rnd() * 3)
    return { paths: [arc(C, C, radius, 45 * Math.floor(rnd() * 8), 150 + 30 * Math.floor(rnd() * 5))] }
  },
  // 方中套圆 / 圆中套方
  (rnd) => {
    const s = 10 + Math.floor(rnd() * 3)
    return rnd() < 0.5
      ? { rects: [[r2(C - s / 2), r2(C - s / 2), s]], circles: [[C, C, r2(s / 2 - 2)]] }
      : { circles: [[C, C, r2(s / 2 + 1.5)]], paths: [polygon(C, C, r2(s / 2), 4, 45)] }
  },
  // 两道交错的弧(半月相叠)
  (rnd) => {
    const radius = 5.5 + Math.floor(rnd() * 2)
    const d = 2.5 + rnd() * 1.5
    return { circles: [[r2(C - d), C, radius], [r2(C + d), C, radius]] }
  },
]

// 纹理层:铺在结构底下、用次色,决定图案的「肌理」
const TEXTURES = [
  // 平行线:3–5 道,角度取整 15°,两端交给裁切
  (rnd) => {
    const n = 3 + Math.floor(rnd() * 2)
    const gap = 3 + Math.floor(rnd() * 2)
    const ang = (15 * Math.floor(rnd() * 12) * Math.PI) / 180
    const ux = Math.cos(ang); const uy = Math.sin(ang)       // 线方向
    const nx = -uy; const ny = ux                            // 法向
    const paths = []
    for (let i = 0; i < n; i += 1) {
      const k = (i - (n - 1) / 2) * gap
      const mx = C + nx * k; const my = C + ny * k
      paths.push(`M${r2(mx - ux * R)} ${r2(my - uy * R)}L${r2(mx + ux * R)} ${r2(my + uy * R)}`)
    }
    return { paths }
  },
  // 一道波
  (rnd) => {
    const y = 12 + Math.floor(rnd() * 9)
    const amp = 2.5 + rnd() * 2
    const flip = rnd() < 0.5 ? 1 : -1
    return { paths: [`M3 ${y}C8 ${r2(y - amp * flip)} 11 ${r2(y - amp * flip)} 16 ${y}S24 ${r2(y + amp * flip)} 29 ${y}`] }
  },
  // 过心的一纵一斜
  (rnd) => {
    const a = 15 * Math.floor(rnd() * 12)
    const b = a + 60 + 15 * Math.floor(rnd() * 3)
    return {
      paths: [a, b].map((deg) => {
        const t = (deg * Math.PI) / 180
        return `M${r2(C - Math.cos(t) * R)} ${r2(C - Math.sin(t) * R)}L${r2(C + Math.cos(t) * R)} ${r2(C + Math.sin(t) * R)}`
      }),
    }
  },
  // 外圈一道虚环
  () => ({ circles: [[C, C, 10.5]], dashed: true }),
  // 网点
  (rnd) => {
    const step = 4 + Math.floor(rnd() * 2)
    const dots = []
    for (let x = C - step * 2; x <= C + step * 2; x += step) {
      for (let y = C - step * 2; y <= C + step * 2; y += step) {
        if ((x - C) ** 2 + (y - C) ** 2 <= (R - 1) ** 2) dots.push([x, y, 0.75])
      }
    }
    return { dots }
  },
]

// 'g:xxx' → 可直接画的描述:{ accent, accent2, texture, structure, dots }
export function artForSeed(seed) {
  const rnd = mulberry32(seedHash(seed))
  const pick = (list) => list[Math.floor(rnd() * list.length)]
  const accent = pick(ART_ACCENTS)
  let accent2 = pick(ART_ACCENTS)
  if (accent2 === accent) accent2 = ART_ACCENTS[(ART_ACCENTS.indexOf(accent) + 5) % ART_ACCENTS.length]
  const texture = pick(TEXTURES)(rnd)
  const structure = pick(STRUCTURES)(rnd)
  const dots = []
  const nDots = Math.floor(rnd() * 3)
  for (let i = 0; i < nDots; i += 1) {
    const a = ((45 * Math.floor(rnd() * 8)) * Math.PI) / 180
    const d = [0, 4, 8][Math.floor(rnd() * 3)]
    dots.push([r2(C + Math.cos(a) * d), r2(C + Math.sin(a) * d), d === 0 ? 2.2 : 1.6])
  }
  return { accent, accent2, texture, structure, dots }
}

export function randomArtSeed() {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return `g:${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12)}`
}
