import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import RadialMindmap from './RadialMindmap.jsx'
import books from '../../data/books/index.json'
import './books.css'

const MAPS = import.meta.glob('../../data/books/*/mindmap.json', { eager: true })
function mapFor(slug) {
  const hit = Object.entries(MAPS).find(([p]) => p.includes(`/${slug}/`))
  return hit ? (hit[1].default || hit[1]) : null
}

export default function BookHomePage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const book = books.find((b) => b.slug === slug)
  const mind = mapFor(slug)
  usePageTitle(book ? `${book.title} · 观书` : '观书')

  if (!book || !mind) {
    return <div className="book-home" data-site="portal"><p className="books-empty">没有这本书。<Link to="/books">返回书房</Link></p></div>
  }

  return (
    <div className="book-home" data-site="portal">
      <div className="book-home__head">
        <h1 className="book-home__title">{book.title}</h1>
        <div className="book-home__by">{book.subtitle ? `${book.subtitle} · ` : ''}{book.author}</div>
        <p className="book-home__one">{book.oneLine}</p>
      </div>

      <RadialMindmap data={mind} onOpenChapter={(n) => n.ref && nav(`/books/${slug}/${n.ref.ch}`)} />

      <div className="book-toc">
        <h2 className="book-toc__h">章节 · 逐章详读</h2>
        <div className="book-toc__list">
          {(book.chapters || []).map((c) => (
            <Link key={c.no} to={`/books/${slug}/${c.no}`} className="book-toc__item">
              <span className="book-toc__no">{c.no}</span>
              <span className="book-toc__t">{c.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
