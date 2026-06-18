import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import HexagramFigure from '../components/HexagramFigure.jsx'
import DailyDebate from '../../debates/DailyDebate.jsx'
import HexagramCard from '../components/HexagramCard.jsx'
import { getTodayHexagramId, getDateString } from '../engine/today.js'
import { getHexagram, formatDateChinese, CLASSICS_META } from '../data.js'
import { getRecentHexagrams, getDivinations, getReadingProgress } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const ENTRIES = [
  { title: '原文研读', to: '/hexagrams', desc: '六十四卦经文与彖象六爻', icon: '☰' },
  { title: '卦变推演', to: '/workbench', desc: '动爻变卦与断辞依据', icon: '☵' },
  { title: '经传通读', to: '/classics', desc: '系辞说卦序卦杂卦', icon: '☷' },
  { title: '八卦基础', to: '/basics', desc: '阴阳爻象与经卦取象', icon: '☶' },
  { title: '道藏研读', to: '/dao', desc: '道德经·南华·丹道诸经', icon: '☯' },
]

export default function HomePage() {
  usePageTitle(null)
  const today = getDateString()
  const todayId = getTodayHexagramId(today)
  const todayHex = getHexagram(todayId)
  const [recent, setRecent] = useState([])
  const [lastDiv, setLastDiv] = useState(null)
  const [lastRead, setLastRead] = useState(null)

  useEffect(() => {
    const r = getRecentHexagrams().slice(0, 3).map(getHexagram).filter(Boolean)
    setRecent(r)
    const divs = getDivinations()
    if (divs.length) setLastDiv(divs[0])
    const prog = getReadingProgress()
    const keys = Object.keys(prog)
    if (keys.length) {
      const book = keys[keys.length - 1]
      const meta = CLASSICS_META.find(m => m.key === book)
      if (meta) setLastRead({ book, chapter: prog[book], title: meta.title })
    }
  }, [])

  const hasHistory = recent.length > 0 || lastDiv || lastRead

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero">
        <h1 className="home-hero__title">观 象</h1>
        <p className="home-hero__quote">观其象而玩其辞，观其变而玩其占。</p>
        <div className="home-hero__actions">
          <Link to="/hexagrams" className="btn btn--primary">浏览六十四卦</Link>
          <Link to="/workbench" className="btn btn--secondary">开始推演</Link>
        </div>
      </section>

      {/* 今日一卦 */}
      {todayHex && (
        <section className="home-section">
          <Link to={`/hexagram/${todayHex.id}`} className="today-card" aria-label={`今日一卦：${todayHex.name}`}>
            <div className="today-card__badge">今日一卦 · {formatDateChinese(today)}</div>
            <div className="today-card__body">
              <HexagramFigure binary={todayHex.binary} size="md" label={todayHex.fullName} />
              <div className="today-card__info">
                <div className="today-card__name">
                  <span className="today-card__hanzi">{todayHex.name}</span>
                  <span className="today-card__full">{todayHex.fullName}</span>
                  <span className="today-card__no">第{todayHex.id}卦</span>
                </div>
                {todayHex.judgment?.original && (
                  <p className="today-card__text">「{todayHex.judgment.original.slice(todayHex.name.length + 1, 30)}…」</p>
                )}
                {todayHex.summary && (
                  <p className="today-card__summary">{todayHex.summary}</p>
                )}
              </div>
            </div>
          </Link>
          <div className="today-card__actions">
            <Link to={`/workbench?gua=${todayHex.id}`} className="today-card__action">以此卦推演 →</Link>
          </div>
        </section>
      )}

      {/* 继续研习 */}
      {hasHistory && (
        <section className="home-section">
          <h2 className="home-section__title">继续研习</h2>
          <div className="history-row">
            {lastDiv && (
              <Link to={`/workbench?gua=${lastDiv.gua}&dong=${lastDiv.dong?.join(',') || ''}`} className="history-chip">
                上次推演：{getHexagram(lastDiv.gua)?.name || ''}
                {lastDiv.dong?.length ? `之${getHexagram(lastDiv.bianGua)?.name || '变卦'}` : ''}
              </Link>
            )}
            {lastRead && (
              <Link to={`/classics/${lastRead.book}/${lastRead.chapter}`} className="history-chip">
                上次阅读：{lastRead.title}第{lastRead.chapter}章
              </Link>
            )}
            {recent.map(h => (
              <Link key={h.id} to={`/hexagram/${h.id}`} className="history-chip">
                最近浏览：{h.name}卦
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 四个入口 */}
      <section className="home-section">
        <div className="home-entries">
          {ENTRIES.map(e => (
            <Link key={e.to} to={e.to} className="home-entry">
              <span className="home-entry__icon">{e.icon}</span>
              <span className="home-entry__title">{e.title}</span>
              <span className="home-entry__desc">{e.desc}</span>
            </Link>
          ))}
        </div>
      </section>
      <DailyDebate />
    </div>
  )
}
