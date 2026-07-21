// 兵家抓取配置(v18 §1)——fetch-corpus.mjs 读此驱动。原文一律来自抓取,严禁手改。
// 底本:维基文库武经七书通行本。五部均为单页内 == 篇名 == 分篇,splitHeadings 切篇:
// - 孙子兵法:繁体页为正页(简体「孙子兵法」是重定向),13 篇带「第N」;页尾「答話」为吴问佚文附录,
//   非传世十三篇,由 HEADING_SKIP_RE 跳过。
// - 吴子 6 篇带「第N」;司马法 5 篇、尉缭子 24 篇(取「全覽」合页,页尾「注释」跳过)、三略 3 篇 上中下略,均无「第N」。
export const BOOKS = [
  { slug: 'sunzi', title: '孙子兵法', pages: ['孫子兵法'], splitHeadings: true, exactChapters: 13 },
  { slug: 'wuzi', title: '吴子', pages: ['吳子'], splitHeadings: true, exactChapters: 6 },
  { slug: 'simafa', title: '司马法', pages: ['司馬法'], splitHeadings: true, exactChapters: 5 },
  // 尉缭子:全覽合页中 伍制令/分塞令/束伍令/經卒令 四篇有目无文(底本阙),取有文的 20 篇(同墨子取现存篇)。
  { slug: 'weiliaozi', title: '尉缭子', pages: ['尉繚子/全覽'], splitHeadings: true, exactChapters: 20 },
  { slug: 'sanlue', title: '三略', pages: ['三略'], splitHeadings: true, exactChapters: 3 },
  // 武经七书补全(扩展):六韬单页 ==卷题==/===篇题=== 二级,parsePageChapters 丢无正文卷题→60 篇。
  { slug: 'liutao', title: '六韬', pages: ['六韜'], splitHeadings: true, dropChapterRe: '^(文韬|武韬|龙韬|虎韬|豹韬|犬韬)$', exactChapters: 60 },
  // 李卫公问对(武经七书最后一部,补全):此前维基 /卷下 空缺已复核——现三卷(卷上/卷中/卷下)俱全,
  // 无 == 分篇标题,3 子页各一章(默认多页各一章)。
  { slug: 'weigongwendui', title: '李卫公问对', pages: ['唐李問對/卷上', '唐李問對/卷中', '唐李問對/卷下'], exactChapters: 3 },
]
