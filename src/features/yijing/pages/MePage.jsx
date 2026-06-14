import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import HexagramCard from '../components/HexagramCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { getBookmarks, getNotes, getDivinations, deleteDivination, saveDivinations, setDivinationOutcome, exportData, importData, clearAllData, saveSettings, getProgress } from '../storage.js'
import { getHexagram, hexagramById } from '../data.js'
import { useSettings } from '../SettingsContext.jsx'
import { lineTitle } from '../engine/transforms.js'
import { LEARN_TOPICS, topicStatus } from '../learnTopics.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const TABS = ['收藏', '笔记', '推演历史', '研习', '设置']

// 验占结论(v10 §2)
const VERDICTS = [
  ['ying', '应验'],
  ['partial', '部分'],
  ['bu', '未应'],
]
const VERDICT_LABEL = Object.fromEntries(VERDICTS)

// 单条占例的验占回填编辑器
function OutcomeEditor({ div, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [verdict, setVerdict] = useState(div.outcome?.verdict || '')
  const [note, setNote] = useState(div.outcome?.note || '')

  function save() {
    if (!verdict) return
    setDivinationOutcome(div.id, verdict, note.trim())
    setEditing(false)
    onSaved()
  }

  if (!editing) {
    return div.outcome ? (
      <div className="div-outcome">
        <span className={`div-outcome__badge div-outcome__badge--${div.outcome.verdict}`}>{VERDICT_LABEL[div.outcome.verdict]}</span>
        {div.outcome.note && <span className="div-outcome__note">{div.outcome.note}</span>}
        <button className="btn-text" onClick={() => setEditing(true)}>改</button>
      </div>
    ) : (
      <div className="div-outcome">
        <span className="div-outcome__badge div-outcome__badge--pending">待验</span>
        <button className="btn-text" onClick={() => setEditing(true)}>回填应验</button>
      </div>
    )
  }

  return (
    <div className="div-outcome div-outcome--editing">
      <div className="seg-control">
        {VERDICTS.map(([v, l]) => (
          <button key={v} className={`seg-btn ${verdict === v ? 'seg-btn--active' : ''}`} onClick={() => setVerdict(v)}>{l}</button>
        ))}
      </div>
      <input
        className="div-outcome__input"
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="一句复盘(可空)"
        maxLength={60}
      />
      <button className="btn-text" onClick={save} disabled={!verdict}>存</button>
      <button className="btn-text" onClick={() => setEditing(false)}>取消</button>
    </div>
  )
}

export default function MePage() {
  usePageTitle('我的')
  const [tab, setTab] = useState('收藏')
  const [bookmarks, setBookmarks] = useState(getBookmarks)
  const [notes, setNotes] = useState(getNotes)
  const [divinations, setDivinations] = useState(getDivinations)
  const [deleteUndo, setDeleteUndo] = useState(null)
  const { settings, setSettings } = useSettings()
  const navigate = useNavigate()

  function refreshDivinations() { setDivinations(getDivinations()) }

  function handleDelete(id) {
    const div = divinations.find(d => d.id === id)
    deleteDivination(id)
    refreshDivinations()
    setDeleteUndo(div)
    setTimeout(() => setDeleteUndo(null), 5000)
  }

  function undoDelete() {
    if (!deleteUndo) return
    const list = getDivinations()
    list.push(deleteUndo)
    list.sort((a, b) => (b.id || 0) - (a.id || 0))  // 按 id(=Date.now)排序,旧条目无 createdAt 也稳
    saveDivinations(list)
    refreshDivinations()
    setDeleteUndo(null)
  }

  function handleExport() {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guanxiang-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        importData(data)
        setBookmarks(getBookmarks())
        setNotes(getNotes())
        refreshDivinations()
        alert('导入成功')
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
  }

  const [clearConfirm, setClearConfirm] = useState('')
  function handleClear() {
    if (clearConfirm !== '清空') return
    clearAllData()
    setBookmarks([])
    setNotes({})
    setDivinations([])
    setClearConfirm('')
    alert('数据已清空')
  }

  const bookmarkedHexes = bookmarks.map(getHexagram).filter(Boolean)
  const notesList = Object.entries(notes).map(([id, n]) => ({ id: Number(id), ...n, hex: getHexagram(Number(id)) })).filter(n => n.hex)

  return (
    <div className="me-page">
      <div className="page-header">
        <h1 className="page-title">我的</h1>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'tab-btn--active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="tab-content">
        {/* 收藏 */}
        {tab === '收藏' && (
          bookmarkedHexes.length === 0
            ? <EmptyState icon="☆" text="在卦详情页点 ☆ 收藏喜欢的卦" />
            : <div className="bookmarks-grid">
                {bookmarkedHexes.map(h => <HexagramCard key={h.id} hexagram={h} />)}
              </div>
        )}

        {/* 笔记 */}
        {tab === '笔记' && (
          notesList.length === 0
            ? <EmptyState icon="✏" text="在卦详情页记录你的理解与感悟" />
            : <div className="notes-list">
                {notesList.map(n => (
                  <Link key={n.id} to={`/hexagram/${n.id}#note`} className="note-item">
                    <div className="note-item__header">
                      <strong>{n.hex.name}卦</strong>
                      <span className="text-faint">{n.updatedAt?.slice(0, 10)}</span>
                    </div>
                    <p className="note-item__preview">{n.text.slice(0, 80)}{n.text.length > 80 ? '…' : ''}</p>
                  </Link>
                ))}
              </div>
        )}

        {/* 推演历史 */}
        {tab === '推演历史' && (
          <div>
            {deleteUndo && (
              <div className="undo-toast">
                已删除 <button className="btn-text" onClick={undoDelete}>撤销</button>
              </div>
            )}
            {divinations.length === 0
              ? <EmptyState icon="☲" text="还没有推演记录，去工作台推演一卦" action={{ label: '前往工作台', onClick: () => navigate('/workbench') }} />
              : (() => {
                  const verified = divinations.filter(d => d.outcome)
                  const count = v => verified.filter(d => d.outcome.verdict === v).length
                  return (
                    <div className="div-list">
                      <p className="div-stats text-soft">
                        {divinations.length} 例
                        {verified.length > 0 && ` · 已验 ${verified.length}(应 ${count('ying')} · 部分 ${count('partial')} · 未应 ${count('bu')})`}
                        {verified.length < divinations.length && ` · 待验 ${divinations.length - verified.length}`}
                      </p>
                      {divinations.map(d => {
                        const hex = getHexagram(d.gua)
                        const bianHex = d.bianGua ? getHexagram(d.bianGua) : null
                        const dongLabels = (d.dong || []).map(p => lineTitle(p, hex?.binary?.[p - 1] === '1')).join('·')
                        return (
                          <div key={d.id} className="div-item">
                            <div className="div-item__row">
                              <Link
                                to={`/workbench?gua=${d.gua}${d.dong?.length ? '&dong=' + d.dong.join(',') : ''}`}
                                className="div-item__main"
                              >
                                <span className="div-item__name">{hex?.name || '?'}</span>
                                {d.dong?.length > 0 && <span className="div-item__dong">·动{dongLabels}·</span>}
                                {bianHex && <span className="div-item__bian">变{bianHex.name}</span>}
                                {d.note && <span className="div-item__note">{d.note}</span>}
                                <span className="div-item__date text-faint">{d.createdAt?.slice(0, 10)}</span>
                              </Link>
                              <button className="btn-danger" onClick={() => handleDelete(d.id)} aria-label="删除">删</button>
                            </div>
                            <OutcomeEditor div={d} onSaved={refreshDivinations} />
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
            }
          </div>
        )}

        {/* 研习 */}
        {tab === '研习' && (() => {
          const progress = getProgress()
          const total = LEARN_TOPICS.length
          const readN = LEARN_TOPICS.filter(t => progress.read[t.id]).length
          const quizTopics = LEARN_TOPICS.filter(t => t.quiz)
          const quizN = quizTopics.filter(t => progress.quiz[t.id]?.passed).length
          const usedTopics = LEARN_TOPICS.filter(t => t.usedKeys)
          const usedN = usedTopics.filter(t => t.usedKeys.some(k => progress.used[k])).length
          const nextTopic = LEARN_TOPICS.find(t => !progress.read[t.id]) || null
          return (
            <div className="study-progress">
              <div className="study-dashboard">
                <div className="study-dashboard__stats">
                  <span>读 <strong>{readN}</strong>/{total}</span>
                  <span>练 <strong>{quizN}</strong>/{quizTopics.length}</span>
                  <span>用 <strong>{usedN}</strong>/{usedTopics.length}</span>
                </div>
                {nextTopic && <Link to={nextTopic.to} className="study-dashboard__next">建议下一步：{nextTopic.title} →</Link>}
              </div>
              <p className="text-soft study-progress__hint">读=看完教学页 · 练=练习全对 · 用=在工作台用该法起过卦</p>
              {LEARN_TOPICS.map(t => {
                const st = topicStatus(t, progress)
                return (
                  <Link key={t.id} to={t.to} className="study-progress__row">
                    <span className="study-progress__title">{t.title}</span>
                    <span className="topic-dots">
                      <span className={`topic-dot ${st.read ? 'topic-dot--on' : ''}`}>读</span>
                      {st.quiz !== null && <span className={`topic-dot ${st.quiz ? 'topic-dot--on' : ''}`}>练</span>}
                      {st.used !== null && <span className={`topic-dot ${st.used ? 'topic-dot--on' : ''}`}>用</span>}
                    </span>
                  </Link>
                )
              })}
            </div>
          )
        })()}

        {/* 设置 */}
        {tab === '设置' && (
          <div className="settings-page">
            <div className="settings-section">
              <h3 className="settings-section__title">主题</h3>
              <div className="seg-control">
                {[['light', '亮色'], ['dark', '暗色'], ['system', '跟随系统']].map(([v, l]) => (
                  <button key={v} className={`seg-btn ${settings.theme === v ? 'seg-btn--active' : ''}`} onClick={() => setSettings({ theme: v })}>{l}</button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section__title">显示译文</h3>
              <button
                className={`toggle-btn ${settings.showTranslation ? 'toggle-btn--on' : ''}`}
                onClick={() => setSettings({ showTranslation: !settings.showTranslation })}
                aria-pressed={settings.showTranslation}
              >
                {settings.showTranslation ? '开' : '关'}
              </button>
            </div>

            <div className="settings-section">
              <h3 className="settings-section__title">经文字号</h3>
              <div className="seg-control">
                {[[0.9, '小'], [1, '中'], [1.15, '大']].map(([v, l]) => (
                  <button key={v} className={`seg-btn ${settings.fontScale === v ? 'seg-btn--active' : ''}`} onClick={() => setSettings({ fontScale: v })}>{l}</button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section__title">数据管理</h3>
              <div className="data-actions">
                <button className="btn btn--secondary" onClick={handleExport}>导出全部数据</button>
                <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
                  导入数据
                  <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                </label>
                <div className="clear-section">
                  <input
                    className="clear-input"
                    value={clearConfirm}
                    onChange={e => setClearConfirm(e.target.value)}
                    placeholder={'输入“清空”确认'}
                  />
                  <button
                    className="btn-danger"
                    onClick={handleClear}
                    disabled={clearConfirm !== '清空'}
                  >
                    清空本地数据
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
