import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'

const MAX_BODY_BYTES = 4096
const ADMIN_PASSPHRASE_HEADER = 'X-Admin-Passphrase'
const DAY_MS = 24 * 60 * 60 * 1000

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

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false

  const length = Math.max(left.length, right.length)
  let mismatch = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

function resultRows(result) {
  return Array.isArray(result?.results) ? result.results : []
}

function countValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}

function utcDayStart(timestamp) {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
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

app.use('/admin/*', async (c, next) => {
  let owner
  try {
    owner = await getDb(c)
      .prepare('SELECT 1 AS owner FROM users WHERE is_owner = 1 LIMIT 1')
      .first()
  } catch (error) {
    console.error('Admin authorization lookup failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }

  // The passphrase is deliberately transitional: once a formal owner account
  // exists, this route must wait for Phase 2 login authorization instead.
  if (owner) {
    return c.json({ ok: false, error: 'owner login required' }, 401)
  }

  const expected = c.env?.ADMIN_PASSPHRASE
  const provided = c.req.header(ADMIN_PASSPHRASE_HEADER)
  if (!expected || !constantTimeEqual(provided, expected)) {
    return c.json({ ok: false, error: 'access denied' }, 401)
  }

  await next()
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

app.get('/admin/stats', async (c) => {
  const todayStart = utcDayStart(Date.now())
  const rangeStart = todayStart - (6 * DAY_MS)
  const rangeEnd = todayStart + DAY_MS

  try {
    const db = getDb(c)
    const [totalResult, dailyResult, corpusResult, chaptersResult, dwellResult] = await db.batch([
      db.prepare('SELECT COUNT(*) AS count FROM reading_events'),
      db.prepare(`
        SELECT date(ts / 1000.0, 'unixepoch') AS date, COUNT(*) AS count
        FROM reading_events
        WHERE ts >= ? AND ts < ?
        GROUP BY date(ts / 1000.0, 'unixepoch')
        ORDER BY date ASC
      `).bind(rangeStart, rangeEnd),
      db.prepare(`
        SELECT corpus, COUNT(*) AS count
        FROM reading_events
        GROUP BY corpus
        ORDER BY count DESC
      `),
      db.prepare(`
        SELECT corpus, slug, chapter, COUNT(*) AS count
        FROM reading_events
        WHERE corpus IS NOT NULL
          AND slug IS NOT NULL
          AND chapter IS NOT NULL
        GROUP BY corpus, slug, chapter
        ORDER BY count DESC
        LIMIT 10
      `),
      db.prepare('SELECT AVG(dwell_ms) AS average FROM reading_events'),
    ])

    const dailyByDate = new Map(
      resultRows(dailyResult).map((row) => [row.date, countValue(row.count)]),
    )
    const dailyCounts = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(rangeStart + (index * DAY_MS)).toISOString().slice(0, 10)
      return { date, count: dailyByDate.get(date) ?? 0 }
    })

    const corpusCounts = new Map()
    for (const row of resultRows(corpusResult)) {
      const corpus = row.corpus == null ? 'other' : String(row.corpus)
      corpusCounts.set(corpus, (corpusCounts.get(corpus) ?? 0) + countValue(row.count))
    }
    const corpusHeat = Array.from(corpusCounts, ([corpus, count]) => ({ corpus, count }))
      .sort((left, right) => right.count - left.count || left.corpus.localeCompare(right.corpus))

    const topChapters = resultRows(chaptersResult).map((row) => ({
      corpus: row.corpus,
      slug: row.slug,
      chapter: row.chapter,
      count: countValue(row.count),
    }))

    const average = Number(resultRows(dwellResult)[0]?.average)

    return c.json({
      totalEvents: countValue(resultRows(totalResult)[0]?.count),
      dailyCounts,
      corpusHeat,
      topChapters,
      avgDwellMs: Number.isFinite(average) && average > 0 ? Math.round(average) : 0,
    })
  } catch (error) {
    console.error('Reading statistics query failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.onError((error, c) => {
  console.error('Unhandled API error', error)
  return c.json({ ok: false, error: 'internal server error' }, 500)
})

export const onRequest = handle(app)
