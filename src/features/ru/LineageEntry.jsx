import { Link } from 'react-router-dom'
import './LineageEntry.css'

// 儒门学脉图入口(design-v24 §5):儒、心两组首页各挂一行,嵌在书架页头的副标题下。
// 书架组件是全站共用的,不为一行入口加插槽——副标题本就接受节点,这里渲染成副标题里另起的一行。
export default function LineageEntry() {
  return (
    <span className="lineage-entry">
      <Link to="/ru/lineage" className="lineage-entry__link">儒门学脉图 →</Link>
      <span className="lineage-entry__hint">孔孟荀 · 周程朱 · 陆王,谁接谁、谁驳谁,每根线挂着原文</span>
    </span>
  )
}
