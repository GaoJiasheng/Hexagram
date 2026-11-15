import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/ru/texts.json'
import LineageEntry from '../LineageEntry.jsx'
import { homePlan } from '../../reader/ShelfHome.jsx'

// 儒典书架
export default function RuHomePage() {
  return (
    <ScriptureShelf
      corpus="ru"
      texts={texts}
      title="儒典研读"
      subtitle={homePlan('ru')
        ? '论语、孟子、大学、中庸、孝经——原文、白话译注、每章延伸俱全。主流参照朱熹《四书章句集注》。'
        : <>论语、孟子、大学、中庸、孝经——原文、白话译注、每章延伸俱全。主流参照朱熹《四书章句集注》。<LineageEntry /></>}
      basePath="/ru"
      brand="观仁"
    />
  )
}
