// 母题:一句话的两种读法。钱穆《论语新解》的体例是「先列各家旧注,再断以己意」——
// 同一句《论语》,汉儒一种讲法、宋儒另一种讲法,他把分歧摆出来,再说自己取哪一种、
// 为什么。所以画两条自同一点分出的线,又在下方重新收拢:
// 分歧是真的,但不是无解的;收拢处那一点朱,是他下的判断。
const CINNABAR = '#c3272b'

export default function TwoReadings() {
  return (
    <g>
      {/* 同一句话 */}
      <circle cx="150" cy="130" r="5" fill="rgba(255,255,255,0.44)" />
      <path d="M150 100 L150 124" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {/* 两种旧注 */}
      <path d="M150 136 C112 168,94 200,90 240" stroke="rgba(255,255,255,0.26)" strokeWidth="1.4" fill="none" />
      <path d="M150 136 C188 168,206 200,210 240" stroke="rgba(255,255,255,0.26)" strokeWidth="1.4" fill="none" />
      <circle cx="90" cy="248" r="4" fill="rgba(255,255,255,0.30)" />
      <circle cx="210" cy="248" r="4" fill="rgba(255,255,255,0.30)" />
      {/* 再收拢 */}
      <path d="M90 256 C104 288,130 304,150 312" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" fill="none" />
      <path d="M210 256 C196 288,170 304,150 312" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" fill="none" />
      {/* 他下的判断 */}
      <circle cx="150" cy="320" r="12" fill={CINNABAR} opacity="0.15" />
      <circle cx="150" cy="320" r="4.8" fill={CINNABAR} opacity="0.94" />
    </g>
  )
}
