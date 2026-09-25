// 从白话 callout / 注疏 note / 译文括注里抽「底本 X → 当作 Y」对,并在本站原文里定位
import fs from 'fs'
import path from 'path'
import { HERE, ROOT } from './lib.mjs'

const cl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/classics/ditiansui.json'), 'utf8'))
const chText = (no) => cl.chapters[no - 1].paragraphs.map((p, i) => ({ i, t: p.original, skip: !!p.pillars }))
const pairs = []
const VERB = '(?:当作|当是|当为|当读作|应作|应为|疑为|疑当作|疑是|是|为|当依[^「」，。]{0,8}作)'

// 白话 callout
const bh = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/baihua/ditiansui.json'), 'utf8'))
for (const [k, ch] of Object.entries(bh)) {
  for (const b of ch.blocks || []) {
    if (b.type !== 'callout') continue
    for (const raw of b.items || []) {
      const t = raw.replace(/\*\*/g, '')
      // 「A」的「x」当作「y」
      for (const m of t.matchAll(new RegExp(`「([^「」]{2,30})」(?:[^「」，。；]{0,6})的「([^「」]{1,6})」(?:都|也|均)?${VERB}「([^「」]{1,8})」`, 'g'))) {
        const [, A, x, y] = m
        if (A.includes(x)) pairs.push({ src: 'baihua', ch: +k, from: A, to: A.replace(x, y), note: m[0] })
      }
      // 「A」当作「B」(A、B 长度相近,且 A 不是前一模式的片段)
      for (const m of t.matchAll(new RegExp(`「([^「」]{2,30})」(?:[，,]?\\s*)${VERB}「([^「」]{1,30})」`, 'g'))) {
        const [, A, B] = m
        if (Math.abs([...A].length - [...B].length) <= 2) pairs.push({ src: 'baihua', ch: +k, from: A, to: B, note: m[0] })
      }
      // 「A」（当作「B」）
      for (const m of t.matchAll(/「([^「」]{2,30})」[（(]([^「」（）()]*)「([^「」]{1,30})」[）)]/g)) {
        const [, A, verb, B] = m
        if (/当|应|作/.test(verb) && Math.abs([...A].length - [...B].length) <= 3) pairs.push({ src: 'baihua', ch: +k, from: A, to: B, note: m[0] })
      }
    }
  }
}
// 注疏
const zs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/zhushi-anchored/ditiansui.json'), 'utf8'))
for (const [k, paras] of Object.entries(zs)) {
  for (const [pi, items] of Object.entries(paras)) {
    for (const it of items) {
      const n = it.note || ''
      if (!/当作|当为|之讹|形近|疑当|讹|衍|脱[一二三两字文误]|应作|他本|通行本/.test(n)) continue
      const m = n.match(/^「?([^「」，。；、]{1,6})」?(?:疑)?(?:当作|当为|应作)「?([^「」，。；、（）()]{1,6})」?/)
      let from = it.term, to = null
      if (m && it.term.includes(m[1])) to = it.term.replace(m[1], m[2])
      pairs.push({ src: 'zhushi', ch: +k, para: +pi, from, to, note: n })
    }
  }
}

// 系统扫描(文言不当有的字 / 干支规则 / 同书正写压倒多数)
const SCANS = [
  { re: /这/g, to: '之', why: '文言无「这」字(输入法讹),同位正写作「之」' },
  { re: /(?<=[戊甲])已|已(?=[土未酉丑巳])/g, to: '己', why: '干支语境,「已」非天干' },
  { re: /仁(?=[路途版籍])|(?<=出)仁/g, to: '仕', why: '仕路28/仕途8/出仕27 vs 仁路6/仁途1/出仁2,同「仁至→仕至」' },
  { re: /柘/g, to: '枯', why: '「凋枯/时支枯/清枯」,柘不成义;同书「枯」76 见' },
  { re: /为了(?=端庄)|灭了(?=之意)/g, to: null, why: '了/子、了/人形近' },
]
for (const c of cl.chapters) c.paragraphs.forEach((p, i) => {
  if (p.pillars) return
  for (const sc of SCANS) for (const m of p.original.matchAll(sc.re)) {
    const L = p.original.slice(Math.max(0, m.index - 3), m.index)
    const from = L + m[0] + p.original.slice(m.index + m[0].length, m.index + m[0].length + 1)
    let to = sc.to != null ? L + sc.to + p.original.slice(m.index + m[0].length, m.index + m[0].length + 1) : null
    if (m[0] === '为了') to = L + '为人' + p.original.slice(m.index + 2, m.index + 3)
    if (m[0] === '灭了') to = L + '灭子' + p.original.slice(m.index + 2, m.index + 3)
    pairs.push({ src: 'scan', ch: c.no, para: i, from, to, note: sc.why })
  }
})
// 定位
for (const p of pairs) {
  const paras = chText(p.ch)
  const hits = []
  for (const q of paras) {
    if (q.skip) continue
    if (p.para != null && q.i !== p.para) continue
    let j = q.t.indexOf(p.from)
    while (j >= 0) { hits.push({ para: q.i, off: j }); j = q.t.indexOf(p.from, j + 1) }
  }
  p.hits = hits
}
fs.writeFileSync(path.join(HERE, 'note-pairs.json'), JSON.stringify(pairs, null, 1))
const c = {}
for (const p of pairs) { const k = p.src + (p.hits.length ? ':located' : ':unlocated') + (p.to ? ':to' : ':noto'); c[k] = (c[k] || 0) + 1 }
console.log(c)
