import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function AuthSheet({ open, initialMode = 'login', onClose }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError('')
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape' && !submittingRef.current) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
    }
  }, [open, initialMode, onClose])

  if (!open) return null

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setPassword('')
    setPassword2('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'register' && (password.length < 8 || password.length > 72)) {
      setError('密码长度须为 8–72 位')
      return
    }
    if (mode === 'register' && password2 !== password) {
      setError('两次输入的密码不一致')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      if (mode === 'register') await register({ email, password, password2 })
      else await login({ email, password })
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="settings-overlay auth-overlay" onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
      <div className="settings-sheet auth-sheet" role="dialog" aria-modal="true" aria-label="登录观象">
        <div className="settings-sheet__head auth-sheet__head">
          <div>
            <h2 className="settings-sheet__title auth-sheet__title">登录观象</h2>
            <p className="auth-sheet__subtitle">云端保存足迹、参与评论。不登录不影响任何浏览。</p>
          </div>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭" disabled={submitting}>Esc</button>
        </div>

        <div className="auth-sheet__tabs" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={`auth-sheet__tab ${mode === 'login' ? 'auth-sheet__tab--active' : ''}`} onClick={() => switchMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={`auth-sheet__tab ${mode === 'register' ? 'auth-sheet__tab--active' : ''}`} onClick={() => switchMode('register')}>注册</button>
        </div>

        <form className="auth-sheet__form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>邮箱</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required autoFocus />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} maxLength={72} required />
          </label>
          {mode === 'register' && (
            <label className="auth-field">
              <span>确认密码</span>
              <input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
            </label>
          )}
          {error && <p className="auth-sheet__error" role="alert">{error}</p>}
          <button className="auth-sheet__submit" type="submit" disabled={submitting}>
            {submitting ? '请稍候…' : mode === 'register' ? '注册并登录' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
