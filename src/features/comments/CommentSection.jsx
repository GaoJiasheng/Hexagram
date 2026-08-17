import { useEffect, useRef, useState } from 'react'
import SchoolAvatar from '../auth/SchoolAvatar.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { TURNSTILE_SITE_KEY } from './config.js'
import { apiFetch, friendlyError, IS_NATIVE } from '../auth/apiClient.js'

const REPORT_REASONS = [
  ['abuse', '辱骂'],
  ['porn', '色情'],
  ['spam', '广告'],
  ['illegal', '违法'],
  ['other', '其他'],
]

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
  const [actingId, setActingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [reportingId, setReportingId] = useState(null)
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

    apiFetch(`/api/comments?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await responseData(response)
        if (!response.ok) throw new Error(data?.error || '评论加载失败,请稍后重试')
        setComments(Array.isArray(data?.comments) ? data.comments : [])
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return
        requestedRef.current = false
        setError(friendlyError(fetchError, '评论加载失败,请稍后重试'))
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
          // token 约 5 分钟过期。不挂这两个回调,控件会一直显示绿色「成功!」,
          // 而手里的 token 早已失效 —— 用户看着「已验证」却怎么发都被回 403。
          'expired-callback': () => window.turnstile?.reset(widgetIdRef.current),
          'error-callback': () => window.turnstile?.reset(widgetIdRef.current),
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
      const response = await apiFetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corpus, slug, chapter, body: trimmed, turnstileToken }),
      })
      const data = await responseData(response)
      if (!response.ok) throw new Error(data?.error || '评论发布失败,请稍后重试')
      setComments((current) => [data.comment, ...current])
      setBody('')
    } catch (submitError) {
      setError(friendlyError(submitError, '发布失败,请稍后重试'))
    } finally {
      setSubmitting(false)
      // ⚠️ **无论成败都要重置控件**,别只在成功时重置(2026-08-15 修)。
      // Turnstile 的 token 是**一次性、约 5 分钟过期**的。原先只在成功分支 reset,
      // 于是一旦失败(token 过期或已被消费),控件仍显示绿色「成功!」——
      // **界面在骗人**:用户看着验证已通过,却拿着一个废 token 反复重试,
      // 每次都被服务端回 403,永远发不出去。owner 就是这么卡住的。
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current)
    }
  }

  async function deleteComment(id) {
    if (!window.confirm('确定删除这条评论吗？')) return
    setDeletingId(id)
    setError('')
    try {
      const response = await apiFetch(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(data?.error || '评论删除失败,请稍后重试')
      }
      setComments((current) => current.filter((comment) => comment.id !== id))
    } catch (deleteError) {
      setError(friendlyError(deleteError, '删除失败,请稍后重试'))
    } finally {
      setDeletingId(null)
    }
  }

  async function moderateComment(comment) {
    const status = comment.status === 'hidden' ? 'visible' : 'hidden'
    setModeratingId(comment.id)
    setError('')
    try {
      const response = await apiFetch(`/api/admin/comments/${encodeURIComponent(comment.id)}`, {
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
      setError(friendlyError(moderateError, '操作失败,请稍后重试'))
    } finally {
      setModeratingId(null)
    }
  }

  // ── 举报 / 拉黑(App Store 1.2)────────────────────────
  // 两者都是**别人的内容**上的动作,所以只对已登录且非本人的评论显示。
  // 拉黑按评论走(前端不知道也不该知道对方的 user id),服务端自己查作者。
  // 举报走**内联选项**而不是 window.prompt:在 Capacitor 壳里原生弹窗会顶着
  // 「capacitor://localhost 说:」的标题,审核时很难看,而且没法本地化。
  async function submitReport(comment, reason) {
    setActingId(comment.id)
    setReportingId(null)
    setNotice('')
    try {
      const response = await apiFetch(`/api/comments/${encodeURIComponent(comment.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await responseData(response)
      if (!response.ok) throw new Error(data?.error || '举报失败,请稍后重试')
      setNotice(data?.hidden
        ? '已收到举报,该评论已暂时隐藏待复核。'
        : '已收到举报,我们会尽快处理。')
    } catch (reportError) {
      setError(friendlyError(reportError, '举报失败,请稍后重试'))
    } finally {
      setActingId(null)
    }
  }

  async function blockAuthor(comment) {
    setActingId(comment.id)
    setNotice('')
    try {
      const response = await apiFetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id }),
      })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(data?.error || '屏蔽失败,请稍后重试')
      }
      // 就地移除该作者的全部评论,不必等下次拉取
      setComments((current) => current.filter((item) => item.user.displayName !== comment.user.displayName))
      setNotice('已屏蔽。对方不会收到通知;可在「设置 · 已屏蔽的人」里解除。')
    } catch (blockError) {
      setError(friendlyError(blockError, '操作失败,请稍后重试'))
    } finally {
      setActingId(null)
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
                    <SchoolAvatar seed={comment.user.avatarSeed} size={28} />
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
                      {/* 举报与屏蔽在 iOS 上同样要有 —— 只要 App「展示」UGC 就落进
                          App Store 1.2,不是只有能发才算。 */}
                      {user && !comment.mine && (
                        <>
                          <button
                            type="button"
                            className="comment-section__report"
                            disabled={actingId !== null}
                            onClick={() => setReportingId(reportingId === comment.id ? null : comment.id)}
                          >
                            {actingId === comment.id ? '处理中…' : '举报'}
                          </button>
                          <button
                            type="button"
                            className="comment-section__report"
                            disabled={actingId !== null}
                            onClick={() => blockAuthor(comment)}
                            title="只影响你自己的浏览,对方不会收到通知"
                          >
                            屏蔽此人
                          </button>
                        </>
                      )}
                    </div>
                    <p className="comment-section__body">{comment.body}</p>
                    {reportingId === comment.id && (
                      <div className="comment-section__report-panel" role="group" aria-label="举报理由">
                        <span>举报理由:</span>
                        {REPORT_REASONS.map(([value, label]) => (
                          <button key={value} type="button" onClick={() => submitReport(comment, value)}>{label}</button>
                        ))}
                        <button type="button" onClick={() => setReportingId(null)}>取消</button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {/* iOS 端只读:App 不开 UGC 发布(见 docs/todo.md §1.2),
              但云端已有的评论照常展示,举报/屏蔽也照常可用。 */}
          {IS_NATIVE ? (
            <p className="comment-section__state comment-section__readonly">
              App 内暂不支持发表评论,可在网页版 hexa.gavin.pub 参与讨论。
            </p>
          ) : user ? (
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

          {/* 规则与联系方式必须在评论区当场可达,不能只藏在「关于」页 */}
          <p className="comment-section__rules">
            请就文本说话,勿人身攻击或发广告。看到不妥内容可「举报」,不想再看到某人可「屏蔽此人」。
            <a href="/about#community" target="_blank" rel="noreferrer">社区规则</a>
            <span aria-hidden="true"> · </span>
            <a href="mailto:hexa@gavin.pub">联系我们</a>
          </p>
          {notice && <p className="comment-section__notice" role="status">{notice}</p>}
          {error && <p className="comment-section__error" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
