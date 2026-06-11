import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import HexagramFigure from '../components/HexagramFigure.jsx'
import TrigramBadge from '../components/TrigramBadge.jsx'
import RuleCard from '../components/RuleCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { allHexagrams, trigramById, TRIGRAM_ORDER, hexagramById, hexagramByBinary } from '../data.js'
import { getBianGua, getHuGua, getCuoGua, getZongGua, lineTitle } from '../engine/transforms.js'
import { getDivinationResult } from '../engine/divination.js'
import { analyzePosition, describePosition, analyzeAllPositions } from '../engine/positions.js'
import { saveDivination } from '../storage.js'

const METHODS = ['trigram', 'line', 'search']

export default function WorkbenchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // 从URL还原状态
  const initGua = Number(params.get('gua')) || null
  const initDong = params.get('dong') ? params.get('dong').split(',').map(Number).filter(n => n >= 1 && n <= 6) : []

  const [hex, setHex] = useState(() => initGua ? hexagramById.get(initGua) : null)
  const [movingLines, setMovingLines] = useState(initDong)
  const [method, setMethod] = useState('trigram')
  const [upperTrigram, setUpperTrigram] = useState(hex?.upperTrigram || '')
  const [lowerTrigram, setLowerTrigram] = useState(hex?.lowerTrigram || '')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [noteText, setNoteText] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  // URL 同步
  useEffect(() => {
    const p = {}
    if (hex) p.gua = hex.id
    if (movingLines.length) p.dong = movingLines.join(',')
    setParams(p, { replace: true })
  }, [hex, movingLines])

  // 从上下卦更新 — only clear movingLines when hex actually changes
  useEffect(() => {
    if (upperTrigram && lowerTrigram) {
      const binary = trigramById[lowerTrigram].binary + trigramById[upperTrigram].binary
      const found = hexagramByBinary.get(binary)
      if (found) {
        setHex(prev => {
          if (prev?.id !== found.id) setMovingLines([])
          return found
        })
      }
    }
  }, [upperTrigram, lowerTrigram])

  // 键盘快捷键 1-6 切换动爻
  useEffect(() => {
    function onKey(e) {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 6 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        toggleMoving(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [movingLines, hex])

  function toggleMoving(pos) {
    setMovingLines(prev => prev.includes(pos) ? prev.filter(x => x !== pos) : [...prev, pos])
  }

  function handleFigureClick(pos) {
    toggleMoving(pos)
  }

  function handleSearch(q) {
    setSearchQ(q)
    if (!q) { setSearchResults([]); return }
    const lower = q.toLowerCase()
    const r = allHexagrams.filter(h =>
      h.name.includes(q) || h.fullName.includes(q) || h.pinyin?.toLowerCase().includes(lower) || String(h.id) === q
    ).slice(0, 8)
    setSearchResults(r)
  }

  function selectHex(h) {
    setHex(h)
    setMovingLines([])
    setUpperTrigram(h.upperTrigram)
    setLowerTrigram(h.lowerTrigram)
    setSearchQ('')
    setSearchResults([])
  }

  function randomHex() {
    const r = allHexagrams[Math.floor(Math.random() * 64)]
    selectHex(r)
  }

  function saveHistory() {
    if (!hex) return
    const bianBinary = movingLines.length ? getBianGua(hex.binary, movingLines) : hex.binary
    const bianHex = hexagramByBinary.get(bianBinary)
    saveDivination({ gua: hex.id, dong: movingLines, bianGua: bianHex?.id, note: noteText })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  // 推演结果
  const bianBinary = hex && movingLines.length ? getBianGua(hex.binary, movingLines) : hex?.binary
  const bianHex = hex && movingLines.length ? hexagramByBinary.get(bianBinary) : null
  const huHex = hex ? hexagramByBinary.get(getHuGua(hex.binary)) : null
  const cuoHex = hex ? hexagramByBinary.get(getCuoGua(hex.binary)) : null
  const zongHex = hex ? hexagramByBinary.get(getZongGua(hex.binary)) : null
  const divinationResult = hex ? getDivinationResult(hex, movingLines, hexagramByBinary) : null
  const positions = hex ? analyzeAllPositions(hex.binary) : []

  return (
    <div className="workbench-page">
      {/* 左栏 */}
      <aside className="workbench-left">
        <div className="workbench-left__inner">
          <div className="workbench-section-title">起卦</div>
          <div className="seg-control workbench-methods">
            {[['trigram', '上下卦'], ['line', '逐爻'], ['search', '检索']].map(([k, v]) => (
              <button key={k} className={`seg-btn ${method === k ? 'seg-btn--active' : ''}`} onClick={() => setMethod(k)}>{v}</button>
            ))}
          </div>

          {method === 'trigram' && (
            <div className="trigram-picker">
              <div className="trigram-picker__row">
                <span className="trigram-picker__label">上卦</span>
                <div className="trigram-picker__options">
                  {TRIGRAM_ORDER.map(id => (
                    <button
                      key={id}
                      className={`trigram-btn ${upperTrigram === id ? 'trigram-btn--active' : ''}`}
                      onClick={() => setUpperTrigram(id)}
                      title={trigramById[id].name}
                    >
                      {trigramById[id].symbol}
                    </button>
                  ))}
                </div>
              </div>
              <div className="trigram-picker__row">
                <span className="trigram-picker__label">下卦</span>
                <div className="trigram-picker__options">
                  {TRIGRAM_ORDER.map(id => (
                    <button
                      key={id}
                      className={`trigram-btn ${lowerTrigram === id ? 'trigram-btn--active' : ''}`}
                      onClick={() => setLowerTrigram(id)}
                      title={trigramById[id].name}
                    >
                      {trigramById[id].symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {method === 'line' && hex && (
            <div className="line-picker">
              {[6, 5, 4, 3, 2, 1].map(pos => {
                const isYang = hex.binary[pos - 1] === '1'
                const isDong = movingLines.includes(pos)
                const lt = lineTitle(pos, isYang)
                return (
                  <div key={pos} className="line-picker__row">
                    <span className="line-picker__title">{lt}</span>
                    <button
                      className={`line-yin-yang ${isYang ? 'line-yin-yang--yang' : 'line-yin-yang--yin'}`}
                      onClick={() => {
                        // 切换阴阳
                        const arr = hex.binary.split('')
                        arr[pos - 1] = isYang ? '0' : '1'
                        const newBinary = arr.join('')
                        const newHex = hexagramByBinary.get(newBinary)
                        if (newHex) { setHex(newHex); setMovingLines([]) }
                      }}
                    >
                      {isYang ? '阳' : '阴'}
                    </button>
                    <label className="line-picker__dong">
                      <input
                        type="checkbox"
                        checked={isDong}
                        onChange={() => toggleMoving(pos)}
                      /> 动
                    </label>
                  </div>
                )
              })}
            </div>
          )}

          {method === 'search' && (
            <div className="workbench-search">
              <input
                className="workbench-search__input"
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                placeholder="卦名 / 拼音 / 卦序…"
              />
              {searchResults.length > 0 && (
                <ul className="workbench-search__results">
                  {searchResults.map(h => (
                    <li key={h.id}>
                      <button className="workbench-search__item" onClick={() => selectHex(h)}>
                        {h.fullName} 第{h.id}卦
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 本卦展示 */}
          {hex && (
            <div className="workbench-gua">
              <HexagramFigure
                binary={hex.binary}
                size="lg"
                movingLines={movingLines}
                interactive="toggle-moving"
                onLineClick={handleFigureClick}
                label={`${hex.fullName}，单击爻标记动爻，键盘1-6切换`}
              />
              <div className="workbench-gua__info">
                <Link to={`/hexagram/${hex.id}`} className="workbench-gua__name">{hex.fullName}</Link>
                <p className="workbench-gua__dong">
                  {movingLines.length ? `动爻：${movingLines.sort((a,b)=>a-b).map(p => lineTitle(p, hex.binary[p-1]==='1')).join('、')}` : '无动爻'}
                </p>
              </div>
              <div className="workbench-gua__btns">
                {movingLines.length > 0 && (
                  <button className="btn-text" onClick={() => setMovingLines([])}>清空动爻</button>
                )}
                <button className="btn-text" onClick={randomHex}>随机一卦</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 右栏 */}
      <main className="workbench-right">
        {!hex ? (
          <EmptyState icon="☲" text="先在左侧选定本卦" />
        ) : (
          <div className="workbench-results">
            {/* 卡1: 卦变图 */}
            <div className="result-card">
              <div className="result-card__title">卦变</div>
              <div className="bianhua-row">
                <div className="bianhua-item">
                  <HexagramFigure binary={hex.binary} size="md" movingLines={movingLines} label={hex.fullName} />
                  <Link to={`/hexagram/${hex.id}`} className="bianhua-item__name">{hex.name}·本卦</Link>
                </div>
                {bianHex && movingLines.length > 0 && (
                  <>
                    <div className="bianhua-arrow">
                      <div className="bianhua-arrow__line" />
                      <div className="bianhua-arrow__label">
                        {movingLines.sort((a,b)=>a-b).map(p=>lineTitle(p,hex.binary[p-1]==='1')).join('·')}动
                      </div>
                    </div>
                    <div className="bianhua-item">
                      <HexagramFigure binary={bianHex.binary} size="md" label={bianHex.fullName} />
                      <Link to={`/hexagram/${bianHex.id}`} className="bianhua-item__name">{bianHex.name}·变卦</Link>
                    </div>
                  </>
                )}
                {!bianHex && movingLines.length === 0 && (
                  <p className="bianhua-hint">标记动爻以观其变</p>
                )}
              </div>
              {/* 互错综 */}
              <div className="deriv-row">
                {[
                  { label: '互卦', hex: huHex, desc: '取中四爻' },
                  { label: '错卦', hex: cuoHex, desc: '阴阳旁通' },
                  { label: '综卦', hex: zongHex, desc: '覆转倒序' },
                ].map(({ label, hex: dh }) => dh && (
                  <Link key={label} to={`/hexagram/${dh.id}`} className="deriv-chip">
                    <HexagramFigure binary={dh.binary} size="sm" label={dh.fullName} />
                    <span>{label}·{dh.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* 卡2: 断辞依据 */}
            <RuleCard result={divinationResult} />

            {/* 卡3: 爻位分析 */}
            <div className="result-card">
              <div className="result-card__title">卦象与爻位分析</div>
              {hex.imagery && (
                <p className="analysis-imagery">{hex.imagery}</p>
              )}
              {movingLines.length > 0 ? (
                <div className="analysis-positions">
                  {movingLines.sort((a,b)=>a-b).map(pos => {
                    const a = analyzePosition(pos, hex.binary)
                    const { chips, desc } = describePosition(a)
                    return (
                      <div key={pos} className="analysis-line">
                        <span className="analysis-line__title">{a.title}</span>
                        <span className="analysis-line__chips">
                          {chips.map((c, i) => <span key={i} className={`line-chip ${c === '中正' ? 'line-chip--zhongzheng' : ''}`}>{c}</span>)}
                        </span>
                        <p className="analysis-line__desc">{desc}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="analysis-overview">
                  {positions.map(a => {
                    const { chips } = describePosition(a)
                    return (
                      <div key={a.pos} className="analysis-overview-row">
                        <span className="analysis-overview-row__title">{a.title}</span>
                        {chips.map((c, i) => <span key={i} className={`line-chip ${c === '中正' ? 'line-chip--zhongzheng' : ''}`}>{c}</span>)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 卡4: 存为记录 */}
            <div className="result-card">
              <div className="result-card__title">存为记录</div>
              <div className="save-row">
                <input
                  className="save-input"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="所研之事（可选）"
                />
                <button className="btn btn--secondary" onClick={saveHistory}>
                  {savedMsg ? '已保存 ✓' : '存入推演历史'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
