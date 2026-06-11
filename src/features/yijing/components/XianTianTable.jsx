import { trigramById } from '../data.js'

// 先天卦数:乾1兑2离3震4巽5坎6艮7坤8(梅花取数依据)
const TRIGRAM_XIANTIAN = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun']

export default function XianTianTable({ highlight }) {
  return (
    <div className="xiantian-table" aria-label="先天卦数表">
      {TRIGRAM_XIANTIAN.map((id, i) => (
        <div key={id} className={`xiantian-cell ${highlight === i + 1 ? 'xiantian-cell--hl' : ''}`}>
          <span className="xiantian-cell__symbol">{trigramById[id].symbol}</span>
          <span className="xiantian-cell__name">{trigramById[id].name}</span>
          <span className="xiantian-cell__num">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}
