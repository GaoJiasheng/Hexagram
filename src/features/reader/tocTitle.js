// 篇目格显示用标题:纯序数标题(道德经「一章」「二章」、「第三章」)无信息量,回退序号格;
// 有名者(逍遥游、图国第一、大易总叙章第一、邹忌讽齐王纳谏…)照显。各阅读器篇目网格共用。
// 纯序数章名的书(道德经「一章」、难经「第一难」),可在 texts.json 配 chapterNames 补显示名:
// 道德经取每章首句(上善若水/天地不仁/知人者智…)——**一律是本章原文子串**,零编造,
// check-data 逐条校验。个别首句过长或不是本章名句的,改取本章更立得住的一句,仍须是子串。
export function tocTitleOf(chapter, book) {
  const t = tocTitle(chapter.title)
  if (t) return t
  return book?.chapterNames?.[String(chapter.no)] || null
}

export function tocTitle(title) {
  if (!title) return null
  if (/^第?[〇零一二三四五六七八九十百千两]+[章篇卷]$/.test(title.trim())) return null
  return title
}
