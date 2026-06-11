// 今日一卦 — djb2 hash of "YYYY-MM-DD" % 64 + 1, 同一天恒定

function djb2(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  }
  return h
}

export function getTodayHexagramId(dateStr) {
  // dateStr: "YYYY-MM-DD"
  return (djb2(dateStr) % 64) + 1
}

export function getDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
