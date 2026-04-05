#!/bin/bash
# fireauto-mem: 도구 사용 관찰 훅
# stdin으로 전체 JSON을 받아 Worker에 전송

WORKER_URL="http://localhost:37888"

# stdin에서 전체 JSON 읽기
INPUT=$(cat)

# Worker가 응답하지 않으면 조용히 종료
if ! curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
  exit 0
fi

# 도구 이름 추출 (jq가 없을 수 있으므로 node 사용)
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

# 무시할 도구들 (너무 빈번하거나 노이즈가 많은 것)
case "$TOOL_NAME" in
  Read|Glob|Grep|TaskList|TaskGet|TaskCreate|TaskUpdate|SendMessage)
    exit 0
    ;;
esac

# 전체 관찰 데이터를 Worker에 전송 (tool_name, tool_input, tool_output 포함)
echo "$INPUT" | curl -sf -X POST "$WORKER_URL/api/memories" \
  -H "Content-Type: application/json" \
  -d @- > /dev/null 2>&1

exit 0
