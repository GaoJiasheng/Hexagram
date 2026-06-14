import { useState } from 'react'
import quizzes from '../../../data/yijing/quizzes.json'
import { markQuizResult, getProgress } from '../storage.js'

const quizByTopic = new Map(quizzes.map(q => [q.topic, q]))

// 选项洗牌(每次开练随机),记录正确项洗后位置
function shuffleQuestions(questions) {
  return questions.map(q => {
    const idx = q.options.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return {
      q: q.q,
      explain: q.explain,
      options: idx.map(i => q.options[i]),
      answer: idx.indexOf(q.answer),
    }
  })
}

export default function QuizCard({ topic }) {
  const quiz = quizByTopic.get(topic)
  const [session, setSession] = useState(null)   // null | { questions }
  const [cur, setCur] = useState(0)
  const [chosen, setChosen] = useState(null)     // 本题已选索引
  const [correctCount, setCorrectCount] = useState(0)
  const [wrong, setWrong] = useState([])         // 本轮答错的题(洗后形态,可再洗)
  const [done, setDone] = useState(false)

  if (!quiz) return null
  const fullCount = quiz.questions.length
  const total = session ? session.questions.length : fullCount
  const passedBefore = getProgress().quiz[topic]?.passed

  function begin(questions) {
    setSession({ questions: shuffleQuestions(questions) })
    setCur(0)
    setChosen(null)
    setCorrectCount(0)
    setWrong([])
    setDone(false)
  }
  function start() { begin(quiz.questions) }

  function choose(i) {
    if (chosen !== null) return
    setChosen(i)
    if (i === session.questions[cur].answer) setCorrectCount(c => c + 1)
    else setWrong(w => [...w, session.questions[cur]])
  }

  function next() {
    if (cur + 1 < total) {
      setCur(cur + 1)
      setChosen(null)
    } else {
      setDone(true)
      // 「通过」只在做满全卷时判定;错题重练(子集)不计入,免少题蒙混
      if (total === fullCount) markQuizResult(topic, correctCount, total)
    }
  }

  const question = session?.questions[cur]

  return (
    <section className="quiz-card" aria-label={`${quiz.title}练习`}>
      <div className="quiz-card__header">
        <span className="quiz-card__title">练一练</span>
        {passedBefore && !session && <span className="quiz-card__passed">已通过 ✓</span>}
        {session && !done && <span className="quiz-card__progress text-soft">{cur + 1} / {total}</span>}
      </div>

      {!session && (
        <div className="quiz-card__start">
          <p className="text-soft">{total} 道小题，检验这一篇是否读懂了。</p>
          <button className="btn btn--secondary" onClick={start}>{passedBefore ? '再练一次' : '开始练习'}</button>
        </div>
      )}

      {session && !done && (
        <div className="quiz-card__body">
          <p className="quiz-card__q">{question.q}</p>
          <div className="quiz-card__options" role="listbox" aria-label="选项">
            {question.options.map((opt, i) => {
              let cls = 'quiz-option'
              if (chosen !== null) {
                if (i === question.answer) cls += ' quiz-option--correct'
                else if (i === chosen) cls += ' quiz-option--wrong'
                else cls += ' quiz-option--dim'
              }
              return (
                <button key={i} className={cls} onClick={() => choose(i)} disabled={chosen !== null && i !== question.answer && i !== chosen}>
                  {opt}
                </button>
              )
            })}
          </div>
          {chosen !== null && (
            <div className="quiz-card__feedback">
              <p className={chosen === question.answer ? 'quiz-feedback--right' : 'quiz-feedback--wrong'}>
                {chosen === question.answer ? '答对了。' : '不对。'}{question.explain}
              </p>
              <button className="btn btn--primary" onClick={next}>{cur + 1 < total ? '下一题' : '看成绩'}</button>
            </div>
          )}
        </div>
      )}

      {session && done && (
        <div className="quiz-card__result">
          <p className="quiz-card__score">{correctCount} / {total}</p>
          <p className="text-soft">
            {correctCount === total
              ? (total === fullCount ? '全对，通过！这一篇可以放心进入实操了。' : '错题全清！回去做满全卷即通过。')
              : correctCount >= total - 1
                ? `就差 ${total - correctCount} 道，再清掉就过！`
                : `答对 ${correctCount}/${total}，把错的几道攻克一下。`}
          </p>
          <div className="quiz-card__result-actions">
            {wrong.length > 0 && (
              <button className="btn btn--primary" onClick={() => begin(wrong)}>只练错的 {wrong.length} 题</button>
            )}
            <button className="btn btn--secondary" onClick={start}>{wrong.length > 0 ? '重练全部' : '再练一次'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
