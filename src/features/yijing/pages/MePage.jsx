import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import HexagramCard from '../components/HexagramCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { getBookmarks, getNotes, getDivinations, deleteDivination, saveDivinations, exportData, importData, clearAllData, saveSettings, getProgress } from '../storage.js'
import { getHexagram, hexagramById } from '../data.js'
import { useSettings } from '../SettingsContext.jsx'
import { lineTitle } from '../engine/transforms.js'
import { LEARN_TOPICS, topicStatus } from './BasicsPage.jsx'

const TABS = ['收藏', '笔记', '推演历史', '研习', '设置']

export default function MePage() {
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
    list.sort((a, b) => b.createdAt?.localeCompare(a.createdAt || ''))
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
              : <div className="div-list">
                  {divinations.map(d => {
                    const hex = getHexagram(d.gua)
                    const bianHex = d.bianGua ? getHexagram(d.bianGua) : null
                    const dongLabels = (d.dong || []).map(p => lineTitle(p, hex?.binary?.[p - 1] === '1')).join('·')
                    return (
                      <div key={d.id} className="div-item">
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
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* 研习 */}
        {tab === '研习' && (() => {
          const progress = getProgress()
          return (
            <div className="study-progress">
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
