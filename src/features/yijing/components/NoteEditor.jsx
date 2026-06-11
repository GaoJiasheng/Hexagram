import { useState, useEffect, useRef } from 'react'
import { getNotes, saveNote } from '../storage.js'

export default function NoteEditor({ hexagramId }) {
  const [text, setText] = useState(() => getNotes()[hexagramId]?.text || '')
  const [saved, setSaved] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    setText(getNotes()[hexagramId]?.text || '')
  }, [hexagramId])

  function handleChange(e) {
    const val = e.target.value
    setText(val)
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveNote(hexagramId, val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 600)
  }

  return (
    <div className="note-editor">
      <div className="note-editor__header">
        <span className="note-editor__label">我的笔记</span>
        {saved && <span className="note-editor__saved">已存 ✓</span>}
      </div>
      <textarea
        className="note-editor__textarea"
        value={text}
        onChange={handleChange}
        placeholder="记下你对此卦的理解…"
        rows={4}
      />
    </div>
  )
}
