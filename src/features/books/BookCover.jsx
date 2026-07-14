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

// 母题:长寿之弧——一条长基线上扬起的健康曲线,延伸到远端一点朱色(呼应《超越百岁》延长「健康寿命」)。
function LongevityArc() {
  return (
    <g>
      <path d="M40,360 L260,360" fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" />
      <path d="M46,352 C110,348 152,300 200,252 C224,228 244,216 256,210" fill="none" stroke={CREAM} strokeOpacity="0.52" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="256" cy="210" r="9" fill={CINNABAR} />
    </g>
  )
}

// 母题:心电波——一道横贯的 ECG 波形,中间一个朱色 R 峰(呼应《心脏简史》)。
function PulseLine() {
  const d = 'M36,290 L112,290 L124,290 L134,264 L146,324 L158,240 L170,300 L182,290 L210,290 L264,290'
  return (
    <g>
      <path d={d} fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="158" cy="240" r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:血管与叶——两道同心血管环内一枚朱色叶片(呼应植物性全食逆转心脏病)。
function VesselLeaf() {
  return (
    <g>
      <circle cx="150" cy="292" r="74" fill="none" stroke={CREAM} strokeOpacity="0.32" strokeWidth="1.2" />
      <circle cx="150" cy="292" r="48" fill="none" stroke={CREAM} strokeOpacity="0.26" strokeWidth="1.1" />
      <path d="M150,262 Q168,280 150,304 Q132,280 150,262 Z" fill={CINNABAR} opacity="0.9" />
      <path d="M150,262 L150,304" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1" />
    </g>
  )
}

// 母题:神经元——胞体放射树突,中心一点朱色突触火花(呼应《大脑健康书》脑可塑)。
function Neuron() {
  const cx = 150, cy = 290
  const dend = []
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; dend.push(`M${(cx + Math.cos(a) * 15).toFixed(1)},${(cy + Math.sin(a) * 15).toFixed(1)} L${(cx + Math.cos(a) * 66).toFixed(1)},${(cy + Math.sin(a) * 66).toFixed(1)}`) }
  return (
    <g>
      <path d={dend.join(' ')} fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="13" fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r="5" fill={CINNABAR} />
    </g>
  )
}

// 母题:血糖曲线归平——剧烈尖峰逐渐抚平成一条缓线,落定处一点朱色(呼应《告别糖尿病》可缓解)。
function GlucoseFlatten() {
  const d = 'M40,300 L70,300 L86,236 L104,300 L120,252 L140,300 L166,286 L200,290 L260,290'
  return (
    <g>
      <path d="M40,340 L260,340" fill="none" stroke={CREAM} strokeOpacity="0.24" strokeWidth="1" />
      <path d={d} fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="230" cy="290" r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:调定点表盘——半圆刻度盘 + 一根朱色指针(呼应《饥饿的大脑》脂肪调定点)。
function SetpointDial() {
  const cx = 150, cy = 312, R = 80
  const arc = `M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`
  const ticks = []
  for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; ticks.push(`M${(cx + Math.cos(a) * R).toFixed(1)},${(cy + Math.sin(a) * R).toFixed(1)} L${(cx + Math.cos(a) * (R - 9)).toFixed(1)},${(cy + Math.sin(a) * (R - 9)).toFixed(1)}`) }
  const na = Math.PI + 0.66 * Math.PI
  return (
    <g>
      <path d={arc} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d={ticks.join(' ')} stroke={CREAM} strokeOpacity="0.28" strokeWidth="1" />
      <path d={`M${cx},${cy} L${(cx + Math.cos(na) * R * 0.82).toFixed(1)},${(cy + Math.sin(na) * R * 0.82).toFixed(1)}`} stroke={CINNABAR} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={CINNABAR} />
    </g>
  )
}

// 母题:火焰——一簇代谢之火,内焰朱色(呼应《燃烧》能量消耗)。
function Flame() {
  const outer = 'M150,212 C184,250 192,288 172,316 C163,328 152,332 150,348 C148,332 137,328 128,316 C108,288 116,250 150,212 Z'
  const inner = 'M150,268 C165,286 167,308 156,322 C152,328 150,330 150,338 C150,330 148,328 144,322 C133,308 135,286 150,268 Z'
  return (
    <g>
      <path d={outer} fill="none" stroke={CREAM} strokeOpacity="0.46" strokeWidth="1.4" />
      <path d={inner} fill={CINNABAR} opacity="0.9" />
    </g>
  )
}

// 母题:条形码——工业化包装的条码,其中一根朱色(呼应《超加工人群》工业食品)。
function Barcode() {
  let x = 66; const bars = []
  for (let i = 0; i < 22; i++) { const w = (i % 3 === 0) ? 4 : (i % 2 === 0 ? 2 : 1.5); bars.push({ x, w, hi: i === 11 }); x += w + 5 }
  return (
    <g>
      {bars.map((b, i) => <rect key={i} x={b.x} y="238" width={b.w} height="104" fill={b.hi ? CINNABAR : CREAM} fillOpacity={b.hi ? 0.95 : 0.42} />)}
    </g>
  )
}

// 母题:兔子帽——全书核心比喻(宇宙是从帽子里拉出的一只白兔,多数人满足于舒服地
// 坐在兔毛表面,只有哲学家愿意顺着兔毛往深处爬,去看清这场戏法是怎么变的)。
function RabbitHat() {
  const earL = 'M124,222 Q112,178 120,148 Q136,182 136,222'
  const earR = 'M176,222 Q188,178 180,148 Q164,182 164,222'
  const crown = 'M92,344 L100,220 Q150,204 200,220 L208,344'
  const brim = 'M58,344 Q150,370 242,344 Q150,324 58,344 Z'
  const furLine = 'M150,212 L150,332'
  const climbers = [[150, 246, false], [150, 282, false], [150, 318, true]]
  return (
    <g>
      <path d={earL} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d={earR} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d={crown} fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.3" />
      <path d={brim} fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.4" />
      <path d={furLine} fill="none" stroke={CREAM} strokeOpacity="0.28" strokeWidth="1" strokeDasharray="2 5" />
      {climbers.map(([x, y, hi], i) => <circle key={i} cx={x} cy={y} r={hi ? 9 : 5} fill={hi ? CINNABAR : CREAM} fillOpacity={hi ? 1 : 0.5} />)}
    </g>
  )
}

// 母题:大陆轴线——东西向大陆(欧亚)一条通畅的朱线横贯,南北向大陆(非洲/美洲)
// 同样的路径被气候带截断(呼应全书核心论点:大陆轴线方向决定农作物、技术传播的快慢)。
function ContinentalAxis() {
  // 欧亚横轴上移到竖排书名两列文字带之上,避免长书名折两列时与文字重叠。
  return (
    <g>
      <ellipse cx="150" cy="98" rx="95" ry="20" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.2" />
      <line x1="65" y1="98" x2="220" y2="98" stroke={CINNABAR} strokeWidth="1.7" strokeOpacity="0.85" />
      <polygon points="232,98 218,91 218,105" fill={CINNABAR} opacity="0.85" />
      <ellipse cx="150" cy="336" rx="30" ry="72" fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" />
      <line x1="150" y1="276" x2="150" y2="308" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.2" />
      <line x1="150" y1="364" x2="150" y2="396" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.2" />
      <circle cx="150" cy="336" r="6.5" fill={CREAM} fillOpacity="0.55" />
    </g>
  )
}

// 母题:脚印小径——一串脚印由浅入深地走向右侧,最后一枚朱色脚印后分出几条细枝
// (呼应全书从智人走出非洲、到成为改写地球的物种,一路岔出的诸多后果)。
function Footsteps() {
  const n = 8
  const steps = []
  for (let i = 0; i < n; i++) {
    steps.push({ x: 46 + i * 26, y: 330 + (i % 2 === 0 ? -8 : 8), op: 0.16 + (i / (n - 1)) * 0.4 })
  }
  const last = steps[steps.length - 1]
  const forks = [-22, 0, 22].map((dy) => `M${last.x},${last.y} L${last.x + 44},${last.y + dy}`)
  return (
    <g>
      {steps.slice(0, -1).map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx="7" ry="11" fill={CREAM} fillOpacity={s.op} transform={`rotate(${i % 2 === 0 ? -8 : 8} ${s.x} ${s.y})`} />
      ))}
      <path d={forks.join(' ')} fill="none" stroke={CINNABAR} strokeOpacity="0.55" strokeWidth="1.3" />
      <ellipse cx={last.x} cy={last.y} rx="9" ry="13" fill={CINNABAR} />
    </g>
  )
}

// 母题:收窄的门洞——一串嵌套的门框由外向内收窄,最内一层朱色(呼应历代制度一路
// 收紧、相权与地方权力一步步被中央与皇权收走,直至孤家寡人)。
function NarrowingGates() {
  const gates = [
    { w: 220, h: 148, y: 210 },
    { w: 178, h: 120, y: 226 },
    { w: 138, h: 94, y: 240 },
    { w: 100, h: 70, y: 252 },
    { w: 64, h: 48, y: 262 },
  ]
  return (
    <g fill="none" strokeWidth="1.2">
      {gates.map((g, i) => (
        <rect key={i} x={150 - g.w / 2} y={g.y} width={g.w} height={g.h} rx="6"
          stroke={i === gates.length - 1 ? CINNABAR : CREAM}
          strokeOpacity={i === gates.length - 1 ? 0.9 : 0.36 - i * 0.02} />
      ))}
      <circle cx="150" cy={262 + 24} r="5" fill={CINNABAR} />
    </g>
  )
}

// 母题:算盘缺档——一具算盘,唯独中间一档珠子散落、只剩一枚朱色孤珠悬在半空
// (呼应全书论点:帝国缺的不是道德,是一套「数目字管理」——缺失的那一档)。
function AbacusGap() {
  const x0 = 66, x1 = 234, top = 214, bar = 268, bottom = 356
  const rods = [90, 128, 166, 204]
  return (
    <g>
      <rect x={x0} y={top} width={x1 - x0} height={bottom - top} rx="4" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <line x1={x0} y1={bar} x2={x1} y2={bar} stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.1" />
      {rods.map((x, i) => <line key={i} x1={x} y1={top} x2={x} y2={bottom} stroke={CREAM} strokeOpacity="0.22" strokeWidth="0.9" />)}
      {rods.map((x, i) => i !== 2 && [top + 20, top + 34].map((y, j) => <circle key={`t${i}-${j}`} cx={x} cy={y} r="6" fill={CREAM} fillOpacity="0.4" />))}
      {rods.map((x, i) => i !== 2 && [bar + 18, bar + 32, bar + 46].map((y, j) => <circle key={`b${i}-${j}`} cx={x} cy={y} r="6" fill={CREAM} fillOpacity="0.4" />))}
      <circle cx={rods[2]} cy={(top + bottom) / 2} r="8" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}

// 母题:叠石(cairn)——一摞平衡堆叠、逐层收窄的石头,顶石朱色(呼应《原则》:一条条原则在一生中累积、平衡地叠起来)。
function Cairn() {
  const stones = [
    { y: 346, rx: 44, ry: 15 }, { y: 316, rx: 36, ry: 13 }, { y: 290, rx: 28, ry: 11 }, { y: 268, rx: 20, ry: 9 }, { y: 250, rx: 13, ry: 7, hi: true },
  ]
  return (
    <g>
      {stones.map((s, i) => <ellipse key={i} cx="150" cy={s.y} rx={s.rx} ry={s.ry} fill={s.hi ? CINNABAR : 'none'} fillOpacity={s.hi ? 0.9 : 1} stroke={s.hi ? 'none' : CREAM} strokeOpacity="0.45" strokeWidth="1.3" />)}
    </g>
  )
}

// 母题:沙漏——沙自朱色细流落下、堆在底部(呼应《卓有成效的管理者》第一要务:认识并管理最稀缺的资源——时间)。
function Hourglass() {
  return (
    <g>
      <line x1="106" y1="232" x2="194" y2="232" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="106" y1="360" x2="194" y2="360" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M110,232 L190,232 L150,296 Z" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d="M150,296 L190,360 L110,360 Z" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <line x1="150" y1="296" x2="150" y2="332" stroke={CINNABAR} strokeWidth="1.6" />
      <path d="M126,360 L174,360 L150,340 Z" fill={CINNABAR} opacity="0.85" />
    </g>
  )
}

// 母题:罗盘——指针朝北(朱色),四向刻度(呼应《七个习惯》以原则为中心、朝向"真北"的价值坐标)。
function Compass() {
  const cx = 150, cy = 293, R = 62, ticks = []
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ticks.push(`M${(cx + Math.cos(a) * R).toFixed(1)},${(cy + Math.sin(a) * R).toFixed(1)} L${(cx + Math.cos(a) * (R - 9)).toFixed(1)},${(cy + Math.sin(a) * (R - 9)).toFixed(1)}`) }
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d={ticks.join(' ')} stroke={CREAM} strokeOpacity="0.35" strokeWidth="1.2" />
      <path d={`M${cx},${cy - 46} L${cx - 9},${cy} L${cx},${cy + 6} Z`} fill={CINNABAR} />
      <path d={`M${cx},${cy + 46} L${cx + 9},${cy} L${cx},${cy - 6} Z`} fill={CREAM} fillOpacity="0.42" />
      <circle cx={cx} cy={cy} r="3.5" fill={CREAM} fillOpacity="0.85" />
    </g>
  )
}

// 母题:反馈回路——一道循环的箭头绕成闭环,中心一枚朱核(呼应《第五项修炼》系统思考:结构成环、因果回授)。
function FeedbackLoop() {
  return (
    <g>
      <path d="M150,235 A58,58 0 1 1 138,236" fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M150,235 l-9,-5 l1,11 z" fill={CREAM} fillOpacity="0.6" />
      <circle cx="150" cy="293" r="30" fill="none" stroke={CREAM} strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="150" cy="293" r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:思维格栅——一张网格,交点挂着来自各学科的模型,一枚朱色节点(呼应芒格"多元思维模型的 latticework")。
function Lattice() {
  const x0 = 104, y0 = 238, cols = 5, rows = 6, g = 22, seg = [], dots = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * g, y = y0 + r * g
    dots.push({ x, y, hi: r === 3 && c === 2 })
    if (c < cols - 1) seg.push(`M${x},${y} L${x + g},${y}`)
    if (r < rows - 1) seg.push(`M${x},${y} L${x},${y + g}`)
  }
  return (
    <g>
      <path d={seg.join(' ')} fill="none" stroke={CREAM} strokeOpacity="0.26" strokeWidth="1" />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.hi ? 5 : 2.4} fill={d.hi ? CINNABAR : CREAM} fillOpacity={d.hi ? 1 : 0.5} />)}
    </g>
  )
}

// 母题:苹果里的橙子——外形是苹果、剖开却是橙瓣(呼应《魔鬼经济学》"事物的隐藏面":看着是这个,里子是那个)。
function AppleOrange() {
  const apple = 'M150,238 C120,222 96,242 98,282 C100,322 128,352 150,352 C172,352 200,322 202,282 C204,242 180,222 150,238 Z'
  const stem = 'M150,240 Q152,222 160,214'
  const cx = 150, cy = 293, segs = []
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; segs.push(`M${cx},${cy} L${(cx + Math.cos(a) * 44).toFixed(1)},${(cy + Math.sin(a) * 44).toFixed(1)}`) }
  return (
    <g>
      <path d={apple} fill="none" stroke={CREAM} strokeOpacity="0.44" strokeWidth="1.4" />
      <path d={stem} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <circle cx={cx} cy={cy} r="44" fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" />
      <path d={segs.join(' ')} stroke={CREAM} strokeOpacity="0.26" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="6" fill={CINNABAR} />
    </g>
  )
}

// 母题:双系统——一枚圆分作两半:左半一道朱色闪电(系统1·快·直觉),右半几道同心慢弧(系统2·慢·审慎),中缝虚线相隔(呼应《思考,快与慢》两套心智系统)。
function TwoSystems() {
  const cx = 150, cy = 293, R = 82
  const arcs = [34, 56, 78].map((r) => `M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r}`)
  const bolt = 'M132,236 L108,290 L126,290 L112,352'
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 5" />
      {arcs.map((d, i) => <path key={i} d={d} fill="none" stroke={CREAM} strokeOpacity={0.42 - i * 0.08} strokeWidth="1.2" />)}
      <path d={bolt} fill="none" stroke={CINNABAR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

// 母题:散靶——一面同心圆靶,弹着点四下散落(判断的「噪声」:本该一致的判断却四处发散),其一朱色(呼应《噪声》射击靶隐喻:偏差是系统性偏移,噪声是发散)。
function ScatterTarget() {
  const cx = 150, cy = 293
  const rings = [80, 54, 28]
  const shots = [[118, 248], [170, 258], [128, 302], [188, 292], [150, 332], [106, 284], [176, 322], [140, 232], [198, 246]]
  return (
    <g>
      {rings.map((r, i) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={CREAM} strokeOpacity={0.36 - i * 0.05} strokeWidth="1.1" />)}
      <path d={`M${cx - 10},${cy} L${cx + 10},${cy} M${cx},${cy - 10} L${cx},${cy + 10}`} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" />
      {shots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 6 : 4} fill={i === 3 ? CINNABAR : CREAM} fillOpacity={i === 3 ? 0.95 : 0.5} />)}
    </g>
  )
}

// 母题:预测之扇——从当下一点向右分叉出多条可能的未来路径,主路朱色、余路淡出(呼应《超级预测》:以概率思考未来的多种可能,而非只押一个结局)。
function ForecastFan() {
  const ox = 60, oy = 293, hi = 1
  const ends = [[252, 206], [256, 250], [258, 293], [256, 336], [252, 380]]
  const paths = ends.map(([x, y]) => `M${ox},${oy} Q${((ox + x) / 2).toFixed(0)},${oy} ${x},${y}`)
  return (
    <g>
      <circle cx={ox} cy={oy} r="6" fill={CREAM} fillOpacity="0.6" />
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={i === hi ? CINNABAR : CREAM} strokeOpacity={i === hi ? 0.9 : 0.3} strokeWidth={i === hi ? 2 : 1.1} strokeLinecap="round" />)}
      {ends.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === hi ? 6 : 3.5} fill={i === hi ? CINNABAR : CREAM} fillOpacity={i === hi ? 0.95 : 0.45} />)}
    </g>
  )
}

// 母题:复利雪球——一道长坡上,雪球越滚越大,末端最大一枚朱色(呼应巴菲特复利之道:一颗湿雪球 + 一道长长的坡,时间滚出巨大财富)。
function Snowball() {
  const slope = 'M44,214 Q150,300 262,356'
  const balls = [[74, 232, 5], [116, 260, 8], [166, 294, 12], [232, 340, 20]]
  return (
    <g>
      <path d={slope} fill="none" stroke={CREAM} strokeOpacity="0.32" strokeWidth="1.3" strokeLinecap="round" />
      {balls.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i === balls.length - 1 ? CINNABAR : CREAM} fillOpacity={i === balls.length - 1 ? 0.92 : 0.42} />
      ))}
    </g>
  )
}

// 母题:现金流象限——一个 2×2 方格(雇员/自雇/企业主/投资者),右下「让钱为你工作」的一格朱色(呼应《穷爸爸富爸爸》:从为钱工作,转向让钱为你工作)。
function Quadrant() {
  const x0 = 88, y0 = 231, s = 62
  return (
    <g>
      <rect x={x0} y={y0} width={2 * s} height={2 * s} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <line x1={x0 + s} y1={y0} x2={x0 + s} y2={y0 + 2 * s} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" />
      <line x1={x0} y1={y0 + s} x2={x0 + 2 * s} y2={y0 + s} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" />
      <rect x={x0 + s} y={y0 + s} width={s} height={s} fill={CINNABAR} fillOpacity="0.82" />
      <circle cx={x0 + s + s / 2} cy={y0 + s + s / 2} r="9" fill="none" stroke={CREAM} strokeOpacity="0.7" strokeWidth="1.4" />
    </g>
  )
}

// 母题:供需之叉——向上的供给线与向下的需求线在中点交叉,交点(均衡)朱色(呼应经济学最核心的供求图)。
function SupplyDemand() {
  return (
    <g>
      <path d="M66,378 L66,214 M66,378 L246,378" fill="none" stroke={CREAM} strokeOpacity="0.28" strokeWidth="1" strokeLinecap="round" />
      <path d="M80,232 L238,356" fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M80,356 L238,232" fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="159" cy="294" r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:金蛋——窝里卧着几枚蛋,中央一枚朱色金蛋(呼应《小狗钱钱》"会下金蛋的鹅":守住本金、靠它下的蛋过活)。
function GoldenEgg() {
  const nest = 'M90,314 Q150,360 210,314'
  const nest2 = 'M98,306 Q150,346 202,306'
  const eggs = [[126, 300, 11, 15, false], [150, 292, 13, 18, true], [174, 300, 11, 15, false]]
  return (
    <g>
      <path d={nest} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
      <path d={nest2} fill="none" stroke={CREAM} strokeOpacity="0.24" strokeWidth="1.1" strokeLinecap="round" />
      {eggs.map(([x, y, rx, ry, hi], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={hi ? CINNABAR : CREAM} fillOpacity={hi ? 0.9 : 0.45} />
      ))}
    </g>
  )
}

// 母题:归属之环——数圈同心环(社区的界线与内环),几枚成员点由外向内散布,圆心朱色如炉火(呼应《社区的艺术》:从外围到核心、层层深入的归属)。
function BelongingRings() {
  const cx = 150, cy = 293
  const rings = [84, 58, 32]
  const dots = [[cx - 6, cy - 84], [cx + 44, cy - 30], [cx - 34, cy + 20], [cx + 20, cy + 46]]
  return (
    <g>
      {rings.map((r, i) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={CREAM} strokeOpacity={0.4 - i * 0.07} strokeWidth="1.2" />)}
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={CREAM} fillOpacity="0.55" />)}
      <circle cx={cx} cy={cy} r="9" fill={CINNABAR} />
    </g>
  )
}

// 母题:三环相扣——领域·社区·实践三个圆相互交叠,共同交汇处朱色(呼应实践社区的三要素:domain/community/practice 咬合而生)。
function PracticeTriad() {
  const cx = 150, cy = 296, r = 42, off = 26
  const centers = [[cx, cy - off], [cx - off * 0.87, cy + off * 0.5], [cx + off * 0.87, cy + off * 0.5]]
  return (
    <g>
      {centers.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.2" />)}
      <circle cx={cx} cy={cy} r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:围成一圈——几个人(结点)手拉手围成一圈,连成闭环,其一朱色(呼应《聚在一起》:和人一起、彼此相连地建社群)。
function CircleJoin() {
  const cx = 150, cy = 293, R = 66, N = 7
  const pts = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  const ring = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ') + ' Z'
  return (
    <g>
      <path d={ring} fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 2 ? 8 : 6} fill={i === 2 ? CINNABAR : CREAM} fillOpacity={i === 2 ? 0.92 : 0.5} />)}
    </g>
  )
}

// 母题:交织之线——三缕丝线上下起伏、彼此交织成一片(呼应《文化密码》:强团队文化由无数信号与连接交织而成),中缕朱色。
function Weave() {
  const mk = (y, ph) => { let d = `M62,${y}`; for (let i = 0; i <= 6; i++) { const x = 62 + i * 28; const yy = y + (((i + ph) % 2) ? 15 : -15); d += ` Q${x - 14},${yy} ${x},${y}` } return d }
  return (
    <g fill="none" strokeLinecap="round">
      <path d={mk(272, 0)} stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d={mk(298, 1)} stroke={CINNABAR} strokeOpacity="0.85" strokeWidth="1.9" />
      <path d={mk(324, 0)} stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
    </g>
  )
}

// 母题:旗与众——一根旗杆挑起一面朱旗,杆下几个人点聚拢(呼应《部落》:一群人因一个理念与一位领袖而聚、追随一面旗)。
function Banner() {
  const px = 138
  return (
    <g>
      <line x1={px} y1="212" x2={px} y2="372" stroke={CREAM} strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M138,222 Q172,212 204,224 Q188,236 204,248 Q172,240 138,250 Z" fill={CINNABAR} opacity="0.9" />
      {[[116, 360], [136, 368], [156, 360], [176, 368], [196, 360]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill={CREAM} fillOpacity="0.5" />)}
    </g>
  )
}

// 母题:去中心网——六个对等结点两两相连成网、没有中心(呼应《重塑组织》青色组织的自我管理:权力分布、无科层),其一朱色。
function Mesh() {
  const cx = 150, cy = 293, R = 66, N = 6, pts = []
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 - Math.PI / 2; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]) }
  const lines = []
  for (let i = 0; i < N; i++) { lines.push([pts[i], pts[(i + 1) % N]]); lines.push([pts[i], pts[(i + 2) % N]]) }
  return (
    <g>
      <path d={lines.map(([[x1, y1], [x2, y2]]) => `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`).join(' ')} fill="none" stroke={CREAM} strokeOpacity="0.24" strokeWidth="1" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 8 : 6} fill={i === 0 ? CINNABAR : CREAM} fillOpacity={i === 0 ? 0.9 : 0.5} />)}
    </g>
  )
}

// 母题:流与团队——一道价值流的箭头贯穿,三个团队方块沿流排布,主流(流式团队)朱色(呼应《团队拓扑》:围绕价值流组织团队)。
function TeamFlow() {
  const y = 293
  const xs = [102, 150, 198]
  return (
    <g>
      <line x1="70" y1={y + 24} x2="226" y2={y + 24} stroke={CREAM} strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M228,317 l-11,-5 l1,10 z" fill={CREAM} fillOpacity="0.5" />
      {xs.map((x, i) => <rect key={i} x={x - 21} y={y - 22} width="42" height="28" rx="5" fill={i === 1 ? CINNABAR : 'none'} fillOpacity={i === 1 ? 0.85 : 1} stroke={i === 1 ? 'none' : CREAM} strokeOpacity="0.42" strokeWidth="1.2" />)}
    </g>
  )
}

// 母题:影响之杆——一排立在基线上的开关/杠杆,中间一根被扳动、朱色(呼应《影响力》:一按即触发自动反应的几根「影响力杠杆」)。
function Levers() {
  const y = 336, xs = [96, 124, 152, 180, 208]
  return (
    <g>
      <line x1="82" y1={y} x2="222" y2={y} stroke={CREAM} strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round" />
      {xs.map((x, i) => { const hi = i === 2, dx = hi ? 11 : 0, dy = hi ? -3 : 0; return (
        <g key={i}>
          <line x1={x} y1={y} x2={x + dx} y2={y - 46 + dy} stroke={hi ? CINNABAR : CREAM} strokeOpacity={hi ? 0.9 : 0.5} strokeWidth={hi ? 2 : 1.4} strokeLinecap="round" />
          <circle cx={x + dx} cy={y - 46 + dy} r={hi ? 7 : 5} fill={hi ? CINNABAR : CREAM} fillOpacity={hi ? 0.92 : 0.5} />
        </g>
      ) })}
    </g>
  )
}

function Motif({ motif }) {
  if (motif === 'two-mountains') return <TwoMountains />
  if (motif === 'two-systems') return <TwoSystems />
  if (motif === 'weave') return <Weave />
  if (motif === 'banner') return <Banner />
  if (motif === 'mesh') return <Mesh />
  if (motif === 'team-flow') return <TeamFlow />
  if (motif === 'levers') return <Levers />
  if (motif === 'scatter-target') return <ScatterTarget />
  if (motif === 'forecast-fan') return <ForecastFan />
  if (motif === 'snowball') return <Snowball />
  if (motif === 'quadrant') return <Quadrant />
  if (motif === 'supply-demand') return <SupplyDemand />
  if (motif === 'golden-egg') return <GoldenEgg />
  if (motif === 'belonging-rings') return <BelongingRings />
  if (motif === 'circle-join') return <CircleJoin />
  if (motif === 'practice-triad') return <PracticeTriad />
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
  if (motif === 'longevity-arc') return <LongevityArc />
  if (motif === 'pulse-line') return <PulseLine />
  if (motif === 'vessel-leaf') return <VesselLeaf />
  if (motif === 'neuron') return <Neuron />
  if (motif === 'glucose-flatten') return <GlucoseFlatten />
  if (motif === 'setpoint-dial') return <SetpointDial />
  if (motif === 'flame') return <Flame />
  if (motif === 'barcode') return <Barcode />
  if (motif === 'apple-orange') return <AppleOrange />
  if (motif === 'lattice') return <Lattice />
  if (motif === 'feedback-loop') return <FeedbackLoop />
  if (motif === 'compass') return <Compass />
  if (motif === 'hourglass') return <Hourglass />
  if (motif === 'cairn') return <Cairn />
  if (motif === 'rabbit-hat') return <RabbitHat />
  if (motif === 'continental-axis') return <ContinentalAxis />
  if (motif === 'footsteps') return <Footsteps />
  if (motif === 'narrowing-gates') return <NarrowingGates />
  if (motif === 'abacus-gap') return <AbacusGap />
  if (motif === 'circuit-halo') return <CircuitHalo />
  if (motif === 'hinge-panels') return <HingePanels />
  if (motif === 'tectonic-fault') return <TectonicFault />
  if (motif === 'black-swan-flock') return <BlackSwanFlock />
  if (motif === 'hydra-branch') return <HydraBranch />
  if (motif === 'moon-waves') return <MoonWaves />
  if (motif === 'assembly-line') return <AssemblyLine />
  if (motif === 'flywheel') return <Flywheel />
  if (motif === 'bridge-bubbles') return <BridgeBubbles />
  if (motif === 'compound-curve') return <CompoundCurve />
  if (motif === 'gene-helix') return <GeneHelix />
  if (motif === 'event-horizon') return <EventHorizon />
  if (motif === 'broken-causal-chain') return <BrokenCausalChain />
  if (motif === 'butterfly-spiral') return <ButterflySpiral />
  if (motif === 'bitten-circle') return <BittenCircle />
  if (motif === 'mirror-question') return <MirrorQuestion />
  if (motif === 'gentle-nudge') return <GentleNudge />
  if (motif === 'zero-to-one') return <ZeroToOne />
  if (motif === 'bml-loop') return <BmlLoop />
  if (motif === 'safety-margin') return <SafetyMargin />
  return <path d="M0,420 L0,362 L300,322 L300,420 Z" fill="rgba(0,0,0,0.22)" />
}

// 母题:电路光环——人形轮廓头顶浮起一圈电路结点的光环(呼应全书核心意象:智人正试图
// 把自己升级为神——用数据与算法取代神话,给自己造一顶新的光环)。
function CircuitHalo() {
  const headCx = 150, headCy = 330, headR = 22
  const shoulders = 'M108,390 Q108,352 150,352 Q192,352 192,390'
  const haloNodes = [[110, 270], [132, 246], [150, 238], [168, 246], [190, 270], [150, 214]]
  const haloLines = haloNodes.map(([x, y]) => `M${headCx},${headCy - headR - 6} L${x},${y}`).join(' ')
  return (
    <g>
      <path d={shoulders} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <circle cx={headCx} cy={headCy} r={headR} fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.3" />
      <path d={haloLines} fill="none" stroke={CREAM} strokeOpacity="0.24" strokeWidth="1" />
      {haloNodes.slice(0, -1).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill={CREAM} fillOpacity="0.5" />)}
      <circle cx={haloNodes[5][0]} cy={haloNodes[5][1]} r="8" fill={CINNABAR} />
    </g>
  )
}

// 母题:铰链双扇——两片微张的门扇在中轴一排铰链上开合(呼应全书论点:中国是连接
// 内亚草原与东亚农耕世界、大陆秩序与海洋秩序的枢纽,靠一根轴转动两个世界)。
function HingePanels() {
  const leftPanel = 'M60,220 L150,236 L150,364 L60,380 Z'
  const rightPanel = 'M240,220 L150,236 L150,364 L240,380 Z'
  const hinges = [246, 282, 318, 354]
  return (
    <g>
      <path d={leftPanel} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <path d={rightPanel} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <line x1="150" y1="230" x2="150" y2="370" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.4" />
      {hinges.map((y, i) => <circle key={i} cx="150" cy={y} r={i === 1 ? 7 : 4} fill={i === 1 ? CINNABAR : CREAM} fillOpacity={i === 1 ? 1 : 0.55} />)}
    </g>
  )
}

// 母题:板块断层——两块参差的地壳在一道锯齿裂缝处相抵,裂缝一点朱色摩擦火花
// (呼应全书核心论点:冷战后的世界不再按意识形态分裂,而是沿文明的「断层线」冲突)。
function TectonicFault() {
  const plateA = 'M40,380 L52,300 L96,268 L140,300 L120,380 Z'
  const plateB = 'M260,380 L248,296 L200,262 L156,300 L180,380 Z'
  const fault = 'M96,268 L104,290 L92,308 L108,330 L96,352 L120,380'
  return (
    <g>
      <path d={plateA} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <path d={plateB} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" />
      <path d={fault} fill="none" stroke={CINNABAR} strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="290" r="6" fill={CINNABAR} />
    </g>
  )
}

// 母题:黑天鹅之群——一群振翅的鸟形剪影中,唯独一只朱色、体量更大、姿态迥异
// (呼应全书封面原典意象:极端而不可预测的少数事件,主宰了看似规律的世界)。
function BlackSwanFlock() {
  const birds = [[70, 260, 0.9, false], [110, 244, 1, false], [150, 236, 1.1, false], [190, 248, 1, false], [228, 264, 0.95, false], [150, 300, 1.6, true]]
  const wing = (x, y, s) => `M${x - 14 * s},${y} Q${x},${y - 10 * s} ${x + 14 * s},${y} Q${x},${y - 3 * s} ${x - 14 * s},${y} Z`
  return (
    <g>
      {birds.map(([x, y, s, hi], i) => (
        <path key={i} d={wing(x, y, s)} fill="none" stroke={hi ? CINNABAR : CREAM} strokeOpacity={hi ? 0.95 : 0.4} strokeWidth={hi ? 1.8 : 1.2} />
      ))}
    </g>
  )
}

// 母题:多头之枝——一根主干被斩断处,反而生出两条新枝(其一朱色、伸展得更远)
// (呼应全书核心论点:反脆弱的系统从冲击与压力中获益、越挫越强,而非仅仅是「抗压」)。
function HydraBranch() {
  const stem = 'M150,380 L150,290'
  const branchL = 'M150,290 Q120,270 108,224'
  const branchR = 'M150,290 Q180,268 196,220'
  return (
    <g>
      <path d={stem} fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round" />
      <path d={branchL} fill="none" stroke={CREAM} strokeOpacity="0.44" strokeWidth="1.3" strokeLinecap="round" />
      <path d={branchR} fill="none" stroke={CINNABAR} strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="150" cy="290" r="6" fill={CINNABAR} />
      <circle cx="108" cy="224" r="5" fill={CREAM} fillOpacity="0.5" />
      <circle cx="196" cy="220" r="6.5" fill={CINNABAR} />
    </g>
  )
}

// 母题:月与波——一弯新月挂在上方留白,下方三道脑波般的曲线起伏(中间一道朱色,
// 呼应全书主题:睡眠不是意识的关机,而是大脑最活跃的修复与巩固时段)。
// 长书名(9字两列)专用布局:月亮收在两列文字之上、波纹收在文字与落款题字之间的窄带。
function MoonWaves() {
  const moonPath = 'M168,64 A24,24 0 1 1 168,112 A18,18 0 1 0 168,64 Z'
  const waves = [332, 346, 360].map((y) => `M40,${y} Q90,${y - 7} 140,${y} T260,${y + 3}`)
  return (
    <g>
      <path d={moonPath} fill={CREAM} fillOpacity="0.5" />
      {waves.map((d, i) => <path key={i} d={d} fill="none" stroke={i === 1 ? CINNABAR : CREAM} strokeOpacity={i === 1 ? 0.85 : 0.32} strokeWidth={i === 1 ? 1.6 : 1.1} />)}
    </g>
  )
}

// 母题:装配线——一条横贯的产线,几个工位方框依次排开,其一朱色(呼应全书「早餐工厂」
// 比喻:管理的本质是产出,找到杠杆率最高的那道工序)。长书名(11字两列)专用布局,
// 整条产线收在两列文字与落款题字之间的窄带,避免与竖排书名重叠。
function AssemblyLine() {
  const y = 362
  const stations = [48, 86, 124, 162, 200, 238]
  return (
    <g>
      <line x1="40" y1={y} x2="258" y2={y} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" />
      {stations.map((x, i) => (
        <rect key={i} x={x - 8} y={y - 10} width="16" height="20" rx="3"
          fill="none" stroke={i === 3 ? CINNABAR : CREAM} strokeOpacity={i === 3 ? 0.9 : 0.4} strokeWidth={i === 3 ? 1.5 : 1} />
      ))}
      <polygon points={`264,${y} 253,${y - 5} 253,${y + 5}`} fill={CREAM} opacity="0.4" />
    </g>
  )
}

// 母题:飞轮——一圈同心弧线绕着圆心渐次加粗、加速,末端接上朱色的突破弧
// (呼应全书核心比喻:卓越不是一次突破,是同一个方向持续推动,飞轮转到临界点后自己转起来)。
function Flywheel() {
  const cx = 150, cy = 300, R = 76
  const arrows = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const a1 = (deg - 18) * Math.PI / 180, a2 = (deg + 18) * Math.PI / 180
    const r = R - i * 3
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r
    const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r
    return { d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`, hi: i === 5, w: 1 + i * 0.15 }
  })
  return (
    <g fill="none">
      <circle cx={cx} cy={cy} r={R} stroke={CREAM} strokeOpacity="0.22" strokeWidth="1" />
      {arrows.map((a, i) => <path key={i} d={a.d} stroke={a.hi ? CINNABAR : CREAM} strokeOpacity={a.hi ? 0.9 : 0.3 + i * 0.08} strokeWidth={a.hi ? 2 : a.w} strokeLinecap="round" />)}
      <circle cx={cx} cy={cy} r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:桥接两语——左侧一只尖角的话语泡(评判、指责的语言),经一道虚线弧桥,
// 接到右侧一只朱色的圆融话语泡(观察与需要的语言),呼应全书「长颈鹿语言 vs 豺狼语言」的比喻。
function BridgeBubbles() {
  const jagged = 'M50,240 L100,236 L96,252 L128,244 L120,270 L96,266 L100,286 L60,272 L70,258 Z'
  const smoothCx = 210, smoothCy = 280
  const bridge = 'M105,255 Q150,220 195,262'
  return (
    <g>
      <path d={jagged} fill="none" stroke={CREAM} strokeOpacity="0.36" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={bridge} fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.1" strokeDasharray="2 4" />
      <ellipse cx={smoothCx} cy={smoothCy} rx="34" ry="24" fill="none" stroke={CINNABAR} strokeOpacity="0.85" strokeWidth="1.6" />
      <path d={`M${smoothCx - 10},${smoothCy + 22} L${smoothCx - 18},${smoothCy + 34} L${smoothCx - 2},${smoothCy + 23} Z`} fill="none" stroke={CINNABAR} strokeOpacity="0.85" strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  )
}

// 母题:复利曲线——一串由小到大的结点沿指数曲线爬升,末端一点放大的朱色
// (呼应全书核心论点:习惯是复利,1% 的微小改变每天都在发生,但要很久之后才看得见)。
function CompoundCurve() {
  const pts = []
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    pts.push({ x: 50 + t * 190, y: 360 - Math.pow(t, 2.2) * 150, r: 3 + t * 7 })
  }
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')
  return (
    <g>
      <path d={path} fill="none" stroke={CREAM} strokeOpacity="0.32" strokeWidth="1.2" />
      {pts.slice(0, -1).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={CREAM} fillOpacity="0.4" />)}
      <circle cx={pts[6].x} cy={pts[6].y} r={pts[6].r} fill={CINNABAR} />
    </g>
  )
}

// 竖排书名自适应:短名(≤5)沿用大字单列(与既有封面像素级一致);6–7 字缩小单列;
// 8 字及以上自动折成两列、右起竖读(右列在前),字号随列长再缩,保证长书名也放得下、不出框。
function titleColumns(title) {
  const all = [...title].slice(0, 16)
  const n = all.length
  if (n <= 5) {
    const step = 54
    return [{ x: 250, fontSize: 46, step, startY: 100 - (n - 4) * (step / 2), chars: all }]
  }
  if (n <= 7) {
    const step = 42, fontSize = 36
    return [{ x: 250, fontSize, step, startY: 210 - (n - 1) * (step / 2), chars: all }]
  }
  // 8+ :两列(右起),右列排前半、左列排后半;字号按较长列收
  const half = Math.ceil(n / 2)
  const step = Math.min(42, Math.floor(300 / half))
  const fontSize = Math.round(step * 0.82)
  const startY = 210 - (half - 1) * (step / 2)
  const gap = Math.round(fontSize * 1.34)
  return [
    { x: 250, fontSize, step, startY, chars: all.slice(0, half) },
    { x: 250 - gap, fontSize, step, startY, chars: all.slice(half) },
  ]
}

// 母题:基因螺旋——一道双螺旋从上方垂落,螺旋周身缀着几只小小的「载具」外壳
// (呼应全书核心论点:身体不过是基因用来复制自己的生存机器)。
function GeneHelix() {
  const rungs = [80, 108, 136, 164, 192, 220, 248, 276]
  const vehicles = [[95, 96], [205, 150], [95, 204], [205, 258]]
  return (
    <g>
      {rungs.map((y, i) => {
        const lx = 120 + Math.sin(y / 22) * 45
        const rx = 180 - Math.sin(y / 22) * 45
        return (
          <g key={i}>
            <line x1={lx} y1={y} x2={rx} y2={y} stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" />
            <circle cx={lx} cy={y} r="3.4" fill={CREAM} fillOpacity="0.55" />
            <circle cx={rx} cy={y} r="3.4" fill={CREAM} fillOpacity="0.55" />
          </g>
        )
      })}
      <path d="M120,72 C90,110 90,150 120,192 C150,234 150,270 120,312" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      <path d="M180,72 C210,110 210,150 180,192 C150,234 150,270 180,312" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.3" />
      {vehicles.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 1 ? 9 : 5.5} fill={i === 1 ? CINNABAR : CREAM} fillOpacity={i === 1 ? 1 : 0.45} />)}
    </g>
  )
}

// 母题:事件视界——一片规则的时空网格被中心的暗孔渐渐弯折吞噬,孔边一圈朱色
// 吸积环(呼应全书核心意象:引力如何弯曲时空,黑洞如何吞噬光)。
function EventHorizon() {
  const lines = []
  for (let i = 0; i <= 8; i++) {
    const y = 90 + i * 26
    const bend = Math.max(0, 30 - Math.abs(150 - (60 + i * 6)))
    lines.push(<path key={`h${i}`} d={`M60,${y} Q150,${y + (i >= 3 && i <= 5 ? 22 : 4)} 240,${y}`} fill="none" stroke={CREAM} strokeOpacity="0.26" strokeWidth="1" />)
  }
  for (let i = 0; i <= 6; i++) {
    const x = 60 + i * 30
    lines.push(<path key={`v${i}`} d={`M${x},90 Q${x + (i >= 2 && i <= 4 ? 18 : 3)},195 ${x},312`} fill="none" stroke={CREAM} strokeOpacity="0.26" strokeWidth="1" />)
  }
  return (
    <g>
      {lines}
      <circle cx="150" cy="204" r="30" fill="rgba(0,0,0,0.4)" />
      <circle cx="150" cy="204" r="30" fill="none" stroke={CINNABAR} strokeWidth="2.4" />
      <circle cx="150" cy="204" r="18" fill="rgba(0,0,0,0.55)" />
    </g>
  )
}

// 母题:断裂的因果链——一串环环相扣的锁链在中段被剪断,断口一点朱色裂痕
// (呼应全书核心论点:相关不是因果,许多「显而易见」的因果链其实经不起推敲)。
function BrokenCausalChain() {
  const links = [[90, 110], [90, 150], [90, 190], [210, 230], [210, 270], [210, 310]]
  return (
    <g>
      {links.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="17" ry="22" fill="none" stroke={CREAM} strokeOpacity={i < 3 ? 0.44 : 0.3} strokeWidth="2.2"
          transform={i % 2 ? `rotate(90 ${x} ${y})` : undefined} />
      ))}
      <line x1="90" y1="212" x2="120" y2="205" stroke={CINNABAR} strokeWidth="2" />
      <line x1="120" y1="205" x2="150" y2="222" stroke={CINNABAR} strokeWidth="2" />
      <line x1="150" y1="222" x2="180" y2="210" stroke={CINNABAR} strokeWidth="2" />
      <circle cx="150" cy="222" r="4" fill={CINNABAR} />
      <text x="150" y="260" textAnchor="middle" fontSize="11" fill={CREAM} fillOpacity="0.5" style={SERIF}>?</text>
    </g>
  )
}

// 母题:蝴蝶回旋——一圈黄蝶(全书标志意象)绕着一个孤独的小点螺旋盘旋
// (呼应马孔多与布恩迪亚家族:重复的名字、重复的命运,孤独是终局)。
function ButterflySpiral() {
  const wing = (x, y, r, rot, op) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse cx="-4" cy="0" rx="6" ry="4" fill={CREAM} fillOpacity={op} />
      <ellipse cx="4" cy="0" rx="6" ry="4" fill={CREAM} fillOpacity={op} />
    </g>
  )
  const spiral = []
  for (let i = 0; i < 9; i++) {
    const a = i * 0.85
    const r = 20 + i * 11
    const x = 150 + Math.cos(a) * r
    const y = 210 + Math.sin(a) * r * 0.85
    spiral.push(wing(x, y, a * 40, 0.32 + i * 0.05))
  }
  return (
    <g>
      {spiral}
      <circle cx="150" cy="210" r="6" fill={CINNABAR} />
    </g>
  )
}

// 母题:缺口圆——一枚被咬去一角的圆(果实/月相的抽象),缺口处透出几道微光
// (呼应车库到车库的创业史与「非同凡想」式产品美学,不直接挪用任何品牌标志)。
function BittenCircle() {
  return (
    <g>
      <circle cx="150" cy="200" r="62" fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="2" />
      <circle cx="196" cy="176" r="26" fill={accentBg()} />
      <line x1="150" y1="138" x2="150" y2="118" stroke={CREAM} strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="150" cy="112" r="4" fill={CINNABAR} />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={196 + Math.cos(i * 0.5 - 0.5) * 30} y1={176 + Math.sin(i * 0.5 - 0.5) * 30}
          x2={196 + Math.cos(i * 0.5 - 0.5) * 44} y2={176 + Math.sin(i * 0.5 - 0.5) * 44}
          stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.4" />
      ))}
    </g>
  )
  function accentBg() { return 'rgba(0,0,0,0.28)' }
}

// 母题:镜问——两个相对的对话气泡,一个提问一个映照(镜像式聆听),中间一点朱色
// 校准式问号(呼应「战术同理心」——先照见对方,再提问)。
function MirrorQuestion() {
  return (
    <g>
      <path d="M60,150 h90 v54 h-40 l-14,16 v-16 h-36 z" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.4" />
      <path d="M240,240 h-90 v-54 h40 l14,-16 v16 h36 z" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.4" />
      <line x1="150" y1="177" x2="150" y2="213" stroke={CREAM} strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 4" />
      <text x="105" y="184" textAnchor="middle" fontSize="15" fill={CREAM} fillOpacity="0.55" style={SERIF}>?</text>
      <circle cx="195" cy="210" r="7" fill={CINNABAR} />
    </g>
  )
}

// 母题:轻推——一颗小球停在岔路口,一道极细的箭头从旁轻轻一点(不是推倒,是助推)
// (呼应全书核心比喻:选择架构如何在不剥夺自由的前提下,轻轻引导人做出更好的选择)。
function GentleNudge() {
  return (
    <g>
      <path d="M150,120 L150,190" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.4" />
      <path d="M150,190 L90,270" fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1.4" />
      <path d="M150,190 L210,270" fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.8" />
      <circle cx="150" cy="190" r="12" fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.6" />
      <path d="M120,168 L142,184" stroke={CINNABAR} strokeWidth="2.4" />
      <polygon points="142,184 133,180 138,190" fill={CINNABAR} />
      <circle cx="210" cy="270" r="6" fill={CINNABAR} />
      <circle cx="90" cy="270" r="6" fill={CREAM} fillOpacity="0.4" />
    </g>
  )
}

// 母题:零到一——一枚圆环(0)与一道竖线(1)隔着一道火花对望
// (呼应全书主题:从无到有的创造,不是复制已存在的东西,是让不存在的东西破土而出)。
function ZeroToOne() {
  return (
    <g>
      <circle cx="108" cy="204" r="34" fill="none" stroke={CREAM} strokeOpacity="0.42" strokeWidth="3" />
      <line x1="192" y1="168" x2="192" y2="240" stroke={CINNABAR} strokeWidth="4" />
      <path d="M150,160 L160,180 M150,160 L140,180" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.6" />
      <circle cx="150" cy="204" r="3" fill={CREAM} fillOpacity="0.6" />
      <path d="M138,204 L162,204" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 4" />
    </g>
  )
}

// 母题:构建-测量-学习——三支箭首尾相连围成一个循环三角
// (呼应精益创业方法论的核心引擎:小步快跑、验证性学习、持续迭代)。
function BmlLoop() {
  const pts = [[150, 130], [214, 250], [86, 250]]
  return (
    <g>
      {pts.map((p, i) => {
        const q = pts[(i + 1) % 3]
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2
        return (
          <g key={i}>
            <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.6" />
            <circle cx={mx} cy={my} r={i === 0 ? 7 : 4.5} fill={i === 0 ? CINNABAR : CREAM} fillOpacity={i === 0 ? 1 : 0.5} />
          </g>
        )
      })}
      {pts.map((p, i) => <circle key={`n${i}`} cx={p[0]} cy={p[1]} r="5" fill={CREAM} fillOpacity="0.6" />)}
    </g>
  )
}

// 母题:安全边际——一座桥面与桥墩之间留出明显的冗余间隙,间隙处一道朱色标线
// (呼应格雷厄姆的核心概念:用足够宽的安全边际,抵御自己判断可能出现的误差)。
function SafetyMargin() {
  return (
    <g>
      <rect x="60" y="170" width="180" height="10" fill="none" stroke={CREAM} strokeOpacity="0.44" strokeWidth="1.6" />
      <rect x="80" y="196" width="16" height="70" fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.3" />
      <rect x="204" y="196" width="16" height="70" fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.3" />
      <line x1="96" y1="230" x2="204" y2="230" stroke={CINNABAR} strokeWidth="1.6" strokeDasharray="5 5" />
      <path d="M96,222 L96,238 M204,222 L204,238" stroke={CINNABAR} strokeWidth="1.6" />
      <text x="150" y="216" textAnchor="middle" fontSize="10" fill={CREAM} fillOpacity="0.55" style={SERIF}>margin</text>
    </g>
  )
}

export default function BookCover({ title = '', subtitle = '', author = '', accent = '#3f7d6e', motif, className }) {
  const columns = titleColumns(title)
  return (
    <svg viewBox="0 0 300 420" className={className} role="img" aria-label={`${title} · 封面`} preserveAspectRatio="xMidYMid meet">
      <rect width="300" height="420" fill={accent} />
      <rect width="300" height="205" fill="rgba(255,255,255,0.05)" />
      <Motif motif={motif} />
      <rect x="11" y="11" width="278" height="398" rx="4" fill="none" stroke={CREAM} strokeOpacity="0.28" strokeWidth="1" />
      {/* 朱印 */}
      <rect x="26" y="26" width="34" height="34" rx="6" fill={CINNABAR} />
      <text x="43" y="50.5" textAnchor="middle" fontSize="19" fill={CREAM} style={SERIF}>观</text>
      {/* 竖排书名(长名自动缩字/折两列) */}
      {columns.map((col, ci) => col.chars.map((c, i) => (
        <text key={`${ci}-${i}`} x={col.x} y={col.startY + i * col.step} textAnchor="middle" fontSize={col.fontSize} fill={CREAM} style={{ ...SERIF, fontWeight: 600 }}>{c}</text>
      )))}
      {/* 英文题 + 作者 */}
      {subtitle && <text x="27" y="384" fontSize="9.5" letterSpacing="1.6" fill={CREAM} fillOpacity="0.72" style={SERIF}>{subtitle.toUpperCase()}</text>}
      {author && <text x="27" y="400.5" fontSize="9.5" letterSpacing="1" fill={CREAM} fillOpacity="0.72" style={SERIF}>{author}</text>}
    </svg>
  )
}
