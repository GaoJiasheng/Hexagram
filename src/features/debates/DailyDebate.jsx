import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { pickDailyDebate, groupAccent, schoolSeal } from './debates.js'
import { getDailyDebateSeen, markDailyDebateSeen } from '../yijing/storage.js'

// 每日一辩弹窗(v21 §3.4)——首页/门户当日首访自动弹一次(纸色卡 + 遮罩)。
// 日期 hash 定题(确定性、每日变);弹出即记当日已见,当天不再叨扰(× 或进去看皆可关)。
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function DailyDebate() {
  const navigate = useNavigate()
  const today = todayStr()
  const topic = pickDailyDebate()
  const [open, setOpen] = useState(() => !!topic && getDailyDebateSeen() !== today)

  useEffect(() => { if (open) markDailyDebateSeen(today) }, [open, today])  // 弹出即记,当日只弹一次

  // Esc 关闭 + 锁滚动 —— 与站内其他模态浮层同一约定(2026-08-17 并入)。
  // 安卓返回键靠「body 锁了滚动」判断有浮层开着,漏掉这里,
  // 首页一进来弹出本框时按返回就会**直接退出 App**(见 src/native/backButton.js)。
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!open || !topic) return null
  const go = () => { setOpen(false); navigate(`/debates/${topic.id}`) }

  // 经 portal 渲染到 body:逃离页面内带 transform/content-visibility 的祖先,position:fixed 方相对视口
  return createPortal(
    <div className="daily-debate" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="daily-debate__card" role="dialog" aria-modal="true" aria-label="每日一辩">
        <button className="daily-debate__x" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
        <div className="daily-debate__tag">每日一辩 · {today.replace(/-/g, ' · ')}</div>
        <div className="daily-debate__title">{topic.title}</div>
        <div className="daily-debate__q">{topic.question}</div>
        <div className="daily-debate__meta">参辩 {topic.schools.length} 家 · {topic.turns} 轮 · 会讲不评输赢</div>
        <div className="daily-debate__seals">
          {topic.schools.map((s, i) => (
            <div key={i} className="daily-debate__seat">
              <div className="daily-debate__seal" style={{ background: groupAccent(s.group) }}>{schoolSeal(s.group)}</div>
              <div className="daily-debate__name">{s.label}</div>
              <div className="daily-debate__stance">{s.stance}</div>
            </div>
          ))}
        </div>
        <div className="daily-debate__actions">
          <button className="daily-debate__go" onClick={go}>进去看 →</button>
          <button className="btn btn--ghost" onClick={() => setOpen(false)}>今日不再</button>
        </div>
        <div className="daily-debate__epigraph">天下同归而殊途,一致而百虑 ——《系辞》</div>
      </div>
    </div>,
    document.body,
  )
}
