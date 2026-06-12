# hexagram · 观象

个人学习站集合，双模块，整屏门户切换：

- **易经研习**（默认，朱砂主题）——六十四卦原文与十翼通读、64 卦白话全译、经文字词注释与经传逐段注疏（悬停出注）、卦主标注、确定性卦变推演（变/互/错/综、变占规则、爻位分析）、八宫纳甲、推演六法（梅花引导/大衍/金钱卦等）、学堂教程与练习、易学源流、全局搜索、今日一卦、研习进度。
- **道藏研读**（玄青主题）——六部经典全文阅读器：道德经、清静经、太上感应篇、庄子内篇、阴符经、周易参同契；白话全译 562 段、锚定字词注疏（生僻注音/通假/名物/丹道隐语）。

纯前端，无后端：React 19 + Vite，经文数据构建期生成，用户数据存 localStorage，可静态托管、离线使用。

## 快速开始

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run dev            # 开发服务器
npm run build          # 生产构建
npm test               # vitest(推演引擎单测)
npm run data:fetch     # 易经管线:维基文库《周易》抓取生成
npm run data:fetch-dao # 道藏管线:六部经典抓取生成
npm run check-data     # 数据校验(结构/繁简哨兵/译注覆盖/注疏锚点),数据变更后必须通过
```

## 文档与数据

- 设计稿(唯一规格,按期增量):[一期](docs/yijing-design.md) · [二期](docs/yijing-design-v2.md) · [三期](docs/yijing-design-v3.md) · [四期](docs/design-v4.md) · [五期](docs/design-v5.md) · [六期](docs/design-v6.md) · [七期](docs/design-v7.md)
- 实现者指引:[CLAUDE.md](CLAUDE.md)
- 经文原文一律来自数据管线(维基文库,繁转简),不可手改;白话译文与注疏为人工内容,存于 `scripts/authored/` 与 `src/data/*/zhushi*`。

## 目录

```
docs/                       设计稿(v1–v7)
scripts/                    数据管线(fetch-data/fetch-dao/check-data)与共享库
scripts/authored/           人工内容(译文、拼音、提要、卦主)
src/data/yijing/            易经生成数据(64 卦/经传)+ 注释与注疏(人工)
src/data/dao/               道藏生成数据(六部)+ 注疏(人工)
src/features/yijing/        易经模块页面/组件/推演引擎(纯函数+单测)
src/features/dao/           道藏模块页面与装载
```

## 部署

默认按根路径托管(Vercel/Netlify/Cloudflare Pages 直接可用);GitHub Pages 子路径需同时设 vite.config.js 的 `base` 与 Router 的 `basename`。
