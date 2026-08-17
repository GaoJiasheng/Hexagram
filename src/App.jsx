import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { SettingsProvider } from './features/yijing/SettingsContext.jsx'
import { AuthProvider } from './features/auth/AuthContext.jsx'
import { useAuth } from './features/auth/AuthContext.jsx'
import SchoolAvatar from './features/auth/SchoolAvatar.jsx'
import ErrorBoundary from './features/ErrorBoundary.jsx'
import { siteForPath, activeGroup, sitesInGroup, HOST_GROUPS, MASTER_PORTAL_PATH } from './sites/registry.js'
import { registerBookShortcut } from './native/appShortcuts.js'
import { setupBackButton } from './native/backButton.js'
import { useTelemetry } from './features/telemetry.js'

// 全站搜索面板按需加载:搜索页面、经典、正文、白话、注疏、专题。
const GlobalSearchPalette = lazy(() => import('./features/search/GlobalSearchPalette.jsx'))

// 页面全部按路由懒加载(v11 §2),首包只留壳与搜索
// Pages — 易经研习模块
const HomePage = lazy(() => import('./features/yijing/pages/HomePage.jsx'))
const HexagramsPage = lazy(() => import('./features/yijing/pages/HexagramsPage.jsx'))
const HexagramDetailPage = lazy(() => import('./features/yijing/pages/HexagramDetailPage.jsx'))
const WorkbenchPage = lazy(() => import('./features/yijing/pages/WorkbenchPage.jsx'))
const ClassicsListPage = lazy(() => import('./features/yijing/pages/ClassicsListPage.jsx'))
const ClassicsReadPage = lazy(() => import('./features/yijing/pages/ClassicsReadPage.jsx'))
const BasicsPage = lazy(() => import('./features/yijing/pages/BasicsPage.jsx'))
const YinYangPage = lazy(() => import('./features/yijing/pages/YinYangPage.jsx'))
const HetuLuoshuPage = lazy(() => import('./features/yijing/pages/HetuLuoshuPage.jsx'))
const XiaoxiPage = lazy(() => import('./features/yijing/pages/XiaoxiPage.jsx'))
const ShicaoPage = lazy(() => import('./features/yijing/pages/ShicaoPage.jsx'))
const MeihuaBasicsPage = lazy(() => import('./features/yijing/pages/MeihuaBasicsPage.jsx'))
const JinqianBasicsPage = lazy(() => import('./features/yijing/pages/JinqianBasicsPage.jsx'))
const YuanliuPage = lazy(() => import('./features/yijing/pages/YuanliuPage.jsx'))
const ShiliListPage = lazy(() => import('./features/yijing/pages/ShiliListPage.jsx'))
const ShiliDetailPage = lazy(() => import('./features/yijing/pages/ShiliDetailPage.jsx'))
const ShishiPage = lazy(() => import('./features/yijing/pages/ShishiPage.jsx'))
const GuahuaQuizPage = lazy(() => import('./features/yijing/pages/GuahuaQuizPage.jsx'))
const TuiyanIntroPage = lazy(() => import('./features/yijing/pages/TuiyanIntroPage.jsx'))
const GlossaryPage = lazy(() => import('./features/yijing/pages/GlossaryPage.jsx'))
const MePage = lazy(() => import('./features/yijing/pages/MePage.jsx'))
// Pages — 道藏研读模块
const DaoHomePage = lazy(() => import('./features/dao/pages/DaoHomePage.jsx'))
const DaoTextPage = lazy(() => import('./features/dao/pages/DaoTextPage.jsx'))
const DaoReadPage = lazy(() => import('./features/dao/pages/DaoReadPage.jsx'))
// Pages — 释典 / 儒典(v15 脚手架)
const FoHomePage = lazy(() => import('./features/fo/pages/FoHomePage.jsx'))
const RuHomePage = lazy(() => import('./features/ru/pages/RuHomePage.jsx'))
const XinHomePage = lazy(() => import('./features/xin/pages/XinHomePage.jsx'))
// Pages — 诸子百家:法/墨/兵/纵横(v18 脚手架)
const FaHomePage = lazy(() => import('./features/fa/pages/FaHomePage.jsx'))
const MoHomePage = lazy(() => import('./features/mo/pages/MoHomePage.jsx'))
const BingHomePage = lazy(() => import('./features/bing/pages/BingHomePage.jsx'))
const ZongHomePage = lazy(() => import('./features/zong/pages/ZongHomePage.jsx'))
const ZhongyiHomePage = lazy(() => import('./features/zhongyi/pages/ZhongyiHomePage.jsx'))
const MoulueHomePage = lazy(() => import('./features/moulue/pages/MoulueHomePage.jsx'))
const TangshiHomePage = lazy(() => import('./features/tangshi/pages/TangshiHomePage.jsx'))
const SongciHomePage = lazy(() => import('./features/songci/pages/SongciHomePage.jsx'))
const YuanquHomePage = lazy(() => import('./features/yuanqu/pages/YuanquHomePage.jsx'))
const CorpusTextPage = lazy(() => import('./features/reader/CorpusTextPage.jsx'))
const CorpusReadPage = lazy(() => import('./features/reader/CorpusReadPage.jsx'))
const BaihuaPage = lazy(() => import('./features/reader/BaihuaPage.jsx'))
const CorpusMePage = lazy(() => import('./features/reader/CorpusMePage.jsx'))
const MasterPortalPage = lazy(() => import('./features/MasterPortalPage.jsx'))
const AboutPage = lazy(() => import('./features/AboutPage.jsx'))
const PrivacyPage = lazy(() => import('./features/PrivacyPage.jsx'))
const ConceptsPage = lazy(() => import('./features/ConceptsPage.jsx'))
const MingjuPage = lazy(() => import('./features/MingjuPage.jsx'))
const DebateListPage = lazy(() => import('./features/debates/DebateListPage.jsx'))
const DebatePage = lazy(() => import('./features/debates/DebatePage.jsx'))
const DebateArticlePage = lazy(() => import('./features/debates/DebateArticlePage.jsx'))
const ZhuziTopologyPage = lazy(() => import('./features/zhuzi/ZhuziTopologyPage.jsx'))
const SchoolPage = lazy(() => import('./features/reader/SchoolPage.jsx'))
const DaoduPage = lazy(() => import('./features/reader/DaoduPage.jsx'))
const BooksIndexPage = lazy(() => import('./features/books/BooksIndexPage.jsx'))
const BookHomePage = lazy(() => import('./features/books/BookHomePage.jsx'))
const BookArticlePage = lazy(() => import('./features/books/BookArticlePage.jsx'))
const ColophonPage = lazy(() => import('./features/Colophon.jsx').then((module) => ({ default: module.ColophonPage })))
const LicensePage = lazy(() => import('./features/LicensePage.jsx'))
const AdminStatsPage = lazy(() => import('./features/admin/AdminStatsPage.jsx'))

// 中立外壳路径(总门户 / 义理专题 / 百家争鸣):不套分站 nav/搜索/底栏,域名着陆豁免
function isNeutralPath(p) {
  return p === '/' || p === MASTER_PORTAL_PATH || p === '/concepts' || p === '/mingju' || p === '/privacy' || p === '/ba' || p === '/legal' || p === '/admin/stats' || p === '/debates' || p.startsWith('/debates/') || p === '/zhuzi' || p === '/books' || p.startsWith('/books/')
}
// 全站设置浮层(Tier 0):任何站 nav 齿轮就地打开(主题/字号/译文 + 数据导出导入)
const SettingsSheet = lazy(() => import('./features/SettingsSheet.jsx'))
const Colophon = lazy(() => import('./features/Colophon.jsx'))

// 站点注册迁至 src/sites/registry.js(v14):平台读 manifest,加站零改平台代码

// 整屏门户 — 「网站之间切换」的体感(v4 §3.2);v15:只列当前组的站,跨组零可见链接
function ModulePortal({ current, group, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="module-portal" role="dialog" aria-modal="true" aria-label="切换站点" onClick={onClose}>
      <div className="module-portal__inner" onClick={e => e.stopPropagation()}>
        <p className="module-portal__hint">观象 · 个人学习站</p>
        <div className="module-portal__cards">
          {sitesInGroup(group).map(m => (
            <NavLink
              key={m.key}
              to={m.home}
              className={`module-portal__card ${current === m.key ? 'module-portal__card--current' : ''}`}
              onClick={onClose}
            >
              <span className="module-portal__seal">{m.brand}</span>
              <span className="module-portal__title">{m.portalTitle}</span>
              <span className="module-portal__desc">{m.portalDesc}</span>
              {current === m.key && <span className="module-portal__badge">当前</span>}
            </NavLink>
          ))}
        </div>
        <button className="module-portal__close" onClick={onClose} aria-label="关闭">关闭 Esc</button>
      </div>
    </div>
  )
}

// 站名去「研读/研习」尾 → 切换钮显的目标站名(道藏研读→道藏、易经研习→易经)
const switchTargetName = (site) => site.portalTitle.replace(/(研读|研习)$/, '')

// 窄屏下(#157,与抽屉同款)随滚动方向收起主导航,给阅读腾地方:下滑收起、上滑立即展开。
// 只在窄屏生效——CSS 媒体查询兜底,宽屏即使算出 hidden 也不会有视觉变化。
const NAV_HIDE_THRESHOLD = 8, NAV_TOP_SAFE = 12, NAV_BOTTOM_SAFE = 24

function Nav({ module, canSwitch, otherSite, onSearch, onPortal, onSettings, neutral = false }) {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const lastY = useRef(0)
  const accum = useRef(0)

  useEffect(() => {
    function handler() {
      const y = window.scrollY
      setScrolled(y > 10)
      const dy = y - lastY.current
      lastY.current = y
      // 触底那一段冻结:iOS 橡皮筋回弹让 scrollY 来回跳,方向忽正忽负,导航会疯狂开合
      if (y + window.innerHeight >= document.documentElement.scrollHeight - NAV_BOTTOM_SAFE) { accum.current = 0; return }
      if (y <= NAV_TOP_SAFE) { setNavHidden(false); accum.current = 0; return }
      accum.current = (accum.current === 0 || (dy > 0) === (accum.current > 0)) ? accum.current + dy : dy
      if (accum.current > NAV_HIDE_THRESHOLD) { setNavHidden(true); accum.current = 0 }
      else if (accum.current < -NAV_HIDE_THRESHOLD) { setNavHidden(false); accum.current = 0 }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`app-nav ${neutral ? 'app-nav--neutral' : ''} ${scrolled ? 'app-nav--scrolled' : ''} ${navHidden ? 'app-nav--hidden' : ''}`} role="navigation" aria-label="主导航">
      {/* 左上角 logo → 诸学总门户(公开总入口,全站可达;列全部分组) */}
      <NavLink
        to={neutral ? '/' : MASTER_PORTAL_PATH}
        className="app-nav__brand"
        aria-label={neutral ? '观象 · 首页' : '诸学门户·全部分组'}
        title={neutral ? '观象 · 首页' : '诸学门户 · 全部分组'}
      >
        <span className="brand-seal" aria-hidden="true">{neutral ? '观象' : module.brand}</span>
      </NavLink>
      <div className="app-nav__links">
        {!neutral && module.nav.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === module.home}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </div>
      <div className="app-nav__actions">
        <button
          className="nav-icon-btn"
          onClick={onSearch}
          aria-label="全站搜索（/ 或 ⌘K）"
          title="全站搜索（/ 或 ⌘K）"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="5" />
            <line x1="11.5" y1="11.5" x2="16" y2="16" />
          </svg>
        </button>
        <button className="nav-icon-btn" onClick={onSettings} aria-label="设置" title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {/* 登录后单独出头像:切换账户/退出不必先猜「它在设置里」。未登录只有齿轮(内含登录) */}
        {user && (
          <button
            className="nav-icon-btn nav-avatar-btn"
            onClick={onSettings}
            aria-label={`账户 · ${user.displayName}`}
            title={`${user.displayName} · 账户与设置`}
          >
            <SchoolAvatar seed={user.avatarSeed} size={22} />
          </button>
        )}
        {!neutral && module.hasSearch && (
          <NavLink
            to={module.key === 'yijing' ? '/me' : `${module.home}/me`}
            className={({ isActive }) => `nav-icon-btn ${isActive ? 'active' : ''}`}
            aria-label="我的"
            style={{ textDecoration: 'none', fontSize: '1.1rem' }}
          >
            ☯
          </NavLink>
        )}
        {neutral ? null : otherSite ? (
          // 恰两站的组(易道):直接互切到另一站,钮上显目标站名(道藏 ⇄ / 易经 ⇄)
          <NavLink to={otherSite.home} className="module-switch" title={`切到${switchTargetName(otherSite)}`}>
            {switchTargetName(otherSite)} ⇄
          </NavLink>
        ) : canSwitch && (
          <button className="module-switch" onClick={onPortal} aria-label="切换站点" title="切换站点">
            {module.switchLabel} ⇄
          </button>
        )}
      </div>
    </nav>
  )
}

function MobileNav({ module, canSwitch, otherSite, onPortal, onSearch }) {
  const location = useLocation()

  return (
    <div className="mobile-nav" role="navigation" aria-label="底部导航">
      <div className="mobile-nav__inner">
        {module.mobileNav.map(({ to, label, icon, exact, match }) => {
          const isActive = match
            ? match.some((p) => location.pathname === p || location.pathname.startsWith(p))
            : exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`mobile-nav__item ${isActive ? 'active' : ''}`}
              aria-label={label}
            >
              <span className="mobile-nav__icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </NavLink>
          )
        })}
        <button className="mobile-nav__item" onClick={onSearch} aria-label="全站搜索">
          <span className="mobile-nav__icon" aria-hidden="true">⌕</span>
          <span>搜索</span>
        </button>
        {module.mobileSwitch && (otherSite ? (
          <NavLink to={otherSite.home} className="mobile-nav__item" aria-label={`切到${switchTargetName(otherSite)}`}>
            <span className="mobile-nav__icon" aria-hidden="true">⇄</span>
            <span>{switchTargetName(otherSite)}</span>
          </NavLink>
        ) : canSwitch && (
          <button className="mobile-nav__item" onClick={onPortal} aria-label="切换站点">
            <span className="mobile-nav__icon" aria-hidden="true">⇄</span>
            <span>切换</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [colophonOpen, setColophonOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openPortal = useCallback(() => setPortalOpen(true), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const openColophon = useCallback(() => setColophonOpen(true), [])
  const location = useLocation()
  const navigate = useNavigate()
  const [backHint, setBackHint] = useState('')   // 安卓「再按一次退出」的提示
  useTelemetry(location)

  const module = siteForPath(location.pathname)
  const group = activeGroup(location.pathname, typeof window !== 'undefined' ? window.location.hostname : '')
  const groupSites = sitesInGroup(group)
  const canSwitch = groupSites.length > 1
  // 恰两站的组(易道):切换钮直接互切到另一站并显其名;>2 站才弹切换层(C)
  const otherSite = groupSites.length === 2 ? groupSites.find(s => s.key !== module.key) : null
  // 中立枢纽(总门户 / 义理专题 / 百家争鸣):不套任一分站外壳(无 module nav / 搜索 / 底栏 / 主色偏向)
  const isPortal = isNeutralPath(location.pathname)
  // 路由切换关闭搜索/切站/设置/落款浮层,避免状态在跨站导航后残留
  useEffect(() => { setSearchOpen(false); setPortalOpen(false); setSettingsOpen(false); setColophonOpen(false) }, [location.pathname])

  // iOS「App 图标长按 → 书房」快捷入口 → 观书隐藏入口 /books(web/Android 无操作)
  useEffect(() => {
    let dispose
    registerBookShortcut(() => navigate('/books')).then((d) => { dispose = d })
    return () => { dispose?.() }
  }, [navigate])

  // 安卓硬件返回键(web/iOS 无操作)。不接管的话按一下就是**直接退出 App**。
  // 三层:有浮层先关浮层 → 有历史回上一页 → 栈底「再按一次退出」。
  useEffect(() => {
    let dispose
    setupBackButton(navigate, setBackHint).then((d) => { dispose = d })
    return () => { dispose?.() }
  }, [navigate])

  // 全站搜索快捷键: / 或 Cmd/Ctrl+K。输入框/可编辑区内不截获。
  useEffect(() => {
    function onKey(e) {
      const t = e.target
      const editable = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable
      if (editable || e.isComposing) return
      const slash = e.key === '/'
      const commandK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (!slash && !commandK) return
      e.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 域名着陆(v15 §1):配了 HOST_GROUPS 的域名访问别组路径时,落回本组首页。
  // HOST_GROUPS 为空(dev/主域名)时不触发,按路径分组即可。
  useEffect(() => {
    if (isNeutralPath(location.pathname)) return  // 中立枢纽(总门户/义理专题/百家争鸣)豁免域名着陆
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const hostGroup = HOST_GROUPS[host]
    if (hostGroup && module.group !== hostGroup) {
      const dest = sitesInGroup(hostGroup)[0]
      if (dest) navigate(dest.home, { replace: true })
    }
  }, [location.pathname, module.group, navigate])

  // 「再按一次退出」两秒后自动消失
  useEffect(() => {
    if (!backHint) return undefined
    const t = setTimeout(() => setBackHint(''), 2000)
    return () => clearTimeout(t)
  }, [backHint])

  return (
    <div className="app-shell" data-site={isPortal ? 'portal' : module.key}>
      {backHint && <div className="back-hint" role="status">{backHint}</div>}
      {/* 中立枢纽也要能改主题/登录/搜索——这些本就是全局功能,不属于任何分站,故给一条精简顶栏(印+搜索+设置+头像) */}
      <Nav module={module} canSwitch={canSwitch} otherSite={otherSite} onSearch={openSearch} onPortal={openPortal} onSettings={openSettings} neutral={isPortal} />
      <main className="app-main page-fade-in">
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<div className="route-loading" aria-label="加载中">⋯</div>}>
        <Routes>
          {/* 网站入口 = 诸学门户(owner:/ 不再直接进易经);易经首页挪到 /yijing */}
          <Route path="/" element={<MasterPortalPage onSearch={openSearch} />} />
          {/* 易经研习 */}
          <Route path="/yijing" element={<HomePage onSearch={openSearch} />} />
          <Route path="/hexagrams" element={<HexagramsPage />} />
          <Route path="/hexagram/:id" element={<HexagramDetailPage />} />
          {/* 易经白话整页研读(design-v22:一卦一厚文)——3 段路由,更具体于 /hexagram/:id */}
          <Route path="/hexagram/:id/baihua" element={<BaihuaPage corpus="yijing" />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/classics" element={<ClassicsListPage />} />
          <Route path="/classics/:book/:chapter" element={<ClassicsReadPage />} />
          {/* 易经经传白话整页研读(design-v22)——4 段,更具体于 /classics/:book/:chapter */}
          <Route path="/classics/:book/:chapter/baihua" element={<BaihuaPage corpus="yijing" />} />
          <Route path="/basics" element={<BasicsPage />} />
          <Route path="/basics/yinyang" element={<YinYangPage />} />
          <Route path="/basics/hetu-luoshu" element={<HetuLuoshuPage />} />
          <Route path="/basics/xiaoxi" element={<XiaoxiPage />} />
          <Route path="/basics/shicao" element={<ShicaoPage />} />
          <Route path="/basics/meihua" element={<MeihuaBasicsPage />} />
          <Route path="/basics/jinqian" element={<JinqianBasicsPage />} />
          <Route path="/basics/yuanliu" element={<YuanliuPage />} />
          <Route path="/shili" element={<ShiliListPage />} />
          <Route path="/shili/:id" element={<ShiliDetailPage />} />
          <Route path="/basics/shishi" element={<ShishiPage />} />
          <Route path="/basics/guahua" element={<GuahuaQuizPage />} />
          <Route path="/basics/tuiyan" element={<TuiyanIntroPage />} />
          <Route path="/basics/glossary" element={<GlossaryPage />} />
          <Route path="/me" element={<MePage />} />
          {/* 道藏研读 */}
          <Route path="/dao" element={<DaoHomePage />} />
          <Route path="/dao/:slug" element={<DaoTextPage />} />
          <Route path="/dao/school" element={<SchoolPage corpus="dao" />} />
          <Route path="/dao/:slug/daodu" element={<DaoduPage corpus="dao" />} />
          <Route path="/dao/:slug/:chapter" element={<DaoReadPage />} />
          {/* 释典 / 儒典(v15:经文阅读路由待内容期接 ClassicReader) */}
          <Route path="/fo" element={<FoHomePage />} />
          <Route path="/fo/:slug" element={<CorpusTextPage corpus="fo" />} />
          <Route path="/fo/school" element={<SchoolPage corpus="fo" />} />
          <Route path="/fo/:slug/daodu" element={<DaoduPage corpus="fo" />} />
          <Route path="/fo/:slug/:chapter" element={<CorpusReadPage corpus="fo" />} />
          <Route path="/ru" element={<RuHomePage />} />
          <Route path="/ru/:slug" element={<CorpusTextPage corpus="ru" />} />
          <Route path="/ru/school" element={<SchoolPage corpus="ru" />} />
          <Route path="/ru/:slug/daodu" element={<DaoduPage corpus="ru" />} />
          <Route path="/ru/:slug/:chapter" element={<CorpusReadPage corpus="ru" />} />
          <Route path="/xin" element={<XinHomePage />} />
          <Route path="/xin/:slug" element={<CorpusTextPage corpus="xin" />} />
          <Route path="/xin/school" element={<SchoolPage corpus="xin" />} />
          <Route path="/xin/:slug/daodu" element={<DaoduPage corpus="xin" />} />
          <Route path="/xin/:slug/:chapter" element={<CorpusReadPage corpus="xin" />} />
          <Route path="/fa" element={<FaHomePage />} />
          <Route path="/fa/:slug" element={<CorpusTextPage corpus="fa" />} />
          <Route path="/fa/school" element={<SchoolPage corpus="fa" />} />
          <Route path="/fa/:slug/daodu" element={<DaoduPage corpus="fa" />} />
          <Route path="/fa/:slug/:chapter" element={<CorpusReadPage corpus="fa" />} />
          <Route path="/mo" element={<MoHomePage />} />
          <Route path="/mo/:slug" element={<CorpusTextPage corpus="mo" />} />
          <Route path="/mo/school" element={<SchoolPage corpus="mo" />} />
          <Route path="/mo/:slug/daodu" element={<DaoduPage corpus="mo" />} />
          <Route path="/mo/:slug/:chapter" element={<CorpusReadPage corpus="mo" />} />
          <Route path="/bing" element={<BingHomePage />} />
          <Route path="/bing/:slug" element={<CorpusTextPage corpus="bing" />} />
          <Route path="/bing/school" element={<SchoolPage corpus="bing" />} />
          <Route path="/bing/:slug/daodu" element={<DaoduPage corpus="bing" />} />
          <Route path="/bing/:slug/:chapter" element={<CorpusReadPage corpus="bing" />} />
          <Route path="/zong" element={<ZongHomePage />} />
          <Route path="/zong/:slug" element={<CorpusTextPage corpus="zong" />} />
          <Route path="/zong/school" element={<SchoolPage corpus="zong" />} />
          <Route path="/zong/:slug/daodu" element={<DaoduPage corpus="zong" />} />
          <Route path="/zong/:slug/:chapter" element={<CorpusReadPage corpus="zong" />} />
          <Route path="/zhongyi" element={<ZhongyiHomePage />} />
          <Route path="/zhongyi/:slug" element={<CorpusTextPage corpus="zhongyi" />} />
          <Route path="/zhongyi/school" element={<SchoolPage corpus="zhongyi" />} />
          <Route path="/zhongyi/:slug/daodu" element={<DaoduPage corpus="zhongyi" />} />
          <Route path="/zhongyi/:slug/:chapter" element={<CorpusReadPage corpus="zhongyi" />} />
          <Route path="/moulue" element={<MoulueHomePage />} />
          <Route path="/moulue/:slug" element={<CorpusTextPage corpus="moulue" />} />
          <Route path="/moulue/school" element={<SchoolPage corpus="moulue" />} />
          <Route path="/moulue/:slug/daodu" element={<DaoduPage corpus="moulue" />} />
          <Route path="/moulue/:slug/:chapter" element={<CorpusReadPage corpus="moulue" />} />
          <Route path="/tangshi" element={<TangshiHomePage />} />
          <Route path="/tangshi/:slug" element={<CorpusTextPage corpus="tangshi" />} />
          <Route path="/tangshi/school" element={<SchoolPage corpus="tangshi" />} />
          <Route path="/tangshi/:slug/daodu" element={<DaoduPage corpus="tangshi" />} />
          <Route path="/tangshi/:slug/:chapter" element={<CorpusReadPage corpus="tangshi" />} />
          <Route path="/songci" element={<SongciHomePage />} />
          <Route path="/songci/:slug" element={<CorpusTextPage corpus="songci" />} />
          <Route path="/songci/school" element={<SchoolPage corpus="songci" />} />
          <Route path="/songci/:slug/daodu" element={<DaoduPage corpus="songci" />} />
          <Route path="/songci/:slug/:chapter" element={<CorpusReadPage corpus="songci" />} />
          <Route path="/yuanqu" element={<YuanquHomePage />} />
          <Route path="/yuanqu/:slug" element={<CorpusTextPage corpus="yuanqu" />} />
          <Route path="/yuanqu/school" element={<SchoolPage corpus="yuanqu" />} />
          <Route path="/yuanqu/:slug/daodu" element={<DaoduPage corpus="yuanqu" />} />
          <Route path="/yuanqu/:slug/:chapter" element={<CorpusReadPage corpus="yuanqu" />} />
          {/* 读经站「我的」(Tier 2):续读 + 收藏 + 批注;静态段优先于 /:slug,顺序无关 */}
          {['fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'dao', 'tangshi', 'songci', 'yuanqu'].map((c) => (
            <Route key={c} path={`/${c}/me`} element={<CorpusMePage corpus={c} />} />
          ))}
          {/* 白话「整页研读」(design-v22 A2):/<corpus>/:slug/baihua/:chapter,4 段路由不与逐章 :chapter(3 段)冲突 */}
          {['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu'].map((c) => (
            <Route key={`${c}-baihua`} path={`/${c}/:slug/baihua/:chapter`} element={<BaihuaPage corpus={c} />} />
          ))}
          {/* 诸学总门户(v15):左上角 logo 全站可达的公开总入口,列全部分组 */}
          <Route path={MASTER_PORTAL_PATH} element={<MasterPortalPage onSearch={openSearch} />} />
          <Route path="/concepts" element={<ConceptsPage />} />
          <Route path="/mingju" element={<MingjuPage />} />
          <Route path="/debates" element={<DebateListPage />} />
          <Route path="/debates/map" element={<ZhuziTopologyPage />} />
          {/* 旧路径:拓扑图曾独立于 /zhuzi,并入争鸣后保留重定向(已部署过,可能被点过) */}
          <Route path="/zhuzi" element={<Navigate to="/debates/map" replace />} />
          <Route path="/debates/:id" element={<DebatePage />} />
          <Route path="/debates/:id/article" element={<DebateArticlePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/ba" element={<ColophonPage />} />
          <Route path="/legal" element={<LicensePage />} />
          {/* Owner 阅读统计工具(隐藏入口,不挂任一分站导航)。 */}
          <Route path="/admin/stats" element={<AdminStatsPage />} />
          {/* 私人书房「观书」(隐藏入口,不外链,中性外壳):all-in-one 书架 + 书主页放射脑图 + 逐章详读 */}
          <Route path="/books" element={<BooksIndexPage />} />
          <Route path="/books/:slug" element={<BookHomePage />} />
          <Route path="/books/:slug/overview" element={<BookArticlePage kind="overview" />} />
          <Route path="/books/:slug/:chapter" element={<BookArticlePage />} />
          <Route path="*" element={
            <div style={{ textAlign: 'center', paddingTop: '80px' }}>
              <p style={{ color: 'var(--ink-faint)' }}>页面不存在</p>
              <NavLink to="/" className="btn btn--secondary">返回首页</NavLink>
            </div>
          } />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <footer className={`app-footer ${isPortal ? 'app-footer--neutral' : ''}`}>
        {!isPortal && (
          <div className="app-footer__copy">
            <span>观象 · 个人学习站</span>
            <span>本站为个人学习用途，解读内容仅供研习参考 · <NavLink to="/about" className="app-footer__link">关于本站</NavLink></span>
          </div>
        )}
        <button className="colophon-trigger" onClick={openColophon} aria-label="落款" title="落款">
          <span className="colophon-trigger__seal" aria-hidden="true">跋</span>
          <span className="colophon-trigger__label" aria-hidden="true">落款</span>
        </button>
      </footer>
      {!isPortal && <MobileNav module={module} canSwitch={canSwitch} otherSite={otherSite} onPortal={openPortal} onSearch={openSearch} />}
      {searchOpen && (
        <Suspense fallback={null}>
          <GlobalSearchPalette open onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {!isPortal && portalOpen && <ModulePortal current={module.key} group={group} onClose={() => setPortalOpen(false)} />}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsSheet open onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {colophonOpen && (
        <Suspense fallback={null}>
          <Colophon open onClose={() => setColophonOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
