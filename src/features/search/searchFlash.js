import { useEffect } from 'react'

// 搜索结果点进去之后,把命中的那句高亮并闪几下(owner 2026-10-03)。
// 结果链接带 ?hl=<查询>(正文命中另带 seg=<段下标>,读经页据此落到长章对应那一屏)。
// 做法:等页面渲染出来 → 在正文里按「去标点影子串」找到查询 → 滚到那里 → 用浮在上面的绝对定位色块
// 盖住那段文字的 getClientRects 闪几下再淡出。**不改 React 管的 DOM**(不包 <mark>),
// 注释气泡把原文切成多个文本节点也照样能跨节点定位。不用 rAF(后台标签页被节流,全站踩过两次)。
const PUNCT_RE = /[\s\p{P}\p{S}]/u
const LIFE_MS = 6500

function needlesOf(q) {
  const full = [...String(q || '')].filter((ch) => !PUNCT_RE.test(ch)).join('').toLowerCase()
  if (full.length < 2) return []
  return [full]
}

export function locate(root, needles) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const map = []
  let shadow = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest('button, script, style, .para-acts, .search-flash')) continue
    const t = n.nodeValue
    for (let i = 0; i < t.length; i += 1) {
      if (PUNCT_RE.test(t[i])) continue
      shadow += t[i].toLowerCase()
      map.push([n, i])
    }
  }
  for (const nd of needles) {
    const at = shadow.indexOf(nd)
    if (at === -1) continue
    const [sn, so] = map[at]
    const [en, eo] = map[at + nd.length - 1]
    const range = document.createRange()
    range.setStart(sn, so)
    range.setEnd(en, eo + 1)
    return range
  }
  return null
}

function findRange(needles) {
  const main = document.querySelector('.app-main') || document.body
  // 先找原文段(读经页 / 卦页),再退到整个正文区(白话页、导读页)
  for (const el of main.querySelectorAll('.classic-text__original')) {
    const r = locate(el, needles)
    if (r) return r
  }
  return locate(main, needles)
}

export function useSearchFlash(location) {
  const { pathname, search } = location
  useEffect(() => {
    const q = new URLSearchParams(search).get('hl')
    const needles = needlesOf(q)
    if (!needles.length) return
    const boxes = []
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))
    const clear = () => { boxes.splice(0).forEach((b) => b.remove()) }
    let range = null
    // 色块跟着文字走:页面仍在排版(上方段落估高变实高)时位置会挪,故存活期内每 150ms 按最新位置挪一次;
    // 行数不变就复用同一批元素只改坐标(闪烁动画不被打断),行数变了才重建
    const place = () => {
      if (!range) return
      // 选区整个包住注释气泡一类的 span 时,getClientRects 会把 span 的框和文字的框都交回来 → 去重、去被包含的
      const raw = [...range.getClientRects()].filter((r) => r.width && r.height)
      const rects = raw.filter((r, i) => !raw.some((o, j) => j !== i
        && o.left <= r.left + 0.5 && o.right >= r.right - 0.5 && o.top <= r.top + 0.5 && o.bottom >= r.bottom - 0.5
        && (j < i || o.width * o.height > r.width * r.height)))
      if (rects.length !== boxes.length) {
        clear()
        for (let i = 0; i < rects.length; i += 1) {
          const b = document.createElement('div')
          b.className = 'search-flash'
          document.body.appendChild(b)
          boxes.push(b)
        }
      }
      rects.forEach((r, i) => {
        const b = boxes[i]
        b.style.left = `${r.left + window.scrollX - 2}px`
        b.style.top = `${r.top + window.scrollY - 1}px`
        b.style.width = `${r.width + 4}px`
        b.style.height = `${r.height + 2}px`
      })
    }
    const deadline = Date.now() + 5000
    const tick = () => {
      range = findRange(needles)
      if (!range) { if (Date.now() < deadline) later(tick, 150); return }
      const host = range.startContainer.parentElement
      host?.scrollIntoView({ block: 'center' })
      // 确保命中处真在屏幕上(owner:要自己滑到这个点):滚动后 content-visibility 的段落才真正排版,
      // 上方段落从估高变实高会把目标挤走——分几次复核,离开屏幕中段就按实际位置再拉回正中,然后重画色块。
      // 只在落地后头 1.5 秒内校正,不跟读者自己的滚动抢。
      const settle = () => {
        const r = range.getBoundingClientRect()
        const top = 72, bottom = window.innerHeight - 72   // 顶栏 / 手机底栏各让开
        if (r.height && (r.top < top || r.bottom > bottom)) window.scrollBy(0, r.top + r.height / 2 - window.innerHeight / 2)
        place()
      }
      later(settle, 150)
      later(settle, 600)
      later(settle, 1500)
      const follow = setInterval(place, 150)
      later(() => { clearInterval(follow); clear() }, LIFE_MS)
      timers.push(follow)
    }
    later(tick, 300)   // 让路由的回顶 / hash 定位先跑完,再滚到命中处
    const onResize = () => place()
    window.addEventListener('resize', onResize)
    return () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t) }); clear(); window.removeEventListener('resize', onResize) }
  }, [pathname, search])
}
