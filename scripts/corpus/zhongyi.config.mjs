// 中医抓取配置(v19 §1)——fetch-corpus.mjs 读此驱动。原文一律来自抓取,严禁手改。
// 底本:维基文库通行本。铁律(v19 §0):经文照译,注疏/延伸不作诊疗、不述方药功效用法、不下疗效断语。
// - 黄帝内经:卷分组(黃帝內經/素問第N卷 / 靈樞第N卷,每卷数篇为 == 篇题 ==),pickHeadings 跨卷选核心篇。
//   篇题编号格式各卷不一(篇第一/八/第五),故按篇名子串匹配;异体 祕/秘·臟/藏·咳/欬·鍼/针 t2s 后再配。
// - 伤寒论/神农本草经:单页,splitHeadings 按 == 标题 == 切(序$ 自动跳)。
const SUWEN_JUAN = ['一', '二', '三', '四', '五', '十', '十一', '十二', '二十二'].map((n) => `黃帝內經/素問第${n}卷`)
const SUWEN_PICKS = [
  { match: '上古天真', title: '上古天真论' },
  { match: '四气调神', title: '四气调神大论' },
  { match: '生气通天', title: '生气通天论' },
  { match: '阴阳应象', title: '阴阳应象大论' },
  { match: '灵兰', title: '灵兰秘典论' },
  { match: '五藏别', title: '五脏别论' },
  { match: '异法方宜', title: '异法方宜论' },
  { match: '汤液醪醴', title: '汤液醪醴论' },
  { match: '脉要精微', title: '脉要精微论' },
  { match: '平人气象', title: '平人气象论' },
  { match: '欬论', title: '咳论' },
  { match: '举痛', title: '举痛论' },
  { match: '痺论', title: '痹论' },
  { match: '痿论', title: '痿论' },
  { match: '至真要大', title: '至真要大论' },
]
const LINGSHU_JUAN = ['一', '二', '三', '四', '六', '八'].map((n) => `黃帝內經/靈樞第${n}卷`)
const LINGSHU_PICKS = [
  { match: '十二原', title: '九针十二原' },
  { match: '本神', title: '本神' },
  { match: '营卫生会', title: '营卫生会' },
  { match: '经脉', title: '经脉' },
  { match: '海论', title: '海论' },
  { match: '天年', title: '天年' },
  { match: '五味', title: '五味' },
  { match: '师传', title: '师传' },
]

export const BOOKS = [
  { slug: 'suwen', title: '黄帝内经·素问', pages: SUWEN_JUAN, splitHeadings: true, pickHeadings: SUWEN_PICKS, exactChapters: 15 },
  { slug: 'lingshu', title: '黄帝内经·灵枢', pages: LINGSHU_JUAN, splitHeadings: true, pickHeadings: LINGSHU_PICKS, exactChapters: 8 },
  // 伤寒论:单页,卷第一..十(==)空、辨…病脉证并治(===)有文(22 篇);林億校序/张仲景原序(序$)自动跳。
  { slug: 'shanghanlun', title: '伤寒论', pages: ['傷寒論'], splitHeadings: true, exactChapters: 22 },
  // 神农本草经:单页,上/中/下经(==)空、各部(===)有药(6 部×3 品=18 类,359 药);序$ 跳。
  { slug: 'bencaojing', title: '神农本草经', pages: ['神農本草經'], splitHeadings: true, exactChapters: 18 },
  // 伤寒杂病论补全(扩展):金匮要略单页,25 == 病/食禁篇;===附方/附注=== 经 mergeHeadingRe 并入前篇(不另起章)。
  // 方剂照原典录,守研习不诊疗——注疏/延伸不述功效用法用量、不下疗效断语。
  { slug: 'jinkui', title: '金匮要略', pages: ['金匱要略'], splitHeadings: true, mergeHeadingRe: '附方|附注', exactChapters: 25 },
]
