// 深链路径解析。
//
// 这段只有在原生壳里才跑得到(web 上浏览器自己会路由),手点验不出来;
// 而它的输入是**外部 App 传进来的 URL** —— 不可信输入,必须挡住非本站域名。

import { describe, it, expect } from 'vitest'
import { routePathFromUrl } from './deepLink.js'

describe('深链取路径', () => {
  it('本站链接取出可路由的路径(含 query 与 hash)', () => {
    expect(routePathFromUrl('https://hexa.gavin.pub/ru/lunyu/1')).toBe('/ru/lunyu/1')
    expect(routePathFromUrl('https://hexa.gavin.pub/songci/songci300/6?p=2')).toBe('/songci/songci300/6?p=2')
    expect(routePathFromUrl('https://hexa.gavin.pub/fo/xinjing#fo-ch-1')).toBe('/fo/xinjing#fo-ch-1')
    expect(routePathFromUrl('https://hexa.gavin.pub/')).toBe('/')
  })

  it('**非本站一律拒绝** —— 外部 App 传进来的 URL 是不可信输入', () => {
    for (const u of [
      'https://evil.example.com/ru/lunyu/1',
      'https://hexa.gavin.pub.evil.com/x',   // 后缀伪装
      'http://localhost:5173/ru/lunyu/1',
    ]) expect(routePathFromUrl(u)).toBeNull()
  })

  it('非法输入返回 null,不抛异常(冷启动路径上抛了会白屏)', () => {
    for (const u of ['', null, undefined, '不是网址', 'javascript:alert(1)']) {
      expect(routePathFromUrl(u)).toBeNull()
    }
  })
})
