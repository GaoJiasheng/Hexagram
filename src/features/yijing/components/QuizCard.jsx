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
  const [done, setDone] = useState(false)

  if (!quiz) return null
  const total = quiz.questions.length
  const passedBefore = getProgress().quiz[topic]?.passed

  function start() {
    setSession({ questions: shuffleQuestions(quiz.questions) })
    setCur(0)
    setChosen(null)
    setCorrectCount(0)
    setDone(false)
  }

  function choose(i) {
    if (chosen !== null) return
    setChosen(i)
    if (i === session.questions[cur].answer) setCorrectCount(c => c + 1)
  }

  function next() {
    if (cur + 1 < total) {
      setCur(cur + 1)
      setChosen(null)
    } else {
      setDone(true)
      markQuizResult(topic, correctCount, total)
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
          <p className="text-soft">{correctCount === total ? '全对，通过！这一篇可以放心进入实操了。' : '差一点——回看上文再练一次，全对即通过。'}</p>
          <button className="btn btn--secondary" onClick={start}>再练一次</button>
        </div>
      )}
    </section>
  )
}
