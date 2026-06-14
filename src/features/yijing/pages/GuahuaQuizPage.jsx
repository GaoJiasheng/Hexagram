import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import HexagramFigure from '../components/HexagramFigure.jsx'
import { allHexagrams, hexagramByBinary } from '../data.js'
import { getCuoGua, getZongGua } from '../engine/transforms.js'
import { markRead, markQuizResult, getProgress } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const ROUND = 10

function flipLine(binary, i) {
  return binary.slice(0, i) + (binary[i] === '1' ? '0' : '1') + binary.slice(i + 1)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 干扰项优先取形近卦：错卦/综卦/一爻之差(v10 §4)
function pickDistractors(hex) {
  const near = new Set([getCuoGua(hex.binary), getZongGua(hex.binary)])
  for (let i = 0; i < 6; i++) near.add(flipLine(hex.binary, i))
  near.delete(hex.binary)
  const pool = shuffle([...near].map(b => hexagramByBinary.get(b)).filter(Boolean))
  const picked = pool.slice(0, 3)
  while (picked.length < 3) {
    const rand = allHexagrams[Math.floor(Math.random() * 64)]
    if (rand.id !== hex.id && !picked.some(p => p.id === rand.id)) picked.push(rand)
  }
  return picked
}

function makeRound() {
  return shuffle(allHexagrams).slice(0, ROUND).map(target => {
    const options = shuffle([target, ...pickDistractors(target)])
    return { target, options, answer: options.findIndex(o => o.id === target.id) }
  })
}

const MODES = [
  ['shigua', '识卦', '看卦画，认卦名'],
  ['huagua', '画卦', '看卦名，识卦画'],
]

// 六十四卦认读闪卡(v10 §4)：运行时出题，全对通过（沿用学堂规则）
export default function GuahuaQuizPage() {
  usePageTitle('六十四卦认读')
  const [mode, setMode] = useState('shigua')
  const [session, setSession] = useState(null)
  const [cur, setCur] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => { markRead('guahua') }, [])

  const passedBefore = getProgress().quiz.guahua?.passed

  function start(m) {
    setMode(m)
    setSession(makeRound())
    setCur(0)
    setChosen(null)
    setCorrectCount(0)
    setDone(false)
  }

  function choose(i) {
    if (chosen !== null) return
    setChosen(i)
    if (i === session[cur].answer) setCorrectCount(c => c + 1)
  }

  function next() {
    if (cur + 1 < ROUND) {
      setCur(cur + 1)
      setChosen(null)
    } else {
      setDone(true)
      markQuizResult('guahua', correctCount, ROUND)
    }
  }

  const q = session?.[cur]

  function optionCls(i) {
    let cls = mode === 'shigua' ? 'quiz-option' : 'guahua-option'
    if (chosen !== null) {
      if (i === q.answer) cls += ` ${cls.split(' ')[0]}--correct`
      else if (i === chosen) cls += ` ${cls.split(' ')[0]}--wrong`
      else cls += ` ${cls.split(' ')[0]}--dim`
    }
    return cls
  }

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">六十四卦认读</h1>
        <p className="page-subtitle">卦画与卦名互认——干扰项混入错卦、综卦与一爻之差的形近卦，认熟了它们，六十四卦就认全了。</p>
      </div>

      {!session && (
        <section className="quiz-card">
          <div className="quiz-card__header">
            <span className="quiz-card__title">选择模式</span>
            {passedBefore && <span className="quiz-card__passed">已通过 ✓</span>}
          </div>
          <div className="guahua-modes">
            {MODES.map(([m, label, desc]) => (
              <button key={m} className="guahua-mode-btn" onClick={() => start(m)}>
                <strong>{label}</strong>
                <span className="text-soft">{desc}</span>
              </button>
            ))}
          </div>
          <p className="text-faint">每轮 {ROUND} 题，全对通过。</p>
        </section>
      )}

      {session && !done && (
        <section className="quiz-card">
          <div className="quiz-card__header">
            <span className="quiz-card__title">{MODES.find(([m]) => m === mode)[1]}</span>
            <span className="quiz-card__progress text-soft">{cur + 1} / {ROUND}</span>
          </div>

          {mode === 'shigua' ? (
            <>
              <div className="guahua-prompt">
                <HexagramFigure binary={q.target.binary} size="lg" label="待认卦画" />
              </div>
              <div className="quiz-card__options">
                {q.options.map((o, i) => (
                  <button key={o.id} className={optionCls(i)} onClick={() => choose(i)} disabled={chosen !== null}>
                    {o.fullName}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="guahua-prompt guahua-prompt--name">{q.target.fullName}</p>
              <div className="guahua-options">
                {q.options.map((o, i) => (
                  <button key={o.id} className={optionCls(i)} onClick={() => choose(i)} disabled={chosen !== null} aria-label={`选项${i + 1}`}>
                    <HexagramFigure binary={o.binary} size="md" label="" />
                  </button>
                ))}
              </div>
            </>
          )}

          {chosen !== null && (
            <div className="quiz-card__feedback">
              <p className={chosen === q.answer ? 'quiz-feedback--right' : 'quiz-feedback--wrong'}>
                {chosen === q.answer ? '答对了。' : '不对。'}这是
                <Link to={`/hexagram/${q.target.id}`} className="related-shili-link">{q.target.fullName}</Link>
                （第 {q.target.id} 卦）。
              </p>
              <button className="btn btn--primary" onClick={next}>{cur + 1 < ROUND ? '下一题' : '看成绩'}</button>
            </div>
          )}
        </section>
      )}

      {session && done && (
        <section className="quiz-card">
          <div className="quiz-card__result">
            <p className="quiz-card__score">{correctCount} / {ROUND}</p>
            <p className="text-soft">{correctCount === ROUND ? '全对，通过！' : '形近卦最容易栽——再来一轮。'}</p>
            <div className="guahua-modes">
              {MODES.map(([m, label]) => (
                <button key={m} className="btn btn--secondary" onClick={() => start(m)}>{label}再练</button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
