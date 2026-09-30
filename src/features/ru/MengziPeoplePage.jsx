import data from '../../data/ru/mengzi-people.json'
import PeopleIndexPage from './PeopleIndexPage.jsx'

// 《孟子》问答人物索引(design-v24 §14,论语版 §2 的推广)。通用页在 PeopleIndexPage.jsx。
// 数据 src/data/ru/mengzi-people.json 由 scripts/gen-mengzi-people.mjs 从原文派生,每条带命中片段可回查。
const SPEC = {
  data,
  corpus: 'ru', slug: 'mengzi',
  home: '/ru', homeLabel: '儒典', bookHref: '/ru/mengzi', bookTitle: '孟子',
  siteName: '观仁',
  title: '《孟子》问答人物索引',
  subtitle: `七篇十四卷,${data.people.length} 位国君、弟子、论敌与屡引的先贤,各在哪几卷出场。`,
  listLabel: '《孟子》人物(按出场卷数)',
  unit: '卷',
  rows: [
    { label: '上', chs: [1, 3, 5, 7, 9, 11, 13] },
    { label: '下', chs: [2, 4, 6, 8, 10, 12, 14] },
  ],
  intro: (
    <>
      《孟子》比《论语》更像一部辩论集:对国君是劝,对弟子是教,对告子、许行、夷之是驳。同一个「仁义」,对梁惠王说的是「何必曰利」,
      对公孙丑说的是「浩然之气」,对告子说的是「仁内义外」之辨——<strong>看他对谁说</strong>,比看他说了什么更能读出这部书的章法。
      这一页按人切开:点一个名字,列出他出场的每一段;那两排十四格是七篇上下卷,着色的是他出场的卷,点一格跳到那一卷。
      国君只有齐宣王见于五卷、梁惠王见于两卷;弟子里万章、公孙丑各领一篇;孔子、伊尹、伯夷、柳下惠不是对话者,却被引得最多——
      孟子拿「圣之任、清、和、时」四种人做尺子,量的是自己要学谁。
    </>
  ),
  fanli: (
    <>
      凡例:出场由脚本从站内《孟子》原文逐段检出,每条附命中片段,可回查。人物几乎都以全称出现(万章问曰、公孙丑问曰),照全称计;
      单称只收原文确有且所指无歧义的几个:章子 = 匡章、子敖 = 王驩、徐子 = 徐辟、许子 = 许行、夷子 = 夷之、陈子 = 陈臻(皆旧注所定);
      「王」「文公」「穆公」一类单称各章所指不同,不计,故国君的出场段数比实际对话为少。
      同一段提到某人即算一次出场,不论发言、问答还是被人提及;一段计入多人。人物身份据《孟子》本文与赵岐注、朱熹《孟子集注》通行说法,
      存疑者写「旧注谓」。尧舜禹汤文武周公等圣王不入此表。
    </>
  ),
}

export default function MengziPeoplePage() {
  return <PeopleIndexPage spec={SPEC} />
}
