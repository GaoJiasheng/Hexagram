# 安卓端 · 执行计划(2026-08-17 定)

> **owner 拍板的两条边界**:
> ① **目标是「可安装的 APK」,不上 Google Play**(上架随时可另议,见 §5);
> ② **先走模拟器**,真机 owner 过两天搞到之后再补一轮走查。
>
> 总规划(为什么选 Capacitor、与 RN 的取舍)在 [mobile-app-plan.md](./mobile-app-plan.md),
> 本文只管**安卓这一条线怎么落地**。进度仍只记在 [todo.md](./todo.md)。

---

## 1. 现状:比 todo 里写的近

`docs/todo.md` 长期写着「需你本机装 Java + Android SDK」—— **SDK 那半是错的**,早装好了。
2026-08-17 实查:

| | 状态 |
|---|---|
| Android SDK | ✅ 已装:`platforms/{android-35,android-36}` · `build-tools/{35.0.0,36.0.0}` · `cmdline-tools/latest` |
| `@capacitor/android` | ✅ 已是依赖(8.4.1),与 ios 同版本 |
| 安全区 CSS | ✅ `env(safe-area-inset-*)` 已铺(安卓同样支持) |
| Capacitor 配置 | ✅ `capacitor.config.json`:appId `pub.gavin.hexa` · webDir `dist` |
| **JDK** | ❌ **没有 —— 唯一的硬阻塞** |
| Android Studio | ❌ 无(非必须;但**没它就没 AVD 管理器**,模拟器得用命令行建) |
| system-image / AVD | ❌ 无,要下(约 1–2 GB) |
| `android/` 原生工程 | ❌ 没跑过 `cap add android` |

**注意 SDK 里没有 Java** —— Android SDK 与 JDK 是两回事,装了前者不等于有后者。

---

## 2. 三个真正要写代码的地方

不是「把 iOS 那套复制一遍」就完事,安卓有它自己的三件事:

### ① 硬件返回键(最要紧)

安卓用户按返回键期望「回上一页」,**不处理就是直接退出 App**。
iOS 没有这个概念,所以现在代码里**一行都没有**(`grep backButton` 零命中)。

要接 `@capacitor/app` 的 `backButton` 事件,并与 React Router 的 history 对接:
- 有历史 → `navigate(-1)`
- 已在栈底(门户首页)→ 再按一次才退出(或直接 `App.exitApp()`,二选一)
- **抽屉/浮层打开时,返回键应先关浮层**(白话抽屉、搜索面板、设置浮层、每日一辩弹窗、
  注释气泡)—— 这些都 `createPortal` 到 body,不在路由里,返回键默认不认它们

### ② 观书的隐藏入口

`src/native/appShortcuts.js:7` 写死:

```js
if (!Capacitor?.isNativePlatform?.() || Capacitor.getPlatform() !== 'ios') return () => {}
```

安卓长按图标没有「书房」快捷方式。`@capawesome/capacitor-app-shortcuts` 支持安卓,
但图标资源与注册方式不同(安卓要 drawable + shortcuts.xml)。
**优先级低**,可放到 APK 出来之后再补。

### ③ 签名 keystore —— **丢了不可恢复**

安卓的签名密钥由**开发者自己生成并永久保管**。iOS 的证书丢了能让 Apple 重签,
**安卓不能**:keystore 一丢,这个 appId 就再也发不了更新(只能换包名重新上架)。

生成后必须:
- **备份到密码管理器或加密盘**,不是只躺在这台 Mac 上
- **绝不进 git**(本仓库是 PUBLIC 的)—— `.gitignore` 要先加 `*.keystore` / `*.jks`
- 口令与 keystore 分开存

---

## 3. 分阶段

| 阶段 | 内容 | 谁 | 需要 JDK? |
|---|---|---|---|
| **0** | 装 JDK 21 并配 `JAVA_HOME` | **owner** | — |
| 1 | `cap add android` 生成 `android/` 工程 | 我 | 否 |
| 2 | 返回键 + 浮层拦截 · 状态栏 · 启动屏 · 图标 | 我 | 否 |
| 3 | 下 system-image → 建 AVD → 模拟器走查 | 我 | **是** |
| 4 | keystore + 签名出 release APK | owner 签,我配 | **是** |
| — | *(真机走查:owner 拿到设备后补)* | 我+owner | 是 |

**阶段 1、2 现在就能做**(scaffold 与写代码不需要 JDK,只有**编译**才需要),
所以 owner 装 JDK 与我写代码可以并行。

### 阶段 0 的具体命令(owner 做)

```bash
brew install openjdk@21
```

装完按 brew 的提示配 `JAVA_HOME`(Capacitor 8 / AGP 8.x 要 **JDK 21**,别装 17 或 23)。
装好后 `java -version` 能打印出 21.x 即可。

---

## 4. 安卓与 iOS 已知会不一样的地方

走查时重点看这几处 —— **在浏览器和 iOS 上都验不出来**:

- **WebView 内核不同**:安卓是系统 WebView(版本随设备/厂商漂移),iOS 是 WKWebView。
  CSS 新特性(`content-visibility`、`color-mix`、`:has()`)在旧 WebView 上可能不支持。
  本站这几样用得不少。
- **字体**:安卓没有 iOS 那套中文衬线,`var(--font-serif)` 的回退链要单独看
  —— 金句卡与封面是 SVG 转 canvas,字体缺失会直接影响成品。
- **安全区**:安卓的挖孔屏/手势条与 iOS 刘海的 inset 值不同;部分设备 `env()` 返回 0。
- **返回手势**:安卓 10+ 的边缘返回手势会与站内的左右滑动翻页冲突(卦页有 `←→` 横滑)。
- **`@capacitor/splash-screen`**:安卓 12+ 的启动屏走系统 SplashScreen API,配置方式与 iOS 不同。

---

## 5. 不做的部分(owner 2026-08-17 定)

**Google Play 上架暂不做。** 出 APK 即收工。

日后若要上,记住这条(它是最大的时间黑洞):Google Play 对**个人开发者账号**要求
先做 **12 个测试员 × 连续 14 天**的封闭测试才允许申请正式发布($25 是一次性的,
但这 14 天与 12 个人凑不齐就卡住)。
⚠️ **这条政策改过几次,真要上之前先在 Play Console 里确认当前口径。**

所以「出 APK」几天能完,「上 Play」至少两周起 —— 两件事,别混为一谈。
