// 读经页与卦页的页面标题(2026-10-15 推广第一档):前端 document.title 与爬虫拿到的 <title>
// **共用这一份**——Google 会执行脚本,最终采用的是脚本设的标题;两边不一致,改了等于没改。
// 写法照读者真会搜的样子(「道德经 二十八章 原文 · 译文 · 注释」),一个自然短语,不堆关键词。
// 构建脚本 scripts/build-content-assets.mjs 也 import 这里,改格式只改这一处。

const TAIL = '原文 · 译文 · 注释'

// 章名缺省时退回「第 N 章」;有出处的单篇(古文观止「滕王阁序」)篇题打头、书名放括号里
export function chapterSeoTitle({ bookTitle, chapterTitle, no, unit = '章', source = false }) {
  const ch = String(chapterTitle || '').trim() || `第${no}${unit}`
  if (source) return `${ch} ${TAIL}(${bookTitle})`
  return `${bookTitle} ${ch} ${TAIL}`
}

export function hexagramSeoTitle({ fullName, id }) {
  return `${fullName} 第${id}卦 卦辞 · 爻辞 · 译文`
}
