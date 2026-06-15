import { getYanyi, corpusTexts } from './corpus.js'
import { SITE_MAP } from '../../sites/registry.js'
import { linkifyBooks, buildRefs } from './linkifyBooks.jsx'

// 通用每章/篇延伸(v16 §1,沿用 v13 道藏 YanyiBlock)——章末「延伸」块,无数据则不渲染。
// 只呈思想/故事/源流,不作信仰宣化、不下吉凶/果报断语。延伸里本组其他书名自动链(#5,组内)。
export default function YanyiBlock({ corpus, slug, chapter }) {
  const paras = getYanyi(corpus, slug, chapter)
  if (!paras?.length) return null
  const refs = buildRefs(corpusTexts(corpus), SITE_MAP[corpus]?.home || `/${corpus}`, slug)
  return (
    <div className="yanyi-block">
      <div className="yanyi-block__tag">延伸 · 思想与故事</div>
      {paras.map((p, i) => (
        <p key={i} className="yanyi-block__para">{linkifyBooks(p, refs)}</p>
      ))}
    </div>
  )
}
