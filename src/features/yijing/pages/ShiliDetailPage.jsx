import { useParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import HexagramFigure from '../components/HexagramFigure.jsx'
import ClassicText from '../components/ClassicText.jsx'
import shili from '../../../data/yijing/shili.json'
import { getHexagram } from '../data.js'

// 本卦→之卦的动爻:binary 异或(下标 0 = 初爻,全项目约定)
function movingLines(benBinary, zhiBinary) {
  if (!zhiBinary) return []
  const lines = []
  for (let i = 0; i < 6; i++) if (benBinary[i] !== zhiBinary[i]) lines.push(i + 1)
  return lines
}

function CastFigure({ cast }) {
  const ben = getHexagram(cast.ben)
  const zhi = cast.zhi ? getHexagram(cast.zhi) : null
  const moving = zhi ? movingLines(ben.binary, zhi.binary) : []
  return (
    <div className="shili-cast">
      <span className="shili-cast__label">{cast.label}</span>
      <div className="shili-cast__figures">
        <Link to={`/hexagram/${ben.id}`} className="shili-cast__hex">
          <HexagramFigure binary={ben.binary} size="md" movingLines={moving} label={`${ben.fullName}卦画`} />
          <span className="shili-cast__name">{ben.name}</span>
        </Link>
        {zhi && (
          <>
            <span className="shili-cast__arrow">→</span>
            <Link to={`/hexagram/${zhi.id}`} className="shili-cast__hex">
              <HexagramFigure binary={zhi.binary} size="md" label={`${zhi.fullName}卦画`} />
              <span className="shili-cast__name">{zhi.name}</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// 筮例详情(v9 §2):背景 / 原文译文 / 卦例图 / 解读
export default function ShiliDetailPage() {
  const { id } = useParams()
  const idx = shili.findIndex((s) => s.id === id)
  const item = shili[idx]

  useEffect(() => { window.scrollTo(0, 0) }, [id])

  if (!item) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这条筮例: {id}</p>
        <Link to="/shili" className="btn btn--secondary">返回筮例</Link>
      </div>
    )
  }
  const prev = shili[idx - 1]
  const next = shili[idx + 1]

  return (
    <div className="shili-page shili-detail">
      <div className="basics-breadcrumb">
        <Link to="/shili" className="basics-breadcrumb__link">← 春秋筮例</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">{item.title}</h1>
        <p className="page-subtitle">
          {item.source} · {item.kind === 'shi' ? '筮占' : '引易'}
        </p>
      </div>

      {item.background && (
        <section className="detail-section">
          <h2 className="detail-section__title">背景</h2>
          <p className="shili-background">{item.background}</p>
        </section>
      )}

      <section className="detail-section">
        <h2 className="detail-section__title">原文</h2>
        {item.paragraphs.map((p, i) => (
          <ClassicText key={i} original={p.original} translation={p.translation} />
        ))}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">卦例</h2>
        <div className="shili-casts">
          {item.casts.map((c, i) => <CastFigure key={i} cast={c} />)}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">解读</h2>
        {item.reading?.length
          ? item.reading.map((p, i) => <p key={i} className="shili-reading">{p}</p>)
          : <p className="text-faint">解读整理中。</p>}
      </section>

      <div className="detail-nav">
        {prev ? (
          <Link to={`/shili/${prev.id}`} className="detail-nav__prev">← {prev.title}</Link>
        ) : <span />}
        {next && (
          <Link to={`/shili/${next.id}`} className="detail-nav__next">{next.title} →</Link>
        )}
      </div>
    </div>
  )
}
