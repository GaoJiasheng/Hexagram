# 后续 TODO(16/17 收官后 · 待 quota 恢复继续)

> ⚠️ **本文已收官,仅作留档。全站唯一待办清单在 [todo.md](./todo.md)** —— 不要在本文记进度。

> 状态:十六期(儒,v1.17.0)+ 十七期(佛,v1.18.0)已发版。六部经全部 status=done、
> check-data 全绿、跨组隔离成立。儒佛内容由**并发 workflow 机器产出 + 程序化装配**
> (term 须原文精确子串、note≤40、段数对齐;违规即弃/句读截断/去重),全程未手改原文。
> 因是机器批量产出,**首要后续是质量人工校订**。下列按优先级,均自含恢复所需上下文。

## P0 — 心经底本 ✅ 已定(v1.18.1)

1. ~~心经底本决定~~ **已落实**:owner 定「用流传最广本」→ 改用**玄奘略本**(大正藏 No.251)。
   实现:fo.config 指向 djvu 第864页 + splitHeadings 跳「明太祖序」取经文;wikisource.mjs 加 normalized
   标题映射、fetch-corpus 加跳 `序$` 标题 + 剔章末重复经题;心经译注延已重写为玄奘略本 8 段。本条关闭。

## P1 — 质量校订(机器产出,需人眼)

2. **儒/佛 译文 + 注疏 + 延伸 抽查校订**。虽经第二代理做了忠实性 + 调性校验,仍应人工抽查。
   - **重点核对**:佛站是否处处守住 v17 §0 铁律(研习不宣化、不下吉凶/果报断语);
     儒是否硬伤、是否合朱熹《四书章句集注》主流;梵汉对音 / 名相注疏的准确性;偈颂译文。
   - **数据位置**(改完跑 `npm run data:fetch-ru`/`-fo` + `npm run check-data`):
     `scripts/authored/{ru,fo}-translations.json`、`src/data/{ru,fo}/zhushi-anchored/*.json`、
     `src/data/{ru,fo}/yanyi.json`。原文在 `src/data/{ru,fo}/classics/*.json`(只读生成物,勿手改)。
   - **装配时被弃 / 改动的注疏**(这些段注疏偏少,若要补全可参原 workflow 产出):
     儒丢 15 条、佛丢 2 条(term 非原文子串);佛 22 条 note 曾超 40 字、已在句读处机器截断
     (可能略生硬,值得复看);佛 1 条重叠锚点已去重(金刚经 14 分「第一波罗蜜」)。

## P2 — 文档收尾 ✅ 已完成(v1.18.1)

3. ~~CLAUDE.md 头部~~ **已改**:佛/儒经文内容已齐(v1.17.0 / v1.18.0)。
4. ~~README.md~~ **已补**:三组分站说明 + 儒典 / 释典模块条目。
5. ~~design-v16 / v17 批次表~~ **已补**「执行记录(已发)」:workflow 执行、底本(流传最广本)、管线增项。

## P3 — 可选增强

6. **部署**:一份构建推 `tao/con/bud.gavingao.cn`(owner 操作);访问 `/hexagram` 是隐藏三教总入口。
7. ~~**搜索 / 续读接入**~~ ✅ 已完成(v1.22.0 全站搜索接入 9 读经站 + 道藏,后并为 `GlobalSearchPalette` 恒全站;原记「佛/儒 hasSearch=false」已过期)。
8. **儒 孟子段数**:并发期 owner/另一会话给管线加了 `stripHeaderBlock`、孟子 →743 段;
   `ru-translations.json` 的告子上/下译文数组可能各多 1 条尾项(已被 fetch-corpus 忽略,check-data 绿),
   有洁癖可 trim 对齐,非必须。

---
**恢复方式**:读本文件 + `git log --oneline -15` + `npm run check-data` 的覆盖仪表即知进度。
内容改动逐批 `check-data` 过才 commit;佛守 §0 铁律、儒守朱子集注主流。
