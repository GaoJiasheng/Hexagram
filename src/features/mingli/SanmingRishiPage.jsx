import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { GAN, ZHI, JIAZI, ganWuxing, hourGan } from '../shared/ganzhi/index.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import index from '../../data/mingli/matrix/sanming-rishi.json'
import '../shared/widgets/GejuFlow.css'   // 借用日干选择钮的样式(.gj-pick)

// 《三命通会》卷八、卷九的「形状」:六十日 × 十二时 = 七百二十条。
// 万民英把此前流传的「某日生某时」断语逐条辑在一起,纸面上是一百二十章、每章六段;
// 这一页把它还原成一张可以直达的表:先选日干,再在「六个日 × 十二个时」里点一格,落到原文那一段。
// 索引由 scripts/gen-sanming-rishi.mjs 生成(时柱天干按五鼠遁算出并与段首核对;底本本身缺 2 格)。
// 守铁律:这是**书的目录**,不是查询结果——页面上不复述任何一条断语。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const HOUR_LABEL = ZHI.map((z) => `${z}时`)
const byKey = new Map(index.cells.map((c) => [`${c.day}|${c.hour}`, c]))

export default function SanmingRishiPage() {
  usePageTitle('日时查表 · 三命通会', '观数')
  const [sp, setSp] = useSearchParams()
  const initial = GAN.includes(sp.get('g')) ? sp.get('g') : '甲'
  const [gan, setGan] = useState(initial)
  const pick = (g) => { setGan(g); setSp({ g }, { replace: true }) }

  const block = useMemo(() => {
    const days = JIAZI.filter((d) => d[0] === gan)             // 同一日干的六个日
    const cells = {}
    for (const d of days) ZHI.forEach((z, i) => {
      const hit = byKey.get(`${d}|${z}`)
      if (hit) cells[`${d}日|${HOUR_LABEL[i]}`] = { text: hourGan(gan, z) + z, href: `/mingli/sanming/${hit.ch}#p${hit.para + 1}` }
    })
    return {
      type: 'widget', kind: 'matrix',
      props: {
        rows: days.map((d) => `${d}日`), cols: HOUR_LABEL, cells,
        rowLabel: `${gan}日(六个)`, colLabel: '生在哪个时辰 —— 格里的字是时柱,天干由日干按「五鼠遁」排出',
        foot: '一格 = 某日某时。点开就是原文那一段;空着的格是底本本身缺的。',
      },
    }
  }, [gan])

  return (
    <div className="qt-matrix-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/sanming" className="basics-breadcrumb__link">← 三命通会</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">日时查表</h1>
        <p className="page-subtitle">卷八、卷九:六十日乘十二时,七百二十条。</p>
      </div>

      <p className="qt-matrix-intro">
        《三命通会》是一部类书,万民英把此前流传的各路说法一条条辑在一起。其中卷八、卷九专收一种最古老的写法:
        <strong>不看年月,只拿「哪一日、哪个时辰」来立说</strong>,六十个日子各配十二个时辰,一共七百二十条。
        纸面上它是一百二十章、每章六段,翻起来极费劲;这里还原成一张表——先选日干,再点一格,直接落到原文那一段。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这张表是<strong>目录</strong>,不是查询结果,所以页面上不复述任何一条断语。读的时候请留意两件事:
        同一日同一时辰出生的人成千上万,这些条文自己也总在说「还要看年月如何」;
        而到了清代,《子平真诠》《滴天髓》都已不再这样立说——这两卷保存的是更早的一层写法,宜当文献看。
      </div>

      <div className="gj-picks" role="group" aria-label="选日干" style={{ margin: '18px 0 6px' }}>
        {GAN.map((g) => (
          <button key={g} type="button" aria-pressed={g === gan}
            className={`gj-pick sz-char--${WX_CLASS[ganWuxing(g)]}${g === gan ? ' is-active' : ''}`}
            onClick={() => pick(g)}>{g}</button>
        ))}
      </div>

      <WidgetBlock key={gan} block={block} />

      <p className="qt-matrix-note">
        底本是四库写本,有三处段首把时柱写错了字(如「己丑日癸亥时」,按日上起时当作癸酉时),原文照录不改,
        这里按它所在的章归格;另有两格({index.missing.join('、')})底本本身就缺。
      </p>
      <p className="qt-matrix-next">
        <Link to="/mingli/learn/qizhu">日干怎么排出时干?去看「四柱怎么排」→</Link>
      </p>
    </div>
  )
}
