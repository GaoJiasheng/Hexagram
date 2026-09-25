import { S, auto } from './auto.mjs'
export const keyOf = []
const seen = {}
S.forEach((x, i) => {
  const seg = x.ctx.match(/〔(.*)〕/)[1]
  const base = `${x.ch}.${x.para}|${seg}`
  seen[base] = (seen[base] || 0) + 1
  keyOf[i] = seen[base] > 1 ? `${base}#${seen[base]}` : base
})
if (process.argv[2] === 'print') S.forEach((x, i) => { const a = auto(x); if (a.grade !== '-') console.log(`${keyOf[i]} :: ${x.q === '=' ? '=' : x.q.slice(0, 10)}/${x.g === '=' ? '=' : x.g.slice(0, 10)} ${a.grade}`) })
