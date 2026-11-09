import { describe, expect, it } from 'vitest'
import { formOf, resolveShell, TABLET_MIN, WIDE_MIN } from './shell.js'

describe('App 外壳的形态判断', () => {
  it('宽度 → 形态:手机 / 平板 / 宽屏', () => {
    expect(formOf(390)).toBe('phone')          // iPhone
    expect(formOf(600)).toBe('phone')          // 与手机底栏的 600px 断点对齐
    expect(formOf(TABLET_MIN)).toBe('tablet')
    expect(formOf(744)).toBe('tablet')         // iPad mini 竖屏
    expect(formOf(834)).toBe('tablet')         // iPad 11 吋竖屏
    expect(formOf(WIDE_MIN)).toBe('wide')      // iPad 13 吋竖屏 / 11 吋横屏起
    expect(formOf(1366)).toBe('wide')
    expect(formOf(507)).toBe('phone')          // iPad 分屏缩成窄条:落回手机形态
  })

  it('环境:原生壳或独立运行的网页是 app,普通浏览器是 web', () => {
    expect(resolveShell({})).toBe('web')
    expect(resolveShell({ native: true })).toBe('app')
    expect(resolveShell({ standalone: true })).toBe('app')
  })

  it('显式参数压过记住的值,记住的值压过环境(?shell=app 在浏览器里验 App 外壳)', () => {
    expect(resolveShell({ param: 'app' })).toBe('app')
    expect(resolveShell({ native: true, param: 'web' })).toBe('web')
    expect(resolveShell({ stored: 'app' })).toBe('app')
    expect(resolveShell({ stored: 'app', param: 'web' })).toBe('web')
    expect(resolveShell({ param: 'bogus', stored: 'nope', native: true })).toBe('app')
  })
})
