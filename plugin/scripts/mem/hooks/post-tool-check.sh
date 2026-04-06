#!/bin/bash
# fireauto-mem: 도구 사용 후 패턴 감지 + CLAUDE.md 관리
WORKER_URL="http://localhost:37888"

# Worker가 안 돌면 종료
curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1 || exit 0

PROJECT=$(basename "$(pwd)")
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")")}"

# CLAUDE.md 80줄 체크 (프로젝트 로컬 + 글로벌 둘 다)
for CLAUDE_MD in ".claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"; do
  if [ -f "$CLAUDE_MD" ]; then
    LINE_COUNT=$(wc -l < "$CLAUDE_MD")
    if [ "$LINE_COUNT" -gt 80 ]; then
      TARGET_DIR=$(dirname "$CLAUDE_MD")
      NODE_PATH="${CLAUDE_PLUGIN_DATA:-$HOME/.fireauto-mem}/node_modules" \
      node -e "
        try{
          const gen=require('$PLUGIN_ROOT/scripts/mem/claude-md-generator.cjs');
          gen.trimClaudeMd('$TARGET_DIR/..',80);
          console.error('[fireauto] $CLAUDE_MD ${LINE_COUNT}줄 → 80줄 트리밍');
        }catch(e){console.error('[fireauto] trim 실패:',e.message);}
      " 2>&2
    fi
  fi
done

# 반복 패턴 감지 (3번째 도구 사용마다 체크 — 3회 이상이면 반복으로 간주)
COUNTER_FILE="/tmp/fireauto-tool-counter"
COUNT=0
[ -f "$COUNTER_FILE" ] && COUNT=$(cat "$COUNTER_FILE")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

if [ $((COUNT % 3)) -eq 0 ]; then
  NODE_PATH="${CLAUDE_PLUGIN_DATA:-$HOME/.fireauto-mem}/node_modules" \
  node -e "
    try{
      const sl=require('$PLUGIN_ROOT/scripts/mem/self-learner.cjs');
      const {initDb}=require('$PLUGIN_ROOT/scripts/mem/db.cjs');
      (async()=>{
        const db=await initDb(process.env.DB_PATH||'$HOME/.fireauto-mem/fireauto-mem.db');
        const candidates=sl.detectRepetitivePatterns(db,'$PROJECT');
        if(candidates&&candidates.length>0){
          console.error('[fireauto] 반복 패턴 '+candidates.length+'건 감지 — 스킬 생성 후보');
        }
      })();
    }catch{}
  " 2>&2
fi

exit 0
