// 母题:一只居中的浅盆 ——「意义共享池」。
// 两侧各有一堵墙:左边平整封闭(沉默),右边锯齿外张(暴力),
// 它们是人退出对话时倒向的两边,谁也没往池子里放东西。
// 上方两个小圆是对话的两个人,各有一道细流注入盆中;
// 水面那条朱线是安全感 —— 线在,东西才倒得进来;线一落,两个人就滑向两边的墙。
const CINNABAR = '#c3272b'

export default function PoolOfMeaning() {
  const cx = 150
  const bowlTop = 214 // 盆口
  const bowlBottom = 302 // 盆底
  const half = 78 // 盆口半宽
  const water = 246 // 水面

  // 盆:一段下凹的弧,像一只浅口陶盆
  const bowl = `M${cx - half},${bowlTop} Q${cx},${bowlBottom + 26} ${cx + half},${bowlTop}`
  // 水:盆内被水面截出的那一块
  const waterHalf = half * 0.78
  const waterArea = `M${cx - waterHalf},${water} Q${cx},${bowlBottom + 8} ${cx + waterHalf},${water} Z`

  return (
    <g>
      {/* 左墙:沉默 —— 平整、封闭、不留缝 */}
      <path d="M20,178 L64,178 L64,318 L20,318 Z" fill="rgba(0,0,0,0.30)" />
      <path d="M20,178 L64,178 L64,318 L20,318 Z" fill="rgba(255,255,255,0.06)" />

      {/* 右墙:暴力 —— 同样是一堵墙,只是朝外长着齿 */}
      <path
        d="M236,178 L280,178 L280,318 L236,318 L244,300 L236,282 L244,264 L236,246 L244,228 L236,210 L244,194 Z"
        fill="rgba(0,0,0,0.30)"
      />
      <path
        d="M236,178 L280,178 L280,318 L236,318 L244,300 L236,282 L244,264 L236,246 L244,228 L236,210 L244,194 Z"
        fill="rgba(255,255,255,0.06)"
      />

      {/* 两个人:各在一边,还没退到墙里去 */}
      <circle cx="104" cy="112" r="12" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.3" />
      <circle cx="196" cy="112" r="12" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.3" />

      {/* 两道细流:各自往同一只盆里倒 */}
      <path
        d="M104,126 C104,160 122,182 138,206"
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.2"
      />
      <path
        d="M196,126 C196,160 178,182 162,206"
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.2"
      />
      {/* 流里的几粒:观点、感受、经历 —— 倒进去就成了共有的 */}
      <circle cx="112" cy="152" r="2.2" fill="rgba(255,255,255,0.30)" />
      <circle cx="126" cy="184" r="1.8" fill="rgba(255,255,255,0.26)" />
      <circle cx="188" cy="152" r="2.2" fill="rgba(255,255,255,0.30)" />
      <circle cx="174" cy="184" r="1.8" fill="rgba(255,255,255,0.26)" />

      {/* 盆里的水 */}
      <path d={waterArea} fill="rgba(255,255,255,0.13)" />
      {/* 盆 */}
      <path d={bowl} fill="none" stroke="rgba(255,255,255,0.46)" strokeWidth="1.5" />
      <line
        x1={cx - half}
        y1={bowlTop}
        x2={cx + half}
        y2={bowlTop}
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="1"
        strokeDasharray="4 5"
      />

      {/* 水面:安全感那条线 —— 线在,东西才倒得进来 */}
      <line
        x1={cx - waterHalf - 12}
        y1={water}
        x2={cx + waterHalf + 12}
        y2={water}
        stroke={CINNABAR}
        strokeWidth="2"
        opacity="0.95"
      />
      <circle cx={cx} cy={water} r="3.4" fill={CINNABAR} opacity="0.95" />

      {/* 盆下的一道影 */}
      <line x1="86" y1="330" x2="214" y2="330" stroke="rgba(0,0,0,0.26)" strokeWidth="1.6" />
    </g>
  )
}
