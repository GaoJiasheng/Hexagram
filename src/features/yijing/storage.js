// localStorage 薄封装 — JSON 解析失败时静默重置该键

const PREFIX = 'guanxiang.v1.'

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
    return true
  } catch { return false /* 配额满 / 隐私模式不可写 */ }
}

function remove(k) {
  localStorage.removeItem(key(k))
}

// ── Settings ─────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  showTranslation: true,
  fontScale: 1, // 0.9 | 1 | 1.15
  readWidth: 'normal', // 'narrow' | 'normal' | 'wide'
  transLayout: 'stack', // 'stack'(译文在下) | 'side'(原文/译文左右对照)
}
const VALID_THEMES = ['light', 'dark', 'system']
const VALID_FONT_SCALES = [0.9, 1, 1.15]
const VALID_READ_WIDTHS = ['narrow', 'normal', 'wide']
const VALID_TRANS_LAYOUTS = ['stack', 'side']

// 白名单校验:旧结构/损坏值不直接进 state(防非法 fontScale 写入 --font-scale 等)
export function getSettings() {
  const s = { ...DEFAULT_SETTINGS, ...get('settings') }
  if (!VALID_THEMES.includes(s.theme)) s.theme = DEFAULT_SETTINGS.theme
  if (!VALID_FONT_SCALES.includes(s.fontScale)) s.fontScale = DEFAULT_SETTINGS.fontScale
  if (!VALID_READ_WIDTHS.includes(s.readWidth)) s.readWidth = DEFAULT_SETTINGS.readWidth
  if (!VALID_TRANS_LAYOUTS.includes(s.transLayout)) s.transLayout = DEFAULT_SETTINGS.transLayout
  s.showTranslation = !!s.showTranslation
  return s
}

export function saveSettings(s) {
  set('settings', s)
}

// ── Bookmarks ─────────────────────────────────────────────
export function getBookmarks() { return get('bookmarks', []) }
export function saveBookmarks(ids) { set('bookmarks', ids) }
export function toggleBookmark(id) {
  const bm = getBookmarks()
  const next = bm.includes(id) ? bm.filter(x => x !== id) : [...bm, id]
  saveBookmarks(next)
  return next
}

// ── Notes ──────────────────────────────────────────────────
export function getNotes() { return get('notes', {}) }
export function saveNote(hexagramId, text) {
  const notes = getNotes()
  if (!text.trim()) {
    delete notes[hexagramId]
  } else {
    notes[hexagramId] = { text, updatedAt: new Date().toISOString() }
  }
  set('notes', notes)
}

// ── Divinations (history) ──────────────────────────────────
const MAX_DIVINATIONS = 200
export function getDivinations() { return get('divinations', []) }
export function saveDivination(entry) {
  const list = getDivinations()
  list.unshift({ ...entry, id: Date.now(), createdAt: new Date().toISOString() })
  set('divinations', list.slice(0, MAX_DIVINATIONS))
}
export function deleteDivination(id) {
  set('divinations', getDivinations().filter(d => d.id !== id))
}
export function saveDivinations(list) { set('divinations', list) }
// 验占回填(v10 §2):outcome = { verdict: 'ying'|'partial'|'bu', note, recordedAt };旧条目无此字段视同待验
export function setDivinationOutcome(id, verdict, note) {
  const list = getDivinations()
  const d = list.find(x => x.id === id)
  if (!d) return
  d.outcome = verdict ? { verdict, note: note || '', recordedAt: new Date().toISOString() } : null
  set('divinations', list)
}

// ── 读经站段落收藏 / 笔记(Tier 2)──────────────────────────
// 锚 key = corpus:slug:章:段(slug 全站唯一,不跨站碰撞)。dao 站 corpus 传 'dao'。
function markKey(corpus, slug, ch, i) { return `${corpus}:${slug}:${ch}:${i}` }

export function getCorpusMarks() { return get('corpusMarks', {}) }
export function toggleCorpusMark(corpus, slug, ch, i, snippet) {
  const m = getCorpusMarks()
  const k = markKey(corpus, slug, ch, i)
  if (m[k]) delete m[k]
  else m[k] = { corpus, slug, ch, i, snippet: (snippet || '').slice(0, 60), at: new Date().toISOString() }
  set('corpusMarks', m)
  return m
}

export function getCorpusNotes() { return get('corpusNotes', {}) }
export function saveCorpusNote(corpus, slug, ch, i, text, snippet) {
  const n = getCorpusNotes()
  const k = markKey(corpus, slug, ch, i)
  if (!text.trim()) delete n[k]
  else n[k] = { corpus, slug, ch, i, text, snippet: (snippet || '').slice(0, 60), at: new Date().toISOString() }
  set('corpusNotes', n)
  return n
}

// ── Reading progress ──────────────────────────────────────
export function getReadingProgress() { return get('reading', {}) }
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
const DATA_KEYS = ['settings', 'bookmarks', 'notes', 'divinations', 'reading', 'recentHexagrams', 'progress', 'corpusMarks', 'corpusNotes']

export function exportData() {
  const data = {}
  for (const k of DATA_KEYS) data[k] = get(k)
  set('lastExportAt', new Date().toISOString())   // 记录导出时点(不入 DATA_KEYS,不参与导出/清空)
  return data
}

// 研读足迹统计(#149)——收藏/批注总数 + 是否曾导出备份。供「我的」里程碑文案与备份提示。
export function getStudyStats() {
  const marks = Object.keys(get('corpusMarks', {})).length
  const notes = Object.keys(get('corpusNotes', {})).length
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
