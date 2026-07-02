import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 隐私政策(App Store / 上架要求的公开页)。本 App 无账号、无后端、无第三方 SDK,
// 所有数据只存本机 localStorage,不上传、不收集、不追踪。对应 App 隐私标签「不收集数据」。
export default function PrivacyPage() {
  usePageTitle('隐私政策')
  return (
    <div className="basics-page about-page">
      <div className="page-header">
        <h1 className="page-title">隐私政策</h1>
        <p className="page-subtitle text-soft">观象 · 个人学习站 · 更新于 2026-07-02</p>
      </div>

      <section className="about-section">
        <h2 className="about-section__title">一句话</h2>
        <p><strong>「观象」不收集、不上传、不追踪你的任何个人数据。</strong>它没有账号系统、没有服务器后端、没有广告、没有第三方分析或追踪工具。你在应用里的一切数据都只保存在你自己的设备上。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">我们收集哪些数据</h2>
        <p>不收集。我们不要求注册,不索取姓名、邮箱、电话、位置、通讯录、相册等任何个人信息,也不读取设备标识符用于追踪。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">应用在本机保存哪些内容</h2>
        <p>为实现阅读与研习功能,以下内容仅保存在你设备本地的存储(localStorage)中,<strong>不会离开你的设备、不会上传到任何服务器</strong>:</p>
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
        <p>应用内容(经文、译注、白话、配图)已随应用一同打包,<strong>可完全离线使用</strong>。全站搜索在本机完成,不向外发送查询词。应用不集成任何第三方广告、分析、崩溃统计或社交 SDK,不与任何第三方共享数据。</p>
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
        <p><strong>Guanxiang (观象)</strong> collects no personal data. It has no account system, no backend server, no ads, and no third-party analytics or tracking SDKs. All app data — preferences, bookmarks, notes, reading and study progress, and local divination history — is stored only in your device's local storage and never leaves your device. Bundled content works fully offline; on-device search sends no queries out. You can export or delete this data at any time via Settings; uninstalling the app removes it. The app is not directed at children and collects no information from anyone. Questions: <a href="mailto:gaojiasheng.him@gmail.com">gaojiasheng.him@gmail.com</a>.</p>
      </section>

      <p style={{ marginTop: '2rem' }}><Link to="/about" className="btn btn--secondary">关于本站</Link></p>
    </div>
  )
}
