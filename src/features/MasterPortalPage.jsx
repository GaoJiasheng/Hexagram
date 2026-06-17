import { Link } from 'react-router-dom'
import { allGroups, sitesInGroup, groupEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { corpusTexts } from './reader/corpus.js'
import daoTexts from '../data/dao/texts.json'

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

// 诸学门户(总入口)——左上角 logo 全站可达,列全部分组(易道/儒/佛/心/法/墨/兵/纵横/中医/谋略)。
// 生产域名上卡片链向各组绝对 URL(跨域),dev 用相对路径。
export default function MasterPortalPage() {
  usePageTitle('门户')
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

  return (
    <div className="master-portal">
      <p className="master-portal__hint">观象 · 诸学门户</p>
      <div className="master-portal__cards">
        {allGroups().map(group => {
          const sites = sitesInGroup(group)
          return (
            <a key={group} href={groupEntryHref(group, protocol, hostname)} className="master-portal__card">
              <span className="master-portal__seals">
                {sites.map(s => <span key={s.key} className="master-portal__seal">{s.brand}</span>)}
              </span>
              <span className="master-portal__titles">
                {sites.map(s => s.portalTitle).join(' · ')}
              </span>
              <span className="master-portal__desc">
                {sites.map(siteDesc).join(' / ')}
              </span>
            </a>
          )
        })}
      </div>
      <p className="master-portal__about">
        <Link to="/about" className="master-portal__about-link">关于本站 · 研读铁律与数据说明</Link>
      </p>
    </div>
  )
}
