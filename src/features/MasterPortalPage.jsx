import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { allGroups, sitesInGroup, siteEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { corpusTexts } from './reader/corpus.js'
import daoTexts from '../data/dao/texts.json'
import PortalStudyTrail from './reader/PortalStudyTrail.jsx'
import DailyDebate from './debates/DailyDebate.jsx'

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
export default function MasterPortalPage() {
  usePageTitle('门户')
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

  // 所有卡同一形态、同一固定宽——单站组直接成卡;多站组(易道)的两站亦是普通卡,
  // 只是同居首行、以小太极桥相连(相系而不并合)。
  const groups = allGroups()
  const featuredGroup = groups.find(g => sitesInGroup(g).length > 1) // 易道
  const singleGroups = groups.filter(g => sitesInGroup(g).length === 1)
  const renderCard = (s) => (
    <a key={s.key} href={siteEntryHref(s, protocol, hostname)} className="master-portal__card" style={accentStyle(s)}>
      <span className="master-portal__seals"><span className="master-portal__seal">{s.brand}</span></span>
      <span className="master-portal__titles">{s.portalTitle}</span>
      <span className="master-portal__desc">{siteDesc(s)}</span>
    </a>
  )

  return (
    <div className="master-portal">
      <p className="master-portal__hint">观象 · 诸学门户</p>
      {featuredGroup && (
        <div className="master-portal__featured">
          {sitesInGroup(featuredGroup).map((s, i) => (
            <Fragment key={s.key}>
              {i > 0 && (
                <span className="master-portal__bond" aria-hidden="true">
                  <span className="master-portal__bond-line" />
                  <span className="master-portal__bond-node">☯</span>
                  <span className="master-portal__bond-line" />
                </span>
              )}
              {renderCard(s)}
            </Fragment>
          ))}
        </div>
      )}
      <div className="master-portal__cards">
        {singleGroups.map(g => renderCard(sitesInGroup(g)[0]))}
      </div>
      <PortalStudyTrail />
      <p className="master-portal__links">
        <Link to="/debates" className="master-portal__about-link">赛博 · 百家争鸣</Link>
        <span className="master-portal__links-sep"> · </span>
        <Link to="/concepts" className="master-portal__about-link">义理专题 · 跨派概念</Link>
      </p>
      <p className="master-portal__about">
        <Link to="/about" className="master-portal__about-link">关于本站 · 研读铁律与数据说明</Link>
      </p>
      <DailyDebate />
    </div>
  )
}
