#!/usr/bin/env bash
# 一键发 iOS 到 TestFlight:bump build → 构建 → 归档 → 导出 → 上传(API key 免密)。
# 凭据从 .ios-ship.env(gitignore)读。前置:.p8 在 ~/.appstoreconnect/private_keys/
set -euo pipefail; cd "$(dirname "$0")"; source .ios-ship.env
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
A=(-allowProvisioningUpdates -authenticationKeyPath "$KEY" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
echo "▶ bump build 号"; (cd ios/App && xcrun agvtool next-version -all >/dev/null)
echo "▶ 构建 web(原生档)+ sync"; npm run build:cap >/dev/null && npx cap sync ios >/dev/null
echo "▶ 归档"; rm -rf /tmp/Hexa.xcarchive
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath /tmp/Hexa.xcarchive archive "${A[@]}" DEVELOPMENT_TEAM="$ASC_TEAM" CODE_SIGN_STYLE=Automatic -quiet
echo "▶ 导出 .ipa"; rm -rf /tmp/HexaExport
xcodebuild -exportArchive -archivePath /tmp/Hexa.xcarchive -exportPath /tmp/HexaExport -exportOptionsPlist ios/ExportOptions.plist "${A[@]}"
echo "▶ 上传"; xcrun altool --upload-app -f /tmp/HexaExport/App.ipa -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
echo "✅ 已上传 → 轮询处理完后自动加入内部测试组(否则 build VALID 也看不到/装不了)"
echo "▶ 加内部测试组"; node scripts/tf-attach.mjs || echo "⚠ 自动加组失败,稍后手动:node scripts/tf-attach.mjs <build号>"
