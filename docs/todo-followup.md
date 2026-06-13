# 后续 TODO(16/17 收官后 · 待 quota 恢复继续)

> 状态:十六期(儒,v1.17.0)+ 十七期(佛,v1.18.0)已发版。六部经全部 status=done、
> check-data 全绿、跨组隔离成立。儒佛内容由**并发 workflow 机器产出 + 程序化装配**
> (term 须原文精确子串、note≤40、段数对齐;违规即弃/句读截断/去重),全程未手改原文。
> 因是机器批量产出,**首要后续是质量人工校订**。下列按优先级,均自含恢复所需上下文。

## P0 — 待 owner 拍板

1. **心经底本决定**。现用唐·法成「广本」(`src/data/fo/classics/xinjing.json`;
   `src/data/fo/texts.json` 的 xinjing.authorNote 已显著标明缘由)。原因:玄奘 260 字
   「略本」在维基文库仅 djvu 影印转嵌、无洁净录文。
   - **若换回玄奘略本**:从 djvu 逐字校录(`Page:` 命名空间,大正藏 No.251),或另觅内联洁净源;
     然后 texts.json 的 era/attribution/authorNote 回改玄奘、重写 fo.config、重抓、重做译注延
     (心经仅 1 卷 10 段,一轮即可)。
   - **若维持法成广本**:本条关闭,删去 authorNote 里的「待定」语气即可。

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

## P2 — 文档收尾

3. **CLAUDE.md 头部**(约 line 3)仍写「佛/儒经文内容整理中(脚手架已立,texts.json status pending)」
   —— 已过时。改为「佛/儒六部经已译注延齐备(已发 v1.17.0 / v1.18.0)」。
4. **README.md** 模块段只列易经 / 道藏。佛儒为隐藏组,按需补「儒典研读 / 释典研读」或维持低调
   (owner 定,因隐藏组未必想公开示众)。
5. **docs/design-v16.md / v17.md** 批次表标「已发」;补记实际由并发 workflow 执行(非逐批 inline)、
   底本偏差(心经法成本)、及管线为佛新增的 splitHeadings / PIN_TITLE_RE。

## P3 — 可选增强

6. **部署**:一份构建推 `tao/con/bud.gavingao.cn`(owner 操作);访问 `/hexagram` 是隐藏三教总入口。
7. **搜索 / 续读接入**:佛/儒现 `hasSearch=false`、未进全局搜索索引;若要,仿 `searchIndex.js` 加多源。
8. **儒 孟子段数**:并发期 owner/另一会话给管线加了 `stripHeaderBlock`、孟子 →743 段;
   `ru-translations.json` 的告子上/下译文数组可能各多 1 条尾项(已被 fetch-corpus 忽略,check-data 绿),
   有洁癖可 trim 对齐,非必须。

---
**恢复方式**:读本文件 + `git log --oneline -15` + `npm run check-data` 的覆盖仪表即知进度。
内容改动逐批 `check-data` 过才 commit;佛守 §0 铁律、儒守朱子集注主流。
