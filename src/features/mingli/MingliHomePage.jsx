import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { corpusTexts } from '../reader/corpus.js'
import SchoolEntry from '../reader/SchoolEntry.jsx'

// 观数(命理研习)组首页——**学习路径图,不是书架**。区别于其余读经站直接铺 ScriptureShelf:
// 这几部书不是平行的,硬啃《三命通会》读不下去,通行的进阶次序本身就是这一页的骨架
// (docs/mingli-and-interactive-plan.md §2):
//
//   学堂(前置知识) → 《渊海子平》入门 → 三条不同的路(《子平真诠》格局 /
//   《滴天髓阐微》旺衰 / 《穷通宝鉴》调候)→ 汇合 → 《三命通会》集大成 → 源头诸书
//
// 《三命通会》与源头诸书目前不在 texts.json(尚未立项收书),先摆两个静态占位节点;
// 等对应书真正入库后改走 corpusTexts('mingli') 数据驱动,和前四书一致。
const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 进阶三书固定按「格局 / 旺衰 / 调候」次序陈列,不依赖 texts.json 的书写顺序
const ADVANCED_ORDER = ['zhenquan', 'ditiansui', 'qiongtong']

const PLACEHOLDER_STAGES = [
  { key: 'sanming', title: '三命通会', note: '明·万民英，十二卷，命理集大成之书——当百科查，不必通读。' },
  { key: 'yuantou', title: '源头诸书', note: '《五行大义》《李虚中命书》《珞琭子三命消息赋》《玉照定真经》——想知道这套东西从哪来的，再读这几部。' },
]

function BookCard({ t }) {
  const pending = !t.status || t.status === 'pending'
  const inner = (
    <>
      {t.lens && <div><span className="mingli-path__lens">{t.lens}一路</span></div>}
      <div className="dao-book__title">{t.title}</div>
      {t.alias && <div className="dao-book__alias">{t.alias}</div>}
      <div className="dao-book__meta">
        <span>{t.era}</span>
        <span>{t.attribution}</span>
      </div>
      <p className="dao-book__brief">{t.brief}</p>
      {t.dubious && <div className="dao-book__dubious">⚠ 托名·疑现代伪作</div>}
      {t.caveat && !t.dubious && <div className="dao-book__caveat">⚠ {t.caveat}</div>}
      <span className={`dao-book__status dao-book__status--${t.status || 'pending'}`}>
        {STATUS_LABEL[t.status] || '整理中'}
      </span>
    </>
  )
  // 卡片本身是一个链接,「这本书的形状」入口不能嵌在里面(a 套 a 不合法)→ 作为同格的第二个链接挂在卡片下
  return (
    <div className="mingli-path__cell">
      {pending
        ? <div className="dao-book dao-book--pending mingli-path__card" aria-disabled="true">{inner}</div>
        : <Link to={`/mingli/${t.slug}`} className="dao-book mingli-path__card">{inner}</Link>}
      {t.shape && !pending && (
        <Link to={t.shape.href} className="mingli-path__shape">
          <span className="mingli-path__shape-tag">动手</span>{t.shape.label} →
        </Link>
      )}
    </div>
  )
}

function PlaceholderCard({ stage }) {
  return (
    <div className="dao-book dao-book--pending mingli-path__card" aria-disabled="true">
      <div className="dao-book__title">{stage.title}</div>
      <p className="dao-book__brief">{stage.note}</p>
      <span className="dao-book__status">整理中</span>
    </div>
  )
}

// 普通连接段(单 → 单):一条竖线。分叉/汇合段(variant)桌面走内联 SVG,窄屏由 CSS 换回竖线。
function Connector({ variant }) {
  if (variant === 'fork' || variant === 'merge') {
    const stroke = { stroke: 'var(--line)', strokeWidth: 2, fill: 'none' }
    return (
      <div className="mingli-path__connector mingli-path__connector--branch" aria-hidden="true">
        <svg viewBox="0 0 300 56" className="mingli-path__fork" preserveAspectRatio="none">
          {variant === 'fork' ? (
            <>
              <line x1="150" y1="0" x2="150" y2="16" style={stroke} />
              <path d="M150 16 C150 34 50 30 50 56" style={stroke} />
              <line x1="150" y1="16" x2="150" y2="56" style={stroke} />
              <path d="M150 16 C150 34 250 30 250 56" style={stroke} />
            </>
          ) : (
            <>
              <path d="M50 0 C50 26 150 22 150 38" style={stroke} />
              <line x1="150" y1="0" x2="150" y2="38" style={stroke} />
              <path d="M250 0 C250 26 150 22 150 38" style={stroke} />
              <line x1="150" y1="38" x2="150" y2="56" style={stroke} />
            </>
          )}
        </svg>
      </div>
    )
  }
  return (
    <div className="mingli-path__connector" aria-hidden="true">
      <span className="mingli-path__connector-line" />
    </div>
  )
}

export default function MingliHomePage() {
  usePageTitle(null, '观数')
  const texts = corpusTexts('mingli')
  const entry = texts.find((t) => t.tier === '入门')
  const advanced = ADVANCED_ORDER.map((slug) => texts.find((t) => t.slug === slug)).filter(Boolean)

  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">命理研读</h1>
        <p className="page-subtitle">
          子平八字的典籍与门径——不是排盘工具，是一条把《渊海子平》《子平真诠》《滴天髓》《穷通宝鉴》
          这些书真正读进去的路。
        </p>
      </div>

      <div className="shelf-disclaimer" role="note">
        ⚠ 研习不断命：本组是命理典籍的文献研读。原典中的断语照译不讳，但注疏与白话只作训诂与学说史，
        不为之背书，也不提供任何算命或预测。
      </div>

      <SchoolEntry corpus="mingli" />

      <div className="mingli-path">
        <div className="mingli-path__level">
          <Link to="/mingli/learn" className="mingli-path__gate">
            <span className="mingli-path__gate-tag">前置知识 · 学堂 6 篇</span>
            <span className="mingli-path__gate-title">学堂</span>
            <span className="mingli-path__gate-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <Connector />

        {entry && (
          <div className="mingli-path__level">
            <div className="mingli-path__row">
              <BookCard t={entry} />
            </div>
          </div>
        )}

        <Connector variant="fork" />

        <div className="mingli-path__level">
          <div className="mingli-path__row mingli-path__row--triple">
            {advanced.map((t) => <BookCard key={t.slug} t={t} />)}
          </div>
          <p className="mingli-path__note">
            同一个八字，《子平真诠》先问月令成什么格，《滴天髓》先问日主强弱与气势，
            《穷通宝鉴》先问生在几月、是寒是暖——三本书是三条不同的路。
          </p>
        </div>

        <Connector variant="merge" />

        <div className="mingli-path__level">
          <Link to="/mingli/paipan" className="mingli-path__gate mingli-path__gate--tool">
            <span className="mingli-path__gate-tag">读到这里,自己排一个 · 只排结构,不作断语</span>
            <span className="mingli-path__gate-title">排盘台</span>
            <span className="mingli-path__gate-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <Connector />

        <div className="mingli-path__level">
          <div className="mingli-path__row">
            <PlaceholderCard stage={PLACEHOLDER_STAGES[0]} />
          </div>
        </div>

        <Connector />

        <div className="mingli-path__level">
          <div className="mingli-path__row">
            <PlaceholderCard stage={PLACEHOLDER_STAGES[1]} />
          </div>
        </div>
      </div>

      {/* 底本与凡例(C2)。放在组内而不进全站 /about:这一组的取舍(只收清及以前、殆知阁本未经对校)
          与别组不同,读者应当在进门的地方就看到。 */}
      <details className="mingli-fanli">
        <summary>底本与凡例</summary>
        <ul>
          <li><strong>只收清代及以前的文字。</strong>民国以后诸家(徐乐吾、韦千里、袁树珊等)的评注一律不收——既为版权,也为让读者先看到原书本来的样子。数据校验里设有一道闸,检出即拦。</li>
          <li><strong>《渊海子平》《滴天髓阐微》</strong>取维基文库录入本。后者有一批录入形讹,凡同书内证充分的(如「仁至尚书」当作「仕至」)已据改,逐条记在校勘记里;疑讹而无确证的一律<strong>留讹不改</strong>。</li>
          <li><strong>《子平真诠》《穷通宝鉴》</strong>维基文库无,取殆知阁电子本,原无版本说明,<strong>未及与影印本对校</strong>,但都拿独立的白文本逐段对过:《穷通宝鉴》全部段落见于余春台本,干净;《子平真诠》则查出这个电子本出自民国徐乐吾《评注》一系,夹着徐氏增益的文字——最有名的就是「取用之法约略归纳为五种:扶抑、病药、调候、专旺、通关」那一段,以及书末整篇「附论杂格取运」。凡只见于评注本、不见于白文本的,<strong>一律不收</strong>(共一篇又十二段);其中一段评注本标作原文而白文本皆无,存疑,也不收。所存乾隆四十一年胡焜倬序为原序。</li>
          <li><strong>原典里的断语照录照译</strong>,不删不讳;但注疏、白话、学堂与各个交互件都只讲「书里怎么说、为什么这么说」,不替原书背书,也不教人拿去套用。排盘台只排结构,不出任何判断。</li>
          <li><strong>各家说法不一之处如实并陈</strong>:阴阳生死(《真诠》主之、任铁樵驳之)、子时换日、真太阳时,都只给开关不拍板;《穷通宝鉴》自身前后说法有出入的十三格,在调候矩阵上逐格标出。</li>
          <li>交互件里的规则(五虎遁、五鼠遁、藏干、十神、格局判定)都有单测,且以<strong>原书自己举的例子</strong>为验;引用原文之处一律由程序从底本切片,校验逐字命中。</li>
        </ul>
      </details>
    </div>
  )
}
