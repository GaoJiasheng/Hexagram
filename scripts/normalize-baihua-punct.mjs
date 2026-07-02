// 白话标点归一(P1·确定性 pass):中文语境里的半角 , ; : ? ! → 全角。
// 只动 lead/p/h2 的 text、figure.caption、centralIdea/subtitle/hero;
// 不动 quote(original/translation 镜像底本与站内译文)、不动 svg。
// 规则:前一字符是 CJK(或全角标点/」』)时才转换——保护数字/英文场景(3,5 / U:1 等)。
// 用法:node scripts/normalize-baihua-punct.mjs <corpus> [corpus...]   (如 yijing dao)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const MAP = { ',': '，', ';': '；', ':': '：', '?': '？', '!': '！' }
const CJK = /[㐀-鿿豈-﫿。，、；：？！」』）·…—]/
function norm(s) {
  if (typeof s !== 'string') return s
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (MAP[ch] && i > 0 && CJK.test(s[i - 1])) out += MAP[ch]
    else out += ch
  }
  return out
}

let files = 0, chgChapters = 0, chgChars = 0
for (const corpus of process.argv.slice(2)) {
  const dir = path.join(ROOT, 'src/data', corpus, 'baihua')
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const p = path.join(dir, f)
    const o = JSON.parse(fs.readFileSync(p, 'utf8'))
    let touched = false
    for (const ch of Object.values(o)) {
      const before = JSON.stringify(ch)
      for (const k of ['centralIdea', 'subtitle']) if (ch[k]) ch[k] = norm(ch[k])
      if (ch.hero) for (const k of ['badge', 'headline', 'tagline']) if (ch.hero[k]) ch.hero[k] = norm(ch.hero[k])
      for (const b of ch.blocks || []) {
        if (b.type === 'quote') continue
        if (b.text !== undefined) b.text = norm(b.text)
        if (b.caption !== undefined) b.caption = norm(b.caption)
        if (b.type === 'refs' && Array.isArray(b.items)) b.items = b.items.map(norm)
      }
      const after = JSON.stringify(ch)
      if (after !== before) { touched = true; chgChapters++; chgChars += Math.abs(after.length - before.length) || 1 }
    }
    if (touched) { fs.writeFileSync(p, JSON.stringify(o, null, 1) + '\n'); files++ }
  }
}
console.log(`标点归一:改 ${files} 文件 · ${chgChapters} 章`)
