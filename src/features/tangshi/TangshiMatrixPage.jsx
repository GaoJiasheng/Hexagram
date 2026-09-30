import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText, getMeta } from '../reader/corpus.js'
import { chapterParts } from '../reader/chapterParts.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import DATA from '../../data/tangshi/tangshi-poets.json'
import './TangshiMatrixPage.css'

// 唐诗「体裁 × 诗人」矩阵(design-v24 §14)。《唐诗三百首》原书按七种体裁分卷,一诗一题;编者选谁的诗、选了几首,
// 摊成一张 诗人 × 体裁 的表就一目了然:杜甫三十九首、李白三十四、王维二十九……谁擅律、谁擅古、谁只入选一首。
// 诗人从维基文库各诗页的 author 字段派生(scripts/gen-tangshi-poets.mjs),不手填;check-data 回查每首落点是诗题段。
// 点一格看这位诗人这一体裁的篇目,跳去读第一首;下面按诗人列全部篇目。

const SLUG = DATA.book
const GROUPS = DATA.groups

export default function TangshiMatrixPage() {
  usePageTitle('体裁 × 诗人矩阵 · 唐诗三百首', '观韵')
  const [book, setBook] = useState(null)
  useEffect(() => {
    let alive = true
    loadText('tangshi', SLUG).then((b) => alive && setBook(b)).catch(() => {})
    return () => { alive = false }
  }, [])
  const meta = getMeta('tangshi', SLUG)
  const hrefOf = (ch, para) => {
    const c = book?.chapters?.find((x) => x.no === ch)
    const parts = c ? chapterParts(c, meta) : null
    const pi = parts ? parts.findIndex((pt) => para >= pt.from && para < pt.to) : -1
    return `/tangshi/${SLUG}/${ch}${pi > 0 ? `?p=${pi + 1}` : ''}#p${para + 1}`
  }

  const block = useMemo(() => {
    const cols = GROUPS.map((g) => g.title)
    const rows = DATA.poets.map((p) => p.name)
    const cells = {}
    for (const p of DATA.poets) {
      const byCh = new Map()
      for (const q of p.poems) { if (!byCh.has(q.ch)) byCh.set(q.ch, []); byCh.get(q.ch).push(q) }
      for (const [ch, list] of byCh) {
        const g = GROUPS.find((x) => x.ch === ch)
        cells[`${p.name}|${g.title}`] = {
          text: String(list.length),
          note: list.map((q) => `《${q.title}》`).join(''),
          sub: `${p.name} · ${g.title} · ${list.length} 首`,
          href: hrefOf(ch, list[0].para),
        }
      }
    }
    return {
      type: 'widget', kind: 'matrix',
      props: {
        rows, cols, cells,
        rowLabel: '诗人(按入选首数)', colLabel: '体裁(原书七卷)',
        linkLabel: '读这一体裁的第一首 →',
        foot: '一格 = 这位诗人在这一体裁下入选的首数。点格看篇目;横看一行是一人各体的分布,竖看一列是一体之下选了谁。',
      },
    }
    // hrefOf 依赖 book(为算长章分屏),book 到了重算一次即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book])

  const total = DATA.poets.reduce((n, p) => n + p.n, 0)
  const top = DATA.poets.slice(0, 3)

  return (
    <div className="ts-matrix">
      <div className="basics-breadcrumb">
        <Link to={`/tangshi/${SLUG}`} className="basics-breadcrumb__link">← 唐诗三百首</Link>
        <span className="ts-matrix__crumb-sep" aria-hidden="true">·</span>
        <Link to="/tangshi" className="basics-breadcrumb__link">唐诗</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">体裁 × 诗人矩阵</h1>
        <p className="page-subtitle">《唐诗三百首》{total} 首、{DATA.poets.length} 家,编者的取舍摊在一张表上。</p>
      </div>

      <p className="ts-matrix__intro">
        蘅塘退士编这部选本,按<strong>七种体裁</strong>分卷:五古、七古、乐府、五律、七律、五绝、七绝。谁入选、入选几首、偏在哪一体,
        原书只能一卷一卷读下去才看得出;摊成表,一眼就见:{top.map((p, i) => <span key={p.name}>{i ? '、' : ''}{p.name} {p.n} 首</span>)}——三家占了近三分之一;
        七十多家只入选一首。<strong>点一格</strong>看篇目并跳去读;竖看一列,是某一体裁下编者选了谁;横看一行,是一位诗人各体的分布。
      </p>

      <WidgetBlock block={block} />

      <section className="ts-matrix__section">
        <h2 className="ts-matrix__h2">按诗人</h2>
        <div className="ts-poets">
          {DATA.poets.map((p) => (
            <details key={p.name} className="ts-poet">
              <summary><b>{p.name}</b><span>{p.n} 首</span></summary>
              <ul>
                {p.poems.map((q) => (
                  <li key={`${q.ch}-${q.para}`}>
                    <Link to={hrefOf(q.ch, q.para)}>《{q.title}》</Link>
                    <small>{GROUPS.find((g) => g.ch === q.ch)?.title}</small>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <p className="ts-matrix__fanli">
        <b>凡例</b> 诗人取自维基文库各诗页题署的作者,由脚本与站内诗题逐首对齐,不另手填;check-data 回查每首落点。
        原书题署偶有与今人考订不同者(如托名之作),这里照录底本题署,不作考辨。首数按站内底本计,与通行「三百一十首」诸说微有出入。
      </p>
      <p className="ts-matrix__next"><Link to={`/tangshi/${SLUG}/1`}>从「五言古诗」读起 →</Link></p>
    </div>
  )
}
