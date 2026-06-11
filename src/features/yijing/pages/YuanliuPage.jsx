import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { markRead } from '../storage.js'

// 易学源流时间线(v4 §2,定稿照录)
const NODES = [
  {
    era: '传说时代',
    who: '伏羲画卦',
    text: '相传伏羲氏「仰则观象于天，俯则观法于地」，始作八卦，以通神明之德、以类万物之情。这是易的象数之源——八个三爻符号，把天地万物纳入一套取象系统。',
    tags: ['八卦', '观象'],
  },
  {
    era: '殷周之际',
    who: '文王演易 · 周公系辞',
    text: '传说文王被囚羑里时将八卦重为六十四卦并系卦辞，其子周公又系爻辞——《周易》经文（卦画、卦辞、爻辞）至此成形。「周」既指周代，也有「周普」之义。',
    tags: ['六十四卦', '卦爻辞'],
  },
  {
    era: '春秋',
    who: '孔子赞易',
    text: '传统说法孔子晚年喜易，「韦编三绝」，作十翼（彖、象、系辞、文言、说卦、序卦、杂卦）以解经。自此易学由卜筮之书转为义理之书，「观其德义」重于占断吉凶。',
    tags: ['十翼', '经传'],
  },
  {
    era: '汉代',
    who: '象数易学',
    text: '汉儒以象数解易并与历法灾异结合:孟喜创卦气说（十二消息卦配月令），京房立八宫纳甲、纳干支配六亲，郑玄有爻辰说。本站八宫与纳甲两套功能，正是京房一系的算法。',
    tags: ['卦气', '八宫', '纳甲'],
  },
  {
    era: '魏晋',
    who: '王弼扫象',
    text: '王弼《周易注》一扫汉代繁琐象数，主张「得意而忘象」，以老庄义理解易。其注本成为后世通行底本——今天读到的《周易》篇序，大体就是王弼本的格局。',
    tags: ['义理', '通行本'],
  },
  {
    era: '唐代',
    who: '孔颖达《周易正义》',
    text: '唐修《五经正义》，孔颖达主撰《周易正义》，以王弼注为底、集汉魏注疏之成，成为官学定本与科举标准。本站系辞下按九章分法，即从孔疏。',
    tags: ['官学', '注疏'],
  },
  {
    era: '北宋',
    who: '邵雍先天之学 · 图书之学兴起',
    text: '邵雍据陈抟所传推演先天图，作《皇极经世》；周敦颐作太极图说；河图洛书之学大兴。梅花易数托名邵雍，其先天卦数（乾一兑二…坤八）即先天八卦次序。',
    tags: ['先天图', '河洛', '梅花'],
  },
  {
    era: '南宋',
    who: '程颐《伊川易传》 · 朱熹《周易本义》',
    text: '程颐纯以义理说经，朱熹兼采象数、占筮以求经文本义——二书合称「程传朱义」，元明以降科举定本。本站译文遇歧义时取程朱主流注解，依据即在此。',
    tags: ['程朱', '译文取径'],
  },
  {
    era: '清以降',
    who: '考据与出土文献',
    text: '清儒惠栋、焦循等复兴汉易、精于考据；二十世纪以来，马王堆帛书《周易》、上博楚简等出土文献不断改写经文形成史的细节。',
    tags: ['汉学', '出土文献'],
  },
]

export default function YuanliuPage() {
  useEffect(() => { markRead('yuanliu') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">易学源流</h2>
        <div className="basics-text">
          <p>「易历三圣，世历三古。」从伏羲画卦到程朱集成，易学三千年的脉络大体是象数与义理两条线的交替消长。下面按时代列出主要节点——也是本站各功能的出处地图。</p>
        </div>

        <div className="yuanliu-timeline">
          {NODES.map((n, i) => (
            <div key={i} className="yuanliu-node">
              <div className="yuanliu-node__marker">
                <span className="yuanliu-node__dot" />
                {i < NODES.length - 1 && <span className="yuanliu-node__line" />}
              </div>
              <div className="yuanliu-node__body">
                <div className="yuanliu-node__head">
                  <span className="yuanliu-node__era">{n.era}</span>
                  <span className="yuanliu-node__who">{n.who}</span>
                </div>
                <p className="yuanliu-node__text">{n.text}</p>
                <div className="yuanliu-node__tags">
                  {n.tags.map(t => <span key={t} className="yuanliu-tag">{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-faint yuanliu-disclaimer">本页为研习线索，非学术史定论；「三圣作易」诸说皆从传统旧题。</p>
      </section>
    </div>
  )
}
