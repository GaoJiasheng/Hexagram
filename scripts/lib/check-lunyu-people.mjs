// I5 · 论语孔门弟子出场索引 的校验闸(docs/design-v24.md §0.2 / §2)。
// 规则在 scripts/lib/people-index.mjs 的 checkPeopleIndex(孟子 / 传习录同一把尺子),这里只是论语的薄包装。
import { derive, EXCLUDE, SRC, OUT } from '../gen-lunyu-people.mjs'
import { checkPeopleIndex } from './people-index.mjs'

export default function check(ctx) {
  return checkPeopleIndex(ctx, { tag: '论语人物', corpus: 'ru', slug: 'lunyu', OUT, SRC, derive, EXCLUDE, minPeople: 20 })
}
