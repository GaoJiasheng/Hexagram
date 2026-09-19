import { useMemo, useState } from 'react'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import { findPillars, isValidGanZhi } from '../shared/ganzhi/index.js'

// 命例成图(design-v23 §7)—— 观数阅读器里,凡段中出现四柱,就在段下挂一张四柱图。
// 古命书里命例成百上千,不会排盘的人看到的只是八个字,后面的分析完全跟不上;
// **这就是引擎在本站的正确位置:让人看懂书里的例子,不是让人算自己。**(同春秋筮例的卦例图)
//
// 两种来源:
//   ① 管线已结构化的「命例段」(《滴天髓阐微》竖排命例合并而成):段上带 pillars / dayun —— 默认展开
//   ② 行文内嵌的四柱(《穷通宝鉴》「若庚申、戊寅、甲寅、丙寅」、《子平真诠》诸例):findPillars 现找 —— 默认收起,
//      免得一段话被图打断;一段多例则逐个列出
export default function ParaPillars({ paragraph }) {
  const charts = useMemo(() => {
    if (Array.isArray(paragraph.pillars) && paragraph.pillars.length === 4 && paragraph.pillars.every(isValidGanZhi)) {
      return [{ pillars: paragraph.pillars, dayun: paragraph.dayun || [], structured: true }]
    }
    return findPillars(paragraph.original || '').map((h) => ({ pillars: h.pillars, dayun: [], structured: false }))
  }, [paragraph])
  const [open, setOpen] = useState(() => new Set(charts.map((c, i) => (c.structured ? i : -1)).filter((i) => i >= 0)))
  if (!charts.length) return null

  const toggle = (i) => setOpen((cur) => { const n = new Set(cur); if (n.has(i)) n.delete(i); else n.add(i); return n })

  return (
    <div className="para-pillars">
      {charts.map((c, i) => (
        <div key={i} className="para-pillars__item">
          <button type="button" className="para-pillars__toggle" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
            <span className="para-pillars__gz">{c.pillars.join(' ')}</span>
            <span className="para-pillars__hint">{open.has(i) ? '收起四柱图' : '看四柱图'}</span>
          </button>
          {open.has(i) && (
            <>
              <WidgetBlock block={{ type: 'widget', kind: 'sizhu', props: { pillars: c.pillars, show: ['shishen', 'canggan', 'count'] } }} />
              {c.dayun.length > 0 && (
                <p className="para-pillars__dayun"><span>大运(原书所列)</span>{c.dayun.join(' ')}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
