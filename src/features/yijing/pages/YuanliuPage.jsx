import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { markRead } from '../storage.js'
import renwu from '../../../data/yijing/renwu.json'
import { usePageTitle } from '../hooks/usePageTitle.js'

// 易学源流时间线(v4 §2,定稿照录;v9 §3 扩展:节点挂人物锚点+同页小传)
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
    people: ['jingfang', 'yufan'],
  },
  {
    era: '魏晋',
    who: '王弼扫象',
    text: '王弼《周易注》一扫汉代繁琐象数，主张「得意而忘象」，以老庄义理解易。其注本成为后世通行底本——今天读到的《周易》篇序，大体就是王弼本的格局。',
    tags: ['义理', '通行本'],
    people: ['wangbi'],
  },
  {
    era: '唐代',
    who: '孔颖达《周易正义》',
    text: '唐修《五经正义》，孔颖达主撰《周易正义》，以王弼注为底、集汉魏注疏之成，成为官学定本与科举标准。本站系辞下按九章分法，即从孔疏。',
    tags: ['官学', '注疏'],
    people: ['kongyingda'],
  },
  {
    era: '北宋',
    who: '邵雍先天之学 · 图书之学兴起',
    text: '邵雍据陈抟所传推演先天图，作《皇极经世》；周敦颐作太极图说；河图洛书之学大兴。梅花易数托名邵雍，其先天卦数（乾一兑二…坤八）即先天八卦次序。',
    tags: ['先天图', '河洛', '梅花'],
    people: ['chentuan', 'shaoyong'],
  },
  {
    era: '南宋',
    who: '程颐《伊川易传》 · 朱熹《周易本义》',
    text: '程颐纯以义理说经，朱熹兼采象数、占筮以求经文本义——二书合称「程传朱义」，元明以降科举定本。本站译文遇歧义时取程朱主流注解，依据即在此。',
    tags: ['程朱', '译文取径'],
    people: ['chengyi', 'zhuxi'],
  },
  {
    era: '明代',
    who: '来知德错综说',
    text: '来知德隐居近三十年独注《周易集注》，以错（阴阳相对）、综（上下颠倒）两法读尽卦象。本站卦页的错卦、综卦两项关联，即用来氏定名。',
    tags: ['错综', '来氏易'],
    people: ['laizhide'],
  },
  {
    era: '清以降',
    who: '考据与出土文献',
    text: '清儒惠栋、焦循等复兴汉易、精于考据；尚秉和以《左传》《国语》筮例钩沉逸象。二十世纪以来，马王堆帛书《周易》、上博楚简等出土文献不断改写经文形成史的细节。',
    tags: ['汉学', '出土文献'],
    people: ['shangbinghe'],
  },
]

const RENWU_BY_ID = Object.fromEntries(renwu.map(p => [p.id, p]))

export default function YuanliuPage() {
  usePageTitle('易学源流')
  const { hash } = useLocation()

  useEffect(() => { markRead('yuanliu') }, [])

  // 人物锚点定位(时间线章/站外跳入);路由切换后 smooth 会被渲染取消,
  // 延迟一帧用 instant
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [hash])

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
                  {(n.people || []).map(id => (
                    <a key={id} href={`#${id}`} className="yuanliu-person-link">{RENWU_BY_ID[id].name} ↓</a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-faint yuanliu-disclaimer">本页为研习线索，非学术史定论；「三圣作易」诸说皆从传统旧题。</p>
      </section>

      {/* 人物小传(v9 §3,脱锚叙述照 v9 §4 分级规范) */}
      <section className="basics-section">
        <h2 className="basics-section__title">人物小传 · 易学十家</h2>
        {renwu.map(p => (
          <div key={p.id} id={p.id} className="renwu-entry">
            <div className="renwu-entry__head">
              <span className="renwu-entry__name">{p.name}</span>
              <span className="renwu-entry__era">{p.era}{p.dates ? ` · ${p.dates}` : ''}</span>
            </div>
            {p.paragraphs.map((para, i) => (
              <p key={i} className="shili-reading">{para}</p>
            ))}
            {p.links.length > 0 && (
              <p className="shishi-refs">
                {p.links.map((l, i) => (
                  <Link key={i} to={l.to} className="shishi-ref">{l.label}</Link>
                ))}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
