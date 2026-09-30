import data from '../../data/ru/lunyu-people.json'
import PeopleIndexPage from './PeopleIndexPage.jsx'

// I5 · 论语孔门弟子出场索引(docs/design-v24.md §2)。通用页在 PeopleIndexPage.jsx(孟子 / 传习录共用),这里只给论语的数据与文案。
// 数据 src/data/ru/lunyu-people.json 由 scripts/gen-lunyu-people.mjs 从原文派生,每条带命中片段(evidence)可回查。
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

const SPEC = {
  data,
  corpus: 'ru', slug: 'lunyu',
  home: '/ru', homeLabel: '儒典', bookHref: '/ru/lunyu', bookTitle: '论语',
  siteName: '观仁',
  title: '孔门弟子出场索引',
  subtitle: `《论语》二十篇,${data.people.length} 位孔门中人,各在哪几篇出场。`,
  listLabel: '孔门弟子(按出场篇数)',
  rows: [{ label: '上论', chs: range(1, 10) }, { label: '下论', chs: range(11, 20) }],
  intro: (
    <>
      《论语》是一部对话集,问的人不同,孔子答的也不同——同是问仁,答颜渊是「克己复礼」,答樊迟是「爱人」。
      这一页按人切开:<strong>点一个名字</strong>,就列出他出场的每一段;那排二十格是二十篇,着色的是他出场的篇,点一格跳到那一篇。
      多点几个人对照着看:子路、子贡几乎篇篇都在;颜渊多见于前半部,《先进》一篇连记其死;
      第十九篇《子张》通篇是弟子自己的话,朱注谓「子夏为多,子贡次之」——孔子身后弟子各自立说,从这里已看得出来。
    </>
  ),
  fanli: (
    <>
      凡例:出场由脚本从站内《论语》原文逐段检出,每条附命中片段,可回查。全称、字、尊称(子路 / 季路 / 仲由、冉有 / 冉子……)出现即计;
      单字呼名(由、赐、回、参、商、师、求、偃、雍、赤、点、柴、鲤、枨)只在呼格处计——其后紧接「也」「乎」「曰」或逗号、叹号,或人工列出的呼名句(「吾与回言」「赐不受命」……);
      另设排除表,「末由也已」「观其所由」「士师」「富而可求」「不忮不求」「有若无」之类不计。宰我名「予」与孔子自称同形,只收确指的三处。
      同一段提到某人即算一次出场,不论是本人发言、问答还是被人提及;一段计入多人。姓名字号据《史记·仲尼弟子列传》与朱熹《论语集注》,
      存疑者标「旧说」「一说」。子服景伯(鲁大夫,非弟子)与「牢曰」之牢(旧说弟子琴牢,事迹不详)未收。
    </>
  ),
}

export default function LunyuPeoplePage() {
  return <PeopleIndexPage spec={SPEC} />
}
