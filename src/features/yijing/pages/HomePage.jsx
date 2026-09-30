import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import HexagramFigure from '../components/HexagramFigure.jsx'
import { getHexagram, allHexagrams, allTrigrams, CLASSICS_META } from '../data.js'
import { getRecentHexagrams, getDivinations, getReadingProgress, getProgress } from '../storage.js'
import { LEARN_TOPICS } from '../learnTopics.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import SchoolEntry from '../../reader/SchoolEntry.jsx'
import DaoduEntry from '../../reader/DaoduEntry.jsx'

// 易经首页(owner 2026-10-01 review):去掉「今日一卦」与道藏入口,把四个模块直接在首页展开——
// 六十四卦全列、六法起卦、五部经传、八经卦与学堂十二篇,读者在这一页就能看清这一站有什么;
// 再加上与各读经站同款的两层导读:一家之来路(易学的来路)+ 前世今生(《周易》这本书)。

// 六法(与 WorkbenchPage 的 METHODS 同键):三种「拼卦」+ 三种「起卦」
const METHODS = [
  { key: 'trigram', title: '上下卦', desc: '从八经卦拼出本卦', kind: '拼卦' },
  { key: 'line', title: '逐爻', desc: '六爻逐一点选阴阳', kind: '拼卦' },
  { key: 'search', title: '检索', desc: '按卦名或卦序直取', kind: '拼卦' },
  { key: 'meihua', title: '梅花', desc: '时间与数字起卦，体用断', kind: '起卦', learn: '/basics/meihua' },
  { key: 'dayan', title: '大衍', desc: '揲蓍三变成爻，六爻成卦', kind: '起卦', learn: '/basics/shicao' },
  { key: 'jinqian', title: '金钱', desc: '三枚铜钱六掷成卦', kind: '起卦', learn: '/basics/jinqian' },
]

// 六十四卦总览的四种看法(HexagramsPage ?view=)
const VIEWS = [
  ['matrix', '卦象矩阵'], ['sequence', '序卦次序'], ['bagong', '八宫'], ['fangyuan', '方圆图'],
]

function SectionHead({ title, note, to, more }) {
  return (
    <div className="home-block__head">
      <h2 className="home-block__title">{title}</h2>
      {note && <p className="home-block__note">{note}</p>}
      <Link to={to} className="home-block__more">{more} →</Link>
    </div>
  )
}

export default function HomePage() {
  usePageTitle(null)
  const [recent, setRecent] = useState([])
  const [lastDiv, setLastDiv] = useState(null)
  const [lastRead, setLastRead] = useState(null)
  const [readProg, setReadProg] = useState({})
  const [learnProg, setLearnProg] = useState(null)

  useEffect(() => {
    const r = getRecentHexagrams().slice(0, 3).map(getHexagram).filter(Boolean)
    setRecent(r)
    const divs = getDivinations()
    if (divs.length) setLastDiv(divs[0])
    const prog = getReadingProgress()
    setReadProg(prog)
    const keys = Object.keys(prog).filter((k) => CLASSICS_META.some((m) => m.key === k))
    if (keys.length) {
      const book = keys[keys.length - 1]
      const meta = CLASSICS_META.find(m => m.key === book)
      if (meta) setLastRead({ book, chapter: prog[book], title: meta.title })
    }
    setLearnProg(getProgress())
  }, [])

  const hasHistory = recent.length > 0 || lastDiv || lastRead
  const upper = allHexagrams.filter((h) => h.id <= 30)
  const lower = allHexagrams.filter((h) => h.id > 30)

  const renderHex = (h) => (
    <Link key={h.id} to={`/hexagram/${h.id}`} className="home-hexcell" aria-label={`第${h.id}卦 ${h.fullName}`}>
      <HexagramFigure binary={h.binary} size="sm" />
      <span className="home-hexcell__name">{h.name}</span>
      <span className="home-hexcell__no">{h.id}</span>
    </Link>
  )

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="home-hero">
        <h1 className="home-hero__title">观 象</h1>
        <p className="home-hero__quote">观其象而玩其辞，观其变而玩其占。</p>
        <div className="home-hero__actions">
          <Link to="/hexagrams" className="btn btn--primary">浏览六十四卦</Link>
          <Link to="/workbench" className="btn btn--secondary">开始推演</Link>
          {/* 全站搜索不在首页占位:顶栏已有放大镜图标,/ 或 ⌘K 亦可触发 */}
        </div>
      </section>

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

      {/* 两层导读:一家之来路(易学怎么长成一门学问)+ 前世今生(《周易》这本书) */}
      <section className="home-section home-guides">
        <SchoolEntry corpus="yijing" />
        <DaoduEntry corpus="yijing" slug="zhouyi" bookTitle="周易" />
      </section>

      {/* ① 原文研读:六十四卦全列 */}
      <section className="home-section home-block">
        <SectionHead
          title="原文研读"
          note="六十四卦，一卦一页：卦画、卦辞爻辞与译文、彖传大象小象、字词注疏、卦主与纳甲、筮例与史事回链、白话深读。"
          to="/hexagrams" more="六十四卦总览"
        />
        <h3 className="home-block__sub">上经 <span className="home-block__sub-note">乾至离 · 三十卦</span></h3>
        <div className="home-hexgrid">{upper.map(renderHex)}</div>
        <h3 className="home-block__sub">下经 <span className="home-block__sub-note">咸至未济 · 三十四卦</span></h3>
        <div className="home-hexgrid">{lower.map(renderHex)}</div>
        <div className="home-block__chips">
          <span className="home-block__chips-label">总览另有四种看法</span>
          {VIEWS.map(([v, label]) => (
            <Link key={v} to={v === 'matrix' ? '/hexagrams' : `/hexagrams?view=${v}`} className="history-chip">{label}</Link>
          ))}
        </div>
      </section>

      {/* ② 卦变推演:六法 */}
      <section className="home-section home-block">
        <SectionHead
          title="卦变推演"
          note="起卦 → 标动爻 → 读断法。工作台只释卦象、列断辞依据，不作吉凶断语；六种入口分「拼卦」与「起卦」两类。"
          to="/workbench" more="进入工作台"
        />
        <div className="home-methods">
          {METHODS.map((m) => (
            <Link key={m.key} to={`/workbench?method=${m.key}`} className="home-method">
              <span className="home-method__kind">{m.kind}</span>
              <span className="home-method__title">{m.title}</span>
              <span className="home-method__desc">{m.desc}</span>
              {m.learn && (
                <span className="home-method__learn">学堂有讲</span>
              )}
            </Link>
          ))}
        </div>
        <div className="home-block__chips">
          <Link to="/basics/tuiyan" className="history-chip">推演入门 · 先读这篇</Link>
          <Link to="/workbench?gua=1&dong=5" className="history-chip">示范：乾之大有（九五动）</Link>
          <Link to="/shili" className="history-chip">春秋筮例 · 二十一条</Link>
          <Link to="/me" className="history-chip">我的占例</Link>
        </div>
      </section>

      {/* ③ 经传通读:十翼 */}
      <section className="home-section home-block">
        <SectionHead
          title="经传通读"
          note="十翼之中，彖传、象传、文言随各卦附读；系辞、说卦、序卦、杂卦五部在此通读，每章带译文、锚定注疏与白话。"
          to="/classics" more="经传目录"
        />
        <div className="home-classics">
          {CLASSICS_META.map((b) => {
            const done = readProg[b.key] || 0
            return (
              <Link key={b.key} to={`/classics/${b.key}/${done || 1}`} className="home-classic">
                <span className="home-classic__title">{b.title}</span>
                <span className="home-classic__meta">{b.chapters} 章{done > 0 ? ` · 读至第 ${done} 章` : ''}</span>
                <span className="home-classic__desc">{b.desc}</span>
              </Link>
            )
          })}
          <Link to="/hexagram/1" className="home-classic home-classic--aside">
            <span className="home-classic__title">彖传 · 象传 · 文言</span>
            <span className="home-classic__meta">随卦附读</span>
            <span className="home-classic__desc">彖释卦辞、大象释卦象、小象释爻辞，附在各卦页原文之下；文言传独乾坤两卦有之。</span>
          </Link>
        </div>
      </section>

      {/* ④ 八卦基础:八经卦 + 学堂 */}
      <section className="home-section home-block">
        <SectionHead
          title="八卦基础"
          note="六十四卦由八经卦两两相重而成。先认八卦的象与德，再看爻位、消息与河洛，学堂十二篇按此排序。"
          to="/basics" more="学堂"
        />
        <div className="home-trigrams" role="table" aria-label="八经卦取象">
          {allTrigrams.map((t) => (
            <Link key={t.id} to="/basics/yinyang" className="home-trigram" role="row">
              <span className="home-trigram__symbol" aria-hidden="true">{t.symbol}</span>
              <span className="home-trigram__name">{t.name}</span>
              <span className="home-trigram__nature">{t.nature}</span>
              <span className="home-trigram__attr">{t.attribute} · {t.family}</span>
            </Link>
          ))}
        </div>
        <ol className="home-topics">
          {LEARN_TOPICS.map((t, i) => {
            const read = !!learnProg?.read?.[t.id]
            return (
              <li key={t.id}>
                <Link to={t.to} className={`home-topic${read ? ' home-topic--read' : ''}`}>
                  <span className="home-topic__no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="home-topic__title">{t.title}</span>
                  <span className="home-topic__time">{t.time}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
