import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 隐私政策(App Store / 上架要求的公开页)。网页端与 iOS 包内能力不同:
// 网页端有匿名阅读统计;iOS 包内不启用该埋点,个人研习数据仍只存本机。
export default function PrivacyPage() {
  usePageTitle('隐私政策')
  return (
    <div className="basics-page about-page">
      <div className="page-header">
        <h1 className="page-title">隐私政策</h1>
        <p className="page-subtitle text-soft">观象 · 个人学习站 · 更新于 2026-07-15</p>
      </div>

      <section className="about-section">
        <h2 className="about-section__title">一句话</h2>
        <p><strong>「观象」不收集姓名、联系方式、设备指纹等可识别个人的信息。</strong>网页端会发送最小化的匿名阅读统计;收藏、批注、推演记录和设置等个人研习数据仍只保存在你的设备上。iOS 包内版本不启用网页阅读埋点。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">我们收集哪些数据</h2>
        <p>当前不要求注册,不索取姓名、邮箱、电话、位置、通讯录、相册等个人信息,也不读取广告标识符或制作设备指纹。</p>
        <p>仅在 HTTP(S) 网页版中,为了解哪些内容真正被阅读,会记录以下匿名事件:</p>
        <ul className="about-list">
          <li>浏览器首次访问时随机生成的匿名编号(cid);</li>
          <li>离开页面时的路径、典籍/章节标识和本次停留毫秒数;</li>
          <li>事件发生时间;</li>
          <li>粗粒度地理位置(国家/地区,部分情况精确到省/州级)——由 Cloudflare 在边缘节点根据连接 IP 自动解析后附加在请求上,<strong>本站服务端不读取、不记录、不存储原始 IP 地址本身</strong>,只保留解析后的国家/地区名称。</li>
        </ul>
        <p>该事件不包含姓名、账号、邮箱、IP 地址或 User-Agent 指纹,也不与未来的登录账号关联;只用于 owner 查看聚合阅读趋势与访客地区分布。数据存放在本站的 Cloudflare D1 数据库,不用于广告、画像或出售。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">应用在本机保存哪些内容</h2>
        <p>为实现阅读与研习功能,以下内容仅保存在你设备本地的存储(localStorage)中,<strong>当前不会上传到服务器</strong>:</p>
        <ul className="about-list">
          <li>偏好设置(主题、字号、行宽、译文开关等);</li>
          <li>收藏的段落、批注笔记;</li>
          <li>阅读进度、研习进度;</li>
          <li>推演(起卦)的本地历史记录;</li>
          <li>「今日一辩 / 今日一卦」等当日一次性提示的标记。</li>
        </ul>
        <p>这些数据你可随时在<strong>设置 → 数据管理</strong>中「导出备份」或「导入」。卸载应用、清除应用数据即会将它们从设备上永久删除。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">网络与第三方</h2>
        <p>iOS 包内的经文、译注、白话和配图随应用打包,<strong>可完全离线使用</strong>;它不启用上述网页埋点。网页 PWA 在资源缓存后也可离线阅读。全站搜索在本机完成,不向外发送查询词。</p>
        <p>网站由 Cloudflare Pages 托管,匿名阅读事件写入 Cloudflare D1,并使用 Cloudflare Web Analytics 查看不含 Cookie 的基础访问趋势。本站不集成广告、社交或跨站画像 SDK,不向广告商共享数据。</p>
        <p>若你主动点击应用内指向外部网站的链接,将由你的浏览器打开该网站,其数据处理适用该网站自己的隐私政策。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">儿童</h2>
        <p>本应用面向古籍学习者,不针对儿童设计,也不收集任何用户(包括儿童)的个人信息。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">内容性质说明</h2>
        <p>应用收录易经、道藏、儒佛心学、诸子、中医、谋略等典籍的原文与研习性译注。相关解读<strong>仅供学习研究参考</strong>,并非宗教宣化、医疗诊断建议或吉凶预测;中医内容<strong>研习不诊疗</strong>,身体不适请就医。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">政策变更与联系方式</h2>
        <p>本政策如有更新,将在本页公布并更新顶部日期。如对隐私有任何疑问,可联系:<a href="mailto:gaojiasheng.him@gmail.com">gaojiasheng.him@gmail.com</a>。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">Privacy Policy (English summary)</h2>
        <p><strong>Guanxiang (观象)</strong> does not collect names, contact details, advertising identifiers, or device fingerprints. Its HTTP(S) website records minimal anonymous reading events: a random browser ID, page/book/chapter identifiers, dwell time, event time, and a coarse country/region derived server-side by Cloudflare's edge from the connecting IP — the raw IP address itself is never read, logged, or stored. These events are stored in Cloudflare D1 for aggregate readership statistics and are not linked to accounts or used for advertising. The packaged iOS app does not enable this web telemetry. Preferences, bookmarks, notes, reading progress, and local divination history remain on the device and can be exported or deleted via Settings. On-device search sends no queries out. Questions: <a href="mailto:gaojiasheng.him@gmail.com">gaojiasheng.him@gmail.com</a>.</p>
      </section>

      <p style={{ marginTop: '2rem' }}><Link to="/about" className="btn btn--secondary">关于本站</Link></p>
    </div>
  )
}
