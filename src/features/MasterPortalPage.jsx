import { allGroups, sitesInGroup, siteEntryHref } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { corpusTexts } from './reader/corpus.js'
import daoTexts from '../data/dao/texts.json'
import PortalStudyTrail from './reader/PortalStudyTrail.jsx'
import PortalLanding from './PortalLanding.jsx'

// 卡片描述由 texts.json 派生(已收书目+计数),根治「加书忘改 portalDesc 文案」;
// 易经非书目制(64 卦 + 工具),保留其 portalDesc tagline。
function siteDesc(site) {
  if (site.key === 'yijing') return '六十四卦 · 经传十翼 · 推演工作台 · 学堂'
  const texts = site.key === 'dao' ? daoTexts : corpusTexts(site.key)
  const done = (texts || []).filter(t => t.status === 'done')
  if (!done.length) return site.portalDesc
  // 两行放得下、不截词:按长度贪心取前几部(至少 2 部),余数写「等 N 部」
  const picked = []
  let len = 0
  for (const t of done) {
    const add = t.title.length + (picked.length ? 3 : 0)
    if (picked.length >= 2 && len + add > 20) break
    picked.push(t.title); len += add
  }
  const titles = picked.join(' · ')
  return done.length > picked.length ? `${titles} 等 ${done.length} 部` : titles
}

// 每组以自有的沉静色驱动徽章/悬停(--card-accent);易经的 cinnabar 在门户外壳被映射为墨色。
const accentStyle = (site) => ({ '--card-accent': `var(--${site.accent})` })

// 诸学门户(总入口)——左上角 logo 全站可达,列全部分组(易道/儒/佛/心/法/墨/兵/纵横/中医/谋略)。
// 生产域名上卡片链向各组绝对 URL(跨域),dev 用相对路径。
// 诸学门户 = 首页(2026-09-30 起 /hexagram 跳转到 /,不再有「精简版门户」):首屏主张 → 书架 → 争鸣 → 索引 → 最近新收 → 我的研读。
// 生产域名上卡片链向各组绝对 URL(跨域),dev 用相对路径。
export default function MasterPortalPage() {
  usePageTitle('古籍研读站')
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

  // 2026-09-30 门户重排(owner review 两轮:「三列等宽卡在宽屏上丑」→「分行后宽窄不一、上下不齐」):
  // 书架是一张 **5 列等宽等高的卡片矩阵**,门类作横向题签压在各组卡片上方(易道 / 儒释 / 诸子 / 方术 / 集部)。
  // 十五组恰好 2+3 / 5 / 2+3 = 三整行,所有卡同宽同高、列线上下贯通;题签用 grid 显式定位(span 该组的列数),
  // 组数不齐也能自动按 5 列贪心装行。≤1080 退回「每门类一段、卡片自动折行」,≤640 单列横向卡。
  // FAMILIES 只是门户的呈现分组,不动 registry 的 group(隔离/域名语义不变);不在表里的新组落到「其他」。
  // portalHidden 组(骨架期)仍跳过——只影响本页,该组仍可直连 URL。
  const groups = allGroups().filter((g) => !sitesInGroup(g).some((s) => s.portalHidden))
  const sites = groups.flatMap((g) => sitesInGroup(g))
  const byKey = Object.fromEntries(sites.map((s) => [s.key, s]))
  const FAMILIES = [
    { key: 'yidao', label: '易道', note: '一体两翼', keys: ['yijing', 'dao'], bond: true },
    { key: 'rushi', label: '儒释', note: '三家心性', keys: ['ru', 'fo', 'xin'] },
    { key: 'zhuzi', label: '诸子', note: '百家之言', keys: ['fa', 'mo', 'bing', 'zong', 'moulue'] },
    { key: 'fangshu', label: '方术', note: '医经术数', keys: ['zhongyi', 'mingli'] },
    { key: 'jibu', label: '集部', note: '诗词曲文', keys: ['tangshi', 'songci', 'yuanqu', 'guwen'] },
  ]
  const placed = new Set(FAMILIES.flatMap((f) => f.keys))
  const rest = sites.filter((s) => !placed.has(s.key)).map((s) => s.key)
  const families = [...FAMILIES, ...(rest.length ? [{ key: 'qita', label: '其他', note: '', keys: rest }] : [])]
    .map((f) => ({ ...f, sites: f.keys.map((k) => byKey[k]).filter(Boolean) }))
    .filter((f) => f.sites.length)
  // 按 COLS 列贪心装行:一个门类不拆行;每装满一行换行。每个门类是外层网格里跨 n 列的一个格子,
  // 内层再分 n 等列(与外层同一个列距,故各门类的卡片列线上下贯通)。同一排是一层「书架板」(行底一道板线),
  // 同排第二个门类左侧一道竖向隔线;题签 = 朱色签条 + 大字门类名 + 右端小注。
  const COLS = 5
  let col = 1, row = 1
  for (const f of families) {
    const n = f.sites.length
    if (col > 1 && col + n - 1 > COLS) { col = 1; row += 1 }
    f.pos = { col, span: Math.min(n, COLS), row, cont: col > 1 }
    col += n
    if (col > COLS) { col = 1; row += 1 }
  }
  const lastRow = Math.max(...families.map((f) => f.pos.row))
  const renderCard = (s) => (
    <a key={s.key} href={siteEntryHref(s, protocol, hostname)} className="master-portal__card" style={accentStyle(s)}>
      <span className="master-portal__seal">{s.brand}</span>
      <span className="master-portal__titles">{s.portalTitle}</span>
      <span className="master-portal__desc">{siteDesc(s)}</span>
    </a>
  )

  const shelf = (
    <div className="master-portal__shelf" style={{ '--cols': COLS }}>
      <header className="master-portal__head">
        <h2 className="master-portal__title">诸学门户</h2>
        <p className="master-portal__sub">{sites.length} 组书架 · 经、子、集三部 · 择一组进去,组内自成一站</p>
      </header>
      <div className="master-portal__grid">
        {families.map((f) => (
          <section key={f.key} className={`master-portal__family ${f.pos.cont ? 'master-portal__family--cont' : ''} ${f.pos.row === lastRow ? 'master-portal__family--last' : ''}`} aria-label={f.label}
            style={{ '--c': f.pos.col, '--s': f.pos.span, '--r': f.pos.row }}>
            <h3 className="master-portal__cap">
              <span className="master-portal__cap-bar" aria-hidden="true" />
              <span className="master-portal__cap-label">{f.label}</span>
              {f.bond && <span className="master-portal__cap-bond" aria-hidden="true" title="易道同组,注疏内有卦名桥">☯</span>}
              {f.note && <span className="master-portal__cap-note">{f.note}</span>}
            </h3>
            <div className="master-portal__cards">{f.sites.map(renderCard)}</div>
          </section>
        ))}
      </div>
    </div>
  )

  return (
    <div className="master-portal master-portal--landing">
      <PortalLanding shelf={shelf} groupCount={sites.length} />
      <PortalStudyTrail />
    </div>
  )
}
