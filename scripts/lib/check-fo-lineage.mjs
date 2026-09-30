// 禅宗传灯图 的校验闸(design-v24 §14)。规则与儒门学脉图同一把尺子(check-ru-lineage.mjs 的 checkLineage):
// 引文逐条回查《坛经》该品原文、师承线由前指向后、存疑须有 note、版面不叠不出带。
import { checkLineage } from './check-ru-lineage.mjs'

export const DATA_PATH = 'src/data/fo-lineage.json'

export default function check(ctx) {
  return checkLineage(ctx, { DATA_PATH, tag: '禅宗传灯图' })
}
