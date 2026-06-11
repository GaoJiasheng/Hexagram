// 十二消息卦常量
// 阳息：复→临→泰→大壮→夬→乾（每卦比前多一阳，自下而上）
// 阴消：姤→遯→否→观→剥→坤（每卦比前多一阴，自下而上）

export const XIAOXI_SEQUENCE = [
  { id: 24, name: '复',  binary: '100000', yinYang: '阳', yaoCount: 1, month: '十一月', zhi: '子', jieqi: '冬至' },
  { id: 19, name: '临',  binary: '110000', yinYang: '阳', yaoCount: 2, month: '十二月', zhi: '丑', jieqi: '大寒' },
  { id: 11, name: '泰',  binary: '111000', yinYang: '阳', yaoCount: 3, month: '正月',   zhi: '寅', jieqi: '雨水' },
  { id: 34, name: '大壮', binary: '111100', yinYang: '阳', yaoCount: 4, month: '二月',   zhi: '卯', jieqi: '春分' },
  { id: 43, name: '夬',  binary: '111110', yinYang: '阳', yaoCount: 5, month: '三月',   zhi: '辰', jieqi: '谷雨' },
  { id:  1, name: '乾',  binary: '111111', yinYang: '阳', yaoCount: 6, month: '四月',   zhi: '巳', jieqi: '小满' },
  { id: 44, name: '姤',  binary: '011111', yinYang: '阴', yaoCount: 1, month: '五月',   zhi: '午', jieqi: '夏至' },
  { id: 33, name: '遯',  binary: '001111', yinYang: '阴', yaoCount: 2, month: '六月',   zhi: '未', jieqi: '大暑' },
  { id: 12, name: '否',  binary: '000111', yinYang: '阴', yaoCount: 3, month: '七月',   zhi: '申', jieqi: '处暑' },
  { id: 20, name: '观',  binary: '000011', yinYang: '阴', yaoCount: 4, month: '八月',   zhi: '酉', jieqi: '秋分' },
  { id: 23, name: '剥',  binary: '000001', yinYang: '阴', yaoCount: 5, month: '九月',   zhi: '戌', jieqi: '霜降' },
  { id:  2, name: '坤',  binary: '000000', yinYang: '阴', yaoCount: 6, month: '十月',   zhi: '亥', jieqi: '小雪' },
]
