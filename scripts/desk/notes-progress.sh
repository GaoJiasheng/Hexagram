#!/bin/bash
# 观象 · 书桌 —— 详注连跑的一行进度:在跑哪本、这本的单元做了几个、全站还差多少、Codex 额度。
cd "$(dirname "$0")/../.."
p=$(pgrep -fl 'node scripts/desk/notes-(codex|apply|prep)' | head -1 | cut -d' ' -f2-)
b=$(echo "$p" | awk '{print $3}')
stage=$(echo "$p" | grep -q -- '--verify' && echo 核查 || (echo "$p" | grep -q notes-codex && echo 起草 || echo 备料/入库))
d=scripts/.desk-notes/$(echo "$b" | sed 's/\//--/')
nin=$(ls $d/in 2>/dev/null | grep -c '^u'); nout=$(ls $d/out 2>/dev/null | grep -c '^u')
recent=$(find $d/out -name 'u*.json' -newermt "$(date -v-10M '+%Y-%m-%d %H:%M:%S')" 2>/dev/null | wc -l | tr -d ' ')
run=$(pgrep -f 'node scripts/desk/notes-run-all' | wc -l | tr -d ' ')
echo "$(date +%H:%M) 详注 $([ $run -gt 0 ] && echo 在跑 || echo 已停) · 当前 ${b:-无}($stage)单元 $nout/$nin · 近10分动了 $recent 个单元 · Codex $(pgrep -f 'codex exec --skip-git-repo-check.*desk-notes' | wc -l | tr -d ' ') 路 · 额度已用 $(scripts/desk/codex-quota.sh)%"
node scripts/desk/notes-run-all.mjs --list 2>/dev/null | grep '^共 '
[ -f scripts/.cache/codex-guard-stopped ] && echo "守卫已触发:$(cat scripts/.cache/codex-guard-stopped)"
exit 0
