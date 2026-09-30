import SingleBookHome from '../../reader/SingleBookHome.jsx'
import texts from '../../../data/songci/texts.json'

// 宋词首页。底本《宋词三百首》朱孝臧(彊村)一九二四年编,一首一章。
// 主书目录直接在首页展开,《宋词补遗》(2 首)列在末尾「另收」。
export default function SongciHomePage() {
  return (
    <SingleBookHome
      corpus="songci"
      slug="songci300"
      texts={texts}
      title="宋词研读"
      subtitle="宋词三百首——原文、白话译注与每首延伸。按作者时代顺次编排,一首一篇。"
      basePath="/songci"
      brand="观宋"
    />
  )
}
