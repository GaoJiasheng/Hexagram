import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { corpusTexts } from './corpus.js'
import { DAO_TEXTS } from '../dao/data.js'
import { getCorpusMarks, getCorpusNotes, getReadingProgress, getStudyStats } from '../yijing/storage.js'

// 收藏/批注累积里程碑文案(#149)——按总数给一句鼓励,温故之意
function milestoneText(total) {
  if (total >= 100) return `蔚然成观——已积收藏批注 ${total} 处,可成一家之读。`
  if (total >= 50) return `积学已富——已积 ${total} 处,温故而知新。`
  if (total >= 20) return `渐有所积——已收藏批注 ${total} 处。`
  if (total >= 10) return `已积 ${total} 处收藏批注,日拱一卒。`
  return null
}

// 读经站「我的」(Tier 2)——本站续读 + 收藏段落 + 笔记。锚 corpus:slug:章:段 回链原文。
export default function CorpusMePage({ corpus }) {
  const site = SITE_MAP[corpus]
  usePageTitle('我的', site?.brand)

  const metas = corpus === 'dao' ? DAO_TEXTS : corpusTexts(corpus)
  const metaOf = (slug) => metas.find((t) => t.slug === slug)
  const home = site.home
  const unit = (slug) => metaOf(slug)?.sectionUnit || '章'
  const titleOf = (slug) => metaOf(slug)?.title || slug
  const linkTo = (slug, ch) =>
    metaOf(slug)?.singlePage ? `${home}/${slug}#${corpus}-ch-${ch}` : `${home}/${slug}/${ch}`

  const marks = Object.values(getCorpusMarks()).filter((m) => m.corpus === corpus).sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  const notes = Object.values(getCorpusNotes()).filter((n) => n.corpus === corpus).sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  const stats = getStudyStats()
  const progress = getReadingProgress()
  const resume = metas
    .filter((t) => t.status !== 'pending' && !t.singlePage && t.sections > 1 && progress[t.slug] > 0)
    .map((t) => ({ slug: t.slug, ch: progress[t.slug] }))

  const empty = !resume.length && !marks.length && !notes.length

  return (
    <div className="page-content corpus-me">
      <div className="basics-breadcrumb">
        <Link to={home} className="basics-breadcrumb__link">← {site.portalTitle}</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">我的 · {site.portalTitle}</h1>
        <p className="page-subtitle text-soft">本站的续读、收藏与批注(仅存本机)。</p>
        {milestoneText(stats.total) && <p className="me-milestone">{milestoneText(stats.total)}</p>}
      </div>

      {!stats.exported && stats.total >= 8 && (
        <p className="me-backup" role="note">
          ⚠ 你已积累 {stats.total} 处收藏 / 批注,且只存于此浏览器。建议到<strong>设置(顶栏齿轮)→ 数据管理</strong>导出备份,以防清缓存或换设备丢失。
        </p>
      )}

      {empty && <p className="text-faint corpus-me__empty">还没有续读或收藏。阅读时点段落右侧的 ★ 收藏、✎ 写批注,这里就会出现。</p>}

      {resume.length > 0 && (
        <section className="corpus-me__section">
          <h2 className="corpus-me__title">继续读</h2>
          <div className="corpus-me__list">
            {resume.map((r) => (
              <Link key={r.slug} to={linkTo(r.slug, r.ch)} className="corpus-me__row">
                <span className="corpus-me__book">{titleOf(r.slug)}</span>
                <span className="corpus-me__meta">读至第 {r.ch} {unit(r.slug)} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {marks.length > 0 && (
        <section className="corpus-me__section">
          <h2 className="corpus-me__title">收藏 · {marks.length}</h2>
          <div className="corpus-me__list">
            {marks.map((m) => (
              <Link key={`${m.slug}:${m.ch}:${m.i}`} to={linkTo(m.slug, m.ch)} className="corpus-me__row">
                <span className="corpus-me__snippet">{m.snippet}…</span>
                <span className="corpus-me__meta">{titleOf(m.slug)}·第{m.ch}{unit(m.slug)} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="corpus-me__section">
          <h2 className="corpus-me__title">批注 · {notes.length}</h2>
          <div className="corpus-me__list">
            {notes.map((n) => (
              <Link key={`${n.slug}:${n.ch}:${n.i}`} to={linkTo(n.slug, n.ch)} className="corpus-me__row corpus-me__row--note">
                <span className="corpus-me__note-text">{n.text}</span>
                <span className="corpus-me__snippet text-faint">「{n.snippet}…」</span>
                <span className="corpus-me__meta">{titleOf(n.slug)}·第{n.ch}{unit(n.slug)} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
