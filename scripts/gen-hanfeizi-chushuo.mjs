// 生成《韩非子》储说六篇的「经—说」对应表(design-v24 §1)。
//   node scripts/gen-hanfeizi-chushuo.mjs
// 输入:src/data/fa/classics/hanfeizi.json(管线生成物,第 30–35 章)
// 输出:src/data/fa/hanfeizi-chushuo.json —— **从原文派生,不手写**。
// 派生规则见 scripts/lib/hanfeizi-chushuo.mjs;任一篇经条数 ≠ 说组数(或结构认不出)即报错退出,不落盘。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveChushuo } from './lib/hanfeizi-chushuo.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src/data/fa/classics/hanfeizi.json')
const OUT = path.join(ROOT, 'src/data/fa/hanfeizi-chushuo.json')

const book = JSON.parse(fs.readFileSync(SRC, 'utf8'))
let data
try {
  data = deriveChushuo(book)
} catch (e) {
  console.error('✗ 储说经说派生失败,未写文件:\n' + e.message)
  process.exit(1)
}

// 每条经一行,便于 diff 与人读
const lines = ['{', '  "chapters": [']
data.chapters.forEach((c, ci) => {
  const { jing, ...head } = c
  const headJson = JSON.stringify(head).slice(1, -1)
  lines.push(`    { ${headJson.replace(/,"/g, ', "').replace(/":/g, '": ')},`)
  lines.push('      "jing": [')
  jing.forEach((j, k) => {
    const s = JSON.stringify(j).replace(/,"/g, ', "').replace(/":/g, '": ')
    lines.push(`        ${s}${k < jing.length - 1 ? ',' : ''}`)
  })
  lines.push(`      ] }${ci < data.chapters.length - 1 ? ',' : ''}`)
})
lines.push('  ]', '}', '')
const out = lines.join('\n')
JSON.parse(out)   // 自检:手排的 JSON 必须仍然合法
fs.writeFileSync(OUT, out)

const nJing = data.chapters.reduce((s, c) => s + c.jing.length, 0)
for (const c of data.chapters) {
  console.log(`  第 ${c.ch} 章 ${c.title}: 经 ${c.jing.length} 条 · 说 ${c.jing.length} 组${c.intro != null ? ' · 有总纲' : ''}${c.youjingPara != null ? '' : ' · 无「右经」段'}`)
}
console.log(`✓ ${path.relative(ROOT, OUT)}: ${data.chapters.length} 篇 · ${nJing} 经 · ${nJing} 说`)
