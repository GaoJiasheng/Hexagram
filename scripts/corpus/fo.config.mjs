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
  // 佛扩:《佛说四十二章经》后汉迦叶摩腾、竺法兰译,高丽藏古本(最合古本);序 + 42「佛言」章,单页铺排
  { slug: 'sishierzhang', title: '四十二章经', pages: ['佛說四十二章經（高麗版大藏經本）'], exactChapters: 1 },
  // 佛扩 Wave 2(遗教三经齐 + 阿弥陀 + 禅宗短偈),皆单页短经,整页一章、段按行切:
  // 遗教三经 = 四十二章经(已收) + 佛遗教经 + 八大人觉经
  { slug: 'yijiaojing', title: '佛遗教经', pages: ['佛遺教經'], exactChapters: 1 },
  { slug: 'badaren', title: '八大人觉经', pages: ['佛說八大人覺經'], exactChapters: 1 },
  // 阿弥陀经:取罗什译正文(终「作礼而去」);其后经题「佛说阿弥陀经」所附往生咒(音译梵咒)、译咒题记、卷题非正文,stopParaRe 截除。
  { slug: 'amituojing', title: '阿弥陀经', pages: ['佛說阿彌陀經'], exactChapters: 1, stopParaRe: '^佛说阿弥陀经$' },
  { slug: 'xinxinming', title: '信心铭', pages: ['信心銘'], exactChapters: 1 },
  // 证道歌:首段标题「永嘉大师证道歌」、次段撰人题「唐慎水沙门玄觉撰」非正文,dropParaRe 剔除。
  { slug: 'zhengdaoge', title: '永嘉证道歌', pages: ['永嘉證道歌'], exactChapters: 1, dropParaRe: '^(永嘉大师证道歌|唐慎水沙门玄觉撰)$' },
]
