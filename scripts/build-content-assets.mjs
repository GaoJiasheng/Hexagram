import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ogShardKey, normPath } from '../server/og-index.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DATA = path.join(ROOT, 'src/data')
const OUT_ROOT = path.join(ROOT, 'public/content')
const OUT_BAIHUA = path.join(OUT_ROOT, 'baihua')
const OUT_DAODU = path.join(OUT_ROOT, 'daodu')
const OUT_SCHOOL = path.join(OUT_ROOT, 'school')
const OUT_SEARCH = path.join(OUT_ROOT, 'search')
const SEARCH_SHARDS = 128
const TEXT_SHARDS = 1024  // 预览原文桶(正文 / 易经等 kind 的 preview 字段),按记录 id 哈希分桶,一桶 ≈ 6k 字
const TEXT_SOLO_MIN = 24000   // 超过这个字数的章(长短经整卷 14 万字、传习录一卷 7 万)单独成文件,不拖累同桶的短章
const PREVIEW_KINDS = new Set(['正文', '易经'])   // 只有这两类记录带 preview(原文);别的 kind 不去取桶

const CORPORA = ['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu', 'guwen', 'mingli']
const YIJING_CLASSICS = [
  ['xici-shang', '系辞上传'],
  ['xici-xia', '系辞下传'],
  ['shuogua', '说卦传'],
  ['xugua', '序卦传'],
  ['zagua', '杂卦传'],
]

const { SITES } = await import(pathToFileURL(path.join(ROOT, 'src/sites/registry.js')).href)
const { LEARN_TOPICS } = await import(pathToFileURL(path.join(ROOT, 'src/features/yijing/learnTopics.js')).href)

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const exists = (file) => fs.existsSync(file)
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}
const textOf = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => k !== 'svg')
      .map(([, v]) => textOf(v))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
const compact = (s) => String(s || '').replace(/\s+/g, ' ').trim()
// 段落数组只取原文字段(搜索结果预览用;textOf 会把译文一并串进来)
const originalOf = (paras) => (Array.isArray(paras) ? paras : []).map((p) => (typeof p === 'string' ? p : p?.original || '')).filter(Boolean).join('\n')
const uniqText = (...parts) => [...new Set(parts.map(compact).filter(Boolean))].join('\n')
const siteOf = (corpus) => SITES.find((s) => s.key === corpus)
const siteLabel = (corpus) => siteOf(corpus)?.portalTitle || corpus
const homeOf = (corpus) => siteOf(corpus)?.home || `/${corpus}`
const searchText = (s) => compact(s).toLowerCase().replace(/\s+/g, '')

function shardKey(token) {
  let h = 2166136261
  for (const ch of token) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h & (SEARCH_SHARDS - 1)).toString(16).padStart(2, '0')
}

function bigrams(value) {
  const chars = [...searchText(value)]
  const out = new Set()
  for (let i = 0; i < chars.length - 1; i += 1) {
    const token = `${chars[i]}${chars[i + 1]}`
    if (token.trim().length >= 2) out.add(token)
  }
  return out
}

function cleanOutDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

// 白话章键有两种形态:整章纯数字,细粒度「组-序」/「卷-序」(诗经一诗一篇、传习录一条一篇、
// 长短经一篇一篇——见 CLAUDE.md「细粒度白话的两套机制」)。落盘前必须校验能安全当文件名用,
// 不能直接信任数据里写的字符串;只放行数字与连字符,别的一律炸出来让人看见而不是悄悄写坏文件。
function chapterFileKey(ch) {
  const key = String(ch)
  if (!/^[0-9]+(-[0-9]+)?$/.test(key)) {
    throw new Error(`白话章键含不安全字符,无法用作文件名: ${JSON.stringify(key)}`)
  }
  return key
}

function chapterHref(corpus, slug, ch, meta) {
  if (corpus === 'dao') return meta?.singlePage ? `/dao/${slug}#dao-ch-${ch}` : `/dao/${slug}/${ch}`
  return meta?.singlePage ? `/${corpus}/${slug}#${corpus}-ch-${ch}` : `/${corpus}/${slug}/${ch}`
}

function baihuaHref(corpus, slug, ch) {
  if (corpus === 'yijing') {
    return slug === 'hexagrams' ? `/hexagram/${ch}/baihua` : `/classics/${slug}/${ch}/baihua`
  }
  return `/${corpus}/${slug}/baihua/${ch}`
}

function addRecord(records, item) {
  const title = compact(item.title)
  const href = compact(item.href)
  if (!title || !href) return
  records.push({
    id: item.id,
    kind: item.kind,
    site: item.site,
    siteTitle: item.siteTitle || siteLabel(item.site),
    title,
    subtitle: compact(item.subtitle),
    href,
    text: compact(item.text),
    preview: compact(item.preview || ''),   // 搜索结果里的原文预览(只有正文一类才给;白话/页面不给)
  })
}

const fnv = (s, mask) => {
  let h = 2166136261
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return (h & mask) >>> 0   // >>> 0:掩码到 32 位时 & 会给负数,文件名里不能带负号
}

function buildSearchAssets(records) {
  const indexRecords = records.map((r) => ({
    id: r.id,
    kind: r.kind,
    site: r.site,
    siteTitle: r.siteTitle,
    title: r.title,
    subtitle: r.subtitle,
    href: r.href,
  }))
  // 分片文件名带版本号(记录 id 序列的哈希):分片里存的是记录在 index.json 里的**位置**,
  // 两边必须是同一次构建的产物。PWA 对 /content/ 是 StaleWhileRevalidate,发版后客户端曾拿到
  // 新 index.json + 旧分片 → 位置错位 11 条,「知其白守其黑」搜出三十九章(owner 2026-10-03)。
  // 现在 index.json 里写明分片路径,新索引只会去取新名字的分片,旧索引配旧分片,永远自洽。
  const ver = fnv(records.map((r) => r.id).join('\n'), 0xffffffff).toString(16).padStart(8, '0')
  const shards = new Map()
  for (let i = 0; i < SEARCH_SHARDS; i += 1) {
    const key = i.toString(16).padStart(2, '0')
    shards.set(key, new Map())
  }

  records.forEach((record, recordIndex) => {
    for (const token of bigrams(uniqText(record.title, record.subtitle, record.siteTitle, record.text))) {
      const bucket = shards.get(shardKey(token))
      if (!bucket.has(token)) bucket.set(token, [])
      bucket.get(token).push(recordIndex)
    }
  })

  const shardKeys = []
  for (const [key, bucket] of shards) {
    const tokens = Object.fromEntries(
      [...bucket.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([token, ids]) => [token, ids.sort((a, b) => a - b)]),
    )
    writeJson(path.join(OUT_SEARCH, 'shards', `${key}.${ver}.json`), { version: 1, tokens })
    shardKeys.push(key)
  }

  // 原文预览桶:{ 记录 id: 原文 },按 id 哈希分 256 桶,结果列表只取命中的那几桶
  const textBuckets = new Map()
  const solo = new Set()        // 单独成文件的记录 id(index.json 记录上标 pv:'s',客户端据此换路径)
  let previewChars = 0
  fs.mkdirSync(path.join(OUT_SEARCH, 'text'), { recursive: true })
  for (const r of records) {
    if (!PREVIEW_KINDS.has(r.kind) || !r.preview) continue
    previewChars += r.preview.length
    if (r.preview.length > TEXT_SOLO_MIN) {
      solo.add(r.id)
      const key = fnv(r.id, 0xffffffff).toString(16).padStart(8, '0')
      fs.writeFileSync(path.join(OUT_SEARCH, 'text', `solo-${key}.${ver}.json`), JSON.stringify({ version: 1, texts: { [r.id]: r.preview } }))
      continue
    }
    const key = fnv(r.id, TEXT_SHARDS - 1).toString(16).padStart(3, '0')
    if (!textBuckets.has(key)) textBuckets.set(key, {})
    textBuckets.get(key)[r.id] = r.preview
  }
  let maxBucket = 0
  for (const [key, bucket] of textBuckets) {
    const json = JSON.stringify({ version: 1, texts: bucket })
    maxBucket = Math.max(maxBucket, json.length)
    fs.writeFileSync(path.join(OUT_SEARCH, 'text', `${key}.${ver}.json`), json)
  }
  for (const r of indexRecords) if (solo.has(r.id)) r.pv = 's'
  console.log(`search preview: ${textBuckets.size} buckets + ${solo.size} solo, ${previewChars} chars, largest bucket ${Math.round(maxBucket / 1024)} K chars`)

  writeJson(path.join(OUT_SEARCH, 'index.json'), {
    version: 3,
    ver,
    count: indexRecords.length,
    shardCount: SEARCH_SHARDS,
    shardPath: `/content/search/shards/{key}.${ver}.json`,
    textShardCount: TEXT_SHARDS,
    textPath: `/content/search/text/{key}.${ver}.json`,
    textSoloPath: `/content/search/text/solo-{key}.${ver}.json`,
    previewKinds: [...PREVIEW_KINDS],
    shards: shardKeys,
    records: indexRecords,
  })
}

function indexBaihuaArticle(records, manifest, corpus, slug, ch, article, bookTitle) {
  addRecord(records, {
    id: `baihua:${corpus}:${slug}:${ch}`,
    kind: '白话',
    site: corpus,
    title: article.title || `白话${bookTitle}`,
    subtitle: article.subtitle || `${bookTitle} · 第${ch}章`,
    href: baihuaHref(corpus, slug, ch),
    text: uniqText(article.title, article.subtitle, article.centralIdea, textOf(article.blocks), textOf(article.hero)),
  })

  const meta = {
    title: article.title || '',
    subtitle: article.subtitle || '',
    featured: !!article.featured || !!article.hero,
    // 按章一文件:public/content/baihua/<corpus>/<slug>/<章号>.json，内容即该章 article 本身。
    // 2026-08 由「按书一文件」改回「按章一文件」——当初收成一书一文件是为了迁就 CF 后台
    // 拖拽上传（≤1000 文件），但部署早已改用 `wrangler pages deploy` CLI（限 2 万文件，见
    // CLAUDE.md「部署」节），这层迁就已无必要，反而让打开任意一章白话都要先拉整本书
    // （最大的书 7MB+）。改回一章一文件后单次请求只取这一章，其余不受影响。
    path: `/content/baihua/${corpus}/${slug}/${chapterFileKey(ch)}.json`,
  }
  manifest.baihua[corpus] ??= {}
  manifest.baihua[corpus][slug] ??= { chapters: {}, count: 0 }
  manifest.baihua[corpus][slug].chapters[String(ch)] = meta
  manifest.baihua[corpus][slug].count += 1
}

function buildBaihuaAssets(records, manifest) {
  const dataDirs = fs.readdirSync(SRC_DATA).filter((name) => exists(path.join(SRC_DATA, name, 'baihua')))
  for (const corpus of dataDirs.sort()) {
    const dir = path.join(SRC_DATA, corpus, 'baihua')
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const slug = file.replace(/\.json$/, '')
      const book = readJson(path.join(dir, file))
      const bookTitle = titleForBook(corpus, slug)
      for (const ch of Object.keys(book).sort()) {
        indexBaihuaArticle(records, manifest, corpus, slug, ch, book[ch], bookTitle)
        // 按章写一个文件 = article 本身
        writeJson(path.join(OUT_BAIHUA, corpus, slug, `${chapterFileKey(ch)}.json`), book[ch])
      }
    }
  }
}

// 书级导读(前世今生):一书一篇,与白话同走分片,免得 62 篇 × 数千字打进 JS chunk。
function buildDaoduAssets(manifest, records) {
  const dirs = fs.readdirSync(SRC_DATA).filter((n) => exists(path.join(SRC_DATA, n, 'daodu')))
  manifest.daodu ??= {}
  for (const corpus of dirs.sort()) {
    const dir = path.join(SRC_DATA, corpus, 'daodu')
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const slug = file.replace(/\.json$/, '')
      const art = readJson(path.join(dir, file))
      manifest.daodu[corpus] ??= {}
      // aliasOf:一书多 slug(庄子内/外/杂、内经素问/灵枢)只写一篇,别的 slug 指同一份文件
      if (art.aliasOf) {
        // 标题取自被指向的那一篇 —— alias 存根本身没有 title,不接过来入口会是空的
        const tgt = readJson(path.join(dir, `${art.aliasOf}.json`))
        manifest.daodu[corpus][slug] = {
          title: tgt?.title || '', subtitle: tgt?.subtitle || '', aliasOf: art.aliasOf,
          path: `/content/daodu/${corpus}/${art.aliasOf}.json`,
        }
        continue
      }
      manifest.daodu[corpus][slug] = {
        title: art.title || '', subtitle: art.subtitle || '',
        path: `/content/daodu/${corpus}/${slug}.json`,
      }
      writeJson(path.join(OUT_DAODU, corpus, `${slug}.json`), art)
      addRecord(records, {
        id: `daodu:${corpus}:${slug}`, kind: '导读', site: corpus,
        title: art.title, subtitle: art.subtitle,
        href: `${homeOf(corpus)}/${slug}/daodu`, text: art.centralIdea,
      })
    }
  }
}

// 家级导读(一家之来路):一组一篇。与书级同走分片。
// 分工:书级讲「这一本的前世今生」,家级讲「这些书之间、这些人之间」——
// 谁接谁 · 在哪一步转了向 · 哪一支断了 · 这几本按什么顺序读。
function buildSchoolAssets(manifest, records) {
  manifest.school ??= {}
  for (const corpus of fs.readdirSync(SRC_DATA).sort()) {
    const f = path.join(SRC_DATA, corpus, 'school.json')
    if (!exists(f)) continue
    const art = readJson(f)
    manifest.school[corpus] = {
      title: art.title || '', subtitle: art.subtitle || '',
      path: `/content/school/${corpus}.json`,
    }
    writeJson(path.join(OUT_SCHOOL, `${corpus}.json`), art)
    // 导读页分享出去原本是裸链接 —— 收进 og 索引,爬虫来取时能拿到题与摘要
    addRecord(records, {
      id: `school:${corpus}`, kind: '来路', site: corpus,
      title: art.title, subtitle: art.subtitle,
      href: `${homeOf(corpus)}/school`, text: art.centralIdea,
    })
  }
}

function titleForBook(corpus, slug) {
  if (corpus === 'yijing') {
    if (slug === 'hexagrams') return '易经'
    return YIJING_CLASSICS.find(([k]) => k === slug)?.[1] || slug
  }
  const file = path.join(SRC_DATA, corpus, 'texts.json')
  if (!exists(file)) return slug
  return readJson(file).find((t) => t.slug === slug)?.title || slug
}

function indexPages(records) {
  addRecord(records, {
    id: 'page:portal',
    kind: '页面',
    site: 'portal',
    siteTitle: '诸学门户',
    title: '诸学门户',
    subtitle: '全站入口',
    href: '/hexagram',
    text: '观象 诸学门户 易经 道藏 儒典 释典 心学 法家 墨家 兵家 纵横 中医 谋略 百家争鸣 义理专题',
  })
  addRecord(records, {
    id: 'page:concepts',
    kind: '专题',
    site: 'portal',
    siteTitle: '义理专题',
    title: '义理专题',
    subtitle: '跨派概念',
    href: '/concepts',
    text: '义理专题 跨派概念 人性 格物 兼爱 无为 仁 四端',
  })
  addRecord(records, {
    id: 'page:timeline',
    kind: '专题',
    site: 'portal',
    siteTitle: '全站时间轴',
    title: '全站时间轴',
    subtitle: '诸书成书年代',
    href: '/timeline',
    text: '全站时间轴 成书年代 西周 春秋 战国 秦汉 魏晋 隋唐 宋 元 明 清 各书先后 同时代',
  })
  addRecord(records, {
    id: 'page:renwu',
    kind: '专题',
    site: 'portal',
    siteTitle: '人物志',
    title: '人物志',
    subtitle: '诸书背后的人',
    href: '/renwu',
    text: '人物志 撰人 译者 注家 编者 生平 小传',
  })
  // 二十四期 · 交互化改造的页面(design-v24 §11):分享出去有题有摘要,全站搜索可命中
  addRecord(records, {
    id: 'page:lunyu-renwu',
    kind: '专题',
    site: 'ru',
    siteTitle: '儒典研读',
    title: '孔门弟子出场索引',
    subtitle: '《论语》按人切开',
    href: '/ru/lunyu/renwu',
    text: '论语 孔门弟子 子贡 子路 颜渊 曾子 子夏 子张 冉有 宰我 樊迟 子游 出场 索引',
  })
  addRecord(records, {
    id: 'page:shijing-map',
    kind: '专题',
    site: 'ru',
    siteTitle: '儒典研读',
    title: '十五国风示意图',
    subtitle: '诗经采诗之地',
    href: '/ru/shijing/map',
    text: '诗经 国风 周南 召南 邶 鄘 卫 王 郑 齐 魏 唐 秦 陈 桧 曹 豳 示意图',
  })
  addRecord(records, {
    id: 'page:ru-lineage',
    kind: '专题',
    site: 'ru',
    siteTitle: '儒典研读',
    title: '儒门学脉图',
    subtitle: '孔孟荀到程朱陆王',
    href: '/ru/lineage',
    text: '儒门 学脉 孔子 曾子 子思 孟子 荀子 董仲舒 周敦颐 程颢 程颐 朱熹 陆九渊 王阳明 理学 心学',
  })
  addRecord(records, {
    id: 'page:cantongqi-moon',
    kind: '专题',
    site: 'dao',
    siteTitle: '道藏研读',
    title: '月相纳甲盘',
    subtitle: '参同契的月体纳甲',
    href: '/dao/cantongqi/moon',
    text: '参同契 月相 纳甲 震庚 兑丁 乾甲 巽辛 艮丙 坤乙 坎离 戊己 取象',
  })
  addRecord(records, {
    id: 'page:zhuangzi-fables',
    kind: '专题',
    site: 'dao',
    siteTitle: '道藏研读',
    title: '庄子寓言索引',
    subtitle: '庖丁解牛到浑沌之死',
    href: '/dao/zhuangzi/fables',
    text: '庄子 寓言 庖丁解牛 庄周梦蝶 浑沌 鲲鹏 朝三暮四 邯郸学步 涸辙之鲋 成语 索引',
  })
  addRecord(records, {
    id: 'page:fo-concepts',
    kind: '专题',
    site: 'fo',
    siteTitle: '释典研读',
    title: '佛名相索引',
    subtitle: '五蕴 十二因缘 四谛 六度',
    href: '/fo/concepts',
    text: '佛 名相 五蕴 十二处 十八界 十二因缘 四谛 八正道 六度 三法印 空 般若 涅槃 菩提 自性 不二 索引',
  })
  // 可选件三件(design-v24 §13)
  addRecord(records, {
    id: 'page:mengzi-renwu', kind: '专题', site: 'ru', siteTitle: '儒典研读',
    title: '《孟子》问答人物索引', subtitle: '国君 弟子 论敌 按人切开', href: '/ru/mengzi/renwu',
    text: '孟子 人物 索引 梁惠王 齐宣王 滕文公 公孙丑 万章 公都子 告子 许行 淳于髡 出场',
  })
  addRecord(records, {
    id: 'page:chuanxilu-renwu', kind: '专题', site: 'xin', siteTitle: '阳明心学',
    title: '《传习录》问学人物索引', subtitle: '徐爱 陆澄 薛侃 钱德洪 王畿', href: '/xin/chuanxilu/renwu',
    text: '传习录 人物 索引 徐爱 陆澄 薛侃 陈九川 黄直 钱德洪 王畿 欧阳崇一 聂文蔚 罗整庵 问学 出场',
  })
  addRecord(records, {
    id: 'page:fo-lineage', kind: '专题', site: 'fo', siteTitle: '释典研读',
    title: '禅宗传灯图', subtitle: '达摩到惠能与曹溪门下', href: '/fo/lineage',
    text: '禅宗 传灯 达摩 慧可 僧璨 道信 弘忍 惠能 神秀 神会 怀让 行思 玄觉 法海 坛经 付嘱品 南能北秀',
  })
  addRecord(records, {
    id: 'page:tangshi-matrix', kind: '专题', site: 'tangshi', siteTitle: '唐诗',
    title: '体裁 × 诗人矩阵', subtitle: '唐诗三百首七十七家', href: '/tangshi/tangshi300/matrix',
    text: '唐诗三百首 诗人 体裁 矩阵 杜甫 李白 王维 李商隐 孟浩然 五古 七古 乐府 五律 七律 五绝 七绝',
  })
  // 中医三件(design-v24 §13)
  addRecord(records, {
    id: 'page:bencao-matrix',
    kind: '专题',
    site: 'zhongyi',
    siteTitle: '中医典籍',
    title: '六部三品矩阵',
    subtitle: '神农本草经的十八类',
    href: '/zhongyi/bencaojing/matrix',
    text: '神农本草经 本草 六部 三品 玉石 草 木 果菜 米谷 虫兽 上品 中品 下品 矩阵 目录',
  })
  addRecord(records, {
    id: 'page:suwen-zangxiang',
    kind: '专题',
    site: 'zhongyi',
    siteTitle: '中医典籍',
    title: '五行藏象图',
    subtitle: '阴阳应象大论的取象体系',
    href: '/zhongyi/suwen/zangxiang',
    text: '素问 阴阳应象大论 五行 藏象 肝心脾肺肾 五味 五色 五音 五志 东方生风 取象',
  })
  addRecord(records, {
    id: 'page:shanghan-liujing',
    kind: '专题',
    site: 'zhongyi',
    siteTitle: '中医典籍',
    title: '六经目录',
    subtitle: '伤寒论二十二篇的骨架',
    href: '/zhongyi/shanghanlun/liujing',
    text: '伤寒论 六经 太阳 阳明 少阳 太阴 少阴 厥阴 伤寒例 受病 篇目 目录',
  })
  addRecord(records, {
    id: 'page:zhanguoce-map',
    kind: '专题',
    site: 'zong',
    siteTitle: '纵横研读',
    title: '七国图与合纵时间轴',
    subtitle: '战国策十八篇的国与年代',
    href: '/zong/zhanguoce/map',
    text: '战国策 七国 秦 楚 齐 燕 赵 魏 韩 合纵 连横 苏秦 张仪 示意图 时间轴',
  })
  addRecord(records, {
    id: 'page:rhyme',
    kind: '专题',
    site: 'portal',
    siteTitle: '韵书与未收字',
    title: '韵书与未收字',
    subtitle: '平水韵 · 词林正韵 · 中原音韵',
    href: '/rhyme',
    text: '韵书 平水韵 词林正韵 中原音韵 格律 平仄 韵脚 未收字 唐诗 宋词 元曲 只统计不补字',
  })
  {
    // 人物志一人一条(2026-09-25):搜「朱熹」「鸠摩罗什」能直落人物志;易学十家的小传取 yijing/renwu.json
    const rw = readJson(path.join(SRC_DATA, 'renwu.json'))
    const yj = Object.fromEntries(readJson(path.join(SRC_DATA, 'yijing/renwu.json')).map((x) => [x.id, x]))
    for (const p of rw.people) {
      const site = SITES.find((x) => x.key === p.group)
      if (site?.portalHidden) continue
      if (p.yijing) continue   // 易学十家已由上面的 renwu:<id>(易学源流页)收录,不重复建条
      const paras = p.paragraphs || []
      addRecord(records, {
        id: `people:${p.id}`,
        kind: '人物',
        site: 'portal',
        siteTitle: '人物志',
        title: p.name,
        subtitle: p.label,
        href: `/renwu#${p.id}`,
        text: uniqText(p.name, p.note, ...paras),
      })
    }
  }
  addRecord(records, {
    id: 'page:debates',
    kind: '专题',
    site: 'portal',
    siteTitle: '百家争鸣',
    title: '赛博 · 百家争鸣',
    subtitle: '跨派对辩',
    href: '/debates',
    text: '百家争鸣 对辩 诸子 儒 道 佛 法 墨 兵 纵横 心学 中医',
  })
  addRecord(records, {
    id: 'page:about',
    kind: '页面',
    site: 'portal',
    siteTitle: '关于本站',
    title: '关于本站',
    subtitle: '研读铁律与数据说明',
    href: '/about',
    text: '关于本站 研读铁律 数据说明 非医疗建议 不宣化 不算命',
  })

  for (const site of SITES) {
    addRecord(records, {
      id: `site:${site.key}`,
      kind: '页面',
      site: site.key,
      title: site.portalTitle,
      subtitle: site.portalDesc,
      href: site.home,
      text: uniqText(site.brand, site.portalTitle, site.portalDesc, ...site.nav.map((n) => n.label)),
    })
    for (const nav of site.nav) {
      addRecord(records, {
        id: `page:${site.key}:${nav.to}`,
        kind: '页面',
        site: site.key,
        title: nav.label,
        subtitle: site.portalTitle,
        href: nav.to,
        text: uniqText(nav.label, site.portalTitle, site.portalDesc),
      })
    }
  }

  for (const t of LEARN_TOPICS) {
    addRecord(records, {
      id: `learn:${t.id}`,
      kind: '页面',
      site: 'yijing',
      title: t.title,
      subtitle: `学堂 · ${t.time}`,
      href: t.to,
      text: uniqText(t.title, t.desc, t.time),
    })
  }
}

function indexYijing(records) {
  const hexagrams = readJson(path.join(SRC_DATA, 'yijing/hexagrams.json'))
  for (const h of hexagrams) {
    addRecord(records, {
      id: `hex:${h.id}`,
      kind: '易经',
      site: 'yijing',
      title: `${h.fullName} 第${h.id}卦`,
      subtitle: h.summary || '',
      href: `/hexagram/${h.id}`,
      text: uniqText(
        h.name, h.fullName, h.pinyin, h.summary, h.imagery,
        textOf(h.judgment), textOf(h.tuan), textOf(h.daxiang),
        textOf(h.lines), textOf(h.extra), h.xugua, h.zagua,
      ),
      preview: uniqText(h.judgment?.original || textOf(h.judgment), ...(Array.isArray(h.lines) ? h.lines : []).map((l) => l?.original || textOf(l))),
    })
  }

  for (const [slug, fallbackTitle] of YIJING_CLASSICS) {
    const book = readJson(path.join(SRC_DATA, `yijing/classics/${slug}.json`))
    addRecord(records, {
      id: `book:yijing:${slug}`,
      kind: '经典',
      site: 'yijing',
      title: book.title || fallbackTitle,
      subtitle: '易经经传',
      href: `/classics/${slug}/1`,
      text: uniqText(book.title, fallbackTitle),
    })
    for (const ch of book.chapters) {
      addRecord(records, {
        id: `chapter:yijing:${slug}:${ch.no}`,
        kind: '正文',
        site: 'yijing',
        title: `${book.title || fallbackTitle} · 第${ch.no}章`,
        subtitle: '易经经传',
        href: `/classics/${slug}/${ch.no}`,
        text: uniqText(ch.title, textOf(ch.paragraphs)),
        preview: originalOf(ch.paragraphs),
      })
    }
  }

  for (const g of readJson(path.join(SRC_DATA, 'yijing/glossary.json'))) {
    addRecord(records, {
      id: `glossary:${g.key}`,
      kind: '注疏',
      site: 'yijing',
      title: g.name,
      subtitle: '易学名词',
      href: `/basics/glossary#${g.key}`,
      text: uniqText(g.name, ...(g.aliases || []), g.brief),
    })
  }
  for (const s of readJson(path.join(SRC_DATA, 'yijing/shili.json'))) {
    addRecord(records, {
      id: `shili:${s.id}`,
      kind: '专题',
      site: 'yijing',
      title: s.title,
      subtitle: `${s.era} · ${s.kind === 'shi' ? '筮占' : '引易'}`,
      href: `/shili/${s.id}`,
      text: uniqText(s.title, s.background, textOf(s.paragraphs), textOf(s.reading)),
    })
  }
  for (const s of readJson(path.join(SRC_DATA, 'yijing/shishi.json'))) {
    addRecord(records, {
      id: `shishi:${s.id}`,
      kind: '专题',
      site: 'yijing',
      title: s.title,
      subtitle: '爻辞中的商周史事',
      href: `/basics/shishi#${s.id}`,
      text: uniqText(s.title, textOf(s.paragraphs)),
    })
  }
  for (const p of readJson(path.join(SRC_DATA, 'yijing/renwu.json'))) {
    addRecord(records, {
      id: `renwu:${p.id}`,
      kind: '专题',
      site: 'yijing',
      title: p.name,
      subtitle: `${p.era} · 人物志`,
      href: `/basics/yuanliu#${p.id}`,
      text: uniqText(p.name, p.era, textOf(p.paragraphs)),
    })
  }
}

function indexCorpus(records, corpus) {
  const metaFile = path.join(SRC_DATA, corpus, 'texts.json')
  if (!exists(metaFile)) return
  const metas = readJson(metaFile).filter((t) => t.status !== 'pending')
  const yanyiFile = path.join(SRC_DATA, corpus, 'yanyi.json')
  const yanyi = exists(yanyiFile) ? readJson(yanyiFile) : {}
  const zhushiDir = path.join(SRC_DATA, corpus, 'zhushi-anchored')

  for (const m of metas) {
    addRecord(records, {
      id: `book:${corpus}:${m.slug}`,
      kind: '经典',
      site: corpus,
      title: m.title,
      subtitle: m.authorNote || siteLabel(corpus),
      href: `/${corpus}/${m.slug}`,
      text: uniqText(m.title, m.alias, m.authorNote, m.portalDesc),
    })

    const bookFile = path.join(SRC_DATA, corpus, `classics/${m.slug}.json`)
    if (!exists(bookFile)) continue
    const book = readJson(bookFile)
    const anchorsFile = path.join(zhushiDir, `${m.slug}.json`)
    const anchors = exists(anchorsFile) ? readJson(anchorsFile) : {}
    for (const ch of book.chapters) {
      const noteText = textOf(anchors[String(ch.no)])
      const yanyiText = textOf(yanyi[m.slug]?.[String(ch.no)])
      addRecord(records, {
        id: `chapter:${corpus}:${m.slug}:${ch.no}`,
        kind: '正文',
        site: corpus,
        title: `${book.title || m.title} · ${ch.title || `第${ch.no}${m.sectionUnit || '章'}`}`,
        subtitle: siteLabel(corpus),
        href: chapterHref(corpus, m.slug, ch.no, m),
        text: uniqText(ch.title, textOf(ch.paragraphs), noteText, yanyiText),
        preview: originalOf(ch.paragraphs),
      })
    }
  }
}

function indexConceptsAndDebates(records) {
  const concepts = readJson(path.join(SRC_DATA, 'concepts.json'))
  for (const c of concepts.clusters || []) {
    addRecord(records, {
      id: `concept:${c.term}`,
      kind: '专题',
      site: 'portal',
      siteTitle: '义理专题',
      title: c.term,
      subtitle: '义理互见',
      href: '/concepts',
      text: uniqText(c.term, c.gloss, textOf(c.loci)),
    })
  }

  const debateIndex = readJson(path.join(SRC_DATA, 'debates/index.json'))
  for (const t of debateIndex.topics || []) {
    let detail = {}
    const f = path.join(SRC_DATA, `debates/${t.id}.json`)
    if (exists(f)) detail = readJson(f)
    addRecord(records, {
      id: `debate:${t.id}`,
      kind: '专题',
      site: 'portal',
      siteTitle: '百家争鸣',
      title: t.title,
      subtitle: t.question || t.category || '百家争鸣',
      href: `/debates/${t.id}`,
      text: uniqText(t.title, t.category, t.concept, t.question, textOf(t.schools), detail.framing, textOf(detail.rounds), detail.coda),
    })
  }
}

// 逐页分享卡(OG)索引:href → [标题, 副标, 正文摘录]。
// 复用搜索索引的同一批 records —— 标题/副标/链接本来就是同一套,另建一份必然走样。
// 消费者是 functions/_middleware.js:只有爬虫 UA 才会读它,普通访客不受影响。
// 只收「分享出去有意义」的页(有 subtitle 或属内容页),纯功能页不收。
//
// 第三项「正文摘录」是给**搜索引擎收录**用的(2026-08-08 加):
// 本站是纯前端 SPA,爬虫拿到的 <body> 只有一个空 <div id="root">,正文要执行 JS 才出得来。
// Google 会渲染 JS,但**百度基本不渲染**——一个中文古籍站放弃百度不合算。
// 故中间件把这段摘录直接写进 body,让「不执行 JS 也能读到正文」。
// 长度取 `SEO_BODY_MAX`:够表达这一章讲什么,又不至于把分片撑爆(实测约 3–4 倍)。
const SEO_BODY_MAX = 600
// 分片方式 2026-08-08 由「按路径首段」改为「**按整条路径哈希**」。
// 原因:加了正文摘录后,按首段分的片涨到 1.1MB(ru/songci),
// 而中间件每来一个爬虫就要 parse 一整片 —— 会撞 Worker 的 CPU 限额,
// 失败后 try/catch 静默回退,**把现在好用的逐页 meta 一起弄丢**(得不偿失)。
// 哈希分成 256 片后每片约 25KB,取一条的代价与它的价值才匹配。
// 分片规则来自 server/og-index.js(唯一一份,中间件与通知邮件都用它)
function buildOgIndex(records) {
  const shards = {}
  let n = 0
  for (const r of records) {
    if (!r.href || !r.title) continue
    if (r.href.includes('#')) continue          // 段锚共用整页的卡,不单列
    const href = normPath(r.href)
    // 副标常常就是站名(章页尤其),那样的卡等于没信息 —— 退回用正文开头当预览。
    const sub = (r.subtitle || '').trim()
    const body = compact(r.text).slice(0, SEO_BODY_MAX)
    const desc = (sub && sub !== r.siteTitle ? sub : (r.text || '').trim()).slice(0, 70)
    // 站级页(时间轴 / 人物志 / 韵书…)的 siteTitle 就是自己的标题,再拼一遍会出「人物志 · 人物志」→ 这类改缀站名
    const site = r.siteTitle && r.siteTitle !== '观象' && r.siteTitle !== r.title ? ` · ${r.siteTitle}` : ' · 观象'
    ;(shards[ogShardKey(href)] ??= {})[href] = [`${r.title}${site}`, desc, body]
    n++
  }
  cleanOutDir(path.join(OUT_ROOT, 'og'))
  for (const [k, map] of Object.entries(shards)) {
    writeJson(path.join(OUT_ROOT, 'og', `${k}.json`), map)
  }
  console.log(`og index: ${n} 条 / ${Object.keys(shards).length} 片`)
}

// ── sitemap.xml + robots.txt ────────────────────────────────────────────────
// 没有 sitemap,五千个内容页只能靠爬虫从首页一层层摸链接,发现极慢、深页几乎摸不到。
// 这是本站可发现性上**最便宜也最见效**的一件,数据源仍是同一批 records(不另建一份)。
//
// ⚠️ **观书 `/books/*` 一律不收** —— 它是隐藏入口(CLAUDE.md 明写不入公共搜索),
// 收进 sitemap 等于亲手把它交给搜索引擎。og 索引本就不含它,这里再挡一道,
// 因为「哪些页该公开」这件事值得写两遍。
const SITE_ORIGIN = 'https://hexa.gavin.pub'
const HIDDEN_PREFIXES = SITES.filter((x) => x.portalHidden && x.prefix).map((x) => x.prefix)
function buildSitemap(records) {
  const seen = new Set()
  for (const r of records) {
    if (!r.href || !r.title) continue
    if (r.href.includes('#')) continue
    if (r.href.startsWith('/books')) continue    // 隐藏书房,不进 sitemap
    if (HIDDEN_PREFIXES.some((pre) => r.href === pre || r.href.startsWith(pre + '/'))) continue   // 门户暂不露出的组(registry portalHidden),review 通过、去掉标记后自动纳入
    seen.add(r.href)
  }
  const urls = [...seen].sort()
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace('www.sitemap.org', 'www.sitemaps.org'),
    ...urls.map((u) => `<url><loc>${SITE_ORIGIN}${u.replace(/&/g, '&amp;')}</loc></url>`),
    '</urlset>',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'), `${xml}\n`)

  fs.writeFileSync(path.join(ROOT, 'public/robots.txt'), [
    '# 观象 · https://hexa.gavin.pub',
    '# 生成物,勿手改 —— 改 scripts/build-content-assets.mjs 的 buildSitemap()',
    'User-agent: *',
    'Allow: /',
    '',
    '# 观书是隐藏书房(个人读书笔记),不入公共搜索',
    'Disallow: /books',
    '# 个人足迹页与推演工作台无收录价值',
    'Disallow: /me',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ].join('\n') + '\n')

  console.log(`sitemap: ${urls.length} 条 URL(已排除 /books 隐藏书房)`)
}

// ── 观书:从 JS 包搬到 /content/books,好让它能被鉴权 ────────────────────────
// 2026-08-13 owner 定「观书只给管理员看」。此前它是**假隐藏**:
// 书目 index.json 静态 import 进 books-*.js(150KB,任何访客一进站就下载),
// 每篇文章又各是一个可按 URL 直取的 chunk —— 光拦路由等于掩耳盗铃。
//
// 搬到 public/content/books/ 之后:
//   · **Web** 走边缘,由 functions/_middleware.js 鉴权(非管理员 404)
//   · **iOS** 由 Capacitor 本地直供同一条 fetch 路径 —— 天然离线可用、天然不经鉴权
//     (owner 明确要这个:本地内容 + 登录才看 + 离线放开)
// 同一份前端代码,不必分支 —— 白话当初已经趟过这条路。
function buildBooksAssets() {
  const src = path.join(SRC_DATA, 'books')
  if (!exists(src)) return
  const out = path.join(OUT_ROOT, 'books')
  cleanOutDir(out)
  let n = 0, arts = 0
  fs.cpSync(src, out, { recursive: true })
  for (const f of fs.readdirSync(out)) {
    const d = path.join(out, f)
    if (fs.statSync(d).isDirectory()) {
      n += 1
      const ad = path.join(d, 'articles')
      if (exists(ad)) arts += fs.readdirSync(ad).filter((x) => x.endsWith('.json')).length
    }
  }
  console.log(`books assets: ${n} 本 / ${arts} 篇(已移出 JS 包,受中间件鉴权)`)
}

cleanOutDir(OUT_BAIHUA)
cleanOutDir(OUT_SEARCH)

const records = []
const manifest = { version: 1, baihua: {} }
indexPages(records)
indexYijing(records)
for (const corpus of CORPORA) indexCorpus(records, corpus)
indexConceptsAndDebates(records)
buildBaihuaAssets(records, manifest)
buildDaoduAssets(manifest, records)
buildSchoolAssets(manifest, records)

writeJson(path.join(OUT_ROOT, 'manifest.json'), manifest)
buildSearchAssets(records)
buildOgIndex(records)
buildSitemap(records)
buildBooksAssets()

// 首页要亮的那几个数(2026-08-08)。**构建期算,前端不手写** ——
// 手写的数字必然过时:门户卡片描述当年就是因为手写才长期显示错的书目数(v1.40.0 修过一次)。
// 只出计数,不出清单,几百字节。
{
  const nBooks = fs.readdirSync(SRC_DATA)
    .map((c) => path.join(SRC_DATA, c, 'classics'))
    .filter(exists)
    .reduce((n, d) => n + fs.readdirSync(d).filter((f) => f.endsWith('.json')).length, 0)
  const nBaihua = Object.values(manifest.baihua)
    .flatMap((books) => Object.values(books))
    .reduce((n, b) => n + b.count, 0)
  const debFile = path.join(SRC_DATA, 'debates/index.json')
  const mjFile = path.join(SRC_DATA, 'mingju.json')
  const cpFile = path.join(SRC_DATA, 'concepts.json')
  const mj = exists(mjFile) ? readJson(mjFile) : null
  const cp = exists(cpFile) ? readJson(cpFile) : null
  writeJson(path.join(OUT_ROOT, 'stats.json'), {
    books: nBooks,
    baihua: nBaihua,
    debates: exists(debFile) ? (readJson(debFile).topics || []).length : 0,
    mingju: Array.isArray(mj) ? mj.length : (mj?.items?.length || 0),
    concepts: Array.isArray(cp) ? cp.length : (cp?.clusters?.length || 0),
    groups: new Set(SITES.map((s) => s.group)).size,
    shelves: SITES.filter((s) => !s.portalHidden).length,   // 门户书架数(首页 hero / meta description 用)
    // 首页「索引」段用(人物志 / 时间轴计数),与其余数字一样从数据读、不手写
    people: exists(path.join(SRC_DATA, 'renwu.json')) ? (readJson(path.join(SRC_DATA, 'renwu.json')).people || []).length : 0,
    timeline: exists(path.join(SRC_DATA, 'timeline.json')) ? (readJson(path.join(SRC_DATA, 'timeline.json')).items || []).length : 0,
  })
}

const baihuaCount = Object.values(manifest.baihua)
  .flatMap((books) => Object.values(books))
  .reduce((n, b) => n + b.count, 0)
console.log(`content assets: baihua ${baihuaCount} chapters, search ${records.length} records`)
