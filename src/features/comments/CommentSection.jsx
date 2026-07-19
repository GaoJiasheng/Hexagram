import { useEffect, useRef, useState } from 'react'
import PixelAvatar from '../auth/PixelAvatar.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { TURNSTILE_SITE_KEY } from './config.js'

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let turnstileScriptPromise = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-comment-turnstile]')
    const onLoad = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile API unavailable'))
    }
    const onError = () => {
      script?.remove()
      turnstileScriptPromise = null
      reject(new Error('Turnstile script failed to load'))
    }

    if (!script) {
      script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT
      script.async = true
      script.defer = true
      script.dataset.commentTurnstile = 'true'
      document.head.appendChild(script)
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
  })

  return turnstileScriptPromise
}

function formatCommentDate(value) {
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

async function responseData(response) {
  return response.json().catch(() => null)
}

export default function CommentSection({ corpus, slug, chapter }) {
  const { user, openAuth } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [moderatingId, setModeratingId] = useState(null)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const requestedRef = useRef(false)
  const turnstileContainerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!expanded || requestedRef.current) return undefined
    requestedRef.current = true
    const controller = new AbortController()
    const query = new URLSearchParams({ corpus, slug, chapter })
    setLoading(true)
    setError('')

    fetch(`/api/comments?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await responseData(response)
        if (!response.ok) throw new Error(data?.error || '评论加载失败,请稍后重试')
        setComments(Array.isArray(data?.comments) ? data.comments : [])
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return
        requestedRef.current = false
        setError(fetchError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [expanded, corpus, slug, chapter])

  useEffect(() => {
    if (!expanded || !user || !turnstileContainerRef.current) return undefined
    let disposed = false
    setTurnstileReady(false)

    loadTurnstile()
      .then((turnstile) => {
        if (disposed || !turnstileContainerRef.current) return
        widgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'auto',
        })
        setTurnstileReady(true)
      })
      .catch(() => {
        if (!disposed) setError('人机验证加载失败,请稍后重试')
      })

    return () => {
      disposed = true
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
      setTurnstileReady(false)
    }
  }, [expanded, user?.id])

  async function submitComment(event) {
    event.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 1 || body.length > 500 || submitting) return

    const turnstileToken = widgetIdRef.current === null
      ? ''
      : window.turnstile?.getResponse(widgetIdRef.current) || ''
    if (!turnstileToken) {
      setError('请先完成人机验证')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corpus, slug, chapter, body: trimmed, turnstileToken }),
      })
      const data = await responseData(response)
      if (!response.ok) throw new Error(data?.error || '评论发布失败,请稍后重试')
      setComments((current) => [data.comment, ...current])
      setBody('')
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteComment(id) {
    if (!window.confirm('确定删除这条评论吗？')) return
    setDeletingId(id)
    setError('')
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(data?.error || '评论删除失败,请稍后重试')
      }
      setComments((current) => current.filter((comment) => comment.id !== id))
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function moderateComment(comment) {
    const status = comment.status === 'hidden' ? 'visible' : 'hidden'
    setModeratingId(comment.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/comments/${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(data?.error || '评论状态更新失败,请稍后重试')
      }
      setComments((current) => current.map((item) => (
        item.id === comment.id ? { ...item, status } : item
      )))
    } catch (moderateError) {
      setError(moderateError.message)
    } finally {
      setModeratingId(null)
    }
  }

  return (
    <section className="comment-section__root">
      <button
        type="button"
        className="comment-section__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>评论</span>
        <span className="comment-section__chevron" aria-hidden="true">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <div className="comment-section__panel">
          <div className="comment-section__list" aria-live="polite">
            {loading && <p className="comment-section__state">评论加载中…</p>}
            {!loading && !error && comments.length === 0 && (
              <p className="comment-section__state">还没有评论,来写第一条。</p>
            )}
            {!loading && comments.map((comment) => {
              const hidden = comment.status === 'hidden'
              const commentDate = formatCommentDate(comment.createdAt)
              return (
                <article
                  key={comment.id}
                  className={`comment-section__item${hidden ? ' comment-section__item--hidden' : ''}`}
                >
                  <div className="comment-section__avatar">
                    <PixelAvatar seed={comment.user.avatarSeed} size={28} />
                  </div>
                  <div className="comment-section__content">
                    <div className="comment-section__meta">
                      <strong>{comment.user.displayName}</strong>
                      <time dateTime={commentDate}>{commentDate}</time>
                      {hidden && <span className="comment-section__hidden-badge">已隐藏</span>}
                      {user?.isOwner && (
                        <button
                          type="button"
                          className="comment-section__moderate"
                          disabled={moderatingId !== null}
                          onClick={() => moderateComment(comment)}
                        >
                          {moderatingId === comment.id ? '处理中…' : hidden ? '恢复' : '隐藏'}
                        </button>
                      )}
                      {comment.mine && (
                        <button
                          type="button"
                          className="comment-section__delete"
                          disabled={deletingId === comment.id}
                          onClick={() => deleteComment(comment.id)}
                        >
                          {deletingId === comment.id ? '删除中…' : '删除'}
                        </button>
                      )}
                    </div>
                    <p className="comment-section__body">{comment.body}</p>
                  </div>
                </article>
              )
            })}
          </div>

          {user ? (
            <form className="comment-section__composer" onSubmit={submitComment}>
              <textarea
                className="comment-section__textarea"
                value={body}
                maxLength={500}
                rows={4}
                aria-label="评论内容"
                placeholder="写下你的研读心得…"
                onChange={(event) => setBody(event.target.value)}
              />
              <div ref={turnstileContainerRef} className="comment-section__turnstile" />
              <div className="comment-section__actions">
                <span className="comment-section__count">{body.length}/500</span>
                <button
                  type="submit"
                  className="comment-section__submit"
                  disabled={submitting || !turnstileReady || body.trim().length < 1 || body.length > 500}
                >
                  {submitting ? '发布中…' : '发布'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="comment-section__login"
              onClick={() => openAuth('login')}
            >
              登录后参与评论
            </button>
          )}

          {error && <p className="comment-section__error" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
