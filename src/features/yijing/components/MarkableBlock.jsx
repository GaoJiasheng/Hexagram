import { StarIcon, PenIcon, LinkIcon, CheckIcon, CardIcon } from '../../reader/ActIcons.jsx'

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
  // 触屏:点段尾小点才展开操作(T7)。**不用 useState**——MarkableBlock.test.jsx 把本组件当普通函数直接调用来检查返回的树,
  // 组件里一有 hook 就抛 Invalid hook call;这里的展开/收起只是一个 class 的开关,直接在 DOM 上翻即可(桌面端该按钮不显示)。
  const toggleActs = (e) => {
    const box = e.currentTarget.parentElement
    const open = box.classList.toggle('para-actions--open')
    e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false')
    e.currentTarget.setAttribute('aria-label', open ? '收起段落操作' : '段落操作')
  }

  return (
    <>
      <div className="detail-quotable" id={anchorOnParent ? undefined : anchorId}>
        {children}
        <div className="para-actions">
          <button
            type="button"
            className="para-dot"
            aria-label="段落操作"
            aria-expanded="false"
            onClick={toggleActs}
          />
          <button
            type="button"
            className={`para-act ${marked ? 'para-act--on' : ''}`}
            onClick={() => onToggleMark(itemId, original)}
            aria-label={marked ? '取消收藏' : '收藏此段'}
            aria-pressed={marked}
            data-tip={marked ? '取消收藏' : '收藏此段'}
          ><StarIcon on={marked} /></button>
          <button
            type="button"
            className={`para-act ${note ? 'para-act--on' : ''}`}
            onClick={() => onOpenEdit(markKey, note?.text || '')}
            aria-label="批注"
            data-tip={note ? '编辑批注' : '写批注'}
          ><PenIcon /></button>
          <button
            type="button"
            className={`para-act ${copied ? 'para-act--on' : ''}`}
            onClick={() => onCopyLink(anchorId)}
            aria-label="复制本段链接"
            data-tip={copied ? '已复制链接' : '复制本段链接'}
          >{copied ? <CheckIcon /> : <LinkIcon />}</button>
          <button
            type="button"
            className="para-act"
            onClick={() => onQuote(original, translation, sourceLabel)}
            aria-label="生成金句卡"
            data-tip="生成金句卡"
          ><CardIcon /></button>
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
