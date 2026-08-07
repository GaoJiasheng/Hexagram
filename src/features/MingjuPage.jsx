import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { bookBySlug, chapterHref } from './reader/booksIndex.js'
import ITEMS from '../data/mingju.json'

// 名句集(§四)。**一句不是新写的** —— 全部取自站内已逐字校验的引文
// (争鸣各家立论所引 + 概念聚类代表章),生成见 scripts/build-mingju.mjs。
// 每条都点得回原文那一章:这是本站一贯的分寸,不给无出处的句子。

const GROUPS = [
  ['ru', '儒'], ['dao', '道'], ['fo', '释'], ['xin', '心学'],
  ['fa', '法'], ['mo', '墨'], ['bing', '兵'], ['zong', '纵横'], ['yijing', '易'],
  ['zhongyi', '医'], ['moulue', '谋略'], ['tangshi', '唐诗'], ['songci', '宋词'], ['yuanqu', '元曲'],
]

// 今日一句:与「今日一卦 / 每日一辩」同一套确定性做法(日期 hash),同一天刷新不变。
function pickDaily(list, date = new Date()) {
  const k = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

function hrefOf(e) {
  const book = bookBySlug(e.slug)
  if (!book) return null
  const base = chapterHref(book, e.ch)
  // 唐诗一卷几十首、长短经一卷数篇:带段锚的条目直落那一首(part 是长章拆屏后的屏号)
  if (!e.hash) return base
  return `${base}${e.part ? `?p=${e.part}` : ''}#${e.hash}`
}

function Card({ e, big = false }) {
  const to = hrefOf(e)
  const body = (
    <>
      <p className={big ? 'mingju-card__q mingju-card__q--big' : 'mingju-card__q'}>{e.q}</p>
      <p className="mingju-card__src">
        {e.label}
        {e.cited > 1 && <span className="mingju-card__cited">· {e.cited} 辩引用</span>}
      </p>
    </>
  )
  return to
    ? <Link to={to} className={`mingju-card ${big ? 'mingju-card--big' : ''}`}>{body}</Link>
    : <div className={`mingju-card ${big ? 'mingju-card--big' : ''}`}>{body}</div>
}

export default function MingjuPage() {
  usePageTitle('名句集')
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')

  const daily = useMemo(() => pickDaily(ITEMS), [])
  const counts = useMemo(() => {
    const m = {}
    for (const e of ITEMS) m[e.corpus] = (m[e.corpus] || 0) + 1
    return m
  }, [])
  const list = useMemo(() => {
    const kw = q.trim()
    return ITEMS.filter((e) => (!group || e.corpus === group) && (!kw || e.q.includes(kw) || e.label.includes(kw)))
  }, [group, q])

  return (
    <div className="mingju-page">
      <header className="mingju-head">
        <h1 className="mingju-title">名句集</h1>
        <p className="mingju-sub">
          {ITEMS.length} 句。<strong>一句不是新写的</strong>——全部出自站内典籍,每条都经逐字校验、点得回原文那一章。
        </p>
      </header>

      <section className="mingju-daily">
        <span className="mingju-daily__badge">今日一句</span>
        <Card e={daily} big />
      </section>

      <div className="mingju-filter" role="group" aria-label="按组筛选">
        <button className={`mingju-chip ${!group ? 'mingju-chip--on' : ''}`} onClick={() => setGroup('')}>
          全部 {ITEMS.length}
        </button>
        {GROUPS.filter(([k]) => counts[k]).map(([k, label]) => (
          <button key={k} className={`mingju-chip ${group === k ? 'mingju-chip--on' : ''}`} onClick={() => setGroup(group === k ? '' : k)}>
            {label} {counts[k]}
          </button>
        ))}
        <input
          className="mingju-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜句子或出处…"
          aria-label="搜索名句"
        />
      </div>

      {list.length === 0
        ? <p className="mingju-empty">没有匹配的句子。</p>
        : <div className="mingju-list">{list.map((e, i) => <Card key={i} e={e} />)}</div>}
    </div>
  )
}
