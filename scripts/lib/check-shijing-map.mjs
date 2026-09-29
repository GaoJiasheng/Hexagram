// 校验闸 · 诗经十五国风示意图(design-v24 §8 / §0.2)。
// 查四层:① 十五组齐、一组一章(ch 存在且章题含国名、kw 回查原文);② 首数从原文数(poems 与 note 里的「N 首」
// 都要等于该章诗题段数);③ 几何:坐标在画布内、圆不相叠、相对方位合旧说(秦西齐东、豳西北、二南在南…);
// ④ 示意图红线:note 里不许出现经纬度(本图只表相对方位)。
import path from 'node:path'
import fs from 'node:fs'
import {
  poemTitlesOf, orientationErrors, overlappingPairs, regionRadius, clusterBox,
  COUNT_LABEL_GAP, COUNT_LABEL_W,
} from '../../src/features/ru/shijingMap.js'

const REL = 'src/data/ru/shijing-map.json'
const SRC = 'src/data/ru/classics/shijing.json'
// 十五国风编次(毛诗):周南 召南 邶 鄘 卫 王 郑 齐 魏 唐 秦 陈 桧 曹 豳
export const GUOFENG = ['周南', '召南', '邶', '鄘', '卫', '王', '郑', '齐', '魏', '唐', '秦', '陈', '桧', '曹', '豳']
const NOTE_MAX = 80
const LATLON_RE = /[东西]经|[南北]纬|°/

const num = (v) => typeof v === 'number' && Number.isFinite(v)

export default function check({ ROOT, err, warn = () => {}, info = () => {}, readJson, chapterText }) {
  const TAG = '诗经国风图'
  const file = path.join(ROOT, REL)
  if (!fs.existsSync(file)) { err(`${TAG}: 缺 ${REL}`); return }
  const data = readJson(file)
  const book = readJson(path.join(ROOT, SRC))

  const W = data.view?.w, H = data.view?.h
  if (!num(W) || !num(H) || W <= 0 || H <= 0) { err(`${TAG}: view.w / view.h 须为正数`); return }
  const inCanvas = (x, y) => num(x) && num(y) && x >= 0 && x <= W && y >= 0 && y <= H

  const regions = Array.isArray(data.regions) ? data.regions : []
  if (regions.length !== GUOFENG.length) err(`${TAG}: 应有 ${GUOFENG.length} 组,现有 ${regions.length}`)

  const ids = new Set(), chs = new Set(), names = new Set()
  let totalPoems = 0
  regions.forEach((r, i) => {
    const t = `${TAG} ${r?.name ?? `#${i}`}`
    if (!r || typeof r !== 'object') { err(`${t}: 不是对象`); return }
    if (typeof r.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(r.id)) err(`${t}: id 须为小写字母串`)
    else if (ids.has(r.id)) err(`${t}: id 重复 ${r.id}`)
    else ids.add(r.id)
    if (!GUOFENG.includes(r.name)) err(`${t}: name 不在十五国风之列`)
    else if (names.has(r.name)) err(`${t}: name 重复`)
    else names.add(r.name)

    // ① 章:存在、章题含国名、未被别组占用
    if (!Number.isInteger(r.ch)) { err(`${t}: ch 须为整数`); return }
    if (chs.has(r.ch)) err(`${t}: ch ${r.ch} 与他组重复`)
    chs.add(r.ch)
    const chapter = book.chapters.find((c) => c.no === r.ch)
    if (!chapter) { err(`${t}: 原文里没有第 ${r.ch} 章`); return }
    if (!String(chapter.title || '').includes(r.name)) err(`${t}: 第 ${r.ch} 章章题「${chapter.title}」不含国名「${r.name}」`)

    // kw 回查:该章原文确有此字样
    const text = (typeof chapterText === 'function' ? chapterText('ru', 'shijing', r.ch) : null)
      ?? `${chapter.title}${chapter.paragraphs.map((p) => p.original).join('')}`
    if (typeof r.kw !== 'string' || !r.kw) err(`${t}: 缺 kw`)
    else if (!text.includes(r.kw)) err(`${t}: kw「${r.kw}」不在第 ${r.ch} 章原文里`)

    // ② 首数:从原文诗题段数出来
    const n = poemTitlesOf(chapter).length
    totalPoems += n
    if (r.poems !== n) err(`${t}: poems=${r.poems},原文第 ${r.ch} 章实有 ${n} 首`)
    if (typeof r.note !== 'string' || !r.note) err(`${t}: 缺 note`)
    else {
      if (!r.note.includes(`${n} 首`)) err(`${t}: note 须写明「${n} 首」(按原文诗题数)`)
      if ([...r.note].length > NOTE_MAX) warn(`${t}: note 超 ${NOTE_MAX} 字`)
      if (LATLON_RE.test(r.note)) err(`${t}: note 不许给经纬(示意图只表相对方位)`)
    }

    // ③ 几何:圆心在画布内;圆与右侧首数标签不被裁
    if (!inCanvas(r.x, r.y)) { err(`${t}: 坐标 (${r.x}, ${r.y}) 不在画布 ${W}×${H} 内`); return }
    const rad = regionRadius(n)
    if (r.x - rad < 0 || r.y - rad < 0 || r.y + rad > H || r.x + rad + COUNT_LABEL_GAP + COUNT_LABEL_W > W) {
      warn(`${t}: 圆或首数标签贴出画布边`)
    }
  })

  const expectChs = GUOFENG.map((_, i) => i + 1)
  if (regions.length === GUOFENG.length && !expectChs.every((c) => chs.has(c))) {
    err(`${TAG}: ch 须恰为前 15 章(国风),现为 ${[...chs].sort((a, b) => a - b).join(',')}`)
  }

  const valid = regions.filter((r) => r && num(r.x) && num(r.y) && typeof r.id === 'string')
  for (const e of orientationErrors(valid)) err(`${TAG} 方位: ${e}`)
  for (const [a, b] of overlappingPairs(valid)) err(`${TAG}: ${a} 与 ${b} 两圆相叠`)

  // 虚框(如「邶鄘卫皆故卫地」):成员须存在,框须在画布内
  const clusters = data.clusters ?? []
  if (!Array.isArray(clusters)) err(`${TAG}: clusters 须为数组`)
  else for (const c of clusters) {
    if (!c?.label) err(`${TAG} 虚框: 缺 label`)
    const bad = (c?.ids || []).filter((id) => !ids.has(id))
    if (!Array.isArray(c?.ids) || c.ids.length < 2 || bad.length) { err(`${TAG} 虚框「${c?.label}」: ids 须为 ≥2 个已有 id(${bad.join(',')})`); continue }
    const box = clusterBox(valid, c.ids)
    if (box && (box.x < 0 || box.y < 24 || box.x + box.w > W || box.y + box.h > H)) warn(`${TAG} 虚框「${c.label}」贴出画布边(顶上要留一行标题)`)
  }

  // 河道示意曲线:路径里的每个坐标都在画布内
  const rivers = data.rivers ?? []
  if (!Array.isArray(rivers)) err(`${TAG}: rivers 须为数组`)
  else {
    if (rivers.length > 3) warn(`${TAG}: 河道示意 ${rivers.length} 条,规格是一两条`)
    for (const rv of rivers) {
      const t = `${TAG} 河道「${rv?.name}」`
      if (!rv?.name) err(`${t}: 缺 name`)
      if (typeof rv?.d !== 'string' || !/^\s*M/.test(rv.d)) { err(`${t}: d 须为以 M 起头的路径`); continue }
      const ns = (rv.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
      if (ns.length < 4 || ns.length % 2) { err(`${t}: d 坐标须成对`); continue }
      for (let i = 0; i < ns.length; i += 2) {
        if (!inCanvas(ns[i], ns[i + 1])) { err(`${t}: 点 (${ns[i]}, ${ns[i + 1]}) 出画布`); break }
      }
      if (!inCanvas(rv.labelX, rv.labelY)) err(`${t}: 标签位置 labelX/labelY 不在画布内`)
    }
  }

  info(`诗经国风图: ${regions.length} 组 · ${totalPoems} 首 · 河道 ${rivers.length} 条`)
}
