#!/usr/bin/env node
// 存量白话文章的富文本化「机械重分块」(v22.1)。
//
// 用法:
//   node scripts/reblock-auto.mjs <corpus> <slug> [--write] [--pulls=选句文件.json]
//   node scripts/reblock-auto.mjs <corpus> <slug> --candidates   # 只导出 pull 候选,供人工挑
//
// 设计:规则由《道德经》试点(81 章人工分块)反推而来 —— 三种块是**纯词法**的,
// 机械判定即可;pull「哪一句最要紧」是语义判断(试点 252 个候选只选 40 个、无位置规律),
// 故不由脚本拍板,而是导出候选、由人挑完回喂 --pulls。
//
// 铁律:只重新分块,**正文一个字不改写**。改完必须过 scripts/verify-reblock.mjs。
import fs from 'node:fs'
import path from 'node:path'

const [corpus, slug, ...flags] = process.argv.slice(2)
if (!corpus || !slug) {
  console.error('用法: node scripts/reblock-auto.mjs <corpus> <slug> [--write] [--candidates] [--pulls=file.json]')
  process.exit(2)
}
const WRITE = flags.includes('--write')
const ONLY_CAND = flags.includes('--candidates')
const pullsArg = flags.find((f) => f.startsWith('--pulls='))
const PULLS = pullsArg ? JSON.parse(fs.readFileSync(pullsArg.slice('--pulls='.length), 'utf8')) : null

const FILE = path.join('src/data', corpus, 'baihua', `${slug}.json`)
const book = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const N = (s) => String(s ?? '').replace(/\s|\*\*/g, '')

// ── 词法规则(自试点反推)──────────────────────────────────────────
// callout:整段转框。tone 由开头的「话术」定 —— 试点里 note 是比方/举例/训字,
// warn 是纠误读/划界限,mute 是旁注/源流/版本。
const MUTE = /^(顺带|顺便|多说一句|插一句|再说一句|附带说|说句题外)/
const WARN = /^(这里最容易|最容易被误读|千万别|切莫|别把|不要把|这里要特别提醒|要提醒一句|注意[，,].{0,10}(不是|并非|不等于|别))/
const NOTE = /^(再|我|这里|不妨)?(打个.{0,8}比方|举个.{0,8}例子|举例说|比方说|想象一下|设想一下|换成今天|放到今天|注意.{0,6}(用的字|用的是|这句|句式|的字是))/
// list:连着若干段的**显式枚举**(其一，/第一，/一、)。
// 注意:试点里还有一类「『词』——解释」的连续段,看着也像并列,但那是「逐句走读」的正常骨架 ——
// 一并转成列表会把整篇拍平(实测多判 3 倍),正是规格禁止的「为了用新块而硬拆」。故不收。
const LIST_ITEM = /^(?:其[一二三四五六七八九十]\s*[，,]|第[一二三四五六七八九十]\s*[，,]|[一二三四五六七八九十]\s*、)/
// steps:一段之内「第一步…第二步…」,按步切开
const STEP_SPLIT = /(?=第[一二三四五六七八九十]步[，,、]|最后一步[，,、])/
// pull 候选:段尾整句加粗(试点 40/40 命中此形)
const TAIL_BOLD = /\*\*([^*]{10,60})\*\*([。！？」』]*)\s*$/

const isPara = (b) => b.type === 'p' || b.type === 'lead'
// 次第项的行首序号交给排版的圆号出,正文里不再重复(否则「② 第二步，…」双重编号)
const stripStep = (x) => x.replace(/^(?:第[一二三四五六七八九十]+步|最后一步)[，,、：:]\s*/, '')

function calloutTone(t) {
  if (MUTE.test(t)) return 'mute'
  if (WARN.test(t)) return 'warn'
  if (NOTE.test(t)) return 'note'
  return null
}

// 候选导出:每章列出可作 pull 的句子(含所在段序,便于定位)
function candidates(ch) {
  const out = []
  ;(ch.blocks || []).forEach((b, i) => {
    if (!isPara(b)) return
    const m = TAIL_BOLD.exec(b.text || '')
    if (m) out.push({ i, text: m[1] + m[2] })
  })
  return out
}

// pull 选句:候选都是作者自己加粗的段尾收束句,挑「与本章 centralIdea 重合度最高」的那句。
// (拿试点 40 处人工选择测:top-1 命中 60%、前二 85%;落选的也都是合法的强调句。)
// 重合度低于阈值 = 本章没有哪句真在复述中心思想 → 不出 pull,宁缺毋滥。
const KEY = (s) => String(s ?? '').replace(/[\s*]|[，。、；：！？「」『』（）()—…·"']/g, '')
const PULL_MIN = 0.28
function pickPull(ch) {
  const idea = KEY(ch.centralIdea || ch.hero?.headline || '')
  if (!idea) return null
  let best = null, bestScore = 0
  for (const b of ch.blocks || []) {
    if (!isPara(b)) continue
    const m = TAIL_BOLD.exec(b.text || '')
    if (!m) continue
    const c = KEY(m[1] + m[2])
    const overlap = [...new Set(c)].filter((x) => idea.includes(x)).length / Math.max(1, new Set(c).size)
    if (overlap > bestScore) { bestScore = overlap; best = m[1] + m[2] }
  }
  return bestScore >= PULL_MIN ? best : null
}

// 回退档:普通档文章几乎不用加粗(实测儒 120 章只有 7 章有、佛 63 章一章没有),
// 上面那条没有信号可用 → 放宽到「任一段的**收尾整句**」,同样按中心思想打分。
// 候选一下从 ~3 个变成 ~50 个,故阈值提高到 0.45,并加四道闸门滤掉读着像半句/像编者按的:
//   ① 连词开头(所以/因此/但…)= 从上下文里被生剥出来的半句
//   ② 评论文章本身的话(这一篇/全篇/以上…)= 编者按,不是思想本身
//   ③ 疑问句、引号收尾符开头(「」——…」这类残句)
//   ④ 长度 16–40 字(短于此不成句、长于此不像金句)
const SENT_TAIL = /[^。！？]+[。！？]』?」?\s*$/
const BAD_HEAD = /^(?:\*\*)?(?:所以|因此|于是|但|可是|而|也就是说|这就是|换句话说|总之|不过|然后|接着|至于|其实|[」』"'）)—－–])/
const META_SENT = /这一篇|这一章|这一节|全篇|整篇|本篇|本章|这三|上面这|以上|下面/
const PULL_MIN_LOOSE = 0.45
function pickPullLoose(ch) {
  const idea = KEY(ch.centralIdea || ch.hero?.headline || '')
  if (!idea) return null
  let best = null, bestScore = 0
  for (const b of ch.blocks || []) {
    if (!isPara(b)) continue
    const m = SENT_TAIL.exec((b.text || '').trim())
    if (!m) continue
    const s = m[0].trim()
    if (BAD_HEAD.test(s) || META_SENT.test(s) || /[？?]$/.test(s)) continue
    const c = KEY(s)
    if (c.length < 16 || c.length > 40) continue
    const overlap = [...new Set(c)].filter((x) => idea.includes(x)).length / Math.max(1, new Set(c).size)
    if (overlap > bestScore) { bestScore = overlap; best = s }
  }
  return bestScore >= PULL_MIN_LOOSE ? best : null
}

// 主转换:返回新的 blocks
function reblock(ch, chKey) {
  const src = ch.blocks || []
  // 人工选句文件优先(值为 null = 否掉本章的 pull);没给就用启发式提议
  const chosen = PULLS && chKey in PULLS ? PULLS[chKey] : (pickPull(ch) ?? pickPullLoose(ch))
  const out = []
  for (let i = 0; i < src.length; i++) {
    const b = src[i]
    // 既有 steps 块(试点产出)一并归一,免得新旧两种样子并存
    if (b.type === 'steps') {
      out.push({ ...b, items: (b.items || []).map((s) => ({ ...s, ...(s.text ? { text: stripStep(s.text) } : {}), ...(s.title ? { title: stripStep(s.title) } : {}) })) })
      continue
    }
    if (!isPara(b) || b.type === 'lead') { out.push(b); continue }
    const t = (b.text || '').trim()

    // ① steps 先判(该段常同时像列表/提示框,但「第一步…第二步…」次第语义更强):段内「第一步…第二步…」
    if (/第一步[，,、]/.test(t) && (t.match(/第[一二三四五六七八九十]步[，,、]/g) || []).length >= 2) {
      const parts = t.split(STEP_SPLIT).map((x) => x.trim()).filter(Boolean)
      if (parts.length >= 2 && parts.every((x) => /^(第[一二三四五六七八九十]步|最后一步)/.test(x))) {
        out.push({ type: 'steps', items: parts.map((x) => ({ text: stripStep(x), state: 'done' })) })
        continue
      }
    }

    // ② list:向后收集连续的显式枚举段(≥2 段才成列表)
    if (LIST_ITEM.test(t)) {
      const items = [t]
      let j = i + 1
      while (j < src.length && isPara(src[j]) && src[j].type !== 'lead' && LIST_ITEM.test((src[j].text || '').trim())) {
        items.push((src[j].text || '').trim()); j++
      }
      if (items.length >= 2) {
        // 三种枚举形式(其一，/第一，/一、)一律剥掉行首序号、由排版出编号
        const stripped = items.map((x) => x.replace(/^(?:[其第][一二三四五六七八九十]\s*[，,]|[一二三四五六七八九十]\s*、)\s*/, ''))
        out.push({ type: 'list', ordered: true, items: stripped })
        i = j - 1
        continue
      }
    }

    // ③ callout:整段转框(label 留空 —— 正文已自报家门,再挂签是重复)
    const tone = calloutTone(t)
    if (tone) { out.push({ type: 'callout', tone, items: [t] }); continue }

    // ④ pull:把选定的那句从段尾摘出来单独成块(本章已有 pull 则跳过,每章至多一处)
    if (chosen && !src.some((x) => x.type === 'pull')) {
      const mb = TAIL_BOLD.exec(t)
      const ms = SENT_TAIL.exec(t)
      const m = mb && N(mb[1] + mb[2]) === N(chosen) ? { text: mb[1] + mb[2], index: mb.index }
        : ms && N(ms[0].trim()) === N(chosen) ? { text: ms[0].trim(), index: ms.index }
          : null
      if (m) {
        const head = t.slice(0, m.index).trim()
        if (head) out.push({ ...b, text: head })
        out.push({ type: 'pull', text: m.text })
        continue
      }
    }
    out.push(b)
  }
  return out
}

if (ONLY_CAND) {
  const dump = {}
  for (const [k, ch] of Object.entries(book)) {
    const cs = candidates(ch)
    if (cs.length) dump[k] = cs.map((c) => c.text)
  }
  console.log(JSON.stringify(dump, null, 1))
  process.exit(0)
}

const stat = { list: 0, callout: 0, pull: 0, steps: 0, changed: 0 }
const next = {}
for (const [k, ch] of Object.entries(book)) {
  const blocks = reblock(ch, k)
  const before = JSON.stringify((ch.blocks || []).map((b) => b.type))
  const after = JSON.stringify(blocks.map((b) => b.type))
  if (before !== after) stat.changed++
  for (const b of blocks) if (stat[b.type] !== undefined) stat[b.type]++
  next[k] = { ...ch, blocks }
}
console.log(`${corpus}/${slug}: ${Object.keys(book).length} 章 · 有变化 ${stat.changed} · ` +
  `list ${stat.list} · callout ${stat.callout} · pull ${stat.pull} · steps ${stat.steps}`)
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(next, null, 1) + '\n')
  console.log(`已写入 ${FILE}`)
} else {
  const tmp = `/tmp/reblock-${corpus}-${slug}.json`
  fs.writeFileSync(tmp, JSON.stringify(next, null, 1) + '\n')
  console.log(`试跑结果 → ${tmp}(加 --write 才落盘)`)
}
