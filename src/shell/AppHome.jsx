import { Link } from 'react-router-dom'
import ITEMS from '../data/mingju.json'
import { bookBySlug, chapterHref } from '../features/reader/booksIndex.js'
import { agoLabel, pickDaily, recentBooks } from './recent.js'

// App 外壳的首页「书房」(docs/ipad-app-plan.md §4.1 ②):**一屏看全,不滚动**。
// 左(竖屏在上):接着读 + 今日一句;右(竖屏在下):全部书架,等分铺满剩余高度。
// 网页首页那段给新访客的主张文案(「古书原文,一句一句读明白」+ 缘起)这里不出——装了 App 的人不需要被说服。
// 书架格子由 MasterPortalPage 按 registry 算好传进来(加组自动多一格),这里只管摆。
export default function AppHome({ sites, siteDesc }) {
  const recent = recentBooks(4)
  const [first, ...others] = recent
  const daily = pickDaily(ITEMS)
  const dailyBook = daily && bookBySlug(daily.slug)
  const cols = sites.length > 12 ? 4 : 3

  return (
    <div className="app-home">
      <div className="app-home__side">
        <section className="app-home__card app-home__resume" aria-label="接着读">
          <h2 className="app-home__cap">接着读</h2>
          {first ? (
            <>
              <Link to={first.href} className="app-home__resume-main">
                <span className="app-home__resume-book">{first.book.title}</span>
                <span className="app-home__resume-where">
                  第 {first.ch} {first.book.sectionUnit || '章'}{first.seg ? ` · 第 ${first.seg + 1} 段` : ''}
                  {first.t ? ` · ${agoLabel(first.t)}` : ''}
                </span>
                <span className="app-home__resume-go">继续 →</span>
              </Link>
              {others.length > 0 && (
                <div className="app-home__resume-more">
                  {others.map((r) => (
                    <Link key={r.book.slug} to={r.href} className="app-home__chip">
                      {r.book.title}<span>第 {r.ch} {r.book.sectionUnit || '章'}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="app-home__empty">还没有读过的书。从右边的书架挑一组开始,读到哪儿这里就记到哪儿。</p>
          )}
        </section>

        {daily && (
          <section className="app-home__card app-home__daily" aria-label="今日一句">
            <h2 className="app-home__cap">今日一句</h2>
            {dailyBook ? (
              <Link to={chapterHref(dailyBook, daily.ch)} className="app-home__daily-q">{daily.q}</Link>
            ) : <p className="app-home__daily-q">{daily.q}</p>}
            <p className="app-home__daily-src">{daily.label}<Link to="/mingju" className="app-home__daily-more">名句集 →</Link></p>
          </section>
        )}
      </div>

      <section className="app-home__shelf" style={{ '--cols': cols }} aria-label="书架">
        {sites.map((s) => (
          <Link key={s.key} to={s.home} className="app-home__site" style={{ '--card-accent': `var(--${s.accent})` }}>
            <span className="app-home__seal">{s.brand}</span>
            <span className="app-home__site-title">{s.portalTitle}</span>
            <span className="app-home__site-desc">{siteDesc(s)}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
