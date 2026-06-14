import { allGroups, sitesInGroup, groupEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

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
                {sites.map(s => s.portalDesc).join(' / ')}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
