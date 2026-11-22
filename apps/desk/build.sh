#!/usr/bin/env bash
# 生成工程并编到模拟器:apps/desk/build.sh [模拟器 UDID]
set -euo pipefail; cd "$(dirname "$0")"
DD="${DESK_DD:-/tmp/desk-dd}"
xcodegen >/dev/null
xcodebuild -project Desk.xcodeproj -scheme Desk -destination "platform=iOS Simulator,id=${1:-45F9622F-46AC-4A20-800F-FA34AFE25DD5}" -derivedDataPath "$DD" build 2>&1 | grep -E 'error|BUILD' || true
echo "$DD/Build/Products/Debug-iphonesimulator/Desk.app"
