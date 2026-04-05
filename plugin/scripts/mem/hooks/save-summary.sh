#!/bin/bash
# fireauto-mem: 세션 종료 요약 훅
# 세션 종료 시 요약 정보를 Worker에 전송

WORKER_URL="http://localhost:37888"

# Worker가 응답하지 않으면 조용히 종료
if ! curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
  exit 0
fi

SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROJECT=$(basename "$(pwd)")

# stdin에서 세션 정보 읽기 (있으면)
INPUT=$(cat 2>/dev/null || echo '{}')

# 세션 요약 전송
curl -sf -X POST "$WORKER_URL/api/sessions/summarize" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\":\"$SESSION_ID\",
    \"project\":\"$PROJECT\",
    \"request\":\"\",
    \"what_done\":\"\",
    \"what_learned\":\"\",
    \"next_steps\":\"\"
  }" > /dev/null 2>&1

echo "[fireauto-mem] 세션 요약 저장됨" >&2
