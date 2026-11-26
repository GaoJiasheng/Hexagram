import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 两个 App 的介绍页(中立外壳,/apps)。书桌上架前「下载」处只写状态,上架后把 DESK_STORE 填上即可。
const GUANXIANG_STORE = 'https://apps.apple.com/cn/app/id6782626551'
const DESK_STORE = ''
// 书包标准、skill、示例只由网站托管(观象 App 的包里不带 /desk/ 那一份),App 里一律指到线上
const STANDARD_WEB = '/desk/standard/'
const STANDARD_ORIGIN = 'https://hexa.gavin.pub/desk/standard/'

const SHOTS = [
  { src: '/apps/desk-1.jpg', alt: '书桌首页:正在读的书、本周目标、今日一章' },
  { src: '/apps/desk-2.jpg', alt: '读原文:点一个词,看释义与展开' },
  { src: '/apps/desk-3.jpg', alt: '白话深读:图解按手机版式重排' },
  { src: '/apps/desk-4.jpg', alt: '导入的书:总纲、思维导图、分章' },
]

export default function AppsPage() {
  usePageTitle('App')
  const inApp = Capacitor.isNativePlatform()
  const STANDARD = inApp ? STANDARD_ORIGIN : STANDARD_WEB
  const ext = inApp ? { target: '_blank', rel: 'noreferrer' } : {}
  return (
    <div className="basics-page about-page apps-page">
      <div className="page-header">
        <h1 className="page-title">两个 App</h1>
        <p className="page-subtitle text-soft">同一份内容,两种读法:一个是整座书库,一个是一张书桌</p>
      </div>

      <section className="about-section apps-card">
        <header className="apps-card__head">
          <img className="apps-card__icon" src="/apps/icon-guanxiang.png" alt="" width="72" height="72" />
          <div>
            <h2 className="apps-card__name">观象</h2>
            <p className="apps-card__meta">iPhone · iPad</p>
          </div>
          {inApp
            ? <span className="apps-card__state">你正在用的就是它</span>
            : <a className="btn btn--primary apps-card__get" href={GUANXIANG_STORE} target="_blank" rel="noreferrer">App Store 下载</a>}
        </header>
        <p>就是这个网站,装进了手机和平板。适合查、翻、搜:想起一句话,找到它在哪一章;想看一家之言,顺着书架一本本翻。</p>
        <ul className="about-list">
          <li>全站典籍的原文、译文、注疏、每章延伸与白话都随 App 打包,<strong>没网也能读</strong>。</li>
          <li>全站搜索、名句集、时间轴、人物志、义理专题、百家争鸣,网页上有的这里都有。</li>
          <li>登录后,阅读进度、收藏与笔记和网页端是同一份。</li>
        </ul>
      </section>

      <section className="about-section apps-card">
        <header className="apps-card__head">
          <img className="apps-card__icon" src="/apps/icon-desk.png" alt="" width="72" height="72" />
          <div>
            <h2 className="apps-card__name">观象 · 书桌</h2>
            <p className="apps-card__meta">iPhone · iPad · 原生 App</p>
          </div>
          {DESK_STORE
            ? <a className="btn btn--primary apps-card__get" href={DESK_STORE} target="_blank" rel="noreferrer">App Store 下载</a>
            : !inApp && <span className="apps-card__state">正在准备上架</span>}
        </header>
        <p>书桌上不用摆很多书。从七十九部古籍里挑几部正在学的,打开就接着上次读。适合一本书从头读到尾。</p>
        <ul className="about-list">
          <li><strong>一页一页翻</strong>:点带虚线的词看详注,轻点一段看译文;iPad 横过来是双栏。</li>
          <li><strong>往深里读</strong>:每章一篇白话长文,文中的图解按手机和平板重新排过。</li>
          <li><strong>划线与批注</strong>:原文、译文、白话都能划,记录按书归拢,点一条回到原处。</li>
          <li><strong>有账可查</strong>:记学习时长,不记打开次数;自己定每周目标,一年一张热力图。</li>
          <li><strong>导入自己的书</strong>:讲义、笔记、文章做成「书包」放上书桌,只存在自己的设备上。做法见下。</li>
          <li>与本站共用账号,进度、时长、划线云端同步;不登录也能用。</li>
        </ul>
        <div className="apps-shots">
          {SHOTS.map((s) => <img key={s.src} src={s.src} alt={s.alt} title={s.alt} width="520" height="1130" loading="lazy" />)}
        </div>
      </section>

      <section className="about-section" id="make">
        <h2 className="about-section__title">给书桌做一本自己的书</h2>
        <p>书桌读的每一本书都是一个「书包」——一个 <code>.deskbook</code> 文件。格式是公开的,谁都可以照着做。最省事的办法是让 AI 助手做:</p>
        <ol className="about-list apps-steps">
          <li>
            <strong>装上做书用的 skill。</strong>
            下载 <a href={`${STANDARD}deskbook-skill.zip`} {...ext}>deskbook-skill.zip</a>,解压得到 <code>deskbook</code> 文件夹。
            用 Claude Code 的,把它放进 <code>~/.claude/skills/</code>;别的助手按它装 skill 的办法装,或者直接把文件夹里的 <code>SKILL.md</code> 与 <code>standard.md</code> 交给它。
          </li>
          <li>
            <strong>把材料给它,说一句「把这份讲义做成书包」。</strong>
            它先列提纲等你点头,再一章一章写;每章写完自己跑校验,全书写完打包,交给你一个 <code>.deskbook</code> 文件。
          </li>
          <li>
            <strong>传到手机或平板上。</strong>
            隔空投送过去,或存进「文件」;也可以把文件放到网上,拿到一条 https 链接。
          </li>
          <li>
            <strong>在书桌里导入。</strong>
            首页「添书」→ 左上角「导入」→「从文件导入书包」或「粘贴书包链接」。隔空投送过来的,点开时选「用书桌打开」就行。
          </li>
        </ol>
        <p>不用 AI 也行:照<a href={STANDARD} {...ext}>书包格式标准</a>写 <code>book.json</code> 与每章的文件,用标准页上的校验器 <code>deskbook.mjs</code> 校验、打包。那一页还有四本示例书包,可以先导入一本看看样子。</p>
        <p className="text-soft">导入的书只存在你自己的设备上,不上传。把别人的书做成书包,只能是自己写的讲解与消化,不能照搬原文——红线写在标准里,skill 会照着守。</p>
      </section>

      <p className="apps-back"><Link to="/">← 回首页</Link> · <Link to="/privacy">隐私说明</Link></p>
    </div>
  )
}
