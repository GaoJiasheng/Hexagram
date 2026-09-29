import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { allGroups, sitesInGroup, siteEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { corpusTexts } from './reader/corpus.js'
import daoTexts from '../data/dao/texts.json'
import PortalStudyTrail from './reader/PortalStudyTrail.jsx'
import PortalLanding from './PortalLanding.jsx'

// 卡片描述由 texts.json 派生(已收书目+计数),根治「加书忘改 portalDesc 文案」;
// 易经非书目制(64 卦 + 工具),保留其 portalDesc tagline。
function siteDesc(site) {
  if (site.key === 'yijing') return site.portalDesc
  const texts = site.key === 'dao' ? daoTexts : corpusTexts(site.key)
  const done = (texts || []).filter(t => t.status === 'done')
  if (!done.length) return site.portalDesc
  const titles = done.slice(0, 4).map(t => t.title).join(' · ')
  return done.length > 4 ? `${titles} 等 ${done.length} 部` : titles
}

// 每组以自有的沉静色驱动徽章/悬停(--card-accent);易经的 cinnabar 在门户外壳被映射为墨色。
const accentStyle = (site) => ({ '--card-accent': `var(--${site.accent})` })

// 诸学门户(总入口)——左上角 logo 全站可达,列全部分组(易道/儒/佛/心/法/墨/兵/纵横/中医/谋略)。
// 生产域名上卡片链向各组绝对 URL(跨域),dev 用相对路径。
export default function MasterPortalPage({ onSearch }) {
  const { pathname } = useLocation()
  // `/` 是**首页**(第一次来的人),要先说清这是什么;
  // `/hexagram` 是站内 logo 的回跳点,人到那儿是**要换一组书**的 —— 只给书架,不铺介绍。
  const landing = pathname === '/'
  usePageTitle(landing ? '古籍研读站' : '门户')
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

  // 2026-09-30 门户重排(owner:「三列等宽卡在宽屏上丑」):
  // 十五个组不再摊成一面等宽卡片墙,而是**按门类分行**——左侧竖排的门类标签(易道 / 儒释 / 诸子 / 方术 / 集部)
  // 像书架的分类签,每行放该门类的几组;卡片改横向(印章在左、题与书目在右),宽屏一行铺满、窄屏自动折行,
  // 手机上门类签转横向、卡片单列。易道两卡仍以小太极桥相系(「桥」需同组)。
  // 门类是门户的**呈现分组**,不动 registry 的 group(隔离/域名语义不变);不在表里的新组落到「其他」行。
  // portalHidden 组(骨架期)仍跳过——只影响本页,该组仍可直连 URL。
  const groups = allGroups().filter((g) => !sitesInGroup(g).some((s) => s.portalHidden))
  const sites = groups.flatMap((g) => sitesInGroup(g))
  const byKey = Object.fromEntries(sites.map((s) => [s.key, s]))
  const FAMILIES = [
    { key: 'yidao', label: '易道', note: '一体两翼', keys: ['yijing', 'dao'], bond: true },
    { key: 'rushi', label: '儒释', note: '三家心性', keys: ['ru', 'fo', 'xin'] },
    { key: 'zhuzi', label: '诸子', note: '百家之言', keys: ['fa', 'mo', 'bing', 'zong', 'moulue'] },
    { key: 'fangshu', label: '方术', note: '医经术数', keys: ['zhongyi', 'mingli'] },
    { key: 'jibu', label: '集部', note: '诗词曲', keys: ['tangshi', 'songci', 'yuanqu'] },
  ]
  const placed = new Set(FAMILIES.flatMap((f) => f.keys))
  const rest = sites.filter((s) => !placed.has(s.key)).map((s) => s.key)
  const families = [...FAMILIES, ...(rest.length ? [{ key: 'qita', label: '其他', note: '', keys: rest }] : [])]
    .map((f) => ({ ...f, sites: f.keys.map((k) => byKey[k]).filter(Boolean) }))
    .filter((f) => f.sites.length)
  const renderCard = (s) => (
    <a key={s.key} href={siteEntryHref(s, protocol, hostname)} className="master-portal__card" style={accentStyle(s)}>
      <span className="master-portal__seal">{s.brand}</span>
      <span className="master-portal__body">
        <span className="master-portal__titles">{s.portalTitle}</span>
        <span className="master-portal__desc">{siteDesc(s)}</span>
      </span>
    </a>
  )
  const bond = (
    <span className="master-portal__bond" aria-hidden="true">
      <span className="master-portal__bond-line" />
      <span className="master-portal__bond-node">☯</span>
      <span className="master-portal__bond-line" />
    </span>
  )

  const shelf = (
    <div className="master-portal__shelf">
      <p className="master-portal__hint">观象 · 诸学门户</p>
      {families.map((f) => (
        <section key={f.key} className={`master-portal__family ${f.bond ? 'master-portal__family--bond' : ''}`} aria-label={f.label}>
          <div className="master-portal__family-head">
            <span className="master-portal__family-label">{f.label}</span>
            <span className="master-portal__family-rule" aria-hidden="true" />
            {f.note && <span className="master-portal__family-note">{f.note}</span>}
          </div>
          <div className="master-portal__family-cards" style={{ '--n': f.sites.length }}>
            {f.sites.map((s, i) => (
              <Fragment key={s.key}>
                {f.bond && i > 0 && bond}
                {renderCard(s)}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <div className={`master-portal ${landing ? 'master-portal--landing' : ''}`}>
      {landing ? <PortalLanding shelf={shelf} /> : shelf}
      {/* 招牌入口:赛博·百家争鸣(诸子跨派对辩,内容持续增补)——单列醒目横幅,不再混在小字链里 */}
      <Link to="/debates" className="master-portal__debates" aria-label="赛博 · 百家争鸣">
        <span className="master-portal__debates-seal" aria-hidden="true">争鸣</span>
        <span className="master-portal__debates-body">
          <span className="master-portal__debates-title">赛博 · 百家争鸣</span>
          <span className="master-portal__debates-sub">诸子隔空对辩 · 另附拓扑图:他们历史上真的怎么说彼此</span>
        </span>
        <span className="master-portal__debates-go" aria-hidden="true">›</span>
      </Link>
      <PortalStudyTrail />
      <p className="master-portal__links">
        <Link to="/concepts" className="master-portal__about-link">义理专题 · 跨派概念</Link>
        <Link to="/mingju" className="master-portal__about-link">名句集 · 每日一句</Link>
        <Link to="/timeline" className="master-portal__about-link">全站时间轴 · 诸书成书年代</Link>
        <Link to="/renwu" className="master-portal__about-link">人物志 · 诸书背后的人</Link>
      </p>
    </div>
  )
}
