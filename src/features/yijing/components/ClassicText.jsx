import { useSettings } from '../SettingsContext.jsx'
import AnnotatedText from './AnnotatedText.jsx'

// 经文区块: original(大字) + translation(灰、小、受开关控制)
// emphasis: 左侧3px朱砂竖线 + 淡底
// annotate: 原文挂字词注释(仅卦辞使用,v4 §1.3)
export default function ClassicText({ original, translation, emphasis = false, annotate = false, className = '' }) {
  const { settings } = useSettings()
  return (
    <div className={`classic-text ${emphasis ? 'classic-text--emphasis' : ''} ${className}`}>
      <p className="classic-text__original">
        {annotate ? <AnnotatedText text={original} /> : original}
      </p>
      {settings.showTranslation && translation && (
        <p className="classic-text__translation">{translation}</p>
      )}
    </div>
  )
}
