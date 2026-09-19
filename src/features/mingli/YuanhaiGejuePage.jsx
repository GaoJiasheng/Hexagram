import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { GAN, ganWuxing, zhiWuxing } from '../shared/ganzhi/index.js'
import { buildDeck, judge, shuffle } from './gejue.js'
import '../shared/widgets/widgets.css'
import './YuanhaiGejuePage.css'

// 《渊海子平》「又地支藏遁歌」歌诀卡(design-v23 一路)——把书里那首背藏干的歌诀
// 做成一张一张可以亲手答的卡。只练「记规则」,不涉及断语:见页面 shelf-disclaimer。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const CANG_LABEL = ['本气', '中气', '余气']

function revealText(result) {
  if (!result) return ''
  if (result.ok) return '全对。'
  const parts = []
  if (result.missed.length) parts.push(`漏了${result.missed.join('、')}`)
  if (result.wrong.length) parts.push(`多选了${result.wrong.join('、')}`)
  return `${parts.join(',')}。`
}

function summaryText(score, total) {
  if (total === 0) return ''
  if (score === total) return `这一轮 ${total} 张全部答对。`
  if (score === 0) return `这一轮 ${total} 张一张都没对上,这首歌诀还得再看几遍。`
  return `这一轮答对 ${score} / ${total} 张。`
}

export default function YuanhaiGejuePage() {
  usePageTitle('歌诀卡 · 渊海子平', '观数')

  // ── 原文:大文件,动态加载,别静态 import ───────────────────────
  const [load, setLoad] = useState({ status: 'loading', text: null })
  useEffect(() => {
    let alive = true
    import('../../data/mingli/classics/yuanhai.json')
      .then((mod) => {
        if (!alive) return
        const chapter = mod.default?.chapters?.find((c) => c.no === 3)
        const original = chapter?.paragraphs?.[0]?.original
        if (!original) { setLoad({ status: 'error', text: null }); return }
        setLoad({ status: 'ready', text: original })
      })
      .catch(() => { if (alive) setLoad({ status: 'error', text: null }) })
    return () => { alive = false }
  }, [])

  const deck = useMemo(() => (load.text ? buildDeck(load.text) : null), [load.text])

  // ── 一轮的状态:queue(本轮卡序)、pos(第几张)、picked(当前选的天干)、
  //    revealed(是否已对答案)、results(本轮逐张对错,走完一轮用来算小结与错题) ──
  const [seed, setSeed] = useState(1)
  const [queue, setQueue] = useState(null)
  const [pos, setPos] = useState(0)
  const [picked, setPicked] = useState(() => new Set())
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([])

  useEffect(() => {
    if (deck && !queue) setQueue(shuffle(deck, seed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck])

  const current = queue && pos < queue.length ? queue[pos] : null
  const finished = !!queue && pos >= queue.length
  const score = results.filter((r) => r.ok).length
  const mistakeDeck = useMemo(() => {
    if (!finished || !deck) return []
    const missZhi = new Set(results.filter((r) => !r.ok).map((r) => r.zhi))
    return deck.filter((c) => missZhi.has(c.zhi))
  }, [finished, deck, results])

  const revealResult = useMemo(
    () => (revealed && current ? judge(current.answer, [...picked]) : null),
    [revealed, current, picked],
  )

  function startRound(sourceDeck) {
    const next = seed + 1
    setSeed(next)
    setQueue(shuffle(sourceDeck, next))
    setPos(0)
    setPicked(new Set())
    setRevealed(false)
    setResults([])
  }

  function togglePick(g) {
    if (revealed) return
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  function reveal() {
    if (revealed || !current) return
    const r = judge(current.answer, [...picked])
    setRevealed(true)
    setResults((prev) => [...prev, { zhi: current.zhi, ok: r.ok }])
  }

  function goNext() {
    setPos((p) => p + 1)
    setPicked(new Set())
    setRevealed(false)
  }

  const ganStatus = (g) => {
    if (!current) return 'idle'
    const inAnswer = current.answer.includes(g)
    const isPicked = picked.has(g)
    if (!revealed) return isPicked ? 'picked' : 'idle'
    if (inAnswer && isPicked) return 'right'
    if (inAnswer && !isPicked) return 'missed'
    if (!inAnswer && isPicked) return 'wrong'
    return 'idle'
  }

  return (
    <div className="gjk-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/yuanhai" className="basics-breadcrumb__link">← 渊海子平</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">地支藏干,背这首歌诀</h1>
        <p className="page-subtitle">十二句歌诀,一句一支;往后看十神、定格局,第一步都是从这张表里查。</p>
      </div>

      <p className="qt-matrix-intro">
        《渊海子平》里有不少这样的歌诀——古人是拿来背的。这一首背的是:<strong>每个地支里,都藏着哪几个天干</strong>。
        「子宫癸水在其中」「寅宫甲木兼丙戊」……十二句正好对上子丑寅卯到戌亥十二支,读起来顺口,背熟了,
        往后查「某支里藏着谁」就不必再翻书。这张卡把歌诀拆成十二题,一次答一支,答完对一遍原句。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 歌诀只讲「藏了谁」:像「辰藏乙戊三分癸」这类措辞,各藏干各管几天(司令)历来诸书说法不一,
        这里不涉及、也不比较。这是一张记规则的卡,只管记住,不涉及任何判断。
      </div>

      {load.status === 'loading' && <div className="mingli-topic-loading" aria-busy="true" />}
      {load.status === 'error' && <p className="mingli-topic-placeholder">歌诀没能载入,刷新再试一次。</p>}

      {load.status === 'ready' && queue && !finished && current && (
        <div className="gjk-card">
          <p className="gjk-progress">第 {pos + 1} / {queue.length} 张 · 答对 {score}</p>

          <div className="gjk-face">
            <div className={`gjk-zhi sz-char--${WX_CLASS[zhiWuxing(current.zhi)]}`}>{current.zhi}</div>
            <p className="gjk-ask">它里面藏着哪几个天干?</p>
          </div>

          <div className="gjk-gans" role="group" aria-label="选出这个地支里藏着的天干">
            {GAN.map((g) => (
              <button
                key={g}
                type="button"
                className={`gjk-gan sz-char--${WX_CLASS[ganWuxing(g)]} is-${ganStatus(g)}`}
                aria-pressed={picked.has(g)}
                disabled={revealed}
                onClick={() => togglePick(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <p className="gjk-live" aria-live="polite">{revealed ? revealText(revealResult) : ''}</p>

          {revealed && (
            <div className="gjk-reveal">
              <ul className="gjk-cang">
                {current.answer.map((g, i) => (
                  <li key={g} className={`gjk-cang__item sz-char--${WX_CLASS[ganWuxing(g)]}`}>
                    <span className="gjk-cang__label">{CANG_LABEL[i]}</span>
                    <span className="gjk-cang__char">{g}</span>
                  </li>
                ))}
              </ul>
              <blockquote className="gjk-line">「{current.line}」</blockquote>
              <p className="gjk-cite">
                《渊海子平·又地支藏遁歌》 · <Link to="/mingli/yuanhai/3">读原文 →</Link>
              </p>
            </div>
          )}

          <div className="gjk-actions">
            {!revealed
              ? <button type="button" className="gjk-btn gjk-btn--primary" onClick={reveal}>对答案</button>
              : <button type="button" className="gjk-btn gjk-btn--primary" onClick={goNext}>下一张</button>}
          </div>
        </div>
      )}

      {load.status === 'ready' && finished && (
        <div className="gjk-summary">
          <p className="gjk-summary__text">{summaryText(score, queue.length)}</p>
          <div className="gjk-actions">
            <button type="button" className="gjk-btn gjk-btn--primary" onClick={() => startRound(deck)}>再来一轮</button>
            {mistakeDeck.length > 0 && (
              <button type="button" className="gjk-btn" onClick={() => startRound(mistakeDeck)}>只练答错的</button>
            )}
          </div>
        </div>
      )}

      <p className="qt-matrix-next">
        <Link to="/mingli/yuanhai/3">读《又地支藏遁歌》全文 →</Link>
      </p>
    </div>
  )
}
