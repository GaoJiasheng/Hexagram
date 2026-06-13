import yanyi from '../../../data/dao/yanyi.json'

// 每章延伸(v13 §2):章末「延伸」块,无数据则不渲染。只呈思想/故事/源流,不作信仰宣化。
export default function YanyiBlock({ slug, chapter }) {
  const paras = yanyi[slug]?.[String(chapter)]
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
