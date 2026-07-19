const SITE_ORIGIN = 'https://hexa.gavin.pub'
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const NOTIFICATION_FROM = '观象 <notify@gavin.pub>'
const UTC_8_MS = 8 * 60 * 60 * 1000

export function commentPageUrl(corpus, slug, chapter) {
  if (corpus === 'books') return `${SITE_ORIGIN}/books/${slug}`
  if (corpus === 'yijing') return `${SITE_ORIGIN}/classics/${slug}/${chapter}`
  return `${SITE_ORIGIN}/${corpus}/${slug}/${chapter}`
}

function configuredValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatPublishedAt(timestamp) {
  const date = new Date(Number(timestamp) + UTC_8_MS)
  if (Number.isNaN(date.getTime())) return '时间未知'

  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}（UTC+8）`
}

export function buildCommentNotificationRequest(env, comment, author, anchor) {
  const apiKey = configuredValue(env?.RESEND_API_KEY)
  const ownerEmail = configuredValue(env?.OWNER_NOTIFY_EMAIL)
  if (!apiKey || !ownerEmail || author?.is_owner) return null

  const pageUrl = commentPageUrl(anchor.corpus, anchor.slug, anchor.chapter)
  const email = {
    from: NOTIFICATION_FROM,
    to: ownerEmail,
    subject: `观象新评论 · ${anchor.corpus}/${anchor.slug}/${anchor.chapter}`,
    text: [
      `昵称：${author.display_name}`,
      `发布时间：${formatPublishedAt(comment.createdAt)}`,
      '',
      '评论全文：',
      comment.body,
      '',
      `直达链接：${pageUrl}`,
    ].join('\n'),
  }

  return {
    url: RESEND_EMAILS_URL,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
    },
  }
}

export async function sendCommentNotification(env, comment, author, anchor, fetchImpl = fetch) {
  try {
    const request = buildCommentNotificationRequest(env, comment, author, anchor)
    if (!request) return

    const response = await fetchImpl(request.url, request.init)
    if (!response.ok) {
      console.error('Comment notification failed', { status: response.status })
    }
  } catch (error) {
    console.error('Comment notification failed', error)
  }
}
