// 纵横家抓取配置(v18 §1)——fetch-corpus.mjs 读此驱动。原文一律来自抓取,严禁手改。
// 底本:维基文库《鬼谷子》(陶弘景注本),3 卷页,卷内以 == 篇名第N == / == 篇名 == 分篇,
// splitHeadings 跨卷切篇(序/跋/篇目考另为子页,不取)。篇数待 fetch 实测后锁 exactChapters。
// 战国策选:摘录式 pickHeadings——从 14 卷页按 == 章题 == 切章后,挑 18 篇名篇并改友好标题。
// 底本为士礼居叢書本(姚宏本+鮑彪注),校注 {{*|…}} 由 stripStarTemplates 剔除,只留经文。
const ZGC_PAGES = ['卷03', '卷05', '卷07', '卷08', '卷09', '卷11', '卷14', '卷17', '卷20', '卷21', '卷25', '卷29', '卷30', '卷31']
  .map((v) => `戰國策/${v}`)
// match:章题(简体)内的独特子串;title:阅读用友好篇名。顺序即阅读顺序。
const ZGC_PICKS = [
  { match: '苏秦始将连横', title: '苏秦始将连横' },
  { match: '张仪为秦破从连横', title: '张仪连横说楚', page: '戰國策/卷14' },
  { match: '八尺有余', title: '邹忌讽齐王纳谏' },
  { match: '颜斶', title: '颜斶说齐王' },
  { match: '齐人有冯谖', title: '冯谖客孟尝君' },
  { match: '赵威后', title: '赵威后问齐使' },
  { match: '赵太后新用事', title: '触龙说赵太后' },
  { match: '秦围赵之邯郸', title: '鲁仲连义不帝秦' },
  { match: '范睢至秦', title: '范雎说秦王' },
  { match: '文信侯欲攻赵', title: '甘罗说赵' },
  { match: '秦王使人谓安陵君', title: '唐雎不辱使命' },
  { match: '信陵君杀晋鄙', title: '唐雎说信陵君' },
  { match: '庄辛谓楚襄王', title: '庄辛论幸臣' },
  { match: '燕昭王收破燕后即位', title: '郭隗说燕昭王' },
  { match: '赵且伐燕', title: '鹬蚌相争' },
  { match: '荆宣王问群臣', title: '狐假虎威' },
  { match: '昭阳为楚伐魏', title: '画蛇添足' },
  { match: '燕太子丹质于秦', title: '荆轲刺秦王' },
]

export const BOOKS = [
  // 鬼谷子:3 卷,splitHeadings 切篇,实得 15 篇(捭阖等 12 篇 + 本经阴符七术/持枢/中经)。约 9600 字,全本。
  { slug: 'guiguzi', title: '鬼谷子', pages: ['鬼谷子/卷01', '鬼谷子/卷02', '鬼谷子/卷03'], splitHeadings: true, exactChapters: 15 },
  // 战国策选:18 篇名篇(摘录式)。
  { slug: 'zhanguoce', title: '战国策(选)', pages: ZGC_PAGES, splitHeadings: true, pickHeadings: ZGC_PICKS, exactChapters: 18 },
]
