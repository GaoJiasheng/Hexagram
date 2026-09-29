// 校验闸 · 《战国策》七国示意图 + 合纵连横时间轴(design-v24 §9 / §0.2)。
// 数据 src/data/zong/zhanguoce-map.json 是人工策展(方位 + 每篇推定年代),这里逐条回查原文:
//   ① 18 篇齐、篇题与站内原文章题一致;
//   ② 每篇 kw 是该篇原文确有的字样;note / caveat 里「」括起来的只许是该篇原文的精确子串;
//   ③ 所涉之国合法,且每国在篇中有字面依据(国名 / 别称,或 via 指定的人名);
//   ④ 年代:-475 ≤ from ≤ to ≤ -221;c 只许 approx | disputed;
//      approx 的 label 须带「约」,disputed 的 label 不给数字、区间不窄于 20 年(宽区间);
//   ⑤ 地名每处所挂之篇原文里确有此名(漏挂的篇报 warn);合纵 / 连横引文、《韩非子·五蠹》界定逐字回查;
//   ⑥ 坐标都在画布内;纵横红线:我方文字不许出现教程口吻用字。
import path from 'node:path'
import fs from 'node:fs'

const REL = 'src/data/zong/zhanguoce-map.json'
const TAG = '战国策七国图'
export const STATE_IDS = ['qin', 'chu', 'qi', 'yan', 'zhao', 'wei', 'han', 'zhou']
export const YEAR_MIN = -475
export const YEAR_MAX = -221
const N_PIECES = 18
// 纵横红线:看穿而不教用。我方文字(note / caveat / gloss)里出现这些,多半是写成了教程或现代借用。
const TUTORIAL_RE = /(话术|职场|谈判技巧|说服技巧|学以致用|成功学|可资借鉴|教你|秘诀|攻略)/
const QUOTE_RE = /「([^「」]+)」/g
const inView = (view, x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= view.w && y <= view.h

/**
 * 纯校验:不读盘,便于单测。
 * @param data  zhanguoce-map.json 的内容
 * @param chapterText (corpus, slug, ch) => 章题 + 全部原文拼接 | null
 * @returns {{ errors: string[], warnings: string[], stats: object }}
 */
export function validateZhanguoceMap(data, chapterText) {
  const errors = [], warnings = []
  const E = (m) => errors.push(`${TAG}: ${m}`)
  const W = (m) => warnings.push(`${TAG}: ${m}`)
  const text = (ch) => chapterText('zong', 'zhanguoce', ch)
  const stats = { pieces: 0, approx: 0, disputed: 0, states: 0, places: 0, quotes: 0 }

  const view = data?.view
  if (!view || !(view.w > 0) || !(view.h > 0)) { E('缺 view{w,h}'); return { errors, warnings, stats } }

  // ---- 国 ----
  const states = Array.isArray(data.states) ? data.states : []
  const byId = new Map()
  for (const s of states) {
    if (!STATE_IDS.includes(s.id)) { E(`未知国 id「${s.id}」(只许七国 + 周)`); continue }
    if (byId.has(s.id)) { E(`国 ${s.id} 重复`); continue }
    byId.set(s.id, s)
    if (typeof s.name !== 'string' || !s.name) E(`国 ${s.id} 缺 name`)
    if (!inView(view, s.x, s.y)) E(`国 ${s.id} 坐标不在画布内`)
    if (!(s.w > 0)) E(`国 ${s.id} 的 w 须为正数`)
    if (!Array.isArray(s.alias) || !s.alias.length || s.alias.some((a) => typeof a !== 'string' || !a)) E(`国 ${s.id} 缺 alias`)
  }
  for (const id of STATE_IDS) if (!byId.has(id)) E(`缺国 ${id}`)
  stats.states = byId.size

  // ---- 篇 ----
  const pieces = Array.isArray(data.pieces) ? data.pieces : []
  const seen = new Set()
  for (const p of pieces) {
    const t = `第 ${p.ch} 篇`
    if (!Number.isInteger(p.ch) || p.ch < 1 || p.ch > N_PIECES) { E(`${t}: ch 须为 1–${N_PIECES}`); continue }
    if (seen.has(p.ch)) { E(`${t}: 重复`); continue }
    seen.add(p.ch)
    const src = text(p.ch)
    if (src == null) { E(`${t}: 站内原文里没有这一章`); continue }
    if (typeof p.title !== 'string' || !p.title || !src.startsWith(p.title)) E(`${t}: 篇题「${p.title}」与原文章题不符`)

    // kw
    if (typeof p.kw !== 'string' || !p.kw) E(`${t}: 缺 kw`)
    else if (!src.includes(p.kw)) E(`${t}: kw「${p.kw}」不在该篇原文里`)

    // 所涉之国:合法 + 有字面依据
    if (!Array.isArray(p.states) || !p.states.length) E(`${t}: states 为空`)
    else {
      if (new Set(p.states).size !== p.states.length) E(`${t}: states 有重复`)
      for (const id of p.states) {
        const s = byId.get(id)
        if (!s) { E(`${t}: states 里有未知国「${id}」`); continue }
        const via = p.via?.[id]
        if (via != null) {
          if (typeof via !== 'string' || !src.includes(via)) E(`${t}: ${s.name}国的依据「${via}」不在原文里`)
        } else if (!(s.alias || []).some((a) => src.includes(a))) {
          E(`${t}: 原文里找不到${s.name}国的字样(${(s.alias || []).join('/')}),须另给 via`)
        }
      }
    }
    if (p.via != null) for (const id of Object.keys(p.via)) if (!p.states?.includes(id)) E(`${t}: via 指向不在 states 里的「${id}」`)

    // 年代
    if (!Number.isInteger(p.from) || !Number.isInteger(p.to)) E(`${t}: from / to 须为整数(公元前记负数)`)
    else {
      if (p.from > p.to) E(`${t}: from ${p.from} 晚于 to ${p.to}`)
      if (p.from < YEAR_MIN || p.to > YEAR_MAX) E(`${t}: 年代 ${p.from}~${p.to} 超出战国范围(${YEAR_MIN}~${YEAR_MAX})`)
    }
    if (typeof p.label !== 'string' || !p.label) E(`${t}: 缺 label`)
    if (p.c === 'approx') {
      stats.approx++
      if (typeof p.label === 'string' && !p.label.includes('约')) E(`${t}: approx 的 label 须带「约」(确数只在篇文自证时给,且仍写作大致区间)`)
    } else if (p.c === 'disputed') {
      stats.disputed++
      if (typeof p.label === 'string' && /\d/.test(p.label)) E(`${t}: disputed 的 label 不给数字,只给「战国中期」一类说法`)
      if (Number.isInteger(p.from) && Number.isInteger(p.to) && p.to - p.from < 20) E(`${t}: disputed 须给宽区间(≥ 20 年),现为 ${p.to - p.from} 年`)
    } else E(`${t}: c 只许 approx | disputed,现为「${p.c}」`)

    // note / caveat:「」只括原文
    if (typeof p.note !== 'string' || !p.note) E(`${t}: 缺 note(写推法)`)
    else if ([...p.note].length > 200) E(`${t}: note 超 200 字`)
    if (p.caveat != null && (typeof p.caveat !== 'string' || !p.caveat || [...p.caveat].length > 140)) E(`${t}: caveat 须为 1–140 字`)
    for (const field of ['note', 'caveat']) {
      const s = p[field]
      if (typeof s !== 'string') continue
      for (const m of s.matchAll(QUOTE_RE)) {
        stats.quotes++
        if (!src.includes(m[1])) E(`${t}: ${field} 里「${m[1]}」不是该篇原文的子串(「」只许括原文)`)
      }
      if (TUTORIAL_RE.test(s)) E(`${t}: ${field} 出现教程口吻用字(${s.match(TUTORIAL_RE)[0]}),纵横只作思想史研读`)
    }
  }
  for (let ch = 1; ch <= N_PIECES; ch++) if (!seen.has(ch)) E(`缺第 ${ch} 篇`)
  stats.pieces = seen.size

  // ---- 地名 ----
  const places = Array.isArray(data.places) ? data.places : []
  const placeIds = new Set()
  for (const pl of places) {
    const t = `地名 ${pl.name}`
    if (!pl.id || placeIds.has(pl.id)) { E(`${t}: id 缺失或重复`); continue }
    placeIds.add(pl.id)
    if (pl.state != null && !byId.has(pl.state)) E(`${t}: state「${pl.state}」不是合法的国`)
    if (!inView(view, pl.x, pl.y)) E(`${t}: 坐标不在画布内`)
    if (!Array.isArray(pl.chs) || !pl.chs.length) { E(`${t}: chs 为空`); continue }
    for (const ch of pl.chs) {
      const src = Number.isInteger(ch) ? text(ch) : null
      if (src == null) E(`${t}: 挂到不存在的第 ${ch} 篇`)
      else if (!src.includes(pl.name)) E(`${t}: 第 ${ch} 篇原文里没有「${pl.name}」`)
    }
    for (let ch = 1; ch <= N_PIECES; ch++) {
      if (pl.chs.includes(ch)) continue
      const src = text(ch)
      if (src && src.includes(pl.name)) W(`${t}: 第 ${ch} 篇原文也有「${pl.name}」,却没挂上`)
    }
  }
  stats.places = placeIds.size

  // ---- 河流(示意曲线,只查形状)----
  for (const r of data.rivers || []) {
    if (typeof r.name !== 'string' || typeof r.d !== 'string' || !/^M/.test(r.d)) E(`河流 ${r.name}: 缺 name 或 d`)
  }

  // ---- 合纵 / 连横 ----
  const axes = Array.isArray(data.axes) ? data.axes : []
  for (const need of ['zong', 'heng']) if (!axes.some((a) => a.id === need)) E(`缺叠加层 ${need}`)
  for (const a of axes) {
    const t = `叠加层 ${a.name || a.id}`
    for (const pair of a.links || []) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some((id) => !byId.has(id)) || pair[0] === pair[1]) E(`${t}: 连线 ${JSON.stringify(pair)} 不合法`)
    }
    if (!Array.isArray(a.cites) || !a.cites.length) E(`${t}: 缺原文引文`)
    for (const c of a.cites || []) {
      const src = text(c.ch)
      stats.quotes++
      if (src == null) E(`${t}: 引到不存在的第 ${c.ch} 篇`)
      else if (typeof c.quote !== 'string' || !src.includes(c.quote)) E(`${t}: 「${c.quote}」不是第 ${c.ch} 篇原文的子串`)
    }
    if (typeof a.gloss === 'string' && TUTORIAL_RE.test(a.gloss)) E(`${t}: gloss 出现教程口吻用字`)
  }
  const d = data.def
  if (d) {
    const src = chapterText(d.corpus, d.slug, d.ch)
    stats.quotes++
    if (src == null) E(`界定引文: 站内没有 ${d.corpus}/${d.slug} 第 ${d.ch} 章`)
    else {
      if (d.title && !src.startsWith(d.title)) E(`界定引文: 章题「${d.title}」与原文不符`)
      if (typeof d.quote !== 'string' || !src.includes(d.quote)) E(`界定引文: 「${d.quote}」不是 ${d.slug} 第 ${d.ch} 章原文的子串`)
    }
  }

  // ---- 秦君参照带 ----
  let prevTo = -Infinity
  for (const k of data.qinKings || []) {
    if (!Number.isInteger(k.from) || !Number.isInteger(k.to) || k.from > k.to) E(`秦君 ${k.name}: from / to 不合法`)
    else if (k.from <= prevTo) E(`秦君 ${k.name}: 与上一位在位年重叠或倒序`)
    else prevTo = k.to
    if (Number.isInteger(k.to) && k.to > YEAR_MAX) E(`秦君 ${k.name}: 超出战国下限`)
  }

  return { errors, warnings, stats }
}

export default function check({ ROOT, err, warn, info, readJson, chapterText }) {
  const file = path.join(ROOT, REL)
  if (!fs.existsSync(file)) { err(`${TAG}: 缺 ${REL}`); return }
  const { errors, warnings, stats } = validateZhanguoceMap(readJson(file), chapterText)
  for (const m of errors) err(m)
  for (const m of warnings) warn(m)
  info(`${TAG}: ${stats.pieces} 篇(约 ${stats.approx} · 存疑 ${stats.disputed})· ${stats.states} 国 · ${stats.places} 地名 · 引文 ${stats.quotes} 处回查${errors.length ? '' : '全过'}`)
}
