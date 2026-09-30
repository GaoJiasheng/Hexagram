import data from '../../data/xin/chuanxilu-people.json'
import PeopleIndexPage from '../ru/PeopleIndexPage.jsx'

// 《传习录》问学人物索引(design-v24 §14,论语版 §2 的推广)。通用页在 ru/PeopleIndexPage.jsx。
// 数据 src/data/xin/chuanxilu-people.json 由 scripts/gen-chuanxilu-people.mjs 从原文派生,每条带命中片段可回查。
// 三卷各三四百段,链接带 ?p= 落到对的那一屏(长章拆页只拆显示不拆数据)。
const SPEC = {
  data,
  corpus: 'xin', slug: 'chuanxilu',
  home: '/xin', homeLabel: '阳明心学', bookHref: '/xin/chuanxilu', bookTitle: '传习录',
  siteName: '观心',
  title: '《传习录》问学人物索引',
  subtitle: `上中下三卷,${data.people.length} 位问学者与论学书信的收信人,各在哪一卷出场。`,
  listLabel: '《传习录》人物(按出场卷数)',
  unit: '卷',
  rows: [{ label: '三卷', chs: [1, 2, 3], cellLabel: (c) => c.title }],
  intro: (
    <>
      《传习录》是弟子记的语录加阳明写的信:上卷徐爱、陆澄、薛侃三人所录,中卷八封论学书信,下卷陈九川、黄直、钱德洪等人所记。
      同一个「良知」,答陆澄讲「主一」,答顾东桥辨「知行合一」,天泉桥上与钱德洪、王畿论「四句教」——
      <strong>看谁在问</strong>,才看得出阳明是在纠哪一种偏。这一页按人切开:点一个名字,列出他出场的每一段;三格是三卷,点一格跳到那一卷。
      徐爱只见于上卷,是最早的记录者;钱德洪、王畿多见于下卷,那是晚年;书信的收信人(顾东桥、聂文蔚、罗整庵……)则只在中卷。
    </>
  ),
  fanli: (
    <>
      凡例:出场由脚本从站内《传习录》原文逐段检出,每条附命中片段,可回查。本书人物多以名或字的短称出现(「爱问」「澄曰」「侃问」「九川」「德洪」「汝中」),
      短称只在其后紧接「问」「曰」「因」「又」「请」「对」「在」「尝」「举」「谓」时计,「仁爱」「亲爱」「澄澈」一类另设排除表不计。
      同一段提到某人即算一次出场,不论发问、记录还是被人提及;一段计入多人。姓名字号据本书题署与《明儒学案》通行说法,存疑者写「一说」。
      顾东桥(顾璘)的名字只见于中卷书题,正文不称其名,故未列出。
    </>
  ),
}

export default function ChuanxiluPeoplePage() {
  return <PeopleIndexPage spec={SPEC} />
}
