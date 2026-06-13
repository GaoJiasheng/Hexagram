// 释典抓取配置(v17 §1)——fetch-corpus.mjs 读此驱动。
// 底本(实测落定):
// - 心经:玄奘略本在维基文库仅 djvu 转嵌、不可洁取;取法成译广本单页(《般若波羅蜜多心經 (法成)》,
//   内联洁净,序分/正宗分/流通分俱全)。
// - 金刚经:鸠摩罗什译本单页,昭明太子分 32 分作 ====X分第N『…』==== 标题,splitHeadings 按标题切章
//   (跳过「正文」「外部链接」标题,丢弃开经偈/礼佛文等前言)。
// - 坛经:宗宝本《六祖壇經》10 品子页,每品一页(page-per-章);品题行「行由品第一」由 PIN_TITLE_RE 剔除。
// 原文一律来自抓取,严禁手改。

const TANJING_PAGES = [
  '六祖壇經/行由品', '六祖壇經/般若品', '六祖壇經/疑問品', '六祖壇經/定慧品', '六祖壇經/坐禪品',
  '六祖壇經/懺悔品', '六祖壇經/機緣品', '六祖壇經/頓漸品', '六祖壇經/護法品', '六祖壇經/付囑品',
]

export const BOOKS = [
  // 心经:流传最广的玄奘略本。其单行页为 djvu 转嵌,经文实在大正藏第8卷 djvu 第864页
  // (明太祖序之后);splitHeadings 跳过「…序」标题、只取「般若波羅蜜多心經」一章,章末重复经题由
  // parsePageChapters 自动剔除。
  { slug: 'xinjing', title: '心经', pages: ['Page:SSID-10510986 大正新修 大藏經 第8卷·般若部四.pdf/864'], splitHeadings: true, exactChapters: 1 },
  { slug: 'jingangjing', title: '金刚经', pages: ['金剛般若波羅蜜經 (鳩摩羅什)'], splitHeadings: true, exactChapters: 32 },
  { slug: 'tanjing', title: '坛经', pages: TANJING_PAGES, exactChapters: 10 },
]
