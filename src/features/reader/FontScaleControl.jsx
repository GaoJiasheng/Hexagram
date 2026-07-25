import { useSettings } from '../yijing/SettingsContext.jsx'
import { FONT_SCALE_STEPS } from '../yijing/storage.js'

// 复用的字号档位控件(小/中/大/特大),读写全局 settings.fontScale。
// 与读经工具条同款,供白话/观书文章的抽屉头与整页顶栏复用,让观书也能就地调字号。
export default function FontScaleControl({ className = '' }) {
  const { settings, setSettings } = useSettings()
  return (
    <div className={`seg-control seg-control--sm ${className}`} role="group" aria-label="正文字号">
      {FONT_SCALE_STEPS.map(([v, l]) => (
        <button
          key={v}
          className={`seg-btn ${settings.fontScale === v ? 'seg-btn--active' : ''}`}
          onClick={() => setSettings({ fontScale: v })}
          aria-pressed={settings.fontScale === v}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
