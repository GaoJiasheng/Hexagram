// 观数 · 学堂主题注册表(仿 src/features/yijing/learnTopics.js 的形态)——
// 命理典籍的前置知识六篇,读这些书之前必须先会的六件事。
// 正文与交互件由 MingliLearnTopicPage.jsx 的 TOPIC_CONTENT 按 key 接入,本表只管顺序与路由。
export const LEARN_TOPICS = [
  { key: 'jiazi', title: '六十甲子', desc: '干支怎么配、为什么只有六十种，不是一百二十种' },
  { key: 'jieqi', title: '节气与年月', desc: '八字的「年」从立春换，「月」按节气分——初学者头号误区' },
  { key: 'wuxing', title: '五行生克', desc: '生、克、乘、侮——四种关系怎么分清' },
  { key: 'qizhu', title: '四柱怎么排', desc: '年上起月、日上起时，排柱其实是一套固定的口诀' },
  { key: 'shishen', title: '十神', desc: '十个名字其实是五种关系乘阴阳，换了日主，全盘重标' },
  { key: 'dizhi', title: '地支藏干与合冲刑', desc: '地支里为什么「藏」着天干，合、冲、刑各是什么意思' },
]

export function topicByKey(key) {
  return LEARN_TOPICS.find((t) => t.key === key) || null
}

export function topicIndex(key) {
  return LEARN_TOPICS.findIndex((t) => t.key === key)
}
