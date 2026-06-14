import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/zong/texts.json'

// 纵横家书架——鬼谷子、战国策选。研读捭阖游说之术,取思想史视角,不作权术教程。
export default function ZongHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="纵横研读"
      subtitle="捭阖游说之术：鬼谷子言其法，战国策见其用。以思想史视角研读，不作权术教程。"
      basePath="/zong"
      brand="观衡"
    />
  )
}
