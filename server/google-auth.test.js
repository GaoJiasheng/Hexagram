import { describe, expect, it, vi } from 'vitest'
import {
  GoogleIdTokenError,
  normalizeOAuthReturnTo,
  resolveGoogleAccount,
  validateGoogleIdToken,
} from './google-auth.js'

const NOW = 1_800_000_000_000
const CLIENT_ID = 'local-client-id'

function idToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${encoded}.signature`
}

function validPayload(overrides = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: (NOW / 1000) + 600,
    email_verified: true,
    sub: 'google-user-123',
    email: 'Reader@Example.com',
    ...overrides,
  }
}

function mockDb({ googleUser = null, emailUser = null } = {}) {
  const calls = []
  const db = {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        bindings: [],
        bind(...bindings) {
          this.bindings = bindings
          return this
        },
        async first() {
          calls.push({ kind: 'first', sql, bindings: this.bindings })
          if (sql.includes("i.provider = 'google'")) return googleUser
          if (sql.includes('FROM users')) return emailUser
          return null
        },
        async run() {
          calls.push({ kind: 'run', sql, bindings: this.bindings })
          return { success: true }
        },
      }
      return statement
    },
    async batch(statements) {
      calls.push({
        kind: 'batch',
        statements: statements.map(({ sql, bindings }) => ({ sql, bindings })),
      })
      return statements.map(() => ({ success: true }))
    },
  }
  return db
}

describe('Google OAuth return path', () => {
  it('keeps same-origin paths and rejects external redirects', () => {
    expect(normalizeOAuthReturnTo('/ru/lunyu?chapter=1')).toBe('/ru/lunyu?chapter=1')
    expect(normalizeOAuthReturnTo('//evil.example')).toBe('/')
    expect(normalizeOAuthReturnTo('http://evil.example')).toBe('/')
    expect(normalizeOAuthReturnTo('/\\evil.example')).toBe('/')
    expect(normalizeOAuthReturnTo(undefined)).toBe('/')
  })
})

describe('Google ID token validation', () => {
  it('accepts both Google issuers and both verified-email representations', () => {
    expect(validateGoogleIdToken(idToken(validPayload()), CLIENT_ID, NOW).sub).toBe('google-user-123')
    const alternate = validPayload({ iss: 'accounts.google.com', email_verified: 'true' })
    expect(validateGoogleIdToken(idToken(alternate), CLIENT_ID, NOW).email).toBe('Reader@Example.com')
  })

  it.each([
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'another-client' }],
    ['expiration', { exp: NOW / 1000 }],
    ['verified email', { email_verified: false }],
  ])('rejects an invalid %s claim', (_name, overrides) => {
    expect(() => validateGoogleIdToken(idToken(validPayload(overrides)), CLIENT_ID, NOW))
      .toThrow(GoogleIdTokenError)
  })

  it('rejects a malformed JWT as a bad upstream response', () => {
    try {
      validateGoogleIdToken('not-a-jwt', CLIENT_ID, NOW)
      throw new Error('expected validation failure')
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleIdTokenError)
      expect(error.status).toBe(502)
    }
  })
})

describe('Google account resolution', () => {
  const googleUser = {
    id: 'user-google',
    display_name: '旧读者',
    avatar_seed: 'seed-google',
    email: 'reader@example.com',
    is_owner: 0,
  }

  it('logs in the user already linked to the Google sub', async () => {
    const db = mockDb({ googleUser })
    await expect(resolveGoogleAccount(db, { sub: 'sub-1', email: 'reader@example.com' }))
      .resolves.toEqual(googleUser)
    expect(db.calls.filter(({ kind }) => kind === 'first')).toHaveLength(1)
    expect(db.calls.some(({ kind }) => kind === 'run' || kind === 'batch')).toBe(false)
  })

  it('links Google to an existing user with the same email', async () => {
    const emailUser = { ...googleUser, id: 'user-email' }
    const db = mockDb({ emailUser })
    await expect(resolveGoogleAccount(db, { sub: 'sub-2', email: 'reader@example.com' }))
      .resolves.toEqual(emailUser)
    const insert = db.calls.find(({ kind }) => kind === 'run')
    expect(insert.sql).toContain('INSERT INTO identities')
    expect(insert.bindings).toEqual(['user-email', 'sub-2'])
    expect(db.calls.some(({ kind }) => kind === 'batch')).toBe(false)
  })

  it('creates a user and Google identity for a new email', async () => {
    const db = mockDb()
    const randomUUID = vi.fn()
      .mockReturnValueOnce('new-user-id')
      .mockReturnValueOnce('new-avatar-seed')
    const user = await resolveGoogleAccount(
      db,
      { sub: 'sub-3', email: 'new.reader@example.com' },
      randomUUID,
    )

    expect(user).toEqual({
      id: 'new-user-id',
      display_name: 'new.reader',
      avatar_seed: 'new-avatar-seed',
      email: 'new.reader@example.com',
      is_owner: 0,
    })
    const batch = db.calls.find(({ kind }) => kind === 'batch')
    expect(batch.statements).toHaveLength(2)
    expect(batch.statements[0].bindings).toEqual([
      'new-user-id',
      'new.reader',
      'new-avatar-seed',
      'new.reader@example.com',
    ])
    expect(batch.statements[1].bindings).toEqual(['new-user-id', 'sub-3'])
  })
})
