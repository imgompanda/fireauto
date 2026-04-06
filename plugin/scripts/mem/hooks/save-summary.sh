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
SUMMARY_PAYLOAD=$(node -e "console.log(JSON.stringify({session_id:process.argv[1],project:process.argv[2],request:'',what_done:'',what_learned:'',next_steps:''}))" "$SESSION_ID" "$PROJECT")
curl -sf -X POST "$WORKER_URL/api/sessions/summarize" \
  -H "Content-Type: application/json" \
  -d "$SUMMARY_PAYLOAD" > /dev/null 2>&1

echo "[fireauto-mem] 세션 요약 저장됨" >&2

# 복기 실행 (Worker가 살아있을 때만)
RETRO_PAYLOAD=$(node -e "console.log(JSON.stringify({project:process.argv[1],session_id:process.argv[2]}))" "$PROJECT" "$SESSION_ID")
curl -sf -X POST "$WORKER_URL/api/retrospect" \
  -H "Content-Type: application/json" \
  -d "$RETRO_PAYLOAD" > /dev/null 2>&1

echo "[fireauto-mem] 세션 복기 완료" >&2
