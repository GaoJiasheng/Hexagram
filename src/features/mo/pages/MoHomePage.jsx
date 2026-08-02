import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/mo/texts.json'

// 墨家书架——墨子。研读兼爱、非攻、尚贤诸说与《墨经》名辩、科技。
export default function MoHomePage() {
  return (
    <ScriptureShelf
      corpus="mo"
      texts={texts}
      title="墨家研读"
      subtitle="兼爱、非攻、尚贤、天志：先秦与儒并称的显学，兼重名辩逻辑与科学技术。"
      basePath="/mo"
      brand="观兼"
    />
  )
}
