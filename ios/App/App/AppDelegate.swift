import UIKit
import Capacitor

// AppShortcuts 插件的通知契约(见 @capawesome/capacitor-app-shortcuts 的 AppShortcutsPlugin:
// notificationName / userInfoShortcutItemKey)。直接用字符串常量,免 import 插件模块(SPM 模块名歧义)。
private let appShortcutNotificationName = "handleAppShortcutNotification"
private let appShortcutItemKey = "shortcutItem"

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // App 图标长按快捷入口「书房」:冷启动(app 未在运行)时,把 shortcut 交给 AppShortcuts 插件。
        // 插件用 retainUntilConsumed 缓存 click 事件,直到 JS 端 addListener 就绪再投递 → navigate('/books')。
        if let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            NotificationCenter.default.post(name: NSNotification.Name(appShortcutNotificationName), object: nil, userInfo: [appShortcutItemKey: shortcutItem])
            return true
        }
        return true
    }

    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        // App 图标长按快捷入口「书房」:热启动(app 在后台)时,把 shortcut 交给 AppShortcuts 插件。
        NotificationCenter.default.post(name: NSNotification.Name(appShortcutNotificationName), object: nil, userInfo: [appShortcutItemKey: shortcutItem])
        completionHandler(true)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
