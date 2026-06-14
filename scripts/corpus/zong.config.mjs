// 纵横家抓取配置(v18 §1)——fetch-corpus.mjs 读此驱动。原文一律来自抓取,严禁手改。
// 底本:维基文库《鬼谷子》(陶弘景注本),3 卷页,卷内以 == 篇名第N == / == 篇名 == 分篇,
// splitHeadings 跨卷切篇(序/跋/篇目考另为子页,不取)。篇数待 fetch 实测后锁 exactChapters。
// 战国策选篇走摘录式管线(仿 fetch-shili),另批接入,此处暂不录。
export const BOOKS = [
  // 鬼谷子:3 卷,splitHeadings 切篇,实得 15 篇(捭阖等 12 篇 + 本经阴符七术/持枢/中经)。约 9600 字,全本。
  { slug: 'guiguzi', title: '鬼谷子', pages: ['鬼谷子/卷01', '鬼谷子/卷02', '鬼谷子/卷03'], splitHeadings: true, exactChapters: 15 },
]
