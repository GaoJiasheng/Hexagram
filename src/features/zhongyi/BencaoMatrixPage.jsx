import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText } from '../reader/corpus.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import { BENCAO_BU, BENCAO_PIN, parseBencao } from './shapes.js'
import './ZhongyiShapes.css'

// I1 · 《神农本草经》六部 × 三品矩阵(design-v24 §13)——「书本来的形状,就是它的导航」。
// 这本书成书时就是一张表:玉石 / 草 / 木 / 果菜 / 米谷 / 虫兽 六部,各分上中下三品,十八类。
// 纸面只能一类一类线性排;这里把它还原成表,格里是该类所收药名(只列名,不述主治),点格下钻到那一类。
// 数据零策展:行列由十八类的题名派生,药名从各段段首切出(src/features/zhongyi/shapes.js),check-data 同一函数复核。

export default function BencaoMatrixPage() {
  usePageTitle('六部三品矩阵 · 神农本草经', '观和')
  const [state, setState] = useState({ book: null, failed: false })

  useEffect(() => {
    let alive = true
    loadText('zhongyi', 'bencaojing')
      .then((book) => alive && setState({ book, failed: !book }))
      .catch(() => alive && setState({ book: null, failed: true }))
    return () => { alive = false }
  }, [])

  const parsed = useMemo(() => (state.book ? parseBencao(state.book) : null), [state.book])
  const block = useMemo(() => {
    if (!parsed) return null
    const cells = {}
    for (const [key, c] of Object.entries(parsed.cells)) {
      cells[key] = {
        text: `${c.names.length} 味`,
        sub: c.title,
        note: c.names.join('、'),
        href: `/zhongyi/bencaojing/${c.ch}`,
      }
    }
    return {
      type: 'widget', kind: 'matrix',
      props: {
        rows: BENCAO_BU, cols: BENCAO_PIN, cells,
        rowLabel: '六部(药从哪里来)', colLabel: '三品(原书的分等)',
        linkLabel: '读这一类原文 →',
        foot: '一格 = 原书一类。点格看这一类收了哪些药——只列名,主治与用法请读原文,且原文只是古籍研习材料。',
      },
    }
  }, [parsed])

  return (
    <div className="zy-shape">
      <div className="basics-breadcrumb">
        <Link to="/zhongyi/bencaojing" className="basics-breadcrumb__link">← 神农本草经</Link>
        <span className="zy-shape__crumb-sep" aria-hidden="true">·</span>
        <Link to="/zhongyi" className="basics-breadcrumb__link">中医典籍</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">六部三品矩阵</h1>
        <p className="page-subtitle">《神农本草经》整本书,其实是一张六部乘三品的表。</p>
      </div>

      <p className="zy-shape__intro">
        通行本《本草经》把药分作玉石、草、木、果菜、米谷、虫兽<strong>六部</strong>,每部再分上、中、下<strong>三品</strong>,
        六乘三,十八类,一类一篇——站内的十八「类」就是这十八个格子。三品是原书对药的分等(上品「主养命」、中品「主养性」、下品「主治病」,
        序录之说,通行本正文不载,本站底本亦无序录),六部是药的来源。
        {parsed ? <>本站底本十八类共收 <strong>{parsed.total}</strong> 味(通行说法「三百六十五种,法三百六十五度」,各本出入)。</> : null}
        点一格,看这一类收了哪些药;再点进去读原文。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这张表只是原书的<strong>目录</strong>,格里只列药名。《本草经》的「主治」是两千年前的记载,本站作<strong>医史文献研习</strong>,
        不作用药参考、不构成任何医疗建议。
      </div>

      {state.failed && <p className="mingli-topic-placeholder">原文没能载入,刷新再试一次。</p>}
      {!block && !state.failed && <div className="mingli-topic-loading" aria-busy="true" />}
      {block && <WidgetBlock block={block} />}

      <p className="zy-shape__fanli">
        <b>凡例</b> 行列由站内十八类的题名派生,药名从每段段首(药名与全角空格之间)切出,不另手填;check-data 用同一函数复核,
        题名不合「某部某品」或某段切不出药名即报错。「三品」的养命 / 养性 / 治病之说出自《本草经》序录,通行本正文不载,此处只作说明。
      </p>
      <p className="zy-shape__next"><Link to="/zhongyi/bencaojing/1">从「玉石部上品」读起 →</Link></p>
    </div>
  )
}
