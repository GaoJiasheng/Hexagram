import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { SettingsProvider } from './features/yijing/SettingsContext.jsx'
import ErrorBoundary from './features/ErrorBoundary.jsx'
import { siteForPath, activeGroup, sitesInGroup, HOST_GROUPS, MASTER_PORTAL_PATH } from './sites/registry.js'

// 搜索面板连同其多源索引数据按需加载(v11 §2)
const SearchPalette = lazy(() => import('./features/yijing/components/SearchPalette.jsx'))
// 读经类站(corpus)各自的全站检索面板(C1);分组隔离:只搜本组
const CorpusSearchPalette = lazy(() => import('./features/reader/CorpusSearchPalette.jsx'))
// 道藏检索面板(批D):复用 CorpusSearchPalette,注入 dao 检索函数(单独懒加载,不入主包)
const DaoSearchPalette = lazy(() => import('./features/dao/DaoSearchPalette.jsx'))

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
const CorpusTextPage = lazy(() => import('./features/reader/CorpusTextPage.jsx'))
const CorpusReadPage = lazy(() => import('./features/reader/CorpusReadPage.jsx'))
const MasterPortalPage = lazy(() => import('./features/MasterPortalPage.jsx'))
// 全站设置浮层(Tier 0):任何站 nav 齿轮就地打开(主题/字号/译文 + 数据导出导入)
const SettingsSheet = lazy(() => import('./features/SettingsSheet.jsx'))

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

function Nav({ module, canSwitch, onSearch, onPortal, onSettings }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // '/' key triggers search(仅声明 hasSearch 的站)
  useEffect(() => {
    if (!module.hasSearch) return
    function onKey(e) {
      if (e.key !== '/' || e.isComposing) return  // 输入法组字中按 / 不触发
      const t = e.target
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      e.preventDefault()
      onSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch, module.hasSearch])

  return (
    <nav className={`app-nav ${scrolled ? 'app-nav--scrolled' : ''}`} role="navigation" aria-label="主导航">
      {/* 左上角 logo → 诸学总门户(公开总入口,全站可达;列全部分组) */}
      <NavLink to={MASTER_PORTAL_PATH} className="app-nav__brand" aria-label="诸学门户·全部分组" title="诸学门户 · 全部分组">
        <span className="brand-seal" aria-hidden="true">{module.brand}</span>
      </NavLink>
      <div className="app-nav__links">
        {module.nav.map(({ to, label }) => (
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
        {module.hasSearch && (
          <button
            className="nav-icon-btn"
            onClick={onSearch}
            aria-label="搜索（/）"
            title="搜索（/）"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="5" />
              <line x1="11.5" y1="11.5" x2="16" y2="16" />
            </svg>
          </button>
        )}
        <button className="nav-icon-btn" onClick={onSettings} aria-label="设置" title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z" />
          </svg>
        </button>
        {module.key === 'yijing' && (
          <NavLink
            to="/me"
            className={({ isActive }) => `nav-icon-btn ${isActive ? 'active' : ''}`}
            aria-label="我的"
            style={{ textDecoration: 'none', fontSize: '1.1rem' }}
          >
            ☯
          </NavLink>
        )}
        {canSwitch && (
          <button className="module-switch" onClick={onPortal} aria-label="切换站点" title="切换站点">
            {module.switchLabel} ⇄
          </button>
        )}
      </div>
    </nav>
  )
}

function MobileNav({ module, canSwitch, onPortal }) {
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
        {module.mobileSwitch && canSwitch && (
          <button className="mobile-nav__item" onClick={onPortal} aria-label="切换站点">
            <span className="mobile-nav__icon" aria-hidden="true">⇄</span>
            <span>切换</span>
          </button>
        )}
      </div>
    </div>
  )
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openPortal = useCallback(() => setPortalOpen(true), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const location = useLocation()
  const navigate = useNavigate()

  const module = siteForPath(location.pathname)
  const group = activeGroup(location.pathname, typeof window !== 'undefined' ? window.location.hostname : '')
  const canSwitch = sitesInGroup(group).length > 1
  // 总门户:中立全组枢纽,不套任一分站外壳(无 module nav / 搜索 / 底栏 / 主色偏向)
  const isPortal = location.pathname === MASTER_PORTAL_PATH
  // 搜索面板种类由 registry 派生(缺省 corpus),单一来源,免硬编码站名集漏改
  const searchKind = module.hasSearch ? (module.searchKind || 'corpus') : null

  // 路由切换关闭搜索/切站/设置浮层,避免状态在跨站导航后残留
  useEffect(() => { setSearchOpen(false); setPortalOpen(false); setSettingsOpen(false) }, [location.pathname])

  // 域名着陆(v15 §1):配了 HOST_GROUPS 的域名访问别组路径时,落回本组首页。
  // HOST_GROUPS 为空(dev/主域名)时不触发,按路径分组即可。
  useEffect(() => {
    if (location.pathname === MASTER_PORTAL_PATH) return  // 总门户(中立全组枢纽)豁免域名着陆
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const hostGroup = HOST_GROUPS[host]
    if (hostGroup && module.group !== hostGroup) {
      const dest = sitesInGroup(hostGroup)[0]
      if (dest) navigate(dest.home, { replace: true })
    }
  }, [location.pathname, module.group, navigate])

  return (
    <div className="app-shell" data-site={isPortal ? 'portal' : module.key}>
      {!isPortal && <Nav module={module} canSwitch={canSwitch} onSearch={openSearch} onPortal={openPortal} onSettings={openSettings} />}
      <main className="app-main page-fade-in">
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<div className="route-loading" aria-label="加载中">⋯</div>}>
        <Routes>
          {/* 易经研习 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/hexagrams" element={<HexagramsPage />} />
          <Route path="/hexagram/:id" element={<HexagramDetailPage />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/classics" element={<ClassicsListPage />} />
          <Route path="/classics/:book/:chapter" element={<ClassicsReadPage />} />
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
          <Route path="/dao/:slug/:chapter" element={<DaoReadPage />} />
          {/* 释典 / 儒典(v15:经文阅读路由待内容期接 ClassicReader) */}
          <Route path="/fo" element={<FoHomePage />} />
          <Route path="/fo/:slug" element={<CorpusTextPage corpus="fo" />} />
          <Route path="/fo/:slug/:chapter" element={<CorpusReadPage corpus="fo" />} />
          <Route path="/ru" element={<RuHomePage />} />
          <Route path="/ru/:slug" element={<CorpusTextPage corpus="ru" />} />
          <Route path="/ru/:slug/:chapter" element={<CorpusReadPage corpus="ru" />} />
          <Route path="/xin" element={<XinHomePage />} />
          <Route path="/xin/:slug" element={<CorpusTextPage corpus="xin" />} />
          <Route path="/xin/:slug/:chapter" element={<CorpusReadPage corpus="xin" />} />
          <Route path="/fa" element={<FaHomePage />} />
          <Route path="/fa/:slug" element={<CorpusTextPage corpus="fa" />} />
          <Route path="/fa/:slug/:chapter" element={<CorpusReadPage corpus="fa" />} />
          <Route path="/mo" element={<MoHomePage />} />
          <Route path="/mo/:slug" element={<CorpusTextPage corpus="mo" />} />
          <Route path="/mo/:slug/:chapter" element={<CorpusReadPage corpus="mo" />} />
          <Route path="/bing" element={<BingHomePage />} />
          <Route path="/bing/:slug" element={<CorpusTextPage corpus="bing" />} />
          <Route path="/bing/:slug/:chapter" element={<CorpusReadPage corpus="bing" />} />
          <Route path="/zong" element={<ZongHomePage />} />
          <Route path="/zong/:slug" element={<CorpusTextPage corpus="zong" />} />
          <Route path="/zong/:slug/:chapter" element={<CorpusReadPage corpus="zong" />} />
          <Route path="/zhongyi" element={<ZhongyiHomePage />} />
          <Route path="/zhongyi/:slug" element={<CorpusTextPage corpus="zhongyi" />} />
          <Route path="/zhongyi/:slug/:chapter" element={<CorpusReadPage corpus="zhongyi" />} />
          <Route path="/moulue" element={<MoulueHomePage />} />
          <Route path="/moulue/:slug" element={<CorpusTextPage corpus="moulue" />} />
          <Route path="/moulue/:slug/:chapter" element={<CorpusReadPage corpus="moulue" />} />
          {/* 诸学总门户(v15):左上角 logo 全站可达的公开总入口,列全部分组 */}
          <Route path={MASTER_PORTAL_PATH} element={<MasterPortalPage />} />
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
      {!isPortal && (
        <footer className="app-footer">
          <span>观象 · 个人学习站</span>
          <span>本站为个人学习用途，解读内容仅供研习参考</span>
        </footer>
      )}
      {!isPortal && <MobileNav module={module} canSwitch={canSwitch} onPortal={openPortal} />}
      {!isPortal && searchOpen && searchKind === 'yijing' && (
        <Suspense fallback={null}>
          <SearchPalette open onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {!isPortal && searchOpen && searchKind === 'corpus' && (
        <Suspense fallback={null}>
          <CorpusSearchPalette corpus={module.key} open onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {!isPortal && searchOpen && searchKind === 'dao' && (
        <Suspense fallback={null}>
          <DaoSearchPalette open onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      {!isPortal && portalOpen && <ModulePortal current={module.key} group={group} onClose={() => setPortalOpen(false)} />}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsSheet open onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </BrowserRouter>
  )
}
