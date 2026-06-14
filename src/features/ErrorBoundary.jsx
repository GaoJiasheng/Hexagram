import { Component } from 'react'

// 路由级错误边界(批B):兜住懒加载 chunk 加载失败 / 渲染异常,给「重新载入」出口,
// 避免发版后旧标签页点进新页时 import() reject → Suspense 永久挂起白屏。
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // 懒加载 chunk 失败(发版后旧 hash 已失效)——自动刷一次取最新资源,带循环保护。
    const isChunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(
      error?.message || '',
    )
    if (isChunkError && typeof sessionStorage !== 'undefined') {
      const KEY = 'guanxiang.v1.chunk-reloaded'
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ color: 'var(--ink-faint)', marginBottom: 16 }}>页面加载出错了。</p>
          <button className="btn btn--secondary" onClick={() => window.location.reload()}>
            重新载入
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
