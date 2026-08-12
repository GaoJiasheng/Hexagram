// 原生壳跨源访问 API 的 CORS 行为。
//
// 这个文件存在的理由:2026-08-11 App Store 以 **2.1.0 App Completeness** 拒了 1.32.0,
// 审核员在 App 内注册时界面报「Load failed」。根因是**这里缺 CORS**:
// 壳里的 origin 是 `capacitor://localhost`,调生产 API 属跨源,
// 而 OPTIONS 预检打到 API 是 404 → 真正的 POST 根本没发出去。
// 登录/注册/评论/同步在 App 里**从上线起就没通过**,只是阅读走本地包所以没人发现。
//
// 光靠人工点是发现不了的:网页端同源、一切正常;要装到真机/模拟器才复现。
// 所以把它钉成测试。

import { describe, it, expect } from 'vitest'
import { onRequest } from './[[route]].js'

const IOS = 'capacitor://localhost'
const ANDROID = 'http://localhost'

const call = (path, { method = 'GET', origin, headers = {} } = {}) =>
  onRequest({
    request: new Request(`https://hexa.gavin.pub${path}`, {
      method,
      headers: { ...(origin ? { Origin: origin } : {}), ...headers },
    }),
    env: {},
  })

describe('原生壳的 CORS', () => {
  it('iOS 预检拿到 204 与放行头(这一条不过,App 里就是「Load failed」)', async () => {
    const res = await call('/api/auth/register', {
      method: 'OPTIONS',
      origin: IOS,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-client',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(IOS)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    // 原生端真会发这三个头,少一个预检就失败
    const allow = res.headers.get('Access-Control-Allow-Headers')
    for (const h of ['Content-Type', 'Authorization', 'X-Client']) expect(allow).toContain(h)
  })

  it('安卓壳同样放行(Capacitor 默认 http://localhost)', async () => {
    const res = await call('/api/auth/login', { method: 'OPTIONS', origin: ANDROID })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ANDROID)
  })

  it('陌生 origin 的预检一律不给(白名单,绝不反射)', async () => {
    for (const bad of ['https://evil.example', 'null', 'capacitor://evil']) {
      const res = await call('/api/auth/login', { method: 'OPTIONS', origin: bad })
      expect(res.status).toBe(404)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    }
  })

  it('普通响应带上 Allow-Origin 与 Vary', async () => {
    const res = await call('/api/definitely-not-a-route', { origin: IOS })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(IOS)
    expect(res.headers.get('Vary')).toContain('Origin')
  })

  it('**绝不发 Allow-Credentials** —— 这是安全约束,不是风格', async () => {
    // 原生端用 Bearer token、请求本就 credentials:'omit'。
    // 一旦发了这个头,浏览器就可能把带 httpOnly Cookie 的响应跨源交出去,
    // 网页那条最安全的路会被削弱。改这里前先想清楚。
    for (const [p, o] of [['/api/auth/register', IOS], ['/api/me', IOS]]) {
      const pre = await call(p, { method: 'OPTIONS', origin: o })
      expect(pre.headers.get('Access-Control-Allow-Credentials')).toBeNull()
      const res = await call(p, { origin: o })
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    }
  })

  it('同源(网页)请求不受影响 —— 不带 Origin 就什么都不加', async () => {
    const res = await call('/api/definitely-not-a-route')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
