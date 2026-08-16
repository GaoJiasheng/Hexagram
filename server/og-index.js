// 逐页标题索引(og 索引)的**唯一**一份分片规则 + 运行时查询。
//
// 这个索引在构建期由 scripts/build-content-assets.mjs 生成到
// public/content/og/<片号>.json,形如 { "/ru/lunyu/1": [标题, 摘要, 正文摘录] }。
// 全量约 1.1MB,整份读进 Worker 会顶到 CPU 上限,所以按整条路径哈希切成 256 片,
// 一次只取需要的那一片(约 43KB)。
//
// ⚠️ 这份规则此前**在两个文件里各抄了一遍**(构建脚本 + 边缘中间件),
// 两边都留着「改一处必改两处」的告诫 —— 而它们一旦不一致,表现是
// **静默查不到**(分享卡悄悄消失、标题悄悄退回站点级),没有任何报错。
// 现在收敛到这里,两边都 import 这一份;新的消费方(如评论通知邮件的标题)
// 也一律从这里取,不要再抄第四份。

export const OG_SHARDS = 256

export const ogShardKey = (p) => {
  let h = 2166136261
  for (const ch of p) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0) % OG_SHARDS
}

// 结尾斜杠归一(根路径除外),否则 /a/b 与 /a/b/ 会落进不同的片
export const normPath = (p) => (p.length > 1 ? p.replace(/\/$/, '') : p)

// 索引里的标题末尾常缀站名(「道德经 · 一章 · 道藏研读」)。
// 用在站内场景(比如「观象新评论」的邮件标题)时那截是废话,去掉。
export function stripSiteSuffix(title) {
  const parts = String(title || '').split(' · ')
  return parts.length > 1 ? parts.slice(0, -1).join(' · ') : String(title || '')
}

// 取某个页面路径的中文标题;查不到、没有 ASSETS 绑定、或出任何差错都返回 null。
// **调用方必须能接受 null** —— 这只是让文案更好看,绝不能因为它失败而拖累主流程。
export async function lookupPageTitle(env, pathname, origin = 'https://hexa.gavin.pub') {
  try {
    if (!env?.ASSETS?.fetch) return null
    const key = normPath(pathname)
    const res = await env.ASSETS.fetch(new URL(`/content/og/${ogShardKey(key)}.json`, origin))
    if (!res.ok) return null
    const hit = (await res.json())[key]
    return hit?.[0] ? stripSiteSuffix(hit[0]) : null
  } catch {
    return null
  }
}
