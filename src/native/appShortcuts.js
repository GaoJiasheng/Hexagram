// 「App 图标长按 → 书房」快捷入口 → 跳观书隐藏入口 /books。
// **iOS 与安卓都生效**(安卓 2026-08-17 补;原先写死 `!== 'ios'` 直接返回);
// web 无操作 —— 那边的隐藏入口仍是直接访问 /books URL,站内不给任何链接。
// 动态 import:Capacitor 与插件代码不进 web 主包,且非原生环境直接短路返回。
export async function registerBookShortcut(onClick) {
  let Capacitor
  try { ({ Capacitor } = await import('@capacitor/core')) } catch { return () => {} }
  if (!Capacitor?.isNativePlatform?.()) return () => {}

  let AppShortcuts
  try { ({ AppShortcuts } = await import('@capawesome/capacitor-app-shortcuts')) } catch { return () => {} }

  // iosIcon 25 = UIApplicationShortcutIcon.IconType.bookmark(书签图标,配「书房」)。
  // 安卓不吃这个枚举,得给一张 drawable;没给就用 App 自己的图标(不会报错)。
  // 两个平台各自忽略对方那个字段,故同一份配置可以都传。
  try {
    await AppShortcuts.set({
      shortcuts: [{
        id: 'books',
        title: '书房',
        description: '观书 · 私人书房',
        iosIcon: 25,
        androidIcon: 'ic_launcher_foreground',
      }],
    })
  } catch { /* 插件不可用时不影响 app */ }

  let handle
  try {
    handle = await AppShortcuts.addListener('click', (e) => { if (e?.shortcutId === 'books') onClick() })
  } catch { /* ignore */ }
  return () => { try { handle?.remove?.() } catch { /* ignore */ } }
}
