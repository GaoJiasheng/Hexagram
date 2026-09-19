import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadText, getMeta } from '../reader/corpus.js'
import { gejuLens, tiaohouLens } from './lenses.js'

// 三派镜头(design-v23 §7 贯通件)。同一个八字,三本书从三个地方下手。
// 格局、调候两格**完全由规则层算出**(lenses.js),没有一个字的判断;第一格由调用方给:
// 命例走读里它就是任氏的走读本身,排盘台里它是指向《滴天髓》相关几章的路标。
// 三家结论未必一致——这里只摆各自的入手处,不替它们裁断。
export default function LensCards({ pillars, self }) {
  const [qt, setQt] = useState(null)
  useEffect(() => {
    let alive = true
    Promise.all([import('../../data/mingli/matrix/qiongtong.json'), loadText('mingli', 'qiongtong')])
      .then(([m, b]) => alive && setQt({ matrix: m.default, book: b }))
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const geju = useMemo(() => gejuLens(pillars), [pillars])
  const tiaohou = useMemo(() => (qt ? tiaohouLens(pillars, qt.matrix, qt.book, getMeta('mingli', 'qiongtong')) : null), [qt, pillars])

  return (
    <div className="dc-lens__grid">
      <div className="dc-lens__card dc-lens__card--self">{self}</div>
      <div className="dc-lens__card">
        <p className="dc-lens__tag">格局 · 《子平真诠》</p>
        <p className="dc-lens__main">{geju.geju.name}</p>
        <p className="dc-lens__body">
          先看月令:{geju.monthZhi}里藏{geju.cang.map((x) => `${x.gan}(${x.shishen})`).join('、')};
          {geju.tou.length ? `其中${geju.tou.join('、')}透干` : '都没有透干'} → 以{geju.main.gan}({geju.main.shishen})论。
        </p>
        <Link to={geju.flowHref}>在流程图里走一遍 →</Link>
        <Link to={geju.chapterHref}>读讲这一格的那一章 →</Link>
      </div>
      <div className="dc-lens__card">
        <p className="dc-lens__tag">调候 · 《穷通宝鉴》</p>
        {tiaohou ? (
          <>
            <p className="dc-lens__main">{tiaohou.dayGan}生{tiaohou.monthName}:{tiaohou.yong.join('、')}</p>
            <p className="dc-lens__body">先问寒暖燥湿:原书此月说「{tiaohou.quote}」。{tiaohou.unsure ? '(此格原书前后说法有出入,见调候矩阵。)' : ''}</p>
            <Link to={tiaohou.href}>读原文这一节 →</Link>
          </>
        ) : <p className="dc-lens__body">载入中…</p>}
      </div>
    </div>
  )
}
