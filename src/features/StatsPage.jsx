import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { getReadDays, getReadRecent } from './yijing/storage.js'
import { useAuth } from './auth/AuthContext.jsx'
import { useSettings } from './yijing/SettingsContext.jsx'
import { computeStats, fmtSec, WINDOWS } from './reading/readStats.js'
import ReadHeatmap from './reading/ReadHeatmap.jsx'

// 研读统计(2026-10-01,docs/reading-stats-plan.md §7.2):四档切换 → 四个数字格 → 近一年热力 → 常读的书 → 最近看过。
// 全部从本机 readDays / readRecent 算(登录后 readDays 随云同步跨设备合并),不向服务端另发请求。
// 中立外壳(isNeutralPath 含 /stats),各组 /me 与设置浮层的「查看详情」都指到这里。
export const READ_STATS_NOTE = '只收集阅读时长(读了哪本书哪一章、读了多久),用于网站优化。'

function timeLabel(ms) {
  const d = new Date(ms)
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${hm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

export function StatsBody({ stats, win, setWin, showRecent = true }) {
  const w = stats.windows[win]
  const maxBook = w.top[0]?.sec || 1
  return (
    <>
      <div className="seg-control read-stats__seg" role="tablist" aria-label="时间范围">
        {WINDOWS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={win === id} className={`seg-btn ${win === id ? 'seg-btn--active' : ''}`} onClick={() => setWin(id)}>{label}</button>
        ))}
      </div>
      <div className="read-stats__grid">
        <div className="read-stats__cell"><strong>{fmtSec(w.sec)}</strong><span>阅读时长</span></div>
        <div className="read-stats__cell"><strong>{w.n}</strong><span>次</span></div>
        <div className="read-stats__cell"><strong>{w.n ? fmtSec(w.avg) : '—'}</strong><span>平均每次</span></div>
        <div className="read-stats__cell"><strong>{w.books} <small>部</small> {w.chapters} <small>章</small></strong><span>读过</span></div>
      </div>
      <section className="read-stats__section">
        <h2 className="read-stats__title">近一年</h2>
        <ReadHeatmap heat={stats.heat} />
      </section>
      <section className="read-stats__section">
        <h2 className="read-stats__title">常读的书 · {w.label}</h2>
        {w.top.length === 0 ? <p className="text-faint read-stats__empty">这段时间还没有读经记录。</p> : (
          <ol className="read-stats__books">
            {w.top.map((b) => (
              <li key={`${b.corpus}/${b.slug}`}>
                <div className="read-stats__book-line">
                  {b.href ? <Link to={b.href}>{b.title}</Link> : <span>{b.title}</span>}
                  <span className="read-stats__book-sec">{fmtSec(b.sec)}</span>
                </div>
                <span className="read-stats__track" aria-hidden="true"><span className="read-stats__bar" style={{ width: `${Math.max(2, Math.round((b.sec / maxBook) * 100))}%` }} /></span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {showRecent && (
        <section className="read-stats__section">
          <h2 className="read-stats__title">最近看过</h2>
          {stats.recent.length === 0 ? <p className="text-faint read-stats__empty">还没有记录。打开任何一章读上一会儿,这里就会出现。</p> : (
            <div className="corpus-me__list">
              {stats.recent.slice(0, 30).map((r) => (
                <Link key={r.id} to={r.href || '/'} className="corpus-me__row read-stats__recent">
                  <span className="corpus-me__book">{r.title}{r.ch ? ` · 第 ${r.ch} ${r.unit}` : ''}</span>
                  <span className="corpus-me__meta">{timeLabel(r.t)} · {fmtSec(r.sec)} →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

export default function StatsPage() {
  usePageTitle('研读统计')
  const { user } = useAuth()
  const { settings } = useSettings()
  const [win, setWin] = useState('d7')
  const stats = useMemo(() => computeStats(getReadDays(), getReadRecent()), [])
  const shared = user && settings.shareReading !== false
  return (
    <div className="page-content read-stats">
      <div className="basics-breadcrumb">
        <Link to="/" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">研读统计</h1>
        <p className="page-subtitle text-soft">
          {user ? (shared ? '已登录:阅读时长随云同步跨设备合并。' : '已登录,但「计入账号」已关:只统计本机的记录。') : '未登录:只统计本浏览器的记录;登录后可跨设备合并。'}
        </p>
      </div>
      <StatsBody stats={stats} win={win} setWin={setWin} />
      <p className="read-stats__note text-faint">{READ_STATS_NOTE}可在设置里关闭「把我的研读时长计入账号」,关闭后只留在本机。</p>
    </div>
  )
}
