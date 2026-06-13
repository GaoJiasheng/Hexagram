# hexagram — 观象 · 个人学习站

个人学习站集合,双模块:易经研习(yijing,默认)+ 道藏研读(dao)。模块间不互链,唯一切换点是整屏门户(v4 §3);**唯一例外是「桥」(v8)**:参同契/阴符经注疏气泡内的卦名可单向跳转易经卦页,易经侧零反向链接。纯前端(React 19 + Vite),无后端,用户数据只存 localStorage,可静态托管。

## 唯一规格来源

**docs/yijing-design.md(一期 M1–M3)、docs/yijing-design-v2.md(二期 M4–M6)、docs/yijing-design-v3.md(三期 P0–P5)、docs/design-v4.md(四期:注释层/源流/多模块门户与道藏框架)、docs/design-v5.md(五期:经传逐段注疏层)、docs/design-v6.md(六期:道藏内容期)、docs/design-v7.md(七期:道藏译注收官)、docs/design-v8.md(八期:道藏→易经桥)、docs/design-v9.md(九期:筮例与故事)、docs/design-v10.md(十期:工具与交互期)与 docs/design-v11.md(十一期:工程打磨期)是页面、交互、视觉、推演规则、数据结构的唯一规格。** v2–v4 是增量稿,视觉/组件/数据约定沿用 v1。实现任何页面前先读对应章节,不要自行发明视觉风格或交互;引擎规则(八宫/纳甲/梅花/大衍/金钱卦)必须照设计稿的规则表实现,严禁凭记忆补规则。每个里程碑完成后逐条核对其验收清单。

## 当前状态(随进度更新此节)

- [x] M0 脚手架:路由占位壳、设计 tokens(src/index.css)、favicon、数据管线
- [x] M1 读:HexagramFigure 组件、六十四卦总览、卦详情页、导航/主题/译文开关
- [x] M2 推:推演引擎(纯函数 + 单测)、推演工作台
- [x] M3 通:经传阅读、八卦基础、我的、全局搜索、今日一卦(已发 v1.0.0)
- [x] M4 明:术语层(glossary.json + TermTip)、三才/爻位身份/贞悔、卦主 schema(v2 §3–§4)
- [x] M5 宫:八宫纳甲引擎(bagong/najia)+ 详情页纳甲节 + 总览八宫视图(v2 §5)
- [x] M6 占:梅花易数(meihua + lunarAdapter)+ 学堂改版(河洛/消息卦/大衍/名词表)(v2 §6–§7)
- [x] 三期 P0–P5 读练用体系:金钱卦(jinqian)、工作台六法(梅花引导/大衍/金钱三入口)、学堂七篇(新增梅花/金钱教学页)、QuizCard 练习、学算双向跳转、研习进度(progress)(v3 全文)
- [x] 四期:64 卦译文全部完成(含用九/用六)、经文字词注释层(zhushi.json + AnnotatedText)、易学源流页、多模块门户 + 道藏框架(六部经典占位)(v4 全文)
- [x] 易经内容收官:经传 204 段全译(scripts/authored/classics-translations.json,按 book→章号→段序合并)、乾坤文言传 35 段全译(translations.json 的 wenyan 数组)、序卦/杂卦按卦引文(fetch-data 自动解析,64/64)、卦主 64 卦标注(hexagram-meta.json 的 guazhu 字段 + LineRow 赭石小章)
- [x] 五期:经传逐段注疏层(v5 全文,已发 v1.4.0)——753 单元 18 批全部审毕,762 条锚注(彖 61/64·大象 55/64·小象 243/386·文言 21/35·系辞 57/60·说卦 37/50·序卦 6/63·杂卦 9/31,未注单元为审后无拦路词留空);数据在 src/data/yijing/zhushi-anchored/(人工维护),组件 AnnotatedText anchors 锚定模式 + ref 复用全局词条,check-data 锚点校验兜底。**修订注疏照 v5 §5 风格规范,改完必过 check-data**
- [x] 六期:道藏内容期(v6 全文,已发 v1.5.0)——六部原文录入(scripts/fetch-dao.mjs + scripts/lib/wikisource.mjs 共享库,与易经管线同缓存);章节阅读器 DaoReadPage(/dao/:slug/:chapter,复用经传阅读器模式);道德经 81 章全译(scripts/authored/dao-translations.json)+ 190 条锚定注疏(src/data/dao/zhushi-anchored/daodejing.json,**无 ref**,模块不互链)。其余五部仅原文(status: partial),译注照 v6 §4–§5 工序逐部展开
- [x] 八期:道藏→易经桥(docs/design-v8.md,已发 v1.7.0)——参同契 45 处+阴符经 1 处卦名桥点(注疏条目 hex/to 字段),气泡尾部单向跳转易经卦页;check-data 校验 hex 1–64、易经侧禁用桥字段。**新增桥点照 v8 §2 规则(仅道藏侧、段内首次出现、不与既有锚点重叠)**
- [x] 七期:道藏译注收官(docs/design-v7.md,已发 v1.6.0)——五部译注全齐:清静经 6 段/感应篇 14 段/阴符经 3 段(管线修复:校对页断行致句子腰斩,每章合并为一段)/庄子内篇 53 段/参同契 45 段,六部 status 全部 done;道藏译文 562 段全覆盖,锚注共 550 条。**修订工序照 v6 §4–§5 与 v7 §2 分书风格,改完必过 check-data**
- [x] 十一期:工程打磨期(docs/design-v11.md,已发 v1.10.0)——零内容零功能语义变化:正文字体自托管(@fontsource/noto-serif-sc,woff2 不进 precache 走 runtime CacheFirst);路由全懒加载+搜索面板按需加载(入口 JS 780→245KB);usePageTitle 按页标题(易经缀「观象」道藏缀「观道」,23 页接入);apple-touch-icon;暗色走查零缺陷。**新增页面必须接 usePageTitle;新增重数据组件优先懒加载**
- [x] 十期:工具与交互期(docs/design-v10.md,已发 v1.9.0)——纯代码无新内容:全局搜索八组多源索引(searchIndex.js,经传 chunk 懒加载异步补建,道藏不入索引);验占闭环(占例 outcome 字段+我的页回填统计);筮例重演(卦例图「在工作台重演」走 ?gua=&dong=);卦画闪卡 /basics/guahua(识卦/画卦,干扰项取错综与一爻差);先天方圆图 engine/xiantian.js+FangyuanView(总览 ?view=fangyuan,**圆图方图布列照 v10 §5 规则表,配单测**);续读入口+卦页 ←→/横滑翻页;PWA(vite-plugin-pwa,precache 全站离线)。LEARN_TOPICS 注册表在 src/features/yijing/learnTopics.js(学堂/我的/搜索共用)
- [x] 九期:筮例与故事(docs/design-v9.md,已发 v1.8.0)——春秋筮例 21 条(左传 18+国语 3,筮占 15·引易 6):原文走摘录式管线 scripts/fetch-shili.mjs(page+起止 mark 切片,标点各公不一,**严禁手改原文**),背景/全译/解读为人工内容(scripts/authored/shili.json),页面 /shili 列表+详情(卦例图 movingLines=binary 异或)+卦页关联回链;爻辞商周史事 8 节(src/data/yijing/shishi.json 人工 registry+/basics/shishi+卦页「史事:」回链);人物志易学十家(renwu.json+源流页时间线扩明代节点+同页小传锚点+站内互指 15 处,**链接禁入 /dao**);道藏 texts.json 六部 authorNote 撰人小传(DaoTextPage 题解展示,纯文本)。**筮例/史事/人物的脱锚叙述照 v9 §4 四级分级(共识直写/考证标出处/存疑明示/宁缺毋滥);check-data 校验筮例≥19·史事卦爻位·人物≥10 家**

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm test             # vitest(M2 起引擎必须有单测)
npm run data:fetch   # 从维基文库抓取原文并重新生成数据(带本地缓存,可随时重跑)
npm run check-data   # 数据校验,任何数据变更后必须通过
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

## 已知差异与待办

- 系辞下底本为九章分法(孔颖达),与设计稿写的十二章不同,以数据为准,check-data 已按 9 章校验。
- 序卦分上/下两篇;杂卦一篇(抓取时已剔除维基文库的「校诂版」对照章节)。
- 乾坤的文言传是扁平段落数组,未按爻分节,详情页直接顺序展示即可。
- hexagrams.json 的 palace 字段**不再人工填**:八宫归属由 engine/bagong.js 运行时计算(v2 §5.1),数据文件保持 null 不动。
- 周易参同契底本为维基文库 35 章分法(非传统上中下三篇),texts.json sections 与 check-data 均按 35 章;阴符经正文抓自 Page: 校对页(主页面是 djvu 转嵌)。
- 道德经底本为「道德經 (王弼本)」:经文按王弼注本分段(注文在管线清洗时剔除),故每章段数多于通行排印本,译文与注疏按此分段对位。
