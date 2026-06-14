import ScriptureShelf from '../../reader/ScriptureShelf.jsx'
import texts from '../../../data/fa/texts.json'

// 法家书架——韩非子、商君书。取思想史与政治哲学视角研读法、术、势之学。
export default function FaHomePage() {
  return (
    <ScriptureShelf
      texts={texts}
      title="法家研读"
      subtitle="法、术、势之学：韩非子集大成，商君书言变法。以思想史视角研读，如实呈现，不作影射。"
      basePath="/fa"
      brand="观法"
    />
  )
}
