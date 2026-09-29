// 校验闸 · 《韩非子》储说「经—说」对应表(design-v24 §1 / §0.2)。
// 查三层:① 生成物形状与区间自洽;② 逐条回查原文(经条在经部、说组首段以「X。」起头且序号对、
// 经条数 = 原文里数出来的说组数——**独立于派生脚本重数一遍**);③ 生成物与按现行原文复算的结果一致(防漂移)。
import path from 'node:path'
import fs from 'node:fs'
import { CHUSHUO_CHAPTERS, HEAD_RE, numOf, deriveChushuo } from './hanfeizi-chushuo.mjs'

const REL = 'src/data/fa/hanfeizi-chushuo.json'
const SRC = 'src/data/fa/classics/hanfeizi.json'

export default function check({ ROOT, err, info, readJson }) {
  const file = path.join(ROOT, REL)
  if (!fs.existsSync(file)) { err(`储说经说: 缺 ${REL}(node scripts/gen-hanfeizi-chushuo.mjs)`); return }
  const data = readJson(file)
  const book = readJson(path.join(ROOT, SRC))
  if (!Array.isArray(data.chapters)) { err(`储说经说: ${REL} 缺 chapters 数组`); return }

  const seen = new Set()
  let nJing = 0, nShuo = 0
  for (const c of data.chapters) {
    const tag = `储说经说 第 ${c.ch} 章`
    if (!CHUSHUO_CHAPTERS.includes(c.ch)) { err(`${tag}: 不在储说六篇(30–35)之内`); continue }
    if (seen.has(c.ch)) { err(`${tag}: 重复`); continue }
    seen.add(c.ch)
    const chapter = book.chapters.find((x) => x.no === c.ch)
    if (!chapter) { err(`${tag}: 原文里没有这一章`); continue }
    if (chapter.title !== c.title) err(`${tag}: 章题「${c.title}」与原文「${chapter.title}」不符`)
    const ps = chapter.paragraphs.map((p) => p.original.trim())
    const n = ps.length
    const jing = c.jing || []
    if (!jing.length) { err(`${tag}: jing 为空`); continue }
    const jingEnd = jing[0].shuoFrom   // 经部 = [0, 首个说组)

    // 原文里独立数说组:说部内以「X。」起头的段
    const groups = []
    for (let i = jingEnd; i < n; i++) if (HEAD_RE.test(ps[i])) groups.push(i)
    if (groups.length !== jing.length) err(`${tag}: 经 ${jing.length} 条 ≠ 原文说组 ${groups.length} 组`)

    if (c.intro != null && (c.intro !== 0 || jing[0].para === 0)) err(`${tag}: intro 只许是首段、且首段不是经条`)
    if (c.youjingPara != null) {
      if (!/右经$/.test(ps[c.youjingPara] || '')) err(`${tag}: youjingPara ${c.youjingPara} 段不以「右经」收`)
      if (c.youjingPara !== jingEnd - 1) err(`${tag}: 「右经」段之后应紧接说一`)
    }

    jing.forEach((j, k) => {
      const t = `${tag} 经${k + 1}`
      if (j.no !== k + 1) err(`${t}: no=${j.no},应为 ${k + 1}`)
      for (const f of ['para', 'shuoFrom', 'shuoTo']) {
        if (!Number.isInteger(j[f]) || j[f] < 0 || j[f] >= n) err(`${t}: ${f}=${j[f]} 越界(本章 ${n} 段)`)
      }
      // 经条正文段:须在经部内(「其说在 / 说在」不强求——34 条经里有 16 条原文就没写,如内储说上「诡使」「倒言」)
      if (!(j.para < jingEnd)) err(`${t}: para ${j.para} 不在经部(经部止于第 ${jingEnd - 1} 段)`)
      else if (HEAD_RE.test(ps[j.para]) && numOf(ps[j.para][0]) !== j.no) err(`${t}: 经条段起头序号与 no 不符`)
      if (j.labelPara != null) {
        if (j.labelPara !== j.para + 1) err(`${t}: labelPara 应紧跟经条正文段`)
        else if (!j.label || !(ps[j.labelPara] || '').startsWith(j.label)) err(`${t}: 标签段「${ps[j.labelPara]}」与 label「${j.label}」不符`)
      }
      // 说组首段:以「X。」起头,且 X 就是本条序号
      const m = HEAD_RE.exec(ps[j.shuoFrom] || '')
      if (!m) err(`${t}: 说组首段(第 ${j.shuoFrom} 段)不以「一。」「二。」…起头`)
      else if (numOf(m[1]) !== j.no) err(`${t}: 说组首段起头「${m[1]}。」与经条序号 ${j.no} 不符`)
      if (j.shuoTo < j.shuoFrom) err(`${t}: shuoTo < shuoFrom`)
      const next = jing[k + 1]
      if (next && next.shuoFrom !== j.shuoTo + 1) err(`${t}: 说组区间与下一组不相接`)
      if (!next && j.shuoTo !== n - 1) err(`${t}: 末组应止于本章末段(第 ${n - 1} 段)`)
      if (k > 0 && j.para <= jing[k - 1].para) err(`${t}: 经条段次序颠倒`)
    })
    nJing += jing.length
    nShuo += groups.length
  }
  for (const no of CHUSHUO_CHAPTERS) if (!seen.has(no)) err(`储说经说: 缺第 ${no} 章`)

  // 生成物 vs 按现行原文复算:原文管线重跑后段落有变,这里会逮到
  try {
    const fresh = deriveChushuo(book)
    if (stable(fresh.chapters) !== stable(data.chapters)) {
      err(`储说经说: ${REL} 与按现行原文复算的结果不一致——重跑 node scripts/gen-hanfeizi-chushuo.mjs`)
    }
  } catch (e) {
    err(`储说经说: 按现行原文复算失败——${e.message}`)
  }

  info(`储说经说: ${seen.size} 篇 · ${nJing} 经 · ${nShuo} 说`)
}

// 键序无关的序列化(生成物为便于人读把 youjingPara 排在 jing 之前)
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}
