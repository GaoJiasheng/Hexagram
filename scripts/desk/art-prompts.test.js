// 插画 prompt 预备:自查规则(art-prompts-check)与出图脚本「有现成 prompt 就只出图」的指令(不调 Codex)
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkUnit } from './art-prompts-check.mjs'
import { LAYOUT_PHRASE, CLOSING } from './art-prompts-rules.mjs'
import * as GS from './gen-art-guanshu.mjs'
import * as GA from './gen-art.mjs'

const STYLE = GS.STYLE
const SCENE_A = 'A small French town square on an election Sunday in the 1890s. On the left the pale stone front of a modest town hall with a limp flag over its open double door; the long wall beside it is pasted over and over with identical blank election bills, layered and peeling. Through the door a wooden ballot urn stands on a table covered with green baize. A thin line of men in dark jackets waits along the wall, small and seen from behind. On the right a plane tree and a stone fountain.'
const SCENE_B = 'The jury deliberation room of a provincial assize court, empty during a recess. One long oak table with twelve plain wooden chairs; at the far right end three chairs are pulled tightly together with loose sheets and a pencil between them, the other nine pushed back and scattered. On the left wall hangs a round brass barometer with a blank dial. A tall window lets pale afternoon light fall across the tabletop; a carafe and twelve glasses stand untouched.'
const prompt = (scene, kind = 'head') => `${STYLE} ${scene} ${LAYOUT_PHRASE[kind]} ${CLOSING}`
const input = {
  set: 'guanshu', book: 'demo', category: '', used: [],
  items: [
    { id: 'demo/head-1', kind: 'head', brief: '材料:每隔几年,数百万人各自画下一个记号。同一句口号翻来覆去。四十个卖水人。' },
    { id: 'demo/head-2', kind: 'head', brief: '材料:你和十一个素不相识的人坐进一间屋子。像看晴雨表一样读脸色。真正拿主意的往往只有两三个人。' },
  ],
}
const good = () => ({
  'demo/head-1': { imagery: ['ballot mark 「各自画下一个记号」', 'slogans 「同一句口号翻来覆去」', 'water sellers 「四十个卖水人」'], chosen: 'The polling place and the wall of identical bills, in a small French town in the 1890s.', prompt: prompt(SCENE_A) },
  'demo/head-2': { imagery: ['strangers in a room 「十一个素不相识的人」', 'barometer 「像看晴雨表一样」', 'few decide 「真正拿主意的往往只有两三个人」'], chosen: 'The deliberation room with three chairs drawn together, in a French assize court of the 1890s.', prompt: prompt(SCENE_B) },
})
const errs = (out, inp = input) => { const r = checkUnit(inp, out); return [...r.unit, ...Object.values(r.items).flat()].join('\n') }

describe('art-prompts-check', () => {
  it('合格的一组通过', () => { expect(checkUnit(input, good()).ok).toBe(true) })
  it('缺张 / 多张', () => {
    const o = good(); delete o['demo/head-2']; o['demo/head-9'] = o['demo/head-1']
    expect(errs(o)).toMatch(/缺这一张/); expect(errs(o)).toMatch(/多出来的条目 demo\/head-9/)
  })
  it('画风句、版式句、收尾句缺一不可', () => {
    const o = good(); o['demo/head-1'].prompt = o['demo/head-1'].prompt.replace(STYLE, 'Ink painting.')
    expect(errs(o)).toMatch(/画风句/)
    const o2 = good(); o2['demo/head-1'].prompt = `${STYLE} ${SCENE_A} ${LAYOUT_PHRASE.cover} ${CLOSING}`
    expect(errs(o2)).toMatch(/缺本类版式句/); expect(errs(o2)).toMatch(/混进了 cover/)
    const o3 = good(); o3['demo/head-1'].prompt = prompt(SCENE_A).replace(CLOSING, 'No text.')
    expect(errs(o3)).toMatch(/收尾句/)
  })
  it('画风句外有汉字、禁词、长度', () => {
    const o = good(); o['demo/head-1'].prompt = prompt(SCENE_A + ' 投票站')
    expect(errs(o)).toMatch(/汉字/)
    const o2 = good(); o2['demo/head-1'].prompt = prompt(SCENE_A + ' A glowing light bulb and a handshake.')
    expect(errs(o2)).toMatch(/禁词:light bulb, handshake/)
    const o3 = good(); o3['demo/head-1'].prompt = prompt('A square.')
    expect(errs(o3)).toMatch(/长度|太短/)
  })
  it('门类禁词(健康书)', () => {
    const o = good(); o['demo/head-1'].prompt = prompt(SCENE_A + ' A doctor waits by the door.')
    expect(errs(o, { ...input, category: 'health' })).toMatch(/禁词:doctor/)
  })
  it('imagery 须引材料原话;观书 chosen 须有时代', () => {
    const o = good(); o['demo/head-1'].imagery[0] = 'ballot 「材料里没有的话」'
    expect(errs(o)).toMatch(/imagery 第 1 条/)
    const o2 = good(); o2['demo/head-1'].chosen = 'The polling place and the wall of identical bills, nothing else.'
    expect(errs(o2)).toMatch(/时代与地点/)
  })
  it('同单元撞题、与已出图撞题', () => {
    const o = good(); o['demo/head-2'].prompt = prompt(SCENE_A + ' Evening.')
    expect(errs(o)).toMatch(/与 demo\/head-1 撞题/)
    const inp = { ...input, used: ['cover: The polling place and the wall of identical election bills in a small French town'] }
    expect(errs(good(), inp)).toMatch(/已出的图撞题/)
  })
})

describe('出图脚本的现成 prompt 指令', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-ready-'))
  it('观书:无 ready 照旧;有 ready 只抄写 + 出图', () => {
    const bk = GS.loadBook(GS.INDEX[0].slug), ch = bk.chapters[0]
    const a = GS.buildInstruction(bk, 'head', ch, tmp)
    expect(a.ready).toBe(null); expect(a.instruction).toMatch(/== MATERIAL ==/); expect(a.instruction).toMatch(/STEP 1: design the picture/)
    fs.writeFileSync(path.join(tmp, 'head-0.ready.txt'), 'IMAGERY:\n1. x\n\nCHOSEN: y\n\nPROMPT: z\n')
    const b = GS.buildInstruction(bk, 'head', ch, tmp)
    expect(b.ready).toMatch(/head-0\.ready\.txt$/)
    expect(b.instruction).not.toMatch(/MATERIAL/); expect(b.instruction).toMatch(/PROMPT: z/); expect(b.instruction).toMatch(/1536x1024/)
    expect(GS.buildInstruction(bk, 'cover', null, tmp).instruction).toMatch(/== MATERIAL ==/)
    fs.writeFileSync(path.join(tmp, 'cover.ready.txt'), 'PROMPT: c\n')
    expect(GS.buildInstruction(bk, 'cover', null, tmp).instruction).toMatch(/portrait 2:3, 1024x1536/)
  })
  it('古籍:同上', () => {
    const bk = GA.loadBook('daodejing'), ch = bk.chapters[0]
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'art-ready-ga-'))
    expect(GA.buildInstruction(bk, 'head', ch, d).instruction).toMatch(/Original text/)
    fs.writeFileSync(path.join(d, 'head-1.ready.txt'), 'PROMPT: q\n')
    const r = GA.buildInstruction(bk, 'head', ch, d)
    expect(r.instruction).toMatch(/PROMPT: q/); expect(r.instruction).not.toMatch(/Original text/)
  })
  it('brief 给出版式句与收尾句原文', () => {
    const bk = GS.loadBook(GS.INDEX[0].slug)
    const b = GS.briefFor(bk, 'banner', null)
    expect(b).toContain(LAYOUT_PHRASE.banner); expect(b).toContain(CLOSING); expect(b.startsWith('ONE banner')).toBe(true)
    expect(b).not.toMatch(/STEP 2|out\.png/)
    expect(GA.briefFor(GA.loadBook('jingangjing'), 'head', GA.loadBook('jingangjing').chapters[0])).toMatch(/Buddhist text/)
  })
})
