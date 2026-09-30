import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText } from '../reader/corpus.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import DATA from '../../data/zhongyi/suwen-zangxiang.json'
import './ZhongyiShapes.css'

// I2 · 《素问》五行藏象图(design-v24 §13)。《阴阳应象大论》有五段整齐的排比:
// 「东方生风,风生木,木生酸,酸生肝,肝生筋……在藏为肝,在色为苍,在音为角……在志为怒。怒伤肝,悲胜怒」——
// 五方各一段,句式全同。这一页把五段摊成一张表:横是木火土金水,竖是「在天 / 在味 / 在藏 / 在体 / 在窍 / 在志……」,
// 点一格看原文那一句、跳去读那一段;上方的五行图挂上五藏,看生克关系怎么落到藏上。
// 每格 kw 是该段原文精确字样,check-data 逐格回查(scripts/lib/check-zhongyi-shapes.mjs)。
// 呈现的是《素问》的**取象体系**,不是脏腑诊断——研习不诊疗。

const CH = DATA.source.ch
const paraHref = (para) => `/zhongyi/${DATA.source.slug}/${CH}#p${para + 1}`

export default function SuwenZangxiangPage() {
  usePageTitle('五行藏象图 · 素问', '观和')
  const [state, setState] = useState({ book: null, failed: false })
  useEffect(() => {
    let alive = true
    loadText('zhongyi', DATA.source.slug)
      .then((book) => alive && setState({ book, failed: !book }))
      .catch(() => alive && setState({ book: null, failed: true }))
    return () => { alive = false }
  }, [])

  const chapter = state.book?.chapters?.find((c) => c.no === CH) || null
  const zangRow = DATA.rows.find((r) => r.key === 'zang')
  const labels = Object.fromEntries(DATA.cols.map((c, i) => [c.wx, zangRow.cells[i]]))

  const wheel = useMemo(() => ({
    type: 'widget', kind: 'wuxing',
    props: { labels, mode: 'both' },
    caption: '五行各挂一藏(木—肝、火—心、土—脾、金—肺、水—肾)。点一个字,看它生谁、克谁;这是五行家的通行图式,《素问》把藏、味、色、志都往上挂。',
  }), [labels])

  const matrix = useMemo(() => {
    const cols = DATA.cols.map((c) => `${c.wx} · ${c.fang}`)
    const rows = DATA.rows.map((r) => r.label)
    const cells = {}
    DATA.rows.forEach((r) => {
      r.cells.forEach((v, i) => {
        const col = DATA.cols[i]
        cells[`${r.label}|${cols[i]}`] = {
          text: v,
          quote: r.kw[i],
          sub: `《${DATA.source.title}》第 ${col.para + 1} 段`,
          href: paraHref(col.para),
        }
      })
    })
    return {
      type: 'widget', kind: 'matrix',
      props: {
        rows, cols, cells,
        rowLabel: '《素问》挂在五行上的项', colLabel: '五行 · 五方',
        linkLabel: '读这一段原文 →',
        foot: '一格 = 原文一句「在某为某」。竖着看一列,是一方一行从天到人的整条链;横着看一行,是同一项在五行上怎么分。',
      },
    }
  }, [])

  return (
    <div className="zy-shape">
      <div className="basics-breadcrumb">
        <Link to={`/zhongyi/${DATA.source.slug}`} className="basics-breadcrumb__link">← 黄帝内经·素问</Link>
        <span className="zy-shape__crumb-sep" aria-hidden="true">·</span>
        <Link to="/zhongyi" className="basics-breadcrumb__link">中医典籍</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">五行藏象图</h1>
        <p className="page-subtitle">《阴阳应象大论》五段排比,摊开是一张五行乘十五项的表。</p>
      </div>

      <p className="zy-shape__intro">
        《素问·阴阳应象大论》里有五段句式完全一样的话:「东方生风,风生木,木生酸,酸生肝,肝生筋……在藏为肝,在色为苍,在音为角,在声为呼,
        在变动为握,在窍为目,在味为酸,在志为怒。怒伤肝,悲胜怒。」南方、中央、西方、北方各一段。
        这就是后世所谓「藏象」的骨架:把方位、气候、五味、五藏、形体、七窍、情志、颜色、五音都<strong>挂到五行上</strong>,
        于是「肝」不只是一个器官,而是木这一整条链的一环。<strong>点一格</strong>看原文那一句,再跳去读整段;
        竖着看是一条链,横着看是一项在五行上怎么分。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这张表呈现的是《素问》的<strong>取象体系</strong>——古人怎样把万物归到五行上——不是脏腑诊断,
        「怒伤肝」「悲胜怒」是原典之说,本站作医史文献研习,不构成任何医疗建议。
      </div>

      <WidgetBlock block={wheel} />
      <WidgetBlock block={matrix} />

      <section className="zy-shape__section">
        <h2 className="zy-shape__h2">五段原文</h2>
        {state.failed && <p className="mingli-topic-placeholder">原文没能载入,刷新再试一次。</p>}
        {!chapter && !state.failed && <div className="mingli-topic-loading" aria-busy="true" />}
        {chapter && (
          <ol className="zy-para">
            {DATA.cols.map((c) => (
              <li key={c.wx}>
                <span className="zy-para__wx">{c.wx}</span>
                <span className="zy-para__text">{chapter.paragraphs[c.para]?.original}</span>
                <Link to={paraHref(c.para)}>读这一段 →</Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="zy-shape__fanli">
        <b>凡例</b> 表中每一格都对应《阴阳应象大论》五段中的一句(「在藏为肝」「肝生筋」「怒伤肝」……),check-data 逐格回查原文,
        查不到即报错;五行图上的生克是五行家的通行图式,《素问》此篇只讲「胜」(悲胜怒、恐胜喜……),未用「克」字,
        故图式与原文并列、不混为一谈。「在音为征」的「征」是「徵」的简化。
      </p>
      <p className="zy-shape__next"><Link to={`/zhongyi/${DATA.source.slug}/${CH}`}>读《阴阳应象大论》全篇 →</Link></p>
    </div>
  )
}
