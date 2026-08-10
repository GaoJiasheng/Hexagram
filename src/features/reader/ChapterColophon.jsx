// 章末「牌记」:引用格式 · 底本 · 报错。
//
// 为什么这三件挤在一起,而不是散在各处:它们回答的是同一个问题 ——
// **「这段文字凭什么可信,以及如果不可信我怎么办」**。
//
// · **引用** —— 一个古籍站要能被引用才立得住。读者写论文、写文章想引这一章,
//   得自己拼书名章名底本网址,多数人就放弃了,或者拼错。给现成的。
// · **底本** —— 站里每本书的择本理由写在 /about 的凡例和撰人小传里,
//   但读者是从搜索引擎直接落到某一章的,他看不到那些。**每一章都该自报家门。**
// · **报错** —— 全站内容由机器批量产出、机器只能校「引文是不是原文子串」,
//   校不了事实对错(已吃过亏)。靠一个人读完几千页不现实,
//   **让读到的人能顺手指出来**才是真的解法。owner 定了走邮件,不入库不建后台。

import { useState } from 'react'

const MAIL = 'hexa@gavin.pub'
// 写死正式站域名,**不取 window.location.origin** ——
// 在 iOS 壳里那是 capacitor://localhost,拼出来的引用地址谁也打不开。
// 引用指向的应当永远是这一章在网上的正式位置,与读者当下从哪儿读无关。
const SITE_ORIGIN = 'https://hexa.gavin.pub'

// 「访问于」用本地日期即可 —— 引用规范要的是读者看到这一版的时间
const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function ChapterColophon({ bookTitle, chapterLabel, attribution, path, bookHref, here }) {
  const [copied, setCopied] = useState(false)
  if (!bookTitle) return null

  const where = chapterLabel ? `${bookTitle}·${chapterLabel}` : bookTitle
  // ⚠️ texts.json 的 `attribution` 是**撰人/编者**(「孔子弟子及再传弟子辑」),
  //    不是底本。早先这里写「底本:{attribution}」是把两件事混了 —— 那是错的。
  //    本站底本一律取自维基文库的通行本,**逐书的择本要点写在各书题解的撰人小传里**
  //    (道德经王弼本、心经玄奘略本、坛经宗宝本…),故这里只给通例并指往题解。
  const who = attribution ? `${attribution}。` : ''
  const url = `${SITE_ORIGIN}${path}`
  const citation = `《${where}》。${who}观象 · 古籍研读站,底本据维基文库通行本。${url},访问于 ${today()}。`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)   // 无剪贴板权限时文本本来就摊在页面上,读者可自己选中复制
    }
  }

  // 报错邮件把「哪一页」预填进去 —— 只写「有个错字」的反馈没法定位,等于收不到
  const subject = `【观象·报错】${where}`
  const body = [
    `页面:${SITE_ORIGIN}${here || path}`,
    `篇章:《${where}》`,
    '',
    '发现的问题(原文有误 / 译文有误 / 注疏有误 / 事实错误 / 其他):',
    '',
    '',
    '(能附上你认为正确的说法与出处就更好了,多谢)',
  ].join('\n')
  const mailto = `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <section className="colophon" aria-label="引用与勘误">
      <div className="colophon__row">
        <span className="colophon__label">引用本页</span>
        <code className="colophon__cite">{citation}</code>
        <button type="button" className="colophon__btn" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <p className="colophon__foot">
        {attribution && <span className="colophon__base">撰人:{attribution}</span>}
        <span className="colophon__base">
          底本:维基文库通行本
          {bookHref && <>(择本要点见<a className="colophon__link" href={bookHref}>题解</a>)</>}
        </span>
        <a className="colophon__report" href={mailto}>
          发现错误?写信告诉我 →
        </a>
      </p>
    </section>
  )
}
