import { useSettings } from '../yijing/SettingsContext.jsx'

// 白话/观书文章的正文字体切换(字体一 / 字体二)。
// 字体一 = 宋(Noto Serif SC,与站内其余部分一致,自托管、OFL-1.1);
// 字体二 = 黑(系统无衬线栈,不打包字体文件)。默认字体一,免得白话与站内其他页面观感割裂。
// 按钮用「宋 / 黑」而不是「1 / 2」——同样两档,但一眼看得出切的是什么。
const FONTS = [['serif', '宋'], ['sans', '黑']]

export default function FontFamilyControl({ className = '' }) {
  const { settings, setSettings } = useSettings()
  return (
    <div className={`seg-control seg-control--sm ${className}`} role="group" aria-label="正文字体">
      {FONTS.map(([v, l]) => (
        <button
          key={v}
          className={`seg-btn ${settings.readFont === v ? 'seg-btn--active' : ''}`}
          onClick={() => setSettings({ readFont: v })}
          aria-pressed={settings.readFont === v}
          title={v === 'serif' ? '字体一 · 宋体(与站内其余部分一致)' : '字体二 · 黑体(系统无衬线)'}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
