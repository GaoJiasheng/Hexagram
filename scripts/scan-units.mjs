// 扫 gen-zhuzi-wf 工作流的结果文件(译注延单元):null 单元 / 译文条数不对齐 / 译文过短(疑只交了说明)/ 缺延伸。
// 用法: node scripts/scan-units.mjs <result.json>   —— 装配(assemble-newtexts.mjs)前必跑;有 problems 先去救再装。
import fs from 'node:fs'
let r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); if (!Array.isArray(r)) r = r.result
const bad = []; let nul = 0
for (const u of r) {
  if (!u.data) { nul++; bad.push(`${u.no}#${u.start} null`); continue }
  const n = u.end - u.start + 1, t = u.data.translations?.length, p = u.data.punctuated?.length
  if (t !== n || (u.punct && p !== n)) bad.push(`${u.no}#${u.start} tr${t}/pu${p}/n${n}`)
  if ((u.data.translations || []).join('').length < Math.min(40, n * 6)) bad.push(`${u.no}#${u.start} 译文过短(疑只交说明)`)
  if (u.yanyi && !(u.data.yanyi || []).length) bad.push(`${u.no}#${u.start} 无延伸`)
}
console.log('units', r.length, 'null', nul, 'problems', JSON.stringify(bad))
