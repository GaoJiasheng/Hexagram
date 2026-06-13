import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/ru/texts.json'

// 儒典书架(v15 脚手架;内容期接 ClassicReader)
export default function RuHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="儒典研读"
      subtitle="四书入门:论语、孟子、大学、中庸——原文、白话译注、每章延伸,逐部展开。"
      basePath="/ru"
      brand="观仁"
    />
  )
}
