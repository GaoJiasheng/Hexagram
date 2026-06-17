import yanyi from '../../../data/dao/yanyi.json'
import { linkifyBooks } from '../../reader/linkifyBooks.jsx'
import { globalBookRefs } from '../../reader/booksIndex.js'

// 每章延伸(v13 §2):章末「延伸」块,无数据则不渲染。只呈思想/故事/源流,不作信仰宣化。
// 延伸里全站书名自动链(#139/B2,跨组):道藏延伸提「易经」「韩非子」即可点到对面那部书。
export default function YanyiBlock({ slug, chapter }) {
  const paras = yanyi[slug]?.[String(chapter)]
  if (!paras?.length) return null
  const refs = globalBookRefs({ excludeCorpus: 'dao', excludeSlug: slug })
  return (
    <div className="yanyi-block">
      <div className="yanyi-block__tag">延伸 · 思想与故事</div>
      {paras.map((p, i) => (
        <p key={i} className="yanyi-block__para">{linkifyBooks(p, refs)}</p>
      ))}
    </div>
  )
}
