export default function EmptyState({ icon = '☵', text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <p className="empty-state__text">{text}</p>
      {action && (
        <button className="btn btn--secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
