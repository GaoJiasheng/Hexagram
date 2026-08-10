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

// 招牌样例:挑「别处没有」的具体条目,而不是形容词。
// 一句「孟子荀子王阳明同席对辩」比一句「内容丰富」有说服力得多。
// ⚠️ 改这里前先点开链接确认页面还在、说法还对 —— 这是首页,错了最丢人。
// ⚠️ 每条都必须与它指向的那一页**说法一致**。初版三条全部翻车,教训记在这:
//    · 写「阳明说两位都执于一端」—— 而该辩的收束明写「非争对错,乃各就一节」
//    · 写「『床』不是睡的床」—— 而该篇明写睡床/井栏/胡床三说并陈、不作判定
//    · 链接写 6-1(《行宫》),静夜思其实是 6-11
//    替文章下它自己拒绝下的结论,恰恰砸的是这个站唯一的招牌。改这里前先打开那一页读一遍。
const SHOWCASE = [
  {
    href: '/debates/renxing',
    tag: '对辩',
    line: '孟子言性之端绪,荀子言性之资质,阳明言性之本体 —— 同一个「性」字,三家指的不是一回事。',
    sub: '诸子同席对辩 · 不评输赢,每句引文逐字校过是该章原文',
  },
  {
    href: '/tangshi/tangshi300/baihua/6-11',
    tag: '深读',
    line: '「床前明月光」的「床」,睡床、井栏、胡床三说并存 —— 本站并陈,不替你拍板。',
    sub: '唐诗三百首 320 首,一首一篇深读',
  },
  {
    href: '/concepts',
    tag: '互见',
    line: '同一个「格物」,朱子主即物穷理,阳明主正心致良知 —— 工夫入手处的分歧由此而分。',
    sub: '八组跨派概念,每条都标出处章节',
  },
]

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

      {/* ── 第二屏之前:三条路径(按读者状态分,而不是按分类) ───────── */}
      <section className="landing-paths" aria-label="从哪儿开始">
        <Link to="/debates" className="landing-path">
          <span className="landing-path__k">随便看看</span>
          <span className="landing-path__v">每日一辩 · 名句集 · 今日一卦</span>
        </Link>
        <a href="#portal-shelf" className="landing-path landing-path--mid">
          <span className="landing-path__k">想读某一本</span>
          <span className="landing-path__v">十三组书架 ↓</span>
        </a>
        <Link to="/concepts" className="landing-path">
          <span className="landing-path__k">想弄懂一个问题</span>
          <span className="landing-path__v">义理专题 · 跨派概念</span>
        </Link>
      </section>

      {/* ── 第二屏:书架(原有的卡片墙整体挪到这里) ─────────────── */}
      <div id="portal-shelf">{shelf}</div>

      {/* ── 第三屏:招牌样例 —— 挑「别处没有」的具体条目,不用形容词 ── */}
      <section className="landing-show" aria-label="站里有什么">
        <h2 className="landing-h2">这些书里,有些东西别处没有</h2>
        <div className="landing-show__list">
          {SHOWCASE.map((s) => (
            <Link key={s.href} to={s.href} className="landing-show__item">
              <span className="landing-show__tag">{s.tag}</span>
              <span className="landing-show__line">{s.line}</span>
              <span className="landing-show__sub">{s.sub}</span>
            </Link>
          ))}
        </div>
      </section>

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

      {/* 凭什么信 —— 把章末牌记那套提到站级 */}
      <section className="landing-trust" aria-label="凭什么信">
        <h2 className="landing-h2">凭什么信</h2>
        <dl className="landing-trust__list">
          <div><dt>底本</dt><dd>一律取维基文库通行本,逐书择本要点写在各书题解</dd></div>
          <div><dt>译注</dt><dd>白话、注疏、延伸均为本站原创,非转录他处译本</dd></div>
          <div><dt>校验</dt><dd>引文逐字核为原文精确子串,不过则不落库</dd></div>
          <div><dt>纠错</dt><dd>每章末尾都有报错入口,写信给 <a href="mailto:hexa@gavin.pub">hexa@gavin.pub</a></dd></div>
          {/* 与仓库里两份 LICENSE 一致:原创内容 CC BY-NC 4.0、源代码 MIT。别只写一半 */}
          <div><dt>转载</dt><dd>原创内容 CC BY-NC 4.0(署名、非商用即可自由使用);源代码 MIT</dd></div>
        </dl>
        <p className="landing-trust__more">
          <Link to="/about">关于本站 · 研读铁律与数据说明 →</Link>
        </p>
      </section>
    </>
  )
}
