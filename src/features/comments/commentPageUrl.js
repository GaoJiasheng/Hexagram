const SITE_ORIGIN = 'https://hexa.gavin.pub'

// Keep this frontend copy aligned with server/comment-notification.js. The
// server module targets Pages Functions and must not enter the Vite bundle.
export function commentPageUrl(corpus, slug, chapter) {
  if (corpus === 'books') return `${SITE_ORIGIN}/books/${slug}`
  if (corpus === 'yijing') return `${SITE_ORIGIN}/classics/${slug}/${chapter}`
  return `${SITE_ORIGIN}/${corpus}/${slug}/${chapter}`
}
