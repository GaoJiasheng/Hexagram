import { Link } from 'react-router-dom'

// 「凭什么信」牌记(2026-08-08 首页介绍层所立;2026-09-25 owner 要它也进「跋」)——
// 首页 PortalLanding 与落款浮层 Colophon 共用这一份,改一处两处同步。
// ⚠️ 「转载」一条与仓库里两份 LICENSE 一致:原创内容 CC BY-NC 4.0、源代码 MIT。别只写一半。
export default function TrustList({ onNavigate }) {
  return (
    <>
      <dl className="landing-trust__list">
        <div><dt>底本</dt><dd>一律取维基文库通行本,逐书择本要点写在各书题解</dd></div>
        <div><dt>译注</dt><dd>白话、注疏、延伸均为本站原创,非转录他处译本</dd></div>
        <div><dt>校验</dt><dd>引文逐字核为原文精确子串,不过则不落库</dd></div>
        <div><dt>纠错</dt><dd>每章末尾都有报错入口,写信给 <a href="mailto:hexa@gavin.pub">hexa@gavin.pub</a></dd></div>
        <div><dt>转载</dt><dd>原创内容 CC BY-NC 4.0(署名、非商用即可自由使用);源代码 MIT</dd></div>
      </dl>
      <p className="landing-trust__more">
        <Link to="/about" onClick={onNavigate}>关于本站 · 研读铁律与数据说明 →</Link>
      </p>
    </>
  )
}
