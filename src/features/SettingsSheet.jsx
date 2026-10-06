import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import EmailVerifyPanel from './auth/EmailVerifyPanel.jsx'
import FontFamilyControl from './reader/FontFamilyControl.jsx'
import { useSettings } from './yijing/SettingsContext.jsx'
import { FONT_SCALE_STEPS, exportData, importData, clearAllData, getLastSyncAt, getReadDays, saveSettings } from './yijing/storage.js'
import { computeStats, fmtSec } from './reading/readStats.js'
import { READ_STATS_NOTE } from './StatsPage.jsx'
import { useAuth } from './auth/AuthContext.jsx'
import { syncNow } from './auth/sync.js'
import { apiFetch } from './auth/apiClient.js'
import SchoolAvatar from './auth/SchoolAvatar.jsx'

function syncTimeLabel(timestamp) {
  if (!timestamp) return '尚未同步过'
  return `上次同步:${new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

// 全站设置浮层(Tier 0 · 0-2/0-7)——主题/译文/字号 + 数据导出/导入/清除 + 隐私说明。
// 任何分站点 nav 齿轮就地打开,不再把读经站用户甩进易经 /me。数据变更后刷新页面以全站生效。
export default function SettingsSheet({ open, onClose }) {
  const { settings, setSettings } = useSettings()
  const { user, loading: authLoading, enabled: authEnabled, openAuth, logout, refresh } = useAuth()
  const [clearConfirm, setClearConfirm] = useState('')
  const [accountError, setAccountError] = useState('')
  const [syncing, setSyncing] = useState(false)
  // 已屏蔽名单:拉黑必须能解除,否则「拉黑能力」不成立(App Store 1.2 那一条要的是
  // 能力,不是单向操作)。只在登录且面板打开时才拉,免得给游客白发请求。
  const [blocks, setBlocks] = useState(null)
  // 改名:默认昵称是注册邮箱的 @ 前半段,等于把邮箱前缀挂在每条评论上,该给个改的口子
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  // 注销账号:App Store 5.1.1(v) 要求支持注册的 App 必须提供删除入口,光有「退出登录」不算
  const [closing, setClosing] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState(getLastSyncAt)
  // 研读统计三数(今天 / 近 7 天 / 累计)——浮层打开时算一次即可,数据在本机
  const [readSummary, setReadSummary] = useState(null)
  useEffect(() => {
    if (!open) return
    try { const s = computeStats(getReadDays(), []); setReadSummary({ today: s.windows.today.sec, d7: s.windows.d7.sec, all: s.windows.all.sec }) } catch { setReadSummary(null) }
  }, [open])

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

  useEffect(() => {
    if (!open) return undefined
    setLastSyncAt(getLastSyncAt())
    const onComplete = (event) => setLastSyncAt(event.detail?.at || getLastSyncAt())
    window.addEventListener('gx:sync-complete', onComplete)
    return () => window.removeEventListener('gx:sync-complete', onComplete)
  }, [open, user?.id])

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

  async function handleLogout() {
    setAccountError('')
    try {
      await logout()
    } catch (error) {
      setAccountError(error.message)
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    try {
      await syncNow()
      setLastSyncAt(getLastSyncAt())
    } finally {
      setSyncing(false)
    }
  }

  // 「把我的研读时长计入账号」:关 → 立刻删服务端那一行、此后同步不再带;开 → 下次同步把本机记录补上去
  async function toggleShareReading() {
    const next = settings.shareReading === false
    // 先落盘再同步:setSettings 的写入在 React 更新器里跑,不是同步的;getSyncSnapshot 读的是 storage
    saveSettings({ ...settings, shareReading: next })
    setSettings({ shareReading: next })
    if (!user) return
    try {
      if (next) await syncNow()
      else await apiFetch('/api/me/reading', { method: 'DELETE' })
    } catch {
      setAccountError(next ? '同步失败,稍后会自动重试' : '云端记录删除失败,请稍后再关一次')
    }
  }

  async function closeAccount(event) {
    event.preventDefault()
    setAccountError('')
    try {
      const response = await apiFetch('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: closeConfirm }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '注销失败,请稍后重试')
      // 云端已清空,本机副本也一并清掉 —— 否则下次登录会把旧足迹又同步上去
      clearAllData()
      window.location.href = '/'
    } catch (error) {
      setAccountError(error.message)
    }
  }

  async function saveName(event) {
    event.preventDefault()
    const next = nameDraft.trim()
    if (!next || next === user.displayName) { setRenaming(false); return }
    setSavingName(true)
    setAccountError('')
    try {
      const response = await apiFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: next }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '改名失败,请稍后重试')
      await refresh()
      setRenaming(false)
    } catch (error) {
      setAccountError(error.message)
    } finally {
      setSavingName(false)
    }
  }

  useEffect(() => {
    if (!open || !user) { setBlocks(null); return }
    let alive = true
    apiFetch('/api/blocks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setBlocks(d?.blocks || []) })
      .catch(() => { if (alive) setBlocks([]) })
    return () => { alive = false }
  }, [open, user])

  async function unblock(userId) {
    try {
      await apiFetch(`/api/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' })
      setBlocks((current) => (current || []).filter((b) => b.userId !== userId))
    } catch {
      setAccountError('解除屏蔽失败,请稍后重试')
    }
  }

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-sheet" role="dialog" aria-modal="true" aria-label="设置">
        <div className="settings-sheet__head">
          <span className="settings-sheet__title">设置</span>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>

        {authEnabled && (
          <div className="settings-section settings-account">
            <h3 className="settings-section__title">账号</h3>
            {authLoading ? (
              <p className="settings-privacy">正在确认登录状态…</p>
            ) : user ? (
              <>
                <div className="settings-account__user">
                  <SchoolAvatar seed={user.avatarSeed} size={38} />
                  <div className="settings-account__identity">
                    {renaming ? (
                      <form className="settings-account__rename" onSubmit={saveName}>
                        <input
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                          maxLength={24}
                          aria-label="昵称"
                          autoFocus
                        />
                        <button className="btn-text" type="submit" disabled={savingName}>
                          {savingName ? '保存中…' : '保存'}
                        </button>
                        <button className="btn-text" type="button" onClick={() => setRenaming(false)}>取消</button>
                      </form>
                    ) : (
                      <strong>
                        {user.displayName}
                        <button
                          className="btn-text settings-account__rename-open"
                          type="button"
                          onClick={() => { setNameDraft(user.displayName); setRenaming(true) }}
                        >
                          改名
                        </button>
                      </strong>
                    )}
                    <span>{user.email}{user.email && (user.emailVerified
                      ? <em className="settings-account__verified" title="邮箱已验证">✓ 已验证</em>
                      : <em className="settings-account__unverified">未验证</em>)}</span>
                  </div>
                  {!renaming && (
                    <button className="btn-text settings-account__logout" onClick={handleLogout}>退出登录</button>
                  )}
                </div>
                {/* 邮箱验证(2026-10-06):未验证时在这里补验——验过的账号发评论免人机验证,忘记密码也能找回 */}
                {user.email && !user.emailVerified && (
                  <div className="settings-account__verify">
                    <p className="settings-privacy">验证邮箱后,发评论不再需要人机验证,忘记密码也能凭邮件找回。</p>
                    <EmailVerifyPanel compact />
                  </div>
                )}
                <div className="settings-account__sync">
                  <span><strong>云同步</strong> · {syncTimeLabel(lastSyncAt)}</span>
                  <button className="btn-text" onClick={handleSyncNow} disabled={syncing}>
                    {syncing ? '同步中…' : '立即同步'}
                  </button>
                </div>
                <div className="settings-account__share">
                  <label>
                    <span><strong>把我的研读时长计入账号</strong><small>{READ_STATS_NOTE}关闭后只留在本机。</small></span>
                    {/* 滑动开关:状态只靠位置与颜色表达(拨到右、朱砂底 = 开),不再写「开 / 关」
                        —— 一个字说不清「现在是开」还是「点了会开」(owner 2026-10-01) */}
                    <button
                      type="button"
                      role="switch"
                      className={`switch ${settings.shareReading !== false ? 'switch--on' : ''}`}
                      aria-checked={settings.shareReading !== false}
                      aria-label="把我的研读时长计入账号"
                      onClick={toggleShareReading}
                    >
                      <span className="switch__knob" aria-hidden="true" />
                    </button>
                  </label>
                </div>
                {/* owner 才出这一行。它只是**入口**,不是权限本身 —— /admin/stats 的内容
                    全部来自 /api/admin/stats,服务端逐次校验会话是不是 owner,
                    藏起这个链接不等于保护,露出来也不等于放行。 */}
                {/* 注销入口刻意做得低调且要抄一遍邮箱 —— 不可撤销的操作不该一键完成 */}
                <div className="settings-account__danger">
                  {closing ? (
                    <form onSubmit={closeAccount}>
                      <p>
                        注销会<strong>永久删除</strong>你的邮箱、登录方式、云端足迹、
                        已发表的评论与举报屏蔽记录,<strong>不可撤销</strong>。想留档请先导出数据。
                      </p>
                      <p>请输入本账号邮箱 <code>{user.email}</code> 以确认:</p>
                      <input
                        value={closeConfirm}
                        onChange={(event) => setCloseConfirm(event.target.value)}
                        placeholder="输入邮箱确认"
                        aria-label="输入邮箱确认注销"
                      />
                      <button className="btn-text settings-account__danger-go" type="submit" disabled={!closeConfirm}>
                        确认注销
                      </button>
                      <button className="btn-text" type="button" onClick={() => { setClosing(false); setCloseConfirm('') }}>
                        取消
                      </button>
                    </form>
                  ) : (
                    <button className="btn-text" type="button" onClick={() => setClosing(true)}>注销账号</button>
                  )}
                </div>
                {blocks?.length > 0 && (
                  <div className="settings-blocks">
                    <span className="settings-blocks__title">已屏蔽的人 · {blocks.length}</span>
                    <ul>
                      {blocks.map((b) => (
                        <li key={b.userId}>
                          <span>{b.displayName}</span>
                          <button className="btn-text" type="button" onClick={() => unblock(b.userId)}>解除</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {user.isOwner && (
                  <Link to="/admin/stats" className="settings-account__admin" onClick={onClose}>
                    <span className="settings-account__admin-seal" aria-hidden="true">统</span>
                    <span>
                      <strong>站点后台</strong>
                      <span>阅读统计 · 评论管理</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </Link>
                )}
              </>
            ) : (
              <div className="settings-account__guest">
                <p className="settings-privacy">登录后可在云端保存足迹、参与评论；不登录不影响浏览。</p>
                <div className="settings-account__actions">
                  <button className="btn btn--secondary" onClick={() => openAuth('login')}>登录</button>
                  <button className="btn btn--secondary" onClick={() => openAuth('register')}>注册</button>
                </div>
              </div>
            )}
            {accountError && <p className="auth-sheet__error" role="alert">{accountError}</p>}
          </div>
        )}

        <div className="settings-section settings-read">
          <h3 className="settings-section__title">研读统计</h3>
          <div className="settings-read__row">
            {[['今天', readSummary?.today], ['近 7 天', readSummary?.d7], ['累计', readSummary?.all]].map(([l, v]) => (
              <span key={l} className="settings-read__cell"><strong>{readSummary ? fmtSec(v) : '—'}</strong><small>{l}</small></span>
            ))}
            <Link to="/stats" className="btn-text settings-read__more" onClick={onClose}>查看详情 →</Link>
          </div>
          <p className="settings-privacy settings-read__note">{READ_STATS_NOTE}</p>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">主题</h3>
          <div className="seg-control">
            {[['light', '观火'], ['paper-white', '观素'], ['dark', '观水'], ['system', '跟随系统']].map(([v, l]) => (
              <button key={v} className={`seg-btn ${settings.theme === v ? 'seg-btn--active' : ''}`} onClick={() => setSettings({ theme: v })}>{l}</button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">显示译文</h3>
          <button
            type="button"
            role="switch"
            className={`switch ${settings.showTranslation ? 'switch--on' : ''}`}
            onClick={() => setSettings({ showTranslation: !settings.showTranslation })}
            aria-checked={!!settings.showTranslation}
            aria-label="显示译文"
          >
            <span className="switch__knob" aria-hidden="true" />
          </button>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">诗词格律</h3>
          <button
            type="button"
            role="switch"
            className={`switch ${settings.prosody ? 'switch--on' : ''}`}
            onClick={() => setSettings({ prosody: !settings.prosody })}
            aria-checked={!!settings.prosody}
            aria-label="诗词格律"
            title="唐诗 / 宋词 / 元曲阅读页:原文下标韵书所记的平仄与韵部"
          >
            <span className="switch__knob" aria-hidden="true" />
          </button>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">正文字体</h3>
          <FontFamilyControl />
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">正文字号</h3>
          <div className="seg-control">
            {FONT_SCALE_STEPS.map(([v, l]) => (
              <button key={v} className={`seg-btn ${settings.fontScale === v ? 'seg-btn--active' : ''}`} onClick={() => setSettings({ fontScale: v })}>{l}</button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">正文行宽</h3>
          <div className="seg-control">
            {[['narrow', '窄'], ['normal', '中'], ['wide', '宽']].map(([v, l]) => (
              <button key={v} className={`seg-btn ${settings.readWidth === v ? 'seg-btn--active' : ''}`} onClick={() => setSettings({ readWidth: v })}>{l}</button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section__title">数据管理</h3>
          <p className="settings-privacy">{user ? '收藏、笔记、推演历史与研习进度会在登录设备间云同步；本机仍保留副本，也建议定期导出备份。' : '全部数据(收藏/笔记/推演历史/研习进度)仅存于本浏览器,不上传;清缓存或换设备会丢失,请定期导出备份。'}</p>
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
