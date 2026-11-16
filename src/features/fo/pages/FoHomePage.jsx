import { Link } from 'react-router-dom'
import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/fo/texts.json'
import { homePlan } from '../../reader/ShelfHome.jsx'
import './FoHomePage.css'

// 释典书架。立意取「佛教与中国思想」,研习不宣化。
// 书架之下一行接「名相索引」(design-v24 §4):按名相横切十部经,顶部有十二因缘、八正道两件可点的环。
// 新版组首页(reading-home.json 有 fo 条目)把名相索引、传灯图收进了「这一家的门道」一行,下面这两条就不再重复。
export default function FoHomePage() {
  return (
    <>
      <ScriptureShelf
        corpus="fo"
        texts={texts}
        title="释典研读"
        subtitle="心经、金刚经、坛经、维摩诘经等十部——原文、白话译注、每章延伸俱全。研习不宣化。"
        basePath="/fo"
        brand="观空"
      />
      {!homePlan('fo') && <div className="dao-home fo-home-extra">
        <Link to="/fo/concepts" className="daodu-entry fo-home-extra__entry">
          <span className="daodu-entry__tag">名相索引</span>
          <span className="daodu-entry__text">
            <span className="daodu-entry__title">五蕴 · 十二因缘 · 空 · 无住 · 不二……</span>
            <span className="daodu-entry__sub">同一个名相,十部经各在哪一章讲、怎么讲;顶部有十二因缘、八正道两件可点的环。</span>
          </span>
          <span className="daodu-entry__go" aria-hidden="true">›</span>
        </Link>
        <Link to="/fo/lineage" className="daodu-entry fo-home-extra__entry">
          <span className="daodu-entry__tag">传灯图</span>
          <span className="daodu-entry__text">
            <span className="daodu-entry__title">达摩 · 弘忍 · 惠能 · 神秀 · 曹溪门下</span>
            <span className="daodu-entry__sub">《坛经》自己讲出来的传法谱系:谁传谁、谁并立、门下诸人各是怎么来的,每根线挂本经原文。</span>
          </span>
          <span className="daodu-entry__go" aria-hidden="true">›</span>
        </Link>
      </div>}
    </>
  )
}
