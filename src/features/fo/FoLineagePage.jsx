import { Link } from 'react-router-dom'
import DATA from '../../data/fo-lineage.json'
import LineageView from '../ru/LineageView.jsx'

// 禅宗传灯图(design-v24 §14)。视图与儒门学脉图共用(ru/LineageView.jsx),换一份数据。
// 只画《坛经》本文写到的人:达摩至弘忍的祖序(付嘱品)、弘忍传惠能(行由品)、曹溪门下诸人各是怎么来的(机缘品 / 顿渐品),
// 以及「南能北秀」的并立。每根线挂本经原文,闸 scripts/lib/check-fo-lineage.mjs 逐条回查。研习不宣化:讲书里怎么写,不下判语。

export default function FoLineagePage() {
  return (
    <LineageView
      data={DATA}
      title="禅宗传灯图"
      site="观心"
      markerId="folin-arrow"
      className="fo-lineage"
      svgLabel="禅宗传灯图:横轴为朝代,纵轴为祖师、南宗、北宗三行,连线为传衣付法、门下参礼与南北顿渐之分"
      crumbs={(
        <div className="basics-breadcrumb">
          <Link to="/fo" className="basics-breadcrumb__link">← 释典研读</Link>
          <span className="ru-lineage__crumb-sep" aria-hidden="true">·</span>
          <Link to="/fo/tanjing" className="basics-breadcrumb__link">坛经</Link>
        </div>
      )}
      fanli="图上只画《坛经》本文写到的人和事;年代除惠能据本经付嘱品自记外,余人只写朝代。西天二十八祖之说、达摩与梁武帝问答、「以心传心」的传法之说,一律依本经照录,史实真伪不在此判;后世灯录所记(立雪断臂、五家七宗)不入图,只在说明里提及。每条线的引文都是站内《坛经》该品原文的逐字摘录,由校验闸逐条回查。"
      back={<><Link to="/fo">← 释典研读</Link> · <Link to="/fo/tanjing">读《坛经》</Link> · <Link to="/ru/lineage">儒门学脉图</Link></>}
    />
  )
}
