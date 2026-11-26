// 观象 · 书桌:撤回正在排队 / 审核中的提交,好换一个 build 重新送审。 node scripts/desk/asc/withdraw.mjs [--dry]
import { api, DESK } from './lib.mjs'
const pending = await api(`/v1/reviewSubmissions?filter[app]=${DESK}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`)
const list = pending.json.data || []
if (!list.length) { console.log('没有在排队 / 在审的提交'); process.exit(0) }
for (const s of list) {
  console.log(`提交 ${s.id.slice(0, 8)} · ${s.attributes.state} · ${s.attributes.submittedDate || ''}`)
  if (process.argv.includes('--dry')) continue
  const r = await api(`/v1/reviewSubmissions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }) })
  console.log(r.ok ? `✅ 已撤回 → ${r.json.data.attributes.state}` : `❌ ${r.status} ${JSON.stringify(r.json?.errors?.map((e) => e.detail))}`)
}
const v = (await api(`/v1/apps/${DESK}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appStoreState`)).json.data[0]
console.log(`版本 ${v.attributes.versionString} 现在是 ${v.attributes.appStoreState}`)
