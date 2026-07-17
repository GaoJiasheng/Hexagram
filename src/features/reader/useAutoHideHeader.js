import { useRef, useState } from 'react'

// 抽屉/整页头部随滚动方向自动收起(#156)——下滑收起头部+字号工具条给正文腾地方,
// 上滑立刻展开。累积阈值防抖(避免来回半像素抖动来回切换),顶部安全区内恒定展开。
const THRESHOLD = 8
const TOP_SAFE = 12

export function useAutoHideHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const accum = useRef(0)

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

  return { hidden, onScroll }
}
