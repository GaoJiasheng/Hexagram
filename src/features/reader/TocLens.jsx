import { useMemo } from 'react'
import { lensHits, intersect } from './lens.js'
import './TocLens.css'

// 目录页透镜的选词条:一排「词 ×N」小片,至多选两个词取交集。
//
// 组件只管选词,不碰章格——点亮哪些章由页面拿 useLens 的 activeSet 自己去加类,
// 这样同一套选词条能配书架卡、平铺章格、按卷分组等各种目录形态。
// 小标题(「透镜」之类)也由页面写:不同页面上下文里叫法不一样。

const MAX_ACTIVE = 2

/**
 * 页面与组件共用的计算:各词命中集 + 当前选中词的交集。
 * activeSet 为 null 表示没选词(不筛,全亮);为空集表示选了但没有同时命中的章。
 */
export function useLens(chapters, words, active) {
  const hits = useMemo(() => lensHits(chapters, words), [chapters, words])
  const activeSet = useMemo(
    () => intersect((active || []).map((w) => hits.get(w))),
    [hits, active],
  )
  return { hits, activeSet }
}

export default function TocLens({ chapters, words, active = [], onChange }) {
  const { hits } = useLens(chapters, words, active)
  const on = new Set(active)

  const toggle = (w) => {
    if (!onChange) return
    if (on.has(w)) onChange(active.filter((x) => x !== w))
    // 满两个再点第三个:挤掉最早选的那个,保留最近一次的意图
    else if (active.length >= MAX_ACTIVE) onChange([...active.slice(active.length - MAX_ACTIVE + 1), w])
    else onChange([...active, w])
  }

  // 命中 0 章的词不出:点了只会全暗,徒增困惑
  const shown = (words || []).filter((w) => (hits.get(w)?.size || 0) > 0)
  if (shown.length === 0) return null

  return (
    <div className="toc-lens">
      {shown.map((w) => {
        const isOn = on.has(w)
        return (
          <button
            key={w}
            type="button"
            className={`toc-lens__chip${isOn ? ' toc-lens__chip--on' : ''}`}
            aria-pressed={isOn}
            aria-label={`${w} ${hits.get(w).size} 章`}
            onClick={() => toggle(w)}
          >
            <span className="toc-lens__w">{w}</span>
            <span className="toc-lens__n" aria-hidden="true">×{hits.get(w).size}</span>
          </button>
        )
      })}
      {active.length > 0 && (
        <button type="button" className="btn-text toc-lens__clear" onClick={() => onChange && onChange([])}>
          清除
        </button>
      )}
    </div>
  )
}
