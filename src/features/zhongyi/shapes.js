// 中医三件(design-v24 §13)的纯函数层:从站内原文**派生**书的形状,页面与 check-data 闸共用,不各写各的。
//   parseBencao   《神农本草经》18 类 = 六部 × 三品,格内药名从各段段首(药名 + 全角空格)切出
//   liujingIndex  《伤寒论》22 篇按六经 / 前置 / 六经之外 / 治法分组,篇题与条文数从原文取
// 只排结构、不出判断;药名只列名,不带主治。

export const BENCAO_BU = ['玉石部', '草部', '木部', '果菜部', '米谷部', '虫兽部']
export const BENCAO_PIN = ['上品', '中品', '下品']
const TITLE_RE = /^(玉石|草|木|果菜|米谷|虫兽)部(上|中|下)品$/
// 药名:段首到第一个全角空格;只认 1–14 个汉字(「玉泉」「青石赤石黄石白石黑石脂等」——后者十三字是最长的一条)
const NAME_RE = /^([㐀-鿿\u{20000}-\u{2ffff}]{1,14})　/u

export function parseBencao(book) {
  const cells = {}
  const problems = []
  let total = 0
  for (const c of book.chapters || []) {
    const m = TITLE_RE.exec(c.title || '')
    if (!m) { problems.push(`第 ${c.no} 类题名不合「某部某品」: ${c.title}`); continue }
    const bu = `${m[1]}部`, pin = `${m[2]}品`
    const names = []
    c.paragraphs.forEach((p, i) => {
      const t = typeof p === 'string' ? p : p.original
      const n = NAME_RE.exec(t)
      if (n) names.push(n[1])
      else problems.push(`第 ${c.no} 类第 ${i + 1} 段无药名段首: ${t.slice(0, 12)}`)
    })
    const key = `${bu}|${pin}`
    if (cells[key]) problems.push(`「${bu}${pin}」重复: 第 ${cells[key].ch} 类与第 ${c.no} 类`)
    cells[key] = { ch: c.no, title: c.title, names }
    total += names.length
  }
  for (const bu of BENCAO_BU) for (const pin of BENCAO_PIN) if (!cells[`${bu}|${pin}`]) problems.push(`缺「${bu}${pin}」`)
  return { cells, total, problems }
}

export function liujingIndex(book, data) {
  const byNo = new Map((book.chapters || []).map((c) => [c.no, c]))
  const chapter = (no) => {
    const c = byNo.get(no)
    return c ? { no, title: c.title, count: c.paragraphs.length } : { no, title: `第 ${no} 篇`, count: 0 }
  }
  const channels = data.channels.map((ch) => ({ ...ch, list: ch.chapters.map(chapter), count: ch.chapters.reduce((n, no) => n + chapter(no).count, 0) }))
  const groups = data.groups.map((g) => ({ ...g, list: g.chapters.map(chapter) }))
  return { channels, groups }
}
