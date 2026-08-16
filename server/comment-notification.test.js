import { describe, expect, it, vi } from 'vitest'
import {
  buildCommentNotificationRequest,
  commentPageUrl,
  sendCommentNotification,
} from './comment-notification.js'

const ENV = {
  RESEND_API_KEY: 'resend-test-key',
  OWNER_NOTIFY_EMAIL: 'owner@example.com',
}
const COMMENT = {
  body: '这一段很值得反复读。',
  createdAt: Date.UTC(2026, 6, 19, 6, 7, 8),
}
const AUTHOR = {
  display_name: '山中读者',
  is_owner: 0,
}
const ANCHOR = {
  corpus: 'ru',
  slug: 'lunyu',
  chapter: '1',
}

describe('comment page URL', () => {
  it.each([
    ['books', 'zizhi-tongjian', 'ignored', 'https://hexa.gavin.pub/books/zizhi-tongjian'],
    ['yijing', 'xici', '2', 'https://hexa.gavin.pub/classics/xici/2'],
    ['dao', 'daodejing', '37', 'https://hexa.gavin.pub/dao/daodejing/37'],
    ['ru', 'lunyu', '1', 'https://hexa.gavin.pub/ru/lunyu/1'],
  ])('maps %s comments to their public page', (corpus, slug, chapter, expected) => {
    expect(commentPageUrl(corpus, slug, chapter)).toBe(expected)
  })
})

describe('comment notification request', () => {
  it.each([
    [{ ...ENV, RESEND_API_KEY: '' }, AUTHOR],
    [{ ...ENV, OWNER_NOTIFY_EMAIL: '' }, AUTHOR],
    [ENV, { ...AUTHOR, is_owner: 1 }],
  ])('skips missing configuration and owner-authored comments', (env, author) => {
    expect(buildCommentNotificationRequest(env, COMMENT, author, ANCHOR)).toBeNull()
  })

  it('builds the Resend request with readable comment details and a direct link', () => {
    const request = buildCommentNotificationRequest(ENV, COMMENT, AUTHOR, ANCHOR)
    const email = JSON.parse(request.init.body)

    expect(request.url).toBe('https://api.resend.com/emails')
    expect(request.init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer resend-test-key',
        'Content-Type': 'application/json',
      },
    })
    expect(email).toMatchObject({
      // 必须是 Resend 已验证的子域(见 comment-notification.js 的注释)
      from: '观象 <notify@send.gavin.pub>',
      to: 'owner@example.com',
      // 查不到中文标题时退回机器味的写法(难看,但仍要发出去)
      subject: '观象新评论：ru/lunyu/1',
    })
    expect(email.text).toContain('昵称：山中读者')
    expect(email.text).toContain('发布时间：2026年7月19日 14:07:08（UTC+8）')
    expect(email.text).toContain('评论全文：\n这一段很值得反复读。')
    expect(email.text).toContain('直达链接：https://hexa.gavin.pub/ru/lunyu/1')
    expect(email.text).not.toContain(String(COMMENT.createdAt))
  })

  it('拿到中文标题时,主题与正文都用它(owner 反馈:路径不好读)', () => {
    const request = buildCommentNotificationRequest(ENV, COMMENT, AUTHOR, ANCHOR, '论语 · 学而第一')
    const email = JSON.parse(request.init.body)

    expect(email.subject).toBe('观象新评论：论语 · 学而第一')
    expect(email.text).toContain('位置：论语 · 学而第一')
    // 链接仍在正文里
    expect(email.text).toContain('直达链接：https://hexa.gavin.pub/ru/lunyu/1')
  })
})

// 卦页评论是 2026-08-16 才加的。它的 slug 是 'hexagrams',若沿用经传那套
// 拼法会得到 /classics/hexagrams/1 —— 一个**不存在的地址**,邮件里就是死链。
describe('特殊阅读面的链接', () => {
  it.each([
    [{ corpus: 'yijing', slug: 'hexagrams', chapter: '1' }, 'https://hexa.gavin.pub/hexagram/1'],
    [{ corpus: 'yijing', slug: 'xici-shang', chapter: '3' }, 'https://hexa.gavin.pub/classics/xici-shang/3'],
    // 单页短经住在 /<组>/<书>,没有章号段。章键 'all' 若原样拼进去就是死链。
    [{ corpus: 'fo', slug: 'xinjing', chapter: 'all' }, 'https://hexa.gavin.pub/fo/xinjing'],
    [{ corpus: 'dao', slug: 'yinfujing', chapter: 'all' }, 'https://hexa.gavin.pub/dao/yinfujing'],
  ])('%o -> %s', (anchor, expected) => {
    expect(commentPageUrl(anchor.corpus, anchor.slug, anchor.chapter)).toBe(expected)
  })
})

describe('comment notification delivery', () => {
  it('does not call fetch or log when configuration is absent', async () => {
    const fetchImpl = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendCommentNotification({}, COMMENT, AUTHOR, ANCHOR, fetchImpl)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('logs but does not throw for HTTP and network failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const httpFailure = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    const networkFailure = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(sendCommentNotification(ENV, COMMENT, AUTHOR, ANCHOR, httpFailure))
      .resolves.toBeUndefined()
    await expect(sendCommentNotification(ENV, COMMENT, AUTHOR, ANCHOR, networkFailure))
      .resolves.toBeUndefined()

    expect(error).toHaveBeenCalledTimes(2)
    expect(error.mock.calls[0]).toEqual(['Comment notification failed', { status: 401 }])
    expect(error.mock.calls[1][0]).toBe('Comment notification failed')
    error.mockRestore()
  })
})
