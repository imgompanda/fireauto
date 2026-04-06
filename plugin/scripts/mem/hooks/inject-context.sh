#!/bin/bash
# fireauto-mem: 세션 시작 시 프로젝트 컨텍스트 주입
WORKER_URL="http://localhost:37888"

# Worker가 안 돌면 종료
curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1 || exit 0

PROJECT=$(basename "$(pwd)")

# 활성 프로젝트 대시보드 가져오기
DASHBOARD=$(curl -sf "$WORKER_URL/api/dashboard" 2>/dev/null)
[ -z "$DASHBOARD" ] && exit 0

# 프로젝트가 있으면 컨텍스트 출력 (stderr로 — 사용자에게 보이도록)
HAS_PROJECT=$(echo "$DASHBOARD" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      if(j.project&&j.project.name){
        const p=j.project;
        const pct=typeof j.overall_progress==='object'?j.overall_progress.progress_pct||0:j.overall_progress||0;
        const ms=j.milestones||[];
        const active=ms.find(m=>m.status==='in_progress')||ms.find(m=>m.status==='pending');
        console.log('yes');
        console.error('[fireauto] 프로젝트: '+p.name+' ('+pct+'% 완료)');
        if(active)console.error('[fireauto] 현재 마일스톤: '+active.title);
      }else{console.log('no');}
    }catch{console.log('no');}
  });
" 2>&2)

# 최근 실수/주의사항 가져오기
curl -sf "$WORKER_URL/api/mistakes?project=$PROJECT&limit=3" 2>/dev/null | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{
      const j=JSON.parse(d);
      const m=j.mistakes||[];
      if(m.length>0){
        console.error('[fireauto] 주의사항:');
        m.forEach(x=>console.error('  ⚠️ '+(x.prevention||x.description)));
      }
    }catch{}
  });
" 2>&2

exit 0
