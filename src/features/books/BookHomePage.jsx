import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import MindTree from './MindTree.jsx'
import BookCover from './BookCover.jsx'
import ArticleDrawer from '../reader/ArticleDrawer.jsx'
import HomeSeal from './HomeSeal.jsx'
import CommentSection from '../comments/CommentSection.jsx'
import books from '../../data/books/index.json'
import { loadArticle, loadMindmap, loadOverview } from './bookContent.js'
import './books.css'

export default function BookHomePage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const book = books.find((b) => b.slug === slug)
  // 正文按需拉取:140 本全量打包曾把单个 chunk 顶到 29.7 MiB、超 Cloudflare 25 MiB 上限
  const [mind, setMind] = useState(null)
  // 入口条要显示总览的 hero 标题,所以总览也提前取一次(它只有几十 KB,且与脑图并行)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  usePageTitle(book ? `${book.title} · 观书` : '观书')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setMind(null)
    setOverview(null)
    loadMindmap(slug).then((d) => { if (alive) { setMind(d); setLoading(false) } })
    loadOverview(slug).then((d) => { if (alive) setOverview(d) })
    return () => { alive = false }
  }, [slug])

  if (book && loading) {
    return <div className="book-home" data-site="portal"><div className="books-topbar books-topbar--end"><HomeSeal /></div><p className="route-loading">⋯</p></div>
  }

  if (!book || !mind) {
    return <div className="book-home" data-site="portal"><div className="books-topbar books-topbar--end"><HomeSeal /></div><p className="books-empty">没有这本书。<Link to="/books">返回书房</Link></p></div>
  }

  // 抽屉先开、内容随后填(ArticleDrawer 的 data 为空时自己显示载入态)
  const openOverview = () => {
    const base = { href: `/books/${slug}/overview`, brand: `一篇文章读懂《${book.title}》`, chap: '全书总览', data: overview }
    setDrawer(base)
    if (!overview) loadOverview(slug).then((d) => setDrawer((cur) => (cur && cur.href === base.href ? { ...cur, data: d } : cur)))
  }
  const openChapter = (no) => {
    const c = (book.chapters || []).find((x) => String(x.no) === String(no))
    const base = { href: `/books/${slug}/${no}`, brand: book.title, chap: `第${no}章 · ${c ? c.title : ''}`, data: null }
    setDrawer(base)
    loadArticle(slug, no).then((d) => setDrawer((cur) => (cur && cur.href === base.href ? { ...cur, data: d } : cur)))
  }
  // 普通左键 → 弹抽屉;⌘/Ctrl/Shift/中键 保留「新标签打开该 URL」的原生行为
  const soft = (e, fn) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); fn() }

  return (
    <div className="book-home" data-site="portal">
      <div className="books-topbar">
        <Link to="/books" className="book-home__back">← Gavin 的书房</Link>
        <HomeSeal />
      </div>
      <div className="book-home__head">
        <BookCover className="book-home__cover" title={book.title} subtitle={book.subtitle} author={book.author} accent={book.accent} motif={book.cover?.motif} />
        <h1 className="book-home__title">{book.title}</h1>
        <div className="book-home__by">{book.subtitle ? `${book.subtitle} · ` : ''}{book.author}</div>
        <p className="book-home__one">{book.oneLine}</p>
      </div>

      <MindTree data={mind} onOpenChapter={(n) => n.ref && openChapter(n.ref.ch)} />

      <Link to={`/books/${slug}/overview`} className="book-overview-cta" onClick={(e) => soft(e, openOverview)}>
        <div className="book-overview-cta__t">一篇文章读懂《{book.title}》 ↗</div>
        {overview?.hero?.headline && <div className="book-overview-cta__h">{overview.hero.headline}</div>}
      </Link>

      <div className="book-toc">
        <h2 className="book-toc__h">章节 · 逐章详读</h2>
        <div className="book-toc__list">
          {(book.chapters || []).map((c) => (
            <Link key={c.no} to={`/books/${slug}/${c.no}`} className="book-toc__item" onClick={(e) => soft(e, () => openChapter(c.no))}>
              <span className="book-toc__no">{c.no}</span>
              <span className="book-toc__t">{c.title}</span>
            </Link>
          ))}
        </div>
      </div>

      <CommentSection key={`books:${slug}`} corpus="books" slug={slug} chapter="home" />

      <ArticleDrawer
        open={!!drawer}
        accent={book.accent}
        brand={drawer?.brand}
        chap={drawer?.chap}
        data={drawer?.data}
        onFull={() => { const h = drawer.href; setDrawer(null); nav(h) }}
        onClose={() => setDrawer(null)}
      />
    </div>
  )
}
