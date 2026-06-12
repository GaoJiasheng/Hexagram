// 从维基文库摘录左传/国语筮例原文(v9 §1)。
// 产出:src/data/yijing/shili.json
// 原则同各管线:原文一律来自抓取结果;起止标记取自抓取清洗后的文本,未命中即报错中止。
// 注意:左传各公页面标点风格不一(庄闵僖宣用「，。」,成襄昭哀用「．」),标记照页面实况。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, clean, isJunk, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json')
const OUT = path.join(ROOT, 'src/data/yijing/shili.json')

const { fetchPages } = createFetcher(CACHE_FILE)

// 篇目登记表(v9 §1.1 校定稿,21 条)。kind: shi=筮占, yin=引易。
// casts: 卦例,zhi 为 null 表示无之卦(或多爻变等特殊筮法,详见解读)。
const REGISTRY = [
  { id: 'chen-jingzhong', era: '庄公二十二年', eraGroup: '庄闵僖', title: '陈敬仲之筮', kind: 'shi',
    page: '春秋左氏傳/莊公', start: '陈厉公，蔡出也', end: '陈衰，此其昌乎。』',
    casts: [{ ben: 20, zhi: 12, label: '观之否' }] },
  { id: 'bi-wan', era: '闵公元年', eraGroup: '庄闵僖', title: '毕万筮仕', kind: 'shi',
    page: '春秋左氏傳/閔公', start: '初，毕万筮仕于晋', end: '必复其始。」',
    casts: [{ ben: 3, zhi: 8, label: '屯之比' }] },
  { id: 'cheng-ji', era: '闵公二年', eraGroup: '庄闵僖', title: '成季之筮', kind: 'shi',
    page: '春秋左氏傳/閔公', start: '成季之将生也', end: '遂以命之。',
    casts: [{ ben: 14, zhi: 1, label: '大有之乾' }] },
  { id: 'bo-ji', era: '僖公十五年', eraGroup: '庄闵僖', title: '晋献公筮嫁伯姬', kind: 'shi',
    page: '春秋左氏傳/僖公', start: '初，晋献公筮嫁伯姬于秦', end: '职竞由人。』」',
    casts: [{ ben: 54, zhi: 38, label: '归妹之睽' }] },
  { id: 'bu-tufu', era: '僖公十五年', eraGroup: '庄闵僖', title: '卜徒父筮秦伐晋', kind: 'shi',
    page: '春秋左氏傳/僖公', start: '卜徒父筮之', end: '三败及韩。',
    casts: [{ ben: 18, zhi: null, label: '蛊' }] },
  { id: 'qin-wang', era: '僖公二十五年', eraGroup: '庄闵僖', title: '晋文公勤王之筮', kind: 'shi',
    page: '春秋左氏傳/僖公', start: '秦伯师于河上，将纳王', end: '大有去睽而复，亦其所也。」',
    casts: [{ ben: 14, zhi: 38, label: '大有之睽' }] },
  { id: 'bo-liao', era: '宣公六年', eraGroup: '成襄', title: '伯廖论郑公子曼满', kind: 'yin',
    page: '春秋左氏傳/宣公', start: '郑公子曼满，与王子伯廖语', end: '间一岁，郑人杀之。',
    casts: [{ ben: 55, zhi: 30, label: '丰之离' }] },
  { id: 'zhi-zhuangzi', era: '宣公十二年', eraGroup: '成襄', title: '知庄子论师出以律', kind: 'yin',
    page: '春秋左氏傳/宣公', start: '知庄子曰：「此师殆哉', end: '必有大咎。」',
    casts: [{ ben: 7, zhi: 19, label: '师之临' }] },
  { id: 'yan-ling', era: '成公十六年', eraGroup: '成襄', title: '鄢陵之战晋侯筮', kind: 'shi',
    page: '春秋左氏傳/成公', start: '苗贲皇言于晋侯曰', end: '公从之。',
    casts: [{ ben: 24, zhi: null, label: '复' }] },
  { id: 'mu-jiang', era: '襄公九年', eraGroup: '成襄', title: '穆姜之筮', kind: 'shi',
    page: '春秋左氏傳/襄公', start: '穆姜薨于东宫', end: '弗得出矣．',
    casts: [{ ben: 52, zhi: 17, label: '艮之八(史曰艮之随)' }] },
  { id: 'cui-wuzi', era: '襄公二十五年', eraGroup: '成襄', title: '崔武子筮娶棠姜', kind: 'shi',
    page: '春秋左氏傳/襄公/廿五年', start: '齐棠公之妻', end: '遂取之．',
    casts: [{ ben: 47, zhi: 28, label: '困之大过' }] },
  { id: 'fu-zhi-yi', era: '襄公二十八年', eraGroup: '成襄', title: '子大叔论楚子', kind: 'yin',
    page: '春秋左氏傳/襄公', start: '子大叔归复命．告子展曰', end: '吾乃休吾民矣．',
    casts: [{ ben: 24, zhi: 27, label: '复之颐' }] },
  { id: 'yi-he', era: '昭公元年', eraGroup: '昭哀', title: '医和论蛊', kind: 'yin',
    page: '春秋左氏傳/昭公', start: '赵孟曰．何谓蛊', end: '厚其礼而归之．',
    casts: [{ ben: 18, zhi: null, label: '蛊' }] },
  { id: 'shusun-bao', era: '昭公五年', eraGroup: '昭哀', title: '叔孙豹之筮', kind: 'shi',
    page: '春秋左氏傳/昭公', start: '初．穆子之生也', end: '抑少不终．',
    casts: [{ ben: 36, zhi: 15, label: '明夷之谦' }] },
  { id: 'kong-chengzi', era: '昭公七年', eraGroup: '昭哀', title: '孔成子筮立卫元', kind: 'shi',
    page: '春秋左氏傳/昭公', start: '卫襄公．夫人姜氏无子', end: '故孔成子立灵公．',
    casts: [{ ben: 3, zhi: null, label: '屯' }, { ben: 3, zhi: 8, label: '屯之比' }] },
  { id: 'nan-kuai', era: '昭公十二年', eraGroup: '昭哀', title: '南蒯之筮', kind: 'shi',
    page: '春秋左氏傳/昭公', start: '南蒯之将叛也．其乡人或知之', end: '筮虽吉．未也．',
    casts: [{ ben: 2, zhi: 8, label: '坤之比' }] },
  { id: 'cai-mo', era: '昭公二十九年', eraGroup: '昭哀', title: '蔡墨论龙', kind: 'yin',
    page: '春秋左氏傳/昭公', start: '周易有之．在乾之姤曰', end: '谁能物之．',
    casts: [{ ben: 1, zhi: 44, label: '乾之姤(潜龙勿用)' }, { ben: 1, zhi: 2, label: '其坤(群龙无首)' }, { ben: 2, zhi: 23, label: '坤之剥(龙战于野)' }] },
  { id: 'shi-mo', era: '昭公三十二年', eraGroup: '昭哀', title: '史墨论大壮', kind: 'yin',
    page: '春秋左氏傳/昭公', start: '赵简子问于史墨曰．季氏出其君', end: '天之道也．',
    casts: [{ ben: 34, zhi: null, label: '大壮' }] },
  { id: 'yang-hu', era: '哀公九年', eraGroup: '昭哀', title: '阳虎筮救郑', kind: 'shi',
    page: '春秋左氏傳/哀公', start: '晋赵鞅卜救郑', end: '乃止．',
    casts: [{ ben: 11, zhi: 5, label: '泰之需' }] },
  { id: 'chong-er', era: '国语·晋语四', eraGroup: '国语', title: '重耳亲筮得晋国', kind: 'shi',
    page: '國語/卷10', start: '公子亲筮之', end: '是二者，得国之卦也。」',
    casts: [{ ben: 3, zhi: null, label: '贞屯' }, { ben: 16, zhi: null, label: '悔豫(皆八)' }] },
  { id: 'dong-yin', era: '国语·晋语四', eraGroup: '国语', title: '董因迎重耳', kind: 'shi',
    page: '國語/卷10', start: '董因迎公于河', end: '君无惧矣。」',
    casts: [{ ben: 11, zhi: null, label: '泰之八' }] },
]

// 整页清洗为简体文本(段落以 \n 相接;== 标题行剔除)
function cleanPage(wikitext) {
  const out = []
  for (const raw of wikitext.split('\n')) {
    if (/^==/.test(raw)) continue
    const text = clean(raw.replace(/^[*#:;]+/, ''))
    if (isJunk(text)) continue
    out.push(t2s(text))
  }
  return out.join('\n')
}

async function main() {
  const errors = []
  const pageNames = [...new Set(REGISTRY.map((r) => r.page))]
  const rawPages = await fetchPages(pageNames)
  const cleaned = Object.fromEntries(pageNames.map((p) => [p, cleanPage(rawPages[p])]))

  const trPath = path.join(ROOT, 'scripts/authored/shili.json')
  const authored = fs.existsSync(trPath) ? JSON.parse(fs.readFileSync(trPath, 'utf8')) : {}

  const out = []
  for (const r of REGISTRY) {
    const text = cleaned[r.page]
    const si = text.indexOf(r.start)
    if (si === -1) { errors.push(`${r.id}: 起始标记未命中「${r.start}」`); continue }
    if (text.indexOf(r.start, si + 1) !== -1) errors.push(`${r.id}: 起始标记不唯一「${r.start}」`)
    const ei = text.indexOf(r.end, si)
    if (ei === -1) { errors.push(`${r.id}: 终止标记未命中「${r.end}」`); continue }
    const excerpt = text.slice(si, ei + r.end.length)
    const paragraphs = excerpt.split('\n').filter(Boolean).map((p) => ({ original: p, translation: null }))
    const a = authored[r.id] ?? {}
    if (a.translations) {
      paragraphs.forEach((p, i) => { if (a.translations[i]) p.translation = a.translations[i] })
    }
    const { page, start, end, ...meta } = r
    out.push({ ...meta, source: page.startsWith('國語') ? '国语·晋语四' : `左传·${r.era}`, paragraphs,
      background: a.background ?? null, reading: a.reading ?? null })
  }

  if (errors.length) {
    for (const e of errors) console.error('✗', e)
    process.exit(1)
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  const tr = out.filter((s) => s.paragraphs.every((p) => p.translation)).length
  const bg = out.filter((s) => s.background).length
  const rd = out.filter((s) => s.reading?.length).length
  console.log(`筮例: ${out.length} 条(筮占 ${out.filter((s) => s.kind === 'shi').length} · 引易 ${out.filter((s) => s.kind === 'yin').length});背景 ${bg} · 全译 ${tr} · 解读 ${rd}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
