import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import XianTianTable from '../components/XianTianTable.jsx'
import QuizCard from '../components/QuizCard.jsx'
import TermTip from '../components/TermTip.jsx'
import { markRead } from '../storage.js'

export default function MeihuaBasicsPage() {
  useEffect(() => { markRead('meihua') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">何为梅花易数</h2>
        <div className="basics-text">
          <p>梅花易数相传出自北宋邵雍（康节），以「观物起数」为要——不借蓍草铜钱，凡眼前之数（时间、字数、声音、方位）皆可起卦。相传邵雍观梅时见二雀争枝坠地，以年月日时起数得卦，断次晚有女子折花伤股，遂以「梅花」名其术。</p>
          <p>它是六十四卦体系里最轻的起卦法：四则运算加一张先天卦数表即可成卦，因此也最适合初学者理解「数如何成卦」。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">先天卦数</h2>
        <div className="basics-text">
          <p>梅花取数一律用<strong>先天卦数</strong>：乾一、兑二、离三、震四、巽五、坎六、艮七、坤八。这是先天八卦（伏羲八卦）的生成次序，与河图洛书同属一套数理——参见<Link to="/basics/hetu-luoshu" className="learn-inline">河图洛书</Link>与<Link to="/basics/yinyang" className="learn-inline">先天方位图</Link>。</p>
        </div>
        <XianTianTable />
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">时间起卦</h2>
        <div className="basics-text">
          <p>以农历年月日时四数起卦，步骤固定：</p>
          <ol className="basics-list">
            <li><strong>取数</strong>：年支序数（子=1 丑=2 … 亥=12）、农历月数、农历日数、时支序数。</li>
            <li><strong>求上卦</strong>：年支 + 月 + 日，除以八取余——<strong>余〇取八</strong>，余数对照先天卦数即上卦。</li>
            <li><strong>求下卦</strong>：前和再加时支数，除以八取余，同法得下卦。</li>
            <li><strong>定动爻</strong>：总和除以六取余（余〇取六），即<TermTip term="dongyao">动爻</TermTip>之位。</li>
          </ol>
          <p><strong>观梅一例</strong>：辰年（5）十二月十七日申时（9）——5+12+17=34，÷8 余 2 得兑为上卦；34+9=43，÷8 余 3 得离为下卦；43÷6 余 1，初爻动。得泽火革之泽山咸。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">数字起卦</h2>
        <div className="basics-text">
          <p>任取两数：数一除八定上卦，数二除八定下卦，两数之和除六定动爻。两数可来自报数、字的笔画、所见所闻——「心动则数生」。流派对是否再加时辰各家不一，本站取最通行的两数版。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">体用断法</h2>
        <div className="basics-text">
          <p>成卦后看<TermTip term="tiyong">体用</TermTip>：<strong>动者为用，静者为体</strong>——动爻在下卦则下卦为用、上卦为体，反之亦然。体为己、为所占之主；用为事、为外应。再以八卦五行论生克：</p>
          <ul className="basics-list">
            <li>用生体：顺遂有助（吉）</li>
            <li>比和（同五行）：谋事易成（吉）</li>
            <li>体克用：可成而费力（小吉）</li>
            <li>体生用：泄耗，劳而少功</li>
            <li>用克体：多阻，不利</li>
          </ul>
          <p>互卦看事之中、变卦看事之终，皆与体卦论生克为参断。断语出处：《梅花易数·体用总诀》。本站照录传统断法、注明出处，供研习参考。</p>
        </div>
      </section>

      <QuizCard topic="meihua" />

      <div className="basics-cta">
        <p className="text-soft">工作台的「梅花」标签有快速与引导两种模式——引导模式逐步演算，每一步都是上面这套规则。</p>
        <Link to="/workbench?method=meihua" className="btn btn--primary">去工作台实操 →</Link>
      </div>
    </div>
  )
}
