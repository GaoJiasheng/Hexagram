import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { SettingsProvider } from './features/yijing/SettingsContext.jsx'
import SearchPalette from './features/yijing/components/SearchPalette.jsx'

// Pages
import HomePage from './features/yijing/pages/HomePage.jsx'
import HexagramsPage from './features/yijing/pages/HexagramsPage.jsx'
import HexagramDetailPage from './features/yijing/pages/HexagramDetailPage.jsx'
import WorkbenchPage from './features/yijing/pages/WorkbenchPage.jsx'
import ClassicsListPage from './features/yijing/pages/ClassicsListPage.jsx'
import ClassicsReadPage from './features/yijing/pages/ClassicsReadPage.jsx'
import BasicsPage from './features/yijing/pages/BasicsPage.jsx'
import MePage from './features/yijing/pages/MePage.jsx'

const NAV_LINKS = [
  { to: '/hexagrams', label: '六十四卦' },
  { to: '/workbench', label: '推演' },
  { to: '/classics', label: '经传' },
  { to: '/basics', label: '基础' },
]

const MOBILE_NAV = [
  { to: '/', label: '首页', icon: '☰', exact: true },
  { to: '/hexagrams', label: '卦', icon: '☵' },
  { to: '/workbench', label: '推演', icon: '☲' },
  { to: '/classics', label: '经传', icon: '☷' },
  { to: '/me', label: '我的', icon: '☶' },
]

function Nav({ onSearch }) {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // '/' key triggers search
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        onSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch])

  return (
    <nav className={`app-nav ${scrolled ? 'app-nav--scrolled' : ''}`} role="navigation" aria-label="主导航">
      <NavLink to="/" className="app-nav__brand" aria-label="观象·回首页">
        <span className="brand-seal" aria-hidden="true">观象</span>
      </NavLink>
      <div className="app-nav__links">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
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
      </div>
    </nav>
  )
}

function MobileNav() {
  const location = useLocation()
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
  const openSearch = useCallback(() => setSearchOpen(true), [])

  return (
    <div className="app-shell">
      <Nav onSearch={openSearch} />
      <main className="app-main page-fade-in">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hexagrams" element={<HexagramsPage />} />
          <Route path="/hexagram/:id" element={<HexagramDetailPage />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/classics" element={<ClassicsListPage />} />
          <Route path="/classics/:book/:chapter" element={<ClassicsReadPage />} />
          <Route path="/basics" element={<BasicsPage />} />
          <Route path="/me" element={<MePage />} />
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
      <MobileNav />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
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
