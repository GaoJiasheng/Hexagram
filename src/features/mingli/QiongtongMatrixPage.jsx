import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText, getMeta } from '../reader/corpus.js'
import { chapterParts } from '../reader/chapterParts.js'
import { GAN } from '../shared/ganzhi/index.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'

// 《穷通宝鉴》调候矩阵(design-v23 §7)——「书本来的形状,就是它的导航」。
// 这本书成书时就是一张 十干 × 十二月 的表:每格回答同一个问题——此干生于此月,先取什么、次取什么。
// 纸面只能线性排,于是被压成了十章长文。这一页把它还原回去:一屏看完全书骨架,点格下钻到原文。
//
// 数据 `src/data/mingli/matrix/qiongtong.json`:每格的取用之干都挂着原文子串(quote),
// check-data 校验逐字命中——**不凭记忆填**。

const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const chapterOfGan = (g) => GAN.indexOf(g) + 2   // 第 1 章是五行总论,甲木在第 2 章

export default function QiongtongMatrixPage() {
  usePageTitle('调候矩阵 · 穷通宝鉴', '观数')
  const [state, setState] = useState({ book: null, matrix: null, failed: false })

  useEffect(() => {
    let alive = true
    Promise.all([loadText('mingli', 'qiongtong'), import('../../data/mingli/matrix/qiongtong.json')])
      .then(([book, m]) => alive && setState({ book, matrix: m.default, failed: !book }))
      .catch(() => alive && setState({ book: null, matrix: null, failed: true }))
    return () => { alive = false }
  }, [])

  const meta = getMeta('mingli', 'qiongtong')
  const block = useMemo(() => {
    const { book, matrix } = state
    if (!book || !matrix) return null
    // 长章分屏由 ?p= 决定,段锚 #p 只在对的那一屏里存在:两者都得带
    const hrefOf = (gan, para) => {
      const no = chapterOfGan(gan)
      const ch = book.chapters.find((c) => c.no === no)
      const parts = ch ? chapterParts(ch, meta) : null
      const pi = parts ? parts.findIndex((pt) => para >= pt.from && para < pt.to) : -1
      return `/mingli/qiongtong/${no}${pi > 0 ? `?p=${pi + 1}` : ''}#p${para + 1}`
    }
    const cells = {}
    for (const c of matrix.cells) {
      cells[`${c.gan}|${c.month}`] = {
        text: c.yong.join(''),
        quote: c.quote,
        note: c.gist,
        sub: c.shared ? `原书与「${c.shared}」合论` : undefined,
        caveat: typeof c.unsure === 'string' ? c.unsure : undefined,
        href: hrefOf(c.gan, c.para),
      }
    }
    return {
      type: 'widget', kind: 'matrix',
      props: {
        rows: GAN, cols: MONTHS, cells, colorGan: true,
        rowLabel: '日主(十天干)', colLabel: '生在哪个月(以节气分月,正月 = 寅月)',
        foot: '一格 = 此干生于此月,原书先取什么、次取什么。右上带小点的格,是原书自己前后说法不一之处,点开有说明。',
      },
    }
  }, [state, meta])

  return (
    <div className="qt-matrix-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/qiongtong" className="basics-breadcrumb__link">← 穷通宝鉴</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">调候矩阵</h1>
        <p className="page-subtitle">《穷通宝鉴》整本书,其实是一张十干乘十二月的表。</p>
      </div>

      <p className="qt-matrix-intro">
        这本书只问一个问题:<strong>某个日主,生在某个月,是冷是热、是燥是湿——该先拿什么来调?</strong>
        十个天干各论十二个月,一共一百二十格。原书只能一章一章线性地写下去;这里把它还原成本来的形状。
        格里的字是原书为那个月指明的取用之干,按主次先后排;点开看原文怎么说,再跳去读那一节。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这张表是《穷通宝鉴》一家之说的<strong>目录</strong>,不是结论。同一个八字,《子平真诠》先看格局、《滴天髓》先看旺衰,
        取用未必与此相同;原书各月之下还有大量「若……则……」的分别,远不是两三个字装得下的。请点进去读原文。
      </div>

      {state.failed && <p className="mingli-topic-placeholder">矩阵没能载入,刷新再试一次。</p>}
      {!block && !state.failed && <div className="mingli-topic-loading" aria-busy="true" />}
      {block && <WidgetBlock block={block} />}

      <p className="qt-matrix-next">
        <Link to="/mingli/qiongtong/1">从「五行总论」读起 →</Link>
      </p>
    </div>
  )
}
