// 格律层运行时(design-v24 §7.2):只摆韵书所记,不判出律。
import { describe, it, expect } from 'vitest'
import pingshui from '../../data/rhyme/pingshui.json'
import cilin from '../../data/rhyme/cilin.json'
import zhongyuan from '../../data/rhyme/zhongyuan.json'
import {
  toneOf, rhymePart, analyzeLine, analyzeParagraphs, colorRhymes, isVerseText,
  loadRhymeBook, getRhymeBook, loadProsodyBooks, toneGlyph,
} from './prosody.js'

const books = { pingshui, cilin, zhongyuan }

describe('toneOf', () => {
  it('平 / 仄 / 多 / 未收', () => {
    expect(toneOf('東', pingshui)).toBe('平')
    expect(toneOf('东', pingshui)).toBe('平') // 简体键
    expect(toneOf('月', pingshui)).toBe('仄')
    expect(toneOf('中', pingshui)).toBe('多') // 一東平 / 一送仄
    expect(toneOf('A', pingshui)).toBeNull()
  })
  it('异体退查:隣 → 鄰(平)', () => {
    expect(toneOf('隣', pingshui)).toBe('平')
  })
  it('未载入且未传 book 时返回 null,不抛错', () => {
    // 本测试文件不走 loadRhymeBook 之前,缓存为空
    if (!getRhymeBook('pingshui')) expect(toneOf('東')).toBeNull()
  })
})

describe('rhymePart', () => {
  it('平水韵:秦 → 上平十一真;多音字两部照列', () => {
    const r = rhymePart('秦', 'pingshui', pingshui)
    expect(r.parts.map((p) => p.id)).toEqual(['上平十一真'])
    expect(r.parts[0].label).toBe('十一真')
    expect(rhymePart('中', 'pingshui', pingshui).parts.map((p) => p.id)).toEqual(['上平一東', '去一送'])
  })
  it('走异体表时标出实际查到的写法', () => {
    const r = rhymePart('隣', 'pingshui', pingshui)
    expect(r.variant).toBe(true)
    expect(r.as).toBe('鄰')
    expect(r.parts[0].id).toBe('上平十一真')
  })
  it('词林正韵:同部平仄两收并为一条(着色键按部,不分平仄)', () => {
    const r = rhymePart('中', 'cilin', cilin)
    expect(r.parts).toHaveLength(1)
    expect(r.parts[0].key).toBe('cl:1')
    expect(r.parts[0].tone).toBe('平仄')
    expect(rhymePart('月', 'cilin', cilin).parts[0].label).toBe('十八部')
  })
  it('中原音韵:月 → 车遮', () => {
    expect(rhymePart('月', 'zhongyuan', zhongyuan).parts.map((p) => p.label)).toContain('车遮')
  })
  it('韵书未收返回 null', () => {
    expect(rhymePart('A', 'pingshui', pingshui)).toBeNull()
  })
})

describe('analyzeLine', () => {
  it('按句读切句,逐字平仄,句末韵部', () => {
    const lines = analyzeLine('城阙辅三秦，风烟望五津。', { books })
    expect(lines).toHaveLength(2)
    expect(lines[0].chars.map((x) => x.c).join('')).toBe('城阙辅三秦')
    expect(lines[0].chars.map((x) => x.tone)).toEqual(['平', '仄', '仄', '多', '平']) // 三:平去两收
    expect(lines[0].endPart.parts[0].id).toBe('上平十一真')
    expect(lines[1].endPart.parts[0].id).toBe('上平十一真')
  })
  it('tones:false 只出韵脚;标点、引号、书名号不计字', () => {
    const lines = analyzeLine('哀筝一弄《湘江曲》，声声写尽湘波绿。', { scheme: 'cilin', tones: false, books })
    expect(lines[0].chars.every((x) => x.tone === undefined)).toBe(true)
    expect(lines[0].endChar).toBe('曲')
    expect(lines[1].endPart.parts[0].key).toMatch(/^cl:/)
  })
})

describe('着色(只排「同部同色」,不判合律)', () => {
  it('送杜少府之任蜀州:秦津人邻巾同色,出句句末不着色', () => {
    const paras = [
      '《送杜少府之任蜀州》',
      '城阙辅三秦，风烟望五津。',
      '与君离别意，同是宦游人。',
      '海内存知己，天涯若比隣。',
      '无为在岐路，儿女共沾巾。',
    ]
    const res = analyzeParagraphs(paras, { scheme: 'pingshui', tones: true, books })
    expect(res[0]).toBeNull()
    const lines = res.slice(1).flat()
    const feet = lines.filter((l) => ['秦', '津', '人', '隣', '巾'].includes(l.endChar))
    expect(feet).toHaveLength(5)
    expect(new Set(feet.map((l) => l.color)).size).toBe(1)
    expect(feet[0].color).toBe(1)
    for (const l of lines.filter((x) => ['意', '己', '路'].includes(x.endChar))) expect(l.color).toBeNull()
  })
  it('多部字取本首同部者', () => {
    const lines = colorRhymes([
      { endPart: rhymePart('东', 'pingshui', pingshui) },
      { endPart: rhymePart('中', 'pingshui', pingshui) },
    ])
    expect(lines[1].pick.id).toBe('上平一東')
    expect(lines[0].color).toBe(lines[1].color)
  })
  it('诗题、曲牌题、小题段不算韵文,且把前后分成两首', () => {
    expect(isVerseText('《关山月》')).toBe(false)
    expect(isVerseText('【中吕】喜春来')).toBe(false)
    expect(isVerseText('春宴')).toBe(false)
    expect(isVerseText('春宴排，齐唱喜春来。')).toBe(true)
    const res = analyzeParagraphs(['东风一夜来，', '春宴', '何处是中央，'], { tones: false, books })
    // 两首各只一句,各自不成对,故都不着色
    expect(res[0][0].color).toBeNull()
    expect(res[2][0].color).toBeNull()
  })
})

describe('按需载入', () => {
  it('loadRhymeBook 动态载入并缓存;loadProsodyBooks 标平仄时连平水韵一起载', async () => {
    const b = await loadRhymeBook('cilin')
    expect(b.parts).toHaveLength(19)
    expect(getRhymeBook('cilin')).toBe(b)
    await loadProsodyBooks({ scheme: 'zhongyuan', tones: true })
    expect(getRhymeBook('pingshui')).toBeTruthy()
    expect(toneOf('東')).toBe('平') // 载入后可省略 book
    await expect(loadRhymeBook('nope')).rejects.toThrow()
  })
  it('符号', () => {
    expect(['平', '仄', '多', null].map(toneGlyph).join('')).toBe('○●◐◌')
  })
})

describe('入声(今音异者以韵书为准并说明)', () => {
  it('「国」归入声,标仄并带 ru 标记;「东」不是入声', async () => {
    const { isRusheng } = await import('./prosody.js')
    expect(toneOf('国', pingshui)).toBe('仄')
    expect(isRusheng('国', pingshui)).toBe(true)
    expect(isRusheng('东', pingshui)).toBe(false)
    const [line] = analyzeLine('国破山河在，', { books })
    expect(line.chars[0]).toEqual({ c: '国', tone: '仄', ru: true })
  })
})

describe('入声注只给纯入声字', () => {
  it('「意」去入两收,不注入声', async () => {
    const { isRusheng } = await import('./prosody.js')
    expect(pingshui.index['意'].some((id) => id.startsWith('入'))).toBe(true)
    expect(isRusheng('意', pingshui)).toBe(false)
  })
})
