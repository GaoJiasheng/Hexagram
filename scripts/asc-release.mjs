// 建 App Store 版本 → 写更新说明 → 挂最新 build → 补送审备注 → 提交审核。
//
// 前三版(1.32/1.33/1.34)都是在临时目录里手写脚本做的,而那个目录会被清空 ——
// 偏好与踩过的坑没地方留。这个脚本就是那个「地方」。
//
//   node scripts/asc-release.mjs <版本号> <说明文件> [--dry-run]
//   说明文件格式:whatsNew 正文 → 单独一行 ---REVIEW--- → 送审备注(英文)
//
// ⚠️ --dry-run 只读不写,用它试跑。**别拿真跑去试脚本** ——
//    2026-08-21 我为了验「第一行不许是小标题」那道闸,真跑了一次假版本号 9.9.9,
//    在 ASC 里建出一个删不掉的版本(Apple 只许删该平台第一个版本、且传过 build 的不能删),
//    最后只能改名成下一版留着。
//
// 凭据同 tf-attach.mjs:.ios-ship.env + ~/.appstoreconnect/private_keys/
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_ID = 'pub.gavin.hexa'

// ⚠️ owner 2026-08-21 定:审批通过后**自动发布**,不再手动点。
// 前三版都是 MANUAL,每次过审都卡在「还要自己去点一下发布」上。
const RELEASE_TYPE = 'AFTER_APPROVAL'

const env = fs.readFileSync(path.join(ROOT, '.ios-ship.env'), 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const KID = get('ASC_KEY_ID'), ISS = get('ASC_ISSUER_ID')
const PEM = fs.readFileSync(`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`, 'utf8')

const b64 = (b) => Buffer.from(b).toString('base64url')
function jwt() {
  const now = Math.floor(Date.now() / 1000)
  const h = b64(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }))
  const p = b64(JSON.stringify({ iss: ISS, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }))
  // dsaEncoding 必须 ieee-p1363,默认的 DER Apple 不认
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

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const [version, notesFile] = args.filter((a) => !a.startsWith('--'))
if (!version || !notesFile) die('用法: node scripts/asc-release.mjs <版本号> <说明文件> [--dry-run]')
if (!/^\d+\.\d+\.\d+$/.test(version)) die('版本号形如 1.35.0')

const raw = fs.readFileSync(notesFile, 'utf8')
const [whatsNew, reviewNotes] = raw.split(/^---REVIEW---$/m).map((x) => x.trim())
if (!whatsNew || !reviewNotes) die('说明文件缺 ---REVIEW--- 分隔行')

// ⚠️ App Store 的「新功能」默认只露头两行,其余折进「更多」。
// 1.33.0 写成「新增\n· …」,露出来的就只有「新增」两个字,预览位白瞎。
if (/^[·\-*\s]*(新增|修复|更新|优化|改进|其他)\s*[:：]?\s*$/.test(whatsNew.split('\n')[0])) {
  die('更新说明第一行是光秃秃的小标题。App Store 只露头两行 —— 把最有份量的一条放第一行。')
}

const app = await api(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)
const APP = app.json?.data?.[0]?.id
if (!APP) die('找不到 app', BUNDLE_ID)

const builds = await api(`/v1/builds?filter[app]=${APP}&limit=1&sort=-version&fields[builds]=version,processingState`)
const build = builds.json?.data?.[0]
if (!build) die('没有 build')
if (build.attributes.processingState !== 'VALID') die(`build ${build.attributes.version} 还是 ${build.attributes.processingState},等它 VALID`)
console.log(`▶ 用 build ${build.attributes.version}`)

if (DRY) {
  console.log('▶ --dry-run:检查全过,到此为止(不建版本、不提交)')
  console.log(`  会建 ${version} · ${RELEASE_TYPE} · 更新说明 ${[...whatsNew].length} 字 · 备注 ${[...reviewNotes].length} 字`)
  process.exit(0)
}

// ASC 常留一个可编辑的草稿版本(上一次误跑、或 Apple 自动建的)——
// 存在就复用改名,不存在才新建。**版本删不掉**,所以不能靠「删了重来」。
const all = await api(`/v1/apps/${APP}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState`)
const draft = (all.json.data || []).find((x) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(x.attributes.appStoreState))
let r, VER
if (draft) {
  VER = draft.id
  r = await api(`/v1/appStoreVersions/${VER}`, { method: 'PATCH', body: JSON.stringify({
    data: { type: 'appStoreVersions', id: VER,
      attributes: { versionString: version, releaseType: RELEASE_TYPE } } }) })
  if (!r.ok) die('改草稿失败', r.status, JSON.stringify(r.json))
  console.log(`✅ 复用草稿 ${draft.attributes.versionString} → ${version}(${RELEASE_TYPE} —— 过审自动上架,不用再点)`)
} else {
  r = await api('/v1/appStoreVersions', { method: 'POST', body: JSON.stringify({
    data: { type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: version, releaseType: RELEASE_TYPE },
      relationships: { app: { data: { type: 'apps', id: APP } } } } }) })
  if (!r.ok) die('建版本失败', r.status, JSON.stringify(r.json))
  VER = r.json.data.id
  console.log(`✅ 版本 ${version}(${RELEASE_TYPE} —— 过审自动上架,不用再点)`)
}

const locs = await api(`/v1/appStoreVersions/${VER}/appStoreVersionLocalizations`)
const zh = (locs.json.data || []).find((l) => l.attributes.locale === 'zh-Hans')
if (!zh) die('没有 zh-Hans 本地化')
r = await api(`/v1/appStoreVersionLocalizations/${zh.id}`, { method: 'PATCH', body: JSON.stringify({
  data: { type: 'appStoreVersionLocalizations', id: zh.id, attributes: { whatsNew } } }) })
console.log(r.ok ? '✅ 更新说明已写入' : `❌ ${r.status} ${JSON.stringify(r.json)}`)

r = await api(`/v1/appStoreVersions/${VER}/relationships/build`, { method: 'PATCH', body: JSON.stringify({
  data: { type: 'builds', id: build.id } }) })
console.log(r.ok ? '✅ build 已挂上' : `❌ ${r.status} ${JSON.stringify(r.json)}`)

// ⚠️ 送审备注**会从上一版整份继承**(联系人/演示账号/notes 都带过来)——
// 看着填好了,但 notes 说的还是上一版的事。必须覆盖。
// 存在就 PATCH:直接 POST 会 409 STATE_ERROR.ALREADY_EXISTS。
const cur = await api(`/v1/appStoreVersions/${VER}/appStoreReviewDetail`)
const detailId = cur.json?.data?.id
const inherited = cur.json?.data?.attributes || {}
const attrs = {
  contactFirstName: inherited.contactFirstName || 'Jiasheng',
  contactLastName: inherited.contactLastName || 'Gao',
  contactPhone: inherited.contactPhone,
  contactEmail: inherited.contactEmail,
  demoAccountName: inherited.demoAccountName,
  demoAccountPassword: inherited.demoAccountPassword,   // 密码不进仓库,靠继承
  demoAccountRequired: true,
  notes: reviewNotes,
}
if (!attrs.demoAccountPassword) {
  console.warn('⚠️ 没继承到演示账号密码 —— 去 ASC 手填,否则大概率因「无法登录」被拒')
}
r = detailId
  ? await api(`/v1/appStoreReviewDetails/${detailId}`, { method: 'PATCH', body: JSON.stringify({
      data: { type: 'appStoreReviewDetails', id: detailId, attributes: attrs } }) })
  : await api('/v1/appStoreReviewDetails', { method: 'POST', body: JSON.stringify({
      data: { type: 'appStoreReviewDetails', attributes: attrs,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VER } } } } }) })
console.log(r.ok ? '✅ 送审备注已写入' : `❌ ${r.status} ${JSON.stringify(r.json)}`)

let ex = await api(`/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`)
let sub = (ex.json.data || [])[0]
if (!sub) {
  r = await api('/v1/reviewSubmissions', { method: 'POST', body: JSON.stringify({
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP } } } } }) })
  if (!r.ok) die('建 submission 失败', r.status, JSON.stringify(r.json))
  sub = r.json.data
}
r = await api('/v1/reviewSubmissionItems', { method: 'POST', body: JSON.stringify({
  data: { type: 'reviewSubmissionItems',
    relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: VER } } } } }) })
if (!r.ok) die('加项失败', r.status, JSON.stringify(r.json))

r = await api(`/v1/reviewSubmissions/${sub.id}`, { method: 'PATCH', body: JSON.stringify({
  data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } }) })
if (!r.ok) die('提交失败', r.status, JSON.stringify(r.json, null, 1))
console.log(`✅ 已提交审核 · ${r.json.data.attributes.state}`)
console.log('   过审后会自动上架,不用再点发布。')
