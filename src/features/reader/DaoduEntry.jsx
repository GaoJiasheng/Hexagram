import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDaoduMeta, loadDaodu } from './daodu.js'
import ArticleDrawer from './ArticleDrawer.jsx'
import { SITE_MAP } from '../../sites/registry.js'

// 书级导读入口(挂篇目页题解之下)。点开走与白话/观书同款的右侧抽屉,⤢ 再进整页。
// 与白话的分工:白话逐章讲「这一章说了什么」,导读一书一篇讲「这本书的前世今生」——
// 其人 / 其时 / 其书 / 其传,义理只在末尾几百字带过(展开是各章白话的事)。
export default function DaoduEntry({ corpus, slug, bookTitle }) {
  const [meta, setMeta] = useState(null)
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setMeta(null); setData(null)
    getDaoduMeta(corpus, slug).then((m) => { if (alive) setMeta(m) })
    return () => { alive = false }
  }, [corpus, slug])

  useEffect(() => {
    if (!open || data) return
    let alive = true
    loadDaodu(corpus, slug).then((a) => { if (alive) setData(a) })
    return () => { alive = false }
  }, [open, data, corpus, slug])

  if (!meta) return null   // 没写导读的书不渲染,不扰排版

  const fullPath = `${SITE_MAP[corpus]?.home || `/${corpus}`}/${slug}/daodu`
  return (
    <>
      <a
        href={fullPath}
        className="daodu-entry"
        onClick={(e) => {
          // ⌘/Ctrl/Shift/中键交给浏览器开新标签;普通左键弹抽屉
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault(); setOpen(true)
        }}
      >
        <span className="daodu-entry__tag">前世今生</span>
        <span className="daodu-entry__text">
          <span className="daodu-entry__title">{meta.title}</span>
          <span className="daodu-entry__sub">{meta.subtitle}</span>
        </span>
        <span className="daodu-entry__go" aria-hidden="true">›</span>
      </a>
      <ArticleDrawer
        open={open}
        seal="传"
        site={corpus}
        brand={meta.title}
        chap={bookTitle ? `书级导读 · 《${bookTitle}》` : '书级导读'}
        data={data}
        empty="这本书的导读暂时无法载入。"
        onFull={() => { setOpen(false); navigate(fullPath) }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
