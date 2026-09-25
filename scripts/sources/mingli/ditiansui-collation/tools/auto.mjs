// 自动初判(供人工复核后覆盖):类型、档次、建议改字
import fs from 'fs'
export const S = JSON.parse(fs.readFileSync(new URL('./sites.json', import.meta.url), 'utf8'))

// 已由 mingli.config.mjs 的 DITIANSUI_TYPOS 改过的(本站=改后,见证本=改前)
const EXISTING = [['庇', '疪'], ['仕', '仁'], ['暖', '瞹'], ['羊', '刽'], ['贴', '铁'], ['云', '去'], ['元', '地'], ['元', '无'], ['登', '癸']]
const VARIANT = [['淫', '婬']]

export function auto(x) {
  const qd = x.q !== '=', gd = x.g !== '='
  const srcs = [...new Set(x.notes.map((n) => n.split(':')[0]))]
  if (!qd && !gd) {
    // 见证本与本站同
    const scan = srcs.includes('scan')
    return { type: '见证本亦同', grade: scan ? 'B' : 'C', to: null, single: false }
  }
  const pick = qd && !x.q.startsWith('≈') ? x.q : (gd && !x.g.startsWith('≈') ? x.g : null)
  if (pick == null) return { type: '结构异', grade: 'C', to: null }
  const b = x.bText, w = pick
  if (EXISTING.some(([o, n]) => b === o && w === n)) return { type: '本站已改', grade: '-', to: null }
  if (VARIANT.some(([o, n]) => b === o && w === n)) return { type: '异体', grade: '-', to: null }
  const type = b && w ? '形近讹' : b ? '衍文' : '脱文'
  const single = !(qd && gd && x.q === x.g)
  const len = Math.max([...b].length, [...w].length)
  if (len > 3) return { type: type === '形近讹' ? '异文(长)' : type + '(长)', grade: 'C', to: w, single }
  const ev = x.evWit && (x.evWit.tri >= 1 || x.evWit.l >= 1 || x.evWit.r >= 1)
  const dit = type === '衍文' && (x.ctx.includes(b + b) || x.ctx.replace(/[〔〕]/g, '').includes(b + b))
  return { type, grade: (ev || dit) && x.evBase.tri <= 0 ? 'A' : 'B', to: w, single }
}
