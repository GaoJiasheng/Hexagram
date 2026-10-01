import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import data from '../../data/rhyme/unlisted.json'
import './ProsodyRow.css'
import './RhymeBooksPage.css'

// 韵书与未收字(M8)。唐诗 / 宋词 / 元曲阅读器的「格律」开关,平仄与韵部都查自这三部韵书;
// 韵书没收的字在正文里标「未收」。按规矩**不补字**(维基页有缺照缺),但读者该有一处能查:
// 韵书是什么、收了多少、本站诗词里哪些字没收、落在哪几首。
// 数据 src/data/rhyme/unlisted.json(scripts/gen-rhyme-unlisted.mjs,与阅读器同一套查法),闸在 check-rhyme。

// 三部韵书的来历与本站标法。来历只写站内导读已交代过的(见 songci / yuanqu school.json),不给年份。
const BOOK_TEXT = {
  pingshui: {
    corpus: 'tangshi',
    what: '从《切韵》《广韵》一系传下来的诗韵,归并为 106 部,后世通称平水韵,是读唐宋近体诗平仄、韵脚的通行依据。唐人作诗依的是当时的韵书,平水韵是后来归并而成,读唐诗大体可据。',
    how: [
      '近体诗(五律、七律、五绝、七绝)逐字标平仄:○ 平 · ● 仄 · ◐ 一字两收而平仄不一(多音字,不硬判);并标句末字所属韵部。',
      '古诗、乐府只标句末字所属韵部,不逐字标平仄。',
      '入声字依韵书作仄(今普通话已派入四声,「国」「竹」「白」今读平),悬停可见说明。',
    ],
  },
  cilin: {
    corpus: 'songci',
    what: '宋人填词并没有一部专门的韵书,凭的是实际读音;清代戈载编《词林正韵》,把宋词用韵归纳为 19 部:前 14 部平声与上去同部,后 5 部为入声。',
    how: [
      '只标句末字所属的「第几部」,不逐字标平仄。',
      '同一部平仄两收的字(如「中」)并为一条,悬停列出平声 / 仄声。',
    ],
  },
  zhongyuan: {
    corpus: 'yuanqu',
    what: '元人周德清编,以当时北方的实际语音为准:入声消失、派入平上去三声,平声分阴阳,全书 19 韵部。与诗词沿用的平水韵不是一套,这是曲与诗词之间最硬的一条界线。',
    how: [
      '只标句末字所属韵部(东钟、江阳……),不逐字标平仄。',
      '入声字已派入三声,归哪一韵照书中所记。',
    ],
  },
}

const GROUP_LABEL = { tangshi: '唐诗', songci: '宋词', yuanqu: '元曲' }
const GROUP_BOOKS = { tangshi: '唐诗三百首', songci: '宋词三百首 · 宋词补遗', yuanqu: '元曲选' }
const PREVIEW = 20 // 每组默认先列前 20 字,余者展开

const fmt = (n) => n.toLocaleString('zh-CN')
const pct = (x) => `${(x * 100).toFixed(2)}%`

function exampleHref(corpus, ex) {
  return `/${corpus}/${ex.slug}/${ex.ch}${ex.part ? `?p=${ex.part}` : ''}#p${ex.para + 1}`
}

// 例句里把该字标出来
function Line({ text, char }) {
  const bits = text.split(char)
  return (
    <>
      {bits.map((b, i) => (
        <span key={i}>{b}{i < bits.length - 1 && <b className="rb-hit">{char}</b>}</span>
      ))}
    </>
  )
}

function BookFacts({ b }) {
  if (b.scheme === 'pingshui') {
    const s = b.sheng
    return (
      <dl className="rb-facts">
        <dt>部数</dt><dd>{b.parts} 部(上平 {s['上平']} · 下平 {s['下平']} · 上 {s['上']} · 去 {s['去']} · 入 {s['入']})</dd>
        <dt>收字</dt><dd>{fmt(b.chars)} 字,另【詞】增补字 {fmt(b.ciChars)}(本字查不到时方退查)</dd>
        <dt>异体</dt><dd>退查表 {b.variants} 条(只收同字异写,如 隣 → 鄰)</dd>
      </dl>
    )
  }
  return (
    <dl className="rb-facts">
      <dt>部数</dt>
      <dd>{b.parts} {b.scheme === 'cilin' ? `部(舒声 ${b.shu} 部平仄同部 · 入声 ${b.ru} 部)` : '韵(每韵分阴平 · 阳平 · 上 · 去,入声派入三声)'}</dd>
      <dt>收字</dt><dd>{fmt(b.chars)} 字</dd>
      <dt>异体</dt><dd>退查表 {b.variants} 条(只收同字异写)</dd>
    </dl>
  )
}

function BookCard({ b }) {
  const t = BOOK_TEXT[b.scheme]
  const g = data.groups.find((x) => x.scheme === b.scheme)
  return (
    <section id={`rb-${b.scheme}`} className={`rb-book rb-accent--${t.corpus}`} aria-labelledby={`rb-${b.scheme}-h`}>
      <header className="rb-book__head">
        <span className="rb-book__seal" aria-hidden="true">{GROUP_LABEL[t.corpus].slice(0, 1)}</span>
        <div>
          <h2 id={`rb-${b.scheme}-h`} className="rb-book__title">《{b.title}》</h2>
          <p className="rb-book__src">来源:维基文库《{b.page}》</p>
        </div>
      </header>
      <p className="rb-book__what">{t.what}</p>
      <BookFacts b={b} />
      <p className="rb-book__use">
        本站用于<Link to={`/${t.corpus}`} className="rb-book__group">{GROUP_LABEL[t.corpus]}</Link>(阅读器工具条「格律」开关):
      </p>
      <ul className="rb-book__how">
        {t.how.map((h) => <li key={h}>{h}</li>)}
      </ul>
      {g && (
        <a href={`#rb-u-${g.corpus}`} className="rb-book__jump">
          {GROUP_LABEL[t.corpus]}里此书未收的字:{g.stats.distinct} 个 ↓
        </a>
      )}
    </section>
  )
}

function GroupTable({ g, endOnly }) {
  const [open, setOpen] = useState(false)
  const s = g.stats
  const rows = endOnly ? g.items.filter((x) => x.endCount > 0) : g.items
  const shown = open ? rows : rows.slice(0, PREVIEW)
  const book = data.books[g.scheme]
  return (
    <section id={`rb-u-${g.corpus}`} className={`rb-group rb-accent--${g.corpus}`} aria-labelledby={`rb-u-${g.corpus}-h`}>
      <h3 id={`rb-u-${g.corpus}-h`} className="rb-group__title">
        {GROUP_LABEL[g.corpus]}
        <span className="rb-group__by">依《{book.title}》· {GROUP_BOOKS[g.corpus]}</span>
      </h3>
      {/* JSX 跨行文本会在行间插空格,中文里看得见——这里逐段拼,不换行写字 */}
      <p className="rb-group__stats">
        {'韵文 '}{fmt(s.chars)}{' 字中,韵书未收 '}<strong>{fmt(s.unlisted)}</strong>{` 次(${pct(s.rate)}),共 `}<strong>{s.distinct}</strong>{' 个字;'}
        {'句末未收 '}<strong>{s.endUnlisted}</strong>{` 句、${s.endDistinct} 个字。`}
        {s.viaVariant > 0 && `另有 ${fmt(s.viaVariant)} 次经异体退查表查到`}
        {s.viaCi > 0 && `、${fmt(s.viaCi)} 次查自【詞】增补字`}
        {(s.viaVariant > 0 || s.viaCi > 0) && ',不计入未收。'}
      </p>
      {rows.length === 0 ? (
        <p className="rb-group__empty text-faint">无。</p>
      ) : (
        <table className="rb-table">
          <colgroup>
            <col className="rb-table__c-char" />
            <col className="rb-table__c-num" />
            <col className="rb-table__c-num" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">字</th>
              <th scope="col" className="rb-num">次数</th>
              <th scope="col" className="rb-num">句末</th>
              <th scope="col">例句</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => (
              <tr key={it.char}>
                <th scope="row" className="rb-table__char">{it.char}</th>
                <td className="rb-num">{it.count}</td>
                <td className="rb-num">{it.endCount || <span className="rb-zero">—</span>}</td>
                <td>
                  <ul className="rb-examples">
                    {it.examples.map((ex) => (
                      <li key={`${ex.slug}-${ex.ch}-${ex.para}-${ex.line}`}>
                        <Link to={exampleHref(g.corpus, ex)} className="rb-example">
                          <span className="rb-example__line"><Line text={ex.line} char={it.char} /></span>
                          <span className="rb-example__src">— {ex.title}{ex.end && <span className="rb-example__end">句末</span>}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > PREVIEW && (
        <button type="button" className="toggle-btn rb-group__more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '收起' : `显示全部 ${rows.length} 字`}
        </button>
      )}
    </section>
  )
}

export default function RhymeBooksPage() {
  usePageTitle('韵书与未收字')
  const [endOnly, setEndOnly] = useState(false)
  const { hash } = useLocation()

  // 懒加载页:浏览器自带的锚点定位赶在渲染前,挂载后自己滚(ProsodyLegend 的「韵书说明 →」带 #rb-<韵书>)。
  // 不用 rAF(后台标签页被节流),短间隔重试、找到即停。
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    let timer = 0
    const deadline = Date.now() + 1500
    const tick = () => {
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView({ block: 'start' }); return }
      if (Date.now() < deadline) timer = setTimeout(tick, 60)
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [hash])

  const books = Object.values(data.books)
  return (
    <div className="rb-page page-content">
      <div className="basics-breadcrumb">
        <Link to="/" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">韵书与未收字</h1>
        <p className="page-subtitle text-soft">唐诗、宋词、元曲阅读器里「格律」标的平仄与韵部,查自这三部韵书;韵书没收的字,本页一一列出。</p>
      </div>

      <p className="rb-intro">
        {'打开唐诗、宋词或元曲任一章,工具条上按「格律」,每句下面便摆出韵书所记:这个字是平是仄,句末字属哪一部。标法只是'}
        <strong>照书摆出来</strong>
        {'——同一首里句末同部的字着同一种颜色,只出现一次的为灰;不判出律,也不判合不合律。'}
        {'韵书查不到的字标「未收」:多半是维基文库页面漏录,或今天通行的写法与韵书不同。按本站规矩不补一字,所以把这些字列在下面,点例句可回到原文那一句。'}
      </p>

      <div className="rb-books">
        {books.map((b) => <BookCard key={b.scheme} b={b} />)}
      </div>

      <section className="rb-legend" aria-label="格律标注图例">
        <h2 className="rb-h2">阅读器里的符号</h2>
        <p className="rb-legend__keys">
          <span className="rb-legend__key"><span className="pz pz--ping" aria-hidden="true" />平</span>
          <span className="rb-legend__key"><span className="pz pz--ze" aria-hidden="true" />仄</span>
          <span className="rb-legend__key"><span className="pz pz--duo" aria-hidden="true" />可平可仄(韵书两收)</span>
          <span className="rb-legend__key"><span className="pz pz--none" aria-hidden="true" />韵书未收</span>
        </p>
        <p className="rb-legend__keys">
          <span className="rb-legend__key">
            <span className="rhyme-tag rhyme-tag--c1" aria-hidden="true"><span className="rhyme-tag__char">秦</span><span className="rhyme-tag__part">十一真</span></span>
            句末同部者同色
          </span>
          <span className="rb-legend__key">
            <span className="rhyme-tag rhyme-tag--plain" aria-hidden="true"><span className="rhyme-tag__char">路</span><span className="rhyme-tag__part">七遇</span></span>
            本首只出现一次
          </span>
          <span className="rb-legend__key">
            <span className="rhyme-tag rhyme-tag--plain rhyme-tag--none" aria-hidden="true"><span className="rhyme-tag__char">啼</span><span className="rhyme-tag__part">未收</span></span>
            韵书查不到
          </span>
        </p>
      </section>

      <section className="rb-unlisted" aria-labelledby="rb-unlisted-h">
        <div className="rb-unlisted__head">
          <h2 id="rb-unlisted-h" className="rb-h2">站内诗词里的未收字</h2>
          <label className="toggle-label">
            <span>只看句末</span>
            <button
              type="button"
              role="switch"
              className={`switch switch--sm ${endOnly ? 'switch--on' : ''}`}
              aria-checked={endOnly}
              aria-label="只看句末"
              onClick={() => setEndOnly((v) => !v)}
            >
              <span className="switch__knob" aria-hidden="true" />
            </button>
          </label>
        </div>
        <p className="rb-unlisted__note text-soft">
          {'「次数」是该字在韵文里出现的总次数,「句末」是其中落在句末的次数——阅读器在每句末挂一枚韵部签,签上标「未收」的就是这些;句中的字只在近体诗逐字标平仄时才标出。'}
          {'查法与阅读器同一套:先查本字(繁简两种写法都查),平水韵再查【詞】增补字,最后查异体退查表(只收同字异写);都查不到才算未收。'}
        </p>
        {data.groups.map((g) => <GroupTable key={g.corpus} g={g} endOnly={endOnly} />)}
      </section>

      <p className="rb-fanli text-faint">
        {'凡例:三部韵书的字表照维基文库页面原样录入,繁体原样收、另以简体双收,括注释义与拆字描述已剔;一字多部照列,不作取舍。'}
        {'维基页面有缺(如平水韵八齐部漏「啼」),按规矩不补,查不到即如实标「未收」。今音与韵书不同者,以韵书为准。'}
        {'诗题、曲牌题等标题段不计;切句与阅读器一致,逢句读(\uFF0C\u3002\uFF1B\uFF01\uFF1F)断句。'}
      </p>
    </div>
  )
}
