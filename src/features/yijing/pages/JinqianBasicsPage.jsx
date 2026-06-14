import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import QuizCard from '../components/QuizCard.jsx'
import TermTip from '../components/TermTip.jsx'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import LearnNextLink from '../components/LearnNextLink.jsx'

const COIN_TABLE = [
  { combo: '三背', sum: '3+3+3=9', value: 9, name: '老阳（重）', yinyang: '阳 ○', moving: '动' },
  { combo: '两背一字', sum: '3+3+2=8', value: 8, name: '少阴（拆）', yinyang: '阴', moving: '静' },
  { combo: '一背两字', sum: '3+2+2=7', value: 7, name: '少阳（单）', yinyang: '阳', moving: '静' },
  { combo: '三字', sum: '2+2+2=6', value: 6, name: '老阴（交）', yinyang: '阴 ✕', moving: '动' },
]

export default function JinqianBasicsPage() {
  usePageTitle('金钱卦')
  useEffect(() => { markRead('jinqian') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">何为金钱卦</h2>
        <div className="basics-text">
          <p>金钱卦（又称六爻金钱起卦）以三枚铜钱代替四十九根蓍草，相传定型于汉代京房一脉、盛于《火珠林》，是后世最通行的简易起卦法。一掷得一爻，六掷成一卦，几分钟即可起完——它把大衍十八变压缩成六掷，而爻值体系完全相同。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">取数规则</h2>
        <div className="basics-text">
          <p>铜钱有字的一面为「字」，无字的一面为「背」。<strong>背计 3，字计 2</strong>，三枚之和定爻：</p>
        </div>
        <div className="coin-table-wrap">
          <table className="coin-table">
            <thead>
              <tr><th>组合</th><th>求和</th><th>爻值</th><th>名称</th><th>阴阳</th><th>动静</th></tr>
            </thead>
            <tbody>
              {COIN_TABLE.map(row => (
                <tr key={row.value}>
                  <td>{row.combo}</td>
                  <td>{row.sum}</td>
                  <td><strong>{row.value}</strong></td>
                  <td>{row.name}</td>
                  <td>{row.yinyang}</td>
                  <td>{row.moving === '动' ? <strong>动</strong> : '静'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">六掷成卦</h2>
        <div className="basics-text">
          <ol className="basics-list">
            <li>三枚铜钱合掌摇匀，掷出，记下背字组合——这是<strong>初爻</strong>（最下一爻）。</li>
            <li>再掷五次，<strong>自下而上</strong>依次为二、三、四、五、上爻。</li>
            <li>老阳九、老阴六为<TermTip term="dongyao">动爻</TermTip>：老阳将变阴、老阴将变阳，由此得变卦。</li>
          </ol>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">与大衍揲蓍的关系</h2>
        <div className="basics-text">
          <p>金钱卦与<Link to="/basics/shicao" className="learn-inline">大衍揲蓍</Link>共用同一套爻值：6 老阴、7 少阳、8 少阴、9 老阳。区别在繁简与概率——揲蓍三变成一爻，四象概率不均（老阳约 3/16、老阴约 1/16）；掷钱一次成一爻，老阳老阴各 1/8。古人谓「蓍短龟长」，蓍法重其郑重，钱法取其便捷。</p>
        </div>
      </section>

      <QuizCard topic="jinqian" />

      <div className="basics-cta">
        <p className="text-soft">工作台的「金钱」标签有三种用法：一键掷卦、逐掷引导，或掷实物铜钱后逐爻录入。</p>
        <Link to="/workbench?method=jinqian" className="btn btn--primary">去工作台实操 →</Link>
      </div>
      <LearnNextLink id="jinqian" />
    </div>
  )
}
