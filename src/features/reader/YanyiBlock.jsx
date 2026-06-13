import { getYanyi } from './corpus.js'

// 通用每章/篇延伸(v16 §1,沿用 v13 道藏 YanyiBlock)——章末「延伸」块,无数据则不渲染。
// 只呈思想/故事/源流,不作信仰宣化、不下吉凶/果报断语。
export default function YanyiBlock({ corpus, slug, chapter }) {
  const paras = getYanyi(corpus, slug, chapter)
  if (!paras?.length) return null
  return (
    <div className="yanyi-block">
      <div className="yanyi-block__tag">延伸 · 思想与故事</div>
      {paras.map((p, i) => (
        <p key={i} className="yanyi-block__para">{p}</p>
      ))}
    </div>
  )
}
