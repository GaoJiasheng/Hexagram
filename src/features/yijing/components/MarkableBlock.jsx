export default function MarkableBlock({
  markKey,
  itemId,
  anchorId = itemId,
  anchorOnParent = false,
  original,
  translation,
  sourceLabel,
  marks,
  notes,
  editingKey,
  draft,
  copiedKey,
  onToggleMark,
  onOpenEdit,
  onSaveNote,
  onCancelEdit,
  onCopyLink,
  onSetDraft,
  onQuote,
  children,
}) {
  const marked = !!marks[markKey]
  const note = notes[markKey]
  const isEditing = editingKey === markKey
  const copied = copiedKey === anchorId

  return (
    <>
      <div className="detail-quotable" id={anchorOnParent ? undefined : anchorId}>
        {children}
        <div className="para-actions">
          <button
            type="button"
            className={`para-act ${marked ? 'para-act--on' : ''}`}
            onClick={() => onToggleMark(itemId, original)}
            aria-label={marked ? '取消收藏' : '收藏此段'}
            aria-pressed={marked}
            data-tip={marked ? '取消收藏' : '收藏此段'}
          >★</button>
          <button
            type="button"
            className={`para-act ${note ? 'para-act--on' : ''}`}
            onClick={() => onOpenEdit(markKey, note?.text || '')}
            aria-label="批注"
            data-tip={note ? '编辑批注' : '写批注'}
          >✎</button>
          <button
            type="button"
            className={`para-act ${copied ? 'para-act--on' : ''}`}
            onClick={() => onCopyLink(anchorId)}
            aria-label="复制本段链接"
            data-tip={copied ? '已复制链接' : '复制本段链接'}
          >{copied ? '✓' : '🔗'}</button>
          <button
            type="button"
            className="para-act"
            onClick={() => onQuote(original, translation, sourceLabel)}
            aria-label="生成金句卡"
            data-tip="生成金句卡"
          >🖼</button>
        </div>
      </div>
      {note && !isEditing && (
        <button
          type="button"
          className="para-note"
          onClick={() => onOpenEdit(markKey, note.text)}
          title="点击编辑批注"
        >
          <span className="para-note__icon" aria-hidden="true">✎</span>{note.text}
        </button>
      )}
      {isEditing && (
        <div className="para-note-editor">
          <textarea
            className="para-note-editor__input"
            value={draft}
            onChange={(event) => onSetDraft(event.target.value)}
            placeholder="写点批注…"
            rows={3}
            autoFocus
          />
          <div className="para-note-editor__actions">
            <button type="button" className="btn btn--secondary" onClick={() => onSaveNote(itemId, original)}>保存</button>
            <button type="button" className="btn btn--ghost" onClick={onCancelEdit}>取消</button>
          </div>
        </div>
      )}
    </>
  )
}
