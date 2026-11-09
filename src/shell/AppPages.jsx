import { Link } from 'react-router-dom'
import { usePageTitle } from '../features/yijing/hooks/usePageTitle.js'
import { useAuth } from '../features/auth/AuthContext.jsx'
import SchoolAvatar from '../features/auth/SchoolAvatar.jsx'
import PortalStudyTrail from '../features/reader/PortalStudyTrail.jsx'
import { agoLabel, recentBooks } from './recent.js'

// App 外壳固定导航的三个落点页(docs/ipad-app-plan.md §4.1 ①):接着读 / 索引 / 我的。
// 都是「把已有的页面收拢成一个入口」,不新造内容;网页端这些入口仍散在首页与页脚,不走这里。
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

function Row({ to, onClick, tag, title, sub }) {
  const body = (
    <>
      {tag && <span className="daodu-entry__tag">{tag}</span>}
      <span className="daodu-entry__text">
        <span className="daodu-entry__title">{title}</span>
        {sub && <span className="daodu-entry__sub">{sub}</span>}
      </span>
      <span className="daodu-entry__go" aria-hidden="true">›</span>
    </>
  )
  return to
    ? <Link to={to} className="daodu-entry app-page__row">{body}</Link>
    : <button type="button" className="daodu-entry app-page__row" onClick={onClick}>{body}</button>
}

export function ContinuePage() {
  usePageTitle('接着读')
  const recent = recentBooks(12)
  return (
    <div className="app-page">
      <div className="page-header">
        <h1 className="page-title">接着读</h1>
        <p className="page-subtitle">最近读过的书,点一下回到上次停下的地方。</p>
      </div>
      {recent.length === 0 ? (
        <p className="app-page__empty">还没有读过的书。<Link to="/">去书房挑一本 →</Link></p>
      ) : (
        <div className="app-page__list">
          {recent.map((r) => (
            <Row key={r.book.slug} to={r.href} tag={r.site} title={r.book.title}
              sub={`第 ${r.ch} ${r.book.sectionUnit || '章'}${r.seg ? ` · 第 ${r.seg + 1} 段` : ''}${r.t ? ` · ${agoLabel(r.t)}` : ''}`} />
          ))}
        </div>
      )}
      {/* 收藏与批注:沿用门户「我的研读」那一段(它自己判空) */}
      <PortalStudyTrail />
    </div>
  )
}

export function IndexPage() {
  usePageTitle('索引')
  return (
    <div className="app-page">
      <div className="page-header">
        <h1 className="page-title">索引</h1>
        <p className="page-subtitle">横着穿过各组典籍的几条线。</p>
      </div>
      <div className="app-page__list">
        <Row to="/mingju" tag="名句" title="名句集" sub="全站典籍名句,每句点得回原文那一章" />
        <Row to="/renwu" tag="人物" title="人物志" sub="各书撰人与书中人物,一人一条" />
        <Row to="/timeline" tag="年代" title="时间轴" sub="典籍成书与人物生卒,按朝代排开" />
        <Row to="/concepts" tag="义理" title="义理专题" sub="同一个概念,在各家典籍里各落在哪一章" />
        <Row to="/debates" tag="争鸣" title="百家争鸣" sub="诸家就同一题目的对辩,每句锚原文" />
        <Row to="/rhyme" tag="韵书" title="韵书" sub="平水韵与词林正韵" />
      </div>
    </div>
  )
}

const openSettings = () => window.dispatchEvent(new CustomEvent('gx:open-settings'))

export function MePage() {
  usePageTitle('我的')
  const { user, enabled, openAuth } = useAuth()
  return (
    <div className="app-page">
      <div className="page-header">
        <h1 className="page-title">我的</h1>
      </div>
      <div className="app-page__list">
        {enabled && (user ? (
          <button type="button" className="daodu-entry app-page__row app-page__account" onClick={openSettings}>
            <SchoolAvatar seed={user.avatarSeed} size={40} />
            <span className="daodu-entry__text">
              <span className="daodu-entry__title">{user.displayName}</span>
              <span className="daodu-entry__sub">{user.email} · 账号、云同步与头像</span>
            </span>
            <span className="daodu-entry__go" aria-hidden="true">›</span>
          </button>
        ) : (
          <Row onClick={() => openAuth('login')} tag="账号" title="登录 / 注册" sub="登录后足迹云同步,可发评论;不登录也能读全部内容" />
        ))}
        <Row to="/app/continue" tag="足迹" title="接着读" sub="最近读过的书、收藏与批注" />
        <Row to="/stats" tag="统计" title="研读统计" sub="读了多久、读了哪些书(数据只在本机与你的账号)" />
        <Row onClick={openSettings} tag="设置" title="设置" sub="主题、字号、正文字体、译文显示、数据导出导入" />
      </div>
      <div className="app-page__list">
        <Row to="/ba" tag="跋" title="跋 · 落款" sub="这个站是怎么来的" />
        <Row to="/about" tag="凡例" title="关于本站" sub="底本、编写说明与声明" />
        <Row to="/privacy" tag="隐私" title="隐私说明" />
        <Row to="/legal" tag="许可" title="开源许可" />
      </div>
      {appVersion && <p className="app-page__version">观象 {appVersion} · 本站为个人学习用途,解读内容仅供研习参考</p>}
    </div>
  )
}
