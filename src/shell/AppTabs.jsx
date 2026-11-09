import { NavLink, useLocation } from 'react-router-dom'
import { useBooksSecretTap } from '../features/books/booksSecretTap.js'

// App 外壳的固定导航(docs/ipad-app-plan.md §4.1):平板竖屏是底部标签栏,宽屏(iPad 横屏 / 13 吋 / Mac)是左侧栏。
// 两种摆法是同一份 DOM,由 [data-form] 的 CSS 决定横排还是竖排——窗口拖宽拖窄不重挂载、不丢状态。
// 五个入口是**全站级**的(书房 / 接着读 / 搜索 / 索引 / 我的);各分站自己的栏目(经典 / 学脉 / 推演…)仍在顶栏。
// 手机形态不出这一条,沿用原来的手机底栏(各站栏目 + 搜索 + 我的)。

const INDEX_PATHS = ['/app/index', '/mingju', '/renwu', '/timeline', '/concepts', '/rhyme']
const ME_PATHS = ['/app/me', '/stats', '/about', '/privacy', '/ba', '/legal']

const Icon = ({ children }) => (
  <svg className="app-tabs__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const ICONS = {
  home: <Icon><path d="M5 4v16M9.5 4v16M14 6l4.5 14" /><path d="M3 20h18" /></Icon>,
  resume: <Icon><path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" /></Icon>,
  search: <Icon><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></Icon>,
  index: <Icon><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></Icon>,
  me: <Icon><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></Icon>,
}

export default function AppTabs({ onSearch }) {
  const { pathname } = useLocation()
  const booksTap = useBooksSecretTap()   // 第一项连点 3 次 → 观书(仅管理员),与手机底栏同一约定
  const inIndex = INDEX_PATHS.includes(pathname) || pathname.startsWith('/debates')
  const inMe = ME_PATHS.includes(pathname)
  const inResume = pathname === '/app/continue'
  // 进了任何一本书、任何一个分站,都算还在「书房」这一格里
  const inHome = !inIndex && !inMe && !inResume

  const item = (to, key, label, active, onClick) => (
    <NavLink to={to} className={`app-tabs__item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {ICONS[key]}
      <span className="app-tabs__label">{label}</span>
    </NavLink>
  )

  return (
    <nav className="app-tabs" aria-label="全站导航">
      {item('/', 'home', '书房', inHome, booksTap)}
      {item('/app/continue', 'resume', '接着读', inResume)}
      <button type="button" className="app-tabs__item" onClick={onSearch} aria-label="全站搜索">
        {ICONS.search}
        <span className="app-tabs__label">搜索</span>
      </button>
      {item('/app/index', 'index', '索引', inIndex)}
      {item('/app/me', 'me', '我的', inMe)}
    </nav>
  )
}
