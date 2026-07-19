import { describe, expect, it, vi } from 'vitest'
import { refreshAuthIfHinted } from './AuthContext.jsx'

describe('authHint request guard', () => {
  it('does not refresh authentication for a first-time visitor', () => {
    const refresh = vi.fn()
    expect(refreshAuthIfHinted(true, false, refresh)).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes only when the web client has an auth hint', () => {
    const request = Promise.resolve({ id: 'reader' })
    const refresh = vi.fn(() => request)
    expect(refreshAuthIfHinted(true, true, refresh)).toBe(request)
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('never refreshes inside the native shell', () => {
    const refresh = vi.fn()
    expect(refreshAuthIfHinted(false, true, refresh)).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })
})
