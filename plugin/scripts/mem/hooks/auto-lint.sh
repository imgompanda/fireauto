#!/bin/bash
# fireauto: 자동 린트 — 성공은 조용히, 실패만 시끄럽게

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_name||'')}catch{console.log('')}});
")

# Edit/Write만 체크
case "$TOOL_NAME" in Edit|Write) ;; *) exit 0 ;; esac

# 수정된 파일 경로 추출
FILE_PATH=$(echo "$INPUT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      const input=typeof j.tool_input==='object'?j.tool_input:JSON.parse(j.tool_input||'{}');
      console.log(input.file_path||'');
    }catch{console.log('')}
  });
")

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# 파일 확장자별 린트
EXT="${FILE_PATH##*.}"
ERRORS=""

case "$EXT" in
  js|cjs|mjs|jsx)
    # Node.js 문법 체크
    ERRORS=$(node -c "$FILE_PATH" 2>&1) || true
    ;;
  ts|tsx)
    # TypeScript — npx tsc가 있으면 실행
    if command -v npx &>/dev/null; then
      ERRORS=$(npx tsc --noEmit "$FILE_PATH" 2>&1 | head -10) || true
    fi
    ;;
  py)
    # Python 문법 체크
    ERRORS=$(python3 -c "import py_compile; py_compile.compile('$FILE_PATH', doraise=True)" 2>&1) || true
    ;;
  sh|bash)
    ERRORS=$(bash -n "$FILE_PATH" 2>&1) || true
    ;;
  json)
    ERRORS=$(node -e "JSON.parse(require('fs').readFileSync('$FILE_PATH','utf8'))" 2>&1) || true
    ;;
esac

# 성공은 조용히 — 에러만 시끄럽게
if [ -n "$ERRORS" ] && echo "$ERRORS" | grep -qi "error\|SyntaxError\|unexpected"; then
  echo "[fireauto-lint] ⚠️ $FILE_PATH 에러 발견:" >&2
  echo "$ERRORS" | head -5 >&2
  echo "[fireauto-lint] 위 에러를 수정해주세요." >&2
fi

exit 0
