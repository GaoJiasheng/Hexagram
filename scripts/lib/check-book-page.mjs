// 典籍目录页新增可选字段的校验闸:art(遮罩插图)/ parts(结构分段)/ lens(透镜词)/ howto(读法一句)/ versions(版本文件存在)
// 各组 src/data/<组>/texts.json 的每本书可选带这些字段;都没有时平稳通过、仪表全 0。
import fs from 'node:fs'
import path from 'node:path'

const GROUPS = ['dao', 'ru', 'fo', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'mingli', 'guwen', 'tangshi', 'songci', 'yuanqu']
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const len = (s) => [...String(s)].length

export default function check({ ROOT, err, warn, info, readJson }) {
  let nArt = 0, nParts = 0, nLens = 0, nHowto = 0

  for (const g of GROUPS) {
    const tp = path.join(ROOT, `src/data/${g}/texts.json`)
    if (!fs.existsSync(tp)) continue
    let texts
    try { texts = readJson(tp) } catch (e) { err(`目录页 ${g}/texts.json 读取失败: ${e.message}`); continue }
    if (!Array.isArray(texts)) continue

    let corpus = null // 懒读 classics
    const chaptersOf = (slug) => {
      const fp = path.join(ROOT, `src/data/${g}/classics/${slug}.json`)
      if (!fs.existsSync(fp)) return null
      try { return readJson(fp).chapters || [] } catch { return null }
    }

    for (const b of texts) {
      const tag = `目录页 ${g}/${b.slug}`

      // 1. art
      if (b.art != null) {
        nArt++
        const a = b.art
        if (typeof a !== 'object' || !a.file) err(`${tag}: art.file 缺失`)
        else {
          const fp = path.join(ROOT, 'public/book-art', g, a.file)
          if (!fs.existsSync(fp)) err(`${tag}: art 文件不存在 public/book-art/${g}/${a.file}`)
          else {
            const buf = fs.readFileSync(fp)
            if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) err(`${tag}: art 不是 PNG`)
            else {
              const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ct = buf[25]
              if (w !== h) err(`${tag}: art 须方形,实为 ${w}x${h}`)
              if (w < 600) err(`${tag}: art 宽 ${w} < 600`)
              // 灰 + alpha(4):墨色进 alpha,CSS mask-image 按 alpha 取遮罩;纯灰度(0)没有 alpha 会整块实心
              if (ct !== 4) err(`${tag}: art 须「灰 + alpha」PNG(颜色类型 4),实为 ${ct}`)
            }
            if (buf.length > 150 * 1024) warn(`${tag}: art ${(buf.length / 1024).toFixed(0)} KB > 150 KB`)
          }
        }
        if (typeof a?.alt !== 'string' || !a.alt.trim()) err(`${tag}: art.alt 须非空`)
        else if (len(a.alt) > 40) err(`${tag}: art.alt ${len(a.alt)} 字 > 40`)
        if (a?.motif != null && typeof a.motif !== 'string') err(`${tag}: art.motif 须为字符串`)
      }

      // 2. parts
      if (b.parts != null) {
        nParts++
        const ps = b.parts
        if (!Array.isArray(ps) || !ps.length) err(`${tag}: parts 须为非空数组`)
        else {
          if (ps.length > 12) err(`${tag}: parts ${ps.length} 段 > 12`)
          const sorted = [...ps].sort((x, y) => x.from - y.from)
          let bad = false
          for (const p of sorted) {
            if (typeof p.title !== 'string' || !p.title.trim()) { err(`${tag}: parts 有段 title 为空`); bad = true }
            if (!Number.isInteger(p.from) || !Number.isInteger(p.to)) { err(`${tag}: parts「${p.title}」from/to 须为整数`); bad = true; continue }
            if (p.from > p.to) { err(`${tag}: parts「${p.title}」from ${p.from} > to ${p.to}`); bad = true }
          }
          if (!bad) {
            if (sorted[0].from !== 1) err(`${tag}: parts 首段 from 须为 1,实为 ${sorted[0].from}`)
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1], cur = sorted[i]
              if (cur.from <= prev.to) err(`${tag}: parts「${prev.title}」与「${cur.title}」重叠(${prev.to} / ${cur.from})`)
              else if (cur.from !== prev.to + 1) err(`${tag}: parts「${prev.title}」与「${cur.title}」之间留空(${prev.to + 1}–${cur.from - 1})`)
            }
            const last = sorted[sorted.length - 1]
            if (Number.isInteger(b.sections) && last.to !== b.sections) err(`${tag}: parts 末段 to ${last.to} ≠ sections ${b.sections}`)
          }
        }
      }

      // 3. lens
      // 注意:mingli 三本书已有旧字段 lens(字符串,三派镜头),与新透镜数组同名——字符串视为旧字段,跳过
      if (b.lens != null && typeof b.lens !== 'string') {
        nLens++
        const L = b.lens
        if (!Array.isArray(L)) err(`${tag}: lens 须为数组`)
        else {
          if (L.length < 2 || L.length > 12) err(`${tag}: lens 须 2–12 个,实为 ${L.length}`)
          if (new Set(L).size !== L.length) err(`${tag}: lens 有重复词`)
          const chs = chaptersOf(b.slug)
          if (!chs) warn(`${tag}: 找不到 classics/${b.slug}.json,无法核 lens 命中`)
          for (const w of L) {
            if (typeof w !== 'string' || len(w) < 1 || len(w) > 4) { err(`${tag}: lens「${w}」须 1–4 字`); continue }
            if (!chs) continue
            const hit = chs.filter((c) => (c.title || '').includes(w) || (c.paragraphs || []).some((p) => (p.original || '').includes(w))).length
            if (hit === 0) err(`${tag}: lens「${w}」在全书 0 章命中`)
            else if (chs.length > 1 && hit === chs.length) warn(`${tag}: lens「${w}」命中全部 ${chs.length} 章,没有区分度`)
          }
        }
      }

      // 4. howto
      if (b.howto != null) {
        nHowto++
        if (typeof b.howto !== 'string' || !b.howto.trim()) err(`${tag}: howto 须为非空字符串`)
        else if (len(b.howto) > 48) err(`${tag}: howto ${len(b.howto)} 字 > 48`)
      }

      // 5. versions
      if (b.versions != null) {
        if (typeof b.versions !== 'string') err(`${tag}: versions 须为字符串`)
        else if (!fs.existsSync(path.join(ROOT, `src/data/${g}/${b.versions}.json`))) err(`${tag}: versions 文件不存在 src/data/${g}/${b.versions}.json`)
      }
    }
  }

  info(`目录页: 插图 ${nArt} 本 · 分段 ${nParts} 本 · 透镜 ${nLens} 本 · 读法 ${nHowto} 本`)
}
