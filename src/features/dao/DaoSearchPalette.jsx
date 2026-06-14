import CorpusSearchPalette from '../reader/CorpusSearchPalette.jsx'
import { searchDao, ensureDaoIndexed } from './daoSearch.js'
import { DAO_TEXTS } from './data.js'

// 道藏全站检索(批D):复用通用 CorpusSearchPalette 的 UI/交互,注入 dao 自己的检索/索引函数。
const DAO_BOOKS = DAO_TEXTS.filter((t) => t.status !== 'pending').slice(0, 6).map((t) => t.title)

export default function DaoSearchPalette(props) {
  return <CorpusSearchPalette corpus="dao" searchFn={searchDao} indexFn={ensureDaoIndexed} books={DAO_BOOKS} {...props} />
}
