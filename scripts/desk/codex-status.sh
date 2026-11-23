#!/bin/bash
# Codex 三条线的进度一览(插画两条 + 详注):随时可跑,只读
cd "$(dirname "$0")/../.."
echo "== 观书插画"; node scripts/desk/gen-art-guanshu.mjs --status 2>/dev/null | tail -2
echo "== 典籍插画(已出 png / 现成 prompt)"; echo "$(find scripts/.cache/desk-art -maxdepth 2 -name '*.png' -not -path '*/books/*' -not -path '*/icon/*' -not -path '*/samples/*' | wc -l | tr -d ' ') 张已出 · $(find scripts/.cache/desk-art -maxdepth 2 -name '*.ready.txt' -not -path '*/books/*' | wc -l | tr -d ' ') 张有现成 prompt"
echo "== 详注"; node scripts/desk/notes-run-all.mjs --list 2>/dev/null | tail -2 | head -1
echo "== 在跑的进程"; ps -axo command= | grep -E "^node scripts/desk/(gen-art|notes-run-all|notes-codex)|^/bin/bash scripts/desk/art-run-all" | cut -c1-90
