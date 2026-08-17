// friendlyError:别把浏览器的原始英文错误漏给用户。
//
// 值得测,是因为它防的那个缺陷**代价很高过**:2026-08-11 App Store 第一次被拒,
// 审核员在 App 内注册看到的就是一句 "Load failed" —— 那正是 WKWebView 版本的
// 原始 fetch 错误(根因是服务端缺 CORS)。而 2026-08-17 安卓走查又在评论区
// 逮到同一形态的 "Failed to fetch"。
//
// 两端的原始串**措辞不同**(Chrome 系 "Failed to fetch" / Safari 系 "Load failed"),
// 只认其中一条就会在另一端漏掉,所以两条都要钉住。

import { describe, it, expect } from 'vitest'
import { friendlyError } from './apiClient.js'

const NETWORK_MSG = '网络连接失败,请检查网络后重试'

describe('friendlyError', () => {
  it('**两端的原始网络错误都要换成人话**(措辞不同,漏一条就会在另一端露馅)', () => {
    expect(friendlyError(new Error('Failed to fetch'))).toBe(NETWORK_MSG)       // Chrome / 安卓 WebView
    expect(friendlyError(new Error('Load failed'))).toBe(NETWORK_MSG)           // Safari / WKWebView(App Store 那次)
    expect(friendlyError(new Error('NetworkError when attempting to fetch a resource'))).toBe(NETWORK_MSG)
    expect(friendlyError(new Error('Network request failed'))).toBe(NETWORK_MSG)
  })

  it('大小写不敏感 —— 各浏览器大小写并不统一', () => {
    expect(friendlyError(new Error('failed to fetch'))).toBe(NETWORK_MSG)
    expect(friendlyError(new Error('LOAD FAILED'))).toBe(NETWORK_MSG)
  })

  it('服务端给的中文原样透传 —— 那些话本来就是写给用户看的', () => {
    for (const msg of ['评论最长 500 字', '人机验证已过期,已重新验证,请再点一次发布', '该邮箱已注册,请直接登录']) {
      expect(friendlyError(new Error(msg))).toBe(msg)
    }
  })

  it('拿不到 message 时用调用方给的兜底话,不给空字符串', () => {
    expect(friendlyError(new Error(''), '发布失败,请稍后重试')).toBe('发布失败,请稍后重试')
    expect(friendlyError(null, '登录失败,请稍后重试')).toBe('登录失败,请稍后重试')
    expect(friendlyError(undefined)).toBe('出错了,请稍后重试')
  })
})
