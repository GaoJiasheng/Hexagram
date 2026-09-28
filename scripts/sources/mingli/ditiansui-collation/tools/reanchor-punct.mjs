import fs from 'node:fs';
const PUNCT = /[，。；：？！、「」『』《》（）·,.;:?!"'\s　]/u;
const [,, origPath, minePath, outPath] = process.argv;
const origs = JSON.parse(fs.readFileSync(origPath,'utf8'));
const mines = JSON.parse(fs.readFileSync(minePath,'utf8'));
if (origs.length !== mines.length) { console.error('段数不符', origs.length, mines.length); process.exit(1); }
function lcsAlign(a, b) {
  const n=a.length, m=b.length;
  const dp = new Int32Array((n+1)*(m+1));
  for (let i=n-1;i>=0;i--){
    const row=i*(m+1), row1=(i+1)*(m+1);
    for (let j=m-1;j>=0;j--){
      dp[row+j] = a[i]===b[j] ? dp[row1+j+1]+1 : Math.max(dp[row1+j], dp[row+j+1]);
    }
  }
  const align = new Int32Array(n).fill(-1);
  let i=0,j=0;
  while(i<n&&j<m){
    if(a[i]===b[j]){ align[i]=j; i++; j++; }
    else if(dp[(i+1)*(m+1)+j] >= dp[i*(m+1)+j+1]) i++;
    else j++;
  }
  return align;
}
const out=[], report=[];
for (let k=0;k<origs.length;k++){
  const O = Array.from(origs[k]);
  const mine = Array.from(mines[k]);
  const plain=[], tail=[]; let lead='';
  for (const ch of mine){
    if (PUNCT.test(ch)) { if (plain.length===0) lead+=ch; else tail[plain.length-1]=(tail[plain.length-1]||'')+ch; }
    else { plain.push(ch); tail.push(''); }
  }
  if (plain.join('') === O.join('')) { out.push(lead+mine.join('')===mines[k]?mines[k]:mines[k]); report.push(`[${k}] 原样通过 (${O.length}字)`); continue; }
  const align = lcsAlign(O, plain);
  let s='';
  for (let i=0;i<O.length;i++){ s+=O[i]; const j=align[i]; if(j>=0 && tail[j]) s+=tail[j]; }
  out.push(s);
  const matched = align.reduce((c,v)=>c+(v>=0?1:0),0);
  report.push(`[${k}] 重锚: 底本${O.length}字 我写${plain.length}字 对齐${matched} 底本未对上${O.length-matched} 我方多余${plain.length-matched}`);
}
fs.writeFileSync(outPath, JSON.stringify(out));
for (let k=0;k<out.length;k++){
  const stripped = Array.from(out[k]).filter(c=>!PUNCT.test(c)).join('');
  if (stripped !== origs[k]) { console.error(`[${k}] 校验失败!`); process.exit(1); }
}
console.log(report.join('\n')); console.log('去标点后与底本全部逐字相等 ✓');
