import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/zhongyi/texts.json'

// 中医书架——黄帝内经(素问/灵枢)、伤寒论、神农本草经。取医学史与文献研习视角。
// 铁律(v19 §0):研习不诊疗——经文照译,注疏/延伸不作诊疗、不述方药功效用法、不下疗效断语。
export default function ZhongyiHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="中医典籍"
      subtitle="黄帝内经、伤寒论、神农本草经——医经与经方之祖，以医学史与文献视角研读。⚠ 古籍研习，非医疗建议；脉法方药不作诊疗依据，不适请就医。"
      basePath="/zhongyi"
      brand="观和"
    />
  )
}
