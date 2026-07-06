import { Link } from 'react-router-dom'
import { MASTER_PORTAL_PATH } from '../../sites/registry.js'

// 观书页面左上角的「观象」印章——回全站首页(诸学门户)。与主导航 logo 同款视觉(.brand-seal),
// 但观书走中立外壳(data-site="portal")、不渲染主导航,故各页自带一枚。只这里→首页单向,首页不设回链(隐藏入口)。
export default function HomeSeal() {
  return (
    <Link to={MASTER_PORTAL_PATH} className="books-home-seal" aria-label="观象 · 回首页" title="观象 · 回首页">
      <span className="brand-seal" aria-hidden="true">观象</span>
    </Link>
  )
}
