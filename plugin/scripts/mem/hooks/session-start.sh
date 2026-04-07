#!/bin/bash
# fireauto-mem: 세션 시작 훅
# Worker 서버가 실행 중이 아니면 시작하고, 세션 초기화

WORKER_URL="http://localhost:37888"
MEM_DIR="$HOME/.fireauto-mem"
PID_FILE="$HOME/.fireauto-mem/worker.pid"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")")}"

# Worker 싱글턴 보장 — 이미 살아있으면 재사용
WORKER_ALIVE=false

# 1) PID 파일로 빠른 확인
if [ -f "$PID_FILE" ]; then
  STORED_PID=$(cat "$PID_FILE")
  if kill -0 "$STORED_PID" 2>/dev/null; then
    # 프로세스 살아있음 — health 체크
    if curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
      echo "[fireauto-mem] Worker 재사용 (PID $STORED_PID)" >&2
      WORKER_ALIVE=true
    fi
  fi
fi

# 2) PID 파일 없거나 stale → health 체크 fallback
if [ "$WORKER_ALIVE" = false ]; then
  if curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
    echo "[fireauto-mem] Worker 이미 실행 중 — 재사용" >&2
    WORKER_ALIVE=true
  fi
fi

# 3) Worker가 없으면 시작
if [ "$WORKER_ALIVE" = false ]; then
  echo "[fireauto-mem] Worker 시작 중..." >&2

  # 좀비 프로세스만 정리 (포트 점유하지만 health에 응답 안 하면 좀비)
  EXISTING_PID=$(lsof -ti:37888 2>/dev/null)
  if [ -n "$EXISTING_PID" ]; then
    echo "[fireauto-mem] 좀비 Worker(PID $EXISTING_PID) 정리" >&2
    kill -9 $EXISTING_PID 2>/dev/null
    sleep 0.5
  fi

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

PAYLOAD=$(node -e "console.log(JSON.stringify({session_id:process.argv[1],project:process.argv[2]}))" "$SESSION_ID" "$PROJECT")
curl -sf -X POST "$WORKER_URL/api/sessions/init" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /dev/null 2>&1

echo "[fireauto-mem] 세션 초기화 완료: $PROJECT" >&2
