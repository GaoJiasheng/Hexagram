#!/bin/bash
# 读 Codex 本周额度已用百分比(取最近一个会话记录里的 rate_limits.primary.used_percent)。读不到输出 ?。
#   scripts/desk/codex-quota.sh            → 37.0
#   scripts/desk/codex-quota.sh --guard 89 → 每分钟读一次,到线即停掉本仓库的所有 Codex 批(插画、详注)并退出
quota() {
  for f in $(find ~/.codex/sessions -name '*.jsonl' -mmin -30 2>/dev/null | xargs ls -t 2>/dev/null | head -80); do
    v=$(grep -o '"primary":{"used_percent":[0-9.]*' "$f" | tail -1 | grep -o '[0-9.]*$')
    [ -n "$v" ] && { echo "$v"; return; }
  done
  echo "?"
}
if [ "$1" = "--guard" ]; then
  LINE="${2:-89}"
  cd "$(dirname "$0")/../.."
  while :; do
    u=$(quota)
    if [ "$u" != "?" ] && [ "$(echo "$u >= $LINE" | bc)" = "1" ]; then
      echo "$(date '+%m-%d %H:%M') Codex 周额度已用 $u%,到 $LINE% 线,停掉各批"
      echo "$(date '+%m-%d %H:%M') used=$u line=$LINE" > scripts/.cache/codex-guard-stopped
      pkill -TERM -f 'scripts/desk/art-run-all.sh'; pkill -TERM -f 'xargs -P'; pkill -TERM -f 'bash -c one '
      pkill -TERM -f 'node scripts/desk/gen-art'; pkill -TERM -f 'node scripts/desk/notes-run-all'; pkill -TERM -f 'node scripts/desk/notes-codex'
      sleep 1
      pkill -TERM -f 'codex exec --skip-git-repo-check.*(desk-art|desk-notes)'
      exit 0
    fi
    sleep 60
  done
fi
quota
