import { useSettings } from '../SettingsContext.jsx'
import AnnotatedText from './AnnotatedText.jsx'

// 诗体经(verse)无注释段:按句读换行(与 AnnotatedText 的 verse 逻辑一致,但不走词典/锚定)
function plainVerse(text) {
  const out = []
  for (const [j, pc] of String(text).split(/(?<=[，。；！？])/).filter(Boolean).entries()) {
    out.push(<span key={j}>{pc}</span>)
    if (/[，。；！？]$/.test(pc)) out.push(<br key={`${j}-br`} />)
  }
  while (out.length && out[out.length - 1]?.type === 'br') out.pop()
  return out
}

// 经文区块: original(大字) + translation(灰、小、受开关控制)
// emphasis: 左侧3px朱砂竖线 + 淡底
// annotate: 原文挂词典模式字词注释(仅卦辞使用,v4 §1.3)
// anchors: 逐段锚定注疏(传文使用,v5 §3);与 annotate 互斥,anchors 优先
// verse: 诗体经按句读换行(黄庭等,#143)
// afterOriginal: 挂在原文之下、译文之上的附加件(诗词曲格律层 ProsodyRow,design-v24 §7.3);
//   有它时原文与附加件包一层 .classic-text__orig-col,左右对照的网格仍是两列。无则 DOM 与旧版全同。
export default function ClassicText({ original, translation, emphasis = false, annotate = false, anchors = null, verse = false, className = '', afterOriginal = null }) {
  const { settings } = useSettings()
  const side = settings.showTranslation && settings.transLayout === 'side' && !!translation
  const orig = (
    <p className={`classic-text__original ${verse ? 'classic-text__original--verse' : ''}`}>
      {anchors?.length ? <AnnotatedText text={original} anchors={anchors} verse={verse} />
        : annotate ? <AnnotatedText text={original} verse={verse} />
          : verse ? plainVerse(original) : original}
    </p>
  )
  return (
    <div className={`classic-text ${emphasis ? 'classic-text--emphasis' : ''} ${side ? 'classic-text--side' : ''} ${className}`}>
      {afterOriginal ? <div className="classic-text__orig-col">{orig}{afterOriginal}</div> : orig}
      {settings.showTranslation && translation && (
        <p className="classic-text__translation">{translation}</p>
      )}
    </div>
  )
}
