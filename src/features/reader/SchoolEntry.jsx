import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSchoolMeta, loadSchool } from './school.js'
import ArticleDrawer from './ArticleDrawer.jsx'
import { SITE_MAP } from '../../sites/registry.js'

// 家级导读入口(挂组首页书架之上)。点开走与白话/书级导读同款的右侧抽屉,⤢ 再进整页。
// 位置在书架前、今日一章后:先知道这一架书是怎么来的,再挑一本读。
// 没写该组导读时返回 null —— 组首页保持原样,不留空壳。
export default function SchoolEntry({ corpus }) {
  const [meta, setMeta] = useState(null)
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setMeta(null); setData(null)
    getSchoolMeta(corpus).then((m) => { if (alive) setMeta(m) })
    return () => { alive = false }
  }, [corpus])

  useEffect(() => {
    if (!open || data) return
    let alive = true
    loadSchool(corpus).then((a) => { if (alive) setData(a) })
    return () => { alive = false }
  }, [open, data, corpus])

  if (!meta) return null

  const fullPath = `${SITE_MAP[corpus]?.home || `/${corpus}`}/school`
  return (
    <>
      <a
        href={fullPath}
        className="daodu-entry school-entry"
        onClick={(e) => {
          // ⌘/Ctrl/Shift/中键交给浏览器开新标签;普通左键弹抽屉
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault(); setOpen(true)
        }}
      >
        <span className="daodu-entry__tag">一家之来路</span>
        <span className="daodu-entry__text">
          <span className="daodu-entry__title">{meta.title}</span>
          <span className="daodu-entry__sub">{meta.subtitle}</span>
        </span>
        <span className="daodu-entry__go" aria-hidden="true">›</span>
      </a>
      <ArticleDrawer
        open={open}
        seal="源"
        site={corpus}
        brand={meta.title}
        chap="家级导读 · 一家之来路"
        data={data}
        empty="这一篇导读暂时无法载入。"
        onFull={() => { setOpen(false); navigate(fullPath) }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
