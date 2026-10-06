import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { friendlyError } from './apiClient.js'

// 邮箱验证小面板(2026-10-06):注册后的那一步、设置浮层「账号」里补验,两处共用。
// 6 位数字码,10 分钟有效;「重发」有 60 秒冷却(与服务端一致,只为少挨一次 429)。
// sentInitially:进来时码是否已经发出(注册那一步为真;设置里补验为假,先给「发送验证码」)。
export default function EmailVerifyPanel({ sentInitially = false, onDone, onSkip, compact = false }) {
  const { user, sendVerifyCode, verifyEmail } = useAuth()
  const [sent, setSent] = useState(sentInitially)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(sentInitially ? `验证码已发到 ${user?.email || '你的邮箱'},10 分钟内有效。没收到请看垃圾箱。` : '')
  const [cool, setCool] = useState(sentInitially ? 60 : 0)
  const timer = useRef(0)
  useEffect(() => {
    if (cool <= 0) return undefined
    timer.current = setTimeout(() => setCool((c) => c - 1), 1000)
    return () => clearTimeout(timer.current)
  }, [cool])

  async function send() {
    setError(''); setBusy(true)
    try {
      await sendVerifyCode()
      setSent(true); setCool(60)
      setInfo(`验证码已发到 ${user?.email || '你的邮箱'},10 分钟内有效。没收到请看垃圾箱。`)
    } catch (e) { setError(friendlyError(e, '验证码发送失败,请稍后再试')) } finally { setBusy(false) }
  }
  async function submit(event) {
    event?.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code.trim())) { setError('验证码为 6 位数字'); return }
    setBusy(true)
    try {
      await verifyEmail(code.trim())
      onDone?.()
    } catch (e) { setError(friendlyError(e, '验证失败,请稍后再试')) } finally { setBusy(false) }
  }

  return (
    <form className={`email-verify ${compact ? 'email-verify--compact' : ''}`} onSubmit={submit} noValidate>
      {info && <p className="auth-sheet__info">{info}</p>}
      {sent ? (
        <>
          <label className="auth-field">
            <span>邮件里的 6 位验证码</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus={!compact} />
          </label>
          {error && <p className="auth-sheet__error" role="alert">{error}</p>}
          <button className="auth-sheet__submit" type="submit" disabled={busy}>{busy ? '请稍候…' : '验证邮箱'}</button>
          <p className="auth-sheet__links">
            <button type="button" className="btn-text" onClick={send} disabled={busy || cool > 0}>{cool > 0 ? `重发验证码(${cool}s)` : '重发验证码'}</button>
            {onSkip && <button type="button" className="btn-text" onClick={onSkip} disabled={busy}>稍后再验证</button>}
          </p>
        </>
      ) : (
        <>
          {error && <p className="auth-sheet__error" role="alert">{error}</p>}
          <button className={compact ? 'btn-text' : 'auth-sheet__submit'} type="button" onClick={send} disabled={busy}>{busy ? '发送中…' : '发送验证码'}</button>
        </>
      )}
    </form>
  )
}
