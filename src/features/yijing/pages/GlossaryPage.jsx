import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import glossaryData from '../../../data/yijing/glossary.json'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const GROUPS = [
  { title: '卦际关系', keys: ['bengua', 'biangua', 'hugua', 'cuogua', 'zonggua'] },
  { title: '占法概念', keys: ['dongyao', 'zhenhui', 'zhuke', 'tiyong', 'dayan'] },
  { title: '爻位分析', keys: ['dangwei', 'dezhong', 'zhongzheng', 'xiangying', 'chengcheng', 'sancai', 'guazhu'] },
  { title: '八宫纳甲', keys: ['bagong', 'shiyao', 'yingyao', 'najia', 'liuqin', 'feifushen'] },
  { title: '图书象数', keys: ['xiaoxigua', 'hetu', 'luoshu'] },
]

const glossaryMap = new Map(glossaryData.map(g => [g.key, g]))

export default function GlossaryPage() {
  usePageTitle('名词表')
  const [filterQ, setFilterQ] = useState('')
  const q = filterQ.trim().toLowerCase()

  useEffect(() => {
    markRead('glossary')
    // 从 hash 锚点定位
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const filtered = q
    ? glossaryData.filter(g =>
        g.name.includes(filterQ) ||
        g.aliases.some(a => a.includes(filterQ)) ||
        g.brief.includes(filterQ) ||
        g.key.includes(q)
      )
    : null

  return (
    <div className="glossary-page">
      <div className="page-header">
        <h1 className="page-title">名词表</h1>
        <p className="page-subtitle">易学常用术语汇编，含别名对照与简明释义。</p>
      </div>

      <div className="glossary-search">
        <input
          className="glossary-search__input"
          value={filterQ}
          onChange={e => setFilterQ(e.target.value)}
          placeholder="过滤术语…"
          aria-label="过滤名词表"
        />
        {filterQ && (
          <button className="btn-text glossary-search__clear" onClick={() => setFilterQ('')}>清除</button>
        )}
      </div>

      {filtered ? (
        <div className="glossary-group">
          <div className="glossary-entries">
            {filtered.length === 0
              ? <p className="text-faint">未找到匹配术语</p>
              : filtered.map(g => <GlossaryEntry key={g.key} entry={g} />)
            }
          </div>
        </div>
      ) : (
        GROUPS.map(group => (
          <div key={group.title} className="glossary-group">
            <h2 className="glossary-group__title">{group.title}</h2>
            <div className="glossary-entries">
              {group.keys.map(key => {
                const entry = glossaryMap.get(key)
                return entry ? <GlossaryEntry key={key} entry={entry} /> : null
              })}
            </div>
          </div>
        ))
      )}

      <p className="glossary-footer text-faint">
        共 {glossaryData.length} 条术语。如发现释义有误，欢迎在卦详情页笔记中记录。
      </p>
    </div>
  )
}

function GlossaryEntry({ entry }) {
  return (
    <div id={entry.key} className="glossary-entry">
      <div className="glossary-entry__header">
        <span className="glossary-entry__name">{entry.name}</span>
        {entry.aliases.length > 0 && (
          <span className="glossary-entry__aliases">（{entry.aliases.join('·')}）</span>
        )}
      </div>
      <p className="glossary-entry__brief">{entry.brief}</p>
      <p className="glossary-entry__detail">{entry.detail}</p>
    </div>
  )
}
