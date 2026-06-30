// 把刚上传的 build 自动加进 TestFlight 内部测试组(否则 build VALID 但列表里看不到、装不了)。
// 轮询等 App Store Connect 处理完(VALID)再加组。凭据从 .ios-ship.env + ~/.appstoreconnect 读。
// 用法:node scripts/tf-attach.mjs [buildNumber]  (省略则读 ios 工程的 CURRENT_PROJECT_VERSION)
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_ID = 'pub.gavin.hexa'
const env = fs.readFileSync(path.join(ROOT, '.ios-ship.env'), 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const KID = get('ASC_KEY_ID'), ISS = get('ASC_ISSUER_ID')
const PEM = fs.readFileSync(`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`, 'utf8')

// 目标 build 号:命令行参数,或从 pbxproj 读首个 CURRENT_PROJECT_VERSION
const want = process.argv[2]
  || (fs.readFileSync(path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8').match(/CURRENT_PROJECT_VERSION = (\d+)/) || [])[1]

const b64 = (b) => Buffer.from(b).toString('base64url')
function jwt() {
  const now = Math.floor(Date.now() / 1000)
  const h = b64(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }))
  const p = b64(JSON.stringify({ iss: ISS, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }))
  const sig = crypto.sign('SHA256', Buffer.from(`${h}.${p}`), { key: PEM, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${h}.${p}.${sig}`
}
const api = (p, opt = {}) => fetch('https://api.appstoreconnect.apple.com' + p, {
  ...opt, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json', ...(opt.headers || {}) },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const app = await (await api(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).json()
const appId = app.data?.[0]?.id
if (!appId) { console.error('找不到 app:', BUNDLE_ID); process.exit(1) }

const groups = await (await api(`/v1/betaGroups?filter[app]=${appId}&fields[betaGroups]=name,isInternalGroup`)).json()
const ig = (groups.data || []).find((g) => g.attributes.isInternalGroup)
if (!ig) { console.error('没有内部测试组,先在 TestFlight 建一个'); process.exit(1) }

// 轮询等 build VALID(上传后处理 ~5–20 分钟)
let buildId = null
for (let i = 0; i < 40; i++) {
  const b = await (await api(`/v1/builds?filter[app]=${appId}&limit=20&fields[builds]=version,processingState`)).json()
  const hit = (b.data || []).find((x) => x.attributes.version === String(want))
  if (hit && hit.attributes.processingState === 'VALID') { buildId = hit.id; break }
  console.error(`  build ${want} 状态 ${hit?.attributes.processingState || '未出现'} … 等 30s (${i + 1}/40)`)
  await sleep(30000)
}
if (!buildId) { console.error(`build ${want} 超时未 VALID,稍后手动加组`); process.exit(1) }

const res = await api(`/v1/betaGroups/${ig.id}/relationships/builds`, {
  method: 'POST', body: JSON.stringify({ data: [{ type: 'builds', id: buildId }] }),
})
if (res.status === 204) console.error(`✅ build ${want} 已加入内部测试组「${ig.attributes.name}」`)
else { console.error(`加组失败 HTTP ${res.status}:`, await res.text()); process.exit(1) }
