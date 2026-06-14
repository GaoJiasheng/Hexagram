// 篇目格显示用标题:纯序数标题(道德经「一章」「二章」、「第三章」)无信息量,回退序号格;
// 有名者(逍遥游、图国第一、大易总叙章第一、邹忌讽齐王纳谏…)照显。各阅读器篇目网格共用。
export function tocTitle(title) {
  if (!title) return null
  if (/^第?[〇零一二三四五六七八九十百千两]+[章篇卷]$/.test(title.trim())) return null
  return title
}
