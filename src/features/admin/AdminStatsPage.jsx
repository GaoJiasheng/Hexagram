import { useEffect, useState } from 'react'
import { SITES } from '../../sites/registry.js'
import daoTexts from '../../data/dao/texts.json'
import foTexts from '../../data/fo/texts.json'
import ruTexts from '../../data/ru/texts.json'
import xinTexts from '../../data/xin/texts.json'
import faTexts from '../../data/fa/texts.json'
import moTexts from '../../data/mo/texts.json'
import bingTexts from '../../data/bing/texts.json'
import zongTexts from '../../data/zong/texts.json'
import zhongyiTexts from '../../data/zhongyi/texts.json'
import moulueTexts from '../../data/moulue/texts.json'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'

const PASSPHRASE_KEY = 'guanxiang.admin.passphrase'
const STATS_URL = '/api/admin/stats'
const ADMIN_HEADER = 'X-Admin-Passphrase'

const SITE_BY_KEY = Object.fromEntries(SITES.map((site) => [site.key, site]))
// 后台只需书名与章节单位；直接读轻量 texts.json，避免为 Top 10 连带加载
// reader/booksIndex 依赖的整套注疏与延伸语料。
const BOOK_BY_SLUG = new Map([
  ...daoTexts,
  ...foTexts,
  ...ruTexts,
  ...xinTexts,
  ...faTexts,
  ...moTexts,
  ...bingTexts,
  ...zongTexts,
  ...zhongyiTexts,
  ...moulueTexts,
].map((book) => [book.slug, book]))
const YIJING_CLASSICS = {
  'xici-shang': '系辞上传',
  'xici-xia': '系辞下传',
  shuogua: '说卦传',
  xugua: '序卦传',
  zagua: '杂卦传',
}
const NUMBER = new Intl.NumberFormat('zh-CN')

function readPassphrase() {
  try {
    return sessionStorage.getItem(PASSPHRASE_KEY) || ''
  } catch {
    return ''
  }
}

function storePassphrase(value) {
  try {
    sessionStorage.setItem(PASSPHRASE_KEY, value)
  } catch { /* Storage can be unavailable; the in-memory credential still works. */ }
}

function forgetPassphrase() {
  try {
    sessionStorage.removeItem(PASSPHRASE_KEY)
  } catch { /* No persisted credential to clear. */ }
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function normalizeStats(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid stats response')

  return {
    totalEvents: safeNumber(raw.totalEvents),
    dailyCounts: Array.isArray(raw.dailyCounts)
      ? raw.dailyCounts
        .filter((row) => row && typeof row.date === 'string')
        .map((row) => ({ date: row.date, count: safeNumber(row.count) }))
      : [],
    corpusHeat: Array.isArray(raw.corpusHeat)
      ? raw.corpusHeat
        .filter((row) => row && typeof row.corpus === 'string')
        .map((row) => ({ corpus: row.corpus, count: safeNumber(row.count) }))
      : [],
    topChapters: Array.isArray(raw.topChapters)
      ? raw.topChapters
        .filter((row) => row && row.corpus != null && row.slug != null && row.chapter != null)
        .map((row) => ({
          corpus: String(row.corpus),
          slug: String(row.slug),
          chapter: String(row.chapter),
          count: safeNumber(row.count),
        }))
      : [],
    avgDwellMs: safeNumber(raw.avgDwellMs),
  }
}

function shortDate(date) {
  const parts = date.split('-')
  return parts.length === 3 ? `${parts[1]}.${parts[2]}` : date
}

function niceCeiling(value) {
  if (value <= 1) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

function DailyChart({ rows }) {
  const hasData = rows.some((row) => row.count > 0)
  if (!hasData) return <EmptyState label="最近七日暂无数据" />

  const width = 680
  const height = 230
  const pad = { top: 28, right: 22, bottom: 42, left: 44 }
  const chartWidth = width - pad.left - pad.right
  const chartHeight = height - pad.top - pad.bottom
  const ceiling = niceCeiling(Math.max(...rows.map((row) => row.count)))
  const point = (row, index) => ({
    x: rows.length === 1
      ? pad.left + chartWidth / 2
      : pad.left + (chartWidth * index) / (rows.length - 1),
    y: pad.top + chartHeight * (1 - row.count / ceiling),
  })
  const points = rows.map(point)
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const area = `M ${points[0].x} ${pad.top + chartHeight} L ${points.map(({ x, y }) => `${x} ${y}`).join(' L ')} L ${points.at(-1).x} ${pad.top + chartHeight} Z`
  const ticks = ceiling > 1 ? [0, 0.5, 1] : [0, 1]

  return (
    <svg className="admin-chart admin-daily-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近七日阅读事件折线图">
      <title>最近七日阅读事件</title>
      <defs>
        <linearGradient id="admin-daily-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cinnabar-pure)', stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: 'var(--cinnabar-pure)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = pad.top + chartHeight * (1 - tick)
        return (
          <g key={tick}>
            <line className="admin-chart__grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
            <text className="admin-chart__axis" x={pad.left - 10} y={y + 4} textAnchor="end">{Math.round(ceiling * tick)}</text>
          </g>
        )
      })}
      <path d={area} fill="url(#admin-daily-fill)" />
      <polyline className="admin-daily-chart__line" points={line} />
      {rows.map((row, index) => {
        const { x, y } = points[index]
        return (
          <g key={`${row.date}-${index}`}>
            <title>{`${row.date}: ${row.count} 次`}</title>
            <circle className="admin-daily-chart__dot" cx={x} cy={y} r="4" />
            <text className="admin-daily-chart__value" x={x} y={Math.max(14, y - 10)} textAnchor="middle">{row.count}</text>
            <text className="admin-chart__axis" x={x} y={height - 14} textAnchor="middle">{shortDate(row.date)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function corpusLabel(corpus) {
  if (corpus === 'other') return '其他'
  const title = SITE_BY_KEY[corpus]?.portalTitle
  return title ? title.replace(/(研读|研习)$/, '') : corpus
}

function corpusColor(corpus) {
  if (corpus === 'other') return 'var(--ink-faint)'
  const accent = SITE_BY_KEY[corpus]?.accent
  if (!accent) return 'var(--ink-soft)'
  // portal 外壳会把 --cinnabar 调成中性灰；热度榜里的易经仍应显示注册表所指的真朱色。
  return accent === 'cinnabar' ? 'var(--cinnabar-pure)' : `var(--${accent})`
}

function CorpusHeatChart({ rows }) {
  const visible = rows.filter((row) => row.count > 0)
  if (!visible.length) return <EmptyState label="暂无分组数据" />

  const width = 680
  const rowHeight = 36
  const height = visible.length * rowHeight + 8
  const barX = 96
  const barWidth = 510
  const maximum = Math.max(...visible.map((row) => row.count), 1)

  return (
    <svg className="admin-chart admin-heat-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各分组阅读事件横向条形图">
      <title>分组热度榜</title>
      {visible.map((row, index) => {
        const y = index * rowHeight + 7
        const valueWidth = Math.max(2, (barWidth * row.count) / maximum)
        const label = corpusLabel(row.corpus)
        return (
          <g key={row.corpus}>
            <title>{`${label}: ${row.count} 次`}</title>
            <text className="admin-heat-chart__label" x="0" y={y + 15}>{label}</text>
            <rect className="admin-heat-chart__track" x={barX} y={y + 3} width={barWidth} height="12" rx="6" />
            <rect x={barX} y={y + 3} width={valueWidth} height="12" rx="6" style={{ fill: corpusColor(row.corpus) }} />
            <text className="admin-heat-chart__count" x={width - 2} y={y + 15} textAnchor="end">{NUMBER.format(row.count)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function topChapterLabel(row) {
  if (row.corpus === 'yijing') {
    if (row.slug === 'hexagrams') return { book: '易经', chapter: `第${row.chapter}卦` }
    return { book: YIJING_CLASSICS[row.slug] || row.slug, chapter: `第${row.chapter}章` }
  }

  const book = BOOK_BY_SLUG.get(row.slug)
  return {
    book: book?.title || row.slug,
    chapter: `第${row.chapter}${book?.sectionUnit || '章'}`,
  }
}

function TopChapters({ rows }) {
  const visible = rows.filter((row) => row.count > 0).slice(0, 10)
  if (!visible.length) return <EmptyState label="暂无读经章节数据" />

  const maximum = Math.max(...visible.map((row) => row.count), 1)
  return (
    <ol className="admin-top-list">
      {visible.map((row, index) => {
        const label = topChapterLabel(row)
        return (
          <li className="admin-top-list__item" key={`${row.corpus}-${row.slug}-${row.chapter}`}>
            <span className="admin-top-list__rank">{String(index + 1).padStart(2, '0')}</span>
            <div className="admin-top-list__body">
              <div className="admin-top-list__line">
                <span><strong>{label.book}</strong><span className="admin-top-list__chapter"> / {label.chapter}</span></span>
                <span className="admin-top-list__count">{NUMBER.format(row.count)} 次</span>
              </div>
              <span className="admin-top-list__track" aria-hidden="true">
                <span
                  className="admin-top-list__bar"
                  style={{ width: `${Math.max(2, (row.count / maximum) * 100)}%`, background: corpusColor(row.corpus) }}
                />
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function formatDwell(milliseconds) {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分`
}

function EmptyState({ label = '暂无数据' }) {
  return <div className="admin-stats__empty">{label}</div>
}

function PassphraseForm({ draft, error, onChange, onSubmit }) {
  return (
    <div className="admin-auth-card">
      <span className="admin-auth-card__seal" aria-hidden="true">统</span>
      <h1>阅读统计</h1>
      <p>此页仅供站点维护者使用，请输入临时访问口令。</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="admin-passphrase">访问口令</label>
        <input
          id="admin-passphrase"
          name="passphrase"
          type="password"
          value={draft}
          onChange={onChange}
          autoComplete="current-password"
          autoFocus
          required
        />
        {error && <p className="admin-auth-card__error" role="alert">{error}</p>}
        <button className="btn admin-stats__primary" type="submit">进入统计页</button>
      </form>
      <small>口令仅保存在当前标签页的会话存储中，关闭后失效。</small>
    </div>
  )
}

export default function AdminStatsPage() {
  const [credential, setCredential] = useState(readPassphrase)
  const [draft, setDraft] = useState('')
  const [formError, setFormError] = useState('')
  const [status, setStatus] = useState(credential ? 'loading' : 'locked')
  const [stats, setStats] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  usePageTitle('阅读统计后台')

  useEffect(() => {
    if (!credential) return undefined

    const controller = new AbortController()
    setStatus('loading')

    async function loadStats() {
      try {
        const response = await fetch(STATS_URL, {
          method: 'GET',
          headers: { [ADMIN_HEADER]: credential },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          forgetPassphrase()
          setCredential('')
          setDraft('')
          setStats(null)
          setFormError('访问被拒绝')
          setStatus('locked')
          return
        }
        if (!response.ok) throw new Error(`stats request failed: ${response.status}`)

        const data = normalizeStats(await response.json())
        setStats(data)
        setStatus('ready')
      } catch (error) {
        if (error.name !== 'AbortError') setStatus('error')
      }
    }

    loadStats()
    return () => controller.abort()
  }, [credential, retryKey])

  function submitPassphrase(event) {
    event.preventDefault()
    if (!draft) return
    setFormError('')
    storePassphrase(draft)
    setCredential(draft)
    setStatus('loading')
  }

  function lockPage() {
    forgetPassphrase()
    setCredential('')
    setDraft('')
    setStats(null)
    setFormError('')
    setStatus('locked')
  }

  if (!credential) {
    return (
      <div className="admin-stats-page admin-stats-page--locked">
        <PassphraseForm
          draft={draft}
          error={formError}
          onChange={(event) => { setDraft(event.target.value); setFormError('') }}
          onSubmit={submitPassphrase}
        />
      </div>
    )
  }

  return (
    <div className="admin-stats-page">
      <header className="admin-stats__header">
        <div>
          <p className="admin-stats__eyebrow">观象 · 站点工具</p>
          <h1>阅读统计</h1>
          <p>匿名阅读事件的实时汇总，日期统一按 UTC 计算。</p>
        </div>
        <button className="btn btn--secondary admin-stats__lock" type="button" onClick={lockPage}>退出</button>
      </header>

      {status === 'loading' && <div className="admin-stats__message">正在读取统计…</div>}

      {status === 'error' && (
        <div className="admin-stats__message admin-stats__message--error" role="alert">
          <p>统计数据读取失败，请稍后重试。</p>
          <div>
            <button className="btn admin-stats__primary" type="button" onClick={() => setRetryKey((key) => key + 1)}>重试</button>
            <button className="btn btn--secondary" type="button" onClick={lockPage}>重新输入口令</button>
          </div>
        </div>
      )}

      {status === 'ready' && stats && (
        <>
          <div className="admin-stats__summary">
            累计 <strong>{NUMBER.format(stats.totalEvents)}</strong> 条阅读事件
          </div>

          <div className="admin-stats__grid">
            <section className="admin-stat-card admin-stat-card--wide">
              <div className="admin-stat-card__head">
                <h2>七日曲线</h2>
                <span>事件数 / 日</span>
              </div>
              <DailyChart rows={stats.dailyCounts} />
            </section>

            <section className="admin-stat-card admin-stat-card--wide">
              <div className="admin-stat-card__head">
                <h2>分组热度榜</h2>
                <span>全部事件</span>
              </div>
              <CorpusHeatChart rows={stats.corpusHeat} />
            </section>

            <section className="admin-stat-card admin-stat-card--wide">
              <div className="admin-stat-card__head">
                <h2>书 / 章 Top 10</h2>
                <span>仅含读经页面</span>
              </div>
              <TopChapters rows={stats.topChapters} />
            </section>

            <section className="admin-stat-card admin-stat-card--dwell">
              <div className="admin-stat-card__head">
                <h2>平均停留</h2>
                <span>每条阅读事件</span>
              </div>
              {stats.totalEvents > 0 ? (
                <div className="admin-dwell">
                  <strong>{formatDwell(stats.avgDwellMs)}</strong>
                  <span>{NUMBER.format(Math.round(stats.avgDwellMs))} ms</span>
                </div>
              ) : <EmptyState />}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
