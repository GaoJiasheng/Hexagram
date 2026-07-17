import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarkableBlock from './MarkableBlock.jsx'
import {
  getCorpusMarks,
  getCorpusNotes,
  saveCorpusNote,
  toggleCorpusMark,
} from '../storage.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  }
}

const markKey = 'yijing:hexagrams:1:line1'

function props(overrides = {}) {
  return {
    markKey,
    itemId: 'line1',
    original: '初九：潜龙勿用。',
    translation: '初九：龙潜伏着，不宜有所作为。',
    sourceLabel: '初九',
    marks: {},
    notes: {},
    editingKey: null,
    draft: '',
    copiedKey: null,
    onToggleMark: vi.fn(),
    onOpenEdit: vi.fn(),
    onSaveNote: vi.fn(),
    onCancelEdit: vi.fn(),
    onCopyLink: vi.fn(),
    onSetDraft: vi.fn(),
    onQuote: vi.fn(),
    children: <p>初九：潜龙勿用。</p>,
    ...overrides,
  }
}

describe('MarkableBlock', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
    })
  })

  it('把四个按钮映射到短 itemId、实际锚点与金句内容', () => {
    const p = props({ itemId: 'daxiang', anchorId: 'xiang', anchorOnParent: true })
    const tree = MarkableBlock(p)
    const block = tree.props.children[0]
    const buttons = block.props.children[1].props.children

    expect(block.props.id).toBeUndefined()
    buttons[0].props.onClick()
    buttons[2].props.onClick()
    buttons[3].props.onClick()

    expect(p.onToggleMark).toHaveBeenCalledWith('daxiang', p.original)
    expect(p.onCopyLink).toHaveBeenCalledWith('xiang')
    expect(p.onQuote).toHaveBeenCalledWith(p.original, p.translation, p.sourceLabel)
  })

  it('按完整 markKey 显示收藏、批注与复制完成状态', () => {
    const note = { text: '这一爻重在潜藏。' }
    const p = props({
      marks: { [markKey]: { snippet: '初九：潜龙勿用。' } },
      notes: { [markKey]: note },
      copiedKey: 'line1',
    })
    const tree = MarkableBlock(p)
    const buttons = tree.props.children[0].props.children[1].props.children
    const preview = tree.props.children[1]

    expect(buttons[0].props.className).toContain('para-act--on')
    expect(buttons[1].props.className).toContain('para-act--on')
    expect(buttons[2].props.children).toBe('✓')
    preview.props.onClick()
    expect(p.onOpenEdit).toHaveBeenCalledWith(markKey, note.text)
  })

  it('内联编辑器使用当前草稿保存到短 itemId', () => {
    const p = props({ editingKey: markKey, draft: '新的批注' })
    const tree = MarkableBlock(p)
    const editor = tree.props.children[2]
    const textarea = editor.props.children[0]
    const [save, cancel] = editor.props.children[1].props.children

    textarea.props.onChange({ target: { value: '改后的批注' } })
    save.props.onClick()
    cancel.props.onClick()

    expect(p.onSetDraft).toHaveBeenCalledWith('改后的批注')
    expect(p.onSaveNote).toHaveBeenCalledWith('line1', p.original)
    expect(p.onCancelEdit).toHaveBeenCalledOnce()
  })

  it('复用 corpus 存储并持久化易经小节 key', () => {
    toggleCorpusMark('yijing', 'hexagrams', 1, 'line1', '初九：潜龙勿用。')
    saveCorpusNote('yijing', 'hexagrams', 1, 'line1', '测试批注', '初九：潜龙勿用。')

    expect(JSON.parse(localStorage.getItem('guanxiang.v1.corpusMarks'))).toHaveProperty(markKey)
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.corpusNotes'))).toHaveProperty(markKey)
    expect(getCorpusMarks()[markKey]).toMatchObject({
      corpus: 'yijing',
      slug: 'hexagrams',
      ch: 1,
      i: 'line1',
    })
    expect(getCorpusNotes()[markKey]).toMatchObject({ text: '测试批注' })

    toggleCorpusMark('yijing', 'hexagrams', 1, 'line1', '初九：潜龙勿用。')
    saveCorpusNote('yijing', 'hexagrams', 1, 'line1', '   ', '初九：潜龙勿用。')
    expect(getCorpusMarks()[markKey]).toBeUndefined()
    expect(getCorpusNotes()[markKey]).toBeUndefined()
  })
})
