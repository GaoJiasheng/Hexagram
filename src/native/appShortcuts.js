// iOS「App 图标长按 → 书房」快捷入口 → 跳观书隐藏入口 /books。
// 仅 iOS 原生生效;web / Android 无操作(web 的隐藏入口仍是直接访问 /books URL,无站内链接)。
// 动态 import:Capacitor 与插件代码不进 web 主包,且非原生环境直接短路返回。
export async function registerBookShortcut(onClick) {
  let Capacitor
  try { ({ Capacitor } = await import('@capacitor/core')) } catch { return () => {} }
  if (!Capacitor?.isNativePlatform?.() || Capacitor.getPlatform() !== 'ios') return () => {}

  let AppShortcuts
  try { ({ AppShortcuts } = await import('@capawesome/capacitor-app-shortcuts')) } catch { return () => {} }

  // 25 = UIApplicationShortcutIcon.IconType.bookmark(书签图标,配「书房」)
  try {
    await AppShortcuts.set({
      shortcuts: [{ id: 'books', title: '书房', description: '观书 · 私人书房', iosIcon: 25 }],
    })
  } catch { /* 插件不可用时不影响 app */ }

  let handle
  try {
    handle = await AppShortcuts.addListener('click', (e) => { if (e?.shortcutId === 'books') onClick() })
  } catch { /* ignore */ }
  return () => { try { handle?.remove?.() } catch { /* ignore */ } }
}
