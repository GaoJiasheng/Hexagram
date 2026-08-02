import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 隐私政策(App Store / 上架要求的公开页)。
//
// **2026-08-03 重写**:登录 / 邮箱 / 云同步 / 评论上线后,原文里
// 「不收集联系方式」「数据只存你的设备上」「不收集任何用户的个人信息」三处都成了假话。
// 这一页是对外承诺,写错不是文案问题是合规问题 —— 改功能时务必回来同步改这里。
//
// 全篇的分界线是**登录与否**:不登录仍是纯本地 + 匿名埋点;登录才有邮箱与云端足迹。
export default function PrivacyPage() {
  usePageTitle('隐私政策')
  return (
    <div className="basics-page about-page">
      <div className="page-header">
        <h1 className="page-title">隐私政策</h1>
        <p className="page-subtitle text-soft">观象 · 个人学习站 · 更新于 2026-08-03</p>
      </div>

      <section className="about-section">
        <h2 className="about-section__title">一句话</h2>
        <p><strong>不登录就能读完全站。</strong>不登录时,「观象」不收集姓名、联系方式或设备指纹,你的收藏、批注、推演记录只留在这台设备上。</p>
        <p><strong>登录是可选的</strong>,只为两件事:在设备之间同步研习足迹,以及参与评论。登录后我们会保存你的<strong>邮箱地址</strong>与你选择同步的<strong>研习数据</strong>。账号随时可以自行注销,注销即彻底删除。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">我们收集哪些数据</h2>
        <p>任何情况下都<strong>不</strong>索取电话、位置、通讯录、相册,也不读取广告标识符、不制作设备指纹、不做跨站追踪。</p>
        <p><strong>一、登录账号(仅当你主动注册或登录时)</strong></p>
        <ul className="about-list">
          <li><strong>邮箱地址</strong> —— 作为账号标识与找回凭据;</li>
          <li>用邮箱注册时,密码经不可逆哈希后保存,<strong>我们不持有你的明文密码</strong>;用 Google 登录时,我们从 Google 只取<strong>邮箱与一个用户标识</strong>(申请范围仅 <code>openid</code>、<code>email</code>),不读取你的通讯录、云端硬盘或任何其他 Google 数据;</li>
          <li>昵称(默认取邮箱 @ 前半段,<strong>可自行修改</strong>)与头像编号;</li>
          <li>登录会话凭证。</li>
        </ul>
        <p><strong>二、云端同步的研习数据(仅当你登录时)</strong>:收藏、批注、阅读与研习进度、推演历史、偏好设置。用途只有一个 —— 让你换设备后接着读。<strong>不做分析、不做画像、不出售、不共享。</strong></p>
        <p><strong>三、评论与治理记录(仅当你发表或操作时)</strong>:评论正文、发表时间与所在章节;你提交的举报;你的屏蔽名单。<strong>评论与昵称是公开的</strong>,任何访客都能看到 —— 请不要在评论里写个人敏感信息。</p>
        <p><strong>四、匿名阅读统计</strong>(网页版,与账号<strong>不</strong>关联):</p>
        <ul className="about-list">
          <li>浏览器首次访问时随机生成的匿名编号(cid);</li>
          <li>离开页面时的路径、典籍/章节标识和本次停留毫秒数;</li>
          <li>事件发生时间;</li>
          <li>粗粒度地理位置(国家/地区,部分情况精确到省/州级)——由 Cloudflare 在边缘节点根据连接 IP 自动解析后附加在请求上,<strong>本站服务端不读取、不记录、不存储原始 IP 地址本身</strong>,只保留解析后的国家/地区名称。</li>
        </ul>
        <p>该事件不含姓名、账号、邮箱、IP 或 User-Agent 指纹,<strong>也不与登录账号关联</strong>——即使你已登录,阅读埋点仍是匿名的、无法回溯到你。仅用于查看聚合阅读趋势与地区分布。数据存放在本站的 Cloudflare D1,不用于广告、画像或出售。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">应用在本机保存哪些内容</h2>
        <p>以下内容始终有一份保存在本机(localStorage);<strong>只有在你登录后</strong>,其中的研习数据才会同步一份到服务器:</p>
        <ul className="about-list">
          <li>偏好设置(主题、字号、行宽、译文开关等);</li>
          <li>收藏的段落、批注笔记;</li>
          <li>阅读进度、研习进度;</li>
          <li>推演(起卦)的本地历史记录;</li>
          <li>「今日一辩 / 今日一卦」等当日一次性提示的标记。</li>
        </ul>
        <p>这些数据你可随时在<strong>设置 → 数据管理</strong>中「导出备份」或「导入」。卸载应用、清除应用数据即会将本机副本永久删除;<strong>云端副本随账号注销一并删除</strong>(见下「你的权利」)。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">网络与第三方</h2>
        <p>iOS 包内的经文、译注、白话和配图随应用打包,<strong>可完全离线使用</strong>;它不启用上述网页埋点。网页 PWA 在资源缓存后也可离线阅读。全站搜索在本机完成,不向外发送查询词。</p>
        <p>网站由 Cloudflare Pages 托管,数据写入 Cloudflare D1,并使用 Cloudflare Web Analytics 查看不含 Cookie 的基础访问趋势。发表评论时使用 <strong>Cloudflare Turnstile</strong> 做人机验证,它会读取该次交互的浏览器信号以判断是否为机器人。若你选择用 Google 登录,浏览器会跳转到 Google 完成授权,该过程适用 Google 自己的隐私政策。<strong>本站不集成广告、社交或跨站画像 SDK,不向广告商共享数据。</strong></p>
        <p>若你主动点击应用内指向外部网站的链接,将由你的浏览器打开该网站,其数据处理适用该网站自己的隐私政策。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">儿童</h2>
        <p>本应用面向古籍学习者,<strong>不针对儿童设计,也不面向 13 岁以下用户提供账号服务</strong>。我们不会有意收集儿童的个人信息;若你认为有未成年人在此注册了账号,请来信,我们会尽快删除。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">你的权利</h2>
        <ul className="about-list">
          <li><strong>导出</strong> —— 设置 → 数据管理 → 「导出全部数据」,一个 JSON 文件带走全部研习记录;</li>
          <li><strong>更正</strong> —— 昵称可随时修改;评论可随时删除自己的;</li>
          <li><strong>注销账号</strong> —— 设置 → 账号 → 「注销账号」。这会<strong>连同邮箱、登录方式、云端足迹、你发表的评论、举报与屏蔽记录一并永久删除,不可撤销</strong>。若想留档,请先导出;</li>
          <li><strong>只用本地</strong> —— 不登录即可使用全部阅读功能,数据不出本机。</li>
        </ul>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">内容性质说明</h2>
        <p>应用收录易经、道藏、儒佛心学、诸子、中医、谋略等典籍的原文与研习性译注。相关解读<strong>仅供学习研究参考</strong>,并非宗教宣化、医疗诊断建议或吉凶预测;中医内容<strong>研习不诊疗</strong>,身体不适请就医。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">政策变更与联系方式</h2>
        <p>本政策如有更新,将在本页公布并更新顶部日期。如对隐私有任何疑问,可联系:<a href="mailto:hexa@gavin.pub">hexa@gavin.pub</a>(备用 <a href="mailto:gaojiasheng.him@foxmail.com">gaojiasheng.him@foxmail.com</a>)。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">Privacy Policy (English summary)</h2>
        <p><strong>Guanxiang (观象)</strong> can be read in full without an account. Without signing in we collect no name, contact details, advertising identifiers, or device fingerprints, and your bookmarks, notes and divination history stay on your device.</p>
        <p><strong>Signing in is optional</strong> and serves two purposes: syncing your study records across devices, and posting comments. We then store your <strong>email address</strong>, a display name (editable), a hashed password (email sign-up) or a Google user identifier (Google sign-in — we request only <code>openid</code> and <code>email</code>), plus whatever study data you sync. Comments and display names are public. Reports you file and people you block are stored so moderation works.</p>
        <p>Separately, the website records <strong>anonymous</strong> reading events — a random browser ID, page/book/chapter identifiers, dwell time, timestamp, and a coarse country/region resolved at Cloudflare's edge (the raw IP is never read, logged or stored). These are <strong>never linked to your account</strong>. Nothing is sold, shared with advertisers, or used for profiling. Cloudflare Turnstile is used for bot checks when posting.</p>
        <p><strong>Your rights</strong>: export everything as JSON, edit your display name, delete your own comments, or <strong>delete your account</strong> (Settings → Account) — which permanently erases your email, sign-in methods, synced records, comments, reports and blocks. Questions: <a href="mailto:hexa@gavin.pub">hexa@gavin.pub</a>.</p>
      </section>

      <p style={{ marginTop: '2rem' }}><Link to="/about" className="btn btn--secondary">关于本站</Link></p>
    </div>
  )
}
