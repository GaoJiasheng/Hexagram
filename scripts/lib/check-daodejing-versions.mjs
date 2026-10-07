// 《道德经》目录页「版本流变条」的校验闸:
//   daodejing-versions.json 每个节点的 cite.quote 必须是站内书级导读(daodu/daodejing.json)的精确子串——
//   条上只写导读里讲过的事,导读没讲的不上条。
//   导读全文 = 所有 block 的 text / original / translation 字段拼接。
import path from 'node:path'

const VERDICT_RE = /((?<![未不何])必|肯定|毫无疑问|无疑|定然)/   // 「未必」「不必」是存疑口吻,不算断语
const QUOTE_MIN = 10
const QUOTE_MAX = 60

export default function check({ ROOT, err, warn, info, readJson }) {
  const tag = '道德经版本流变'
  const D = readJson(path.join(ROOT, 'src/data/dao/daodejing-versions.json'))
  const slug = D?.source?.daodu || 'daodejing'
  const daodu = readJson(path.join(ROOT, `src/data/dao/daodu/${slug}.json`))
  const whole = (daodu.blocks || [])
    .flatMap((b) => [b.text, b.original, b.translation])
    .filter((s) => typeof s === 'string' && s)
    .join('\n')
  if (!whole) { err(`${tag}: 导读 ${slug} 无正文`); return }

  const nodes = Array.isArray(D.nodes) ? D.nodes : []
  if (nodes.length < 3) err(`${tag}: 节点至少 3 个,实为 ${nodes.length}`)

  const ids = new Set()
  let nCite = 0
  let nBad = 0
  for (const [i, n] of nodes.entries()) {
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
      if (typeof q !== 'string' || q.length < QUOTE_MIN || q.length > QUOTE_MAX) {
        nBad++
        err(`${at}: quote 长度须 ${QUOTE_MIN}–${QUOTE_MAX},实为 ${typeof q === 'string' ? q.length : '非字符串'}「${q}」`)
        continue
      }
      if (!whole.includes(q)) {
        nBad++
        err(`${at}: quote「${q}」不是导读 ${slug} 原文子串`)
      }
    }
  }
  info(`${tag}: ${nodes.length} 节点 · ${nCite} 引文 · ${nBad} 坏引文`)
}
