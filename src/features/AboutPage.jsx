import { Link } from 'react-router-dom'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 关于本站 / 帮助(#3)——定位 + 各组研读铁律 + 用法 + 数据隐私。全站共用一份。
export default function AboutPage() {
  usePageTitle('关于本站')
  return (
    <div className="basics-page about-page">
      <div className="page-header">
        <h1 className="page-title">关于本站</h1>
        <p className="page-subtitle text-soft">观象 · 个人学习站</p>
      </div>

      <section className="about-section">
        <h2 className="about-section__title">这是什么</h2>
        <p>一个人做的古籍学习站,收易经、道藏、儒、佛、阳明心学、法墨兵纵横诸子、中医、谋略杂纂等十组典籍的原文、白话译注与每章延伸。纯前端、无账号、可离线,你的数据只存在自己的浏览器里。</p>
        <p>解读内容由人工与机器协同整理,<strong>仅供研习参考</strong>,非权威定本,亦非宗教、医疗或处世指导。原文一律取自维基文库等公开底本。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">各组的研读铁律</h2>
        <ul className="about-list">
          <li><strong>释典(佛)</strong>:研习不宣化,不下吉凶 / 果报断语。</li>
          <li><strong>中医</strong>:<strong>研习不诊疗</strong>——原文方剂照原典录,但注疏 / 延伸不述功效、用法、用量,不下病症 / 疗效断语,不教自疗。<em>⚠ 本站内容非医疗建议,身体不适请就医。</em></li>
          <li><strong>谋略杂纂</strong>:所收《天下无谋》五部学界多判为<strong>托名伪书</strong>,本站显著标「托名 · 真伪存疑」,取文献批判视角,不为伪书张目、不作处世权术教程。</li>
          <li><strong>诸子(法 / 墨 / 兵 / 纵横)</strong>:思想史视角,如实呈现其面目,不作现代政治影射、不作权术施用教程。</li>
        </ul>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">底本与凡例</h2>
        <p>原文一律取<strong>流传最广的通行本</strong>,自维基文库等公开来源抓取,繁体转简体,标点从通行排印本;每部书的撰人、版本源流见各书<strong>题解的「撰人小传」</strong>。择本要点:</p>
        <ul className="about-list">
          <li><strong>道德经</strong>取王弼注本(注文于管线清洗时剔除,故分段多于通行排印本);<strong>庄子</strong>郭象本;<strong>列子</strong>张湛注本、<strong>文子</strong>今本(定州汉简证有古本而今本多异)、<strong>黄庭</strong>内景经、<strong>阴符经</strong>——四者成书存疑,本站作文献存疑研读。</li>
          <li><strong>心经</strong>取玄奘略本(大正藏 No.251);<strong>金刚经</strong>罗什译、江味农校定本;<strong>坛经</strong>宗宝本;<strong>阿弥陀经</strong>罗什译(往生咒附录非原译,不录)。</li>
          <li><strong>大学 / 中庸</strong>取《礼记》古本(非朱熹章句本);<strong>孝经</strong>今文十八章;<strong>荀子</strong>《成相》《赋》存其弹词、隐语体例。</li>
          <li><strong>系辞</strong>从孔颖达九章分法(非十二章);<strong>周易参同契</strong>从维基文库三十五章分法;<strong>谋略</strong>五部为《天下无谋》托名伪书,显著框注。</li>
        </ul>
        <p className="text-faint" style={{ fontSize: '0.85rem' }}>经文为只读生成物,发现问题改抓取 / 解析逻辑后重跑,不直接手改;校验脚本核对结构与抽样内容。</p>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">怎么用</h2>
        <ul className="about-list">
          <li><strong>读经</strong>:经文字词可悬停看注疏;工具条可开译文 / 上下 ⇄ 左右对照、调字号;每段右侧可 ★收藏、✎批注、🔗复制本段链接。</li>
          <li><strong>搜索</strong>:顶栏放大镜或按 <kbd>/</kbd> 键,可搜经名、正文、译文、注疏、延伸;读经站面板可切「本站 / 全站」,全站态横跨诸组搜跨派概念(如「无为 / 格物 / 致良知」)。</li>
          <li><strong>设置</strong>:顶栏齿轮——主题(亮 / 暗 / 跟随系统)、字号、行宽、译文开关、数据导出导入。</li>
          <li><strong>我的</strong>:顶栏 ☯——本组的续读、收藏与批注汇总。</li>
          <li><strong>易经</strong>另有推演工作台、学堂十二篇、卦画闪卡、春秋筮例等。</li>
        </ul>
      </section>

      <section className="about-section">
        <h2 className="about-section__title">你的数据</h2>
        <p>收藏、笔记、推演历史、研习进度等<strong>全部只存于此浏览器的 localStorage,不上传任何服务器</strong>。清浏览器缓存或更换设备会丢失——请在<strong>设置 → 数据管理</strong>里定期「导出全部数据」做备份,换设备时再导入。</p>
      </section>

      <div className="about-back">
        <Link to="/hexagram" className="btn btn--secondary">← 诸学门户</Link>
      </div>
    </div>
  )
}
