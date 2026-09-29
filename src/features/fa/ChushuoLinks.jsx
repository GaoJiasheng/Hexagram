import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import data from '../../data/fa/hanfeizi-chushuo.json'
import './ChushuoLinks.css'

// 《韩非子》储说六篇(第 30–35 章)的「经—说」联动(design-v24 §1)。
// 原书每篇先列「经」(一条条论点,多数末了说「其说在某事」),再排「说」(与经条一一对应的故事组)。
// 对应表 src/data/fa/hanfeizi-chushuo.json 由 scripts/gen-hanfeizi-chushuo.mjs 从原文派生。
// 本模块由 CorpusReadPage **懒加载**(只有读韩非子时才下载),挂三样东西:
//   ChushuoIntro  —— 经部上方一行导语 + 说组直达(renderPieceHead 第 0 段)
//   ChushuoTag    —— 经条段末「看这条的故事 →」(renderParaExtra)
//   ChushuoHead   —— 说组首段前的条头「说一 · 参观」+「← 回经文」(renderPieceHead)
// 跳转目标可能在另一屏(长章拆页 ?p=),链接由调用方的 hrefFor(段下标, 锚 id) 连屏带锚拼好。

const NUM = '一二三四五六七八九十'
const cn = (n) => NUM[n - 1] || String(n)

export const introId = (ch) => `chushuo-${ch}-jing`
export const shuoId = (ch, no) => `chushuo-${ch}-shuo${no}`
// 经条段:用阅读器在段内既有的旧锚 seg-章-段(自带 scroll-margin,落位不被吸顶导航遮住)
export const jingId = (ch, para) => `seg-${ch}-${para}`

const shuoName = (j) => `说${cn(j.no)}${j.label ? ` · ${j.label}` : ''}`

/** 该章的经说对应,按段下标索引;不是储说六篇则返回 null。CorpusReadPage 同步取用,决定哪一段挂签/插条头。 */
export function chushuoIndex(ch) {
  const c = data.chapters.find((x) => x.ch === ch)
  if (!c) return null
  const byPara = {}, byShuo = {}
  for (const j of c.jing) { byPara[j.para] = j; byShuo[j.shuoFrom] = j }
  // 侧栏目录的章内子目录:经部一条 + 说组各一条
  const anchors = [
    { from: 0, id: introId(ch), label: '经' },
    ...c.jing.map((j) => ({ from: j.shuoFrom, id: shuoId(ch, j.no), label: shuoName(j) })),
  ]
  return { chapter: c, byPara, byShuo, anchors }
}

// 落位后短暂着色,让读者一眼认出「就是这一段」
function box(el) { return el ? el.closest('.piece-head, .read-para') || el : null }
function flash(el) {
  if (!el) return
  el.classList.remove('chushuo-flash')
  void el.offsetWidth   // 重触发动画
  el.classList.add('chushuo-flash')
  setTimeout(() => el.classList.remove('chushuo-flash'), 1800)
}
function useArrivalFlash(id) {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash !== `#${id}`) return
    // 阅读器的 hash 定位用短间隔重试(目标可能刚渲染),这里稍后再着色即可
    const t = setTimeout(() => flash(box(document.getElementById(id))), 120)
    return () => clearTimeout(t)
  }, [hash, id])
}

// 站内跳转链接。地址 hash 已经就是目标时(读者读开又点一次),路由不变、阅读器的 hash 定位不会再跑,
// 这里自己滚过去;其余情形交给路由 + 阅读器既有的 hash 定位(跨屏也由它负责)。
function JumpLink({ to, targetId, className, children, ...rest }) {
  const { hash } = useLocation()
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (hash !== `#${targetId}`) return
    const el = document.getElementById(targetId)
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: 'auto', block: 'start' })
    flash(box(el))
  }
  return <Link to={to} className={className} onClick={onClick} {...rest}>{children}</Link>
}

// 经条的头一句(去掉外储说的「一。」序号),给条头作提示;过长截断
function thesis(text) {
  const s = (text || '').replace(/^[一二三四五六七八九十]。/, '')
  const first = s.split('。')[0]
  const chars = [...first]
  return chars.length > 24 ? `${chars.slice(0, 24).join('')}…` : `${first}。`
}

export function ChushuoIntro({ idx, hrefFor }) {
  const { chapter: c } = idx
  const id = introId(c.ch)
  useArrivalFlash(id)
  return (
    <div className="chushuo-intro" id={id}>
      <p className="chushuo-intro__lead">
        这一篇原是「经」与「说」成对写的，经是论点，说是故事。
      </p>
      <p className="chushuo-intro__how">
        本篇经 {c.jing.length} 条、说 {c.jing.length} 组：点经条末的「看这条的故事」直达它的说，读完点「回经文」返回。
      </p>
      <nav className="chushuo-intro__nav" aria-label="说组直达">
        {c.jing.map((j) => (
          <JumpLink
            key={j.no}
            to={hrefFor(j.shuoFrom, shuoId(c.ch, j.no))}
            targetId={shuoId(c.ch, j.no)}
            className="chushuo-chip"
          >
            {shuoName(j)}
          </JumpLink>
        ))}
      </nav>
    </div>
  )
}

export function ChushuoTag({ ch, jing: j, hrefFor }) {
  useArrivalFlash(jingId(ch, j.para))
  const target = shuoId(ch, j.no)
  return (
    <JumpLink
      to={hrefFor(j.shuoFrom, target)}
      targetId={target}
      className="chushuo-tag"
      aria-label={`看这条的故事：${shuoName(j)}`}
      title={`跳到${shuoName(j)}`}
    >
      看这条的故事 <span aria-hidden="true">→</span>
    </JumpLink>
  )
}

export function ChushuoHead({ ch, jing: j, jingText, hrefFor }) {
  const id = shuoId(ch, j.no)
  useArrivalFlash(id)
  const back = jingId(ch, j.para)
  return (
    <>
      <span className="chushuo-head" id={id}>
        <span className="chushuo-head__title">{shuoName(j)}</span>
        <span className="chushuo-head__cue">经{cn(j.no)}：{thesis(jingText)}</span>
      </span>
      <JumpLink
        to={hrefFor(j.para, back)}
        targetId={back}
        className="chushuo-back"
        aria-label={`回到经${cn(j.no)}的经文`}
      >
        <span aria-hidden="true">←</span> 回经文
      </JumpLink>
    </>
  )
}
