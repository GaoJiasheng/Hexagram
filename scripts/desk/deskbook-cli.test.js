// 书包命令行端到端:在临时目录里跑生成好的单文件 public/desk/standard/deskbook.mjs。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const CLI = path.join(ROOT, 'public/desk/standard/deskbook.mjs')
let tmp
const run = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: tmp, encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
}
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deskbook-cli-')) })
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('生成物与源同步(改了源须跑 npm run desk:standard)', () => {
  it('单文件 CLI 内联了当前的 deskbook-core.mjs 与 deskbook-cli.mjs', () => {
    const built = fs.readFileSync(CLI, 'utf8')
    expect(built.includes(fs.readFileSync(path.join(HERE, 'deskbook-core.mjs'), 'utf8').trimEnd())).toBe(true)
    const cli = fs.readFileSync(path.join(HERE, 'deskbook-cli.mjs'), 'utf8').split('\n').filter((l) => !l.includes('// @inline-core')).join('\n')
    expect(built.includes(cli.slice(cli.indexOf('const HELP')))).toBe(true)
    expect(built).not.toMatch(/from '\.\/deskbook-core\.mjs'/)
  })
  it('skill 里的标准、CLI 是最新的', () => {
    const full = fs.readFileSync(path.join(ROOT, 'docs/deskbook-standard.md'), 'utf8')
    const std = full.slice(0, full.indexOf('## 附录 A')).trimEnd()
    const copy = fs.readFileSync(path.join(ROOT, 'skills/deskbook/standard.md'), 'utf8')
    expect(copy.includes(std)).toBe(true)
    expect(copy).toMatch(/## 附录 A · 图解 fig 的字段[\s\S]*### 公共字段[\s\S]*`notes` 兜底/)
    expect(copy).not.toMatch(/### 闸/)
    expect(fs.readFileSync(path.join(ROOT, 'skills/deskbook/deskbook.mjs'), 'utf8')).toBe(fs.readFileSync(CLI, 'utf8'))
  })
  it('index.json 列出的文件都在、大小相符', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desk/standard/index.json'), 'utf8'))
    expect(idx.version).toBe(1)
    for (const f of idx.files) expect(fs.statSync(path.join(ROOT, 'public/desk/standard', f.path)).size, f.path).toBe(f.bytes)
    expect(idx.files.map((f) => f.path)).toEqual(expect.arrayContaining(['deskbook.mjs', 'deskbook-skill.zip', 'index.html', 'schema/book.json', 'samples/sample-book.deskbook']))
  })
})

describe('命令行', () => {
  it('帮助与未知命令', () => {
    expect(run('--help').code).toBe(0)
    expect(run('frobnicate').code).toBe(2)
  })

  for (const kind of ['book', 'collection', 'classic']) {
    it(`init ${kind} 起出的骨架直接校验通过`, () => {
      const r = run('init', `b-${kind}`, '--kind', kind, '--title', '试做 Demo Book')
      expect(r.code, r.err).toBe(0)
      const book = JSON.parse(fs.readFileSync(path.join(tmp, `b-${kind}`, 'book.json'), 'utf8'))
      expect(book.id).toMatch(/^u-demo-book-[0-9a-f]{8}$/)
      const v = run('validate', `b-${kind}`, '--json')
      expect(v.code).toBe(0)
      expect(v.json.ok).toBe(true)
    })
  }

  it('init 不覆盖已有目录', () => { expect(run('init', 'b-book', '--title', 'x').code).toBe(1) })

  it('validate 报错时退出码 1,--json 给出文件与位置', () => {
    const p = path.join(tmp, 'b-book', 'chapters/001.json')
    const ch = JSON.parse(fs.readFileSync(p, 'utf8'))
    const good = JSON.stringify(ch)
    ch.article.blocks.push({ t: 'pull', x: '一' }, { t: 'pull', x: '二' }, { t: 'p', x: '[链](http://a.org)' })
    fs.writeFileSync(p, JSON.stringify(ch))
    const v = run('validate', 'b-book', '--json')
    expect(v.code).toBe(1)
    expect(v.json.errors.map((e) => e.file)).toContain('chapters/001.json')
    expect(v.json.errors.some((e) => /pull/.test(e.msg))).toBe(true)
    const text = run('validate', 'b-book')
    expect(text.code).toBe(1)
    expect(text.err).toMatch(/错误 {2}chapters\/001\.json · article\.blocks\[4\]\(p\)\.x:链接只许 https/)
    // 校验不过不打包
    const pk = run('pack', 'b-book', '-o', 'broken.deskbook')
    expect(pk.code).toBe(1)
    expect(fs.existsSync(path.join(tmp, 'broken.deskbook'))).toBe(false)
    fs.writeFileSync(p, good)
  })

  it('pack → unpack 往返,隐藏文件不进包', () => {
    fs.writeFileSync(path.join(tmp, 'b-book', '.DS_Store'), 'x')
    const pk = run('pack', 'b-book', '-o', 'out/b.deskbook', '--json')
    expect(pk.code, pk.err).toBe(0)
    expect(pk.json.sha256).toMatch(/^[0-9a-f]{64}$/)
    const up = run('unpack', 'out/b.deskbook', '-o', 'b-back')
    expect(up.code, up.err).toBe(0)
    expect(fs.readdirSync(path.join(tmp, 'b-back')).sort()).toEqual(['book.json', 'chapters'])
    expect(fs.readFileSync(path.join(tmp, 'b-back/chapters/001.json'), 'utf8')).toBe(fs.readFileSync(path.join(tmp, 'b-book/chapters/001.json'), 'utf8'))
    expect(run('validate', 'out/b.deskbook').code).toBe(0)
    expect(run('unpack', 'out/b.deskbook', '-o', 'b-back').code).toBe(1) // 不往不空的目录里解
  })

  it('同样的源打出同样的字节', () => {
    run('pack', 'b-classic', '-o', 'c1.deskbook')
    run('pack', 'b-classic', '-o', 'c2.deskbook')
    expect(fs.readFileSync(path.join(tmp, 'c1.deskbook')).equals(fs.readFileSync(path.join(tmp, 'c2.deskbook')))).toBe(true)
  })

  it('四个示例书包都校验通过', () => {
    for (const n of ['sample-book', 'sample-collection', 'sample-classic', 'sample-fitness']) {
      const v = run('validate', path.join(ROOT, 'public/desk/standard/samples', `${n}.deskbook`), '--json')
      expect(v.code, n).toBe(0)
      expect(v.json.warnings, n).toEqual([])
    }
  })

  it('坏书包(不是 zip)报错不崩', () => {
    fs.writeFileSync(path.join(tmp, 'junk.deskbook'), 'not a zip at all, just some text here')
    const v = run('validate', 'junk.deskbook', '--json')
    expect(v.code).toBe(1)
    expect(v.json.errors[0].msg).toMatch(/不是 zip/)
  })

  it.skipIf(!hasFfmpeg)('gif2mp4:奇数尺寸的 GIF 转成偶数尺寸 H.264,出封面与 video 块,放进书包校验通过', () => {
    const gif = path.join(tmp, 'Clip One.gif')
    const g = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=321x181:rate=10', '-t', '2', gif])
    expect(g.status).toBe(0)
    const r = run('gif2mp4', gif, '-o', 'b-book/media/clip.mp4', '--json')
    expect(r.code, r.err + r.out).toBe(0)
    const block = r.json.block
    expect(block).toMatchObject({ t: 'video', src: 'media/clip.mp4', poster: 'media/clip-poster.jpg', loop: true })
    expect(block.w % 2).toBe(0)
    expect(block.h % 2).toBe(0)
    expect(block.sec).toBeGreaterThan(1.5)
    const p = path.join(tmp, 'b-book', 'chapters/001.json')
    const ch = JSON.parse(fs.readFileSync(p, 'utf8'))
    ch.article.blocks.push({ ...block, cap: '测试画面' })
    fs.writeFileSync(p, JSON.stringify(ch))
    const v = run('validate', 'b-book', '--json')
    expect(v.json.errors).toEqual([])
    expect(v.json.warnings).toEqual([])
  })
})
