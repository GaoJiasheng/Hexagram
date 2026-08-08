// 道藏逐段锚定注疏装载(v6 §5,v7 起六部齐备)。与易经 zhushiAnchored 同构,
// 但无 ref 机制(模块不互链,不引易经全局词表)。
// v8:条目可带 hex/to 桥字段,解析为气泡内指向易经的单向链接——
// 「模块不互链」的唯一例外(v4 §3.7),仅道藏侧出现。取卦名是代码层复用,不构成 UI 互链。
import { getHexagram } from '../yijing/data.js'

// 原先是十一条手写 import + 一张手写映射表。**加书时漏登记不报错、注疏静默不渲染**
// ——悟真篇(Wave 7)就这么漏了一整波,332 条注疏一直没出现在页面上,直到 2026-08-08 才发现。
// 改 glob 自动收录:目录里有什么就挂什么,加书零改动,这一类坑从此不存在。
const MODULES = import.meta.glob('../../data/dao/zhushi-anchored/*.json', { eager: true })
const BOOKS = Object.fromEntries(
  Object.entries(MODULES).map(([p, m]) => [p.slice(p.lastIndexOf('/') + 1, -5), m.default ?? m]),
)

function resolve(entries) {
  if (!entries?.length) return null
  return entries.map((e) => {
    if (e.hex) {
      const h = getHexagram(e.hex)
      return { ...e, qiao: { to: `/hexagram/${e.hex}`, label: `《周易》第${e.hex}卦·${h?.name ?? ''} →` } }
    }
    if (e.to) return { ...e, qiao: { to: e.to, label: `${e.label ?? '前往'} →` } }
    return e
  })
}

/** 道藏锚注。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。 */
export function getDaoAnchors(slug, chapterNo, paraIdx) {
  return resolve(BOOKS[slug]?.[String(chapterNo)]?.[String(paraIdx)])
}
