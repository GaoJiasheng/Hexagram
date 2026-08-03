import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { BaihuaArticle } from '../reader/BaihuaBlock.jsx'
import FontScaleControl from '../reader/FontScaleControl.jsx'
import FontFamilyControl from '../reader/FontFamilyControl.jsx'
import HomeSeal from './HomeSeal.jsx'
import books from '../../data/books/index.json'
import { loadArticle, loadOverview } from './bookContent.js'
import './books.css'

export default function BookArticlePage({ kind }) {
  const { slug, chapter } = useParams()
  const book = books.find((b) => b.slug === slug)
  const isOverview = kind === 'overview'
  // 正文按需拉取(见 bookContent.js:全量打包曾超 Cloudflare 单文件上限)
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    setData(null)
    const p = isOverview ? loadOverview(slug) : loadArticle(slug, chapter)
    p.then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [slug, chapter, isOverview])
  const ch = book && !isOverview && (book.chapters || []).find((c) => String(c.no) === String(chapter))
  usePageTitle(book ? `${isOverview ? '全书总览' : (ch ? ch.title : '第' + chapter + '章')} · ${book.title}` : '观书')

  if (!book) return <div className="book-home" data-site="portal"><div className="books-topbar books-topbar--end"><HomeSeal /></div><p className="books-empty">没有这本书。<Link to="/books">返回书房</Link></p></div>

  const chapters = book.chapters || []
  const idx = isOverview ? -1 : chapters.findIndex((c) => String(c.no) === String(chapter))
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null

  return (
    <div className="book-article" data-site="portal">
      <div className="books-topbar book-article__topbar">
        <Link to={`/books/${slug}`} className="book-article__back">← {book.title}</Link>
        <div className="book-article__topbar-right">
          <FontFamilyControl />
          <FontScaleControl />
          <HomeSeal />
        </div>
      </div>

      <aside className="book-article__toc">
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
