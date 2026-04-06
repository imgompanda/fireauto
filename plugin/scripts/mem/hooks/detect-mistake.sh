#!/bin/bash
# fireauto-mem: 사용자 입력에서 실수 감지 (UserPromptSubmit)
WORKER_URL="http://localhost:37888"

# Worker가 안 돌면 종료
curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1 || exit 0

# stdin에서 사용자 메시지 읽기
INPUT=$(cat)

# 사용자 메시지 추출
USER_MSG=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      console.log(j.prompt||j.message||j.content||'');
    }catch{console.log('');}
  });
" 2>/dev/null)

# 빈 메시지면 종료
[ -z "$USER_MSG" ] && exit 0

# 실수 패턴 감지 (한국어/영어)
echo "$USER_MSG" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const msg=d.toLowerCase();
    const patterns=['아니','그거 아니','잘못','틀렸','다시','그게 아니라','실수','에러','오류','안돼','안되','동작 안','작동 안','버그','wrong','incorrect','not that','undo','error','bug','broken'];
    if(patterns.some(p=>msg.includes(p))){
      // 실수 감지 → Worker에 기록
      const http=require('http');
      const body=JSON.stringify({
        description:'사용자 수정 요청: '+d.trim().slice(0,200),
        cause:'AI 판단 오류',
        severity:'medium',
        project:require('path').basename(process.cwd())
      });
      const req=http.request({hostname:'localhost',port:37888,path:'/api/mistakes',method:'POST',
        headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      });
      req.on('error',()=>{});
      req.write(body);
      req.end();
    }
  });
" 2>/dev/null

exit 0
