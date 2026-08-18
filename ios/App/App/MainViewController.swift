import UIKit
import Capacitor

/// 打开 WKWebView 自带的左边缘右滑返回手势。
///
/// 安卓那边这个能力是白来的:系统边缘手势会触发 `backButton` 事件,
/// 而 src/native/backButton.js 把它变成了 navigate(-1)。iOS 没有对应机制 ——
/// WKWebView 有 `allowsBackForwardNavigationGestures`,但 **Capacitor 默认不开**,
/// 也没有暴露成 capacitor.config 的开关(在 @capacitor/ios 里 grep 零命中)。
/// 所以只能子类化 CAPBridgeViewController,自己打开。
///
/// 为什么走原生而不在 JS 里自己实现手势:
/// 站内卦页有「左右横滑翻上一卦/下一卦」(HexagramDetailPage 的 window 级 touch 处理器,
/// 右滑 = 上一卦)。JS 方案必须自己划出边缘区并让翻页手势跳过它,两套手势容易打架;
/// 交给系统则由系统在边缘区先截走触摸,页面的处理器根本收不到 —— 安卓实测就是这样,
/// 边缘右滑=返回、屏幕中间右滑=翻页,互不干扰。
///
/// ⚠️ 它走的是 **WebView 的历史**,而本站是 SPA(history.pushState),
/// 两者是同一份历史,所以能对上。
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
