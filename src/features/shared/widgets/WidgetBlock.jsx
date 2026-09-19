import { lazy, Suspense, Component } from 'react'
import { validateWidget } from './schema.js'
import './widgets.css'

// 富文本 `widget` 块的宿主(design-v23 §5):按 kind 懒加载对应交互件。
// 白话、观书、导读、学堂共用 BaihuaArticle 渲染器,故加一种块四处生效。
//
// 三条兜底,保证「一个件坏了不连坐整篇文章」:
//   ① 参数不合法 → 不渲染件,只留 caption(check-data 已在构建期拦过一道,这里是运行时保险)
//   ② 件本身抛错 → ErrorBoundary 吞掉,显示一句「此图未能载入」
//   ③ kind 尚未实现 → 同 ①
// 加一个件:schema.js 登记校验 → 这里登记懒加载 → design-v23 §5 补契约。
const REGISTRY = {
  sizhu: lazy(() => import('./SizhuChart.jsx')),
  wuxing: lazy(() => import('./WuxingWheel.jsx')),
  jiazi: lazy(() => import('./JiaziGrid.jsx')),
  shishen: lazy(() => import('./ShishenDial.jsx')),
  dizhi: lazy(() => import('./DizhiRing.jsx')),
  qizhu: lazy(() => import('./QizhuDemo.jsx')),
  jieqi: lazy(() => import('./JieqiRing.jsx')),
  matrix: lazy(() => import('./MatrixGrid.jsx')),
  geju: lazy(() => import('./GejuFlow.jsx')),
}

class WidgetBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error('[widget]', this.props.kind, err) }
  render() {
    return this.state.failed ? <p className="wg-fallback">此图未能载入。</p> : this.props.children
  }
}

export default function WidgetBlock({ block }) {
  const Impl = REGISTRY[block.kind]
  const errs = validateWidget(block)
  if (errs.length) console.warn('[widget] 参数不合法,已跳过:', block.kind, errs)
  return (
    <figure className={`wg wg--${block.kind}`}>
      {Impl && !errs.length && (
        <WidgetBoundary kind={block.kind}>
          <Suspense fallback={<div className="wg-loading" aria-busy="true" />}>
            <Impl {...(block.props || {})} />
          </Suspense>
        </WidgetBoundary>
      )}
      {block.caption && <figcaption className="wg-cap">{block.caption}</figcaption>}
    </figure>
  )
}
