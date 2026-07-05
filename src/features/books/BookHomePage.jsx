import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import MindTree from './MindTree.jsx'
import BookCover from './BookCover.jsx'
import BookArticleDrawer from './BookArticleDrawer.jsx'
import books from '../../data/books/index.json'
import './books.css'

const MAPS = import.meta.glob('../../data/books/*/mindmap.json', { eager: true })
const OVERVIEWS = import.meta.glob('../../data/books/*/overview.json', { eager: true })
const ARTICLES = import.meta.glob('../../data/books/*/articles/*.json', { eager: true })
function pickFor(glob, slug) {
  const hit = Object.entries(glob).find(([p]) => p.includes(`/${slug}/`))
  return hit ? (hit[1].default || hit[1]) : null
}
function articleFor(slug, no) {
  const hit = Object.entries(ARTICLES).find(([p]) => p.includes(`/${slug}/`) && p.endsWith(`/${no}.json`))
  return hit ? (hit[1].default || hit[1]) : null
}

export default function BookHomePage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const book = books.find((b) => b.slug === slug)
  const mind = pickFor(MAPS, slug)
  const overview = pickFor(OVERVIEWS, slug)
  const [drawer, setDrawer] = useState(null)
  usePageTitle(book ? `${book.title} · 观书` : '观书')

  if (!book || !mind) {
    return <div className="book-home" data-site="portal"><p className="books-empty">没有这本书。<Link to="/books">返回书房</Link></p></div>
  }

  const openOverview = () => setDrawer({ href: `/books/${slug}/overview`, brand: `一篇文章读懂《${book.title}》`, chap: '全书总览', data: overview })
  const openChapter = (no) => {
    const c = (book.chapters || []).find((x) => String(x.no) === String(no))
    setDrawer({ href: `/books/${slug}/${no}`, brand: book.title, chap: `第${no}章 · ${c ? c.title : ''}`, data: articleFor(slug, no) })
  }
  // 普通左键 → 弹抽屉;⌘/Ctrl/Shift/中键 保留「新标签打开该 URL」的原生行为
  const soft = (e, fn) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); fn() }

  return (
    <div className="book-home" data-site="portal">
      <Link to="/books" className="book-home__back">← 书房</Link>
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

      <BookArticleDrawer
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
