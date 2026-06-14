import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import TermTip from '../components/TermTip.jsx'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import LearnNextLink from '../components/LearnNextLink.jsx'

// 推演入门(v12 §3)：起卦与解卦的总纲，串起本卦/动爻/变卦/贞悔与六法、变占规则
export default function TuiyanIntroPage() {
  usePageTitle('推演入门')
  useEffect(() => { markRead('tuiyan') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">推演入门</h1>
        <p className="page-subtitle">起一卦、看它怎么变、读它说什么——推演工作台到底在做什么，这一篇讲清楚。</p>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">一、什么是起卦与推演</h2>
        <div className="basics-text">
          <p>占筮的第一步叫<strong>起卦</strong>：用某种办法得到一个卦，这个卦叫<TermTip term="bengua">本卦</TermTip>。本卦六爻里，可能有一两爻处在「将变未变」的临界点上，叫<TermTip term="dongyao">动爻</TermTip>；动爻由阳变阴、由阴变阳，本卦就变成另一个卦，叫<TermTip term="biangua">变卦</TermTip>。</p>
          <p>所谓「推演」，就是把这套关系一次摊开给你看：<strong>本卦 → （哪几爻动） → 变卦</strong>，再加上互卦、错卦、综卦等由本卦派生的相关卦。工作台左侧负责起卦，右侧自动算出这一整套变化与断辞。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">二、四个关键词</h2>
        <div className="basics-text">
          <ul className="intro-terms">
            <li><strong><TermTip term="bengua">本卦</TermTip></strong>——起出的那一卦，占问的起点。</li>
            <li><strong><TermTip term="dongyao">动爻</TermTip></strong>——本卦中正在变化的爻；有几个动爻，决定了用哪条规则断占（见第四节）。可以没有动爻。</li>
            <li><strong><TermTip term="biangua">变卦</TermTip></strong>——动爻变后得到的卦，代表事情的去向。</li>
            <li><strong><TermTip term="zhenhui">贞悔</TermTip></strong>——断占时本卦为「贞」（内、主、现状）、变卦为「悔」（外、客、趋向）；另有以内卦为贞、外卦为悔的一义，本站两义并存，按上下文取。</li>
          </ul>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">三、起卦六法：两类</h2>
        <div className="basics-text">
          <p>工作台的六种起卦方式，其实分两类——</p>
          <p className="intro-group-label">① 已经知道是哪一卦，直接输进去：</p>
          <ul className="intro-terms">
            <li><strong>上下卦</strong>——分别点选上卦、下卦两个三爻符号拼成一卦。适合你已经知道卦的上下卦象。</li>
            <li><strong>逐爻</strong>——从初爻到上爻逐条设阴/阳，微调到目标卦。适合在一卦基础上改一两爻试看。</li>
            <li><strong>检索</strong>——输入卦名、拼音或卦序直接定位。最快的「我就想看这一卦」。</li>
          </ul>
          <p className="intro-group-label">② 现场起一卦来占问（心里有事要问时用）:</p>
          <ul className="intro-terms">
            <li><strong>梅花</strong>——梅花易数，按时间或数字起卦，自带一个动爻，断法另有体用。<Link to="/basics/meihua" className="learn-inline">学梅花易数 →</Link></li>
            <li><strong>大衍</strong>——大衍揲蓍，模拟四十九根蓍草、十八变成卦，古法正宗、动爻可多。<Link to="/basics/shicao" className="learn-inline">学揲蓍成卦 →</Link></li>
            <li><strong>金钱</strong>——金钱卦，六次掷三枚铜钱，以背面数定爻，最简便通行。<Link to="/basics/jinqian" className="learn-inline">学金钱卦 →</Link></li>
          </ul>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">四、起卦之后：怎么读</h2>
        <div className="basics-text">
          <p>起出本卦、标好动爻，要读哪一句？历来有规则。朱熹《易学启蒙·考变占》把它整理成一张表，本站工作台的「断法」一节即依此自动判定：</p>
          <table className="intro-rule-table">
            <thead><tr><th>动爻数</th><th>以何为占</th></tr></thead>
            <tbody>
              <tr><td>无动爻</td><td>以本卦卦辞占，兼参大象传</td></tr>
              <tr><td>一爻变</td><td>以本卦那条变爻的爻辞占</td></tr>
              <tr><td>二爻变</td><td>以两条变爻的爻辞占，上爻为主</td></tr>
              <tr><td>三爻变</td><td>以本卦、变卦两卦辞占（本卦贞、变卦悔）</td></tr>
              <tr><td>四爻变</td><td>以变卦中两不变爻的爻辞占，下爻为主</td></tr>
              <tr><td>五爻变</td><td>以变卦中唯一不变爻的爻辞占</td></tr>
              <tr><td>六爻皆变</td><td>以变卦卦辞占（乾用九、坤用六例外）</td></tr>
            </tbody>
          </table>
          <p>断法卡不止给出该读哪句，还叠了三层：<strong>经文+白话译文</strong>、对应的<strong>传文</strong>（卦辞配彖传、爻辞配小象，均十翼原文释卦象）、以及<strong>字词注疏</strong>（悬停经文里的词即出训诂）。这一切只呈卦象义理，不作吉凶断语。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">五、动手试试</h2>
        <div className="basics-text">
          <p>读懂了就去用——工作台引导框里有「示范一卦」按钮，会带你走一遍完整流程。</p>
          <div className="intro-actions">
            <Link to="/workbench" className="btn btn--primary">去推演工作台 →</Link>
            <Link to="/shili" className="btn btn--secondary">看春秋人怎么用 →</Link>
          </div>
        </div>
        <p className="text-faint intro-disclaimer">本站为研习用途：推演呈现的是卦象、卦变与历代经传义理，判断与取舍仍在读者自己。</p>
      </section>
      <LearnNextLink id="tuiyan" />
    </div>
  )
}
