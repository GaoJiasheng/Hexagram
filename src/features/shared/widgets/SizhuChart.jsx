import { useMemo, useState } from 'react'
import { analyzePillars, ganWuxing, zhiWuxing, yinYang, wuxingRelation, shishen, isGan, WUXING } from '../ganzhi/index.js'

// 四柱图 —— 把「辛卯 丁酉 庚午 丙子」这八个字摊开成看得懂的结构。
// 古命书里命例成百上千,不会排盘的人看到的只是八个字,原文接着说「丁火透干、坐下午火为根」
// 就完全跟不上了。这个件的全部用意:**让人看懂书里的例子**,不是让人算自己。
//
// 交互:点任何一个字,下方解释「它是什么、为什么是这个十神」—— 讲的是**推导过程**,不是结论。
// **只示结构,不作断语**:本件不输出任何吉凶判断(analyzePillars 有单测断言)。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const REL_TEXT = {
  同: (me, it) => `与日主同属${it},是「同我」`,
  生: (me, it) => `日主${me}生${it},是「我生」`,
  克: (me, it) => `日主${me}克${it},是「我克」`,
  被克: (me, it) => `${it}克日主${me},是「克我」`,
  被生: (me, it) => `${it}生日主${me},是「生我」`,
}

function explainGan(char, dayGan, isDay) {
  const wx = ganWuxing(char), yy = yinYang(char)
  if (isDay) return `${char},${yy}${wx}。这是**日主**——四柱以日干为「我」,其余七个字都从它看出去。`
  const me = ganWuxing(dayGan)
  const rel = wuxingRelation(me, wx)
  const same = yinYang(dayGan) === yy
  // 推导要走完最后一步:关系 + 阴阳同异 → 十神名。只给前两步不给结论,读者对不上表。
  return `${char},${yy}${wx}。${REL_TEXT[rel](me, wx)};与日主${dayGan}阴阳${same ? '相同' : '相异'}——所以是**${shishen(dayGan, char)}**。`
}

function Char({ char, kind, active, focused, onPick }) {
  const wx = kind === 'gan' ? ganWuxing(char) : zhiWuxing(char)
  return (
    <button
      type="button"
      className={`sz-char sz-char--${WX_CLASS[wx]}${active ? ' is-active' : ''}${focused ? ' is-focus' : ''}`}
      aria-pressed={active}
      aria-label={`${char},${yinYang(char)}${wx}`}
      onClick={onPick}
    >
      {char}
    </button>
  )
}

export default function SizhuChart({ pillars, focus = [], show }) {
  const data = useMemo(() => analyzePillars(pillars), [pillars])
  const layers = show || ['shishen', 'canggan', 'nayin', 'count']
  const has = (k) => layers.includes(k)
  const [pick, setPick] = useState(null)   // { col, kind:'gan'|'zhi'|'cang', idx? }

  const isActive = (col, kind, idx) => pick && pick.col === col && pick.kind === kind && (kind !== 'cang' || pick.idx === idx)
  const toggle = (next) => setPick((cur) => (cur && cur.col === next.col && cur.kind === next.kind && cur.idx === next.idx ? null : next))

  let detail = null
  if (pick) {
    const p = data.pillars[pick.col]
    if (pick.kind === 'gan') {
      detail = { head: `${p.name}干 · ${p.gan.shishen}`, body: explainGan(p.gan.char, data.dayGan, pick.col === 2) }
    } else if (pick.kind === 'zhi') {
      const cang = p.cangGan.map((c) => `${c.char}(${c.shishen})`).join('、')
      detail = {
        head: `${p.name}支 · ${p.zhi.char}`,
        body: `${p.zhi.char},${p.zhi.yinyang}${p.zhi.wuxing}。地支里「藏」着天干:${cang}——第一个是本气,十神从藏干看。日主${data.dayGan}在${p.zhi.char}为「${p.changsheng}」。`,
      }
    } else {
      const c = p.cangGan[pick.idx]
      detail = { head: `${p.zhi.char}中藏${c.char} · ${c.shishen}`, body: `${explainGan(c.char, data.dayGan, false)}${pick.idx === 0 ? '它是此支的本气。' : ''}` }
    }
  }

  return (
    <div className="sz">
      <div className="sz-grid" role="group" aria-label={`四柱:${pillars.join(' ')}`}>
        {data.pillars.map((p, col) => (
          <div key={col} className={`sz-col${col === 2 ? ' sz-col--day' : ''}`}>
            <div className="sz-name">{p.name}柱</div>
            {has('shishen') && <div className="sz-shishen">{p.gan.shishen}</div>}
            <Char char={p.gan.char} kind="gan" active={isActive(col, 'gan')} focused={focus.includes(p.gan.char)} onPick={() => toggle({ col, kind: 'gan' })} />
            <Char char={p.zhi.char} kind="zhi" active={isActive(col, 'zhi')} focused={focus.includes(p.zhi.char)} onPick={() => toggle({ col, kind: 'zhi' })} />
            {has('canggan') && (
              <div className="sz-cang">
                {p.cangGan.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`sz-cang__item sz-char--${WX_CLASS[c.wuxing]}${isActive(col, 'cang', idx) ? ' is-active' : ''}`}
                    aria-pressed={!!isActive(col, 'cang', idx)}
                    onClick={() => toggle({ col, kind: 'cang', idx })}
                  >
                    <span className="sz-cang__char">{c.char}</span>
                    <span className="sz-cang__ss">{c.shishen}</span>
                  </button>
                ))}
              </div>
            )}
            {has('nayin') && <div className="sz-nayin">{p.nayin}</div>}
            {has('changsheng') && <div className="sz-nayin">{p.changsheng}</div>}
          </div>
        ))}
      </div>

      {has('count') && (
        <div className="sz-count" aria-label="八字五行分布(天干四、地支四)">
          {WUXING.map((w) => (
            <span key={w} className={`sz-count__item sz-char--${WX_CLASS[w]}${data.wuxingCount[w] === 0 ? ' is-zero' : ''}`}>
              {w}<b>{data.wuxingCount[w]}</b>
            </span>
          ))}
        </div>
      )}

      <div className="sz-detail" aria-live="polite">
        {detail ? (
          <>
            <p className="sz-detail__head">{detail.head}</p>
            <p className="sz-detail__body">{detail.body.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong> : s))}</p>
          </>
        ) : (
          <p className="sz-detail__hint">点任何一个字,看它是什么、十神是怎么推出来的。</p>
        )}
      </div>
      <p className="sz-foot">只示结构,不作断语。</p>
    </div>
  )
}

// 供测试与他处复用
export { explainGan, isGan }
