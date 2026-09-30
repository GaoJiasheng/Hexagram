// 《传习录》问学人物索引 的校验闸(design-v24 §14)。规则在 scripts/lib/people-index.mjs 的 checkPeopleIndex(与论语同一把尺子)。
import { derive, EXCLUDE, SRC, OUT } from '../gen-chuanxilu-people.mjs'
import { checkPeopleIndex } from './people-index.mjs'

export default function check(ctx) {
  return checkPeopleIndex(ctx, { tag: '传习录人物', corpus: 'xin', slug: 'chuanxilu', OUT, SRC, derive, EXCLUDE, minPeople: 15 })
}
