import './ProsodyRow.css'
import { SCHEME_TITLE } from './prosody.js'

// 格律层(design-v24 §7.3):韵文段原文之下,每句一行 ○ 平 / ● 仄 / ◐ 可平可仄 + 句末韵部小签。
// 只摆韵书所记——同部同色是「排列」,不是「判」;不标出律,不标合律。
// 符号由 CSS 画(不是图片、也不依赖字体里有没有 ◐);无障碍文本另给一份。

const TONE_CLS = { 平: 'ping', 仄: 'ze', 多: 'duo' }
const TONE_WORD = { 平: '平', 仄: '仄', 多: '可平可仄' }

// 单字说明:平/仄/可平可仄/韵书未收;入声字另注一句(今音或读平,此依韵书)
function charNote(x) {
  if (!x.tone) return '韵书未收'
  const w = TONE_WORD[x.tone]
  return x.ru ? `${w}（入声字；今普通话已派入四声，此依韵书作仄）` : w
}

function footTitle(ln) {
  const ep = ln.endPart
  if (!ep) return `「${ln.endChar}」韵书未收`
  const multi = ep.parts.length > 1 ? `韵书${ep.parts.length}收：` : ''
  const via = [ep.variant && `韵书作「${ep.as}」`, ep.ci && '见【詞】增补字'].filter(Boolean).join('，')
  return `「${ln.endChar}」${multi}${ep.parts.map((p) => p.title).join('；')}${via ? `（${via}）` : ''}`
}

function RhymeTag({ ln }) {
  const ep = ln.endPart
  const label = !ep ? '未收' : ln.pick ? ln.pick.label : ep.parts.map((p) => p.label).join('/')
  const cls = [
    'rhyme-tag',
    ln.color ? `rhyme-tag--c${ln.color}` : 'rhyme-tag--plain',
    !ep && 'rhyme-tag--none',
    ep && ep.parts.length > 1 && 'rhyme-tag--multi',
  ].filter(Boolean).join(' ')
  const title = footTitle(ln)
  return (
    <span className={cls} title={title}>
      <span className="rhyme-tag__char" aria-hidden="true">{ln.endChar}</span>
      <span className="rhyme-tag__part" aria-hidden="true">{label}</span>
      <span className="prosody-sr">{title}</span>
    </span>
  )
}

export default function ProsodyRow({ lines, tones = false }) {
  if (!lines || !lines.length) return null
  if (tones) {
    return (
      <div className="prosody prosody--tones">
        {lines.map((ln, k) => (
          <div className="prosody__line" key={k}>
            <span className="prosody__marks" aria-hidden="true">
              {ln.chars.map((x, j) => (
                <span
                  key={j}
                  className={`pz pz--${TONE_CLS[x.tone] || 'none'}${j === ln.chars.length - 1 && ln.color ? ` pz--end rhyme-c${ln.color}` : ''}`}
                  title={`${x.c}：${charNote(x)}`}
                />
              ))}
            </span>
            <span className="prosody-sr">
              {ln.chars.map((x) => `${x.c}${charNote(x)}`).join('，')}
            </span>
            <RhymeTag ln={ln} />
          </div>
        ))}
      </div>
    )
  }
  // 只韵脚(古体 / 词 / 曲):句末字 + 韵部签,顺次排成一行,窄屏自动折行
  return (
    <div className="prosody prosody--feet">
      {lines.map((ln, k) => <RhymeTag key={k} ln={ln} />)}
    </div>
  )
}

/** 工具条下方的图例 + 凡例(措辞照 design-v24 §7.3)。status: loading | ready | error */
export function ProsodyLegend({ scheme, tones, status }) {
  const book = SCHEME_TITLE[scheme] || '韵书'
  const toneBook = tones && scheme !== 'pingshui' ? `平仄依《平水韵》，韵部依《${book}》` : `依《${book}》所记`
  return (
    <div className="prosody-legend" role="note">
      {status === 'loading' && <p className="prosody-legend__status">正在载入《{book}》…</p>}
      {status === 'error' && <p className="prosody-legend__status">韵书载入失败，请稍后重试。</p>}
      <p className="prosody-legend__keys" aria-hidden="true">
        {tones && (
          <>
            <span className="prosody-legend__key"><span className="pz pz--ping" />平</span>
            <span className="prosody-legend__key"><span className="pz pz--ze" />仄</span>
            <span className="prosody-legend__key"><span className="pz pz--duo" />可平可仄</span>
            <span className="prosody-legend__key"><span className="pz pz--none" />韵书未收</span>
            <span className="prosody-legend__key">入声字依韵书作仄（今读或为平，悬停可见）</span>
          </>
        )}
        <span className="prosody-legend__key">
          <span className="rhyme-tag rhyme-tag--c1"><span className="rhyme-tag__char">字</span><span className="rhyme-tag__part">韵部</span></span>
          句末字所属韵部；本首句末同部者同色，只出现一次者为灰
        </span>
      </p>
      <p className="prosody-legend__fanli">
        凡例：{toneBook}；{tones ? '多音字标 ◐ 不硬判' : '一字多部者并列、不硬判'}；今音不同者以韵书为准。本页只标韵书所记，不判合律与否。
      </p>
    </div>
  )
}
