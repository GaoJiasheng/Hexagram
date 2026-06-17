import yanyi from '../../../data/dao/yanyi.json'
import { linkifyBooks } from '../../reader/linkifyBooks.jsx'
import { globalBookRefs } from '../../reader/booksIndex.js'
import { seeAlsoFor } from '../../reader/seeAlso.js'
import SeeAlsoBlock from '../../reader/SeeAlsoBlock.jsx'

// 每章延伸(v13 §2):章末「延伸」块。只呈思想/故事/源流,不作信仰宣化。
// 延伸里全站书名自动链(#139/B2,跨组);经典互指章另挂「义理互见」see-also(#141/B2)。
export default function YanyiBlock({ slug, chapter }) {
  const paras = yanyi[slug]?.[String(chapter)]
  const seeAlso = seeAlsoFor('dao', slug, chapter)
  if (!paras?.length && !seeAlso.length) return null
  const refs = globalBookRefs({ excludeCorpus: 'dao', excludeSlug: slug })
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
