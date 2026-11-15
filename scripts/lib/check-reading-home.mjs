// 读经站组首页「从哪里读起」(src/data/reading-home.json)的校验闸:
//   · 路径里的书都在该组 texts.json 里、且可读(status ≠ pending);一本书只排一次;全组的书都排到(漏了 warn)
//   · why ≤ 14 字;带 cite 的 why 与 basis.quote 必须是该组书级导读的精确子串——「朱子怎么说」不许凭记忆写
//   · 不带 cite 的主线必须把 basis.label 标成「本站建议」,别让本站的排法冒充古人成说
import fs from 'node:fs'
import path from 'node:path'

export default function check({ ROOT, err, warn, info, readJson }) {
  const file = path.join(ROOT, 'src/data/reading-home.json')
  if (!fs.existsSync(file)) return
  const plans = readJson(file)
  const daoduText = (corpus, slug) => {
    let cur = slug
    for (let i = 0; i < 3; i++) {
      const fp = path.join(ROOT, `src/data/${corpus}/daodu/${cur}.json`)
      if (!fs.existsSync(fp)) return null
      const d = readJson(fp)
      if (d?.aliasOf && !Array.isArray(d.blocks)) { cur = d.aliasOf; continue }
      return JSON.stringify(d.blocks || [])   // 表格行、列表项里的字也算导读原文
    }
    return null
  }
  let nGroups = 0, nBooks = 0, nCites = 0
  for (const [corpus, plan] of Object.entries(plans)) {
    if (corpus.startsWith('_')) continue
    const tag = `读经首页 ${corpus}`
    const tf = path.join(ROOT, `src/data/${corpus}/texts.json`)
    if (!fs.existsSync(tf)) { err(`${tag}: 没有这一组的 texts.json`); continue }
    const texts = readJson(tf)
    const bySlug = new Map(texts.map((t) => [t.slug, t]))
    const seen = new Set()
    const place = (slug, where) => {
      const t = bySlug.get(slug)
      if (!t) return err(`${tag}: ${where} 里的 ${slug} 不在书目里`)
      if (t.status === 'pending') err(`${tag}: ${where} 里的 ${slug} 还不可读`)
      if (seen.has(slug)) err(`${tag}: ${slug} 排了两次`)
      seen.add(slug); nBooks++
    }
    const citeOk = (quote, cite, where) => {
      const text = daoduText(corpus, cite)
      if (text == null) return err(`${tag}: ${where} 引的导读 ${cite} 不存在`)
      // JSON.stringify 会转义引号,书名号等不受影响;引文里不该有双引号
      if (!text.includes(quote)) err(`${tag}: ${where}「${quote.slice(0, 16)}」不是《${cite}》导读的原文`)
      nCites++
    }
    if (!Array.isArray(plan.main) || plan.main.length < 2) { err(`${tag}: main 至少两步`); continue }
    let uncited = 0
    plan.main.forEach((s, i) => {
      place(s.slug, `main[${i}]`)
      if (!s.why || [...s.why].length > 14) err(`${tag}: main[${i}].why 须 1–14 字`)
      if (s.cite) citeOk(s.why, s.cite, `main[${i}].why`); else uncited++
    })
    if (plan.basis?.quote) {
      if (!plan.basis.cite) err(`${tag}: basis.quote 缺 cite`); else citeOk(plan.basis.quote, plan.basis.cite, 'basis.quote')
    }
    if (!plan.basis?.label) err(`${tag}: 缺 basis.label`)
    if (uncited > 0 && !/本站建议/.test(plan.basis?.label || '')) err(`${tag}: 主线有不带出处的理由,basis.label 须标「本站建议」`)
    for (const [i, b] of (plan.branches || []).entries()) {
      if (!b.title || !Array.isArray(b.slugs) || !b.slugs.length) { err(`${tag}: branches[${i}] 缺 title / slugs`); continue }
      b.slugs.forEach((s) => place(s, `branches[${i}]`))
    }
    for (const s of plan.more?.slugs || []) place(s, 'more')
    const left = texts.filter((t) => t.status !== 'pending' && !seen.has(t.slug)).map((t) => t.slug)
    if (left.length) warn(`${tag}: 这些书没排进首页:${left.join(' ')}`)
    nGroups++
  }
  info(`读经首页: ${nGroups} 组 · ${nBooks} 本排进路径 · ${nCites} 处引导读原文 · 0 坏引文`)
}
