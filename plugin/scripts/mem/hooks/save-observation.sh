#!/bin/bash
# fireauto-mem: 도구 사용 관찰 훅
# 의미 있는 작업만 선별하여 Worker��� 전송

WORKER_URL="http://localhost:37888"

# stdin에서 전체 JSON 읽기
INPUT=$(cat)

# Worker가 응답하지 않으면 조용히 종료
if ! curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
  exit 0
fi

# 도구 이름 추출
TOOL_NAME=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      console.log(j.tool_name||'unknown');
    }catch{console.log('unknown');}
  });
")

# ── 필터링: 의미 있는 도구만 통과 ──
# claude-mem 원칙: "배운/만든/고친/배포한/설정한 것만 기록"
# 코드를 변경하는 도구만 통과시킴
case "$TOOL_NAME" in
  Edit|Write|NotebookEdit)
    # 코드 변경 — 항상 기록
    ;;
  Bash)
    # Bash는 git commit, npm install 같은 의미 있는 명령만 통과
    # git status, ls, echo 같은 단순 조회는 제외
    HAS_MEANINGFUL=$(echo "$INPUT" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try{
          const j=JSON.parse(d);
          const cmd=typeof j.tool_input==='object'?(j.tool_input.command||''):(j.tool_input||'');
          // 의미 있는 명령어 패턴
          if(/git (commit|push|merge|rebase|checkout -b)/i.test(cmd)) { console.log('yes'); return; }
          if(/npm (install|run build|run test|publish)/i.test(cmd)) { console.log('yes'); return; }
          if(/npx|yarn|pnpm|bun (install|run|build)/i.test(cmd)) { console.log('yes'); return; }
          if(/docker|kubectl|terraform|aws|gcloud/i.test(cmd)) { console.log('yes'); return; }
          if(/curl.*-X (POST|PUT|DELETE|PATCH)/i.test(cmd)) { console.log('yes'); return; }
          if(/chmod|mkdir.*-p|rm -r/i.test(cmd)) { console.log('yes'); return; }
          console.log('no');
        }catch{console.log('no');}
      });
    ")
    if [ "$HAS_MEANINGFUL" != "yes" ]; then
      exit 0
    fi
    ;;
  *)
    # Read, Glob, Grep, TaskList, TaskGet, TaskCreate, TaskUpdate,
    # SendMessage, ToolSearch, WebSearch, WebFetch, Agent, TeamCreate,
    # TeamDelete 등 — 조회/관리용 도구는 기록하지 않음
    exit 0
    ;;
esac

# Worker에 전송 — POST /api/memories 형식으로 변환
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROJECT=$(basename "$(pwd)")

PAYLOAD=$(echo "$INPUT" | SESSION_ID="$SESSION_ID" PROJECT="$PROJECT" node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      const toolName=j.tool_name||'unknown';
      const toolInput=typeof j.tool_input==='object'?JSON.stringify(j.tool_input):(j.tool_input||'');
      const toolOutput=typeof j.tool_output==='object'?JSON.stringify(j.tool_output):(j.tool_output||'');
      const filePath=j.tool_input?.file_path||j.tool_input?.command||'';
      const payload={
        session_id:process.env.SESSION_ID,
        project:process.env.PROJECT,
        type:'pattern',
        title:toolName+': '+(filePath.split('/').pop()||'').slice(0,80),
        content:toolName+' on '+filePath+'\n\nInput: '+toolInput.slice(0,500)+'\nOutput: '+toolOutput.slice(0,500),
        tags:[toolName],
        files_involved:filePath?[filePath]:[]
      };
      console.log(JSON.stringify(payload));
    }catch{process.exit(1);}
  });
")

[ -z "$PAYLOAD" ] && exit 0

echo "$PAYLOAD" | curl -sf -X POST "$WORKER_URL/api/memories" \
  -H "Content-Type: application/json" \
  -d @- > /dev/null 2>&1

exit 0
