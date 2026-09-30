// 古文抓取配置 —— fetch-corpus.mjs 读此驱动(2026-10-01,「老师首次打开」T6:owner 定新组收《古文观止》全本)。
//
// 底本:《古文觀止》吳楚材、吳調侯 康熙三十四年(1695)编,十二卷二百二十二篇,流传最广的古文选本。
// 结构:维基文库一卷一页(古文觀止/卷1 … 卷12),页内 ==篇題== 二级标题切篇,页首 =卷一　周文= 一级标题
// 只是卷题、其下无正文(切章后空章自动剔除)。吴氏评注以 {{*|…}} 内联夹在正文里(音注、串讲、○ 眉批),
// 由 wikisource.mjs 的模板剔除一并去掉,正文只留原文。{{Main|…}} 跨页链接同理。
//
// ⚠️ HEADING_SKIP_RE 把凡以「序」收尾的标题当非经文跳过(那条规则为心经 djvu 页的明太祖序而设),
// 而本书有二十几篇正是「序」体(滕王閣序、蘭亭集序、送孟東野序…),故 keepHeadingRe 白名单放行。
// 序页(古文觀止/序:序一/序二/例言)不收——那是选本的编者序,书级导读里讲。
//
// 一篇一章(222 章):每篇有自己的 URL、译注延与白话,搜索命中即篇题;卷的归属与各篇出处(左传/国语/韩愈…)
// 由 scripts/gen-guwen-meta.mjs 从目录页另生成 src/data/guwen/guwenguanzhi-meta.json,供目录分卷与题下小字。

export const BOOKS = [
  {
    slug: 'guwenguanzhi',
    title: '古文观止',
    pages: Array.from({ length: 12 }, (_, i) => `古文觀止/卷${i + 1}`),
    splitHeadings: true,
    keepHeadingRe: '序$',
    dropSpaceLines: true,      // 篇末吴氏总评(半角空格起头的预格式化行)整行剔
    stripInnerSpaces: true,    // {{*|注}} 剔除后残留在字间的半角空格
    splitLongParas: 360,       // 一篇排成一段的(报任安书 2800 字)按句末标点分段,只分不改字
    chapterMeta: 'src/data/guwen/guwenguanzhi-meta.json',   // 出处/作者并进各章 source 字段
    exactChapters: 222,
  },
]
