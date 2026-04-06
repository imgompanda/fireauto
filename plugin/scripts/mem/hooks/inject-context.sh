#!/bin/bash
# fireauto-mem: 세션 시작 시 프로젝트 컨텍스트를 .claude/CLAUDE.md에 자동 주입

WORKER_URL="http://localhost:37888"

# Worker가 안 돌면 종료
curl -sf "$WORKER_URL/api/health" > /dev/null 2>&1 || exit 0

PROJECT=$(basename "$(pwd)")
PROJECT_CLAUDE_MD=".claude/CLAUDE.md"

# 대시보드 데이터 가져오기 (projectId 없이 → 최신 active 프로젝트)
DASHBOARD=$(curl -sf "$WORKER_URL/api/dashboard" 2>/dev/null)

# loadProjectManager가 null 반환하면 fallback: projectId 명시
if [ "$DASHBOARD" = "null" ] || [ -z "$DASHBOARD" ]; then
  # 프로젝트 목록에서 첫 번째 active 프로젝트 ID 추출
  FIRST_PROJECT_ID=$(curl -sf "$WORKER_URL/api/projects" 2>/dev/null | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const j=JSON.parse(d);
        const p=(j.projects||j||[]).find(x=>x.status==='active');
        if(p) console.log(p.id);
      }catch{}
    });
  " 2>/dev/null)

  if [ -n "$FIRST_PROJECT_ID" ]; then
    DASHBOARD=$(curl -sf "$WORKER_URL/api/dashboard?projectId=$FIRST_PROJECT_ID" 2>/dev/null)
  fi
fi

[ -z "$DASHBOARD" ] || [ "$DASHBOARD" = "null" ] && exit 0

# 프로젝트 상태 마크다운 생성
CONTEXT=$(echo "$DASHBOARD" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    if(!j.project) { process.exit(0); }
    const p=j.project;
    const pct=typeof j.overall_progress==='object'?j.overall_progress.progress_pct||0:j.overall_progress||0;
    const ms=j.milestones||[];
    // 모든 마일스톤에서 미완료 태스크 찾기
    const active=ms.find(m=>m.status==='in_progress')||ms.find(m=>{
      const pending=(m.tasks||[]).some(t=>t.status!=='completed');
      return pending;
    });
    let nextTask=null;
    for(const m of ms){
      const t=(m.tasks||[]).find(t=>t.status!=='completed');
      if(t){nextTask={milestone:m.title,task:t.title};break;}
    }

    let ctx='';
    ctx+='## 현재 프로젝트 상태 (자동 생성 — 수정 금지)\n\n';
    ctx+='프로젝트: '+p.name+' ('+pct+'% 완료)\n';
    if(active) ctx+='현재 마일스톤: '+active.title+'\n';
    if(nextTask) ctx+='다음 태스크: '+nextTask.task+' ('+nextTask.milestone+')\n';
    ctx+='\n';

    console.log(ctx);
  } catch(e) { process.exit(0); }
});
" 2>/dev/null)

[ -z "$CONTEXT" ] && exit 0

# 최근 주의사항 가져오기
MISTAKES=$(curl -sf "$WORKER_URL/api/mistakes?limit=3" 2>/dev/null | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{
    const m=(JSON.parse(d).mistakes||[]).slice(0,3);
    if(!m.length)process.exit(0);
    let s='### 최근 주의사항\n';
    m.forEach(x=>{
      const prev=x.prevention&&x.prevention.trim().length>5?x.prevention.trim():null;
      const text=prev||x.description;
      if(text&&text.trim().length>5) s+='- '+String.fromCodePoint(0x26A0,0xFE0F)+' '+text.split('\n')[0].slice(0,120)+'\n';
    });
    console.log(s);
  }catch{process.exit(0);}
});
" 2>/dev/null)

# .claude/CLAUDE.md에 주입 (기존 "자동 생성" 섹션 교체)
if [ -f "$PROJECT_CLAUDE_MD" ]; then
  # 기존 자동 생성 섹션 제거 (## 현재 프로젝트 상태 ~ 다음 ## 또는 EOF)
  TEMP=$(mktemp)
  node -e "
    const fs=require('fs');
    let content=fs.readFileSync('$PROJECT_CLAUDE_MD','utf8');
    // 자동 생성 섹션 제거: ## 현재 프로젝트 상태 부터 다음 ##(레벨1-2) 전까지
    content=content.replace(/\n*## 현재 프로젝트 상태 \(자동 생성[^]*?(?=\n## [^현]|\n# [^\n]|$)/g, '');
    // 후행 빈줄 정리
    content=content.replace(/\n{3,}/g, '\n\n').trim();
    fs.writeFileSync('$TEMP', content+'\n');
  " 2>/dev/null
  echo "" >> "$TEMP"
  echo "$CONTEXT" >> "$TEMP"
  [ -n "$MISTAKES" ] && echo "$MISTAKES" >> "$TEMP"
  mv "$TEMP" "$PROJECT_CLAUDE_MD"
else
  mkdir -p .claude
  echo "$CONTEXT" > "$PROJECT_CLAUDE_MD"
  [ -n "$MISTAKES" ] && echo "$MISTAKES" >> "$PROJECT_CLAUDE_MD"
fi

echo "[fireauto] 프로젝트 컨텍스트 주입 완료" >&2
exit 0
