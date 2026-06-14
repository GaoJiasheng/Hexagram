// 谋略杂纂抓取配置(v20 §1)——《天下无谋·秘卷八书》维基有原文的 5 部。原文一律来自抓取,严禁手改。
// ⚠ 这 5 部学界基本判为现代伪托(罗织经更被揭为今人伪造),站内显著框注「托名·疑现代伪作」,
//   取文献批判与思想史视角,不作处世权术教程(见 design-v20 §0 铁律)。
// 结构(实测):罗织经=12 子页(/01..12,模板 {{Novel}}/{{ProperNoun}}/<onlyinclude> 由 preResolve 清);
//   荣枯鉴(小人经)=单页 10 卷(==圆通卷一==…);权谋(权谋术)=单页 13 篇(==智察==…);
//   韬晦术=单页无 == 标题(卷题内联,目录行已跳),作单章;止学=单页扁平格言,作单章。
const LUOZHI_TITLES = ['阅人卷一', '事上卷二', '治下卷三', '控权卷四', '制敌卷五', '固荣卷六', '保身卷七', '察奸卷八', '谋划卷九', '问罪卷十', '刑罚卷十一', '瓜蔓卷十二']

export const BOOKS = [
  { slug: 'luozhijing', title: '罗织经', pages: Array.from({ length: 12 }, (_, i) => `羅織經/${String(i + 1).padStart(2, '0')}`), chapterTitles: LUOZHI_TITLES, exactChapters: 12 },
  { slug: 'rongkujian', title: '小人经', pages: ['榮枯鑒'], splitHeadings: true, exactChapters: 10 },
  { slug: 'quanmou', title: '权谋术', pages: ['權謀'], splitHeadings: true, exactChapters: 13 },
  { slug: 'taohuishu', title: '韬晦术', pages: ['韜晦術'], exactChapters: 1 },
  { slug: 'zhixue', title: '止学', pages: ['止学'], exactChapters: 1 },
]
