// 详注层的校验闸(docs/xiangzhu-spec.md §3),挂在 check-data 7f。扫 src/data/<corpus>/xiangzhu/<slug>.json,逐条核:
//   1. 坐标存在:章在原文数据里;段下标 / 部位键找得到、该处原文不空
//   2. k 是该处原文子串;同处各条按首次出现位置不重叠、k 不重复
//   3. d 1–40 字;x 40–150 字(按 Unicode 码点);r 有则非空
//   4. 只许 k d x r 四个字段
// 不过即错误(check-data 失败)。规则本身在 scripts/lib/xiangzhu.mjs 的 checkPlace,notes-apply 合并时用的是同一份。
import fs from 'node:fs'
import path from 'node:path'
import { originalIndex, checkPlace, len } from './xiangzhu.mjs'

export default function check({ ROOT, err, info, readJson }) {
  const DATA = path.join(ROOT, 'src/data')
  let nBooks = 0, nNotes = 0
  const perBook = []
  for (const corpus of fs.readdirSync(DATA).sort()) {
    const dir = path.join(DATA, corpus, 'xiangzhu')
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const slug = f.replace(/\.json$/, '')
      const tag = `详注 ${corpus}/${slug}`
      const idx = originalIndex(corpus, slug)
      if (!idx) { err(`${tag}: 站内没有这本书的原文数据`); continue }
      let t
      try { t = readJson(path.join(dir, f)) } catch (e) { err(`${tag}: 不是合法 JSON——${e.message}`); continue }
      if (!t || typeof t !== 'object' || Array.isArray(t)) { err(`${tag}: 顶层应为 { 章号: { 段: [...] } }`); continue }
      nBooks++
      let n = 0
      for (const [ch, segs] of Object.entries(t)) {
        const chap = idx.get(ch)
        if (!chap) { err(`${tag}: 第 ${ch} 章不存在`); continue }
        if (!segs || typeof segs !== 'object' || Array.isArray(segs)) { err(`${tag} 第 ${ch} 章: 应为 { 段: [...] }`); continue }
        for (const [seg, notes] of Object.entries(segs)) {
          const o = chap.get(seg)
          if (o === undefined) { err(`${tag} 第 ${ch} 章: 段「${seg}」不存在`); continue }
          if (!Array.isArray(notes) || !notes.length) { err(`${tag} ${ch}/${seg}: 应为非空数组`); continue }
          const { good, bad } = checkPlace(o, notes, { strict: true })
          for (const b of bad) {
            const k = b.n && typeof b.n === 'object' ? b.n.k : ''
            const extra = b.why.startsWith('d') ? `(${len(b.n.d)} 字)` : b.why.startsWith('x') ? `(${len(b.n.x)} 字)` : ''
            err(`${tag} ${ch}/${seg}「${k}」: ${b.why}${extra}`)
          }
          n += good.length + bad.length
        }
      }
      nNotes += n
      perBook.push(`${corpus}/${slug} ${n}`)
    }
  }
  if (nBooks) info(`详注: ${nBooks} 本 · ${nNotes} 条(${perBook.join(' · ')})`)
}
