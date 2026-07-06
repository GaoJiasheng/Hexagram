import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { BaihuaArticle } from '../reader/BaihuaBlock.jsx'
import HomeSeal from './HomeSeal.jsx'
import books from '../../data/books/index.json'
import './books.css'

const OVERVIEWS = import.meta.glob('../../data/books/*/overview.json', { eager: true })
const ARTICLES = import.meta.glob('../../data/books/*/articles/*.json', { eager: true })
const pick = (obj, test) => { const h = Object.entries(obj).find(([p]) => test(p)); return h ? (h[1].default || h[1]) : null }

export default function BookArticlePage({ kind }) {
  const { slug, chapter } = useParams()
  const book = books.find((b) => b.slug === slug)
  const isOverview = kind === 'overview'
  const data = isOverview
    ? pick(OVERVIEWS, (p) => p.includes(`/${slug}/`))
    : pick(ARTICLES, (p) => p.includes(`/${slug}/`) && p.endsWith(`/${chapter}.json`))
  const ch = book && !isOverview && (book.chapters || []).find((c) => String(c.no) === String(chapter))
  usePageTitle(book ? `${isOverview ? '全书总览' : (ch ? ch.title : '第' + chapter + '章')} · ${book.title}` : '观书')

  if (!book) return <div className="book-home" data-site="portal"><HomeSeal /><p className="books-empty">没有这本书。<Link to="/books">返回书房</Link></p></div>

  const chapters = book.chapters || []
  const idx = isOverview ? -1 : chapters.findIndex((c) => String(c.no) === String(chapter))
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null

  return (
    <div className="book-article" data-site="portal">
      <aside className="book-article__toc">
        <HomeSeal />
        <Link to={`/books/${slug}`} className="book-article__back">← {book.title}</Link>
        <Link to={`/books/${slug}/overview`} className={'book-article__tocitem' + (isOverview ? ' is-cur' : '')}>全书总览</Link>
        <div className="book-article__tocsep" />
        {chapters.map((c) => (
          <Link key={c.no} to={`/books/${slug}/${c.no}`} className={'book-article__tocitem' + (!isOverview && String(c.no) === String(chapter) ? ' is-cur' : '')}>
            <span className="book-article__tocno">{c.no}</span>{c.title}
          </Link>
        ))}
      </aside>

      <article className="book-article__main baihua-page">
        {data ? (
          <BaihuaArticle data={data} />
        ) : (
          <div className="books-empty">
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--ink)' }}>
              {isOverview ? '全书总览' : `第${chapter}章 · ${ch ? ch.title : ''}`}
            </p>
            <p>本文将按「白话·{isOverview ? '加厚档 ≤1万字' : '普通档 ≤5000字'}」标准生成（可配图）。<br />当前为结构占位，内容生成中。</p>
          </div>
        )}
        {!isOverview && (prev || next) && (
          <nav className="book-article__nav">
            {prev ? <Link to={`/books/${slug}/${prev.no}`}>← {prev.title}</Link> : <span />}
            {next ? <Link to={`/books/${slug}/${next.no}`}>{next.title} →</Link> : <span />}
          </nav>
        )}
      </article>
    </div>
  )
}
