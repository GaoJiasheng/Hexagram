#!/usr/bin/env bash
# App Store 截图:iPhone 17 Pro Max(6.9 寸)与 iPad Air 13 寸各 9 张,浅色,状态栏 9:41 满电。
#   apps/desk/store-shots.sh            # 两台都出
#   apps/desk/store-shots.sh iphone     # 只出一台(iphone / ipad)
# 产物:apps/desk/store/shots/<device>/NN-name.png
#
# 用的是调试版的调试入口(DESK_DEMO / DESK_OPEN / DESK_HL / DESK_STATS …,只在 Debug 里有),样张数据全在本机造,
# 不登录、不连账号后端(DESK_API 指向一个不存在的端口)。内容包取本机静态服务:
#   cd <仓库>/public && python3 -m http.server 8765   (已在跑就不用再起)
# iPad 要先摆成正竖屏(Home 键 / 摄像头在上):simctl 截的是屏幕缓冲,倒过来放截出来也是倒的。
set -euo pipefail
cd "$(dirname "$0")"
OUT="$PWD/store/shots"
IPHONE=00701277-220E-4074-BCAF-245FE12A5253     # iPhone 17 Pro Max
IPAD=594DC144-3E22-45A2-ADA9-8EE066459490       # iPad Air 13-inch (M4)
BID=pub.gavin.hexa.desk
COMMON=(DESK_API=http://127.0.0.1:9/api DESK_TEXTSIZE=1)
SAMPLE="$(cd ../.. && pwd)/public/desk/standard/samples/sample-book.deskbook"

curl -sf -o /dev/null http://localhost:8765/desk/v1/manifest.json || { echo "✗ 本机内容包服务没起(localhost:8765)"; exit 1; }

echo "▶ 编调试版"
APP=$(./build.sh "$IPHONE" | tail -1)
[ -d "$APP" ] || { echo "✗ 没编出来"; exit 1; }

launch() {   # launch <udid> KEY=VAL…
  local u=$1; shift
  xcrun simctl terminate "$u" "$BID" >/dev/null 2>&1 || true
  local envs=(); for kv in "${COMMON[@]}" "$@"; do envs+=("SIMCTL_CHILD_$kv"); done
  env "${envs[@]}" xcrun simctl launch "$u" "$BID" >/dev/null
}

shoot() {    # shoot <udid> <dir> <NN-name> <等几秒> KEY=VAL…
  local u=$1 dir=$2 name=$3 wait=$4; shift 4
  launch "$u" "$@"
  sleep "$wait"
  xcrun simctl io "$u" screenshot "$dir/$name.png" >/dev/null 2>&1
  echo "  · $name"
}

run_device() {   # run_device <udid> <dir 名>
  local u=$1 dir="$OUT/$2"
  echo "▶ $2"
  xcrun simctl boot "$u" 2>/dev/null || true
  xcrun simctl bootstatus "$u" -b >/dev/null
  xcrun simctl ui "$u" appearance light
  xcrun simctl status_bar "$u" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100
  # 干净的一台:卸了重装(清掉上一轮的划线、进度、目标)
  xcrun simctl uninstall "$u" "$BID" >/dev/null 2>&1 || true
  xcrun simctl install "$u" "$APP"
  mkdir -p "$dir"; rm -f "$dir"/*.png
  # 先出不带统计种子的几张(统计种子会往划线里加几条示例),最后出首页与统计
  shoot "$u" "$dir" 07-highlights 9  DESK_DEMO=reader DESK_HL=1 DESK_MARKS=1
  shoot "$u" "$dir" 04-reader-note 8 DESK_DEMO=reader DESK_HL=1 DESK_OPEN=note
  shoot "$u" "$dir" 05-essay-figure 11 DESK_DEMO=reader DESK_OPEN=baihua DESK_BLOCK=14
  shoot "$u" "$dir" 06-zhouyi 9 DESK_DEMO=reader DESK_BOOK=yijing DESK_CH=1
  shoot "$u" "$dir" 03-bookhome 10 DESK_DEMO=home DESK_BOOK=zhuangzi
  shoot "$u" "$dir" 01-desk 10 DESK_DEMO=seed DESK_STATS=1 DESK_BOOK=zhuangzi
  shoot "$u" "$dir" 02-catalog 9 DESK_DEMO=seed DESK_BOOK=zhuangzi DESK_OPEN=catalog
  shoot "$u" "$dir" 09-stats 8 DESK_STATS=1 DESK_OPEN=stats
  # 最后一张:导入一本自己写的书(书包标准的公开示例《摆的道理》),看它的书首页
  shoot "$u" "$dir" 08-import 10 DESK_IMPORT="$SAMPLE" DESK_DEMO=home DESK_BOOK=u-pendulum-sample-5e1c2a90
  xcrun simctl terminate "$u" "$BID" >/dev/null 2>&1 || true
  xcrun simctl status_bar "$u" clear
}

case "${1:-all}" in
  iphone) run_device "$IPHONE" iphone-6.9 ;;
  ipad)   run_device "$IPAD" ipad-13 ;;
  *)      run_device "$IPHONE" iphone-6.9; run_device "$IPAD" ipad-13 ;;
esac
echo "✓ 截图在 $OUT"
