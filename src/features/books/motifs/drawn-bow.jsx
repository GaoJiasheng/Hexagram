// 母题:一张拉满而未发的弓。
// 弓臂是「势」——刚硬、成形、自己不会动;朱色的弦是「道」——只有绷在弓臂上才生出力量。
// 松开就没有弓,绷紧就永远受着劲:这正是《士与中国文化》全书那根弦——
// 士以道自任,却必须依附于势才能施展。弓又是「士」的旧身份(武士)所遗,
// 弦上那点朱是「弘毅」二字;箭不画,因为「任重而道远」,本来就没有射出去的那一刻。
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

const TOP = [112, 82] // 上弓梢
const BOT = [112, 338] // 下弓梢
const NOCK = [198, 210] // 扣弦处:被拉到的位置

export default function DrawnBow() {
  return (
    <g>
      {/* 弓臂:一道向左鼓出的弧——刚硬的「势」 */}
      <path
        d={`M${TOP[0]} ${TOP[1]} Q 50 210 ${BOT[0]} ${BOT[1]}`}
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.34"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* 弓臂内侧的一道亮边 */}
      <path
        d={`M${TOP[0]} ${TOP[1]} Q 56 210 ${BOT[0]} ${BOT[1]}`}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.6"
      />
      {/* 握把处的缠绕 */}
      {[196, 206, 216, 226].map((y, i) => (
        <line
          key={y}
          x1={58 + i * 0.4}
          y1={y}
          x2={72 + i * 0.4}
          y2={y - 2}
          stroke="rgba(0,0,0,0.30)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {/* 弦:被拉成两段绷直的朱线——只有系在弓臂两端才有力 */}
      <path
        d={`M${TOP[0]} ${TOP[1]} L${NOCK[0]} ${NOCK[1]} L${BOT[0]} ${BOT[1]}`}
        fill="none"
        stroke={CINNABAR}
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity="0.95"
      />
      {/* 未拉时弦的位置:一道虚线,量出这张弓被拉开了多少 */}
      <line
        x1={TOP[0]}
        y1={TOP[1]}
        x2={BOT[0]}
        y2={BOT[1]}
        stroke={CREAM}
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeDasharray="4 6"
      />

      {/* 扣弦的那一点 */}
      <circle cx={NOCK[0]} cy={NOCK[1]} r="5.4" fill={CINNABAR} opacity="0.95" />
      <circle cx={NOCK[0]} cy={NOCK[1]} r="11" fill="none" stroke={CINNABAR} strokeWidth="1" opacity="0.45" />

      {/* 所指的方向:虚而不发 */}
      <line
        x1={NOCK[0] + 20}
        y1={NOCK[1]}
        x2="278"
        y2={NOCK[1]}
        stroke={CREAM}
        strokeOpacity="0.22"
        strokeWidth="1.1"
        strokeDasharray="2 9"
      />

      {/* 地平线与底部阴影:这张弓始终在人世间被拉着 */}
      <line x1="0" y1="372" x2="300" y2="372" stroke="rgba(0,0,0,0.26)" strokeWidth="1.2" />
      <path d="M0 372 H300 V420 H0 Z" fill="rgba(0,0,0,0.16)" />
    </g>
  )
}
