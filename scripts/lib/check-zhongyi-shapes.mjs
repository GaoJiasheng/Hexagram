// 中医三件(design-v24 §13)的校验闸:
//   I1 本草矩阵 —— 十八类题名合「某部某品」且六部 × 三品齐全;每段切得出药名(shapes.js 同一函数)
//   I2 藏象图   —— suwen-zangxiang.json 每行 5 格 5 kw,kw 是所指段原文子串;五段各在第 4 篇
//   I3 六经目录 —— shanghan-liujing.json 二十二篇各归一处不重不漏;六经篇题含该经之名;引文是《伤寒例》所指段原文子串
// 铁律:只排结构,不出判断——这里也顺手查数据文件里没有断语字样。
import path from 'node:path'
import { parseBencao, BENCAO_BU, BENCAO_PIN } from '../../src/features/zhongyi/shapes.js'

const VERDICT_RE = /(必愈|可治|速效|自疗|服之|一剂|用量)/

export default function check({ ROOT, err, warn, info, readJson, chapterText }) {
  const book = (slug) => readJson(path.join(ROOT, `src/data/zhongyi/classics/${slug}.json`))

  // ── I1 本草 ──
  {
    const tag = '本草矩阵'
    const bc = book('bencaojing')
    const { cells, total, problems } = parseBencao(bc)
    for (const p of problems) err(`${tag}: ${p}`)
    if (bc.chapters.length !== BENCAO_BU.length * BENCAO_PIN.length) err(`${tag}: 应为 18 类,实为 ${bc.chapters.length}`)
    info(`${tag}: ${Object.keys(cells).length} 格 · ${total} 味`)
  }

  // ── I2 藏象 ──
  {
    const tag = '素问藏象图'
    const D = readJson(path.join(ROOT, 'src/data/zhongyi/suwen-zangxiang.json'))
    const sw = book(D.source.slug)
    const ch = sw.chapters.find((c) => c.no === D.source.ch)
    if (!ch) { err(`${tag}: 找不到第 ${D.source.ch} 篇`); return }
    if (!Array.isArray(D.cols) || D.cols.length !== 5) err(`${tag}: cols 须为 5 列`)
    const whole = chapterText('zhongyi', D.source.slug, D.source.ch) || ''
    let n = 0
    const labels = new Set()
    for (const r of D.rows) {
      if (labels.has(r.label)) err(`${tag}: 行「${r.label}」重复`)
      labels.add(r.label)
      if (!Array.isArray(r.cells) || r.cells.length !== 5 || !Array.isArray(r.kw) || r.kw.length !== 5) { err(`${tag} 行「${r.label}」: 须为 5 格 5 kw`); continue }
      r.kw.forEach((kw, i) => {
        const col = D.cols[i]
        const para = ch.paragraphs[col.para]?.original
        if (!para) { err(`${tag} 行「${r.label}」第 ${i + 1} 格: 段 ${col.para} 不存在`); return }
        if (!para.includes(kw)) err(`${tag} 行「${r.label}」第 ${i + 1} 格: kw「${kw}」不在第 ${col.para + 1} 段原文里`)
        if (!whole.includes(kw)) err(`${tag}: kw「${kw}」不在该章原文里`)
        if (!kw.includes(r.cells[i].replace(/^在/, '').slice(-1)) && !r.cells[i].includes(kw)) warn(`${tag} 行「${r.label}」第 ${i + 1} 格: 格值「${r.cells[i]}」与 kw「${kw}」不相干?`)
        n++
      })
    }
    for (const c of D.cols) {
      const para = ch.paragraphs[c.para]?.original || ''
      if (!para.includes(`${c.fang}生`)) err(`${tag}: 第 ${c.para + 1} 段里没有「${c.fang}生」`)   // 第一段以「歧伯对曰」起,故不查段首
    }
    info(`${tag}: ${D.rows.length} 行 × 5 · ${n} 格逐格回查`)
  }

  // ── I3 六经 ──
  {
    const tag = '伤寒六经目录'
    const D = readJson(path.join(ROOT, 'src/data/zhongyi/shanghan-liujing.json'))
    const sh = book(D.source.slug)
    const byNo = new Map(sh.chapters.map((c) => [c.no, c]))
    const li = sh.chapters.find((c) => c.no === D.source.ch)
    if (!li) { err(`${tag}: 找不到第 ${D.source.ch} 篇`); return }
    const seen = new Map()
    const take = (no, who) => {
      if (!byNo.has(no)) err(`${tag} ${who}: 第 ${no} 篇不存在`)
      if (seen.has(no)) err(`${tag}: 第 ${no} 篇既在「${seen.get(no)}」又在「${who}」`)
      seen.set(no, who)
    }
    const quoteOk = (q, para, who) => {
      const p = li.paragraphs[para]?.original
      if (!p) { err(`${tag} ${who}: 段 ${para} 不存在`); return }
      if (!q || !p.includes(q)) err(`${tag} ${who}: 引文「${q}」不在《${D.source.title}》第 ${para + 1} 段里`)
    }
    for (const c of D.channels) {
      for (const no of c.chapters) {
        take(no, c.label)
        const t = byNo.get(no)?.title || ''
        if (!t.includes(c.label)) err(`${tag} ${c.label}: 第 ${no} 篇题「${t}」不含「${c.label}」`)
      }
      quoteOk(c.quote, c.para, c.label)
    }
    quoteOk(D.sanyang.quote, D.sanyang.para, D.sanyang.label)
    quoteOk(D.sanyin.quote, D.sanyin.para, D.sanyin.label)
    for (const g of D.groups) {
      for (const no of g.chapters) take(no, g.label)
      if (VERDICT_RE.test(g.note || '')) err(`${tag} 组「${g.label}」note 含断语用字`)
    }
    for (const c of sh.chapters) if (!seen.has(c.no)) err(`${tag}: 第 ${c.no} 篇「${c.title}」没归到任何一块`)
    info(`${tag}: 六经 ${D.channels.length} 块 · ${D.groups.length} 组 · ${seen.size}/${sh.chapters.length} 篇归位`)
  }
}
