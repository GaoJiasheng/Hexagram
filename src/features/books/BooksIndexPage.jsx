import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import BookCover from './BookCover.jsx'
import HomeSeal from './HomeSeal.jsx'
import books from '../../data/books/index.json'
import './books.css'

// 私人书房索引:all-in-one 一个总索引 + 标签筛选(owner 决定)。隐藏入口 /books。
const TAGS = ['哲学', '人生', '管理', '心理', '经济', '政治']

export default function BooksIndexPage() {
  usePageTitle('观书 · Gavin 的书房')
  const [active, setActive] = useState(null)
  const list = active ? books.filter((b) => (b.tags || []).includes(active)) : books

  return (
    <div className="books-page" data-site="portal">
      <div className="books-topbar books-topbar--end">
        <HomeSeal />
      </div>
      <div className="books-head">
        <h1 className="books-title">观书 · Gavin 的书房</h1>
        <p className="books-sub">读过的书，整理成一篇文章 + 一张脑图，随时回来复习</p>
      </div>

      <div className="books-tags">
        <button className={'books-tag' + (!active ? ' books-tag--on' : '')} onClick={() => setActive(null)}>全部</button>
        {TAGS.map((t) => (
          <button key={t} className={'books-tag' + (active === t ? ' books-tag--on' : '')} onClick={() => setActive(active === t ? null : t)}>{t}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="books-empty">这个标签下还没有书。</p>
      ) : (
        <div className="books-grid">
          {list.map((b) => (
            <Link key={b.slug} to={`/books/${b.slug}`} className="book-card" style={{ '--card-accent': b.accent }}>
              <BookCover className="book-card__cover" title={b.title} subtitle={b.subtitle} author={b.author} accent={b.accent} motif={b.cover?.motif} />
              <div className="book-card__body">
                <h2 className="book-card__title">{b.title}</h2>
                <div className="book-card__meta">{b.author}{b.finishedAt ? ` · 读毕 ${b.finishedAt}` : ''}</div>
                <div className="book-card__one">{b.oneLine}</div>
                <div className="book-card__tags">{(b.tags || []).map((t) => <span key={t} className="book-card__tag">{t}</span>)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
