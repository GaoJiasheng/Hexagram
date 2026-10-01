import { useEffect, useRef, useState } from 'react'
import { saveAuthHint } from '../yijing/storage.js'
import { useAuth } from './AuthContext.jsx'
import { apiFetch, friendlyError, IS_NATIVE } from './apiClient.js'

// 登录 / 注册 / 找回密码 浮层。
// 续跑 ⑥(2026-10-01,大陆账号体验):邮箱是主路径,Google 放在后面并提示大陆网络可能打不开;
// 新增「忘记密码」——邮箱 → 验证码(10 分钟)→ 新密码,成功即登录(服务端 /auth/code/send + /auth/password/reset)。
export default function AuthSheet({ open, initialMode = 'login', onClose }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError('')
    setInfo('')
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
    setInfo('')
    setPassword('')
    setPassword2('')
    setCode('')
    setCodeSent(false)
  }

  function checkNewPassword() {
    if (password.length < 8 || password.length > 72) return '密码长度须为 8–72 位'
    if (password2 !== password) return '两次输入的密码不一致'
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'register') {
      const bad = checkNewPassword()
      if (bad) { setError(bad); return }
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (mode === 'register') await register({ email, password, password2 })
      else await login({ email, password })
      onClose()
    } catch (requestError) {
      setError(friendlyError(requestError, '登录失败,请稍后重试'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function sendResetCode(event) {
    event.preventDefault()
    setError('')
    if (!email.trim()) { setError('请输入邮箱'); return }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const response = await apiFetch('/api/auth/code/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'reset', email: email.trim() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '验证码发送失败,请稍后重试')
      setCodeSent(true)
      setInfo('若该邮箱注册过,验证码已发出,10 分钟内有效。没收到请看垃圾箱。')
    } catch (requestError) {
      setError(friendlyError(requestError, '验证码发送失败,请稍后重试'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function submitReset(event) {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code.trim())) { setError('验证码为 6 位数字'); return }
    const bad = checkNewPassword()
    if (bad) { setError(bad); return }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const response = await apiFetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), password, password2 }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '重设失败,请稍后重试')
      // 服务端已设好新密码与会话;再走一遍正常登录,让 AuthContext(与原生壳的 token)按既有路径就位
      await login({ email: email.trim(), password })
      onClose()
    } catch (requestError) {
      setError(friendlyError(requestError, '重设失败,请稍后重试'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function handleGoogleLogin() {
    saveAuthHint()
    window.location.href = `/api/auth/google/start?return_to=${encodeURIComponent(window.location.pathname)}`
  }

  const isReset = mode === 'reset'

  return (
    <div className="settings-overlay auth-overlay" onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
      <div className="settings-sheet auth-sheet" role="dialog" aria-modal="true" aria-label="登录观象">
        <div className="settings-sheet__head auth-sheet__head">
          <div>
            <h2 className="settings-sheet__title auth-sheet__title">{isReset ? '找回密码' : '登录观象'}</h2>
            <p className="auth-sheet__subtitle">{isReset ? '用注册邮箱收一枚验证码,设一个新密码。' : '云端保存足迹、参与评论。不登录不影响任何浏览。'}</p>
          </div>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭" disabled={submitting}>Esc</button>
        </div>

        {!isReset && (
          <div className="auth-sheet__tabs" role="tablist" aria-label="账号操作">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={`auth-sheet__tab ${mode === 'login' ? 'auth-sheet__tab--active' : ''}`} onClick={() => switchMode('login')}>登录</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={`auth-sheet__tab ${mode === 'register' ? 'auth-sheet__tab--active' : ''}`} onClick={() => switchMode('register')}>注册</button>
          </div>
        )}

        {isReset ? (
          <form className="auth-sheet__form" onSubmit={codeSent ? submitReset : sendResetCode} noValidate>
            <label className="auth-field">
              <span>注册邮箱</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required autoFocus disabled={codeSent} />
            </label>
            {codeSent && (
              <>
                <label className="auth-field">
                  <span>邮件里的 6 位验证码</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" maxLength={6} required autoFocus />
                </label>
                <label className="auth-field">
                  <span>新密码</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
                </label>
                <label className="auth-field">
                  <span>确认新密码</span>
                  <input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
                </label>
              </>
            )}
            {info && <p className="auth-sheet__info">{info}</p>}
            {error && <p className="auth-sheet__error" role="alert">{error}</p>}
            <button className="auth-sheet__submit" type="submit" disabled={submitting}>
              {submitting ? '请稍候…' : codeSent ? '设新密码并登录' : '发送验证码'}
            </button>
            <p className="auth-sheet__links">
              {codeSent && <button type="button" className="btn-text" onClick={sendResetCode} disabled={submitting}>重发验证码</button>}
              <button type="button" className="btn-text" onClick={() => switchMode('login')} disabled={submitting}>返回登录</button>
            </p>
          </form>
        ) : (
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
            {mode === 'login' && (
              <p className="auth-sheet__links">
                <button type="button" className="btn-text" onClick={() => switchMode('reset')} disabled={submitting}>忘记密码?</button>
              </p>
            )}
          </form>
        )}

        {/* Google 登录只在网页可用:原生要另建 iOS OAuth 客户端 + 走
            ASWebAuthenticationSession 才能回跳,现在点了回不来,所以直接不渲染。
            大陆网络常常打不开 Google,所以它放在邮箱之后、并把话说在前面。 */}
        {mode === 'login' && !IS_NATIVE && (
          <div className="auth-sheet__oauth">
            <div className="auth-sheet__divider"><span>或</span></div>
            <button className="auth-sheet__submit auth-sheet__google" type="button" onClick={handleGoogleLogin} disabled={submitting}>
              用 Google 登录
            </button>
            <p className="auth-sheet__hint">中国大陆网络通常打不开 Google,请用上面的邮箱登录或注册。</p>
          </div>
        )}
      </div>
    </div>
  )
}
