#!/bin/bash
# 观象 · 书桌 —— 全部典籍的白话图解转结构化(Codex),一本一本来:prep → codex → apply。已转的图自动跳过,可随时重跑。
#   scripts/desk/figs-run-all.sh [并发,默认 4]
cd "$(dirname "$0")/../.."
CONC="${1:-4}"
for b in $(node -e "import('./scripts/desk/books.mjs').then(m=>console.log(m.DESK_BOOKS.map(b=>b.id).join(' ')))"); do
  left=$(node scripts/desk/figs-prep.mjs "$b" 2>/dev/null | sed -n 's/.*待转 \([0-9]*\) 张.*/\1/p' | tail -1)
  [ -z "$left" ] || [ "$left" = "0" ] && continue
  echo "=== $b 待转 $left 张 $(date +%m-%d\ %H:%M)"
  node scripts/desk/figs-codex.mjs "$b" --concurrency "$CONC" --force 2>&1 | grep -E "单元成功|未过闸" | tail -2
  node scripts/desk/figs-apply.mjs "$b" | tail -1
done
echo "=== 图解全部跑完 $(date +%m-%d\ %H:%M)"
