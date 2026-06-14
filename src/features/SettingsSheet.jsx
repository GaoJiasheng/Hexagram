import { useState, useEffect } from 'react'
import { useSettings } from './yijing/SettingsContext.jsx'
import { exportData, importData, clearAllData } from './yijing/storage.js'

// 全站设置浮层(Tier 0 · 0-2/0-7)——主题/译文/字号 + 数据导出/导入/清除 + 隐私说明。
// 任何分站点 nav 齿轮就地打开,不再把读经站用户甩进易经 /me。数据变更后刷新页面以全站生效。
export default function SettingsSheet({ open, onClose }) {
  const { settings, setSettings } = useSettings()
  const [clearConfirm, setClearConfirm] = useState('')

  // 锁背景滚动 + Esc 关闭 + 关闭还原焦点
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
    }
  }, [open, onClose])

  if (!open) return null

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
    if (!window.confirm('导入将覆盖本机现有数据(收藏/笔记/历史/进度),确定继续?')) { e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importData(JSON.parse(ev.target.result))
        window.location.reload()
      } catch {
        alert('导入失败:文件格式不正确')
      }
    }
    reader.readAsText(file)
  }

  function handleClear() {
    if (clearConfirm !== '清空') return
    clearAllData()
    window.location.reload()
  }

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-sheet" role="dialog" aria-modal="true" aria-label="设置">
        <div className="settings-sheet__head">
          <span className="settings-sheet__title">设置</span>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>

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
          <p className="settings-privacy">全部数据(收藏/笔记/推演历史/研习进度)仅存于本浏览器,不上传;清缓存或换设备会丢失,请定期导出备份。</p>
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
                onChange={(e) => setClearConfirm(e.target.value)}
                placeholder={'输入"清空"确认'}
              />
              <button className="btn-danger" onClick={handleClear} disabled={clearConfirm !== '清空'}>清空本地数据</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
