#!/bin/bash
# fireauto-mem: 세션 시작 훅
# Worker 서버가 실행 중이 아니면 시작하고, 세션 초기화

WORKER_URL="http://localhost:37888"
MEM_DIR="$HOME/.fireauto-mem"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")")}"

# Worker 헬스 체크
if ! curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
  echo "[fireauto-mem] Worker 시작 중..." >&2

  # node_modules 경로 설정 — PLUGIN_DATA 우선, fallback으로 fireauto-mem
  PLUGIN_DATA_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/fireauto-imgompanda}"
  NODE_PATH="$PLUGIN_DATA_DIR/node_modules:$MEM_DIR/node_modules"
  DB_PATH="$PLUGIN_DATA_DIR/fireauto-mem.db"
  export NODE_PATH DB_PATH

  # Worker 백그라운드 시작
  node "$PLUGIN_ROOT/scripts/mem/worker.cjs" start &

  # 시작 대기 (최대 10초)
  for i in $(seq 1 20); do
    if curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
      echo "[fireauto-mem] Worker 준비됨" >&2
      break
    fi
    sleep 0.5
  done
fi

# 세션 초기화
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROJECT=$(basename "$(pwd)")

curl -sf -X POST "$WORKER_URL/api/sessions/init" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"project\":\"$PROJECT\"}" > /dev/null 2>&1

echo "[fireauto-mem] 세션 초기화 완료: $PROJECT" >&2
