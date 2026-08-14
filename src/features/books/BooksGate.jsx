// 观书未获准访问时的门面。
//
// 措辞上刻意**不确认书房里有什么、甚至不强调它存在** —— 服务端对非管理员一律回 404,
// 界面这边也就没必要比服务端更多嘴。给一个登录入口和一条回首页的路,足够了。

import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import HomeSeal from './HomeSeal.jsx'
import './books.css'

export default function BooksGate({ state }) {
  const { openAuth, user } = useAuth()
  return (
    <div className="books-page" data-site="portal">
      <div className="books-topbar books-topbar--end"><HomeSeal /></div>
      {state === 'loading' ? (
        <p className="route-loading">⋯</p>
      ) : (
        <div className="books-gate">
          <p className="books-gate__line">这里需要管理员身份。</p>
          <p className="books-gate__sub">
            {user ? '当前账号没有访问权限。' : '请先登录。'}
          </p>
          <p className="books-gate__acts">
            {!user && (
              <button type="button" className="books-tag books-tag--on" onClick={() => openAuth?.()}>
                登录
              </button>
            )}
            <Link to="/" className="books-gate__home">回首页</Link>
          </p>
        </div>
      )}
    </div>
  )
}
