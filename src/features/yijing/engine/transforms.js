// 卦变四法 — binary 格式: 6位字符串, 自下而上(下标0=初爻), '1'=阳 '0'=阴

export function getBianGua(binary, movingLines) {
  const arr = binary.split('')
  for (const pos of movingLines) {
    const i = pos - 1 // pos 是 1-indexed
    arr[i] = arr[i] === '1' ? '0' : '1'
  }
  return arr.join('')
}

export function getHuGua(binary) {
  // 互卦: 2,3,4爻为下卦; 3,4,5爻为上卦 (1-indexed → indices 1,2,3 和 2,3,4)
  return binary[1] + binary[2] + binary[3] + binary[2] + binary[3] + binary[4]
}

export function getCuoGua(binary) {
  return binary.split('').map(c => (c === '1' ? '0' : '1')).join('')
}

export function getZongGua(binary) {
  return binary.split('').reverse().join('')
}

export function lineTitle(pos, isYang) {
  const num = isYang ? '九' : '六'
  if (pos === 1) return '初' + num
  if (pos === 6) return '上' + num
  return num + ['', '', '二', '三', '四', '五'][pos]
}
