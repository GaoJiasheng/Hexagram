import { useParams, Link, useLocation, useNavigate, useSearchParams} from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress, getReadPos} from '../yijing/storage.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'
import BaihuaBlock from './BaihuaBlock.jsx'
import { chapterParts, chapterAnchors } from './chapterParts.js'

// 通用逐章阅读器(v16 §1)——佛/儒共用,薄包装通用 ClassicReader 的 paged 模式。
export default function CorpusReadPage({ corpus }) {
  // 长章拆页(owner 2026-07-30):?p= 驱动,章号语义不变
  const [sp] = useSearchParams()
  const partParam = Number(sp.get('p')) || 0

  const site = SITE_MAP[corpus]
  const navigate = useNavigate()
  const { hash } = useLocation()
  const { slug, chapter: chapterParam } = useParams()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = getMeta(corpus, slug)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}${meta.sectionUnit || '章'}` : null, site?.brand)

  // 单页书被章路由深链命中(如 /fo/jingangjing/5):重定向到单页阅读器,保单一阅读形态
  useEffect(() => {
    if (!meta?.singlePage) return
    const p = hash.match(/^#p(\d+)$/)
    // 分享卡用统一的 /<corpus>/<slug>/<ch>#pN；单页经落回整书页时换成全书唯一旧锚。
    const targetHash = p ? `#seg-${chapter}-${Math.max(0, Number(p[1]) - 1)}` : hash
    navigate(`${site.home}/${slug}${targetHash}`, { replace: true })
  }, [meta, site, slug, chapter, hash, navigate])

  useEffect(() => {
    setLoading(true)
    loadText(corpus, slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [corpus, slug])

  useEffect(() => {
    window.scrollTo(0, 0)
    // 仅当章存在时记进度,避免越界章号(/x/slug/999)污染续读
    if (book && book.chapters.some((c) => c.no === chapter)) {
      saveReadingProgress(slug, chapter)
    }
  }, [slug, chapter, book])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典</p>
        <Link to={site.home} className="btn btn--secondary">返回{site.portalTitle}</Link>
      </div>
    )
  }

  const multi = book.chapters.length > 1
  const label = (c) => c.title ?? (multi ? `第${c.no}${meta.sectionUnit}` : '全文')
  // 段号:论语逐章语录素来编号;其余书的长章(>3 段,如伤寒论/坛经)默认编号,便于定位/引用
  const isLunyu = corpus === 'ru' && slug === 'lunyu'
  const curChapter = book.chapters.find((c) => c.no === chapter)
  const numberParas = isLunyu || (curChapter && curChapter.paragraphs.length > 3)

  // 一章多首的书(诗经:一组十余首诗,每首以《诗题》独立成段)。诗题升格为诗头,
  // 并按「组-序」挂诗级白话入口;段号跳过诗题,从诗句起编,引用才对得上。
  // 无显式 ?p= 时,按上次读到的段号自动落到对应那一屏(这才真正省掉「重新翻找」)
  const savedPos = getReadPos()[slug]
  const partsCur = curChapter ? chapterParts(curChapter, meta) : null
  const resumePart = partParam || (() => {
    if (!partsCur || !savedPos || savedPos.ch !== chapter) return 1
    const i = partsCur.findIndex((pt) => savedPos.seg >= pt.from && savedPos.seg < pt.to)
    return i >= 0 ? i + 1 : 1
  })()

  const poemBook = !!meta.poemTitles
  const isPoemTitle = (p) => /^《[^》]+》$/.test(p.original.trim())
  const poemOrdinals = {}   // 段下标 → 该诗在本组内的序号
  if (poemBook && curChapter) {
    let n = 0
    curChapter.paragraphs.forEach((p, i) => { if (isPoemTitle(p)) poemOrdinals[i] = ++n })
  }
  // 一章多条的书(传习录:一卷数百段,名条无标题可认)。区间由 texts.json 的 pieces 人工策展,
  // 在该条首段之前插条头 + 挂条级白话入口;段号照常从 1 编(不像诗经要跳过诗题段)。
  const pieceHeads = {}   // 段下标 → piece
  for (const pc of meta.pieces || []) { if (pc.ch === chapter) pieceHeads[pc.from] = pc }

  const poemParaLabel = (no, i) => {
    if (!curChapter) return null
    let n = 0
    for (let k = 0; k <= i; k++) { if (!isPoemTitle(curChapter.paragraphs[k])) n++ }
    return String(n)
  }

  return (
    <ClassicReader
      mode="paged"
      chapters={book.chapters}
      chapter={chapter}
      sectionUnit={meta.sectionUnit}
      verse={!!meta.verse}
      bookTitle={meta.title}
      tocBack={<Link to={`${site.home}/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `${site.home}/${slug}/${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      renderBaihua={(no) => <BaihuaBlock corpus={corpus} slug={slug} chapter={no} bookTitle={meta.title} sectionUnit={meta.sectionUnit || '章'} />}
      renderPoemHead={poemBook ? (no, i, p) => {
        const ord = poemOrdinals[i]
        if (!ord) return null
        const title = p.original.trim().replace(/^《|》$/g, '')
        return (
          <>
            <span className="poem-head__title">《{title}》<span className="poem-head__ord">其{ord}</span></span>
            <BaihuaBlock
              corpus={corpus} slug={slug} chapter={`${no}-${ord}`} variant="inline"
              bookTitle={meta.title} chapterLabel={`${curChapter?.title || ''} · ${title}`}
            />
          </>
        )
      } : undefined}
      renderPieceHead={meta.pieces ? (no, i) => {
        const pc = pieceHeads[i]
        if (!pc) return null
        return (
          <>
            <span className="piece-head__title">{pc.title}</span>
            <BaihuaBlock
              corpus={corpus} slug={slug} chapter={pc.key} variant="inline"
              bookTitle={meta.title} chapterLabel={`${curChapter?.title || ''} · ${pc.title}`}
            />
          </>
        )
      } : undefined}
      partsOf={(c) => chapterParts(c, meta)}
      anchorsOf={(c) => chapterAnchors(c, meta)}
      part={resumePart}
      partHref={(no, p) => `${site.home}/${slug}/${no}${p > 1 ? `?p=${p}` : ''}`}
      paraLabel={poemBook ? poemParaLabel : (numberParas ? (no, i) => String(i + 1) : undefined)}
      posCtx={{ slug }}
      markCtx={{ corpus, slug }}
      commentCtx={{ corpus, slug }}
    />
  )
}
