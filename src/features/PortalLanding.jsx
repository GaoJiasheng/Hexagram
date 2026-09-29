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

const num = (n) => (n >= 1000 ? n.toLocaleString('en-US') : String(n))

// 2026-09-30 owner review:首页去掉「这些书里有些东西别处没有」招牌样例与「凭什么信」两段(后者仍在跋里),首页只留 主张 → 书架 → 最近新收。

export default function PortalLanding({ shelf }) {
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
        <p className="landing-hero__eyebrow">观象</p>
        <h1 className="landing-hero__claim">
          {stats ? `${num(stats.books)} 部典籍,` : ''}逐字校过的白话
        </h1>
        <p className="landing-hero__sub">
          原文、白话译注、每章延伸与深读。经、子、集三部,十三组同站。
        </p>
        {stats && (
          <p className="landing-hero__stats">
            <span><b>{num(stats.books)}</b> 部典籍</span>
            <span><b>{num(stats.baihua)}</b> 章白话深读</span>
            <span><b>{num(stats.debates)}</b> 场跨派对辩</span>
            <span><b>{num(stats.mingju)}</b> 条名句</span>
          </p>
        )}
        <p className="landing-hero__note">
          引文全部逐字校验为原文精确子串 —— 校验不过的不落库。
        </p>
      </section>

      {/* ── 第二屏:书架(原有的卡片墙整体挪到这里) ─────────────── */}
      <div id="portal-shelf">{shelf}</div>

      {recent?.length > 0 && (
        <section className="landing-recent" aria-label="最近新收">
          <h2 className="landing-h2">
            最近新收
            <a className="landing-recent__rss" href="/feed.xml" title="订阅更新">RSS</a>
          </h2>
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
