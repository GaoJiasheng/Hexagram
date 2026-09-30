# hexagram — 观象 · 个人学习站

个人学习站集合,**配置驱动的分站平台**(v14)+ **分组隔离**(v15):十组——易道(易经研习 yijing 默认 + 道藏研读 dao,**门户互切**,因「桥」需同组)/ 儒 ru / 佛 fo / 心 xin / 法 fa / 墨 mo / 兵 bing / 纵横 zong / 医 zhongyi(中医,观和/杏林赭,守「研习不诊疗」铁律)/ 谋 moulue(谋略杂纂,观谋/黯灰紫,《天下无谋》托名伪书 5 部,显著框注「托名·疑现代伪作」、文献批判视角不作权术教程)。**左上角 logo 全站链向总门户 `/hexagram`**(v1.24,owner 全局导航;原「隐藏门户」改为各页可达,跨组隔离遂不再严格——如需恢复硬隔离另加开关)。除易道外每组皆**独立单站、平级**(法墨兵纵横原 v18 拟同「诸子」组互切,v20.1 owner 拍板拆为各自独立组,门户列为平级卡片、不互切)。站点在 `src/sites/registry.js` 注册(含 `group` 字段),加站零改平台代码。**门户只列当前站所属组,跨组零可见链接**(诸组两两不互链);`activeGroup` 域名优先(HOST_GROUPS,用户填真实域名)路径兜底,一份构建多域名指向。组内不互链,唯一切换点是门户(v4 §3);**唯一例外是「桥」(v8,易道组内)**:参同契/阴符经注疏气泡内的卦名可单向跳转易经卦页。纯前端(React 19 + Vite),无后端,用户数据只存 localStorage,可静态托管。**佛/儒/心/诸子经文内容已齐**(儒典四书+孝经+荀子+颜氏家训+近思录、释典十经〔心经/金刚经/坛经+遗教三经〔四十二章经/遗教经/八大人觉经〕+阿弥陀经+禅宗双偈〔信心铭/永嘉证道歌〕+维摩诘经〕、阳明传习录+大学问、诸子十三书〔法墨兵纵横,含六韬+慎子+尹文子+战国策选 18 篇〕、中医六书〔内经选篇/伤寒论/本草经/金匮要略/难经,守研习不诊疗铁律〕全 status done、译注延齐备(v1.23.0,后 v1.33.0 补六韬+金匮);另**谋略杂纂组**收《天下无谋》托名伪书 5 部〔罗织经/小人经/权谋术/韬晦术/止学〕,显著框注「疑现代伪作」、取文献批判视角,v1.24.0)。

## 如何加一个新站(v14 §1·§4)

平台已抽成「壳(manifest)+ 通用阅读器 + registry 管线」,加一家读经类新站(如儒/佛)≈ 纯内容,**不碰平台代码**:
1. `src/sites/registry.js` 加一条 `{key, group, brand, portalTitle, portalDesc, home, prefix, accent, switchLabel, hasSearch, nav, mobileNav, mobileSwitch}`。**group 决定隔离**:与谁同门户填同 group,要独立则单独 group;独立域名访问填 `HOST_GROUPS['域名']='该group'`。
2. `src/index.css` 加 `[data-site="新key"] { --cinnabar: var(--某色) … }` 换肤(主色)。
3. 数据:原文走管线(仿 fetch-dao,抓取源+切片配置写脚本)、白话译文/字词注疏/每章延伸为人工内容;书目元数据仿 `src/data/dao/texts.json`(slug/title/sections/…),check-data 的书单从它派生,加书免改校验。
4. 阅读页:薄包装调 `src/features/reader/ClassicReader.jsx`(paged/single 两模式),传各自 loader/anchors/yanyi/header;首页/书架仿 DaoHomePage。
5. 在 App.jsx 加该站的 `<Route>`(每站页面是各自代码,路由需显式列)。
6. 跑 `check-data`——覆盖仪表自动纳入新书。

## 唯一规格来源

**docs/yijing-design.md(一期 M1–M3)、docs/yijing-design-v2.md(二期 M4–M6)、docs/yijing-design-v3.md(三期 P0–P5)、docs/design-v4.md(四期:注释层/源流/多模块门户与道藏框架)、docs/design-v5.md(五期:经传逐段注疏层)、docs/design-v6.md(六期:道藏内容期)、docs/design-v7.md(七期:道藏译注收官)、docs/design-v8.md(八期:道藏→易经桥)、docs/design-v9.md(九期:筮例与故事)、docs/design-v10.md(十期:工具与交互期)、docs/design-v11.md(十一期:工程打磨期)、docs/design-v12.md(十二期:推演上手引导)、docs/design-v13.md(十三期:道藏单页阅读与每章延伸)、docs/design-v14.md(十四期:分站平台化)、docs/design-v15.md(十五期:三教分站与分组隔离)、docs/design-v16.md(十六期:儒典四书译注与延伸,已实现 v1.17.0)、docs/design-v17.md(十七期:释典三经译注与延伸,v1.18.0)、docs/design-v18.md(十八期:诸子百家——法/墨/兵/纵横,v1.20.x)、docs/design-v19.md(十九期:中医典籍,v1.23.0)、docs/design-v20.md(二十期:谋略杂纂·托名伪书,v1.24.0)与 docs/design-v21.md(二十一期:《赛博·百家争鸣》跨派对辩,v1.51.0 起)是页面、交互、视觉、推演规则、数据结构的唯一规格(以上设计稿对应内容均已落地)。** v2–v4 是增量稿,视觉/组件/数据约定沿用 v1。实现任何页面前先读对应章节,不要自行发明视觉风格或交互;引擎规则(八宫/纳甲/梅花/大衍/金钱卦)必须照设计稿的规则表实现,严禁凭记忆补规则。每个里程碑完成后逐条核对其验收清单。

## 当前状态(随进度更新此节)

> 完整历史(每期做了什么、数字、踩坑经过)一字未删地归档在 `docs/status-archive.md`,「archive §N」= 归档里第 N 条。新进度:在「里程碑一览」按下面的格式加一行,细节追加到归档;新规矩搬进「必守的规矩」对应组。

### 里程碑一览

- [x] 一期 M0–M3 读·推·通(v1.0.0)—— 脚手架/tokens/数据管线、卦总览与详情、推演引擎+工作台、经传阅读/搜索/今日一卦 · 规格 docs/yijing-design.md · 细节 archive §1–§4
- [x] 二期 M4–M6 明·宫·占 —— 术语层与三才爻位、八宫纳甲引擎、梅花易数+学堂改版 · 规格 docs/yijing-design-v2.md · 细节 archive §5–§7
- [x] 三期 P0–P5 读练用体系 —— 金钱卦、工作台六法、学堂七篇、QuizCard、研习进度 · 规格 docs/yijing-design-v3.md · 细节 archive §8
- [x] 四期 —— 64 卦译文全、字词注释层、易学源流页、多模块门户+道藏框架 · 规格 docs/design-v4.md · 细节 archive §9
- [x] 易经内容收官 —— 经传 204 段全译、乾坤文言 35 段、序卦杂卦按卦引文、卦主 64 卦标注 · 细节 archive §10
- [x] 五期 经传逐段注疏层(v1.4.0)+ 六期 道藏内容期(v1.5.0)—— 753 单元 762 锚注;道藏六部原文、道德经全译+190 锚注 · 规格 docs/design-v5.md、docs/design-v6.md · 细节 archive §11–§12
- [x] 八期 道藏→易经桥(v1.7.0)+ 七期 道藏译注收官(v1.6.0)—— 参同契 45+阴符经 1 处单向桥点;五部译注全齐,道藏 562 段/550 锚注 · 规格 docs/design-v8.md、docs/design-v7.md · 细节 archive §13–§14
- [x] 十六期 儒典四书(v1.17.0)+ 十七期 释典三经(v1.18.0)—— 通用 corpus 基建;论孟学庸、心经/金刚经/坛经全译注延 · 规格 docs/design-v16.md、docs/design-v17.md · 细节 archive §15–§16
- [x] 阳明心学组 + 扩书 + 诸子脚手架(v1.19.0)→ 诸子译注延全成(v1.20.0)—— 传习录、孝经、四十二章经;法墨兵纵横九书 ~5058 锚注 · 规格 docs/design-v18.md · 细节 archive §17–§18
- [x] 诸子拆组 + 7 站搜索 + 篇目章名 + 战国策选(v1.20.1→v1.22.0)—— 法墨兵纵横各自独立平级组 · 细节 archive §19
- [x] 中医典籍组(v1.23.0)+ 谋略杂纂组与总门户入口(v1.24.0)—— 素问/灵枢/伤寒论/本草经;《天下无谋》托名伪书 5 部「疑现代伪作」框注 · 规格 docs/design-v19.md、docs/design-v20.md · 细节 archive §20–§21
- [x] 典籍拓展 Wave 1a–5(v1.33.0–v1.36.0)—— 六韬、金匮要略;庄子外杂篇、列子;佛遗教三经/阿弥陀/信心铭/证道歌、大学问;荀子、难经 · 规划 docs/expansion-ideas.md · 细节 archive §22–§25
- [x] 典籍拓展 Wave 6a–6c(v1.37.0–v1.39.0)—— 慎子/尹文子/文子;颜氏家训/近思录;维摩诘经/黄庭内景经 · 细节 archive §26–§28
- [x] 产品/UX/国学三视角审查 + P0 修债(v1.40.0)—— caveat 真伪统一、门户描述派生、道藏续读、TOC 滚入 · 规格 docs/product-ux-review.md · 细节 archive §29
- [x] P1 全站书目索引 + P2 跨组搜索/我的聚合/义理互见锚(v1.41.0–v1.44.0)—— booksIndex.js + concepts.json 共享底座 · 细节 archive §30–§33
- [x] P3/P4 体验传播与义理专题(v1.45.0–v1.50.0)—— 韵文断行、scroll-spy、篇幅档、底本凡例、留存、/concepts、OG+金句卡;review 18 项收官 · 细节 archive §34–§40
- [x] 二十一期 赛博·百家争鸣 批1–5(v1.51.0–v1.55.0)—— 圆桌论辩图谱、每日一辩,47 辩 358 轮 0 坏 cite · 规格 docs/design-v21.md · 细节 archive §41–§45
- [x] 白话打磨 + 注释 tooltip 裁剪修复(v1.58.1–v1.59.0)—— 入口移正文下、总纲章 hero;气泡 portal 出 content-visibility · 细节 archive §46–§47
- [x] 二十三期 上线部署 + 手机 APP 化(v1.63.0)—— Capacitor iOS、TestFlight 一键发版 · 方案 docs/mobile-app-plan.md · 细节 archive §48
- [x] 白话 易经 64 卦一卦一厚文 + 经传十翼 35 章(v1.65.0)—— 易经白话 99 章 0 坏引文 · 细节 archive §49–§50
- [x] 白话 道德经加厚 81 / 纵横 33 / 谋略 44 + 兵 47(v1.66.0–v1.68.0)—— 按书加厚 THICK_BOOKS、iOS 浮层安全区 · 细节 archive §51–§53
- [x] 白话/搜索改构建期拆分 + 全站统一搜索 —— `public/content/` 分片懒加载、`GlobalSearchPalette` 恒全站 · 细节 archive §54
- [x] 白话 兵 107 / 墨 42 / 法 89 收官 —— 白话目标 811/811 · 细节 archive §55–§57
- [x] 白话 Phase B+C 四教全本 —— 道/儒/佛/阳明 397 章,`baihua-step.mjs` 串行自驱 · 计划 docs/baihua-plan-next.md · 细节 archive §58
- [x] 白话 Phase A 基建收口(v1.60.0)+ 白话模块基建与道德经第一章样板(v1.58.0)—— 抽屉/整页路由/check-data 白话校验/生产管线 · 规格 docs/design-v22.md · 细节 archive §59–§60
- [x] 门户书架 5 列矩阵 + 门类题签(2026-09-30)—— FAMILIES 题签、首页争鸣段与索引段(原记「未上线,预览分支 preview-portal」,以线上为准) · 细节 archive §61
- [x] 总门户视觉重塑 + 易/道入口去深(v1.56.0–v1.57.1)—— 组色印章、易道太极桥、Nav 直达互切 · 细节 archive §62–§63
- [x] 全站功能/交互/逻辑优化 批 A–E(v1.25.0)—— 移动端读经、PWA 稳健、路由、搜索一致性 · 规格 docs/ux-review.md · 细节 archive §64
- [x] 全站易用性三层 Tier 0–2(v1.26.0→v1.29.0)—— 设置浮层、翻章/对照/错题重练、读经站「记」体系与 /me · 规格 docs/ux-opportunities.md · 细节 archive §65
- [x] 十五期 三教分站与分组隔离(v1.16.0→v1.16.1)—— registry group、HOST_GROUPS、ScriptureShelf · 规格 docs/design-v15.md · 细节 archive §66
- [x] 十四期 分站平台化(v1.15.0)—— registry manifest、[data-site] 主题、通用 ClassicReader · 规格 docs/design-v14.md · 细节 archive §67
- [x] 十三期 道藏单页阅读与每章延伸(v1.13.0→v1.14.0)+ 十二期 推演上手引导(v1.12.1→v1.13.0)+ 解卦三层(v1.11.0→v1.12.0)—— DaoSinglePage、yanyi.json;步骤条/示范一卦/推演入门篇;断卦卡叠传文与注疏 · 规格 docs/design-v13.md、docs/design-v12.md · 细节 archive §68–§70
- [x] 十一期 工程打磨(v1.10.0)+ 十期 工具与交互(v1.9.0)—— 字体自托管/懒加载/usePageTitle;全局搜索、验占闭环、卦画闪卡、先天方圆图、PWA · 规格 docs/design-v11.md、docs/design-v10.md · 细节 archive §71–§72
- [x] 九期 筮例与故事(v1.8.0)—— 春秋筮例 21、爻辞史事 8 节、易学十家 · 规格 docs/design-v9.md · 细节 archive §73
- [x] 观书·私人书房(隐藏入口 `/books`)—— 站外书的封面/脑图/总览/分章文章,iOS 长按快捷入口 · SOP docs/books-production-standard.md · 设计 docs/study-feature-design.md · 细节 archive §74
- [x] 白话 中医黄帝内经素问 15 + 灵枢 8 —— 此后伤寒/本草/金匮也铺,难经封关 · 细节 archive §75
- [x] 典籍拓展 Wave 7 —— 诗经 305 首(groupPages)、悟真篇 · 细节 archive §76
- [x] 白话富文本化 v22.1 —— list/callout/pull/steps 四种块,存量 1849 篇机械重分块逐字一致 · 规格 docs/design-v22.md §3.3b · 路线 docs/richtext-rollout.md · 细节 archive §77
- [x] 典籍拓展 Wave 8 —— 长短经、菜根谭/围炉夜话/小窗幽记(谋略真书)、李卫公问对(武经七书全),三层皆做 · 细节 archive §78
- [x] 白话 诗经诗级精选 79 首 —— 一首诗一篇(组-序键),其后铺满 305/305、悟真 6/6 · 细节 archive §79
- [x] 家级导读「一家之来路」十篇(2026-08-02)—— 一组一篇讲书与人之间的来路 · SOP docs/school-intro-standard.md · 细节 archive §80
- [x] 全站时间轴 `/timeline` + 每日一辩挪位(2026-09-25)—— 朝代等宽横轴,书+人物两层 · 细节 archive §81
- [x] 全站人物志 `/renwu`(2026-09-25)—— 61 人一人一条,时间轴人物层改读 renwu.json · 细节 archive §82
- [x] 二十四期 全站交互化 I4–I13(2026-09-30)—— 储说经说联动、论语弟子索引、月相纳甲盘、佛名相、儒门学脉、庄子寓言、格律层、国风图、战国七国图 · 规格 docs/design-v24.md · 排期 docs/interactive-plan.md · 细节 archive §83
- [x] 易经首页改版 + 两层导读(2026-10-01,owner review)—— 去今日一卦/道藏入口,四模块首页展开;家级「易学的来路」(Fable 手写 11000 字:经/传 · 象数/义理 · 占/学三对张力,不重排源流页年表)+ 书级「《周易》的前世今生」(7300 字);check-data 导读引文闸认 `cite.slug:'hexagrams'`(ch=卦序);路由 `/yijing/school` `/yijing/zhouyi/daodu`(一站一书,slug 由路由传)· SOP docs/school-intro-standard.md 易经节
- [x] 古文研读组(第十六组 `guwen`,观文/绛紫,集部第四组,2026-10-01「老师首次打开」T6,owner 定)—— **一组两本书**:《古文观止》222 篇(维基文库卷页 splitHeadings,管线新选项 `dropSpaceLines` 剔篇末吴氏总评 / `stripInnerSpaces` 去夹注残留空格 / `splitLongParas` 长篇按句末分段 / `chapterMeta` 并出处;`gen-guwen-meta.mjs` 从目录页推导 12 卷 222 篇 + 出处)+「课本古文补编」23 篇(本站按统编版初高中课本选目、非传世选本,`excerpts` 摘录模式:起止标记/整页/joinLines/charMap;preResolve 解包 專/參/YL/命名空间管道链接;owner 定:不收史记与人物传记、礼记二则,加与妻书、洛神赋)。三层:译注延全成(opus 译 + opus/sonnet 校,0 丢弃锚点)、家级导读「这本选本是怎么编出来的」(C 类,选本谱系非流派史)+ 两篇书级导读、白话全铺中(起草校对皆 opus,课本 46 篇先行,余由 baihua-step 自驱 CAP 24)。首页 SingleBookHome `volumes` 按卷分组 + `beforeToc` 插槽把补编按学段列在前、篇题旁标出处;阅读页 `chapterSub` 题下显「出自《左传》」「王勃」。**全站索引已同步**:名句集 79 条(`mingju-extra/guwen.json` 人工选目,底本异文如实)、时间轴两书 + 人物志二吴、义理专题(原道→仁与四端、尊经阁记→心之本体)、关于页底本凡例、新收 feed/搜索/og/书目/篇幅档(构建期自动)。课本篇目盘点 `docs/guwen-textbook-list.md`。owner 10-01 定:课本索引页不做、孙权劝学不去;白话由 baihua-step 自驱续铺(59/245,周额度到线暂停)。
- [x] 老师首次打开 + 古文研读组 + 研读统计(2026-10-01)—— T4 首屏文案/T7 触屏段钮/T9 构建期计数;**古文组 `guwen`**(观文/绛紫,《古文观止》222 篇 + 课本古文补编 23 篇 excerpts 摘录,译注延导读全成,白话铺至 59/245 由 `baihua-step.mjs` 自驱续);跋「说明」挪位、logo 朱砂、联系邮箱统一 hexa@gavin.pub、正文衬线阅读页按需加载、顶栏「跋」;**研读统计**:`src/features/reading/readClock.js` 活跃时长时钟(可见 + 60 秒内有操作,单次封顶 1800 秒)→ 本机 `readDays`(入云同步,键 `day|corpus|slug|ch|dev`)/`readRecent`(本机)/匿名 beat 三处消费,`/stats` 中立页 + 设置浮层三数 + 账号开关「把我的研读时长计入账号」(默认开,关 → `DELETE /api/me/reading`)+ 各组 /me 一行,后台 `/admin/stats?window=` 加活跃/回访/中位数/直方图/按时长 Top + `/admin/readers(/:id)` 读者栏(不显示邮箱);隐私页 §五 · 方案 docs/reading-stats-plan.md §7 · 清单 docs/teacher-first-visit-plan.md · 细节 docs/todo.md ⏸ 与 R'
- [x] 中医三件 + 可选件三件 + 扩展区字根治 ①(2026-10-01 深夜,owner 定)—— **I1–I3**:本草六部三品矩阵 `/zhongyi/bencaojing/matrix`(十八类题名派生,格内药名从段首切,零策展)、素问五行藏象图 `/zhongyi/suwen/zangxiang`(《阴阳应象大论》五段排比 15 行 × 5,每格 kw 回查)、伤寒六经目录 `/zhongyi/shanghanlun/liujing`(22 篇归六经 + 三组,受病次第引《伤寒例》);一闸 `check-zhongyi-shapes`。**I14–I16**:人物索引推广到孟子(53 人)/ 传习录(24 人,短称呼格 + `?p=` 落屏)——派生器抽 `scripts/lib/people-index.mjs`、页抽 `ru/PeopleIndexPage.jsx`,论语输出逐字不变;禅宗传灯图 `/fo/lineage`(儒门学脉图视图抽 `ru/LineageView.jsx`,`fo-lineage.json` 15 人 17 边 25 引文全出《坛经》);唐诗体裁 × 诗人矩阵 `/tangshi/tangshi300/matrix`(诗人从抓取缓存诗页 `author` 派生,77 家 320 首)。**O12 ①**:`t2s` 保留简体落在 BMP 外的繁体原字(蹻 駉 鑪 絺…155 字 492 处,逐字试转判定),存量以映射脚本改字、不重抓 · 规格 docs/design-v24.md §13–§14 · 细节 docs/todo.md R'
- [ ] 观数 · 命理典籍研读组(第十五组 `mingli`,2026-09-19 立项)—— 八字命理知识学习站(非算命站):核心四书 + 源头四书 + 三命通会 原文/译注延/导读/白话,ganzhi 底座、9 个 widget、调候矩阵/格局流程/命例走读/歌诀卡/概念索引/学堂/排盘台;
  2026-09-30 内容全部收官(原记待 owner review → 上生产 / 发 iOS,进度以 `docs/todo.md` 为准) · 规格 docs/design-v23.md · 全量 TODO docs/todo.md §0.1 · 细节 archive §84

### 改内容 / 加东西必守的规矩(按组)

> 均为原各条加粗规则的原句搬运(同义重复已合并);〔〕里是本次归档时加的注。出处与来由查 archive。
- **通用(各组内容)**:底本一律取流传最广通行本;装配 term 须原文精确子串、note≤40、段数对齐,违规即弃;同一 slug 分批跑必须把所有批次单元合并成一份 result 一次性装配〔补译个别章用 `--merge`,见「工程上踩过的坑」〕
- 教训:勿两大 workflow 齐发,Wave 6 起串行/小批。(单 workflow 无限流——印证「勿两大齐发」)
- 经验:维基「全覽/合页」常为转写壳(`{{:子页}}`),正文须抓分章子页;新分章书源页格式抽样几个不够,需扫全部缓存页头衔统计交叉核对(`scripts/.cache/wikisource.json` 逐页头衔频次分布)才放心排除遗漏;新分章书的校勘记/脚注若以 `[数字]` 格式混入,cleanLine 已自动剔除;改/扩儒守思想史、中医守研习不诊疗,逐批 check-data 过才 commit
- 加书后重跑 `node scripts/gen-book-sizes.mjs` 纳入篇幅档;加书须补一条 json(`src/data/timeline.json`);新读经站/书自动纳入(booksIndex 派生);足迹键已在 storage 导出白名单;B2 概念互见锚(精选 30–50 处)、B1 跨组搜索、B3 我的聚合待后续批次;新加书/别名改 EXTRA_ALIASES,全站书目自动纳入〔B1–B3 已于 v1.42–v1.44 落地〕
- 真伪标记:texts.json 中性 `caveat` 字段 → `.caveat-badge`(弱灰,区别谋略 `dubious` 强批判红);门户卡片描述从 texts.json 派生——根治「加书忘改 portalDesc」
- **易经**:修订注疏照 v5 §5 风格规范,改完必过 check-data;断卦卡只释卦象不断吉凶(守 §9 禁算命口吻);新增起卦法/断法须同步更新推演入门篇与步骤条语义;圆图方图布列照 v10 §5 规则表,配单测
- 筮例原文走摘录式管线 scripts/fetch-shili.mjs(标点各公不一,严禁手改原文);筮例/史事/人物的脱锚叙述照 v9 §4 四级分级(共识直写/考证标出处/存疑明示/宁缺毋滥);check-data 校验筮例≥19·史事卦爻位·人物≥10 家;易学十家站内互指链接禁入 /dao〔九期旧约;放弃硬隔离后未见明文撤销,存疑保留〕
- 易经白话 owner 五条加厚要求:① 一卦一厚文(六爻逐爻铺)② 三传必含(彖/大象/小象/乾坤文言逐节)③ 周边关联织网(序卦杂卦/错综卦变/卦主/筮例/史事/成语典故)④ 更白更多生活实例 ⑤ 每卦 5–8 图;长短分流(owner):短经全文逐句、长经分段摘录精华句(gen 按 `u.chars>=1500` 自动切)
- 家级导读易经不做(学堂/源流页/人物志已覆盖)
- **道藏**:修订工序照 v6 §4–§5 与 v7 §2 分书风格,改完必过 check-data;新增/改延伸照 v9 §4,改完必过 check-data;新增桥点照 v8 §2 规则(仅道藏侧、段内首次出现、不与既有锚点重叠);check-data 校验 hex 1–64、易经侧禁用桥字段
- 改/扩道藏内容守 v9 §4(讲思想/寓言/源流不作信仰宣化吉凶断语)、注疏无 ref(模块不互链)、列子真伪如实存疑,逐批 check-data 过才 commit;`TIELU_DAO`:不宗教宣化、不下吉凶/福报/成仙断语、不演内丹工法;黄庭丹道隐语直译、不演工法、不下成仙断语
- dao 新书走 fetch-dao 管线(非 corpus),`gen-zhuzi-wf` dao 分支 + `assemble-newtexts.mjs` 直接复用;装配后 re-run fetch-dao 合译文进 classics、`daoAnchored.js` 加 import
- **佛**:改佛内容守 §0 铁律,逐批 check-data 过才 commit(v17 §0:研习不宣化、不下吉凶/果报断语);改/扩佛内容守研习不宣化铁律(不下果报/往生劝信)、心学不作鸡汤,逐批 check-data 过才 commit;`TIELU_FO`:不劝皈信
- 经文内容接入照 v9 §4,佛站守研习不宣化、不下吉凶断语;加新站照头部「如何加一个新站」并按 group 隔离〔硬隔离已于 v1.24/v1.25 放弃,group 字段仍在用〕
- **儒**:改儒内容照 v16 分书风格(朱熹《四书章句集注》为主流),逐批 check-data 过才 commit;荀子思想史视角、如实呈现不作现代借用;守儒家思想史(颜氏注时代局限不作现代育儿/成功学、近思录提要标注本所加)
- 诗经:《毛诗序》与今人读法一律并陈不裁断(其余见「诗词曲」)
- **心(阳明)**:心学思想史视角、不作成功学/鸡汤发挥(即佛条「心学不作鸡汤」)
- **诸子(法墨兵纵横谋略)**:规格 docs/design-v18(诸子)、design-v19(中医)为计划稿;诸子守思想史视角不作政治影射/权术教程,中医守「研习不诊疗」铁律〔两稿均已落地〕;守思想史铁律:如实呈现法家严刻/纵横机变,不作现代政治影射、不作权术教程。改诸子内容守此铁律,逐批 check-data 过才 commit
- 法:守铁律:法不作权术教程/政治影射、道藏不宣化、真伪如实(慎子辑补、尹文子伪托疑、文子定州汉简);法家白话译白其严刑峻法/驭民面目,但批判性框注守到位(「看穿而非学用」)
- 兵:守思想史/治国视角,不作兵法实操;纵横:鬼谷子白话纵横红线守牢(借框架照见自身、看穿不教用、「乱世标本非处世信条」)
- 谋略·伪书 5 部:改谋略内容守伪书批判铁律(不为伪书张目/不教施用),逐批 check-data 过才 commit;`TIELU_MOU`:译文照译其权术面目、延伸批判性标真伪并指其偷换史实/泯善恶、绝不作权术教程;texts.json `dubious:true` → 「⚠ 托名·疑现代伪作」徽标;白话全程守伪书批判最严红线(每章点破托名、拆其偷换,伪书手法图标「⚠ 揭示防范非教施用」,绝不为伪书张目)
- 谋略·真书(长短经/菜根谭/围炉夜话/小窗幽记):owner 明确要求不套伪书批判框架——`texts.json` 均不置 `dubious`,`gen-zhuzi-wf.mjs`/`gen-baihua-wf.mjs` 按书名 allowlist(`MOULUE_REAL_BOOKS`/`MOULUE_FAKE_BOOKS`)分派两套红线(真书取思想史/处世研习视角,伪书仍守批判框架)
- **中医**:改中医内容守研习不诊疗铁律,逐批 check-data 过才 commit。守 v19 §0「研习不诊疗」铁律(首页+各书小传「⚠ 非医疗建议」声明;本草经「主治…」、伤寒论方剂属原典照译,但注疏/延伸不述功效用法用量、不下病症/疗效断语、不教自疗)
- 金匮守研习不诊疗铁律(方剂照原典录,注疏/延伸只作字词训诂、医史源流,不述功效用法用量、不下疗效断语;延伸均带「宜作医史文献训读、非为对照自诊」);伤寒/金匮方剂只录名
- 白话:难经 81 章 owner 定不铺(封关)〔素问/灵枢/伤寒/本草/金匮已铺〕;争鸣中医不入场;中医 I1–I3(本草矩阵 / 素问藏象图 / 伤寒六经目录)2026-10-01 已做:只排原书结构、每格挂原文、不画传变路径、不述功效,页带「⚠ 非医疗建议」(design-v24 §13)
- **古文**:文章学与文献研习视角(`TIELU_WEN`/`RED.guwen`):不作心灵鸡汤/励志格言/人生启示,史传文不作现代政治影射,论说文不替古人站队;补编照原文全录不依课本删节,底本与课本异文在延伸/导读里如实标出;名句集选目须为底本精确子串(底本作「宁知白首之心」「逸豫可以忘身」即照录)
- **诗词曲**:诗体新书设 `verse:true` 即生效(dao 已接;corpus 走 CorpusReadPage 时同样一行 `verse={!!meta.verse}` 待接)〔corpus 已于 v1.50.0 接上〕
- 格律层(I10):只标韵书所记不判出律,多音字 ◐,韵书开开关才动态载
- 诗经:`texts.json` 设 `poemTitles`+`verse`;诗题段升格「诗头」不占段号;无该首白话则不渲染,故精选模式天然自标;同名诗以 `section` 关键字消歧,过滤字须过 t2s 简化;十五国风图凡例「示意非考古地图」
- **观数(mingli)**:组铁律「研习不断命」:原典断语照录照译、不删不讳;我方文字(注疏/延伸/白话/学堂/各交互件的说明)只讲「书里怎么说、为什么这么说」,不为之背书、不教人套用;工具只排结构、不出判断;各家说法不一之处(阴阳生死、子时换日、真太阳时、穷通自身前后出入的 13 格)给开关、标出来,不拍板
- 改/扩观数内容守「研习不断命」铁律;命例/矩阵/概念/走读四类策展数据各有校验闸(`scripts/lib/mingli-*.mjs`),逐批 check-data 过才 commit。
- 底座:口诀用《三命通会》原文而非坊间流传版;`geju.js` 单测以原书自举之例为验;加一个 widget = schema.js 登记校验 → WidgetBlock 登记懒加载 → design-v23 §5 补 props 契约;管线只写参数不画图,参数错了机器查得出
- 概念索引每个落点挂 `kw` 由 check-data 回查原文;学堂正文里的可算断言全部由引擎验过;三派镜头只摆入手处不裁断;排盘台只排结构,不存不传;四库白文走断句层(标点当编辑内容另存,逐段核「去标点后与底本逐字相等」);整组要再藏,registry 加回 `portalHidden: true` 一行即可
- 续跑工具:`gen-zhuzi-wf.mjs --bundle=3200` 小篇合包 · `scripts/check-unit.mjs` / `check-baihua-draft.mjs` / `check-daodu-draft.mjs` 给代理的自查尺子 · `fetch-corpus` 的 `joinParas` · `scripts/salvage-baihua.mjs` 救「只交说明」的单元;续跑办法见 `docs/todo.md` §0.1
- **观书(`/books`)**:中立外壳(`data-site="portal"`,隐藏入口、不入数据导入导出/公共搜索、与读经诸站互不链接);书内朱色、金句竖条须用 `--cinnabar-pure`(那里 `--cinnabar` 被 muted)
- 版权红线:原书全文绝不入库、文章原创消化非全文复制、引文 `quote.original` ≤100字/条且 ≤16条/篇(目前人工把关,不走 check-data);生成式书封颜色写死不随明暗反色,零版权:不用任何出版社封面素材
- 做新书唯一作业标准(SOP)见 `docs/books-production-standard.md`;产品设计 `docs/study-feature-design.md`。加新书照 SOP 十步清单,新母题在 BookCover 加 motif 分支。
- **白话通用**:owner 已定:亲民名 + 朱印图标、5000–10000字含逐句(短章可降)、配图金句卡每章必出+结构列举按内容+时间线仅有流变、折叠入口+侧抽屉+整页研读。续:批量 workflow(起草→制图→校对→编者)+ check-data 校验(脊柱/引文子串/红线/图锚对应)+ 整页路由〔「续」部分均已落地〕
- 入口在章末「原文→注疏→延伸→白话」最末位;新「封面级」章:数据加 `hero`+`featured` 即获特殊视觉(其他章不受影响);figure SVG 用 `style` 上色不用 `fill` 属
- 生产 `gen-baihua-wf.mjs` → `assemble-baihua.mjs` → check-data;逐书加厚列 `THICK_BOOKS`;教训:缩范围前若已清了书,须 `git checkout <tag> -- 该书 baihua` 恢复;改/扩白话后须 `npm run content:build`(或 build/dev 自动跑)重生小文件;加新 corpus 站搜索自动纳入。
- 引文:坏引文章一律丢弃(Phase B+C)〔Phase D 起改为「剔坏引文块·保整章」,仅 0 有效引文才整章重生〕;引文一律脚本切片不手打;细粒度(组-序/卷-序)白话引文校验池收窄到单首;每波须人读抽查一篇
- workflow:串行铁律(并行多 workflow 必撞限流),串行铁律仍守;服务端限流(not your usage limit)→ ① 个别章校对被限→回退起草版 salvage ② 整批空转→重跑 ③ 降并发(CAP 14→6);撞会话用量上限→relaunch 同 scratch 续跑;坑:后台 workflow 会被用户新消息中断 → 串行跑时尽量等批次完成;并发代理改「各写独立分片文件、主会话合并前逐片校验」
- 富文本块 v22.1(canonical 规格在 `docs/design-v22.md` §3.3b;观书文章复用同一渲染器):`pull` 每章至多 1 处;铁律:重新分块时正文一个字不许改写(`scripts/verify-reblock.mjs` 逐字比对);改后文件若已覆盖回原位必须显式传改前文件;唯一允许新写的字段是 `callout.label`(≤12 字)——坑:label 一豁免,模型此前「把原文整句搬进 label」的做法就等于删字,正确做法是句子留在 items、label 另写;正文已自报家门(「打个比方：」开头)就不挂签;list 不收「『词』——解释」那类连续段;护栏的记号归一必须全局对称,数字那支必须带标点,否则散文里的数字被吃掉;`check-data` 校验 pull ≤1/章、label ≤12 字、新块不许空;摘金句时 `**` 必须成对,否则留字面量 `**`;落款印章一律 `--cinnabar-pure` 暖红(不随主题/分站变色)
- **跨组内容(争鸣 / 概念 / 导读 / 时间轴 / 人物志)**:争鸣:离线、不评输赢、中医/谋略不入场、每句锚真原文;check-data 守 cite 子串校验、禁中医/谋略入场、rebut 合法、轮数 ≤100、论点无胜负词、index 一致;每 turn 引文先 grep 坐实为该章原文精确子串再写;再加辩:写 `<id>.json`→index 补 topic→check-data;批量则 `gen-debates` workflow + `assemble-debates.mjs`;index topic 须带 `concept` 字段;每日一辩弹窗只在进入百家争鸣(`/debates`)时弹
- 概念(`concepts.json`):显式人工策展、只在经典互指处给跳转,不泛滥自动链;所有 locus 均经原文 grep 验证含该概念;新增聚类务必 grep 确认目标章确含概念、取最经典之篇;concepts.json 后续复用于义理专题(#150)、术语表(#151);扩 concepts.json 聚类即自动增专题/术语条目(义理互见、术语表、专题三处同步)
- 家级导读(SOP `docs/school-intro-standard.md`):分三类不一个模子;C 不成「家」,题目必须换;谋略→「这个类目是怎么被编出来的」,绝不能写成流派史;体裁是散文(`callout`/`list`/`steps` 一律不用、`pull` ≤1、小标题意象化);og/搜索 kind 用中文「导读」「来路」;check-links 的两条新路由必须排在 `/<组>/<slug>` 之前;教训:机器校验一条事实错误都抓不到;扩这一层务必人读一遍。
- 时间轴/人物志:一书一条;只写各书撰人小传与 SOURCES.md 已交代过的事,拿不准的确数不给;托名伪作 `pseudo` 不上轴;加人:补一条 json 即上时间轴与人物志;书目每一部的撰人若不在,不强求。易学十家以 `yijing:'<id>'` 引用、小传不重写
- **交互化(二十四期)**:加同类件:照 design-v24 §0 三步(自己的文件 + 闸模块 + 主会话接线);共享文件(App 路由 / schema·WidgetBlock 登记 / check-data 闸挂载点 7f / check-links / og 索引 / texts.json `shape` / registry nav)由主会话接;闸模块 `scripts/lib/check-<name>.mjs` 默认导出 `check(ctx)`,7f 段自动挂载
- 佛名相各经分歧并陈不裁断;庄子寓言「后人概括」如实标;战国策年代只据篇中人物在位推定;拆屏链接首屏也显式带 `?p=1`
- 人物索引再推广一本书 = 一份人名表脚本(`gen-<book>-people.mjs`,派生走 `scripts/lib/people-index.mjs`,短称呼格字集按书给)+ 薄包装页(`PeopleIndexPage` 的 `spec`)+ 薄包装闸;学脉 / 传灯类图再加一份 = 一份 `*-lineage.json` + `LineageView` 薄包装 + `checkLineage` 薄包装;禅宗传灯图只画《坛经》本文写到的人,灯录之事只进说明
- 新增页面/重交互组件:互动信息勿仅挂 hover(补 click/键盘);新读经站搜索由 registry `searchKind` 驱动;长页优先 content-visibility;新增懒加载页天然受 ErrorBoundary 兜底〔`searchKind` 已不驱动面板:现为全站统一 `GlobalSearchPalette`,registry `hasSearch` 只管显不显搜索钮〕
- **平台工程(部署 / PWA / 搜索 / check-data / 阅读器)**:加新站照 CLAUDE.md 头部「如何加一个新站」六步,平台代码零改动;新增页面必须接 usePageTitle;新增重数据组件优先懒加载;新增设置项加 `DEFAULT_SETTINGS`+白名单;读经新交互走 markCtx 锚;新读经站自动获 /me(App 路由表数组加 key)
- 阅读器:新单页长经自动获 scroll-spy(走 ClassicReader single 模式即可);新读经站走 ClassicReader 即自动获金句卡;OG:index.html 只有站点级 og,逐页 og 由 `functions/_middleware.js` 对爬虫 UA 用 HTMLRewriter 注入(按路径哈希取 `/content/og/<n>.json` 分片,哈希与 `server/og-index.js` 逐字一致);普通浏览器看到站点级是设计如此;新读经站 disclaimer 走 ScriptureShelf prop;备份/里程碑各 /me 自动生效(走 getStudyStats);新读经站默认接搜索(hasSearch+CORPUS_SEARCH_SITES);新分章书篇目自动显示 title〔CORPUS_SEARCH_SITES 已随统一搜索删除,只剩 hasSearch〕
- 门户:`FAMILIES` 只是门户呈现分组,不动 registry `group`,新组不在表里落「其他」;组卡片印章/悬停色走 registry.accent;恰两站的组(易道)手机底栏切换项直达另一站〔桌面右上角的切换钮 2026-10-01 按 owner 意见已去掉〕
- 前端:勿用 rAF——headless 后台 rAF 被节流;勿依赖 RR `<Link>` 的 ref 转发;教训:content-visibility:auto 的 paint 包含会裁溢出子元素——浮层/tooltip 必须 portal 出去或保证落在元素框内(横向溢出安全、纵向溢出被裁);弹窗经 `createPortal` 渲染到 `document.body`
- 内容资源:`src/data/*/baihua/*.json` 仍是唯一真源,`public/content/` 是构建产物(gitignore);搜索恒全站(原「本站/全站」开关取消)
- 云同步:**客户端 `DATA_KEYS` 加键必须同步加到 `functions/api/[[route]].js` 的 `DATA_KEYS`(并归 SCALAR / MAP)**,服务端见未知键整包 400、云同步静默失效(`readPos` 2026-07-30 漏加,到 10-01 才发现);研读统计只读 `readDays`,匿名 beat 的 cid 与账号永不相连;`baihua-step.mjs` 会 `git add -A`,工作区有未提交的代码改动时先 stash 再跑
- 部署:改 web 代码后上线 = `npm run build` → `npx wrangler pages deploy dist --project-name=hexa-gavin-pub`(owner 2026-07-14 改口用 CLI,不再拖后台;阿里云 `./deploy.sh` 已废弃);改完发 iOS 新版 `./ship-ios.sh`〔发不发等 owner 开口;详见「部署」节〕
- iOS:Capacitor 构建 `VITE_CAP=1` 禁用 PWA service worker(SW 冲突致白屏);`altool` 上传成功的 build 只是 VALID,不会自动进 TestFlight 测试组 → 用户列表里看不到、装不了,故 `ship-ios.sh` 末尾 `node scripts/tf-attach.mjs` 自动加内部测试组,漏发可手动 `node scripts/tf-attach.mjs <build号>` 补加;加原生插件后须 `cap sync ios` + 重发版 `./ship-ios.sh` 才到 owner 手机

- **已废止(原文只留 archive)**:阿里云云主机 + `./deploy.sh` 一键发布(§48)→ Cloudflare Pages / wrangler;搜索「默认本站(隔离保留),全站为 opt-in,与 owner「放弃硬隔离」一致;新 corpus 站自动纳入 ALL_CORPORA 需手加键」、「易经走自己的 SearchPalette 暂不并入」、daoSearch 动态 import 分 chunk(§31)→ 全站统一搜索(§54)
- 十五期「佛/儒各为独立单站组,与易道·彼此两两零可见链接」「隐藏门户」(§66)→ 放弃硬隔离,`/hexagram` 现跳 `/`;门户「`--portal-card-w` 等宽等高 3 列」「多站组独占一行横幅」(§62–§63)→ 5 列矩阵(§61)
- 「中医 169 章 owner 定不铺」(§57)→ 后补铺素问/灵枢/伤寒/本草/金匮,仅难经封关;诗经/悟真「白话层按 owner 指示暂不铺」(§76)→ 已铺满

## 工程上踩过的坑(会重复踩的那几个)

- **整站重抓原文会把管线后来的改动一并带进旧书**(2026-10-01 扩展区字根治时踩到):`fetch-corpus` 全跑一遍,诗经冒出「缩略图|雎鸠」(文件链接残留)、慎子多出「元緆」、悟真篇序多出年号、三命通会断句层因用字不同而整段失配……
  **改字一类的全局订正走映射脚本直接改生成物,不重抓**;真要重抓,逐书 `git diff` 核对只有预期变化再收。`t2s` 现保留简体落在 BMP 外的繁体原字(`keptTraditional()` 可列),新抓的书自动如此。
- **`requestAnimationFrame` 在 headless/后台标签页会被节流**,用它做节流的逻辑会**静默失效**。
  已踩两次:目录自动滚入视野(#138)、段级续读记位。**一律改时间戳节流**。
- **Hook 必须在任何提前 `return` 之前**。`useSearchParams` 插在 `if (loading) return` 之后
  → `Rendered more hooks than during the previous render`、整页白屏。
- **`content-visibility:auto` 的 paint 包含会裁掉溢出子元素**。浮层/tooltip 必须 `createPortal`
  出去,或保证落在元素框内(横向溢出安全、纵向溢出被裁)。
- **SVG 的 presentation 属性不认 `var()`**。着色只能写 `style="fill:var(--x)"`,
  不能 `fill="var(--x)"` 也不能写死 `#hex`。
- **繁简转换的先后顺序**:管线里剔除标记要在 `t2s()` **之后**做——源页是繁体,
  在转简前匹配简体字命不中(《北风》韵脚标注踩过)。
- **macOS 文件系统大小写不敏感**:`docs/TODO.md` 与 `docs/todo.md` 是同一文件,
  git 追踪的是小写名,`git add docs/TODO.md` 会什么都没暂存。
- **改数据要改真源不改生成物**:译文真源在 `scripts/authored/<corpus>-translations.json`,
  只改 `src/data/*/classics/*.json` 会被下次 `fetch-corpus` 覆盖。
- **PWA 旧版缓存(2026-09-30 已治)**:autoUpdate 只让新 SW 接管,已打开的页面仍跑旧版,不刷新永远是上一版——`src/pwaUpdate.js` 在 controllerchange 后自动 reload(刚打开即刷、读到一半等下一次站内导航 / 回到标签页,60s 防环),并 30 分钟 + 回标签页时 `reg.update()`。**慢网超时不需要额外逻辑**:更新全在后台,拿不到就照旧用缓存里的旧文件。review 预览域名若仍看到旧版,是首次安装 SW 那一次,再刷一次即可。 **两处补丁(2026-10-01 预览分支两轮实测)**:① `FRESH_MS` 4s→15s——sw.js 拉取 + 预缓存 + 激活常超 4s,刚打开的页会被误判成「读到一半」而不刷;② `index.html` 加一段**经典脚本**「入口模块自愈」:老访客回来时旧 SW 用预缓存的旧 index 起页,其入口 chunk 已不在服务器(404→SPA 回退 HTML→MIME 错)→ 入口模块根本没执行,main.jsx 里所有自愈都跑不到,页面永远空白;该脚本捕获入口 script 的 error → 催 SW 更新 → controllerchange 即重载(4s 兜底),sessionStorage 防环。**发版后老 PWA 客户端的三种状态都验过**:入口失效(自愈重载)、刚打开(15s 内换新包)、读到一半(等下一次导航)。**已在 preview-portal 实测两条路径**(2026-09-30,连发三包):刚打开的页 ≈2s 内自动刷到新包;读到一半的页 controllerchange 后原地不动,点站内链接那一刻刷新、落在新包且 URL 不丢。
- **部署「退出码 0」不等于上线了。** 2026-08-19 后台跑的 `wrangler pages deploy` 报了
  exit 0,但 `wrangler pages deployment list` 里最新一条仍是两天前 —— 线上一直在发旧包。
  **发完必须核对线上与本地的入口 bundle 哈希**:
  `curl -s https://hexa.gavin.pub/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
  与 `dist/index.html` 里那行一致才算发出去了。同理,`/content/books/` 线上返回 404
  **是对的**(观书改管理员专属后走边缘鉴权,`functions/_middleware.test.js` 有断言),
  别把它当成部署缺文件。

- **「通读一遍 + 敏感词扫描」查不出被剥掉标签的评注。** 2026-09-19 观数组:殆知阁本《子平真诠》经通读与版权词表扫描判为「基本是沈孝瞻原文」,
  其实夹着民国徐乐吾《评注》一系的整篇又十二段(含著名的「取用之法约略归纳为五种」)——是读库时偶然看出语气不对才发现的,
  此时译注延已经跑完。**非维基文库的电子本,入库前必须找独立的白文本逐段对校**(只留汉字、对每段取若干 8 字窗看命中比,
  脚本十几行);找不到第二见证本的宁可不收。做法与结论记在 `scripts/sources/mingli/SOURCES.md`,check-data 另设指纹闸防回潮。
- **底本里的碎行会把译注代理整单元带偏一段。** 穷通宝鉴把命例排成横表(「时日月年」/天干行/地支行,案语还和下一表头粘在同一段),
  装配器只核「译文条数 = 段数」,查不出**整段错位**(第 i 条译的是第 i-1 段)。治本是在管线里把碎行结构化(`mergeCaseTables`),
  兜底是 check-data 的「译文对位探测」(长正文配空译/过短译、短标题配长译,连着出现即疑错位)。**结构怪的底本先修结构,再开译。**
- **补译/重译个别章,装配要带 `--merge`。** `assemble-newtexts.mjs` 默认按 slug 整体覆写;`--merge` 只替换 result 里出现的章。
- **让代理「存文件自查」后,个别代理会只交一段「已完成、见某文件」的说明。** 2026-09-21 滴天髓白话第 49 章:校对代理把全文写进了自查文件,
  StructuredOutput 里只有两段汇报。提示语已补「存文件只为自查,最后仍须按 schema 交回完整结果」;**装配前先扫一眼各单元的 blocks 数 / 译文总长**,异常短的去它的 scratch 文件里救。
- **四库写本的版式事故会把一句话切成几段。** 小字位误排(玉照定真经「旺相休囚」的「囚」)、书名首字另起一行(三命通会卷七《烛神经》的「烛」)——
  管线按「小字即注、另行即段」忠实照切,译注代理也老实按碎段处理。**对位探测报「短标题配长译」时先看是不是这种情形**;修法是 config 里加 `joinParas`,
  再把译文 / 断句 / 注疏三层按下标同步重排(两次都是十几行脚本,见 SOURCES.md 末两节)。
- **别用阻塞式 `TaskOutput` 等 workflow。** 完成时它会把整份结果(动辄几十万字)倒进上下文。等通知即可;要看进度读 journal.jsonl 数行数。

- **`check-links` 不查 JSX 里手写的 `<Link to=...>`**,只查白话资源/路由/搜索索引。
  它的路由正则曾只认 `\d+`,导致细粒度白话(「组-序」「卷-序」键)误报 428 条坏链
  ——**加新键形态时记得同步放开正则,且不可再 `Number()`**(`Number('3-9')` 是 NaN)。

## 阅读体验的两条既定做法

- **长章拆页**(`src/features/reader/chapterParts.js`):全站 9 部书最长章 ≥150 段
  (围炉夜话 421 段全书一章、传习录三卷均 322)。**只拆显示不拆数据**——章仍是第 N 章、
  段号仍是章内那套(译文/注疏/白话/收藏/锚点/互见全站按章号索引,动不得),分屏走 `?p=`。
  章长 >60 段才拆、每屏约 40 段,**优先切在自然边界**(诗经《诗题》、传习录 `pieces` 条首),
  屏名即用条头/诗题。注疏/延伸/白话/评论**只挂最后一屏**。
- **段级续读**(storage `readPos` 键):记「书→{章,段}」,回来**按段号自动落到对应那一屏**
  并标「上次读到这里」。旧的 `reading` 键(章级)不动,书架/门户足迹/续读章仍读它。

## 细粒度白话的两套机制

书里一章太长、需要一篇一篇写时,有两条路,**按原文有没有标题段来选**:

- **有 `《X》` 独立成段的标题**(诗经诗题、长短经篇题)→ `texts.json` 设 `poemTitles: true`,
  自动识别、零代码改动
- **没有标题段**(传习录一卷数百段连续问答)→ `texts.json` 显式列
  `pieces: [{key, ch, from, to, title}]`,人工策展区间

两者的章键都是「数字-数字」(组-序 / 卷-序),`check-data` 的 `chapterText` 遇此键
**先查 pieces 区间、没有再退回《诗题》识别**,引文校验池因此收窄到单首/单条。
渲染分别走 `renderPoemHead`(替换标题段)与 `renderPieceHead`(在段前插入)。
**生产端同一套规则在 `scripts/lib/sub-chapter.mjs`**(2026-09-25):`gen-baihua-wf` 见 texts.json 有 `pieces` 即一篇一单元
(原文按章内绝对下标内联)、`assemble-baihua` / `check-baihua-draft` 认「章-序」键;另 gen 支持 `--chapters=1,9,11`(精选)与
`--skip=2,6`(段目章),旗标可放任意位置。

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm test             # vitest(M2 起引擎必须有单测)
npm run data:fetch   # 从维基文库抓取原文并重新生成数据(带本地缓存,可随时重跑)
npm run check-data   # 数据校验,任何数据变更后必须通过
npm run content:build # 把 src/data/*/baihua/*.json 拆成 public/content/ 小文件 + 搜索索引(dev/build 已前置自动跑)
npm run check-links  # content:build + 校验白话资源/搜索分片/路由无坏链
```

## 数据规则(硬约束)

1. **经文原文一律来自数据管线,严禁手改、严禁凭记忆补写。** `src/data/yijing/hexagrams.json` 和 `classics/*.json` 是 `npm run data:fetch` 的生成物(来源:维基文库《周易》,繁转简,通行本)。发现原文问题改 scripts/fetch-data.mjs 的解析逻辑后重跑,不要直接编辑生成文件。
2. 人工内容(拼音、提要、译文)写在 `scripts/authored/*.json`,由 data:fetch 合并进生成物。改完必须重跑 `data:fetch` + `check-data`。
3. `scripts/lib/hexagram-table.mjs` 是 64 卦基准表(卦序/卦名/上下卦/binary),它与抓取内容互相校验。binary 一律**自下而上**(下标 0 = 初爻),这是全项目约定,任何组件和引擎都不得违反。
4. 全角标点注意:工具链可能把输出里的全角逗号/冒号静默转成半角。代码里匹配全角标点必须用 `：`(:)、`，`(,)、`；`(;)转义,不要写字面量;中文数据文件写完后检查标点。

## 译文工序(已完成,修订时仍照此)

64 卦译文已全部完成。日后修订单卦译文时:

1. 打开 `src/data/yijing/hexagrams.json` 找到该卦,**对照每个 original 字段直译**——译文必须从眼前的原文译出,不是从记忆里背。
2. 改 `scripts/authored/translations.json`(judgment/tuan/daxiang/lines×6;乾坤另有 use 字段为用九/用六)。
3. 风格按设计稿 §9:平实直译、一段对一段、禁算命口吻、歧义取程朱主流注解。
4. 重跑 `npm run data:fetch && npm run check-data`。

经文字词注释在 `src/data/yijing/zhushi.json`(人工维护,长词优先收录),由 AnnotatedText 组件挂在卦辞与爻辞原文上。

## 代码组织

- 页面与组件:`src/features/yijing/`(组件清单见设计稿 §4)
- 推演引擎:`src/features/yijing/engine/`,纯函数,规则见设计稿 §6,必须配单测(含 §10-M2 列出的自检用例)
- 数据:`src/data/yijing/`(只读生成物 + trigrams.json)
- 不引入 UI 组件库;样式用原生 CSS + tokens(已在 src/index.css)
- localStorage 键前缀 `guanxiang.v1.`,读写过 storage 薄封装(设计稿 §7.3)

## 部署

默认按根路径托管(Vercel/Netlify/Cloudflare Pages 直接可用)。如改用 GitHub Pages 子路径,需同时设 vite.config.js 的 `base` 和 Router 的 `basename`。

**生产(唯一):Cloudflare Pages** —— `https://hexa.gavin.pub`(Pages 项目 `hexa-gavin-pub` → `hexa-gavin-pub.pages.dev`,自定义域 `hexa.gavin.pub`,HTTPS 自动签)。**走 wrangler CLI 部署**(owner 2026-07-14 改口:此前否过 CLI、坚持后台拖 dist,现明确要求直接用 CLI;发布流程:`npm run build` → `npx wrangler pages deploy dist --project-name=hexa-gavin-pub`)。CF 专属文件已入 `public/`:`_redirects`(`/* /index.html 200` SPA 回退)+ `_headers`(/assets/* immutable、index/sw no-cache),build 自动拷进 dist。`npm run deploy:cf`(=build + `wrangler pages deploy dist`)脚本备着但需先 `wrangler login`(owner 偏好后台,默认不用)。**预览分支 = review 通道**:同一命令加 `--branch=preview-portal --commit-dirty=true` 发到 `https://preview-portal.hexa-gavin-pub.pages.dev`,owner 在这儿看、攒一批再开口发生产(生产不带 `--branch`)。**发完必核对**:`curl -s <域名>/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'` 须与刚 build 出的 `dist/index.html` 一致(`__BUILD_DATE__` 让每次 build 的入口哈希必变,只能比当次那份);`npx wrangler` 偶发「network aborted」也退 0,用 `npx --yes` 并靠哈希核对兜底。**坑**:自定义域必须**在 Pages 项目「自定义域」里登记**(只在 DNS 加 CNAME 会 `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`——边缘无该域证书);登记后等证书签发变 Active。**hexa.gavin.pub 不在 `HOST_GROUPS` → 全站路径分组,无需改码。** **网站入口 `/` = 诸学门户 = 首页**(owner 拍板,原直接进易经已改):`/` 渲染 MasterPortalPage(中立外壳,`isNeutralPath` 含 `/`)、**易经首页挪到 `/yijing`**(registry yijing `home:'/yijing'`,prefix 仍 `''` 兜底,故 `/yijing` 及所有根级易经子路由〔/hexagrams、/workbench、/me…〕仍归易经);门户易经卡 `siteEntryHref`→`/yijing`。**`/hexagram` 自 2026-09-30 起 `<Navigate to="/">` 跳首页**(owner:「直接指向首页即可」——它本是多域名时代的跨组总门,单域名下与首页重复;路径保留给老链接,`MASTER_PORTAL_PATH` 仍用于分组域名的着陆豁免),logo 与各页「← 诸学门户」面包屑均指 `/`。根域名访问落门户。

**~~生产 ①(阿里云自有云主机 119.23.77.106 + nginx)已废弃~~**(owner 2026-06-22:中国阿里云域名转发/备案受限,弃用,改投 Cloudflare Pages)。`deploy.sh` 已删(git 历史可查);服务器本身由 owner 在阿里云控制台自行处置。app 代码不引用该 IP,无残留。

## 已知差异与待办

- 系辞下底本为九章分法(孔颖达),与设计稿写的十二章不同,以数据为准,check-data 已按 9 章校验。
- 序卦分上/下两篇;杂卦一篇(抓取时已剔除维基文库的「校诂版」对照章节)。
- 乾坤的文言传是扁平段落数组,未按爻分节,详情页直接顺序展示即可。
- hexagrams.json 的 palace 字段**不再人工填**:八宫归属由 engine/bagong.js 运行时计算(v2 §5.1),数据文件保持 null 不动。
- 周易参同契底本为维基文库 35 章分法(非传统上中下三篇),texts.json sections 与 check-data 均按 35 章;阴符经正文抓自 Page: 校对页(主页面是 djvu 转嵌)。
- 道德经底本为「道德經 (王弼本)」:经文按王弼注本分段(注文在管线清洗时剔除),故每章段数多于通行排印本,译文与注疏按此分段对位。
