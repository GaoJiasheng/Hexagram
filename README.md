# hexagram · 观象

个人学习站集合。第一个(当前唯一)模块是**易经研习**:六十四卦原文与十翼通读、基于易理的确定性卦变推演(变/互/错/综、变占规则、爻位分析)。

纯前端,无后端:React 19 + Vite,经文数据构建期生成,用户数据存 localStorage,可静态托管、离线使用。

## 快速开始

```bash
npm install
npm run dev
```

## 文档与数据

- 设计稿(唯一规格):[docs/yijing-design.md](docs/yijing-design.md)
- 实现者指引:[CLAUDE.md](CLAUDE.md)
- 经文数据:`npm run data:fetch` 从维基文库《周易》抓取生成,`npm run check-data` 校验;原文不可手改。

## 目录

```
docs/                  设计稿
scripts/               数据管线(抓取/校验)与人工内容(译文、拼音、提要)
src/data/yijing/       生成的经文数据(64 卦 + 经传)
src/features/yijing/   页面与组件(按里程碑实现中)
```
