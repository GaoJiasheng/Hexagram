import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SchoolAvatar, { AVATAR_MARKS } from './SchoolAvatar.jsx'
import { randomArtSeed } from './avatarArt.js'
import { useAuth } from './AuthContext.jsx'
import { apiFetch } from './apiClient.js'

// 换头像(2026-10-06,owner):**不许上传**;一屏随机生成的线条几何图案任选、可「换一批」,
// 另列十一枚流派印记——像 macOS 选头像那样点一下即选中,「用这个」才保存。
const BATCH = 12

function batch() {
  return Array.from({ length: BATCH }, randomArtSeed)
}

export default function AvatarPicker({ onClose }) {
  const { user, refresh } = useAuth()
  const [seeds, setSeeds] = useState(batch)
  const [picked, setPicked] = useState(user?.avatarSeed || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  async function save() {
    if (!picked || picked === user?.avatarSeed) { onClose(); return }
    setSaving(true); setError('')
    try {
      const response = await apiFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarSeed: picked }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '保存失败,请稍后重试')
      await refresh()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const cell = (seed, label) => (
    <button
      key={seed}
      type="button"
      className={`avatar-picker__cell ${picked === seed ? 'is-picked' : ''}`}
      aria-pressed={picked === seed}
      aria-label={label}
      title={label}
      onClick={() => setPicked(seed)}
    >
      <SchoolAvatar seed={seed} size={48} />
    </button>
  )

  return createPortal(
    <div className="settings-overlay avatar-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-sheet avatar-picker" role="dialog" aria-modal="true" aria-label="换头像">
        <div className="settings-sheet__head">
          <span className="settings-sheet__title">换头像</span>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>

        <div className="avatar-picker__preview">
          <SchoolAvatar seed={picked || user?.avatarSeed} size={72} />
          <span>{user?.displayName}</span>
        </div>

        <div className="avatar-picker__group">
          <div className="avatar-picker__head">
            <h3 className="settings-section__title">随机图案</h3>
            <button type="button" className="btn-text" onClick={() => setSeeds(batch())}>换一批</button>
          </div>
          <div className="avatar-picker__grid">
            {seeds.map((seed) => cell(seed, '随机图案'))}
          </div>
        </div>

        <div className="avatar-picker__group">
          <div className="avatar-picker__head">
            <h3 className="settings-section__title">流派印记</h3>
          </div>
          <div className="avatar-picker__grid">
            {AVATAR_MARKS.map((m) => cell(`m:${m.key}`, `流派印记 · ${m.label}`))}
          </div>
        </div>

        {error && <p className="auth-sheet__error" role="alert">{error}</p>}
        <div className="avatar-picker__actions">
          <button type="button" className="btn-text" onClick={onClose} disabled={saving}>取消</button>
          <button type="button" className="auth-sheet__submit" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '用这个'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
