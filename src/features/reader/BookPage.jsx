import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import EmptyState from '../yijing/components/EmptyState.jsx'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { getMeta, loadText } from './corpus.js'
import daoTexts from '../../data/dao/texts.json'
import { loadDaoText } from '../dao/data.js'
import { tocTitleOf } from './tocTitle.js'
import { getReadingProgress, getReadPos, getReadDays } from '../yijing/storage.js'
import DaoduEntry from './DaoduEntry.jsx'
import CorpusSinglePage from './CorpusSinglePage.jsx'
import DaoSinglePage from '../dao/pages/DaoSinglePage.jsx'
import BookArt from './BookArt.jsx'
import TocLens, { useLens } from './TocLens.jsx'
import VersionStrip from './VersionStrip.jsx'
import mingju from '../../data/mingju.json'
import renwuData from '../../data/renwu.json'
import timelineData from '../../data/timeline.json'

// 一本书的目录页(2026-10-07 目录页美化,docs/book-page-proposal.md):原 dao/pages/DaoTextPage 与 reader/CorpusTextPage(已删)
// 逻辑九成相同,合成这一个。题头右侧一幅「书之象」插图(texts.json `art`,单通道 PNG 当遮罩染主题色)、
// 一句「读法」(`howto`)、形状行(既有 `shape` + 名句 / 人物志 / 时间轴这几处本来散着的入口)、透镜(`lens`,点词点亮章格)、
// 目录按书自己的结构分段(`parts`)、章格带篇幅刻度与读过标记、段级续读(storage `readPos`)。
// 四个字段全是可选,没写的书页面与原来一样。易经不走这里。
// 道藏刻意不并入 corpus.js(它有自己的 data.js + 桥),这里按 corpus 选装载器,页面逻辑共用。
const metaOf = (corpus, slug) => (corpus === 'dao' ? daoTexts.find((t) => t.slug === slug) ?? null : getMeta(corpus, slug))
const loadOf = (corpus, slug) => (corpus === 'dao' ? loadDaoText(slug) : loadText(corpus, slug))
const SECTION_SKELETON_MAX = 24
// 观数三本书有一个同名旧字段 lens(字符串,「格局 / 旺衰 / 调候」三派镜头),不是透镜词表
const renwu = renwuData.people || []
const timeline = timelineData.items || []
const lensWords = (t) => (Array.isArray(t?.lens) ? t.lens : null)

// 版本流变数据按需取(只有 *-versions.json 入 glob,不会把全站数据都打进来)
const versionLoaders = import.meta.glob('../../data/*/*-versions.json')

function charsOf(c) { return c.paragraphs.reduce((n, p) => n + (p.original?.length || 0), 0) }

// 篇幅三档:按本书各章字数的三分位,短 / 中 / 长(是书内相对,不是全站绝对)
function tierMap(chapters) {
  const arr = chapters.map(charsOf).slice().sort((a, b) => a - b)
  if (arr.length < 3) return () => 2
  const q1 = arr[Math.floor(arr.length / 3)]
  const q2 = arr[Math.floor((arr.length * 2) / 3)]
  return (c) => { const n = charsOf(c); return n < q1 ? 1 : n < q2 ? 2 : 3 }
}

// 读过的章:研读统计的日聚合键 day|corpus|slug|ch|dev
function readChapters(corpus, slug) {
  const set = new Set()
  for (const k of Object.keys(getReadDays())) {
    const [, c, s, ch] = k.split('|')
    if (c === corpus && s === slug && ch) set.add(ch)
  }
  return set
}

function firstSentence(s) {
  if (!s) return ''
  const m = /^[^。！？；]{2,40}[。！？；]?/.exec(s)
  return (m ? m[0] : s.slice(0, 24)).trim()
}

export default function BookPage({ corpus }) {
  const site = SITE_MAP[corpus]
  const { slug } = useParams()
  const text = metaOf(corpus, slug)
  usePageTitle(text?.title, site?.brand)
  const [chapters, setChapters] = useState(null)
  const [lensActive, setLensActive] = useState([])
  const [versions, setVersions] = useState(null)

  const readable = !!text && !text.singlePage && text.status !== 'pending'
  useEffect(() => {
    let alive = true
    setLensActive([])
    if (readable) loadOf(corpus, slug).then((b) => { if (alive) setChapters(b?.chapters || null) })
    else setChapters(null)
    return () => { alive = false }
  }, [corpus, slug, readable])

  useEffect(() => {
    let alive = true
    setVersions(null)
    const name = text?.versions
    const loader = name && versionLoaders[`../../data/${corpus}/${name}.json`]
    if (loader) loader().then((m) => { if (alive) setVersions(m.default || m) })
    return () => { alive = false }
  }, [corpus, text?.versions])

  const words = lensWords(text)
  const { activeSet } = useLens(chapters || [], words || [], lensActive)
  const tierOf = useMemo(() => (chapters ? tierMap(chapters) : () => 2), [chapters])
  const read = useMemo(() => readChapters(corpus, slug), [corpus, slug])

  if (text?.singlePage && text.status !== 'pending') {
    return corpus === 'dao'
      ? <DaoSinglePage slug={slug} text={text} />
      : <CorpusSinglePage corpus={corpus} slug={slug} text={text} />
  }

  if (!text) {
    return (
      <div className="dao-text-page">
        <div className="basics-breadcrumb">
          <Link to={site.home} className="basics-breadcrumb__link">← {site.portalTitle}</Link>
        </div>
        <EmptyState icon="⊘" text="没有这部经典" />
      </div>
    )
  }

  const home = site.home
  const titled = chapters && chapters.length && chapters.some((c) => tocTitleOf(c, text))
  const loadingChapters = readable && chapters === null
  const resumeCh = (text.sections > 1 && getReadingProgress()[slug]) || 0
  const pos = text.sections > 1 ? getReadPos()[slug] : null
  const posChapter = pos && chapters ? chapters.find((c) => c.no === pos.ch) : null
  const posSnippet = posChapter ? firstSentence(posChapter.paragraphs[pos.seg]?.original) : ''

  // 形状行:既有 shape + 本书在名句集 / 人物志 / 时间轴里的落点(都是全站已有的页,只是以前互不知道)
  const mine = mingju.filter((m) => m.corpus === corpus && m.slug === slug)
  // 名句页按 label(「孙子·兵势」)过滤,书的短称取 label「·」前那一段,不用 title(「孙子兵法」对不上)
  const mingjuQ = mine.length ? mine[0].label.split('·')[0] : ''
  const people = renwu.filter((p) => Array.isArray(p.books) && p.books.includes(slug))
  const onTimeline = timeline.some((t) => t.corpus === corpus && t.slug === slug)
  const shapes = [
    text.shape && { href: text.shape.href, tag: '形状', label: text.shape.label, desc: text.shape.desc },
    mine.length > 0 && { href: `/mingju?group=${corpus}&q=${encodeURIComponent(mingjuQ)}`, tag: '名句', label: `${mine.length} 条` },
    ...people.map((p) => ({ href: `/renwu#${p.id}`, tag: '人物志', label: p.name })),
    onTimeline && { href: `/timeline#tl-${corpus}-${slug}`, tag: '时间轴', label: text.era },
  ].filter(Boolean)

  const cellClass = (c) => [
    'dao-section-cell', 'dao-section-cell--link',
    titled ? 'dao-section-cell--titled' : '',
    c.no === resumeCh ? 'dao-section-cell--current' : '',
    read.has(String(c.no)) ? 'dao-section-cell--read' : '',
    activeSet && !activeSet.has(c.no) ? 'dao-section-cell--dim' : '',
    chapters ? `dao-section-cell--t${tierOf(c)}` : '',
  ].filter(Boolean).join(' ')

  const renderCell = (c) => (
    <Link key={c.no} to={`${home}/${slug}/${c.no}`} className={cellClass(c)}>
      {titled ? (
        <>
          <span className="dao-section-cell__no">{c.no}</span>
          <span className="dao-section-cell__title">{tocTitleOf(c, text) || `第${c.no}${text.sectionUnit}`}</span>
        </>
      ) : (text.sections > 1 ? c.no : '全')}
      <span className="dao-section-cell__tick" aria-hidden="true" />
    </Link>
  )

  const list = chapters || Array.from({ length: text.sections }, (_, i) => ({ no: i + 1, paragraphs: [] }))
  const gridClass = `dao-section-grid ${titled ? 'dao-section-grid--titled' : ''}`
  const parts = Array.isArray(text.parts) && text.parts.length ? text.parts : null

  return (
    <div className="dao-text-page">
      <div className="basics-breadcrumb">
        <Link to={home} className="basics-breadcrumb__link">← {site.portalTitle}</Link>
      </div>

      <div className={`dao-text-header ${text.art ? 'book-head' : ''}`}>
        <div className="book-head__text">
          <h1 className="dao-text-title">{text.title}</h1>
          <p className="dao-text-meta">{[text.alias, text.era, text.attribution].filter(Boolean).join(' · ')}</p>
          <p className="dao-text-brief">{text.brief}</p>
          {text.howto && <p className="book-howto"><span className="book-howto__tag">读法</span>{text.howto}</p>}
          {text.dubious && <p className="dubious-badge">⚠ 托名·真伪存疑：学界多判为现代伪作。本站作文献批判材料研读，非处世权术教程。</p>}
          {text.caveat && !text.dubious && <p className="caveat-badge">⚠ {text.caveat}——详见撰人小传，本站作文献存疑研读。</p>}
        </div>
        {text.art && (
          <div className="book-head__art">
            <BookArt src={`/book-art/${corpus}/${text.art.file}`} alt={text.art.alt} size={200} />
          </div>
        )}
      </div>

      {/* 小传与导读:窄屏下最占地方,移动端用 order 排到目录之后(与原 CorpusTextPage 同) */}
      <div className="dao-text-aside">
        {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
        <DaoduEntry corpus={corpus} slug={text.slug} bookTitle={text.title} />
      </div>

      {/* 接着读:记到段的优先(readPos),只记到章的退回章 */}
      {pos && pos.ch > 0 ? (
        <Link to={`${home}/${slug}/${pos.ch}?seg=${pos.seg}`} className="dao-text-resume book-resume">
          <span className="book-resume__tag">接着读</span>
          第 {pos.ch} {text.sectionUnit}{pos.seg > 0 ? ` · 第 ${pos.seg + 1} 段` : ''}
          {posSnippet && <span className="book-resume__snippet">「{posSnippet}」</span>}
          <span aria-hidden="true"> →</span>
        </Link>
      ) : resumeCh > 0 && (
        <Link to={`${home}/${slug}/${resumeCh}`} className="dao-text-resume">
          继续读 · 第 {resumeCh} {text.sectionUnit} →
        </Link>
      )}

      {shapes.length > 0 && (
        <nav className="book-shapes" aria-label="这本书的形状">
          <span className="book-shapes__title">这本书的形状</span>
          {shapes.map((s) => (
            <Link key={s.href} to={s.href} className="book-shapes__item" title={s.desc || undefined}>
              <span className="book-shapes__tag">{s.tag}</span>
              <span className="book-shapes__label">{s.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {versions && <VersionStrip data={versions} />}

      <section className="dao-text-sections">
        <h2 className="dao-text-sections__title">{text.sectionUnit}目{chapters ? ` · ${chapters.length} ${text.sectionUnit}` : ''}</h2>

        {words && chapters && (
          <div className="book-lens">
            <span className="book-lens__title">透镜</span>
            <TocLens chapters={chapters} words={words} active={lensActive} onChange={setLensActive} />
          </div>
        )}

        {text.status === 'pending' ? (
          <>
            <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}，整理中`}>
              {Array.from({ length: text.sections }, (_, i) => (
                <span key={i} className="dao-section-cell" aria-disabled="true">{text.sections > 1 ? i + 1 : '全'}</span>
              ))}
            </div>
            <p className="text-faint dao-section-note">经文整理中——录入后此处即为{text.sectionUnit}节阅读入口。</p>
          </>
        ) : loadingChapters ? (
          <div className="dao-section-grid" aria-label="目录载入中" aria-busy="true">
            {Array.from({ length: Math.min(text.sections, SECTION_SKELETON_MAX) }, (_, i) => (
              <span key={i} className="dao-section-cell dao-section-cell--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : parts ? (
          parts.map((p) => {
            const cells = list.filter((c) => c.no >= p.from && c.no <= p.to)
            const lit = activeSet ? cells.filter((c) => activeSet.has(c.no)).length : null
            return (
              <div key={p.title} className="toc-part">
                <div className="toc-part__head">
                  <span className="toc-part__name">{p.title}</span>
                  <span className="toc-part__range">{p.from}–{p.to}{lit != null ? ` · 命中 ${lit}` : ''}</span>
                  {p.note && <span className="toc-part__note">{p.note}</span>}
                </div>
                <div className={gridClass} aria-label={`${p.title} ${p.from}–${p.to}`}>{cells.map(renderCell)}</div>
              </div>
            )
          })
        ) : (
          <div className={gridClass} aria-label={`共 ${text.sections} ${text.sectionUnit}`}>{list.map(renderCell)}</div>
        )}

        {chapters && (
          <p className="dao-section-note book-toc__legend text-faint">
            格右一道刻度表篇幅（短 / 中 / 长，按本书各章相对）；底色略深的是读过的章{activeSet ? '；灰掉的是未命中透镜的章' : ''}。
          </p>
        )}
        {text.status === 'partial' && <p className="text-faint dao-section-note">原文已录入，白话译注整理中。</p>}
      </section>
    </div>
  )
}
