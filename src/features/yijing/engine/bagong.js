// 京房八宫体系 — 全算法生成，无需人工数据
// binary 约定：下标 0 = 初爻（自下而上），与项目全局约定一致

const TRIGRAM_BINARY = {
  qian: '111', dui: '110', li: '101', zhen: '100',
  xun: '011', kan: '010', gen: '001', kun: '000',
}

const BINARY_TO_TRIGRAM = Object.fromEntries(
  Object.entries(TRIGRAM_BINARY).map(([k, v]) => [v, k])
)

// 宫五行
export const PALACE_ELEMENT = {
  qian: '金', dui: '金', li: '火', zhen: '木',
  xun: '木', kan: '水', gen: '土', kun: '土',
}

// 宫名
export const PALACE_NAME = {
  qian: '乾宫', dui: '兑宫', li: '离宫', zhen: '震宫',
  xun: '巽宫', kan: '坎宫', gen: '艮宫', kun: '坤宫',
}

// 八宫排列顺序（京房）
const PALACE_ORDER = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun']

// 代别名称
const GENERATION_NAMES = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']

// 世爻位置（按代别索引 0-7）
const GENERATION_SHI = [6, 1, 2, 3, 4, 5, 4, 3]

// 应爻 = 世爻隔三: 1↔4, 2↔5, 3↔6
function yingFromShi(shi) {
  return shi <= 3 ? shi + 3 : shi - 3
}

function flipBit(b, idx) {
  const a = b.split('')
  a[idx] = a[idx] === '1' ? '0' : '1'
  return a.join('')
}

function generateSequence(trigram) {
  const palaceBinary = TRIGRAM_BINARY[trigram] + TRIGRAM_BINARY[trigram]
  const seq = [palaceBinary]
  let cur = palaceBinary

  // 一世到五世：在前一代基础上依次翻转 idx 0..4
  for (let i = 0; i < 5; i++) {
    cur = flipBit(cur, i)
    seq.push(cur)
  }

  // 游魂：在五世基础上翻回 idx 3
  cur = flipBit(cur, 3)
  seq.push(cur)

  // 归魂：游魂基础上将下卦三爻复原为本宫下卦
  const palaceLower = palaceBinary.slice(0, 3)
  cur = palaceLower + cur.slice(3)
  seq.push(cur)

  return seq
}

// 懒加载，仅构建一次
let _palaceMap = null

function buildPalaceMap() {
  const map = new Map()
  for (const trigram of PALACE_ORDER) {
    const seq = generateSequence(trigram)
    for (let i = 0; i < 8; i++) {
      const shi = GENERATION_SHI[i]
      map.set(seq[i], {
        palaceTrigram: trigram,
        palaceName: PALACE_NAME[trigram],
        element: PALACE_ELEMENT[trigram],
        generation: GENERATION_NAMES[i],
        generationIndex: i,
        shi,
        ying: yingFromShi(shi),
        sequence: seq,
      })
    }
  }
  return map
}

/**
 * 查询一个卦所属的宫信息。
 * @param {string} binary 六位 binary 字符串
 * @returns {{ palaceTrigram, palaceName, element, generation, generationIndex, shi, ying, sequence } | null}
 */
export function getPalace(binary) {
  if (!_palaceMap) _palaceMap = buildPalaceMap()
  return _palaceMap.get(binary) ?? null
}

/**
 * 返回八宫的有序数组，每宫含宫三角、名称、五行、8 卦 binary 序列。
 */
export function getAllPalaces() {
  if (!_palaceMap) _palaceMap = buildPalaceMap()
  return PALACE_ORDER.map(trigram => {
    const palaceBinary = TRIGRAM_BINARY[trigram] + TRIGRAM_BINARY[trigram]
    const info = _palaceMap.get(palaceBinary)
    return {
      trigram,
      name: PALACE_NAME[trigram],
      element: PALACE_ELEMENT[trigram],
      sequence: info.sequence,
    }
  })
}

export { BINARY_TO_TRIGRAM, TRIGRAM_BINARY, GENERATION_NAMES, GENERATION_SHI }
