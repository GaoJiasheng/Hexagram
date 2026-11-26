// 观象 · 书桌:首次上架的元数据(2026-11-26 跑过一次;不含隐私问卷、不含演示账号密码、不提交)。
//   node scripts/desk/asc/first-setup.mjs --dry   # 只核文案长度
// 接口做不了的两件:① App 隐私问卷(只能在网页上填:电子邮件地址 / 用户 ID / 其他用户内容,均「App 功能」「与身份关联」「不用于追踪」,与观象一致)
// ② 演示账号密码(owner 自己在版本页「App 审核信息」里填)。填完在版本页点「添加以供审核」→「提交至 App 审核」。
// 踩过的:年龄分级 PATCH 不能同时带 ageRatingOverride 与 ageRatingOverrideV2;新 App 必答 sharedLocation / datingAndRelationships;
// 销售范围要一次带齐 175 个地区(included 里用 ${地区} 当临时 id);版本号要与包里的 1.0.0 一致(ASC 默认建的是 1.0)。
import fs from 'node:fs'
import { api, DESK, HEXA, ROOT } from './lib.mjs'
const ok = (l, r) => { console.log(r.ok ? `✅ ${l}` : `❌ ${l} ${r.status} ${JSON.stringify(r.json?.errors?.map((e) => e.detail || e.title))}`); return r.ok }
const patch = (p, type, id, attributes, relationships) => api(p, { method: 'PATCH', body: JSON.stringify({ data: { type, id, attributes, ...(relationships ? { relationships } : {}) } }) })

// —— 文案:从 docs/desk-appstore.md §1 取,不另写一份
const md = fs.readFileSync(ROOT + '/docs/desk-appstore.md', 'utf8')
const after = (k) => md.slice(md.indexOf(k) + k.length)
const line = (k) => after(k).split('\n').slice(1).find((x) => x.trim() && !x.startsWith('**')).trim()
const subtitle = md.match(/\*\*副标题\*\*[^:]*:(.+)/)[1].trim()
const promo = line('**宣传文本**')
const description = after('**描述**:').split('**关键词**')[0].trim()
const keywords = line('**关键词**')
console.log({ subtitle, promo: [...promo].length, description: [...description].length, keywords: keywords.length })
if ([...subtitle].length > 30 || [...promo].length > 170 || keywords.length > 100 || [...description].length > 4000) throw new Error('文案超长')
if (process.argv.includes('--dry')) process.exit(0)

// 1 · App:内容版权声明(与观象一致)
ok('内容版权声明', await patch(`/v1/apps/${DESK}`, 'apps', DESK, { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' }))

// 2 · 类别、副标题、隐私政策网址
const infos = await api(`/v1/apps/${DESK}/appInfos?include=appInfoLocalizations`)
const info = infos.json.data[0], infoLoc = infos.json.included.find((x) => x.type === 'appInfoLocalizations')
ok('类别 图书 / 教育', await patch(`/v1/appInfos/${info.id}`, 'appInfos', info.id, undefined, {
  primaryCategory: { data: { type: 'appCategories', id: 'BOOKS' } }, secondaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } } }))
ok('副标题与隐私网址', await patch(`/v1/appInfoLocalizations/${infoLoc.id}`, 'appInfoLocalizations', infoLoc.id, { subtitle, privacyPolicyUrl: 'https://hexa.gavin.pub/privacy' }))

// 3 · 年龄分级:照观象的答案(同一批典籍:兵书、中医),但书桌里没有评论 / 用户内容
const hx = await api(`/v1/apps/${HEXA}/appInfos?include=ageRatingDeclaration`)
const age = { ...hx.json.included.find((x) => x.type === 'ageRatingDeclarations').attributes, userGeneratedContent: false }
for (const k of Object.keys(age)) if (age[k] === null) delete age[k]
delete age.ageRatingOverride; delete age.koreaAgeRatingOverride
Object.assign(age, { sharedLocation: false, datingAndRelationships: false })
ok('年龄分级', await patch(`/v1/ageRatingDeclarations/${info.id}`, 'ageRatingDeclarations', info.id, age))

// 4 · 版本:1.0.0、版权、过审自动上架
const vs = await api(`/v1/apps/${DESK}/appStoreVersions?limit=1`)
const VER = vs.json.data[0].id
ok('版本 1.0.0', await patch(`/v1/appStoreVersions/${VER}`, 'appStoreVersions', VER, { versionString: '1.0.0', copyright: '2026 Gao Jiasheng', releaseType: 'AFTER_APPROVAL' }))
const locs = await api(`/v1/appStoreVersions/${VER}/appStoreVersionLocalizations`)
const loc = locs.json.data.find((l) => l.attributes.locale === 'zh-Hans')
ok('描述 / 关键词 / 宣传文本 / 网址', await patch(`/v1/appStoreVersionLocalizations/${loc.id}`, 'appStoreVersionLocalizations', loc.id,
  { description, keywords, promotionalText: promo, supportUrl: 'https://hexa.gavin.pub/about', marketingUrl: 'https://hexa.gavin.pub/apps' }))

// 5 · 挂 build 5
const b = await api(`/v1/builds?filter[app]=${DESK}&sort=-uploadedDate&limit=1&fields[builds]=version,processingState`)
const build = b.json.data[0]
ok(`挂 build ${build.attributes.version}`, await api(`/v1/appStoreVersions/${VER}/relationships/build`, { method: 'PATCH', body: JSON.stringify({ data: { type: 'builds', id: build.id } }) }))

// 6 · 定价:免费
const pp = await api(`/v1/apps/${DESK}/appPricePoints?filter[territory]=USA&limit=1`)
const free = pp.json.data.find((x) => x.attributes.customerPrice === '0.0')
ok('定价 免费', await api('/v1/appPriceSchedules', { method: 'POST', body: JSON.stringify({
  data: { type: 'appPriceSchedules', relationships: { app: { data: { type: 'apps', id: DESK } }, baseTerritory: { data: { type: 'territories', id: 'USA' } },
    manualPrices: { data: [{ type: 'appPrices', id: '${p0}' }] } } },
  included: [{ type: 'appPrices', id: '${p0}', attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } } }] }) }))

// 7 · 销售范围:照观象(147 个国家和地区;欧盟 27 国与中国大陆不上)
const ta = (await api(`/v2/appAvailabilities/${HEXA}/territoryAvailabilities?limit=200&include=territory`)).json.data
const terr = ta.map((x) => ({ t: x.relationships.territory.data.id, on: x.attributes.available }))
const r7 = await api('/v2/appAvailabilities', { method: 'POST', body: JSON.stringify({
  data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: false },
    relationships: { app: { data: { type: 'apps', id: DESK } }, territoryAvailabilities: { data: terr.map((x) => ({ type: 'territoryAvailabilities', id: '${' + x.t + '}' })) } } },
  included: terr.map((x) => ({ type: 'territoryAvailabilities', id: '${' + x.t + '}', attributes: { available: x.on }, relationships: { territory: { data: { type: 'territories', id: x.t } } } })) }) })
ok(`销售范围 ${terr.filter((x) => x.on).length} / ${terr.length}`, r7)

// 8 · 送审信息:联系人照观象那条(同一个开发者);演示账号只带账号名,密码留给 owner 自己填
const notes = fs.readFileSync(ROOT + '/docs/release-notes/desk-1.0.0.md', 'utf8').trim()
const hv = await api(`/v1/apps/${HEXA}/appStoreVersions?limit=1`)
const hr = (await api(`/v1/appStoreVersions/${hv.json.data[0].id}/appStoreReviewDetail`)).json.data.attributes
const cur = await api(`/v1/appStoreVersions/${VER}/appStoreReviewDetail`)
const attrs = { contactFirstName: hr.contactFirstName, contactLastName: hr.contactLastName, contactPhone: hr.contactPhone, contactEmail: hr.contactEmail,
  demoAccountName: hr.demoAccountName, demoAccountRequired: true, notes }
ok(`送审信息(备注 ${[...notes].length} 字)`, cur.json?.data?.id
  ? await patch(`/v1/appStoreReviewDetails/${cur.json.data.id}`, 'appStoreReviewDetails', cur.json.data.id, attrs)
  : await api('/v1/appStoreReviewDetails', { method: 'POST', body: JSON.stringify({ data: { type: 'appStoreReviewDetails', attributes: attrs, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VER } } } } }) }))
