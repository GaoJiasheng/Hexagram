// 观数白话「人读复核」的备料(owner 10-01 深夜:O9 续,余下 ~330 篇全部过一遍)。
// 09-30 那 17 篇是主会话自己读的(89 处修正);这一轮改成代理逐章读——每章一个 opus 代理,原文(带段号 + 站内译文)与白话
// 装进一个输入文件,代理只读它、把修正后的完整白话写到输出文件、按 schema 只交回「改了什么」;主会话再用 mingli-review-apply.mjs
// 逐片校验(结构 / 图块原样 / 引文子串 / 红线 / check-baihua-draft)后合并。分片文件各写各的,写竞争归零。
//   node scripts/mingli-review-prep.mjs            → scratch/mingli-review/in/*.json + units.json + 打印统计
//   Workflow({ scriptPath: 'scripts/.mingli-review-wf.js', args: { units: <units.json 内容> } })
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSubKey, subChapter } from './lib/sub-chapter.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const WORK = process.env.MINGLI_REVIEW_DIR || path.join(ROOT, 'scripts/.mingli-review')
const IN = path.join(WORK, 'in'), OUT = path.join(WORK, 'out')
// 09-30 已人读的:玉照 9 篇全部、三命通会 261、五行大义 44(其余几篇记录不全,宁可再读一遍)
const DONE = new Set(['sanming:261', 'wuxingdayi:44'])
const SKIP_SLUG = new Set(['yuzhao'])

const TIELU = '【铁律·研习不断命】本组是命理典籍的文献研读,不是算命。原典里的断语照译不删不讳;我方文字(白话)只讲「书里怎么说、为什么这么说」,不为之背书、不教读者拿去给自己或他人断命、不出现「你可据此判断自己……」式的套用指引、不下任何预测性断语;各家说法不一处并陈不拍板;真伪与底本如实交代。'

function chapterOf(book, key) {
  if (isSubKey(key)) {
    const sub = subChapter(ROOT, 'mingli', book.slug, book.data, key)
    return { title: `${sub.chapter.title || ''}${sub.title ? ` · ${sub.title}` : ''}`, paras: sub.paragraphs, offset: sub.from ?? 0, chNo: Number(key.split('-')[0]) }
  }
  const c = book.data.chapters.find((x) => x.no === Number(key))
  return c ? { title: c.title || '', paras: c.paragraphs, offset: 0, chNo: c.no } : null
}

export function stripSvg(ch) {
  const blocks = ch.blocks.map((b) => (b.type === 'figure' ? { ...b, svg: '__SVG__' } : b))
  return { ...ch, blocks }
}

export function main() {
  fs.mkdirSync(IN, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
  const texts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/texts.json'), 'utf8'))
  const units = []
  let skipped = 0
  for (const f of fs.readdirSync(path.join(ROOT, 'src/data/mingli/baihua')).filter((x) => x.endsWith('.json')).sort()) {
    const slug = f.replace(/\.json$/, '')
    if (SKIP_SLUG.has(slug)) { skipped += Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/baihua', f), 'utf8'))).length; continue }
    const baihua = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/baihua', f), 'utf8'))
    const book = { slug, data: JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/mingli/classics/${slug}.json`), 'utf8')) }
    const meta = texts.find((t) => t.slug === slug) || {}
    for (const key of Object.keys(baihua).sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]) || Number(a.split('-')[1] || 0) - Number(b.split('-')[1] || 0))) {
      if (DONE.has(`${slug}:${key}`)) { skipped++; continue }
      const ch = chapterOf(book, key)
      if (!ch) { console.error(`✗ ${slug}/${key} 找不到原文章`); continue }
      const original = ch.paras.map((p, i) => {
        const n = ch.offset + i + 1
        const t = typeof p === 'string' ? p : p.original
        const tr = typeof p === 'object' && p.translation ? `\n    译:${p.translation}` : ''
        return `[${n}] ${t}${tr}`
      }).join('\n')
      const input = {
        corpus: 'mingli', slug, key, book: meta.title || slug, chapter: ch.title, chNo: ch.chNo,
        redline: TIELU,
        original,
        baihua: stripSvg(baihua[key]),
      }
      const inFile = path.join(IN, `${slug}-${key}.json`)
      fs.writeFileSync(inFile, JSON.stringify(input, null, 1))
      units.push({ slug, key, label: `${meta.title || slug}·${key}`, chars: original.length, inFile, outFile: path.join(OUT, `${slug}-${key}.json`) })
    }
  }
  fs.writeFileSync(path.join(WORK, 'units.json'), JSON.stringify(units))
  const chars = units.reduce((n, u) => n + u.chars, 0)
  console.log(`备料 ${units.length} 章(跳过已读 ${skipped})· 原文共 ${chars} 字 → ${WORK}`)
  return units
}

if (process.argv[1] && fileURLToPath(new URL(import.meta.url)) === path.resolve(process.argv[1])) main()
