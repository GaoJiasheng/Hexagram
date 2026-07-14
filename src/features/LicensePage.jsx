import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 完整授权协议页(中英双语)。仓库根目录 LICENSE 文件是给 GitHub 读的纯文本版本;
// 这是给站内访客读的同一份内容,配站内样式(与 /privacy 同款 .about-section 骨架)。
export default function LicensePage() {
  usePageTitle('授权协议 · LICENSE')
  return (
    <div className="basics-page about-page">
      <div className="page-header">
        <h1 className="page-title">授权协议</h1>
        <p className="page-subtitle text-soft">《观象》· CC BY-NC 4.0 · 高家升（Gavin Gao）</p>
      </div>

      <section className="about-section">
        <h2 className="about-section__title">版权声明</h2>
        <p>Copyright © 2026 高家升 Gavin Gao（gaojiasheng）</p>
        <p>除下文明确排除的内容外，本仓库受版权保护的作品采用「知识共享 署名—非商业性使用 4.0 国际」许可协议(<strong>CC BY-NC 4.0</strong>)授权。</p>
        <p>
          官方协议说明(Deed，含多语言版本)：<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">creativecommons.org/licenses/by-nc/4.0</a><br />
          法律全文(Legal Code)：<a href="https://creativecommons.org/licenses/by-nc/4.0/legalcode" target="_blank" rel="noreferrer">creativecommons.org/licenses/by-nc/4.0/legalcode</a>
        </p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">中文人类可读摘要</h2>
        <p>在遵守协议条件的前提下，你可以复制、分享、转载、改编本协议覆盖的作品：</p>
        <ul className="about-list">
          <li><strong>署名</strong>：须以合理方式注明高家升（Gavin Gao / gaojiasheng）及作品来源，附上本协议链接，并说明是否作过修改。</li>
          <li><strong>非商业性使用</strong>：不得将本协议覆盖的作品用于商业目的。</li>
          <li><strong>不得附加限制</strong>：不得施加会阻止他人行使本协议所授权利的法律条款或技术措施。</li>
        </ul>
        <p>本摘要仅用于帮助理解，不替代 CC BY-NC 4.0 法律全文；如有歧义，以官方法律全文为准。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">授权范围声明</h2>
        <p>本协议覆盖高家升（Gavin Gao）在本仓库中的原创内容与全部源代码，包括但不限于：</p>
        <ul className="about-list">
          <li>白话文章(<code>src/data/*/baihua/</code>);</li>
          <li>逐段注疏与译文(<code>scripts/authored/</code>、各 <code>zhushi-anchored/</code> 目录及相关原创译注数据);</li>
          <li>每章延伸、思想脑图;</li>
          <li>「观书」模块的原创封面、脑图与文章;</li>
          <li>原创 SVG 配图;</li>
          <li>辩论内容(<code>debates</code>);</li>
          <li>本仓库全部源代码。</li>
        </ul>
        <p>本协议<strong>不覆盖</strong>公版古籍原文本身，包括 <code>hexagrams.json</code>、<code>classics/*.json</code> 等数据管线抓取或生成文件中的古籍原文。这些古籍原文属于公共领域，不属于任何个人可以重新主张版权或授权的范围，任何人均可依其公共领域状态自由使用。</p>
        <p>若同一数据文件同时包含公版古籍原文与原创译文、注疏或编排，只有其中的原创部分受本协议覆盖；古籍原文部分仍为公共领域。仓库中另有明确权利标注的第三方材料，依其各自的权利状态或许可条款处理。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">License (English)</h2>
        <p>Copyright © 2026 Gao Jiasheng, Gavin Gao (gaojiasheng).</p>
        <p>Except where otherwise noted below, copyrightable works in this repository are licensed under the <strong>Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)</strong>.</p>
        <p>
          Official deed (multilingual): <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">creativecommons.org/licenses/by-nc/4.0</a><br />
          Legal code: <a href="https://creativecommons.org/licenses/by-nc/4.0/legalcode" target="_blank" rel="noreferrer">creativecommons.org/licenses/by-nc/4.0/legalcode</a>
        </p>
        <p>In short, subject to the license conditions, you may copy, share, and adapt the covered works, provided you:</p>
        <ul className="about-list">
          <li><strong>Give appropriate credit</strong> to Gavin Gao (gaojiasheng), link to the license, and indicate if changes were made;</li>
          <li><strong>Do not use the material for commercial purposes</strong>;</li>
          <li><strong>Do not apply additional legal or technical restrictions</strong> that prevent others from exercising the rights the license grants.</li>
        </ul>
        <p>This summary is provided for convenience only and does not replace the CC BY-NC 4.0 legal code; the legal code governs in case of any discrepancy.</p>
        <p><strong>Scope.</strong> This license covers Gavin Gao's original content and all source code in this repository — including but not limited to the vernacular ("baihua") essays, line-by-line commentary and translations, chapter extensions, mind maps, the "Study" module's original covers/mind-maps/articles, original SVG illustrations, debate content, and all source code. It does <strong>not</strong> cover the public-domain classical texts themselves (e.g. the raw text fields inside <code>hexagrams.json</code>, <code>classics/*.json</code>), which remain public domain and are not subject to anyone's copyright claim. Where a data file mixes public-domain source text with original translation/annotation/curation, only the original portion is covered.</p>
      </section>

      <p style={{ marginTop: '2rem' }}><Link to="/ba" className="btn btn--secondary">← 返回落款</Link></p>
    </div>
  )
}
