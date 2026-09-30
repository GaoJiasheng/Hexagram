import SingleBookHome from '../../reader/SingleBookHome.jsx'
import texts from '../../../data/guwen/texts.json'
import meta from '../../../data/guwen/guwenguanzhi-meta.json'

// 古文首页。底本《古文观止》吴楚材、吴调侯 康熙三十四年(1695)编,十二卷二百二十二篇,选目为古人所定、非本站编纂。
// 一组一本书(与唐诗三百首同形态):首页不摆书架,直接按十二卷展开全部篇目,篇题旁标出处/作者(左传 · 韩愈 · 苏轼…)。
export default function GuwenHomePage() {
  return (
    <SingleBookHome
      corpus="guwen"
      slug="guwenguanzhi"
      texts={texts}
      title="古文研读"
      subtitle="古文观止——原文、白话译注与每篇延伸。上起《左传》，下迄明末，十二卷二百二十二篇。"
      basePath="/guwen"
      brand="观文"
      volumes={meta.volumes}
    />
  )
}
