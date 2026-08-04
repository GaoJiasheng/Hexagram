import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/tangshi/texts.json'

// 唐诗书架。底本《唐诗三百首》蘅塘退士(孙洙)乾隆二十八年编,选目为古人所定、非本站编纂。
export default function TangshiHomePage() {
  return (
    <ScriptureShelf
      corpus="tangshi"
      texts={texts}
      title="唐诗研读"
      subtitle="唐诗三百首——原文、白话译注与每首延伸。按五古七古乐府律绝七类编次。"
      basePath="/tangshi"
      brand="观唐"
    />
  )
}
