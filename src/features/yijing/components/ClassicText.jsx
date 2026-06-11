import { useSettings } from '../SettingsContext.jsx'

// 经文区块: original(大字) + translation(灰、小、受开关控制)
// emphasis: 左侧3px朱砂竖线 + 淡底
export default function ClassicText({ original, translation, emphasis = false, className = '' }) {
  const { settings } = useSettings()
  return (
    <div className={`classic-text ${emphasis ? 'classic-text--emphasis' : ''} ${className}`}>
      <p className="classic-text__original">{original}</p>
      {settings.showTranslation && translation && (
        <p className="classic-text__translation">{translation}</p>
      )}
    </div>
  )
}
