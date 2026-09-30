import SingleBookHome from '../../reader/SingleBookHome.jsx'
import texts from '../../../data/tangshi/texts.json'

// 唐诗首页。底本《唐诗三百首》蘅塘退士(孙洙)乾隆二十八年编,选目为古人所定、非本站编纂。
// 这一组只有这一本书、不会再扩(owner 2026-10-01),首页不摆书架,直接展开它的目录(七类、逐首)。
export default function TangshiHomePage() {
  return (
    <SingleBookHome
      corpus="tangshi"
      slug="tangshi300"
      texts={texts}
      title="唐诗研读"
      subtitle="唐诗三百首——原文、白话译注与每首延伸。按五古七古乐府律绝七类编次。"
      basePath="/tangshi"
      brand="观唐"
    />
  )
}
