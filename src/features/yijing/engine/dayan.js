// 大衍揲蓍引擎 — 纯函数，rng 注入（确定性/随机均可）
// 三变成一爻，六爻成一卦，自下而上

/**
 * 一变
 * @param {number}   total  本次可用蓍数
 * @param {Function} rng    () => [0,1) 随机数
 * @returns {{ left, right, gui:1, leftRem, rightRem, guiqi, remaining }}
 */
function oneChange(total, rng) {
  // 分二：左堆 1..total-1，右堆 total-left
  const left  = Math.floor(rng() * (total - 1)) + 1
  const right = total - left
  const gui   = 1                               // 挂一（从右堆取）
  const rightCount = right - gui
  const leftRem  = left % 4 === 0 ? 4 : left % 4
  const rightRem = rightCount % 4 === 0 ? 4 : rightCount % 4
  const guiqi    = leftRem + rightRem + gui
  return { left, right, gui, leftRem, rightRem, guiqi, remaining: total - guiqi }
}

/**
 * 三变得一爻
 * @param {Function} rng
 * @returns {{ value: 6|7|8|9, steps: object[] }}
 *   6=老阴  7=少阳  8=少阴  9=老阳
 */
export function castLine(rng) {
  const steps = []
  let total = 49
  for (let i = 0; i < 3; i++) {
    const step = oneChange(total, rng)
    steps.push({ change: i + 1, ...step })
    total = step.remaining
  }
  // 剩余 ÷ 4 → 爻值
  const value = total / 4   // 24→6, 28→7, 32→8, 36→9
  return { value, steps, remaining: total }
}

/**
 * 六爻成卦（自下而上）
 * @param {Function} rng
 * @returns {{ lines: number[], binary: string, movingLines: number[] }}
 *   lines[0] = 初爻值
 */
export function castHexagram(rng) {
  const lines = []
  for (let i = 0; i < 6; i++) {
    lines.push(castLine(rng).value)
  }
  // 老阴(6)/老阳(9) 为动爻；少阳(7)→阳，少阴(8)/老阴(6)→阴，老阳(9)→阳
  const toBit = v => (v === 7 || v === 9) ? '1' : '0'
  const binary = lines.map(toBit).join('')         // index 0 = 初爻
  const movingLines = lines.map((v, i) => v === 6 || v === 9 ? i + 1 : 0).filter(Boolean)
  return { lines, binary, movingLines }
}

/** 固定种子 rng（演示模式）—— 线性同余生成器，任何设备结果一致 */
export function makeSeededRng(seed = 42) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** crypto.getRandomValues rng（实占模式） */
export function cryptoRng() {
  const buf = new Uint32Array(1)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    buf[0] = Math.floor(Math.random() * 0x100000000)
  }
  return buf[0] / 0x100000000
}

/** 爻值 → 显示标签 */
export const LINE_LABELS = { 6: '—— ✕ 老阴', 7: '——— 少阳', 8: '— — 少阴', 9: '——— ○ 老阳' }
