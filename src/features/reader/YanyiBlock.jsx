import { getYanyi } from './corpus.js'
import { linkifyBooks } from './linkifyBooks.jsx'
import { globalBookRefs } from './booksIndex.js'
import { seeAlsoFor } from './seeAlso.js'
import SeeAlsoBlock from './SeeAlsoBlock.jsx'

// 通用每章/篇延伸(v16 §1,沿用 v13 道藏 YanyiBlock)——章末「延伸」块。
// 只呈思想/故事/源流,不作信仰宣化、不下吉凶/果报断语。延伸里全站书名自动链(#139/B2,跨组);
// 经典互指章另挂「义理互见」see-also(#141/B2)。延伸或互见任一有则渲染。
export default function YanyiBlock({ corpus, slug, chapter }) {
  const paras = getYanyi(corpus, slug, chapter)
  const seeAlso = seeAlsoFor(corpus, slug, chapter)
  if (!paras?.length && !seeAlso.length) return null
  const refs = globalBookRefs({ excludeCorpus: corpus, excludeSlug: slug })
  return (
    <div className="yanyi-block">
      {paras?.length > 0 && (
        <>
          <div className="yanyi-block__tag">延伸 · 思想与故事</div>
          {paras.map((p, i) => (
            <p key={i} className="yanyi-block__para">{linkifyBooks(p, refs)}</p>
          ))}
        </>
      )}
      <SeeAlsoBlock groups={seeAlso} />
    </div>
  )
}
