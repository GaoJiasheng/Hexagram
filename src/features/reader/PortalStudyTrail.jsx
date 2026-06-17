import { Link } from 'react-router-dom'
import { SITE_MAP } from '../../sites/registry.js'
import { bookBySlug, chapterHref } from './booksIndex.js'
import { getCorpusMarks, getCorpusNotes, getReadingProgress } from '../yijing/storage.js'

// 总门户「我的研读」(#142/B3)——跨组聚合续读 + 收藏 + 批注,补「同时读佛+儒+中医的人
// 无处看全部足迹」的缺口。数据全在 localStorage(reading / corpusMarks / corpusNotes),
// 经 booksIndex 把 slug 解析回各组书。无足迹则整段不渲染(新访客门户保持清爽)。
// 易经经传走自身 /me(其 slug 不在书目索引),此处不并入。

function siteTag(book) {
  if (book.corpus === 'dao') return '道藏'
  return (SITE_MAP[book.corpus]?.portalTitle || '').replace(/(研读|研习)$/, '')
}
const byAtDesc = (a, b) => (b.at || '').localeCompare(a.at || '')

export default function PortalStudyTrail() {
  const progress = getReadingProgress()
  const resume = Object.entries(progress)
    .map(([slug, ch]) => ({ book: bookBySlug(slug), ch }))
    .filter((r) => r.book && r.ch > 0 && !r.book.singlePage)
    .slice(0, 8)
  const marks = Object.values(getCorpusMarks()).filter((m) => bookBySlug(m.slug)).sort(byAtDesc)
  const notes = Object.values(getCorpusNotes()).filter((n) => bookBySlug(n.slug)).sort(byAtDesc)

  if (!resume.length && !marks.length && !notes.length) return null

  return (
    <section className="portal-trail" aria-label="我的研读">
      <h2 className="portal-trail__heading">我的研读</h2>

      {resume.length > 0 && (
        <div className="portal-trail__group">
          <h3 className="portal-trail__label">继续读</h3>
          <div className="portal-trail__list">
            {resume.map((r) => (
              <Link key={r.book.slug} to={chapterHref(r.book, r.ch)} className="portal-trail__row">
                <span className="portal-trail__book">{r.book.title}</span>
                <span className="portal-trail__site">{siteTag(r.book)}</span>
                <span className="portal-trail__meta">读至第 {r.ch} {r.book.sectionUnit || '章'} →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(marks.length > 0 || notes.length > 0) && (
        <p className="portal-trail__stats">
          {marks.length > 0 && <span>★ {marks.length} 收藏</span>}
          {notes.length > 0 && <span>✎ {notes.length} 批注</span>}
          <span className="portal-trail__hint">各站「我的」页见详情</span>
        </p>
      )}

      {marks.length > 0 && (
        <div className="portal-trail__group">
          <h3 className="portal-trail__label">最近收藏</h3>
          <div className="portal-trail__list">
            {marks.slice(0, 5).map((m) => {
              const b = bookBySlug(m.slug)
              return (
                <Link key={`${m.slug}:${m.ch}:${m.i}`} to={chapterHref(b, m.ch)} className="portal-trail__row">
                  <span className="portal-trail__snippet">{m.snippet}…</span>
                  <span className="portal-trail__meta">{b.title}·第{m.ch}{b.sectionUnit || '章'} →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
