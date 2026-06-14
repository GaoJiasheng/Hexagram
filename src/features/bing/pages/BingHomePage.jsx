import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/bing/texts.json'

// 兵家书架——孙子、吴子、司马法、尉缭子、三略(武经七书选)。以兵学思想史视角研读。
export default function BingHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="兵家研读"
      subtitle="武经七书选:孙子、吴子、司马法、尉缭子、三略。论形势虚实奇正,以思想史视角研读。"
      basePath="/bing"
      brand="观兵"
    />
  )
}
