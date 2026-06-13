// 站点清单(v14 §1)——分站平台的唯一注册点。
// 加一家新站:在 SITES 加一条 + CSS 加 [data-site="key"] 主色块 + 数据/内容 + 路由若干。平台代码无需改动。
// 模块间不互链,唯一切换点是门户(v4 §3);唯一例外是「桥」(v8)。

export const SITES = [
  {
    key: 'yijing',
    brand: '观象',
    portalTitle: '易经研习',
    portalDesc: '六十四卦 · 推演工作台 · 经传 · 学堂',
    home: '/',
    prefix: '',            // 默认站(无前缀),兜底
    accent: 'cinnabar',    // 默认朱砂,不覆盖
    switchLabel: '易',
    hasSearch: true,       // '/' 唤起全局搜索
    nav: [
      { to: '/hexagrams', label: '六十四卦' },
      { to: '/workbench', label: '推演' },
      { to: '/classics', label: '经传' },
      { to: '/basics', label: '学堂' },
    ],
    mobileNav: [
      { to: '/', label: '首页', icon: '☰', exact: true },
      { to: '/hexagrams', label: '卦', icon: '☵' },
      { to: '/workbench', label: '推演', icon: '☲' },
      { to: '/classics', label: '经传', icon: '☷' },
      { to: '/me', label: '我的', icon: '☶' },
    ],
    mobileSwitch: false,
  },
  {
    key: 'dao',
    brand: '观道',
    portalTitle: '道藏研读',
    portalDesc: '道德经 · 南华 · 丹道诸经',
    home: '/dao',
    prefix: '/dao',
    accent: 'azure',       // 玄青,[data-site="dao"] 覆盖 --cinnabar
    switchLabel: '道',
    hasSearch: false,
    nav: [
      { to: '/dao', label: '经典' },
    ],
    mobileNav: [
      { to: '/dao', label: '经典', icon: '☱', exact: false },
    ],
    mobileSwitch: true,
  },
]

export const SITE_MAP = Object.fromEntries(SITES.map(s => [s.key, s]))

// 按 prefix 最长匹配定当前站;无前缀者为默认兜底
export function siteForPath(pathname) {
  const matched = SITES
    .filter(s => s.prefix && pathname.startsWith(s.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)
  return matched[0] || SITES[0]
}
