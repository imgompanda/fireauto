#!/bin/bash
# fireauto-mem: 도구 사용 관찰 훅
# stdin으로 tool_name, tool_input, tool_output을 받아 Worker에 전송

WORKER_URL="http://localhost:37888"

# stdin에서 JSON 읽기
INPUT=$(cat)

# Worker가 응답하지 않으면 조용히 종료
if ! curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1; then
  exit 0
fi

# 도구 정보 추출 (jq가 없을 수 있으므로 node 사용)
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

SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROJECT=$(basename "$(pwd)")

# 제목 생성 및 메모리 저장
node -e "
  const input = $INPUT;
  const toolName = input.tool_name || 'unknown';
  const toolInput = typeof input.tool_input === 'string' ? input.tool_input : JSON.stringify(input.tool_input || {});
  const toolOutput = typeof input.tool_output === 'string' ? input.tool_output.slice(0, 500) : JSON.stringify(input.tool_output || '').slice(0, 500);

  // 파일 경로 추출
  let files = [];
  try {
    const inp = typeof input.tool_input === 'object' ? input.tool_input : JSON.parse(input.tool_input);
    if (inp.file_path) files.push(inp.file_path);
    if (inp.path) files.push(inp.path);
  } catch {}

  // 타입 추론
  let type = 'decision';
  if (toolName === 'Edit' || toolName === 'Write') type = 'feature';
  if (toolOutput.includes('error') || toolOutput.includes('Error')) type = 'bugfix';

  const body = {
    session_id: '$SESSION_ID',
    project: '$PROJECT',
    type,
    title: toolName + ': ' + (files[0] || toolInput.slice(0, 80)),
    content: 'Tool: ' + toolName + '\nInput: ' + toolInput.slice(0, 300) + '\nOutput: ' + toolOutput,
    tags: JSON.stringify([toolName.toLowerCase()]),
    files_involved: JSON.stringify(files),
  };

  const http = require('http');
  const data = JSON.stringify(body);
  const req = http.request({
    hostname: 'localhost', port: 37888, path: '/api/memories',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  });
  req.on('error', () => {});
  req.write(data);
  req.end();
" 2>/dev/null

exit 0
