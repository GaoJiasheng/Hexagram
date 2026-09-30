import { Link } from 'react-router-dom'
import DATA from '../../data/ru-lineage.json'
import LineageView from './LineageView.jsx'

// 儒门学脉图(design-v24 §5)。视图在 LineageView.jsx(禅宗传灯图共用),这里只给儒门这份数据与页面文案。
// 动什么:开关三类线、点人、点线。悟什么:「道统」是宋儒排出来的一条线(图上旧说皆点线、标存疑);
// 程颢、程颐之后分出朱熹与陆王两路;同一门里驳与尊常出自同一个人(阳明之于朱子、荀子之于孔孟)。
// 数据 src/data/ru-lineage.json(每条引文由脚本从该章原文切出),闸 scripts/lib/check-ru-lineage.mjs。

export default function RuLineagePage() {
  return (
    <LineageView
      data={DATA}
      title="儒门学脉图"
      site="观仁"
      markerId="rulin-arrow"
      svgLabel="儒门学脉图:横轴为朝代,纵轴为儒、心学、理学三行,连线为师承、指摘与推许"
      crumbs={(
        <div className="basics-breadcrumb">
          <Link to="/ru" className="basics-breadcrumb__link">← 儒典研读</Link>
          <span className="ru-lineage__crumb-sep" aria-hidden="true">·</span>
          <Link to="/xin" className="basics-breadcrumb__link">阳明心学</Link>
        </div>
      )}
      fanli="人物年代取站内人物志口径,人物志未列者只写朝代,不给确数。师承旧说(孔子—曾子—子思—孟子、周敦颐—程颐、程颢—陆九渊、陆九渊—王守仁)与出处未署名的二程语,画成点线并在线上说明存疑在哪。每条线的引文都是站内该章原文的逐字摘录,由校验闸逐条回查;站外之事(《史记》《宋史》所记、鹅湖之会、朱陆书信等)只在说明里提及,不作引文。"
      back={<><Link to="/ru">← 儒典研读</Link> · <Link to="/xin">阳明心学</Link> · <Link to="/debates/map">诸子拓扑图</Link></>}
    />
  )
}
