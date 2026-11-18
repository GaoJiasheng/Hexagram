// 白话代理复核 · 通用备料(2026-11-18,owner「B5 跑一轮复核」:照观数那轮推到其余各组)。
// 做法与观数那轮(mingli-review-prep.mjs,留作记录不动)相同:每章一个 opus 代理,读「原文(带段号 + 站内译文)+ 白话 + 本组红线」
// 的输入分片,把修正稿写到输出分片、只交回「改了什么」;主会话 baihua-review-apply.mjs 逐片校验后合并。
//   node scripts/baihua-review-prep.mjs <批名> <组 | 组/书>…      例:node scripts/baihua-review-prep.mjs b1 zhongyi moulue fo zong
//   → scripts/.baihua-review/<批名>/{in,out}/*.json + units.json,打印章数与原文字数
//   Workflow({ scriptPath: 'scripts/baihua-review-wf.js', args: <args.json 内容> })
//   node scripts/baihua-review-apply.mjs <批名> <workflow .output>…
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSubKey, subChapter } from './lib/sub-chapter.mjs'
import { redlines } from './lib/baihua-redlines.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const workDir = (batch) => path.join(ROOT, 'scripts/.baihua-review', batch)

export const GROUP_NAME = {
  yijing: '易经研习', dao: '道藏研读', ru: '儒典研读', fo: '释典研读', xin: '阳明心学', fa: '法家', mo: '墨家', bing: '兵家',
  zong: '纵横家', zhongyi: '中医典籍', moulue: '谋略杂纂', tangshi: '唐诗', songci: '宋词', yuanqu: '元曲', guwen: '古文研读',
}

// 易经六十四卦的原文在 hexagrams.json(不在 classics/),按卦辞 → 彖 → 大象 → 六爻(各带小象)→ 用九用六 → 文言 排成段
export function hexagramParas(hex) {
  const out = []
  const push = (label, x) => { if (x?.original) out.push({ original: `${label ? label + '　' : ''}${x.original}`, translation: x.translation || '' }) }
  push('', hex.judgment); push('', hex.tuan); push('', hex.daxiang)
  for (const l of hex.lines || []) { push(l.title, l); push('', l.xiaoxiang) }
  if (hex.extra?.use) { push(hex.extra.use.title, hex.extra.use); push('', hex.extra.use.xiaoxiang) }
  for (const w of hex.extra?.wenyan || []) push('文言', w)
  return out
}

function chapterOf(corpus, slug, data, key) {
  if (corpus === 'yijing' && slug === 'hexagrams') {
    const h = data.find((x) => x.id === Number(key))
    return h ? { title: `${h.name}卦`, paras: hexagramParas(h), offset: 0 } : null
  }
  if (isSubKey(key)) {
    const sub = subChapter(ROOT, corpus, slug, data, key)
    if (!sub) return null
    return { title: `${sub.chapter.title || ''}${sub.title ? ` · ${sub.title}` : ''}`, paras: sub.paragraphs, offset: sub.from ?? 0 }
  }
  const c = data.chapters.find((x) => x.no === Number(key))
  return c ? { title: c.title || '', paras: c.paragraphs, offset: 0 } : null
}

export const stripSvg = (ch) => ({ ...ch, blocks: ch.blocks.map((b) => (b.type === 'figure' ? { ...b, svg: '__SVG__' } : b)) })
const keyOrder = (a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]) || Number(a.split('-')[1] || 0) - Number(b.split('-')[1] || 0)

export function main(batch, targets) {
  const WORK = workDir(batch), IN = path.join(WORK, 'in'), OUT = path.join(WORK, 'out')
  fs.mkdirSync(IN, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
  const units = []
  for (const t of targets) {
    const [corpus, only] = t.split('/')
    const dir = path.join(ROOT, `src/data/${corpus}/baihua`)
    if (!fs.existsSync(dir)) { console.error(`✗ ${corpus} 没有白话目录`); continue }
    const texts = fs.existsSync(path.join(ROOT, `src/data/${corpus}/texts.json`)) ? JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/texts.json`), 'utf8')) : []
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const slug = f.replace(/\.json$/, '')
      if (only && only !== slug) continue
      const baihua = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      const dataFile = corpus === 'yijing' && slug === 'hexagrams' ? 'src/data/yijing/hexagrams.json' : `src/data/${corpus}/classics/${slug}.json`
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, dataFile), 'utf8'))
      const bookTitle = texts.find((x) => x.slug === slug)?.title || data.title || (slug === 'hexagrams' ? '周易' : slug)
      const red = redlines(slug)[corpus] || ''
      for (const key of Object.keys(baihua).sort(keyOrder)) {
        const ch = chapterOf(corpus, slug, data, key)
        if (!ch) { console.error(`✗ ${corpus}/${slug}/${key} 找不到原文章`); continue }
        const original = ch.paras.map((p, i) => {
          const tx = typeof p === 'string' ? p : p.original
          const tr = typeof p === 'object' && p.translation ? `\n    译:${p.translation}` : ''
          return `[${ch.offset + i + 1}] ${tx}${tr}`
        }).join('\n')
        const id = `${corpus}-${slug}-${key}`
        const input = { corpus, group: GROUP_NAME[corpus] || corpus, slug, key, book: bookTitle, chapter: ch.title, redline: red, original, baihua: stripSvg(baihua[key]) }
        const inFile = path.join(IN, `${id}.json`)
        fs.writeFileSync(inFile, JSON.stringify(input, null, 1))
        units.push({ corpus, slug, key, group: input.group, label: `${bookTitle}·${key}`, chars: original.length, inFile, outFile: path.join(OUT, `${id}.json`) })
      }
    }
  }
  fs.writeFileSync(path.join(WORK, 'units.json'), JSON.stringify(units))
  // 给 Workflow 的参数:{ dir, ids }——工作流脚本据此自己拼路径,不手抄
  fs.writeFileSync(path.join(WORK, 'args.json'), JSON.stringify({ dir: WORK, ids: units.map((u) => `${u.corpus}|${u.slug}|${u.key}`) }))
  const chars = units.reduce((n, u) => n + u.chars, 0)
  const by = {}
  for (const u of units) by[u.corpus] = (by[u.corpus] || 0) + 1
  console.log(`备料 ${units.length} 章 · 原文共 ${chars} 字 · ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' / ')} → ${WORK}`)
  return units
}

if (process.argv[1] && fileURLToPath(new URL(import.meta.url)) === path.resolve(process.argv[1])) {
  const [batch, ...targets] = process.argv.slice(2)
  if (!batch || !targets.length) { console.log('用法: node scripts/baihua-review-prep.mjs <批名> <组 | 组/书>…'); process.exit(2) }
  main(batch, targets)
}
