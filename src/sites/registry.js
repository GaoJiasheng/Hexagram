// 站点清单(v14 §1;v15:分组隔离)——分站平台的唯一注册点。
// 加一家新站:在 SITES 加一条 + CSS 加 [data-site="key"] 主色块 + 数据/内容 + 路由若干。平台代码无需改动。
// 分组(group):门户只列「当前站所属组」内的站 → 跨组零可见链接(v15 §0–§1)。
// 站间不互链,唯一切换点是门户(v4 §3);唯一例外是「桥」(v8,易道组内)。

export const SITES = [
  {
    key: 'yijing',
    group: 'yidao',        // 易+道 同组,门户互切
    brand: '观象',
    portalTitle: '易经研习',
    portalDesc: '六十四卦 · 推演工作台 · 经传 · 学堂',
    home: '/',
    prefix: '',            // 默认站(无前缀),兜底
    accent: 'cinnabar',
    switchLabel: '易',
    hasSearch: true,
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
    group: 'yidao',
    brand: '观道',
    portalTitle: '道藏研读',
    portalDesc: '道德经 · 南华 · 丹道诸经',
    home: '/dao',
    prefix: '/dao',
    accent: 'azure',
    switchLabel: '道',
    hasSearch: false,
    nav: [{ to: '/dao', label: '经典' }],
    mobileNav: [{ to: '/dao', label: '经典', icon: '☱', exact: false }],
    mobileSwitch: true,
  },
  {
    key: 'fo',
    group: 'fo',           // 佛:独立单站组,与易道·儒互不可见
    brand: '观空',         // 暂定
    portalTitle: '释典研读',
    portalDesc: '心经 · 金刚经 · 坛经（整理中）',
    home: '/fo',
    prefix: '/fo',
    accent: 'buddha',
    switchLabel: '佛',
    hasSearch: false,
    nav: [{ to: '/fo', label: '经典' }],
    mobileNav: [{ to: '/fo', label: '经典', icon: '☵', exact: false }],
    mobileSwitch: false,   // 单站组无可切换对象
  },
  {
    key: 'ru',
    group: 'ru',           // 儒:独立单站组
    brand: '观仁',         // 暂定
    portalTitle: '儒典研读',
    portalDesc: '论语 · 孟子 · 大学 · 中庸（整理中）',
    home: '/ru',
    prefix: '/ru',
    accent: 'confucian',
    switchLabel: '儒',
    hasSearch: false,
    nav: [{ to: '/ru', label: '经典' }],
    mobileNav: [{ to: '/ru', label: '经典', icon: '☶', exact: false }],
    mobileSwitch: false,
  },
]

export const SITE_MAP = Object.fromEntries(SITES.map(s => [s.key, s]))

// hostname → group 映射(v15 §1):用户填真实域名即生效;留空则按路径分组(dev/主域名)。
// 例:'fo.example.com': 'fo', 'ru.example.com': 'ru'
export const HOST_GROUPS = {}

// 按 prefix 最长匹配定当前站;无前缀者为默认兜底
export function siteForPath(pathname) {
  const matched = SITES
    .filter(s => s.prefix && pathname.startsWith(s.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)
  return matched[0] || SITES[0]
}

// 当前激活分组:域名优先(HOST_GROUPS),路径兜底(当前站所属组)
export function activeGroup(pathname, hostname) {
  return HOST_GROUPS[hostname] || siteForPath(pathname).group
}

// 某组内的站(门户与切换按钮的数据源)
export function sitesInGroup(group) {
  return SITES.filter(s => s.group === group)
}
