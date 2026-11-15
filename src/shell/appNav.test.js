import { describe, expect, it } from 'vitest'
import { appKeyAction, pageHandlesOwnScroll, transitionKind } from './appNav.js'

describe('App 外壳导航手感', () => {
  it('转场方向:进一层推入、返回退回、标签之间与替换淡入', () => {
    expect(transitionKind('PUSH', '/', '/ru')).toBe('push')
    expect(transitionKind('PUSH', '/ru', '/ru/lunyu')).toBe('push')
    expect(transitionKind('POP', '/ru/lunyu', '/ru')).toBe('pop')
    expect(transitionKind('PUSH', '/', '/app/index')).toBe('fade')
    expect(transitionKind('POP', '/app/me', '/')).toBe('fade')
    expect(transitionKind('REPLACE', '/ru', '/ru/lunyu')).toBe('fade')
  })

  it('带锚点或段落参数的页面自己定位,不替它回顶', () => {
    expect(pageHandlesOwnScroll({ hash: '#ch-3', search: '' })).toBe(true)
    expect(pageHandlesOwnScroll({ hash: '', search: '?seg=4' })).toBe(true)
    expect(pageHandlesOwnScroll({ hash: '', search: '?hl=%E9%81%93' })).toBe(true)
    expect(pageHandlesOwnScroll({ hash: '', search: '?p=2' })).toBe(false)
    expect(pageHandlesOwnScroll({ hash: '', search: '' })).toBe(false)
  })

  it('键盘:⌘F ⌘, ⌘[ ⌘] ⌘1–5;没按 ⌘、按了 Alt、在输入框里一律不截获', () => {
    const ev = (key, extra = {}) => ({ key, metaKey: true, target: { tagName: 'BODY' }, ...extra })
    expect(appKeyAction(ev('f'))).toEqual({ type: 'search' })
    expect(appKeyAction(ev('F'))).toEqual({ type: 'search' })
    expect(appKeyAction(ev(','))).toEqual({ type: 'settings' })
    expect(appKeyAction(ev('['))).toEqual({ type: 'go', delta: -1 })
    expect(appKeyAction(ev(']'))).toEqual({ type: 'go', delta: 1 })
    expect(appKeyAction(ev('3'))).toEqual({ type: 'tab', index: 2 })
    expect(appKeyAction(ev('6'))).toBe(null)
    expect(appKeyAction(ev('f', { metaKey: false }))).toBe(null)
    expect(appKeyAction(ev('f', { altKey: true }))).toBe(null)
    expect(appKeyAction(ev('f', { target: { tagName: 'INPUT' } }))).toBe(null)
    expect(appKeyAction({ key: 'f', ctrlKey: true, target: { tagName: 'DIV' } })).toEqual({ type: 'search' })
  })
})
