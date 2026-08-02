// 母题:一粒麦子落进地里。《卡拉马佐夫兄弟》的题词就是《约翰福音》那句
// 「一粒麦子不落在地里死了，仍旧是一粒；若是死了，就结出许多子粒来」——
// 陀氏亲选，也刻在他墓碑上。上方是正在坠落的那一粒(朱),地平线以下是埋着的它,
// 向上抽出的穗与散开的子粒,即德米特里、佐西马、伊柳沙、阿廖沙各演了一遍的那件事。
const CINNABAR = '#c3272b'

export default function GrainOfWheat() {
  const seeds = [
    [96, 176], [128, 150], [150, 132], [172, 148], [204, 174],
    [112, 206], [188, 204], [150, 190],
  ]
  return (
    <g>
      {/* 坠落的那一粒 + 落痕 */}
      <path d="M150 52 L150 96" stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" />
      <ellipse cx="150" cy="104" rx="7" ry="11" fill={CINNABAR} opacity="0.92" />

      {/* 地平线 */}
      <path d="M36 262 L212 262" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" fill="none" />
      {/* 埋在地里的那一粒 */}
      <ellipse cx="150" cy="286" rx="6.5" ry="10" fill="rgba(0,0,0,0.35)" />
      <path d="M150 276 L150 262" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />
      {/* 地下的根 */}
      <path d="M150 296 L140 320 M150 296 L160 322 M150 296 L150 330"
        stroke="rgba(0,0,0,0.28)" strokeWidth="1.1" fill="none" />

      {/* 从落点向上抽出的许多茎 */}
      <path d="M150 262 C138 236,120 214,96 184" stroke="rgba(255,255,255,0.16)" strokeWidth="1.1" fill="none" />
      <path d="M150 262 C144 232,138 198,128 158" stroke="rgba(255,255,255,0.16)" strokeWidth="1.1" fill="none" />
      <path d="M150 262 C150 226,150 180,150 140" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2" fill="none" />
      <path d="M150 262 C156 232,162 198,172 156" stroke="rgba(255,255,255,0.16)" strokeWidth="1.1" fill="none" />
      <path d="M150 262 C162 236,180 214,204 182" stroke="rgba(255,255,255,0.16)" strokeWidth="1.1" fill="none" />

      {/* 结出的许多子粒 */}
      {seeds.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3.6" ry="5.6"
          fill={i === 2 ? CINNABAR : 'rgba(255,255,255,0.30)'} opacity={i === 2 ? 0.8 : 1} />
      ))}
    </g>
  )
}
