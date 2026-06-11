// 六十四卦基准表:八经卦属性 + 8×8 上下卦组合 → 卦序/卦名。
// 这是数据管线与校验脚本的共同事实来源;binary 一律自下而上(下标 0 = 初爻)。

export const TRIGRAMS = {
  qian: { name: '乾', symbol: '☰', binary: '111', nature: '天', attribute: '健', family: '父', body: '首', animal: '马', directionHoutian: '西北', directionXiantian: '南' },
  dui:  { name: '兑', symbol: '☱', binary: '110', nature: '泽', attribute: '悦', family: '少女', body: '口', animal: '羊', directionHoutian: '西', directionXiantian: '东南' },
  li:   { name: '离', symbol: '☲', binary: '101', nature: '火', attribute: '丽', family: '中女', body: '目', animal: '雉', directionHoutian: '南', directionXiantian: '东' },
  zhen: { name: '震', symbol: '☳', binary: '100', nature: '雷', attribute: '动', family: '长男', body: '足', animal: '龙', directionHoutian: '东', directionXiantian: '东北' },
  xun:  { name: '巽', symbol: '☴', binary: '011', nature: '风', attribute: '入', family: '长女', body: '股', animal: '鸡', directionHoutian: '东南', directionXiantian: '西南' },
  kan:  { name: '坎', symbol: '☵', binary: '010', nature: '水', attribute: '陷', family: '中男', body: '耳', animal: '豕', directionHoutian: '北', directionXiantian: '西' },
  gen:  { name: '艮', symbol: '☶', binary: '001', nature: '山', attribute: '止', family: '少男', body: '手', animal: '狗', directionHoutian: '东北', directionXiantian: '西北' },
  kun:  { name: '坤', symbol: '☷', binary: '000', nature: '地', attribute: '顺', family: '母', body: '腹', animal: '牛', directionHoutian: '西南', directionXiantian: '北' },
}

// TABLE[上卦][下卦] = [卦序, 卦名]
export const TABLE = {
  qian: { qian: [1, '乾'], dui: [10, '履'], li: [13, '同人'], zhen: [25, '无妄'], xun: [44, '姤'], kan: [6, '讼'], gen: [33, '遁'], kun: [12, '否'] },
  dui:  { qian: [43, '夬'], dui: [58, '兑'], li: [49, '革'], zhen: [17, '随'], xun: [28, '大过'], kan: [47, '困'], gen: [31, '咸'], kun: [45, '萃'] },
  li:   { qian: [14, '大有'], dui: [38, '睽'], li: [30, '离'], zhen: [21, '噬嗑'], xun: [50, '鼎'], kan: [64, '未济'], gen: [56, '旅'], kun: [35, '晋'] },
  zhen: { qian: [34, '大壮'], dui: [54, '归妹'], li: [55, '丰'], zhen: [51, '震'], xun: [32, '恒'], kan: [40, '解'], gen: [62, '小过'], kun: [16, '豫'] },
  xun:  { qian: [9, '小畜'], dui: [61, '中孚'], li: [37, '家人'], zhen: [42, '益'], xun: [57, '巽'], kan: [59, '涣'], gen: [53, '渐'], kun: [20, '观'] },
  kan:  { qian: [5, '需'], dui: [60, '节'], li: [63, '既济'], zhen: [3, '屯'], xun: [48, '井'], kan: [29, '坎'], gen: [39, '蹇'], kun: [8, '比'] },
  gen:  { qian: [26, '大畜'], dui: [41, '损'], li: [22, '贲'], zhen: [27, '颐'], xun: [18, '蛊'], kan: [4, '蒙'], gen: [52, '艮'], kun: [23, '剥'] },
  kun:  { qian: [11, '泰'], dui: [19, '临'], li: [36, '明夷'], zhen: [24, '复'], xun: [46, '升'], kan: [7, '师'], gen: [15, '谦'], kun: [2, '坤'] },
}

// 纯卦的全名用「X为Y」,其余为 上卦自然象 + 下卦自然象 + 卦名
const PURE_FULLNAME = { 乾: '乾为天', 坤: '坤为地', 震: '震为雷', 巽: '巽为风', 坎: '坎为水', 离: '离为火', 艮: '艮为山', 兑: '兑为泽' }

export function buildHexagramIndex() {
  const list = []
  for (const [upper, row] of Object.entries(TABLE)) {
    for (const [lower, [id, name]] of Object.entries(row)) {
      const binary = TRIGRAMS[lower].binary + TRIGRAMS[upper].binary
      const fullName = PURE_FULLNAME[name] ?? TRIGRAMS[upper].nature + TRIGRAMS[lower].nature + name
      list.push({ id, name, fullName, upperTrigram: upper, lowerTrigram: lower, binary })
    }
  }
  list.sort((a, b) => a.id - b.id)
  return list
}

// 繁体经卦单字 → key(维基文库「X下Y上」行用)
export const TRAD_TRIGRAM_CHAR = { 乾: 'qian', 兌: 'dui', 離: 'li', 震: 'zhen', 巽: 'xun', 坎: 'kan', 艮: 'gen', 坤: 'kun' }

// 爻位 n(1–6)+ 阴阳 → 爻题
export function lineTitle(pos, isYang) {
  const num = isYang ? '九' : '六'
  if (pos === 1) return '初' + num
  if (pos === 6) return '上' + num
  return num + ['', '', '二', '三', '四', '五'][pos]
}
