import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import concepts from '../../data/mingli/concepts.json'

// 观数 · 概念索引(design-v23 §7 贯通件)。
// 这几本书讲的是同一套概念,却散在各自的章里,而且**说法未必一致**——
// 读到「伤官」想知道另外几本怎么讲,原先只能一本本翻目录。这一页按概念横切过去。
// 数据 src/data/mingli/concepts.json:每个落点挂 kw,check-data 回查原文。
const SHORT = { yuanhai: '渊海', zhenquan: '真诠', ditiansui: '滴天髓', qiongtong: '穷通' }

export default function MingliConceptsPage() {
  usePageTitle('概念索引', '观数')
  return (
    <div className="qt-matrix-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli" className="basics-breadcrumb__link">← 路径</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">概念索引</h1>
        <p className="page-subtitle">同一个词,四本书各在哪一章讲。</p>
      </div>
      <p className="qt-matrix-intro">
        这几本书用的是同一套词——用神、月令、伤官、从格——却散在各自的章节里,而且<strong>说法未必一样</strong>。
        这一页按概念横着切:点进去,就是那本书专讲它的那一章。先读哪本都行;读完一本再点另一本,分歧自己就看出来了。
      </p>
      <nav className="mc-jump" aria-label="概念速跳">
        {concepts.clusters.map((c) => <a key={c.term} href={`#c-${c.term}`} className="mc-jump__item">{c.term}</a>)}
      </nav>
      <ul className="mc-list">
        {concepts.clusters.map((c) => (
          <li key={c.term} id={`c-${c.term}`} className="mc-item">
            <h2 className="mc-item__term">{c.term}</h2>
            <p className="mc-item__gloss">{c.gloss}</p>
            <div className="mc-item__loci">
              {c.loci.map((l) => (
                <Link key={`${l.slug}-${l.ch}`} to={`/mingli/${l.slug}/${l.ch}`} className={`mc-locus mc-locus--${l.slug}`}>
                  <span className="mc-locus__book">{SHORT[l.slug]}</span>
                  {l.label.split('·')[1]}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
