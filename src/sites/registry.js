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
    portalDesc: '六十四卦 · 推演工作台 · 经传 · 学堂 · 筮例（全站唯一含推演的组）',
    home: '/',
    prefix: '',            // 默认站(无前缀),兜底
    accent: 'cinnabar',
    switchLabel: '易',
    hasSearch: true,
    searchKind: 'yijing',  // 搜索面板种类(缺省 corpus);驱动 App 挂哪个面板,免硬编码站名集

    nav: [
      { to: '/hexagrams', label: '六十四卦' },
      { to: '/workbench', label: '推演' },
      { to: '/classics', label: '经传' },
      { to: '/basics', label: '学堂' },
    ],
    mobileNav: [
      { to: '/', label: '首页', icon: '☰', exact: true },
      { to: '/hexagrams', label: '卦', icon: '☵', match: ['/hexagrams', '/hexagram/'] },
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
    hasSearch: true,
    searchKind: 'dao',
    nav: [{ to: '/dao', label: '经典' }],
    mobileNav: [{ to: '/dao', label: '经典', icon: '☱', exact: false }],
    mobileSwitch: true,
  },
  {
    key: 'fo',
    group: 'fo',           // 佛:独立单站组,与易道·儒互不可见
    brand: '观空',
    portalTitle: '释典研读',
    portalDesc: '心经 · 金刚经 · 坛经 · 四十二章经',
    home: '/fo',
    prefix: '/fo',
    accent: 'buddha',
    switchLabel: '佛',
    hasSearch: true,
    nav: [{ to: '/fo', label: '经典' }],
    mobileNav: [{ to: '/fo', label: '经典', icon: '☵', exact: false }],
    mobileSwitch: false,   // 单站组无可切换对象
  },
  {
    key: 'ru',
    group: 'ru',           // 儒:独立单站组
    brand: '观仁',
    portalTitle: '儒典研读',
    portalDesc: '论语 · 孟子 · 大学 · 中庸 · 孝经',
    home: '/ru',
    prefix: '/ru',
    accent: 'confucian',
    switchLabel: '儒',
    hasSearch: true,
    nav: [{ to: '/ru', label: '经典' }],
    mobileNav: [{ to: '/ru', label: '经典', icon: '☶', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'xin',
    group: 'xin',          // 心学(阳明):从儒拆出的独立单站组
    brand: '观心',
    portalTitle: '阳明心学',
    portalDesc: '传习录 · 致良知 · 知行合一',
    home: '/xin',
    prefix: '/xin',
    accent: 'xinxue',
    switchLabel: '心',
    hasSearch: true,
    nav: [{ to: '/xin', label: '经典' }],
    mobileNav: [{ to: '/xin', label: '经典', icon: '☲', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'fa',
    group: 'fa',           // 诸子各家各为独立组(同儒/佛/心),门户列为平级卡片,与他组两两零链接
    brand: '观法',
    portalTitle: '法家研读',
    portalDesc: '韩非子 · 商君书',
    home: '/fa',
    prefix: '/fa',
    accent: 'legalist',
    switchLabel: '法',
    hasSearch: true,
    nav: [{ to: '/fa', label: '经典' }],
    mobileNav: [{ to: '/fa', label: '经典', icon: '☰', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'mo',
    group: 'mo',
    brand: '观兼',
    portalTitle: '墨家研读',
    portalDesc: '墨子:兼爱 · 非攻 · 尚贤 · 天志',
    home: '/mo',
    prefix: '/mo',
    accent: 'mohist',
    switchLabel: '墨',
    hasSearch: true,
    nav: [{ to: '/mo', label: '经典' }],
    mobileNav: [{ to: '/mo', label: '经典', icon: '☵', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'bing',
    group: 'bing',
    brand: '观兵',
    portalTitle: '兵家研读',
    portalDesc: '孙子 · 吴子 · 司马法 · 尉缭子 · 三略',
    home: '/bing',
    prefix: '/bing',
    accent: 'military',
    switchLabel: '兵',
    hasSearch: true,
    nav: [{ to: '/bing', label: '经典' }],
    mobileNav: [{ to: '/bing', label: '经典', icon: '☶', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'zong',
    group: 'zong',
    brand: '观衡',
    portalTitle: '纵横研读',
    portalDesc: '鬼谷子 · 战国策选',
    home: '/zong',
    prefix: '/zong',
    accent: 'zongheng',
    switchLabel: '纵',
    hasSearch: true,
    nav: [{ to: '/zong', label: '经典' }],
    mobileNav: [{ to: '/zong', label: '经典', icon: '☴', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'zhongyi',
    group: 'zhongyi',      // 中医:独立单站组(v19)
    brand: '观和',
    portalTitle: '中医典籍',
    portalDesc: '黄帝内经 · 伤寒论 · 神农本草经',
    home: '/zhongyi',
    prefix: '/zhongyi',
    accent: 'zhongyi',
    switchLabel: '医',
    hasSearch: true,
    nav: [{ to: '/zhongyi', label: '经典' }],
    mobileNav: [{ to: '/zhongyi', label: '经典', icon: '☳', exact: false }],
    mobileSwitch: false,
  },
  {
    key: 'moulue',
    group: 'moulue',       // 谋略杂纂:独立单站组(v20),收《天下无谋》托名伪书,显著框注
    brand: '观谋',
    portalTitle: '谋略杂纂',
    portalDesc: '罗织经 · 小人经 · 权谋术 · 韬晦术 · 止学（托名·真伪存疑）',
    home: '/moulue',
    prefix: '/moulue',
    accent: 'moulue',
    switchLabel: '谋',
    hasSearch: true,
    nav: [{ to: '/moulue', label: '经典' }],
    mobileNav: [{ to: '/moulue', label: '经典', icon: '☷', exact: false }],
    mobileSwitch: false,
  },
]

export const SITE_MAP = Object.fromEntries(SITES.map(s => [s.key, s]))

// hostname → group 映射(v15 §1):配了真实域名即生效(域名着陆+硬隔离),localhost/未列按路径分组(dev)。
export const HOST_GROUPS = {
  'tao.gavingao.cn': 'yidao',
  'con.gavingao.cn': 'ru',
  'bud.gavingao.cn': 'fo',
}

// 诸学总门户路径:左上角 logo 全站可达的公开总入口,列全部分组(域名着陆对它豁免)。可改。
export const MASTER_PORTAL_PATH = '/hexagram'

// 按 prefix 最长匹配定当前站;无前缀者为默认兜底。
// 边界判断(=prefix 或 prefix+'/'):/foo 不再误命中 /fo,404 不套别组外壳。
export function siteForPath(pathname) {
  const matched = SITES
    .filter(s => s.prefix && (pathname === s.prefix || pathname.startsWith(s.prefix + '/')))
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

// 全部分组(去重,保 SITES 出场序)
export function allGroups() {
  return [...new Set(SITES.map(s => s.group))]
}

// 某组首页
export function groupHome(group) {
  const s = sitesInGroup(group)[0]
  return s ? s.home : '/'
}

// 三教门户的跨域入口:在配了 HOST_GROUPS 的生产域名上用绝对 URL 跨域;dev/未配置用相对路径
export function groupEntryHref(group, protocol, hostname) {
  if (HOST_GROUPS[hostname]) {
    const host = Object.keys(HOST_GROUPS).find(h => HOST_GROUPS[h] === group)
    if (host) return `${protocol}//${host}${groupHome(group)}`
  }
  return groupHome(group)
}

// 某具体站的入口(门户多站组每站各一可点入口用):同组各站共用本组域名,故拼 group 域名 + 站 home
export function siteEntryHref(site, protocol, hostname) {
  if (HOST_GROUPS[hostname]) {
    const host = Object.keys(HOST_GROUPS).find(h => HOST_GROUPS[h] === site.group)
    if (host) return `${protocol}//${host}${site.home}`
  }
  return site.home
}
