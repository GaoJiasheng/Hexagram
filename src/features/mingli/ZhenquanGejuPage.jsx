import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'

// 《子平真诠》的「形状」:一条从月令走到格名的路(design-v23 §7)。
// 穷通宝鉴是一张表,子平真诠是一道流程——全书四十九章,前三十一章讲这条路怎么走、
// 后十八章一格一格讲走到了之后怎么办。这一页把前半截做成可以亲手走的样子。
import { GAN, ZHI, cangGan } from '../shared/ganzhi/index.js'

// 走读页「换个镜头」会带着某个命例的日主/月令/透干跳过来:?d=乙&z=亥&t=丙戊。参数不合法就回退默认。
function blockFrom(sp) {
  const d = sp.get('d'), z = sp.get('z')
  const ok = GAN.includes(d) && ZHI.includes(z)
  const tou = ok ? [...(sp.get('t') || '')].filter((g) => cangGan(z).includes(g)) : []
  return { type: 'widget', kind: 'geju', props: ok ? { dayGan: d, monthZhi: z, tou } : { dayGan: '甲', monthZhi: '辰' } }
}

export default function ZhenquanGejuPage() {
  usePageTitle('格局怎么定 · 子平真诠', '观数')
  const [sp] = useSearchParams()
  const block = useMemo(() => blockFrom(sp), [sp])
  return (
    <div className="qt-matrix-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/zhenquan" className="basics-breadcrumb__link">← 子平真诠</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">格局怎么定</h1>
        <p className="page-subtitle">《子平真诠》全书只从一个地方下手:月令。</p>
      </div>

      <p className="qt-matrix-intro">
        沈孝瞻开宗明义:<strong>「八字用神，专求月令，以日干配月令地支，而生克不同，格局分焉。」</strong>
        意思是:别的先不看,先看你生在哪个月;月支里藏着的那个天干,对日主是什么十神,这一格就叫什么。
        下面四步,是把这句话拆开来让你亲手走一遍。走完得到的只是<strong>格的名字</strong>和它在书里的位置——
        书真正要讲的,是这之后的事。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这是《子平真诠》<strong>一家</strong>的取格法,不是通则:《穷通宝鉴》先问寒暖燥湿,《滴天髓》先问旺衰,入手处都不在这里。
        格名本身也不含好坏——原书说「当顺而顺，当逆而逆，配合得宜，皆为贵格」,成败全在后面的配合。
      </div>

      <WidgetBlock key={sp.toString()} block={block} />

      <p className="qt-matrix-next">
        <Link to="/mingli/zhenquan/9">从《论用神》读起 →</Link>
      </p>
    </div>
  )
}
