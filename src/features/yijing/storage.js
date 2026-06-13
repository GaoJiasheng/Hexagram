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
  } catch { /* quota exceeded — silently ignore */ }
}

function remove(k) {
  localStorage.removeItem(key(k))
}

// ── Settings ─────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  showTranslation: true,
  fontScale: 1, // 0.9 | 1 | 1.15
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...get('settings') }
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
const DATA_KEYS = ['settings', 'bookmarks', 'notes', 'divinations', 'reading', 'recentHexagrams', 'progress']

export function exportData() {
  const data = {}
  for (const k of DATA_KEYS) data[k] = get(k)
  return data
}

export function importData(data) {
  for (const k of DATA_KEYS) {
    if (data[k] !== undefined) set(k, data[k])
  }
}

export function clearAllData() {
  for (const k of DATA_KEYS) remove(k)
}
