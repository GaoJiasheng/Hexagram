import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/bing/texts.json'

// 兵家书架——武经七书七部俱全(孙子、吴子、司马法、尉缭子、三略、六韬、李卫公问对)。以兵学思想史视角研读。
export default function BingHomePage() {
  return (
    <ScriptureShelf
      corpus="bing"
      texts={texts}
      title="兵家研读"
      subtitle="武经七书七部：孙子、吴子、司马法、尉缭子、三略、六韬、李卫公问对。以兵学思想史视角研读。"
      basePath="/bing"
      brand="观兵"
    />
  )
}
