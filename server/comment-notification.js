import { lookupPageTitle } from './og-index.js'

const SITE_ORIGIN = 'https://hexa.gavin.pub'
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
// ⚠️ 必须是 **Resend 已验证的那个域**下的地址。
// 2026-08-13 在 Resend 里验的是子域 `send.gavin.pub`(而非根域 gavin.pub)——
// 走子域是为了避开与 ImprovMX 的冲突:根域的 MX 归 ImprovMX 收信(hexa@gavin.pub),
// Resend 若也要根域 MX 就会顶掉它。子域自带一套 MX/DKIM/SPF,两边互不干涉。
// 改这里之前先确认目标域在 Resend 里是 verified,否则发信会被拒。
const NOTIFICATION_FROM = '观象 <notify@send.gavin.pub>'
const UTC_8_MS = 8 * 60 * 60 * 1000

export function commentPagePath(corpus, slug, chapter) {
  if (corpus === 'books') return `/books/${slug}`
  // 单页短经(心经/大学/阴符经等)全书铺一页,住在 /<组>/<书> —— 没有章号那一段。
  // 它们的评论章键固定为 'all',原样拼进 URL 会得到 /fo/xinjing/all 这个**不存在的地址**。
  if (chapter === 'all') return `/${corpus}/${slug}`
  // 易经有两种阅读面:64 卦走 /hexagram/:卦号,经传走 /classics/:篇/:章
  if (corpus === 'yijing') {
    return slug === 'hexagrams' ? `/hexagram/${chapter}` : `/classics/${slug}/${chapter}`
  }
  return `/${corpus}/${slug}/${chapter}`
}

export function commentPageUrl(corpus, slug, chapter) {
  return `${SITE_ORIGIN}${commentPagePath(corpus, slug, chapter)}`
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

// pageTitle 为该页的中文标题(如「道德经 · 一章」),由 sendCommentNotification 查好传进来;
// 查不到就退回 corpus/slug/章号 这种机器味的写法 —— 难看,但绝不能因此不发信。
export function buildCommentNotificationRequest(env, comment, author, anchor, pageTitle = null) {
  const apiKey = configuredValue(env?.RESEND_API_KEY)
  const ownerEmail = configuredValue(env?.OWNER_NOTIFY_EMAIL)
  if (!apiKey || !ownerEmail || author?.is_owner) return null

  const pageUrl = commentPageUrl(anchor.corpus, anchor.slug, anchor.chapter)
  const where = pageTitle || `${anchor.corpus}/${anchor.slug}/${anchor.chapter}`
  const email = {
    from: NOTIFICATION_FROM,
    to: ownerEmail,
    subject: `观象新评论：${where}`,
    text: [
      `位置：${where}`,
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
    // 先探一下要不要发,再去查标题 —— owner 自评等情况直接跳过,省一次索引读取
    if (!buildCommentNotificationRequest(env, comment, author, anchor)) return

    const pageTitle = await lookupPageTitle(
      env, commentPagePath(anchor.corpus, anchor.slug, anchor.chapter), SITE_ORIGIN,
    )
    const request = buildCommentNotificationRequest(env, comment, author, anchor, pageTitle)
    if (!request) return

    const response = await fetchImpl(request.url, request.init)
    if (!response.ok) {
      console.error('Comment notification failed', { status: response.status })
    }
  } catch (error) {
    console.error('Comment notification failed', error)
  }
}
