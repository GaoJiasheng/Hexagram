// 撤回正在排队 / 审核中的 App Store 提交(reviewSubmissions),好让 asc-release.mjs 换新版本号 + 新 build 重新送审。
//   node scripts/asc-withdraw.mjs [--dry-run]
// 场景(2026-10-01 首遇):1.35.0 刚送审就又有一批内容要进 App;Apple 同一时间只许一个版本在审,
// 所以先把 1.35.0 的 submission 置 canceled,版本回到可编辑态,asc-release 再复用它改名为新版本号。
// 凭据与 asc-release.mjs 同一份(.ios-ship.env + ~/.appstoreconnect/private_keys/)。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_ID = 'pub.gavin.hexa'
const env = fs.readFileSync(path.join(ROOT, '.ios-ship.env'), 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const KID = get('ASC_KEY_ID'), ISS = get('ASC_ISSUER_ID')
const PEM = fs.readFileSync(`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`, 'utf8')
const b64 = (b) => Buffer.from(b).toString('base64url')
function jwt() {
  const now = Math.floor(Date.now() / 1000)
  const h = b64(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }))
  const p = b64(JSON.stringify({ iss: ISS, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }))
  const sig = crypto.sign('SHA256', Buffer.from(`${h}.${p}`), { key: PEM, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${h}.${p}.${sig}`
}
const api = async (p, opt = {}) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + p, {
    ...opt, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json', ...(opt.headers || {}) },
  })
  const t = await r.text()
  let j = null; try { j = t ? JSON.parse(t) : null } catch { j = { raw: t } }
  return { status: r.status, ok: r.ok, json: j }
}
const die = (...m) => { console.error('❌', ...m); process.exit(1) }
const DRY = process.argv.includes('--dry-run')

const app = await api(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)
const APP = app.json?.data?.[0]?.id
if (!APP) die('找不到 app', BUNDLE_ID)

const vers = await api(`/v1/apps/${APP}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState`)
for (const v of vers.json?.data || []) console.log(`  版本 ${v.attributes.versionString} · ${v.attributes.appStoreState}`)

const pending = await api(`/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`)
const subs = pending.json?.data || []
if (!subs.length) { console.log('没有排队 / 审核中的提交,无需撤回'); process.exit(0) }
for (const s of subs) console.log(`  提交 ${s.id} · ${s.attributes.state}`)
if (DRY) { console.log('▶ --dry-run:到此为止(不撤回)'); process.exit(0) }

for (const s of subs) {
  const r = await api(`/v1/reviewSubmissions/${s.id}`, { method: 'PATCH', body: JSON.stringify({
    data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }) })
  console.log(r.ok ? `✅ 已撤回提交 ${s.id}` : `❌ 撤回失败 ${r.status} ${JSON.stringify(r.json)}`)
  if (!r.ok) process.exit(1)
}
const after = await api(`/v1/apps/${APP}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState`)
for (const v of after.json?.data || []) console.log(`  版本 ${v.attributes.versionString} · ${v.attributes.appStoreState}`)
console.log('▶ 现在可以 node scripts/asc-release.mjs <新版本号> <说明文件>(它会复用这个草稿改名)')
