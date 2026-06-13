import { allGroups, sitesInGroup, groupEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 三教门户(v15 隐藏入口)——仅 owner 经秘密路径访问;跨域名在易道/儒/佛间跳转。
// 无任何站内链接指向本页;生产域名上卡片链向各组绝对 URL,dev 用相对路径。
export default function MasterPortalPage() {
  usePageTitle('门户')
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

  return (
    <div className="master-portal">
      <p className="master-portal__hint">三教门户 · 仅本人入口</p>
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
            </a>
          )
        })}
      </div>
    </div>
  )
}
