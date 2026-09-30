import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SingleBookHome from '../../reader/SingleBookHome.jsx'
import { loadText } from '../../reader/corpus.js'
import texts from '../../../data/guwen/texts.json'
import meta from '../../../data/guwen/guwenguanzhi-meta.json'

// 古文首页。底本《古文观止》吴楚材、吴调侯 康熙三十四年(1695)编,十二卷二百二十二篇,选目为古人所定、非本站编纂。
// 一组一本书(与唐诗三百首同形态):首页不摆书架,直接按十二卷展开全部篇目,篇题旁标出处/作者(左传 · 韩愈 · 苏轼…)。
// 另有「课本古文补编」(本站按中学课本选目,收站内没有的二十余篇),按学段列在《古文观止》目录之前——老师最先找的是课本篇目。
const GRADES = ['七上', '七下', '八上', '八下', '九上', '九下', '高中', '课外']

function KewenToc() {
  const [chapters, setChapters] = useState(null)
  useEffect(() => {
    let alive = true
    loadText('guwen', 'kewen').then((b) => { if (alive) setChapters(b?.chapters || null) })
    return () => { alive = false }
  }, [])
  const kewen = texts.find((t) => t.slug === 'kewen')
  if (!kewen || !chapters) return null
  const grades = GRADES.filter((g) => chapters.some((c) => c.grade === g))
  return (
    <section className="dao-text-sections book-home__toc book-home__kewen">
      <h2 className="dao-text-sections__title">
        <Link to="/guwen/kewen">课本古文补编</Link> · {chapters.length} 篇
      </h2>
      <p className="dao-text-brief">
        课本上的文言文，站内别处已有的不重出（《古文观止》里的岳阳楼记、醉翁亭记、出师表、师说、赤壁赋等见下方目录；论语、孟子、荀子、庄子、列子见各组），其余按学段收在这里。篇目以现行统编版为参照，各版本有出入。
      </p>
      {grades.map((g) => (
        <div key={g} className="book-toc__group">
          <div className="book-toc__head book-toc__head--static">
            <span className="book-toc__name">{g}</span>
            <span className="book-toc__count">{chapters.filter((c) => c.grade === g).length} 篇</span>
          </div>
          <ul className="book-toc__poems book-toc__poems--flat">
            {chapters.filter((c) => c.grade === g).map((c) => (
              <li key={c.no}>
                <Link to={`/guwen/kewen/${c.no}`}>
                  <span className="book-toc__no">{c.no}</span>{c.title}
                  {c.source && <span className="book-toc__src">{c.source}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default function GuwenHomePage() {
  return (
    <SingleBookHome
      corpus="guwen"
      slug="guwenguanzhi"
      texts={texts.filter((t) => t.slug === 'guwenguanzhi')}
      title="古文研读"
      subtitle="古文观止二百二十二篇，另收课本古文补编——原文、白话译注与每篇延伸。"
      basePath="/guwen"
      brand="观文"
      volumes={meta.volumes}
      beforeToc={<KewenToc />}
    />
  )
}
