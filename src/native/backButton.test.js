// 安卓返回键的决策逻辑。
//
// 这套逻辑**只有装进安卓壳才跑得到** —— 浏览器和 iOS 上一行都执行不到,
// 靠手点根本验不出来。而它错了的表现是「按一下返回直接退出 App」,
// 是安卓端最难堪的那种缺陷。所以按 CLAUDE.md 的规矩(「凡是只有装进壳
// 才复现的缺陷,一律补测试钉住」)把纯决策抽出来测。

import { describe, it, expect, afterEach } from 'vitest'
import { decideBack, overlayOpen, atRoot, EXIT_WINDOW_MS } from './backButton.js'

const NOW = 1_000_000

describe('返回键的三层优先级', () => {
  it('① 有浮层开着 —— 一律先关浮层,**不动路由**', () => {
    // 哪怕同时「有历史可退」,也必须先关浮层:用户按返回想关的是眼前那层
    expect(decideBack({ overlay: true, canGoBack: true, pathname: '/ru/lunyu/1', now: NOW, lastAt: 0 }))
      .toBe('dismiss')
    // 哪怕人在首页(否则会误退出 App —— 首页一进来就弹每日一辩,正中这条)
    expect(decideBack({ overlay: true, canGoBack: false, pathname: '/', now: NOW, lastAt: 0 }))
      .toBe('dismiss')
  })

  it('② 没有浮层但有站内历史 —— 回上一页', () => {
    expect(decideBack({ overlay: false, canGoBack: true, pathname: '/ru/lunyu/1', now: NOW, lastAt: 0 }))
      .toBe('back')
  })

  it('**在首页时即使壳说 canGoBack 也不回退** —— 壳把自己的历史也算了进来', () => {
    for (const p of ['/', '/hexagram']) {
      expect(decideBack({ overlay: false, canGoBack: true, pathname: p, now: NOW, lastAt: 0 }))
        .toBe('hint')
    }
  })

  it('③ 栈底:第一次只提示,两秒内再按才退出', () => {
    expect(decideBack({ overlay: false, canGoBack: false, pathname: '/', now: NOW, lastAt: 0 }))
      .toBe('hint')
    expect(decideBack({ overlay: false, canGoBack: false, pathname: '/', now: NOW, lastAt: NOW - 500 }))
      .toBe('exit')
  })

  it('超过两秒窗口就重新计时,不会「隔了半天按一下就退出」', () => {
    expect(decideBack({
      overlay: false, canGoBack: false, pathname: '/',
      now: NOW, lastAt: NOW - EXIT_WINDOW_MS - 1,
    })).toBe('hint')
  })
})

// 测试环境是 node(仓库没装 jsdom,不为两个断言拉一个新依赖),
// overlayOpen 只读 document 的两样东西,拿桩喂它足够。
describe('浮层判定', () => {
  const stub = ({ overflow = '', hit = null } = {}) => {
    globalThis.document = {
      body: { style: { overflow } },
      querySelector: (sel) => (hit && sel.includes(hit) ? {} : null),
    }
  }
  afterEach(() => { delete globalThis.document })

  it('没有 document 时返回 false —— 别在 SSR/测试里抛异常', () => {
    expect(overlayOpen()).toBe(false)
  })

  it('模态浮层靠「body 锁了滚动」认出来 —— 这是站内所有模态浮层的统一约定', () => {
    stub({ overflow: '' })
    expect(overlayOpen()).toBe(false)
    stub({ overflow: 'hidden' })
    expect(overlayOpen()).toBe(true)
  })

  it('注释气泡一类不锁滚动的轻浮层,靠类名认', () => {
    stub({ hit: 'zhushi__popover' })
    expect(overlayOpen()).toBe(true)
    stub({ hit: 'termtip__popover' })
    expect(overlayOpen()).toBe(true)
  })
})

describe('首页判定', () => {
  it('两个中立首页都算栈底,别的都不算', () => {
    expect(atRoot('/')).toBe(true)
    expect(atRoot('/hexagram')).toBe(true)      // 总门户(logo 回跳点)
    expect(atRoot('/yijing')).toBe(false)       // 易经首页是分站,不是栈底
    expect(atRoot('/ru/lunyu/1')).toBe(false)
  })
})
