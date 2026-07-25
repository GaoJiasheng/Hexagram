// localStorage 薄封装 — JSON 解析失败时静默重置该键

const PREFIX = 'guanxiang.v1.'

// Keep this client list in sync with the independent backend allow-list in
// functions/api/[[route]].js.
export const DATA_KEYS = ['settings', 'quoteTheme', 'bookmarks', 'notes', 'divinations', 'reading', 'recentHexagrams', 'progress', 'corpusMarks', 'corpusNotes']
const DATA_KEY_SET = new Set(DATA_KEYS)
const SYNC_DEFAULTS = {
  settings: null,
  quoteTheme: null,
  bookmarks: {},
  notes: null,
  divinations: [],
  reading: null,
  recentHexagrams: [],
  progress: {},
  corpusMarks: {},
  corpusNotes: {},
}
let applyingSyncResult = false

function key(k) { return PREFIX + k }

function get(k, fallback = null) {
  try {
    const raw = localStorage.getItem(key(k))
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function set(k, value) {
  try {
    localStorage.setItem(key(k), JSON.stringify(value))
    if (DATA_KEY_SET.has(k) && !applyingSyncResult) {
      const meta = get('syncMeta', {})
      const nextMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
      localStorage.setItem(key('syncMeta'), JSON.stringify({ ...nextMeta, [k]: Date.now() }))
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('gx:data-changed', { detail: { key: k } }))
      }
    }
    return true
  } catch { return false /* 配额满 / 隐私模式不可写 */ }
}

function remove(k) {
  localStorage.removeItem(key(k))
}

// ── Auth hint ─────────────────────────────────────────────
// 只提示浏览器曾登录过,让 AuthProvider 决定是否请求 /api/me。它不是用户数据,
// 不参与导出/导入/「清空本地数据」,退出登录时单独移除。
export function hasAuthHint() { return get('authHint', false) === true }
export function saveAuthHint() { return set('authHint', true) }
export function clearAuthHint() { remove('authHint') }

// ── Settings ─────────────────────────────────────────────
const FONT_SCALE_TIER = 2
const LEGACY_FONT_SCALES = [0.9, 1, 1.15, 1.35]
export const FONT_SCALE_STEPS = [[1, '小'], [1.15, '中'], [1.35, '大'], [1.55, '特大']]

export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  showTranslation: true,
  fontScale: 1.15, // 1 | 1.15 | 1.35 | 1.55
  readWidth: 'normal', // 'narrow' | 'normal' | 'wide'
  transLayout: 'stack', // 'stack'(译文在下) | 'side'(原文/译文左右对照)
  quoteTheme: 'classic', // 'classic'(朱印经典) | 'ink'(水墨留白) | 'moon'(暗夜月白)
}
const VALID_THEMES = ['light', 'dark', 'system']
const VALID_FONT_SCALES = FONT_SCALE_STEPS.map(([value]) => value)
const VALID_READ_WIDTHS = ['narrow', 'normal', 'wide']
const VALID_TRANS_LAYOUTS = ['stack', 'side']
const VALID_QUOTE_THEMES = ['classic', 'ink', 'moon']

// 白名单校验:旧结构/损坏值不直接进 state(防非法 fontScale 写入 --font-scale 等)
export function getSettings() {
  const saved = get('settings', null)
  let stored = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null

  // v2 字号档位按序号迁移,不能仅靠值白名单判断(新旧 1/1.15/1.35 重叠)。
  // fontScaleTier 随 settings 持久化/同步,保证本地、导入或云端数据都只迁移一次。
  if (stored && stored.fontScaleTier !== FONT_SCALE_TIER) {
    const legacyIndex = LEGACY_FONT_SCALES.indexOf(stored.fontScale)
    const fontScale = stored.fontScale === 1.55
      ? 1.55
      : legacyIndex >= 0
        ? FONT_SCALE_STEPS[legacyIndex][0]
        : DEFAULT_SETTINGS.fontScale
    stored = { ...stored, fontScale, fontScaleTier: FONT_SCALE_TIER }
    saveSettings(stored)
  }

  const s = { ...DEFAULT_SETTINGS, ...stored }
  if (!VALID_THEMES.includes(s.theme)) s.theme = DEFAULT_SETTINGS.theme
  if (!VALID_FONT_SCALES.includes(s.fontScale)) s.fontScale = DEFAULT_SETTINGS.fontScale
  if (!VALID_READ_WIDTHS.includes(s.readWidth)) s.readWidth = DEFAULT_SETTINGS.readWidth
  if (!VALID_TRANS_LAYOUTS.includes(s.transLayout)) s.transLayout = DEFAULT_SETTINGS.transLayout
  s.quoteTheme = getQuoteTheme()
  s.showTranslation = !!s.showTranslation
  delete s.fontScaleTier
  return s
}

export function saveSettings(s) {
  // quoteTheme 有规格指定的独立键；保存其他设置时仍以该键为准，避免旧 context 覆盖新选项。
  set('settings', { ...s, fontScaleTier: FONT_SCALE_TIER, quoteTheme: getQuoteTheme() })
}

// ── Quote card theme ──────────────────────────────────────
// 独立键 guanxiang.v1.quoteTheme，便于分享卡单独记忆、导入导出与日后扩主题。
export function getQuoteTheme() {
  const saved = get('quoteTheme', null)
  if (VALID_QUOTE_THEMES.includes(saved)) return saved
  // 兼容曾随 settings 导入的值；独立键仍是当前版本的唯一写入目标。
  const legacy = get('settings', null)?.quoteTheme
  return VALID_QUOTE_THEMES.includes(legacy) ? legacy : DEFAULT_SETTINGS.quoteTheme
}

export function saveQuoteTheme(theme) {
  const next = VALID_QUOTE_THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.quoteTheme
  set('quoteTheme', next)
  saveSettings({ ...getSettings(), quoteTheme: next })
  return next
}

// ── Bookmarks ─────────────────────────────────────────────
function getBookmarksMap() {
  const saved = get('bookmarks', {})
  if (!Array.isArray(saved)) return saved && typeof saved === 'object' ? saved : {}

  const at = new Date().toISOString()
  const migrated = Object.fromEntries(saved.map(id => [id, { at }]))
  set('bookmarks', migrated)
  return migrated
}

export function getBookmarks() {
  return Object.entries(getBookmarksMap())
    .filter(([, item]) => item?.deleted !== true)
    .sort(([, a], [, b]) => (a.at || '').localeCompare(b.at || ''))
    .map(([id]) => Number(id))
}

export function toggleBookmark(id) {
  const bookmarks = getBookmarksMap()
  const current = bookmarks[id]
  const at = new Date().toISOString()
  bookmarks[id] = current && current.deleted !== true ? { deleted: true, at } : { at }
  set('bookmarks', bookmarks)
  return getBookmarks()
}

// ── Notes ──────────────────────────────────────────────────
// 整卦笔记的写入面已下线(#158,位置将改作评论);getNotes 仍保留供「我的·笔记」
// 只读展示存量笔记,不删旧数据。
export function getNotes() {
  const notes = get('notes', {})
  return notes && typeof notes === 'object' && !Array.isArray(notes) ? notes : {}
}

// ── Divinations (history) ──────────────────────────────────
const MAX_DIVINATIONS = 200
export function getDivinationsRaw() { return get('divinations', []) }
export function getDivinations() { return getDivinationsRaw().filter(d => d.deleted !== true) }
export function saveDivination(entry) {
  const list = getDivinationsRaw()
  const createdAt = new Date().toISOString()
  list.unshift({ ...entry, id: Date.now(), createdAt, at: createdAt })

  let activeCount = 0
  const capped = list.filter((d) => {
    if (d.deleted === true) return true
    activeCount += 1
    return activeCount <= MAX_DIVINATIONS
  })
  set('divinations', capped)
}
export function deleteDivination(id) {
  const at = new Date().toISOString()
  const list = getDivinationsRaw().map(d => d.id === id ? { id, deleted: true, at } : d)
  set('divinations', list)
}
export function saveDivinations(list) { set('divinations', list) }
// 验占回填(v10 §2):outcome = { verdict: 'ying'|'partial'|'bu', note, recordedAt };旧条目无此字段视同待验
export function setDivinationOutcome(id, verdict, note) {
  const list = getDivinationsRaw()
  const d = list.find(x => x.id === id && x.deleted !== true)
  if (!d) return
  const at = new Date().toISOString()
  d.outcome = verdict ? { verdict, note: note || '', recordedAt: at } : null
  d.at = verdict ? d.outcome.recordedAt : at
  set('divinations', list)
}

// ── 读经站段落收藏 / 笔记(Tier 2)──────────────────────────
// 锚 key = corpus:slug:章:段(slug 全站唯一,不跨站碰撞)。dao 站 corpus 传 'dao'。
function markKey(corpus, slug, ch, i) { return `${corpus}:${slug}:${ch}:${i}` }

function withoutDeleted(items) {
  return Object.fromEntries(Object.entries(items).filter(([, item]) => item?.deleted !== true))
}

export function getCorpusMarks() { return withoutDeleted(get('corpusMarks', {})) }
export function toggleCorpusMark(corpus, slug, ch, i, snippet) {
  const m = get('corpusMarks', {})
  const k = markKey(corpus, slug, ch, i)
  if (m[k] && m[k].deleted !== true) m[k] = { deleted: true, at: new Date().toISOString() }
  else m[k] = { corpus, slug, ch, i, snippet: (snippet || '').slice(0, 60), at: new Date().toISOString() }
  set('corpusMarks', m)
  return withoutDeleted(m)
}

export function getCorpusNotes() { return withoutDeleted(get('corpusNotes', {})) }
export function saveCorpusNote(corpus, slug, ch, i, text, snippet) {
  const n = get('corpusNotes', {})
  const k = markKey(corpus, slug, ch, i)
  if (!text.trim()) n[k] = { deleted: true, at: new Date().toISOString() }
  else n[k] = { corpus, slug, ch, i, text, snippet: (snippet || '').slice(0, 60), at: new Date().toISOString() }
  set('corpusNotes', n)
  return withoutDeleted(n)
}

// ── Reading progress ──────────────────────────────────────
export function getReadingProgress() {
  const reading = get('reading', {})
  return reading && typeof reading === 'object' && !Array.isArray(reading) ? reading : {}
}
export function saveReadingProgress(book, chapter) {
  const p = getReadingProgress()
  set('reading', { ...p, [book]: chapter })
}

// ── Recent hexagrams ──────────────────────────────────────
export function getRecentHexagrams() { return get('recentHexagrams', []) }
export function addRecentHexagram(id) {
  const list = getRecentHexagrams().filter(x => x !== id)
  set('recentHexagrams', [id, ...list].slice(0, 10))
}

// ── Learning progress(读/练/用,v3 §7.3)─────────────────
const EMPTY_PROGRESS = { read: {}, quiz: {}, used: {} }

export function getProgress() {
  const p = get('progress', null)
  return { ...EMPTY_PROGRESS, ...(p || {}) }
}

export function markRead(topic) {
  const p = getProgress()
  if (p.read[topic]) return p
  p.read = { ...p.read, [topic]: new Date().toISOString() }
  set('progress', p)
  return p
}

export function markQuizResult(topic, correct, total) {
  const p = getProgress()
  const prev = p.quiz[topic] || { passed: false, best: 0 }
  p.quiz = {
    ...p.quiz,
    [topic]: {
      passed: prev.passed || correct === total,  // 只升不降
      best: Math.max(prev.best, correct),
      total,
      at: new Date().toISOString(),
    },
  }
  set('progress', p)
  return p
}

export function markMethodUsed(methodKey) {
  const p = getProgress()
  p.used = { ...p.used, [methodKey]: new Date().toISOString() }
  set('progress', p)
  return p
}

// ── Export / Import ───────────────────────────────────────
function hasMeaningfulSyncValue(dataKey, value) {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value !== 'object') return true
  if (dataKey === 'progress') {
    return ['read', 'quiz', 'used'].some((section) => {
      const items = value[section]
      return items && typeof items === 'object' && Object.keys(items).length > 0
    })
  }
  return Object.keys(value).length > 0
}

export function getSyncSnapshot(now = Date.now()) {
  // Finish the existing lazy bookmark-array migration before collecting raw
  // sync data, so a pre-tombstone user's bookmarks cannot be mistaken for an
  // invalid collection and disappear on first login.
  getBookmarksMap()

  const savedMeta = get('syncMeta', {})
  const syncMeta = savedMeta && typeof savedMeta === 'object' && !Array.isArray(savedMeta) ? savedMeta : {}
  const nextMeta = { ...syncMeta }
  let metaChanged = false
  const snapshot = {}
  for (const dataKey of DATA_KEYS) {
    const value = get(dataKey, SYNC_DEFAULTS[dataKey])
    const savedAt = syncMeta[dataKey]
    const hasSavedAt = typeof savedAt === 'number' && Number.isFinite(savedAt)
    const at = hasSavedAt ? savedAt : hasMeaningfulSyncValue(dataKey, value) ? now : 0
    snapshot[dataKey] = {
      value,
      at,
    }
    if (!hasSavedAt && at > 0) {
      nextMeta[dataKey] = at
      metaChanged = true
    }
  }
  if (metaChanged) {
    try { localStorage.setItem(key('syncMeta'), JSON.stringify(nextMeta)) } catch { /* best effort */ }
  }
  return snapshot
}

export function applySyncSnapshot(data, syncedAt = Date.now()) {
  const savedMeta = get('syncMeta', {})
  const nextMeta = savedMeta && typeof savedMeta === 'object' && !Array.isArray(savedMeta) ? { ...savedMeta } : {}
  let allWritten = true
  applyingSyncResult = true
  try {
    for (const dataKey of DATA_KEYS) {
      const entry = data?.[dataKey]
      const value = entry && Object.hasOwn(entry, 'value') ? entry.value : SYNC_DEFAULTS[dataKey]
      if (!set(dataKey, value)) {
        allWritten = false
        continue
      }
      nextMeta[dataKey] = typeof entry?.at === 'number' && Number.isFinite(entry.at) ? entry.at : 0
    }
  } finally {
    applyingSyncResult = false
  }

  try {
    localStorage.setItem(key('syncMeta'), JSON.stringify(nextMeta))
    if (allWritten) localStorage.setItem(key('lastSyncAt'), JSON.stringify(syncedAt))
  } catch {
    return false
  }
  return allWritten
}

export function getLastSyncAt() {
  const value = get('lastSyncAt', null)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function exportData() {
  const data = {}
  for (const k of DATA_KEYS) data[k] = get(k)
  set('lastExportAt', new Date().toISOString())   // 记录导出时点(不入 DATA_KEYS,不参与导出/清空)
  return data
}

// 每日一辩弹窗(v21 批2)——记当日已弹日期(不入 DATA_KEYS,不导出/清空)
export function getDailyDebateSeen() { return get('dailyDebateSeen', null) }
export function markDailyDebateSeen(day) { set('dailyDebateSeen', day) }

// 研读足迹统计(#149)——收藏/批注总数 + 是否曾导出备份。供「我的」里程碑文案与备份提示。
export function getStudyStats() {
  const marks = Object.keys(getCorpusMarks()).length
  const notes = Object.keys(getCorpusNotes()).length
  return { marks, notes, total: marks + notes, exported: !!get('lastExportAt') }
}

export function importData(data) {
  for (const k of DATA_KEYS) {
    if (data[k] !== undefined) set(k, data[k])
  }
}

export function clearAllData() {
  for (const k of DATA_KEYS) remove(k)
}
