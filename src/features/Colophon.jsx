import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import colophon from '../data/colophon.json'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

const appVersion = __APP_VERSION__
const buildTimestamp = __BUILD_DATE__
const buildDate = buildTimestamp.slice(0, 10)

function ContactValue({ contact }) {
  if (!contact.value) return <span className="colophon-placeholder">待补</span>
  const href = contact.href === 'mailto:' ? `mailto:${contact.value}` : contact.href
  if (!href) return <span>{contact.value}</span>
  const external = href.startsWith('http')
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {contact.value}
    </a>
  )
}

export function ColophonContent() {
  return (
    <div className="colophon-content">
      <section className="colophon-block colophon-block--author">
        <h2 className="colophon-block__title">署名</h2>
        <p className="colophon-author">
          <strong>{colophon.author.name}</strong>
          <span>@{colophon.author.id}</span>
        </p>
        <p className="colophon-block__text">{colophon.author.role}</p>
      </section>

      <section className="colophon-block">
        <h2 className="colophon-block__title">缘起</h2>
        <div className="colophon-origin">
          {(Array.isArray(colophon.origin) ? colophon.origin : [colophon.origin]).map((para, i) => (
            <p key={i} className="colophon-block__text">{para}</p>
          ))}
        </div>
      </section>

      <section className="colophon-block">
        <h2 className="colophon-block__title">联系方式</h2>
        <dl className="colophon-contacts">
          {colophon.contacts.map((contact) => (
            <div key={contact.label} className="colophon-contact">
              <dt>{contact.label}</dt>
              <dd><ContactValue contact={contact} /></dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="colophon-block">
        <h2 className="colophon-block__title">协议声明</h2>
        <p className="colophon-block__text">{colophon.license.summary}</p>
        <a className="colophon-license" href={colophon.license.href}>查看完整 LICENSE →</a>
      </section>

      <section className="colophon-block">
        <h2 className="colophon-block__title">版本与更新</h2>
        <div className="colophon-version">
          <span>版本 <strong>v{appVersion}</strong></span>
          <span>构建 <time dateTime={buildTimestamp} title={buildTimestamp}>{buildDate}</time></span>
        </div>
        <p className="colophon-block__text">{colophon.update.summary}</p>
      </section>

      <section className="colophon-block">
        <h2 className="colophon-block__title">AI 辅助鸣谢</h2>
        <p className="colophon-block__text">{colophon.credits}</p>
      </section>
    </div>
  )
}

export function ColophonPage() {
  usePageTitle('跋 · 落款')

  return (
    <div className="basics-page colophon-page">
      <Link to="/" className="colophon-page__back">← 诸学门户</Link>
      <header className="colophon-page__head">
        <span className="colophon-page__seal" aria-hidden="true">跋</span>
        <div>
          <h1 className="page-title">落款</h1>
          <p className="page-subtitle text-soft">观为起，跋为收</p>
        </div>
      </header>
      <ColophonContent />
    </div>
  )
}

export default function Colophon({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings-overlay colophon-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="settings-sheet colophon-sheet" role="dialog" aria-modal="true" aria-label="跋 · 落款">
        <div className="settings-sheet__head colophon-sheet__head">
          <span className="settings-sheet__title colophon-sheet__title">
            <span className="colophon-sheet__seal" aria-hidden="true">跋</span>
            落款
          </span>
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>
        <ColophonContent />
        <div className="colophon-sheet__foot">
          <Link to="/ba" onClick={onClose}>打开独立页 →</Link>
        </div>
      </div>
    </div>
  )
}
