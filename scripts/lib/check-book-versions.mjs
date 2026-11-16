// 典籍目录页「版本流变条」的通用校验闸(推广自 check-daodejing-versions.mjs):
//   遍历各组 texts.json 里带 `versions` 字段的书,读 src/data/<组>/<versions>.json,
//   每个节点的 cite.quote 必须是站内书级导读的精确子串——条上只写导读里讲过的事,导读没讲的不上条。
//   导读按 cite.daodu(可选,逐条覆盖)或数据顶层 source.daodu 取,组用书所在的组;导读若是 { aliasOf } 壳则跟过去。
//   导读全文 = 所有 block 的 text / original / translation 字段拼接。
//   比对前去掉导读里的 `**` 加粗记号(2026-11-16):引文本身不许带 `**`。
//   同一份数据被几本书共用(庄子内 / 外 / 杂三篇共挂 zhuangzi-versions)只核一次。
import fs from 'node:fs'
import path from 'node:path'

const GROUPS = ['dao', 'ru', 'fo', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'mingli', 'guwen', 'tangshi', 'songci', 'yuanqu']
const VERDICT_RE = /((?<![未不何])必|肯定|毫无疑问|无疑|定然)/   // 「未必」「不必」是存疑口吻,不算断语
const QUOTE_MIN = 10
const QUOTE_MAX = 60

export default function check({ ROOT, err, warn, info, readJson }) {
  const tagAll = '版本流变'
  const wholeCache = new Map()
  const daoduWhole = (g, slug) => {
    const key = `${g}/${slug}`
    if (wholeCache.has(key)) return wholeCache.get(key)
    let whole = null
    let cur = slug
    for (let hop = 0; hop < 3 && cur; hop++) {
      const fp = path.join(ROOT, `src/data/${g}/daodu/${cur}.json`)
      if (!fs.existsSync(fp)) break
      const d = readJson(fp)
      if (d?.aliasOf && !Array.isArray(d.blocks)) { cur = d.aliasOf; continue }
      whole = (d.blocks || [])
        .flatMap((b) => [b.text, b.original, b.translation])
        .filter((s) => typeof s === 'string' && s)
        .join('\n')
        .replace(/\*\*/g, '') || null   // 加粗记号不算字:条上的引文是纯文本,「**朱熹**的《集注》」可以整句引成「朱熹的《集注》」
      break
    }
    wholeCache.set(key, whole)
    return whole
  }

  const seen = new Set()
  let nBook = 0, nNode = 0, nCite = 0, nBad = 0

  for (const g of GROUPS) {
    const tp = path.join(ROOT, `src/data/${g}/texts.json`)
    if (!fs.existsSync(tp)) continue
    let texts
    try { texts = readJson(tp) } catch { continue }   // 读取失败由目录页闸报
    if (!Array.isArray(texts)) continue

    for (const b of texts) {
      if (b.versions == null) continue
      nBook++
      if (typeof b.versions !== 'string') { err(`${tagAll} ${g}/${b.slug}: versions 须为字符串`); continue }
      const key = `${g}/${b.versions}`
      if (seen.has(key)) continue
      seen.add(key)

      const tag = `${tagAll} ${key}`
      const fp = path.join(ROOT, `src/data/${g}/${b.versions}.json`)
      if (!fs.existsSync(fp)) { err(`${tag}: 文件不存在 src/data/${key}.json`); continue }
      let D
      try { D = readJson(fp) } catch (e) { err(`${tag}: 读取失败 ${e.message}`); continue }

      const defSlug = D?.source?.daodu || b.slug
      const nodes = Array.isArray(D.nodes) ? D.nodes : []
      if (nodes.length < 3) err(`${tag}: 节点至少 3 个,实为 ${nodes.length}`)

      const ids = new Set()
      for (const [i, n] of nodes.entries()) {
        nNode++
        const at = `${tag} 节点 ${i + 1}「${n.label || n.id || '?'}」`
        if (!n.id) err(`${at}: 缺 id`)
        else if (ids.has(n.id)) err(`${at}: id「${n.id}」重复`)
        else ids.add(n.id)
        for (const k of ['label', 'era', 'text']) {
          if (typeof n[k] !== 'string' || !n[k].trim()) err(`${at}: ${k} 为空`)
        }
        if (typeof n.text === 'string') {
          const m = n.text.match(VERDICT_RE)
          if (m) warn(`${at}: text 含断语字样「${m[0]}」`)
        }
        const cites = Array.isArray(n.cites) ? n.cites : []
        if (cites.length < 1) err(`${at}: 至少 1 条 cite`)
        for (const c of cites) {
          nCite++
          const q = c?.quote
          if (typeof q === 'string' && q.includes('**')) { nBad++; err(`${at}: quote 不许带加粗记号「${q}」`); continue }
          if (typeof q !== 'string' || q.length < QUOTE_MIN || q.length > QUOTE_MAX) {
            nBad++
            err(`${at}: quote 长度须 ${QUOTE_MIN}–${QUOTE_MAX},实为 ${typeof q === 'string' ? q.length : '非字符串'}「${q}」`)
            continue
          }
          const slug = c.daodu || defSlug
          const whole = daoduWhole(g, slug)
          if (!whole) { nBad++; err(`${at}: 导读 ${g}/daodu/${slug} 不存在或无正文`); continue }
          if (!whole.includes(q)) {
            nBad++
            err(`${at}: quote「${q}」不是导读 ${g}/${slug} 原文子串`)
          }
        }
      }
    }
  }
  info(`${tagAll}: ${nBook} 本 · ${nNode} 节点 · ${nCite} 引文 · ${nBad} 坏引文`)
}
