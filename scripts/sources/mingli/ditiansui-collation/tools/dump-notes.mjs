import fs from 'fs'
const R='/Users/gavin/work/hexagram/'
const bh=JSON.parse(fs.readFileSync(R+'src/data/mingli/baihua/ditiansui.json','utf8'))
const out=[]
const KW=/底本|讹|当作|当为|疑为|疑是|应作|应为|形近|误作|误为|抄|刻本|衍|脱/
for(const [k,ch] of Object.entries(bh)){
  for(const b of ch.blocks||[]){
    const texts = b.type==='callout' ? (b.items||[]) : []
    for(const t of texts) if(KW.test(t)) out.push({src:'baihua',ch:+k,text:t})
  }
}
const zs=JSON.parse(fs.readFileSync(R+'src/data/mingli/zhushi-anchored/ditiansui.json','utf8'))
const walk=(o,pathk)=>{ if(typeof o==='string'){ if(KW.test(o)) out.push({src:'zhushi',ch:pathk,text:o}); return } if(o&&typeof o==='object') for(const [k,v] of Object.entries(o)) walk(v, pathk ?? k) }
walk(zs,null)
const cl=JSON.parse(fs.readFileSync(R+'src/data/mingli/classics/ditiansui.json','utf8'))
for(const c of cl.chapters) c.paragraphs.forEach((p,i)=>{ if(p.translation && /当为|当作|之讹|底本/.test(p.translation)){ const m=p.translation.match(/[（(][^）)]*(当为|当作|之讹|底本)[^）)]*[）)]/g); if(m) for(const t of m) out.push({src:'translation',ch:c.no,para:i,text:t}) } })
fs.writeFileSync('notes.json',JSON.stringify(out,null,1))
const c={}; for(const x of out) c[x.src]=(c[x.src]||0)+1; console.log(c)
