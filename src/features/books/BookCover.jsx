// 生成式书封:纯原创设计,不使用任何出版社封面素材——只用「观象」语汇:
// 本书 accent 主色作底、朱印、衬线竖排书名 + 与全书意象呼应的母题。
// 颜色写死(封面是一件「作品」,明暗模式下不反色,像一张图);母题按 motif 切换。
const CREAM = '#f2ecda'
const CINNABAR = '#b1472f'
const SERIF = { fontFamily: 'var(--font-serif)' }

// 母题:两座山与山谷——第一座(左·矮)、山谷(中)、第二座(右·高),朱日升在第二座之后。
function TwoMountains() {
  return (
    <g>
      <path d="M0,420 L0,360 L54,314 L120,348 L176,302 L242,342 L300,308 L300,420 Z" fill="rgba(255,255,255,0.10)" />
      <circle cx="186" cy="190" r="33" fill={CINNABAR} opacity="0.9" />
      <path d="M0,420 L0,342 L74,254 L134,300 L188,210 L300,336 L300,420 Z" fill="rgba(0,0,0,0.32)" />
      <path d="M0,420 L0,394 L150,374 L300,398 L300,420 Z" fill="rgba(0,0,0,0.14)" />
    </g>
  )
}

// 母题:振动波纹——从一点向外扩散的同心圆(呼应「万物皆振动·同类相吸」)。
function Ripples() {
  return (
    <g fill="none" stroke={CREAM}>
      {[34, 74, 116, 162, 212].map((r, i) => (
        <circle key={r} cx="150" cy="300" r={r} strokeWidth={i === 0 ? 1.7 : 1.2} strokeOpacity={0.44 - i * 0.075} />
      ))}
      <circle cx="150" cy="300" r="8" fill={CINNABAR} stroke="none" />
    </g>
  )
}

// 母题:螺旋——一圈套一圈、层层向内(呼应连载系列与「秘密之内还有秘密」)。
function Spiral() {
  const cx = 136, cy = 296, turns = 3.2, steps = 200, maxR = 162
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const ang = t * turns * 2 * Math.PI
    d += (i === 0 ? 'M' : 'L') + (cx + t * maxR * Math.cos(ang)).toFixed(1) + ',' + (cy + t * maxR * Math.sin(ang)).toFixed(1) + ' '
  }
  return (
    <g>
      <path d={d} fill="none" stroke={CREAM} strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:曼陀罗——方与圆、十二辐、向中心收束(呼应荣格的自性/整合象征)。
function Mandala() {
  const cx = 150, cy = 292, R = 128, N = 12
  const spokes = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    spokes.push('M' + (cx + Math.cos(a) * 26).toFixed(1) + ',' + (cy + Math.sin(a) * 26).toFixed(1) + ' L' + (cx + Math.cos(a) * R).toFixed(1) + ',' + (cy + Math.sin(a) * R).toFixed(1))
  }
  const d = R * 0.62
  const diamond = `M${cx},${cy - d} L${cx + d},${cy} L${cx},${cy + d} L${cx - d},${cy} Z`
  return (
    <g fill="none" stroke={CREAM} strokeWidth="1.1">
      <circle cx={cx} cy={cy} r={R} strokeOpacity="0.42" />
      <circle cx={cx} cy={cy} r={R * 0.72} strokeOpacity="0.42" />
      <circle cx={cx} cy={cy} r={R * 0.44} strokeOpacity="0.42" />
      <path d={diamond} strokeOpacity="0.4" />
      <path d={spokes.join(' ')} strokeOpacity="0.26" />
      <circle cx={cx} cy={cy} r="8" fill={CINNABAR} stroke="none" />
    </g>
  )
}

// 母题:群像点阵——整齐排列、面目模糊的小人形轮廓,只一个突兀地亮起(呼应「个体消融进群体」)。
function CrowdGrid() {
  const cols = 7, rows = 9, x0 = 34, y0 = 108, gx = 33, gy = 33
  const heads = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * gx, y = y0 + r * gy
      heads.push({ x, y, hi: r === 5 && c === 3 })
    }
  }
  return (
    <g>
      {heads.map((h, i) => (
        <g key={i} transform={`translate(${h.x},${h.y})`}>
          <circle r="7.5" fill={h.hi ? CINNABAR : CREAM} fillOpacity={h.hi ? 1 : 0.3} />
          <path d="M-9,15 Q0,2 9,15 L9,19 L-9,19 Z" fill={h.hi ? CINNABAR : CREAM} fillOpacity={h.hi ? 1 : 0.3} />
        </g>
      ))}
    </g>
  )
}

// 母题:轮辐图——中心一个「领袖」结点,外圈成员结点各一条辐线连向中心(呼应本书核心论点:
// 群体成员靠「都把领袖当自我理想」这条共同纽带互相绑定,不是靠彼此直接联系)。
function HubSpokes() {
  const cx = 150, cy = 300, R = 118, N = 10
  const spokes = [], nodes = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
    spokes.push(`M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}`)
    nodes.push([x, y])
  }
  return (
    <g>
      <path d={spokes.join(' ')} fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" />
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={CREAM} fillOpacity="0.5" />)}
      <circle cx={cx} cy={cy} r="15" fill={CINNABAR} />
    </g>
  )
}

// 母题:裂环——一圈相互靠拢的结点(文明·厄洛斯的束缚力),边界几处被朱线崩裂向外
// (攻击本能/死本能挣破文明的克制),呼应「文明靠压抑换秩序,压不住处就崩裂」。
function FractureRing() {
  const cx = 150, cy = 300, R = 82, N = 9
  const ring = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    ring.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  const fractureAngles = [0.35, 2.15, 4.05]
  const fractures = fractureAngles.map((a) => {
    const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R
    const x2 = cx + Math.cos(a) * (R + 58), y2 = cy + Math.sin(a) * (R + 58)
    return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`
  })
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.2" />
      {ring.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6.5" fill={CREAM} fillOpacity="0.5" />)}
      <path d={fractures.join(' ')} fill="none" stroke={CINNABAR} strokeWidth="1.7" strokeOpacity="0.88" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="10" fill={CINNABAR} />
    </g>
  )
}

// 母题:梦之门——一道拱门轮廓,门内几点微光(呼应弗洛伊德名言「梦是通向无意识的康庄大道」)。
function DreamGate() {
  const cx = 150, cy = 320, doorW = 100, doorH = 190, archR = 50
  const left = cx - doorW / 2, right = cx + doorW / 2, top = cy - doorH / 2
  const doorPath = `M${left},${cy + doorH / 2} L${left},${top + archR} A${archR},${archR} 0 0 1 ${right},${top + archR} L${right},${cy + doorH / 2}`
  const stars = [[-20, -60, 1.6], [16, -92, 2.1], [-4, -32, 1.4], [26, -46, 1.8]]
  return (
    <g>
      <path d={doorPath} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.4" />
      {stars.map(([dx, dy, r], i) => <circle key={i} cx={cx + dx} cy={cy + dy} r={r} fill={CREAM} fillOpacity="0.6" />)}
      <circle cx={cx} cy={cy + 26} r="11" fill={CINNABAR} />
    </g>
  )
}

// 母题:三层结构——本我最宽在底(原始驱力)、自我居中(现实调停者)、超我最窄在顶
// (朱色监视之眼,呼应「良心/自我理想」),呼应本我-自我-超我三层人格结构。
function PsycheStrata() {
  const cx = 150
  const bands = [
    { y: 340, h: 68, w: 208 },
    { y: 262, h: 54, w: 152 },
    { y: 198, h: 40, w: 92 },
  ]
  return (
    <g>
      {bands.map((b, i) => (
        <rect key={i} x={cx - b.w / 2} y={b.y} width={b.w} height={b.h} rx="12"
          fill="none" stroke={CREAM} strokeOpacity={i === 2 ? 0.6 : 0.32} strokeWidth={i === 2 ? 1.5 : 1.1} />
      ))}
      <circle cx={cx} cy={198 + 20} r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:攀升点阵——一串从低到高的结点,末端朱色放大(呼应「自卑起点→追求超越的终点」)。
function RisingSteps() {
  const n = 7, x0 = 52, y0 = 362, dx = 30, ddy = 26
  const pts = []
  for (let i = 0; i < n; i++) pts.push([x0 + i * dx, y0 - i * ddy])
  const path = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x + ',' + y).join(' ')
  return (
    <g>
      <path d={path} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.3" strokeLinecap="round" />
      {pts.slice(0, -1).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill={CREAM} fillOpacity="0.5" />)}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="11" fill={CINNABAR} />
    </g>
  )
}

// 母题:礁石与浪——一块稳固的岩石轮廓,几道波浪冲来又被弹开(呼应斯多葛「像礁石一样任浪拍打,自己巍然不动」)。
function RockAndWaves() {
  const cx = 150
  const rock = `M${cx - 55},360 L${cx - 60},300 L${cx - 30},270 L${cx + 20},265 L${cx + 58},295 L${cx + 52},360 Z`
  const waves = [220, 240, 260].map((y) => `M40,${y} Q90,${y - 12} 130,${y} T${cx - 40},${y + 4}`)
  return (
    <g>
      <path d={rock} fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.3" />
      {waves.map((d, i) => <path key={i} d={d} fill="none" stroke={CREAM} strokeOpacity={0.3 - i * 0.06} strokeWidth="1.1" />)}
      <circle cx={cx - 15} cy={310} r="9" fill={CINNABAR} />
    </g>
  )
}

// 母题:洞穴与光——洞穴拱形轮廓,几个背对洞口的囚徒剪影,洞口透进一点朱光(呼应柏拉图洞穴喻)。
function CaveLight() {
  const archPath = 'M50,380 L50,260 Q50,200 110,200 L190,200 Q250,200 250,260 L250,380'
  const prisoners = [[90, 340], [120, 350], [150, 345]]
  return (
    <g>
      <path d={archPath} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      {prisoners.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill={CREAM} fillOpacity="0.45" />)}
      <circle cx={210} cy={230} r="13" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}

// 母题:深渊凝视——两侧崖壁裂开一道峡谷,中间一点朱色的「眼」(呼应尼采「凝视深渊,深渊也凝视你」)。
function AbyssGaze() {
  const cx = 150
  const leftCliff = 'M30,200 L90,260 L60,380 L20,380 L20,220 Z'
  const rightCliff = 'M270,200 L210,260 L240,380 L280,380 L280,220 Z'
  return (
    <g>
      <path d={leftCliff} fill="none" stroke={CREAM} strokeOpacity="0.35" strokeWidth="1.2" />
      <path d={rightCliff} fill="none" stroke={CREAM} strokeOpacity="0.35" strokeWidth="1.2" />
      <circle cx={cx} cy={290} r="10" fill={CINNABAR} />
    </g>
  )
}

// 母题:意志之幕——几层半透明垂帘的波浪线,中间隐约透出一点朱色核心(呼应叔本华「摩耶之幕」,表象遮住意志本体)。
function VeilOfMaya() {
  const cx = 150
  const veils = [0, 1, 2, 3].map((i) => {
    const y0 = 200 + i * 15
    return `M${60 - i * 8},${y0} Q${cx},${y0 + 25} ${240 + i * 8},${y0}`
  })
  return (
    <g>
      {veils.map((d, i) => <path key={i} d={d} fill="none" stroke={CREAM} strokeOpacity={0.4 - i * 0.07} strokeWidth="1.2" />)}
      <circle cx={cx} cy={320} r="11" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}

// 母题:微光之窗——一扇简单的窗框轮廓,窗外透出一点朱色微光(呼应弗兰克尔在集中营劳动时望向窗外、想象所爱之人的瞬间)。
function LightWindow() {
  const y0 = 200
  const frame = `M70,${y0} L230,${y0} L230,${y0 + 180} L70,${y0 + 180} Z M150,${y0} L150,${y0 + 180} M70,${y0 + 90} L230,${y0 + 90}`
  return (
    <g>
      <path d={frame} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <circle cx={185} cy={y0 + 45} r="11" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}

// 母题:齿轮方格——一圈齿轮外框套住同心圆,中心一点朱色(呼应阿伦特笔下原子化个体被卷入意识形态机器)。
function GearGrid() {
  const cx = 150, cy = 300, R = 70, teeth = 12
  let gearPath = ''
  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2, a2 = ((i + 0.5) / teeth) * Math.PI * 2
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R
    const x2 = cx + Math.cos(a2) * (R + 10), y2 = cy + Math.sin(a2) * (R + 10)
    gearPath += (i === 0 ? 'M' : 'L') + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + ' '
  }
  return (
    <g>
      <path d={gearPath + 'Z'} fill="none" stroke={CREAM} strokeOpacity="0.32" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={R * 0.5} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="10" fill={CINNABAR} />
    </g>
  )
}

// 母题:河流——几道横向水纹、一叶小舟漂在水面、一点朱色微光(呼应悉达多在河边听懂万物合一、成为船夫的顿悟)。
function RiverFlow() {
  const waves = [230, 262, 294, 326].map((y, i) => `M20,${y} Q95,${y - (13 - i * 2)} 160,${y} T280,${y + (i % 2 ? -5 : 5)}`)
  const boat = 'M172,272 Q193,261 216,272 L207,280 L181,280 Z'
  return (
    <g>
      {waves.map((d, i) => <path key={i} d={d} fill="none" stroke={CREAM} strokeOpacity={0.42 - i * 0.07} strokeWidth={i === 0 ? 1.5 : 1.1} />)}
      <path d={boat} fill={CREAM} fillOpacity="0.55" />
      <circle cx="218" cy="222" r="12" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}

// 母题:贫困陷阱曲线——S 形曲线三次穿过 45° 对角参考线(经济学「贫困陷阱」经典图示:
// 低位与高位是稳定均衡,中间朱点是决定命运的不稳定阈值),呼应全书对「穷人是否被困住」的核心追问。
function PovertyCurve() {
  const axis = 'M60,180 L60,380 L270,380'
  const diag = 'M65,375 L255,195'
  const sCurve = 'M78,368 C112,366 128,318 150,296 C186,258 216,232 250,206'
  return (
    <g>
      <path d={axis} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" strokeLinecap="round" />
      <path d={diag} fill="none" stroke={CREAM} strokeOpacity="0.26" strokeWidth="1" strokeDasharray="3 5" />
      <path d={sCurve} fill="none" stroke={CREAM} strokeOpacity="0.58" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="150" cy="296" r="9" fill={CINNABAR} />
    </g>
  )
}

function Motif({ motif }) {
  if (motif === 'two-mountains') return <TwoMountains />
  if (motif === 'ripples') return <Ripples />
  if (motif === 'spiral') return <Spiral />
  if (motif === 'mandala') return <Mandala />
  if (motif === 'crowd-grid') return <CrowdGrid />
  if (motif === 'hub-spokes') return <HubSpokes />
  if (motif === 'fracture-ring') return <FractureRing />
  if (motif === 'dream-gate') return <DreamGate />
  if (motif === 'psyche-strata') return <PsycheStrata />
  if (motif === 'rising-steps') return <RisingSteps />
  if (motif === 'rock-waves') return <RockAndWaves />
  if (motif === 'cave-light') return <CaveLight />
  if (motif === 'abyss-gaze') return <AbyssGaze />
  if (motif === 'veil-of-maya') return <VeilOfMaya />
  if (motif === 'light-window') return <LightWindow />
  if (motif === 'gear-grid') return <GearGrid />
  if (motif === 'river-flow') return <RiverFlow />
  if (motif === 'poverty-curve') return <PovertyCurve />
  return <path d="M0,420 L0,362 L300,322 L300,420 Z" fill="rgba(0,0,0,0.22)" />
}

export default function BookCover({ title = '', subtitle = '', author = '', accent = '#3f7d6e', motif, className }) {
  const chars = [...title].slice(0, 5)
  const step = 54
  const startY = 100 - (chars.length - 4) * (step / 2)
  return (
    <svg viewBox="0 0 300 420" className={className} role="img" aria-label={`${title} · 封面`} preserveAspectRatio="xMidYMid meet">
      <rect width="300" height="420" fill={accent} />
      <rect width="300" height="205" fill="rgba(255,255,255,0.05)" />
      <Motif motif={motif} />
      <rect x="11" y="11" width="278" height="398" rx="4" fill="none" stroke={CREAM} strokeOpacity="0.28" strokeWidth="1" />
      {/* 朱印 */}
      <rect x="26" y="26" width="34" height="34" rx="6" fill={CINNABAR} />
      <text x="43" y="50.5" textAnchor="middle" fontSize="19" fill={CREAM} style={SERIF}>观</text>
      {/* 竖排书名 */}
      {chars.map((c, i) => (
        <text key={i} x="250" y={startY + i * step} textAnchor="middle" fontSize="46" fill={CREAM} style={{ ...SERIF, fontWeight: 600 }}>{c}</text>
      ))}
      {/* 英文题 + 作者 */}
      {subtitle && <text x="27" y="384" fontSize="9.5" letterSpacing="1.6" fill={CREAM} fillOpacity="0.72" style={SERIF}>{subtitle.toUpperCase()}</text>}
      {author && <text x="27" y="400.5" fontSize="9.5" letterSpacing="1" fill={CREAM} fillOpacity="0.72" style={SERIF}>{author}</text>}
    </svg>
  )
}
