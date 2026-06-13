import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/fo/texts.json'

// 释典书架(v15 脚手架;内容期接 ClassicReader)。立意取「佛教与中国思想」,研习不宣化。
export default function FoHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="释典研读"
      subtitle="收窄三经:心经、金刚经、坛经——原文、白话译注、每章延伸,逐部展开。"
      basePath="/fo"
      brand="观空"
    />
  )
}
