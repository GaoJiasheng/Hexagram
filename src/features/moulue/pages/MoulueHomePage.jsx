import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/moulue/texts.json'

// 谋略杂纂书架——《天下无谋·秘卷八书》维基有原文的 5 部(罗织经/小人经/权谋术/韬晦术/止学)。
// ⚠ 这 5 部学界基本判为现代伪托,书架卡片与题解显著标「托名·疑现代伪作」,取文献批判视角。
export default function MoulueHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="谋略杂纂"
      subtitle="《天下无谋·秘卷八书》之五种。作伪书现象与世态心理的文献材料研读。"
      disclaimer="此五部学界多判为后世托名或现代伪作，取文献批判视角，不为伪书张目、不作处世权术教程。"
      basePath="/moulue"
      brand="观谋"
    />
  )
}
