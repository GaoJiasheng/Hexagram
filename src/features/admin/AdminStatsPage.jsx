import { useEffect, useRef, useState } from 'react'
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
import { useAuth } from '../auth/AuthContext.jsx'
import { commentPageUrl } from '../comments/commentPageUrl.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'

const PASSPHRASE_KEY = 'guanxiang.admin.passphrase'
const STATS_URL = '/api/admin/stats'
const COMMENTS_URL = '/api/admin/comments'
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
const COMMENT_DATE = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// 国家/地区代码转中文名——只覆盖高频访客来源，其余回退显示原始 ISO 代码。
const COUNTRY_NAMES = {
  CN: '中国大陆', HK: '中国香港', TW: '中国台湾', MO: '中国澳门',
  US: '美国', CA: '加拿大', GB: '英国', DE: '德国', FR: '法国',
  JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚', AU: '澳大利亚',
  NZ: '新西兰', NL: '荷兰', CH: '瑞士', SE: '瑞典', IN: '印度',
  BR: '巴西', RU: '俄罗斯', AE: '阿联酋', TH: '泰国', VN: '越南',
  PH: '菲律宾', ID: '印度尼西亚',
}
function countryLabel(code) {
  return COUNTRY_NAMES[code] || code
}

// Cloudflare 的 cf.region 对中国大陆给的是英文省级行政区名——转中文展示；
// 匹配不到（含空值，即无法定位到省级）统一归为「其他/未知地区」。
const CHINA_PROVINCE_NAMES = {
  Beijing: '北京', Shanghai: '上海', Tianjin: '天津', Chongqing: '重庆',
  Hebei: '河北', Shanxi: '山西', 'Nei Mongol': '内蒙古', 'Inner Mongolia': '内蒙古',
  Liaoning: '辽宁', Jilin: '吉林', Heilongjiang: '黑龙江',
  Jiangsu: '江苏', Zhejiang: '浙江', Anhui: '安徽', Fujian: '福建', Jiangxi: '江西',
  Shandong: '山东', Henan: '河南', Hubei: '湖北', Hunan: '湖南',
  Guangdong: '广东', Guangxi: '广西', Hainan: '海南',
  Sichuan: '四川', Guizhou: '贵州', Yunnan: '云南', Xizang: '西藏', Tibet: '西藏',
  Shaanxi: '陕西', Gansu: '甘肃', Qinghai: '青海', Ningxia: '宁夏', Xinjiang: '新疆',
  Taiwan: '台湾', 'Hong Kong': '香港', Macau: '澳门', Macao: '澳门',
}
function provinceLabel(region) {
  if (!region) return '其他/未知地区'
  return CHINA_PROVINCE_NAMES[region] || region
}

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
    countryHeat: Array.isArray(raw.countryHeat)
      ? raw.countryHeat
        .filter((row) => row && typeof row.country === 'string')
        .map((row) => ({ country: row.country, count: safeNumber(row.count) }))
      : [],
    chinaProvinceHeat: Array.isArray(raw.chinaProvinceHeat)
      ? raw.chinaProvinceHeat
        .filter((row) => row && typeof row.count === 'number')
        .map((row) => ({ region: typeof row.region === 'string' ? row.region : '', count: safeNumber(row.count) }))
      : [],
  }
}

function normalizeRecentComments(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.comments)) {
    throw new Error('invalid comments response')
  }

  return raw.comments
    .filter((comment) => (
      comment
      && typeof comment.id === 'string'
      && typeof comment.corpus === 'string'
      && typeof comment.slug === 'string'
      && typeof comment.chapter === 'string'
      && typeof comment.body === 'string'
      && (comment.status === 'visible' || comment.status === 'hidden')
      && typeof comment.displayName === 'string'
    ))
    .map((comment) => ({
      id: comment.id,
      corpus: comment.corpus,
      slug: comment.slug,
      chapter: comment.chapter,
      body: comment.body,
      status: comment.status,
      createdAt: Number(comment.createdAt),
      displayName: comment.displayName,
    }))
}

function commentTime(value) {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return { label: '时间未知', dateTime: undefined }
  return { label: COMMENT_DATE.format(date), dateTime: date.toISOString() }
}

function commentExcerpt(body) {
  const characters = Array.from(body)
  return characters.length > 120 ? `${characters.slice(0, 120).join('')}…` : body
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

// 排名列表(#155,与「书 / 章 Top 10」同一视觉语言):国家/地区榜只到国家级；
// 中国省份榜是国家榜里「中国大陆」一行的下钻,单独一张榜、只含中国大陆事件。
function RankingList({ rows, keyFor, labelFor, emptyLabel, limit = 20 }) {
  const visible = rows.filter((row) => row.count > 0).slice(0, limit)
  if (!visible.length) return <EmptyState label={emptyLabel} />

  const maximum = Math.max(...visible.map((row) => row.count), 1)
  return (
    <ol className="admin-top-list">
      {visible.map((row, index) => (
        <li className="admin-top-list__item" key={keyFor(row)}>
          <span className="admin-top-list__rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="admin-top-list__body">
            <div className="admin-top-list__line">
              <span><strong>{labelFor(row)}</strong></span>
              <span className="admin-top-list__count">{NUMBER.format(row.count)} 次</span>
            </div>
            <span className="admin-top-list__track" aria-hidden="true">
              <span
                className="admin-top-list__bar"
                style={{ width: `${Math.max(2, (row.count / maximum) * 100)}%`, background: 'var(--cinnabar-pure)' }}
              />
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function CountryRanking({ rows }) {
  return (
    <RankingList
      rows={rows}
      keyFor={(row) => row.country}
      labelFor={(row) => countryLabel(row.country)}
      emptyLabel="暂无地区数据"
      limit={20}
    />
  )
}

function ChinaProvinceRanking({ rows }) {
  return (
    <RankingList
      rows={rows}
      keyFor={(row) => row.region || '(unknown)'}
      labelFor={(row) => provinceLabel(row.region)}
      emptyLabel="暂无中国大陆细分数据"
      limit={34}
    />
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

function OwnerLoginPrompt({ onLogin, onRetry }) {
  return (
    <div className="admin-auth-card">
      <span className="admin-auth-card__seal" aria-hidden="true">统</span>
      <h1>阅读统计</h1>
      <p>此页面需要 owner 账号登录。请使用已标记为 owner 的正式账号登录后重试。</p>
      <div className="admin-auth-card__actions">
        <button className="btn admin-stats__primary" type="button" onClick={onLogin}>登录 owner 账号</button>
        <button className="btn btn--secondary" type="button" onClick={onRetry}>重试</button>
      </div>
    </div>
  )
}

function RecentComments({ comments, loading, error, actionError, moderatingId, onModerate, onRetry }) {
  return (
    <section className="admin-comments" aria-labelledby="admin-comments-title">
      <div className="admin-comments__head">
        <div>
          <h2 id="admin-comments-title">最近评论</h2>
          <p>全站最近 50 条，含已隐藏评论。</p>
        </div>
        {!loading && !error && <span>{NUMBER.format(comments.length)} 条</span>}
      </div>

      {loading && <p className="admin-comments__state">正在读取最近评论…</p>}
      {!loading && error && (
        <div className="admin-comments__state admin-comments__state--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>重试</button>
        </div>
      )}
      {!loading && !error && comments.length === 0 && (
        <p className="admin-comments__state">还没有评论。</p>
      )}
      {!loading && !error && actionError && (
        <p className="admin-comments__action-error" role="alert">{actionError}</p>
      )}
      {!loading && !error && comments.length > 0 && (
        <ol className="admin-comments__list">
          {comments.map((comment) => {
            const hidden = comment.status === 'hidden'
            const time = commentTime(comment.createdAt)
            return (
              <li key={comment.id} className={`admin-comments__item${hidden ? ' admin-comments__item--hidden' : ''}`}>
                <div className="admin-comments__meta">
                  <time dateTime={time.dateTime}>{time.label}</time>
                  <strong>{comment.displayName}</strong>
                  <a
                    href={commentPageUrl(comment.corpus, comment.slug, comment.chapter)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原页 ↗
                  </a>
                </div>
                <p className="admin-comments__body">{commentExcerpt(comment.body)}</p>
                <div className="admin-comments__actions">
                  <span className={`admin-comments__status admin-comments__status--${comment.status}`}>
                    {hidden ? '已隐藏' : '公开'}
                  </span>
                  <button
                    type="button"
                    className="admin-comments__moderate"
                    disabled={moderatingId !== null}
                    onClick={() => onModerate(comment)}
                  >
                    {moderatingId === comment.id ? '处理中…' : hidden ? '恢复' : '隐藏'}
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default function AdminStatsPage() {
  const [credential, setCredential] = useState(readPassphrase)
  const [draft, setDraft] = useState('')
  const [formError, setFormError] = useState('')
  const [mode, setMode] = useState('checking')
  const [stats, setStats] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [recentComments, setRecentComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentsActionError, setCommentsActionError] = useState('')
  const [commentsRetryKey, setCommentsRetryKey] = useState(0)
  const [moderatingCommentId, setModeratingCommentId] = useState(null)
  const { user, openAuth } = useAuth()
  const retriedUserId = useRef(null)

  usePageTitle('阅读统计后台')

  useEffect(() => {
    const controller = new AbortController()
    setMode('checking')

    async function requestStats(passphrase = '') {
      const options = {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      }
      if (passphrase) options.headers = { [ADMIN_HEADER]: passphrase }

      const response = await fetch(STATS_URL, options)
      const data = await response.json().catch(() => null)
      return { response, data }
    }

    function showStats(data) {
      setStats(normalizeStats(data))
      setMode('stats')
    }

    function showPassphraseError() {
      forgetPassphrase()
      setCredential('')
      setDraft('')
      setStats(null)
      setFormError('访问被拒绝')
      setMode('passphrase')
    }

    async function loadStats() {
      try {
        const sessionAttempt = await requestStats()
        if (sessionAttempt.response.ok) {
          showStats(sessionAttempt.data)
          return
        }

        if (sessionAttempt.response.status !== 401) {
          throw new Error(`stats request failed: ${sessionAttempt.response.status}`)
        }

        if (sessionAttempt.data?.error === 'owner login required') {
          forgetPassphrase()
          setCredential('')
          setDraft('')
          setStats(null)
          setFormError('')
          setMode('need-owner-login')
          return
        }

        if (sessionAttempt.data?.error !== 'access denied') {
          throw new Error('unexpected admin authorization response')
        }

        if (!credential) {
          setStats(null)
          setMode('passphrase')
          return
        }

        const passphraseAttempt = await requestStats(credential)
        if (passphraseAttempt.response.ok) {
          showStats(passphraseAttempt.data)
          return
        }

        if (passphraseAttempt.response.status === 401) {
          if (passphraseAttempt.data?.error === 'owner login required') {
            forgetPassphrase()
            setCredential('')
            setDraft('')
            setStats(null)
            setFormError('')
            setMode('need-owner-login')
          } else {
            showPassphraseError()
          }
          return
        }

        throw new Error(`stats request failed: ${passphraseAttempt.response.status}`)
      } catch (error) {
        if (error.name !== 'AbortError') setMode('error')
      }
    }

    loadStats()
    return () => controller.abort()
  }, [credential, retryKey])

  useEffect(() => {
    const userId = user?.id ?? null
    if (!userId) {
      retriedUserId.current = null
      return
    }
    if (mode === 'need-owner-login' && retriedUserId.current !== userId) {
      retriedUserId.current = userId
      setRetryKey((key) => key + 1)
    }
  }, [mode, user?.id])

  useEffect(() => {
    if (mode !== 'stats') return undefined

    const controller = new AbortController()
    const options = {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }
    if (credential) options.headers = { [ADMIN_HEADER]: credential }

    setCommentsLoading(true)
    setCommentsError('')
    setCommentsActionError('')

    fetch(COMMENTS_URL, options)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || '最近评论读取失败,请稍后重试')
        setRecentComments(normalizeRecentComments(data))
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setCommentsError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCommentsLoading(false)
      })

    return () => controller.abort()
  }, [mode, credential, commentsRetryKey])

  function submitPassphrase(event) {
    event.preventDefault()
    if (!draft) return
    setFormError('')
    storePassphrase(draft)
    setCredential(draft)
    setMode('checking')
  }

  function lockPage() {
    forgetPassphrase()
    setCredential('')
    setDraft('')
    setStats(null)
    setFormError('')
    setMode('checking')
    setRetryKey((key) => key + 1)
  }

  function retrySession() {
    setMode('checking')
    setRetryKey((key) => key + 1)
  }

  async function moderateRecentComment(comment) {
    const status = comment.status === 'hidden' ? 'visible' : 'hidden'
    const headers = { 'Content-Type': 'application/json' }
    if (credential) headers[ADMIN_HEADER] = credential

    setModeratingCommentId(comment.id)
    setCommentsActionError('')
    try {
      const response = await fetch(`${COMMENTS_URL}/${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || '评论状态更新失败,请稍后重试')
      }
      setRecentComments((current) => current.map((item) => (
        item.id === comment.id ? { ...item, status } : item
      )))
    } catch (error) {
      setCommentsActionError(error.message)
    } finally {
      setModeratingCommentId(null)
    }
  }

  if (mode === 'passphrase') {
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

  if (mode === 'need-owner-login') {
    return (
      <div className="admin-stats-page admin-stats-page--locked">
        <OwnerLoginPrompt onLogin={() => openAuth('login')} onRetry={retrySession} />
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

      {mode === 'checking' && <div className="admin-stats__message">正在验证身份并读取统计…</div>}

      {mode === 'error' && (
        <div className="admin-stats__message admin-stats__message--error" role="alert">
          <p>统计数据读取失败，请稍后重试。</p>
          <div>
            <button className="btn admin-stats__primary" type="button" onClick={retrySession}>重试</button>
            <button className="btn btn--secondary" type="button" onClick={lockPage}>重新输入口令</button>
          </div>
        </div>
      )}

      {mode === 'stats' && stats && (
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

            <section className="admin-stat-card admin-stat-card--wide">
              <div className="admin-stat-card__head">
                <h2>国家/地区排名</h2>
                <span>Cloudflare 边缘解析，不存原始 IP</span>
              </div>
              <CountryRanking rows={stats.countryHeat} />
            </section>

            <section className="admin-stat-card admin-stat-card--wide">
              <div className="admin-stat-card__head">
                <h2>中国大陆省级排名</h2>
                <span>「国家/地区排名」中「中国大陆」的下钻</span>
              </div>
              <ChinaProvinceRanking rows={stats.chinaProvinceHeat} />
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

          <RecentComments
            comments={recentComments}
            loading={commentsLoading}
            error={commentsError}
            actionError={commentsActionError}
            moderatingId={moderatingCommentId}
            onModerate={moderateRecentComment}
            onRetry={() => setCommentsRetryKey((key) => key + 1)}
          />
        </>
      )}
    </div>
  )
}
