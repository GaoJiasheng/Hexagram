import { describe, expect, it, vi } from 'vitest'

// 只测三连击判定本身(时间窗 + 管理员);导航由 react-router 负责
vi.mock('react-router-dom', () => ({ useNavigate: () => globalThis.__nav }))
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: globalThis.__user }) }))
vi.mock('react', async (orig) => { const r = await orig(); return { ...r, useCallback: (fn) => fn, useRef: (v) => (globalThis.__ref ||= { current: v }) } })
const { useBooksSecretTap } = await import('./booksSecretTap.js')

function run(user, gaps) {
  globalThis.__ref = undefined; globalThis.__user = user; globalThis.__nav = vi.fn()
  const tap = useBooksSecretTap()
  let t = 1_000_000; const spy = vi.spyOn(Date, 'now')
  const hits = []
  for (const g of [0, ...gaps]) { t += g; spy.mockReturnValue(t); hits.push(tap({ preventDefault() {} })) }
  spy.mockRestore()
  return { hits, nav: globalThis.__nav }
}

describe('观书三连击', () => {
  it('管理员 3 连击(间隔 < 600ms)跳 /books', () => {
    const { hits, nav } = run({ isAdmin: true }, [200, 200])
    expect(hits).toEqual([false, false, true])
    expect(nav).toHaveBeenCalledWith('/books')
  })
  it('非管理员与未登录:什么也不发生', () => {
    expect(run({ isAdmin: false }, [200, 200]).nav).not.toHaveBeenCalled()
    expect(run(null, [200, 200]).nav).not.toHaveBeenCalled()
  })
  it('点得太慢不算', () => {
    expect(run({ isAdmin: true }, [200, 900]).nav).not.toHaveBeenCalled()
  })
})
