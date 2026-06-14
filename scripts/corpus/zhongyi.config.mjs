// 中医抓取配置(v19 §1)——fetch-corpus.mjs 读此驱动。原文一律来自抓取,严禁手改。
// 底本:维基文库通行本。素问/灵枢选核心篇,伤寒论/神农本草经按其结构切。
// 铁律(v19 §0):经文照译,但注疏/延伸不作诊疗、不述方药功效用法、不下疗效断语。
// 页名/切片待维基结构核实后填(见 design-v19 §2),先留空骨架,books 暂不录(texts.json status=pending)。
export const BOOKS = [
  // { slug: 'suwen', title: '黄帝内经·素问', pages: [...], splitHeadings: true, exactChapters: ... },
  // { slug: 'lingshu', title: '黄帝内经·灵枢', pages: [...], ... },
  // { slug: 'shanghanlun', title: '伤寒论', pages: [...], ... },
  // { slug: 'bencaojing', title: '神农本草经', pages: [...], ... },
]
