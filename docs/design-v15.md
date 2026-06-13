# 观象 · 十五期设计稿 — 三教分站与分组隔离(v15)

> 主题:接入佛、儒两站,与易道**完全平行**,但入口高度收敛:三组——易道(一组,门户互切) / 佛(独立) / 儒(独立)——两两 UI 软隔离,跨组零可见链接。一份构建,域名各自指向。本期只做**架构 + 脚手架**;佛/儒 经文内容另起内容期。

## 0. 隔离规格(硬要求)

- 从「道」侧门户/导航,**不出现**任何指向佛/儒的链接;从佛/儒侧,**不出现**指向道(及易)的链接。佛与儒之间也互不可见。
- 实现:**门户只列「当前站所属组」内的站**。佛、儒各为单站组,门户里自然没有别组的影子。
- 软隔离:一份静态构建,手敲别组 URL 仍可达(可接受);UI 层零跨组链接即满足要求。
- 「桥」(v8,参同契/阴符经→易经卦页)在易道**组内**,不受影响。

## 1. 分组(批次 1)

- `src/sites/registry.js`:每站加 `group` 字段——yijing/dao → `'yidao'`,fo → `'fo'`,ru → `'ru'`。
- `HOST_GROUPS`:hostname → group 映射,已填真实域名 `tao.gavingao.cn→yidao`、`con.gavingao.cn→ru`、`bud.gavingao.cn→fo`;`activeGroup(pathname, hostname)` = `HOST_GROUPS[host]`(域名优先)`?? groupForPath(pathname)`(路径兜底,保证 dev/localhost 按路径分组、隔离仍成立)。
- `sitesInGroup(group)`:门户与切换按钮的数据源。
- 门户(ModulePortal)`SITES.filter(s => s.group === activeGroup)`;切换按钮(桌面+移动)仅当 `sitesInGroup(active).length > 1` 时显示(佛/儒 solo 自然隐藏)。
- 域名着陆重定向:`HOST_GROUPS[host]` 命中且当前路径不属该组时,重定向到该组首页——让 bud 域名落地 `/fo`、con 落地 `/ru`。一份构建集中部署,三域名各锁一组(硬隔离)。

## 1b. 隐藏门户(批次 2,owner 自用)

- 三域名互不可见,owner 自己跨组只能手敲 URL。为省事另设一个**无任何站内链接指向**的隐藏门户:`MASTER_PORTAL_PATH = '/sanjiao'`(可改)。
- `MasterPortalPage`(`src/features/MasterPortalPage.jsx`):列全部三组卡片(易道/儒/佛),`<a href>` 而非 Router Link——跨域需整页加载。
- `groupEntryHref(group, protocol, hostname)`:当前在生产域名(`HOST_GROUPS[host]` 命中)→ 返回目标组域名的绝对 URL 跨域跳;dev/localhost → 相对路径(`/`、`/fo`、`/ru`)。
- 域名着陆重定向对 `/sanjiao` **豁免**(否则在 con/bud 域名上会被弹回本组首页),门户得以在任一域名打开。

## 2. 佛/儒站脚手架(批次 1)

- registry 各加一条:fo(品牌「观佛」?待定、prefix `/fo`、accent 某色、hasSearch false、nav/mobileNav 经典一项、mobileSwitch false)、ru(同构,prefix `/ru`)。
- 主题:`[data-site="fo"]`/`[data-site="ru"]` 各一主色块(佛取「缁素」一类青灰/赭黄,儒取「朱墨」一类;暂定,可调)。
- 首页书架:仿 DaoHomePage 各一页(`/fo`、`/ru`),读各自 `src/data/{fo,ru}/texts.json` 骨架(书目 status: pending「整理中」)。书目暂拟:儒=论语·孟子·大学·中庸(四书);佛=心经·金刚经·坛经(收窄到文学/思想性强、仪轨少者)。
- 路由:App.jsx 加 fo/ru 的首页路由(经文阅读路由待内容期接 ClassicReader)。

## 3. 内容(后续期,非本期)

- 每家 = 原文管线(仿 fetch-dao)+ 白话译文 + 字词注疏 + 每章延伸 + 书架/阅读页(薄包装 ClassicReader)。**脱锚照 v9 §4;佛站尤须守「研习不宣化、不下吉凶断语」,立意取「佛教与中国思想」视角**。儒先(四书,共识厚)、佛后(收窄三经)。

## 4. 验收(批次 2)

- [ ] 易道门户 {易,道}+切换;佛/儒 solo 无切换、门户无别组、无跨组链接(双向)
- [ ] activeGroup 域名优先、路径兜底;HOST_GROUPS 填真实三域名;着陆重定向锁组
- [ ] 隐藏门户 /sanjiao 列三组卡片、dev 相对 / 生产绝对跨域、着陆重定向豁免
- [ ] 佛/儒「整理中」首页、主题色、移动栏正常;桥不受影响
- [ ] test/build/check-data 全过;CLAUDE.md 三组分站说明;tag 推送
