import { useParams, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import books from '../../data/books/index.json'
import './books.css'

// M1 占位:章详读页(大纲树 + 白话式章文章)将在 M2 接入 BaihuaArticle 渲染器。
export default function BookChapterPage() {
  const { slug, chapter } = useParams()
  const book = books.find((b) => b.slug === slug)
  const ch = book && (book.chapters || []).find((c) => String(c.no) === String(chapter))
  usePageTitle(ch ? `${ch.title} · ${book.title}` : '观书')
  if (!book || !ch) return <div className="book-home" data-site="portal"><p className="books-empty">没有这一章。<Link to={`/books/${slug}`}>返回书主页</Link></p></div>
  return (
    <div className="book-home" data-site="portal">
      <div className="book-home__head">
        <div className="book-home__by"><Link to={`/books/${slug}`}>← {book.title}</Link></div>
        <h1 className="book-home__title">第{ch.no}章 · {ch.title}</h1>
      </div>
      <p className="books-empty">本章详读文章将按「白话·普通档」标准生成（≤5000 字，可配图）。<br />当前为 M1 结构占位。</p>
    </div>
  )
}
