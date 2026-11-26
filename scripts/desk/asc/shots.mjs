import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { api, DESK, ROOT } from './lib.mjs'
// 商店截图上传:两组(6.9 寸 iPhone、13 寸 iPad),已有图的组跳过。 node scripts/desk/asc/shots.mjs
const DIR = ROOT + '/apps/desk/store/shots'
const vs = await api(`/v1/apps/${DESK}/appStoreVersions?limit=1`); const VER = vs.json.data[0].id
const locs = await api(`/v1/appStoreVersions/${VER}/appStoreVersionLocalizations`); const LOC = locs.json.data.find((l) => l.attributes.locale === 'zh-Hans').id
const existing = (await api(`/v1/appStoreVersionLocalizations/${LOC}/appScreenshotSets?include=appScreenshots`)).json.data || []
for (const [dir, type] of [['iphone-6.9', 'APP_IPHONE_67'], ['ipad-13', 'APP_IPAD_PRO_3GEN_129']]) {
  let set = existing.find((s) => s.attributes.screenshotDisplayType === type)
  if (set && set.relationships?.appScreenshots?.data?.length) { console.log(`${type} 已有 ${set.relationships.appScreenshots.data.length} 张,跳过`); continue }
  if (!set) {
    const r = await api('/v1/appScreenshotSets', { method: 'POST', body: JSON.stringify({ data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC } } } } }) })
    if (!r.ok) { console.log('❌ 建组', type, r.status, JSON.stringify(r.json.errors?.map((e) => e.detail))); continue }
    set = r.json.data
  }
  for (const f of fs.readdirSync(path.join(DIR, dir)).filter((x) => x.endsWith('.png')).sort()) {
    const buf = fs.readFileSync(path.join(DIR, dir, f))
    const r = await api('/v1/appScreenshots', { method: 'POST', body: JSON.stringify({ data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } }) })
    if (!r.ok) { console.log('❌ 预留', f, r.status, JSON.stringify(r.json.errors?.map((e) => e.detail))); continue }
    const shot = r.json.data
    for (const op of shot.attributes.uploadOperations) {
      const h = Object.fromEntries(op.requestHeaders.map((x) => [x.name, x.value]))
      const u = await fetch(op.url, { method: op.method, headers: h, body: buf.subarray(op.offset, op.offset + op.length) })
      if (!u.ok) console.log('❌ 传块', f, u.status)
    }
    const c = await api(`/v1/appScreenshots/${shot.id}`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } } }) })
    console.log(c.ok ? `✅ ${dir}/${f}` : `❌ 提交 ${f} ${c.status}`)
  }
}
