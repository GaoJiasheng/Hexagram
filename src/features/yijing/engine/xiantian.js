// 先天(伏羲)方圆图引擎(v10 §5)——纯函数,规则见设计稿规则表
// binary 一律自下而上(下标 0 = 初爻),全项目约定

// 先天卦数(三爻卦):乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
// = 8 - (初爻×4 + 二爻×2 + 三爻×1)
export function xiantianNum(trigramBinary) {
  return 8 - (Number(trigramBinary[0]) * 4 + Number(trigramBinary[1]) * 2 + Number(trigramBinary[2]))
}

// 先天六十四卦次序(邵雍次序):乾1 夬2 大有3 … 复32 | 姤33 … 坤64
// = 64 - Σ 爻i × 2^(6-i)(初爻权 32 … 上爻权 1)
export function xiantianIndex(binary) {
  let v = 0
  for (let i = 0; i < 6; i++) v += Number(binary[i]) * 2 ** (5 - i)
  return 64 - v
}

// 圆图布列:上南下北、左东右西;每槽 5.625°
// 阳半(1–32 乾…复)居东半环,自正上方逆时针;阴半(33–64 姤…坤)居西半环,自正上方顺时针
// 返回自正上方起、顺时针为正的有向角(度):乾 -2.8125,姤 +2.8125,复 -177.1875,坤 +177.1875
export function circleAngle(binary) {
  const n = xiantianIndex(binary)
  if (n <= 32) return -(n - 0.5) * 5.625
  return (n - 32 - 0.5) * 5.625
}

// 方图布列:行 = 下卦先天数(自下而上 1–8),列 = 上卦先天数(自右向左 1–8)
// 乾(1,1)右下角,坤(8,8)左上角,对角线为八纯卦
export function squarePos(binary) {
  return { row: xiantianNum(binary.slice(0, 3)), col: xiantianNum(binary.slice(3)) }
}
