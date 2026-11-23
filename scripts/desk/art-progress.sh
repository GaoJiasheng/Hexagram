#!/bin/bash
# 观象 · 书桌 —— 插画进度一行报:两批各出了多少、近 3 / 10 分钟出图数、在跑的 Codex 路数、有没有暂停。
cd "$(dirname "$0")/../.."
C=scripts/.cache/desk-art
gs_total=$(find $C/books -name '*.ready.txt' | wc -l | tr -d ' ')
gs_left=$(find $C/books -name '*.ready.txt' | while read f; do [ -f "${f%.ready.txt}.png" ] || echo x; done | wc -l | tr -d ' ')
cl_total=$(find $C -name '*.ready.txt' -not -path '*/books/*' | wc -l | tr -d ' ')
cl_left=$(find $C -name '*.ready.txt' -not -path '*/books/*' | while read f; do [ -f "${f%.ready.txt}.png" ] || echo x; done | wc -l | tr -d ' ')
m3=$(find $C -name '*.png' -newermt "$(date -v-3M '+%Y-%m-%d %H:%M:%S')" | wc -l | tr -d ' ')
m10=$(find $C -name '*.png' -newermt "$(date -v-10M '+%Y-%m-%d %H:%M:%S')" | wc -l | tr -d ' ')
procs=$(pgrep -f 'codex exec --skip-git-repo-check.*desk-art' | wc -l | tr -d ' ')
gs_run=$(pgrep -f 'gen-art-guanshu.mjs --all' | wc -l | tr -d ' ')
cl_run=$(pgrep -f 'scripts/desk/art-run-all.sh' | wc -l | tr -d ' ')
echo "$(date +%H:%M) 观书 $((gs_total-gs_left))/$gs_total(差 $gs_left) · 典籍 $((cl_total-cl_left))/$cl_total(差 $cl_left) · 近3分 $m3 张 · 近10分 $m10 张 · Codex $procs 路 · 观书批 $([ $gs_run -gt 0 ] && echo 在跑 || echo 已停) · 典籍批 $([ $cl_run -gt 0 ] && echo 在跑 || echo 已停)"
echo "Codex 周额度已用 $(scripts/desk/codex-quota.sh)%(到 89% 自动停,给 owner 留一成)$([ -f scripts/.cache/codex-guard-stopped ] && echo " · 守卫已触发:$(cat scripts/.cache/codex-guard-stopped)")"
notes=$(pgrep -f 'node scripts/desk/notes-run-all' | wc -l | tr -d ' ')
[ "$notes" -gt 0 ] && echo "详注批 在跑:$(pgrep -fl 'node scripts/desk/notes-codex' | head -1 | cut -d' ' -f2- | cut -c1-80)"
[ -f $C/books/paused.json ] && echo "观书暂停:$(tr -s ' \n' ' ' < $C/books/paused.json | cut -c1-300)"
[ -f $C/.paused ] && echo "典籍暂停:$(tr '\n' ';' < $C/.paused)"
exit 0
