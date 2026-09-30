// 《孟子》问答人物索引 的校验闸(design-v24 §14)。规则在 scripts/lib/people-index.mjs 的 checkPeopleIndex(与论语同一把尺子)。
import { derive, EXCLUDE, SRC, OUT } from '../gen-mengzi-people.mjs'
import { checkPeopleIndex } from './people-index.mjs'

export default function check(ctx) {
  return checkPeopleIndex(ctx, { tag: '孟子人物', corpus: 'ru', slug: 'mengzi', OUT, SRC, derive, EXCLUDE, minPeople: 30 })
}
