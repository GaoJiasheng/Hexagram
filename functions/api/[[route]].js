import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'

const MAX_BODY_BYTES = 4096

// Pages Functions receives the original /api/* URL, so keep the public prefix
// here and define the individual endpoints relative to it.
const app = new Hono().basePath('/api')

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function getDb(c) {
  const db = c.env?.DB
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1 binding "DB" is unavailable')
  }
  return db
}

async function readJsonBody(c) {
  const declaredLength = Number(c.req.header('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestError(413, 'request body too large')
  }

  const raw = await c.req.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RequestError(413, 'request body too large')
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('body must be an object')
    }
    return parsed
  } catch {
    throw new RequestError(400, 'invalid JSON body')
  }
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    throw new RequestError(400, `invalid ${name}`)
  }
  return value
}

function validateBeat(body) {
  if (typeof body.cid !== 'string' || body.cid !== body.cid.trim() || body.cid.length < 8 || body.cid.length > 64) {
    throw new RequestError(400, 'invalid cid')
  }

  if (
    typeof body.path !== 'string'
    || !body.path.startsWith('/')
    || body.path.length > 500
    || /[\u0000-\u001f\u007f]/.test(body.path)
  ) {
    throw new RequestError(400, 'invalid path')
  }

  const dwell = body.dwell_ms ?? 0
  if (typeof dwell !== 'number' || !Number.isFinite(dwell) || dwell < 0 || dwell > Number.MAX_SAFE_INTEGER) {
    throw new RequestError(400, 'invalid dwell_ms')
  }

  const corpus = optionalText(body.corpus, 'corpus', 32)
  if (corpus !== null && !/^[a-z0-9_-]+$/i.test(corpus)) {
    throw new RequestError(400, 'invalid corpus')
  }

  return {
    clientId: body.cid,
    path: body.path,
    corpus,
    slug: optionalText(body.slug, 'slug', 160),
    chapter: optionalText(body.chapter, 'chapter', 160),
    dwellMs: Math.round(dwell),
  }
}

// The frontend and API are same-origin on Pages, so no CORS middleware is
// needed. If a second trusted origin is added later, configure an explicit
// allow-list rather than reflecting arbitrary origins.
app.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

app.get('/health', async (c) => {
  try {
    const result = await getDb(c).prepare('SELECT 1 AS ok').first()
    if (result?.ok !== 1) throw new Error('Unexpected D1 health-check result')
    return c.json({ ok: true, ts: Date.now() })
  } catch (error) {
    console.error('API health check failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/beat', async (c) => {
  let event
  try {
    event = validateBeat(await readJsonBody(c))
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    throw error
  }

  try {
    await getDb(c)
      .prepare(`
        INSERT INTO reading_events
          (client_id, path, corpus, slug, chapter, dwell_ms, ts)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        event.clientId,
        event.path,
        event.corpus,
        event.slug,
        event.chapter,
        event.dwellMs,
        Date.now(),
      )
      .run()
  } catch (error) {
    console.error('Reading event insert failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }

  // Abuse protection belongs in a Cloudflare Rate Limiting rule. Pages
  // Functions instances are stateless, so an in-memory counter is unreliable.
  return c.body(null, 204)
})

app.onError((error, c) => {
  console.error('Unhandled API error', error)
  return c.json({ ok: false, error: 'internal server error' }, 500)
})

export const onRequest = handle(app)
