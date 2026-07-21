import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/moulue/texts.json'

// 谋略杂纂书架——两类文献并陈,书架卡片按各自 dubious/caveat 字段分别框注(见 ScriptureShelf):
// ① 托名伪书 5 部(罗织经/小人经/权谋术/韬晦术/止学,《天下无谋·秘卷八书》之五种,学界多判为现代伪托);
// ② 真实权谋/处世古籍(长短经〔反经〕/菜根谭/围炉夜话/小窗幽记,四库著录或作者信实可考的真书)。
export default function MoulueHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="谋略杂纂"
      subtitle="权谋与处世的文献杂纂：真实古籍与托名伪书并陈，逐书标明真伪、各归其类。"
      disclaimer="书架含两类：《天下无谋·秘卷八书》五种学界多判为后世托名或现代伪作，取文献批判视角，不为伪书张目；另收长短经、菜根谭等真实权谋处世古籍，取思想史与处世智慧的研习视角。两类均不作现代权术施用教程，个书真伪见各自题解。"
      basePath="/moulue"
      brand="观谋"
    />
  )
}
