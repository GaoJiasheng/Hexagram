import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import data from '../../../data/dao/zhuangzi-fables.json'
import './ZhuangziFablesPage.css'

// 庄子寓言索引(design-v24 §6)。《庄子》自称「寓言十九」,可寓言散在三十三篇里,
// 读的人记得住「庖丁解牛」「邯郸学步」,却未必知道它在哪一篇、原文怎么说。
// 这一页把寓言一则则摘出来:按内 / 外 / 杂与原书次序排,每则一句话讲它在讲什么,
// 「读原文 →」落到那一段;顶部按成语速查——点开成语,看原文本来怎么说、后人改了什么。
// 数据 src/data/dao/zhuangzi-fables.json;kw / from 由 scripts/lib/check-zhuangzi-fables.mjs 回查原文。

const BOOKS = [
  { slug: 'zhuangzi-neipian', label: '内篇', anchor: 'nei' },
  { slug: 'zhuangzi-waipian', label: '外篇', anchor: 'wai' },
  { slug: 'zhuangzi-zapian', label: '杂篇', anchor: 'za' },
]

const CLOUD_PREVIEW = 24
const FANLI = [
  '原文与段落据本站《庄子》内、外、杂三篇(维基文库本,郭象三十三篇次第);「读原文」落到这则寓言开头所在的那一段。',
  '一句话提要取思想史、文学史的读法,只讲寓言在说什么,不作宣化。',
  '成语只收由这则寓言而来的:字面有不见于原文的字、或意思已经转了的,标「后人概括」并注原文怎么说;其余注原文出处。',
  '外、杂篇通说多出庄子后学之手,《让王》《盗跖》《说剑》《渔父》四篇,苏轼以来多疑非庄子所作;书中的孔子、老聃、黄帝多是借来说话的人物,不当史实读。',
].join('')
const readHref = (f) => `/dao/${f.slug}/${f.ch}${f.part > 1 ? `?p=${f.part}` : ''}#p${f.para + 1}`
const idiomKey = (f, c) => `${f.id}:${c.text}`

function matches(f, q) {
  if (!q) return true
  if (f.title.includes(q) || f.kw.includes(q) || f.pian.includes(q)) return true
  return (f.chengyu || []).some((c) => c.text.includes(q) || c.from.includes(q))
}

export default function ZhuangziFablesPage() {
  usePageTitle('庄子寓言索引', '观道')
  const { hash } = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null) // 展开注记的成语:`${fableId}:${成语}`
  const [allChips, setAllChips] = useState(false) // 速查云:无查询时默认只露前一截
  const q = query.trim()

  const fables = data.fables
  const shown = useMemo(() => fables.filter((f) => matches(f, q)), [fables, q])
  const idioms = useMemo(
    () => shown.flatMap((f) => (f.chengyu || []).filter((c) => !q || c.text.includes(q) || c.from.includes(q)).map((c) => ({ f, c }))),
    [shown, q],
  )
  const cloud = q || allChips ? idioms : idioms.slice(0, CLOUD_PREVIEW)
  const counts = useMemo(() => Object.fromEntries(BOOKS.map((b) => [b.slug, fables.filter((f) => f.slug === b.slug).length])), [fables])

  // 页面懒加载:浏览器自带的 #锚点 定位赶在内容渲染之前,挂载后自己滚一次。
  // 不用 rAF(后台标签页会被节流),直接在 effect 里定位。
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (el) el.scrollIntoView({ block: 'start' })
  }, [hash])

  // 按书 → 篇分组(数据已按原书次序排好)
  const grouped = useMemo(() => BOOKS.map((b) => {
    const list = shown.filter((f) => f.slug === b.slug)
    const pians = []
    for (const f of list) {
      const last = pians[pians.length - 1]
      if (last && last.ch === f.ch) last.items.push(f)
      else pians.push({ ch: f.ch, pian: f.pian, items: [f] })
    }
    return { ...b, list, pians }
  }), [shown])

  const total = fables.length
  const nIdioms = fables.reduce((n, f) => n + (f.chengyu?.length || 0), 0)

  return (
    <div className="zf-page">
      <div className="basics-breadcrumb zf-crumb">
        <Link to="/dao" className="basics-breadcrumb__link">← 道藏</Link>
        <span className="zf-crumb__books">
          {BOOKS.map((b) => (
            <Link key={b.slug} to={`/dao/${b.slug}`} className="basics-breadcrumb__link">庄子{b.label}</Link>
          ))}
        </span>
      </div>
      <div className="page-header">
        <h1 className="page-title">庄子寓言索引</h1>
        <p className="page-subtitle">内篇七、外篇十五、杂篇十一,共 {total} 则寓言、{nIdioms} 条由此而来的成语。</p>
      </div>
      <p className="zf-intro">
        {'《庄子》自称「寓言十九」——十句话里九句借别人、别的东西来说。可这些故事散在三十三篇里,记得住「庖丁解牛」「邯郸学步」,未必知道它在哪一篇、原文怎么说。这里一则一则摘出来,按原书先后排,每则一句话讲它在讲什么,'}
        <strong>「读原文 →」直接落到那一段</strong>
        {'。成语速查里输入一个词或其中一两个字;'}
        <strong>点开成语,看原文本来怎么说</strong>
        {'——不少成语的字面和意思,都已和原文不一样了。'}
      </p>

      <section className="zf-search" aria-label="成语速查">
        <label className="zf-search__label" htmlFor="zf-q">成语速查</label>
        <input
          id="zf-q"
          type="search"
          className="zf-search__input"
          placeholder="输入成语或字,如「鱼」「木鸡」"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <p className="zf-search__status" aria-live="polite">
          {q ? (shown.length ? `找到 ${shown.length} 则寓言、${idioms.length} 条成语` : '没有找到。有些成语是后人概括的,字面与原文不同,试试其中一两个字。') : `共 ${nIdioms} 条成语;虚线框的是后人概括。`}
        </p>
        {cloud.length > 0 && (
          <ul className="zf-cloud">
            {cloud.map(({ f, c }) => (
              <li key={idiomKey(f, c)}>
                <a
                  href={`#f-${f.id}`}
                  className={`zf-chip${c.later ? ' zf-chip--later' : ''}`}
                  onClick={() => setOpen(idiomKey(f, c))}
                  title={`${f.title} · ${f.pian}`}
                >
                  {c.text}
                  {c.later && <span className="zf-sr">(后人概括)</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        {!q && idioms.length > CLOUD_PREVIEW && (
          <button type="button" className="zf-more" aria-expanded={allChips} onClick={() => setAllChips((v) => !v)}>
            {allChips ? '收起' : `展开全部 ${idioms.length} 条`}
          </button>
        )}
      </section>

      <nav className="zf-jump" aria-label="分部速跳">
        {BOOKS.map((b) => (
          <a key={b.slug} href={`#zf-${b.anchor}`} className="zf-jump__item">
            {b.label}<span className="zf-jump__n">{q ? `${grouped.find((g) => g.slug === b.slug).list.length} / ` : ''}{counts[b.slug]}</span>
          </a>
        ))}
      </nav>

      {grouped.map((g) => (
        <section key={g.slug} id={`zf-${g.anchor}`} className="zf-book" aria-labelledby={`zf-${g.anchor}-h`}>
          <h2 id={`zf-${g.anchor}-h`} className="zf-book__title">
            庄子{g.label}<span className="zf-book__n">{g.list.length} 则</span>
          </h2>
          {g.list.length === 0 && <p className="zf-empty">这一部里没有匹配的寓言。</p>}
          {g.pians.map((p) => (
            <div key={p.ch} className="zf-pian">
              <h3 className="zf-pian__title">
                {p.pian}
                <Link to={`/dao/${g.slug}/${p.ch}`} className="zf-pian__read">读全篇 →</Link>
              </h3>
              <div className="zf-grid">
                {p.items.map((f) => (
                  <article key={f.id} id={`f-${f.id}`} className="zf-card">
                    <h4 className="zf-card__title">{f.title}</h4>
                    <p className="zf-card__gist">{f.gist}</p>
                    {f.chengyu && (
                      <>
                        <div className="zf-pills">
                          {f.chengyu.map((c) => {
                            const k = idiomKey(f, c)
                            const isOpen = open === k
                            return (
                              <button
                                key={k}
                                type="button"
                                className={`zf-pill${c.later ? ' zf-pill--later' : ''}${isOpen ? ' is-open' : ''}`}
                                aria-expanded={isOpen}
                                aria-controls={`zf-note-${f.id}`}
                                onClick={() => setOpen(isOpen ? null : k)}
                              >
                                {c.text}
                                {c.later && <span className="zf-pill__tag">后人概括</span>}
                              </button>
                            )
                          })}
                        </div>
                        <div id={`zf-note-${f.id}`} className="zf-note" aria-live="polite">
                          {f.chengyu.filter((c) => open === idiomKey(f, c)).map((c) => (
                            <p key={c.text} className="zf-note__body">
                              <span className="zf-note__src">原文</span>「{c.from}」
                              {c.note && <span className="zf-note__txt">{c.later ? '后人概括:' : ''}{c.note}</span>}
                            </p>
                          ))}
                        </div>
                      </>
                    )}
                    <Link to={readHref(f)} className="zf-card__read">读原文 →</Link>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      <p className="zf-fanli">
        <strong>凡例</strong>
        {FANLI}
      </p>
    </div>
  )
}
