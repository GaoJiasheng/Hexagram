#!/usr/bin/env bash
# 观象 · 书桌:归档 → 导出 → 上传 App Store Connect(TestFlight)。照仓库根的 ship-ios.sh 的做法。
#
#   apps/desk/ship.sh            # 版本号取 project.yml 的 MARKETING_VERSION,构建号取当前时间(年月日时分,只增不减)
#   DESK_BUILD=7 apps/desk/ship.sh   # 指定构建号
#   DRY=1 apps/desk/ship.sh      # 只归档 + 导出,不上传
#
# 凭据:仓库根 .ios-ship.env(gitignore)里的 ASC_KEY_ID / ASC_ISSUER_ID / ASC_TEAM;
# .p8 在 ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8。本脚本只引用变量,不打印任何凭据。
#
# 前置(只有 owner 能做):App ID pub.gavin.hexa.desk 已勾 Sign in with Apple;App Store Connect 里已建这个 App 的记录;
# 服务端书桌接口与内容包已上生产(见 docs/desk-appstore.md §4)。上传成功后的 build 要在 App Store Connect 里手动加进
# TestFlight 测试组(scripts/tf-attach.mjs 写死的是观象 App 的 bundle id,不能直接用在这里)。
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

[ -f "$ROOT/.ios-ship.env" ] || { echo "✗ 缺 $ROOT/.ios-ship.env(ASC_KEY_ID / ASC_ISSUER_ID / ASC_TEAM)"; exit 1; }
# shellcheck disable=SC1091
source "$ROOT/.ios-ship.env"
: "${ASC_KEY_ID:?.ios-ship.env 里没有 ASC_KEY_ID}" "${ASC_ISSUER_ID:?.ios-ship.env 里没有 ASC_ISSUER_ID}" "${ASC_TEAM:?.ios-ship.env 里没有 ASC_TEAM}"
KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
[ -f "$KEY" ] || { echo "✗ 找不到 App Store Connect 的 .p8(~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8)"; exit 1; }
A=(-allowProvisioningUpdates -authenticationKeyPath "$KEY" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

VERSION=$(sed -n 's/^ *MARKETING_VERSION: *"\{0,1\}\([0-9.]*\)"\{0,1\}.*/\1/p' project.yml | head -1)
BUILD="${DESK_BUILD:-$(date +%Y%m%d%H%M)}"
[ -n "$VERSION" ] || { echo "✗ project.yml 里读不到 MARKETING_VERSION"; exit 1; }

# 图标另外在做:没放进 AppIcon.appiconset 的话 App Store 会拒收,先拦下
if ! ls Desk/Assets.xcassets/AppIcon.appiconset/*.png >/dev/null 2>&1; then
  echo "✗ AppIcon.appiconset 里还没有图标(1024×1024),上传会被拒。先放图标再发。"; exit 1
fi

WORK="${TMPDIR:-/tmp}/desk-ship"
ARCHIVE="$WORK/Desk.xcarchive"
EXPORT="$WORK/export"
rm -rf "$WORK"; mkdir -p "$WORK"

echo "▶ 生成工程(xcodegen)"
xcodegen >/dev/null

echo "▶ 归档 $VERSION ($BUILD) · Release"
xcodebuild -project Desk.xcodeproj -scheme Desk -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" archive "${A[@]}" \
  DEVELOPMENT_TEAM="$ASC_TEAM" CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" -quiet

# 发出去的包里不许有调试入口:Release 下这些字串都该被编译掉
BIN="$ARCHIVE/Products/Applications/Desk.app/Desk"
if strings "$BIN" | grep -qE 'localhost|DESK_DEMO|DESK_BASE|DESK_API|DESK_FAKESWITCH'; then
  echo "✗ Release 包里还有调试入口或 localhost,停下"; exit 1
fi
[ -f "$ARCHIVE/Products/Applications/Desk.app/PrivacyInfo.xcprivacy" ] || { echo "✗ 包里没有 PrivacyInfo.xcprivacy"; exit 1; }

echo "▶ 导出 .ipa"
cat > "$WORK/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${ASC_TEAM}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" -exportOptionsPlist "$WORK/ExportOptions.plist" "${A[@]}"
IPA=$(ls "$EXPORT"/*.ipa | head -1)
echo "  → $IPA"

if [ "${DRY:-0}" = "1" ]; then echo "✓ DRY=1:只归档导出,不上传"; exit 0; fi

echo "▶ 上传 App Store Connect"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
echo "✅ 已上传 $VERSION ($BUILD)。等 App Store Connect 处理完(VALID)后,在 TestFlight 里把这个 build 加进内部测试组。"
