// 《滴天髓阐微》的三层结构(design-v23 §7)—— 书本来的形状:
//   纲领(原文,简短韵语)→ 原注(旧题刘基注)→ 任氏曰(任铁樵阐发)+ 命例与分析
// 底本里这三层是混排的。按段首标记自动分层,阅读器据此给「只看纲领 / 加原注 / 全部」三档。
//
// 判据(已对全书 1490 段统计核过):
//   · 段首「原注」→ zhu;其后无标记的续段仍属 zhu
//   · 段首「任氏曰」→ ren;其后的命例与分析都属 ren
//   · 无标记、且**下一段**是「原注」或「任氏曰」→ gang(纲领总是紧贴在注的前面)
//   · 章首尚无归属的零星段 → gang
// 底本标点不一(「原注：」「原注，」「原注；」都有),故标记后只要求跟一个标点。
const ZHU_RE = /^原注[:：,，;；]/
// 底本偶把「曰」录成「日」(第 38 章「任氏日；」),一并认
const REN_RE = /^任氏[曰日][:：,，;；]/

/** @returns {('gang'|'zhu'|'ren')[]} 与 paragraphs 等长 */
export function ditiansuiLayers(paragraphs) {
  let cur = 'gang'
  return paragraphs.map((p, i) => {
    const t = p.original || ''
    if (ZHU_RE.test(t)) return (cur = 'zhu')
    if (REN_RE.test(t)) return (cur = 'ren')
    if (!p.pillars) {
      const next = paragraphs[i + 1]?.original || ''
      if (ZHU_RE.test(next) || REN_RE.test(next)) { cur = 'gang'; return 'gang' }
    }
    return cur
  })
}

export const LAYER_MODES = [
  { key: 'gang', label: '只看纲领', hint: '先看这一章的骨架' },
  { key: 'zhu', label: '纲领 + 原注', hint: '' },
  { key: 'all', label: '全部', hint: '含任铁樵的阐发与命例' },
]
