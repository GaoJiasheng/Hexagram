import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import SchoolEntry from './SchoolEntry.jsx'
import BookOutline from './BookOutline.jsx'
import { groupRecent, ShelfResume, ShelfDoors } from './ShelfHome.jsx'

// 「一组就是一本书」的首页(owner 2026-10-01:唐诗只有《唐诗三百首》,不会再扩,
// 首页放一张书架卡再点进去看目录是多此一举——直接在首页把这本书的目录展开)。
// 唐诗 / 宋词 / 元曲 / 古文四组用它:标题与副题照旧,一家之来路照旧,下面不再是书架,
// 而是这本书的展开版(BookOutline:题解 + 书级导读 + 续读 + 全部篇目,各分支见那边)。
// 组里若还有别的书(宋词补遗),在末尾一行「另收」列出,不与主书争版面。
// volumes / beforeToc 原样透传给 BookOutline(古文观止按卷分段、课本补编插在目录前)。
export default function SingleBookHome({ corpus, slug, title, subtitle, basePath, brand, disclaimer, texts, volumes, beforeToc = null }) {
  usePageTitle(null, brand)
  const others = (texts || []).filter((t) => t.slug !== slug)
  // 顶上「接着读」(落到段,组里另一本书读得更近也会排在前头)、目录前「这一家的门道」一行;与书多的组首页同款
  const recent = groupRecent(corpus)

  return (
    <div className="dao-home book-home">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {disclaimer && <div className="shelf-disclaimer" role="note">⚠ {disclaimer}</div>}

      <ShelfResume recent={recent} />

      <SchoolEntry corpus={corpus} />

      <ShelfDoors corpus={corpus} texts={texts || []} basePath={basePath} compact />

      <BookOutline corpus={corpus} slug={slug} basePath={basePath} volumes={volumes} beforeToc={beforeToc} hideResume={recent[0]?.book.slug === slug} />

      {others.length > 0 && (
        <p className="book-home__others">
          另收：
          {others.map((t, i) => (
            <span key={t.slug}>
              {i > 0 && ' · '}
              <Link to={`${basePath}/${t.slug}`}>{t.title}</Link>
              {t.sections ? `（${t.sections} ${t.sectionUnit}）` : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
