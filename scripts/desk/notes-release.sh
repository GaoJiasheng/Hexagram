#!/bin/bash
# 详注上线:只带详注(与随之重建的书桌内容包)发生产,不带尚未评审的新插画。
#   scripts/desk/notes-release.sh
# 步骤:把 public/desk/v1/art 里未入库的插画目录暂时挪开 → 版本号 +1 → 重建书桌包 → 测试 → 构建 → wrangler 发生产 → 核线上入口哈希 → 插画挪回 → IndexNow。
# 中途失败也会把插画挪回(trap)。提交 / 推送不在这里做。
set -o pipefail
cd "$(dirname "$0")/../.."
H=scripts/.cache/desk-art-hold
restore() { if [ -d "$H" ]; then for d in "$H"/*; do [ -e "$d" ] && mv "$d" public/desk/v1/art/; done; rmdir "$H" 2>/dev/null; fi; }
trap restore EXIT
mkdir -p "$H"
git status --short public/desk/v1/art | awk '$1=="??"{print $2}' | while read d; do mv "$d" "$H/$(basename "$d")"; done
echo "暂挪未入库插画目录 $(ls "$H" | wc -l | tr -d ' ') 个"
npm version patch --no-git-tag-version | tail -1 || exit 1
node scripts/build-desk-packs.mjs 2>&1 | tail -2 || exit 1
npm test 2>&1 | grep -E 'Tests|failed' | head -3
npm test >/dev/null 2>&1 || { echo "✗ 测试不过,停"; exit 1; }
npm run build 2>&1 | tail -1 || exit 1
npx --yes wrangler pages deploy dist --project-name=hexa-gavin-pub --commit-dirty=true 2>&1 | tail -1
want=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1)
for i in 1 2 3 4 5 6 7 8; do got=$(curl -s https://hexa.gavin.pub/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1); [ "$got" = "$want" ] && break; sleep 5; done
if [ "$got" = "$want" ]; then echo "✓ 线上入口一致:$got"; else echo "✗ 线上入口不一致:本地 $want / 线上 $got"; exit 1; fi
restore
npm run indexnow 2>&1 | tail -1
