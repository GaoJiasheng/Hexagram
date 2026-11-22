#!/usr/bin/env node
// 把图解转换的规则(与 figs-codex.mjs 同一份 RULES)加上格式规格(docs/desk-baihua-spec.md §2)写成一份给代理读的文件:
//   node scripts/desk/figs-rules.mjs → scripts/.desk-figs/RULES.md
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const src = fs.readFileSync(path.join(ROOT, 'scripts/desk/figs-codex.mjs'), 'utf8')
const m = /const RULES = `([\s\S]*?)`\n/.exec(src)
if (!m) { console.error('figs-codex.mjs 里找不到 RULES'); process.exit(1) }
const rules = m[1].replace(/\\`/g, '`').replace(/\\\\n/g, '\\n')
const spec = fs.readFileSync(path.join(ROOT, 'docs/desk-baihua-spec.md'), 'utf8')
const out = path.join(ROOT, 'scripts/.desk-figs/RULES.md')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `# 图解结构化 · 规则与格式\n\n${rules}\n\n---\n\n${spec.slice(spec.search(/^## 2\b/m))}\n`)
console.log(`→ ${path.relative(ROOT, out)}(${fs.statSync(out).size} 字节)`)
