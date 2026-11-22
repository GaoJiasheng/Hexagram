#!/bin/bash
# 观象 · 书桌 —— 全部典籍的插画(封面、题图、每章题头;Codex 出图),一本一本来,出完即导出到 public/desk/v1/art/。已有的图自动跳过。
#   scripts/desk/art-run-all.sh [并发,默认 3]
cd "$(dirname "$0")/../.."
CONC="${1:-3}"
for b in $(node -e "import('./scripts/desk/books.mjs').then(m=>console.log(m.DESK_BOOKS.map(b=>b.id).join(' ')))"); do
  echo "=== $b $(date +%m-%d\ %H:%M)"
  out=$(node scripts/desk/gen-art.mjs "$b" --kind all --concurrency "$CONC" 2>&1)
  echo "$out" | grep -E "共 |完成:" | tail -2
  node scripts/desk/gen-art.mjs --export "$b" 2>&1 | tail -1
  # Codex 额度 / 限流:停下,不往后空转(已出的图都在,重跑本脚本即续)
  if echo "$out" | grep -qiE "usage limit|rate limit|quota|insufficient_quota|429"; then
    echo "=== 暂停:Codex 报额度或限流,停在 $b $(date +%m-%d\ %H:%M)"; exit 75
  fi
done
echo "=== 插画全部跑完 $(date +%m-%d\ %H:%M)"
