import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { SettingsProvider } from './features/yijing/SettingsContext.jsx'
import SearchPalette from './features/yijing/components/SearchPalette.jsx'

// Pages — 易经研习模块
import HomePage from './features/yijing/pages/HomePage.jsx'
import HexagramsPage from './features/yijing/pages/HexagramsPage.jsx'
import HexagramDetailPage from './features/yijing/pages/HexagramDetailPage.jsx'
import WorkbenchPage from './features/yijing/pages/WorkbenchPage.jsx'
import ClassicsListPage from './features/yijing/pages/ClassicsListPage.jsx'
import ClassicsReadPage from './features/yijing/pages/ClassicsReadPage.jsx'
import BasicsPage from './features/yijing/pages/BasicsPage.jsx'
import YinYangPage from './features/yijing/pages/YinYangPage.jsx'
import HetuLuoshuPage from './features/yijing/pages/HetuLuoshuPage.jsx'
import XiaoxiPage from './features/yijing/pages/XiaoxiPage.jsx'
import ShicaoPage from './features/yijing/pages/ShicaoPage.jsx'
import MeihuaBasicsPage from './features/yijing/pages/MeihuaBasicsPage.jsx'
import JinqianBasicsPage from './features/yijing/pages/JinqianBasicsPage.jsx'
import YuanliuPage from './features/yijing/pages/YuanliuPage.jsx'
import ShiliListPage from './features/yijing/pages/ShiliListPage.jsx'
import ShiliDetailPage from './features/yijing/pages/ShiliDetailPage.jsx'
import GlossaryPage from './features/yijing/pages/GlossaryPage.jsx'
import MePage from './features/yijing/pages/MePage.jsx'
// Pages — 道藏研读模块
import DaoHomePage from './features/dao/pages/DaoHomePage.jsx'
import DaoTextPage from './features/dao/pages/DaoTextPage.jsx'
import DaoReadPage from './features/dao/pages/DaoReadPage.jsx'

// 模块注册(v4 §3):唯一切换点是门户,模块间不互链
const MODULES = {
  yijing: {
    key: 'yijing',
    brand: '观象',
    portalTitle: '易经研习',
    portalDesc: '六十四卦 · 推演工作台 · 经传 · 学堂',
    home: '/',
    nav: [
      { to: '/hexagrams', label: '六十四卦' },
      { to: '/workbench', label: '推演' },
      { to: '/classics', label: '经传' },
      { to: '/basics', label: '学堂' },
    ],
  },
  dao: {
    key: 'dao',
    brand: '观道',
    portalTitle: '道藏研读',
    portalDesc: '道德经 · 南华 · 丹道诸经（整理中）',
    home: '/dao',
    nav: [
      { to: '/dao', label: '经典' },
    ],
  },
}

const MOBILE_NAV = [
  { to: '/', label: '首页', icon: '☰', exact: true },
  { to: '/hexagrams', label: '卦', icon: '☵' },
  { to: '/workbench', label: '推演', icon: '☲' },
  { to: '/classics', label: '经传', icon: '☷' },
  { to: '/me', label: '我的', icon: '☶' },
]

// 整屏门户 — 「网站之间切换」的体感(v4 §3.2)
function ModulePortal({ current, onClose }) {
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
          {Object.values(MODULES).map(m => (
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

function Nav({ module, onSearch, onPortal }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // '/' key triggers search(仅易经模块)
  useEffect(() => {
    if (module.key !== 'yijing') return
    function onKey(e) {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        onSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch, module.key])

  return (
    <nav className={`app-nav ${scrolled ? 'app-nav--scrolled' : ''}`} role="navigation" aria-label="主导航">
      <NavLink to={module.home} className="app-nav__brand" aria-label={`${module.portalTitle}·回首页`}>
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
        {module.key === 'yijing' && (
          <>
            <button
              className="nav-icon-btn"
              onClick={onSearch}
              aria-label="搜索（/）"
              title="搜索（/）"
            >
              ◌
            </button>
            <NavLink
              to="/me"
              className={({ isActive }) => `nav-icon-btn ${isActive ? 'active' : ''}`}
              aria-label="我的"
              style={{ textDecoration: 'none', fontSize: '1.1rem' }}
            >
              ☯
            </NavLink>
          </>
        )}
        <button className="module-switch" onClick={onPortal} aria-label="切换站点" title="切换站点">
          {module.key === 'yijing' ? '易' : '道'} ⇄
        </button>
      </div>
    </nav>
  )
}

function MobileNav({ module, onPortal }) {
  const location = useLocation()

  if (module.key === 'dao') {
    return (
      <div className="mobile-nav" role="navigation" aria-label="底部导航">
        <div className="mobile-nav__inner">
          <NavLink to="/dao" className={`mobile-nav__item ${location.pathname.startsWith('/dao') ? 'active' : ''}`} aria-label="经典">
            <span className="mobile-nav__icon" aria-hidden="true">☱</span>
            <span>经典</span>
          </NavLink>
          <button className="mobile-nav__item" onClick={onPortal} aria-label="切换站点">
            <span className="mobile-nav__icon" aria-hidden="true">⇄</span>
            <span>切换</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-nav" role="navigation" aria-label="底部导航">
      <div className="mobile-nav__inner">
        {MOBILE_NAV.map(({ to, label, icon, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
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
      </div>
    </div>
  )
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const openPortal = useCallback(() => setPortalOpen(true), [])
  const location = useLocation()

  const module = location.pathname.startsWith('/dao') ? MODULES.dao : MODULES.yijing

  return (
    <div className={`app-shell ${module.key === 'dao' ? 'app-shell--dao' : ''}`}>
      <Nav module={module} onSearch={openSearch} onPortal={openPortal} />
      <main className="app-main page-fade-in">
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
          <Route path="/basics/glossary" element={<GlossaryPage />} />
          <Route path="/me" element={<MePage />} />
          {/* 道藏研读 */}
          <Route path="/dao" element={<DaoHomePage />} />
          <Route path="/dao/:slug" element={<DaoTextPage />} />
          <Route path="/dao/:slug/:chapter" element={<DaoReadPage />} />
          <Route path="*" element={
            <div style={{ textAlign: 'center', paddingTop: '80px' }}>
              <p style={{ color: 'var(--ink-faint)' }}>页面不存在</p>
              <NavLink to="/" className="btn btn--secondary">返回首页</NavLink>
            </div>
          } />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>观象 · 个人易学研习</span>
        <span>本站为个人学习用途，解读内容仅供研习参考</span>
      </footer>
      <MobileNav module={module} onPortal={openPortal} />
      {module.key === 'yijing' && <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {portalOpen && <ModulePortal current={module.key} onClose={() => setPortalOpen(false)} />}
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
