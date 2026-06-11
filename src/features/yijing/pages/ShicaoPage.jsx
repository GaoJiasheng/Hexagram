import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DayanCast from '../components/DayanCast.jsx'
import QuizCard from '../components/QuizCard.jsx'
import { markRead } from '../storage.js'

const XICI_QUOTE = '大衍之数五十，其用四十有九。分而为二以象两，挂一以象三，揲之以四以象四时，归奇于扐以象闰；五岁再闰，故再扐而后挂。'

export default function ShicaoPage() {
  const navigate = useNavigate()

  useEffect(() => { markRead('shicao') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">揲蓍成卦（大衍演示）</h2>
        <div className="basics-text">
          <blockquote className="dayan-quote">
            <p>{XICI_QUOTE}</p>
            <footer>——《周易·系辞上》 <Link to="/classics/xici-shang/1" className="dayan-source-link">读原文 →</Link></footer>
          </blockquote>
          <p>大衍之数五十，去一不用，以四十九枚蓍草反复揲数——三变成一爻，六爻成一卦。老阳九、老阴六为动爻，少阳七、少阴八不动。演示模式固定种子，任何时候步进结果一致。</p>
        </div>

        <DayanCast
          onResult={(hex, movingLines) =>
            navigate(`/workbench?gua=${hex.id}${movingLines.length ? '&dong=' + movingLines.join(',') : ''}`)
          }
        />
      </section>

      <QuizCard topic="shicao" />

      <div className="basics-cta">
        <p className="text-soft">工作台的「大衍」标签也能随时揲蓍——一键成卦或逐步引导。</p>
        <Link to="/workbench?method=dayan" className="btn btn--primary">去工作台实操 →</Link>
      </div>
    </div>
  )
}
