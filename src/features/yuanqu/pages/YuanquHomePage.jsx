import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/yuanqu/texts.json'

// 元曲书架。与唐诗宋词不同,元曲**没有现成的传统选本可依**(维基文库无《元曲三百首》
// 《全元散曲》等),选目属本站编纂行为,故在 texts.json 置 caveat、书架卡片显著标明。
export default function YuanquHomePage() {
  return (
    <ScriptureShelf
      corpus="yuanqu"
      texts={texts}
      title="元曲研读"
      subtitle="元散曲名篇——原文、白话译注与每首延伸。只收散曲(小令与套数),不收杂剧剧本。"
      disclaimer="元曲无现成传世选本可依：《元曲三百首》《全元散曲》等在公有领域文库均无收录。本编选目系本站从确有原文者中择历代传诵之作逐首收录，属本站编纂行为、非古人所定；凡查无原文者一律不收，绝不凭记忆补写曲文。"
      basePath="/yuanqu"
      brand="观元"
    />
  )
}
