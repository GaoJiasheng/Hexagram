#!/bin/bash
# 观象 · 书桌 —— 全部典籍的插画(封面、题图、每章题头;Codex 出图),出完即导出到 public/desk/v1/art/。已有的图自动跳过。
#   scripts/desk/art-run-all.sh [每本并发,默认 3] [同时开几本,默认 1]
# 同时开几本:小书十来张图,只在书内并发的话每本收尾都在等最后一两张;多本同开才能把并发填满。
cd "$(dirname "$0")/../.."
export CONC="${1:-3}"
PAR="${2:-1}"
export STOP="scripts/.cache/desk-art/.paused"
rm -f "$STOP"
one() {
  b="$1"
  [ -f "$STOP" ] && exit 0
  echo "=== $b $(date +%m-%d\ %H:%M)"
  out=$(node scripts/desk/gen-art.mjs "$b" --kind all --concurrency "$CONC" 2>&1)
  echo "$b: $(echo "$out" | grep -E "共 |完成:" | tail -2 | tr '\n' ' ')"
  node scripts/desk/gen-art.mjs --export "$b" 2>&1 | tail -1
  # Codex 额度 / 限流:记一笔,其余各路不再开新书(已出的图都在,重跑本脚本即续)
  if echo "$out" | grep -qiE "usage limit|rate limit|quota|insufficient_quota|429"; then
    echo "=== 暂停:Codex 报额度或限流,停在 $b $(date +%m-%d\ %H:%M)"; echo "$b $(date +%m-%d\ %H:%M)" >> "$STOP"
  fi
}
export -f one
node -e "import('./scripts/desk/books.mjs').then(m=>console.log(m.DESK_BOOKS.map(b=>b.id).join('\n')))" | xargs -P "$PAR" -I{} bash -c 'one {}'
if [ -f "$STOP" ]; then echo "=== 已暂停:$(cat "$STOP" | tr '\n' ';')"; exit 75; fi
echo "=== 插画全部跑完 $(date +%m-%d\ %H:%M)"
