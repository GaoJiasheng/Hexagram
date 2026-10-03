// 首页的「介绍层」(2026-08-08)。
//
// ══ 为什么加这一层 ══
// 在此之前 `/` 只有一面卡片墙:11 张卡、13 个组名,然后就没了。
// 那是**导航页**不是**首页** —— 导航页回答「去哪儿」,首页得先回答
// 「这是什么、谁做的、凭什么信」。三个具体缺口:
//   ① 外人读不出这是古籍站(卡片写「观空/观仁/观兼」是内部命名,不是介绍)
//   ② 最硬的资产一个字没提(2031 章白话、88 场对辩、引文逐字校验)
//   ③ 没有任何信任线索(底本何来、译注谁写、错了怎么办、能不能转载)
//
// ══ 只在 `/` 出,不在 `/hexagram` ══
// 同一个组件服务两个职责会两头不讨好:`/hexagram` 是站内左上角 logo 的回跳点,
// 人到那儿是**要换一组书**的,把卡片墙推到第二屏纯属添乱。故按路径分。
//
// ══ 数字一律从构建期产物读 ══
// `/content/stats.json` 与 `/content/recent.json` 由 build-content-assets / gen-feed 生成。
// **不在这里手写任何计数** —— 门户卡片描述当年就是因为手写而长期显示错的书目数(v1.40.0 修过)。
// 取不到就整块不渲染,绝不显示占位数字充数。

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DebatesShowcase from './debates/DebatesShowcase.jsx'
import colophon from '../data/colophon.json'

const num = (n) => (n >= 1000 ? n.toLocaleString('en-US') : String(n))

// 2026-09-30 owner review:首页去掉「这些书里有些东西别处没有」招牌样例与「凭什么信」两段(后者仍在跋里),首页只留 主张 → 书架 → 最近新收。

export default function PortalLanding({ shelf, groupCount }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let alive = true
    fetch('/content/stats.json').then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setStats(d)).catch(() => {})
    fetch('/content/recent.json').then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && Array.isArray(d) && setRecent(d.slice(0, 6))).catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <>
      {/* ── 第一屏:说清楚这是什么 ───────────────────────────────── */}
      <section className="landing-hero">
        <span className="landing-hero__seal" aria-hidden="true">观象</span>
        {/* 2026-10-01 owner:首屏是「灯」不是「仪表盘」——第一眼给外人看的话,不给同行看的数字。
            布局不动(印章 → 主张 → 一行说明 → 一段 → 一行小字),只换内容:四个计数下移到「索引」段,
            这里换成跋里「缘起」的第一段(全文链接 10-03 去掉);大模型的事只在跋里说。 */}
        <h1 className="landing-hero__claim">古书原文，一句一句读明白</h1>
        <p className="landing-hero__sub">
          原文在上，译注在旁，每一章都有一篇讲透的白话。经、子、集三部，{groupCount ? `${groupCount} 组书架` : '诸组书架'}同站。
        </p>
        {/* 「全文 → 跋」链接 2026-10-03 按 owner 意见去掉(首屏不用再显眼地指向跋;顶栏与页脚两处入口足够) */}
        <blockquote className="landing-hero__origin">
          <p>{(Array.isArray(colophon.origin) ? colophon.origin : [colophon.origin])[0]}</p>
        </blockquote>
        <p className="landing-hero__enter">
          <span className="landing-hero__enter-label">第一次来，可以从这里读起</span>
          <Link to="/tangshi">一首唐诗 →</Link>
          <Link to="/ru/lunyu/1">一章《论语》→</Link>
          <Link to="/hexagram/1">一卦《周易》→</Link>
        </p>
        <p className="landing-hero__note">
          书里每一句引文，都能点回它在原文里的那一章。
        </p>
      </section>

      {/* ── 第二屏:书架(原有的卡片墙整体挪到这里) ─────────────── */}
      <div id="portal-shelf">{shelf}</div>

      {/* ── 第三屏:赛博 · 百家争鸣(与书架平行的大段,owner 2026-09-30) ── */}
      <DebatesShowcase />

      {/* ── 第四段:索引——换一条路进书(与书架 / 争鸣同款页头;原页脚四个小链接提上来) ── */}
      <section className="idx" aria-label="索引">
        <header className="master-portal__head">
          <h2 className="master-portal__title">索引</h2>
          <p className="master-portal__sub">不从书进,从概念、名句、年代、人进</p>
          {stats && (
            <p className="idx__stats" aria-label="全站计数">
              <span>{num(stats.books)} 部典籍</span>
              <span>{num(stats.baihua)} 章白话深读</span>
              <span>{num(stats.debates)} 场跨派对辩</span>
              <span>{num(stats.mingju)} 条名句</span>
            </p>
          )}
        </header>
        <div className="idx__doors">
          <Link to="/concepts" className="door">
            <span className="door__head"><span className="door__name">义理专题</span>{stats && <span className="door__n">{stats.concepts} 组概念</span>}</span>
            <span className="door__desc">同一个「格物」「无为」「性」,各家各说——跨派概念对读,每条标出处章节</span>
          </Link>
          <Link to="/mingju" className="door">
            <span className="door__head"><span className="door__name">名句集</span>{stats && <span className="door__n">{num(stats.mingju)} 条</span>}</span>
            <span className="door__desc">各组名句,每日一句;每句都能点回它在原文里的那一章</span>
          </Link>
          <Link to="/timeline" className="door">
            <span className="door__head"><span className="door__name">全站时间轴</span>{stats?.timeline > 0 && <span className="door__n">{stats.timeline} 部</span>}</span>
            <span className="door__desc">诸书成书年代与诸人生卒摆在同一条轴上:谁与谁同时,谁接着谁</span>
          </Link>
          <Link to="/renwu" className="door">
            <span className="door__head"><span className="door__name">人物志</span>{stats?.people > 0 && <span className="door__n">{stats.people} 人</span>}</span>
            <span className="door__desc">撰人、译者、注家、编者,一人一篇小传:哪些说法靠得住,哪些只是相传</span>
          </Link>
        </div>
      </section>

      {recent?.length > 0 && (
        <section className="landing-recent" aria-label="最近新收">
          <header className="master-portal__head">
            <h2 className="master-portal__title">最近新收</h2>
            <p className="master-portal__sub">新入库的书 · <a className="landing-recent__rss" href="/feed.xml" title="订阅更新">RSS</a></p>
          </header>
          <ul className="landing-recent__list">
            {recent.map((r) => (
              <li key={r.href}>
                <Link to={r.href}>{r.title}</Link>
                <span className="landing-recent__meta">{r.cat} · {r.at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </>
  )
}
