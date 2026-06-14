import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/xin/texts.json'

// 心学(阳明)书架——从儒学拆出的独立组,研习其义理与思想史(知行合一、致良知)。
export default function XinHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="阳明心学"
      subtitle="《传习录》：心即理、知行合一、致良知——王阳明讲学语录与论学书信。"
      basePath="/xin"
      brand="观心"
    />
  )
}
