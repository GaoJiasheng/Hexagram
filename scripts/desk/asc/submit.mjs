// 观象 · 书桌:把当前「准备提交」的版本送审。 node scripts/desk/asc/submit.mjs [--build N] [--dry]
// 换包重提:node scripts/desk/asc/withdraw.mjs → DESK_BUILD=N apps/desk/ship.sh → node scripts/desk/asc/submit.mjs --build N
import { api, DESK } from './lib.mjs'
const die = (...m) => { console.error('❌', ...m); process.exit(1) }
const v = (await api(`/v1/apps/${DESK}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appStoreState,releaseType`)).json.data[0]
const VER = v.id
const R = (await api(`/v1/appStoreVersions/${VER}/appStoreReviewDetail`)).json?.data?.attributes || {}
// --build N:把第 N 号 build 挂到这个版本上再送审(换包重提时用);不给就用版本上已经挂着的那个
const wantBuild = (() => { const i = process.argv.indexOf('--build'); return i > 0 ? process.argv[i + 1] : null })()
if (wantBuild) {
  if (!['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState)) die(`版本还是 ${v.attributes.appStoreState},换不了 build(刚撤回的话等一会儿)`)
  const bs = (await api(`/v1/builds?filter[app]=${DESK}&filter[version]=${wantBuild}&fields[builds]=version,processingState`)).json.data || []
  if (!bs.length) die(`build ${wantBuild} 还没出现在 App Store Connect(上传后要处理几分钟)`)
  if (bs[0].attributes.processingState !== 'VALID') die(`build ${wantBuild} 还是 ${bs[0].attributes.processingState}`)
  if (!process.argv.includes('--dry')) {
    const r = await api(`/v1/appStoreVersions/${VER}/relationships/build`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'builds', id: bs[0].id } }) })
    if (!r.ok) die('挂 build 失败', r.status, JSON.stringify(r.json?.errors?.map((e) => e.detail)))
  }
}
const b = (await api(`/v1/appStoreVersions/${VER}/build?fields[builds]=version,processingState`)).json?.data?.attributes
console.log(`版本 ${v.attributes.versionString} · ${v.attributes.appStoreState} · ${v.attributes.releaseType} · build ${b?.version} ${b?.processingState}`)
console.log(`送审信息:需要登录 ${R.demoAccountRequired} · 账号名 ${R.demoAccountName ? '有' : '缺'} · 密码 ${R.demoAccountPassword ? '有' : '缺'} · 联系人 ${R.contactEmail && R.contactPhone ? '有' : '缺'} · 备注 ${(R.notes || '').length} 字`)
if (R.demoAccountRequired && !(R.demoAccountName && R.demoAccountPassword)) die('演示账号没填全')
if (b?.processingState !== 'VALID') die('build 不可用')
if (process.argv.includes('--dry')) process.exit(0)
const ex = await api(`/v1/reviewSubmissions?filter[app]=${DESK}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`)
let sub = (ex.json.data || [])[0]
if (sub && sub.attributes.state !== 'READY_FOR_REVIEW') die('已有在审的提交:', sub.attributes.state)
if (!sub) {
  const r = await api('/v1/reviewSubmissions', { method: 'POST', body: JSON.stringify({ data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: DESK } } } } }) })
  if (!r.ok) die('建 submission 失败', r.status, JSON.stringify(r.json))
  sub = r.json.data
}
const items = await api(`/v1/reviewSubmissions/${sub.id}/items`)
if (!(items.json.data || []).length) {
  const r = await api('/v1/reviewSubmissionItems', { method: 'POST', body: JSON.stringify({ data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: VER } } } } }) })
  if (!r.ok) die('加项失败', r.status, JSON.stringify(r.json?.errors?.map((e) => [e.detail, e.meta?.associatedErrors]), null, 1))
}
const r = await api(`/v1/reviewSubmissions/${sub.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } }) })
if (!r.ok) die('提交失败', r.status, JSON.stringify(r.json, null, 1))
console.log(`✅ 已提交审核 · ${r.json.data.attributes.state}`)
