import { useCallback, useRef, useState } from 'react'

// 抽屉/整页头部随滚动方向自动收起(#156)——下滑收起头部+字号工具条给正文腾地方,
// 上滑立刻展开。累积阈值防抖(避免来回半像素抖动来回切换),顶部安全区内恒定展开。
//
// 收起必须是**平移**、不能是折叠高度(#162)。头部原先是滚动容器上方的流内元素,
// max-height 收到 0 会让滚动容器的上边界一下抬高一整条头部,而 scrollTop 没变 ——
// 眼前的正文就凭空往上蹦一截(实测 121px),读起来非常难受。改成:头部脱离文档流浮在
// 正文之上、正文用 padding-top 让出同样高度,收起时 translateY(-100%) 平移出视口。
// 这样布局全程不变、正文一个像素都不动;原先被头部盖住的那条正文随平移露出来,
// 阅读区照样变大。(主导航 .app-nav 走的就是这个路子:sticky + translateY。)
//
// 头部高度不是常数(标题折行、iOS 安全区),故 ResizeObserver 实测,由调用方写进
// --bar-h 供正文 padding-top 用。
const THRESHOLD = 8
const TOP_SAFE = 12

export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const [barH, setBarH] = useState(0)
  const lastY = useRef(0)
  const accum = useRef(0)
  const roRef = useRef(null)

  // 用**回调 ref** 而非 useEffect:抽屉是按需挂载的,effect 在组件挂载那一刻跑时
  // 头部条还不存在,量不到高度(中过一次)。回调 ref 在节点真正挂上/卸下时才触发。
  const barRef = useCallback((node) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (!node) return
    // 平移不改变 offsetHeight,故收起状态下量到的仍是完整高度(正是 padding 要的值)
    setBarH(node.offsetHeight)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBarH(node.offsetHeight))
    ro.observe(node)
    roRef.current = ro
  }, [])

  function onScroll(e) {
    const y = e.currentTarget.scrollTop
    const dy = y - lastY.current
    lastY.current = y
    if (y <= TOP_SAFE) {
      if (hidden) setHidden(false)
      accum.current = 0
      return
    }
    // 与上次累积同向则叠加,反向则从当前这一下重新起算(不然来回小幅滚动会互相抵消、显得迟钝)
    accum.current = (accum.current === 0 || (dy > 0) === (accum.current > 0)) ? accum.current + dy : dy
    if (accum.current > THRESHOLD) { setHidden(true); accum.current = 0 }
    else if (accum.current < -THRESHOLD) { setHidden(false); accum.current = 0 }
  }

  // 量到高度前不要写 --bar-h,好让 CSS 的兜底值(而不是 0px)生效
  const barStyle = barH ? { '--bar-h': `${barH}px` } : undefined
  return { hidden, onScroll, barRef, barStyle }
}
