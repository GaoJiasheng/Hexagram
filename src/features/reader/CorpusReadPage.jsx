import { useParams, Link, useLocation, useNavigate, useSearchParams} from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { saveReadingProgress, getReadPos} from '../yijing/storage.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'
import BaihuaBlock from './BaihuaBlock.jsx'
import { chapterParts, chapterAnchors } from './chapterParts.js'
import { ditiansuiLayers, LAYER_MODES } from '../mingli/ditiansuiLayers.js'

// 命例成图只有观数组用得到:懒加载,别让读《论语》的人也下这一块
const ParaPillars = lazy(() => import('../mingli/ParaPillars.jsx'))

// 诗词曲格律层(design-v24 §7.3):唐诗近体(第 4–7 章 五律/七律/五绝/七绝)标平仄 + 韵脚,
// 古诗乐府(第 1–3 章)只标韵脚,均依《平水韵》;宋词韵脚依《词林正韵》,元曲依《中原音韵》。其余书 null(无开关)。
function prosodyFor(corpus, chapter) {
  if (corpus === 'tangshi') return { scheme: 'pingshui', tones: chapter >= 4 && chapter <= 7 }
  if (corpus === 'songci') return { scheme: 'cilin', tones: false }
  if (corpus === 'yuanqu') return { scheme: 'zhongyuan', tones: false }
  return null
}

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
  // 观数·滴天髓阐微的三层档位(纲领 / +原注 / 全部)。Hook 须在任何提前 return 之前。
  const [dtsMode, setDtsMode] = useState('all')
  const chapter = Number(chapterParam) || 1
  const meta = getMeta(corpus, slug)
  // 《韩非子》储说六篇(30–35 章)的经—说联动(design-v24 §1):件与对应表同在一个懒加载模块里,
  // 只有读韩非子时才下载,读别的书零开销。Hook 须在任何提前 return 之前。
  const isChushuoBook = corpus === 'fa' && slug === 'hanfeizi'
  const [chushuoMod, setChushuoMod] = useState(null)
  useEffect(() => {
    if (!isChushuoBook) return
    let live = true
    import('../fa/ChushuoLinks.jsx').then((m) => { if (live) setChushuoMod(m) }).catch(() => {})
    return () => { live = false }
  }, [isChushuoBook])
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

  // 储说经—说:本章若是储说六篇之一,cs = { chapter, byPara(经条段→条), byShuo(说组首段→条), anchors }
  const CS = isChushuoBook ? chushuoMod : null
  const cs = CS && curChapter ? CS.chushuoIndex(chapter) : null
  // 跳转目标可能在另一屏(长章拆页):连屏带锚拼链接。第 1 屏也显式带 ?p=1,
  // 否则无 ?p 时会按续读记位落回读者正在读的那一屏,锚点就找不到了。
  const chushuoHref = (i, id) => {
    const pi = partsCur ? partsCur.findIndex((pt) => i >= pt.from && i < pt.to) : -1
    return `${site.home}/${slug}/${chapter}${pi >= 0 ? `?p=${pi + 1}` : ''}#${id}`
  }
  // 拆屏链接一律显式带 ?p=(第 1 屏也带):无 ?p 时 resumePart 按续读记位选屏,
  // 读者在第 2 屏读过再点「← 第 1 部分」会被送回第 2 屏,侧栏章内锚点跳第 1 屏同理落空。
  // ClassicReader 只在章有拆屏时才调 partHref,不拆屏的章不受影响。
  const partHref = (no, p) => `${site.home}/${slug}/${no}?p=${p}`

  // 《穷通宝鉴》:原书自带的小节题行(「正月甲木:」「三春甲木总论」…,无译文的短段)排成小标题,别和正文一个样
  const isQiongtong = corpus === 'mingli' && slug === 'qiongtong'
  // 《滴天髓阐微》:纲领 / 原注 / 任氏阐发 三层混排,按段首标记自动分层(design-v23 §7)
  const dtsLayers = corpus === 'mingli' && slug === 'ditiansui' && curChapter ? ditiansuiLayers(curChapter.paragraphs) : null

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
      verse={!!meta.verse || !!meta.verseChapters?.includes(curChapter?.no)}
      bookTitle={meta.title}
      attribution={meta.attribution || ''}
      bookHref={`${site.home}/${slug}`}
      tocBack={<Link to={`${site.home}/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `${site.home}/${slug}/${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      renderBaihua={(no) => <BaihuaBlock corpus={corpus} slug={slug} chapter={no} bookTitle={meta.title} sectionUnit={meta.sectionUnit || '章'} />}
      paraClass={isQiongtong ? (no, p) => (!p.pillars && !p.translation && [...p.original].length <= 12 ? 'read-para--subhead' : '') : dtsLayers ? (no, p, i) => {
        const L = dtsLayers[i]
        const hidden = (dtsMode === 'gang' && L !== 'gang') || (dtsMode === 'zhu' && L === 'ren')
        return `dts dts--${L}${hidden ? ' dts--hidden' : ''}`
      } : undefined}
      hiddenHint={dtsLayers && dtsMode !== 'all' ? '这一屏全是任氏的阐发与命例，没有纲领句。切到「全部」即可看到。' : ''}
      toolbarExtra={dtsLayers ? (
        <div className="seg-control dts-modes" role="group" aria-label="显示层次">
          {LAYER_MODES.map((m) => (
            <button key={m.key} type="button" className={`seg-btn ${dtsMode === m.key ? 'seg-btn--active' : ''}`}
              aria-pressed={dtsMode === m.key} title={m.hint} onClick={() => setDtsMode(m.key)}>{m.label}</button>
          ))}
        </div>
      ) : null}
      renderParaExtra={corpus === 'mingli' ? (no, p) => <Suspense fallback={null}><ParaPillars paragraph={p} /></Suspense>
        : cs ? (no, p, i) => (cs.byPara[i] ? <CS.ChushuoTag ch={no} jing={cs.byPara[i]} hrefFor={chushuoHref} /> : null)
        : undefined}
      renderPoemHead={poemBook ? (no, i, p) => {
        const ord = poemOrdinals[i]
        if (!ord) return null
        const title = p.original.trim().replace(/^《|》$/g, '')
        return (
          <>
            <span className="poem-head__title">《{title}》<span className="poem-head__ord">其{ord}</span></span>
            <BaihuaBlock
              corpus={corpus} slug={slug} chapter={`${no}-${ord}`} variant="inline"
              bookTitle={meta.title} chapterLabel={[curChapter?.title, title].filter(Boolean).join(' · ')}
            />
          </>
        )
      } : undefined}
      renderPieceHead={cs ? (no, i) => {
        // 经部上方导语(第 0 段之前)+ 每个说组首段之前的条头
        if (i === 0) return <CS.ChushuoIntro idx={cs} hrefFor={chushuoHref} />
        const j = cs.byShuo[i]
        return j ? <CS.ChushuoHead ch={no} jing={j} jingText={curChapter.paragraphs[j.para].original} hrefFor={chushuoHref} /> : null
      } : meta.pieces ? (no, i) => {
        const pc = pieceHeads[i]
        if (!pc) return null
        return (
          <>
            <span className="piece-head__title">{pc.title}</span>
            <BaihuaBlock
              corpus={corpus} slug={slug} chapter={pc.key} variant="inline"
              bookTitle={meta.title} chapterLabel={[curChapter?.title, pc.title].filter(Boolean).join(' · ')}
            />
          </>
        )
      } : undefined}
      partsOf={(c) => chapterParts(c, meta)}
      anchorsOf={(c) => (cs && c.no === chapter ? cs.anchors : chapterAnchors(c, meta))}
      part={resumePart}
      partHref={partHref}
      paraLabel={poemBook ? poemParaLabel : (numberParas ? (no, i) => String(i + 1) : undefined)}
      posCtx={{ slug }}
      markCtx={{ corpus, slug }}
      commentCtx={{ corpus, slug }}
      prosody={prosodyFor(corpus, chapter)}
    />
  )
}
