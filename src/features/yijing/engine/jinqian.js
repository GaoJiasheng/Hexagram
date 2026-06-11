// 金钱卦(六爻金钱起卦)引擎 — 纯函数,rng 注入(规则见 docs/yijing-design-v3.md §3.1)
// 三枚铜钱同掷为一次得一爻,六掷成卦,自下而上;背计 3、字计 2
// 爻值体系与大衍揲蓍一致:6 老阴(动) 7 少阳 8 少阴 9 老阳(动)

/** 掷三枚铜钱
 * @param {Function} rng () => [0,1)
 * @returns {number[]} 三枚结果,1=背 0=字
 */
export function tossCoins(rng) {
  return [rng() < 0.5 ? 1 : 0, rng() < 0.5 ? 1 : 0, rng() < 0.5 ? 1 : 0]
}

/** 背的枚数 → 爻值(背3字2:和=6+背数) */
export function valueFromBacks(backs) {
  return 6 + backs
}

/** 一掷得一爻
 * @returns {{ coins:number[], backs:number, value:6|7|8|9 }}
 */
export function tossLine(rng) {
  const coins = tossCoins(rng)
  const backs = coins[0] + coins[1] + coins[2]
  return { coins, backs, value: valueFromBacks(backs) }
}

/** 六掷成卦(自下而上,lines[0]=初爻)
 * @returns {{ lines:object[], values:number[], binary:string, movingLines:number[] }}
 */
export function tossHexagram(rng) {
  const lines = []
  for (let i = 0; i < 6; i++) lines.push(tossLine(rng))
  const values = lines.map(l => l.value)
  return { lines, values, ...linesToGua(values) }
}

/** 爻值数组 → binary + 动爻(录入模式直接用)
 * @param {number[]} values 六个 6/7/8/9,自下而上
 */
export function linesToGua(values) {
  const binary = values.map(v => (v === 7 || v === 9) ? '1' : '0').join('')
  const movingLines = values.map((v, i) => (v === 6 || v === 9) ? i + 1 : 0).filter(Boolean)
  return { binary, movingLines }
}

/** 爻值 → 组合与名称标签 */
export const COIN_LABELS = {
  6: '三字 · 老阴 ✕',
  7: '一背两字 · 少阳',
  8: '两背一字 · 少阴',
  9: '三背 · 老阳 ○',
}

/** 录入模式的四个选项(按爻值) */
export const COIN_CHOICES = [9, 8, 7, 6]
