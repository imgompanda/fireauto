# fireauto v4 — 자기 진화하는 AI 하네스 시스템

> **작성일**: 2026-04-06
> **핵심 참고**: Karpathy LLM Wiki 패턴 + 감사 보고서 14건 버그
> **한 줄**: 설치 한 번이면 AI가 스스로 하네스를 만들고, 실수에서 배우고, 프로젝트마다 진화하는 시스템

---

## 1. 핵심 컨셉

### 기존 (v2.1)
```
사용자가 /freainer → 수동 세팅
사용자가 /planner → PRD 생성
사용자가 /team → 팀 구성
메모리가 쌓임 → 검색 가능
```

### v4 비전
```
사용자가 설치 → AI가 알아서:
  1. "뭘 만들 건가요?" 물어봄
  2. PRD 자동 생성
  3. CLAUDE.md 자동 생성 (프로젝트 맞춤 규칙)
  4. 필요한 스킬 자동 생성
  5. 마일스톤/태스크 분해 → DB 저장
  6. 작업 시작 → 실수하면 자동으로 CLAUDE.md/스킬 업데이트
  7. 반복 작업 감지 → 스킬로 자동화
  8. 세션 끝 → 복기 (실수는 크게, 성공은 조용히)
  9. 다음 프로젝트 시작 → 이전 프로젝트 지식 자동 참고
```

---

## 2. 시스템 아키텍처

### 3계층 (Karpathy Wiki 차용)

```
[Layer 1: Raw Sources] — 불변
  프로젝트 코드, PRD, 사용자 입력, 세션 로그
  → AI가 읽기만 함, 수정 안 함

[Layer 2: Wiki (AI가 소유)] — 자동 진화
  .claude/CLAUDE.md          ← 프로젝트 규칙 (컴팩트)
  .claude/wiki/              ← 상세 지식 페이지들
    patterns.md              — 발견된 패턴들
    gotchas.md               — 주의사항/삽질 기록
    decisions.md             — 설계 결정 + 이유
    skills-catalog.md        — 생성된 스킬 목록
    retrospective.md         — 복기 기록
  .claude/skills/            ← 자동 생성된 프로젝트 스킬
    auth-pattern.md          — 인증 관련 패턴
    error-handling.md        — 에러 핸들링 규칙
    ...
  
[Layer 3: Schema (MCP DB)] — 교차 프로젝트
  memories DB                — 모든 지식 축적
  projects DB                — 프로젝트/마일스톤/태스크
  skills DB (신규)           — 재사용 가능한 스킬 라이브러리
  mistakes DB (신규)         — 실수 + 수정 기록
```

### 핵심 차이: CLAUDE.md는 작게 유지

```
CLAUDE.md (500줄 이내):
  - 프로젝트 개요
  - 핵심 규칙 10개
  - "상세는 .claude/wiki/ 참고" 포인터

.claude/wiki/ (무제한):
  - 패턴별 상세 페이지
  - 각 페이지는 독립적
  - AI가 필요할 때 찾아서 읽음
  - Karpathy의 index.md 패턴으로 탐색
```

---

## 3. 자동 흐름 상세

### 3.1 프로젝트 시작 (원클릭)

```
/fireauto-init 또는 /start

사용자: "SaaS 할일 관리 앱 만들어줘"

AI가 자동으로:
  1. PRD 생성 (9개 섹션)
     → docs/prd/todo-app.md

  2. CLAUDE.md 자동 생성
     → 프로젝트 컨텍스트
     → 기술 스택 규칙
     → 코딩 컨벤션
     → "이전 프로젝트에서 배운 것" (DB에서 참고)
  
  3. 초기 스킬 자동 생성
     → .claude/skills/project-conventions.md
     → .claude/skills/tech-stack-rules.md
  
  4. 마일스톤/태스크 분해 → DB 저장
  
  5. 대시보드에 표시
```

### 3.2 작업 중 자동 학습

```
[실수 감지 → 자동 업데이트]

시나리오: AI가 잘못된 API 호출을 함
  → 사용자가 "아니 그거 아니야" 또는 에러 발생
  → AI가 인식: "이건 실수다"
  → 자동으로:
    1. mistakes DB에 기록 (뭘 잘못했고, 왜, 어떻게 수정)
    2. .claude/wiki/gotchas.md에 추가
    3. CLAUDE.md에 핵심 규칙 추가 (같은 실수 방지)
    4. 관련 스킬이 있으면 업데이트
  → 사용자에게 알림: "⚠️ 실수 기록: {내용}. 다음부터 주의할게요."

[성공 → 조용히 축적]

시나리오: AI가 깔끔하게 기능 구현 완료
  → 조용히:
    1. patterns DB에 기록
    2. .claude/wiki/patterns.md에 추가
    3. 스킬로 발전 가능성 체크
  → 사용자에게: (아무 말 안 함 — 성공은 당연한 것)
```

### 3.3 반복 작업 감지 → 스킬 자동 생성

```
[패턴 감지]

AI가 관찰: "이 사용자는 API 라우트를 만들 때마다 같은 패턴을 쓴다"
  (3번 이상 반복된 작업 감지)

자동으로:
  1. 패턴 추출
  2. .claude/skills/api-route-pattern.md 생성
  3. skills DB에 저장 (다른 프로젝트에서도 사용 가능)
  4. CLAUDE.md에 "API 라우트 생성 시 api-route-pattern 스킬 참고" 추가
```

### 3.4 복기 시스템 (세션 종료 시)

```
[Stop 훅에서 자동 실행]

AI가 세션 복기:
  1. 이 세션에서 한 일 요약
  2. 실수 목록 (크게 표시)
     ⚠️ "Paddle API 타임아웃 처리 안 함 → 30초 설정 추가함"
     ⚠️ "listMilestones 파라미터 잘못 넘김 → 수정함"
  3. 성공한 일 (작게)
     ✓ "결제 연동 완료"
  4. 배운 것 → wiki 업데이트
  5. 다음 세션 TODO → CLAUDE.md 업데이트

출력 형식:
  ════════════════════════
  세션 복기
  
  ⚠️ 실수 (2건):
  1. Paddle API 타임아웃 미처리 → 수정 완료, gotchas.md에 기록
  2. DB 쿼리 파라미터 불일치 → 수정 완료, CLAUDE.md 규칙 추가
  
  ✓ 완료: 결제 연동, 웹훅 처리
  📝 다음: 테스트 작성
  ════════════════════════
```

### 3.5 교차 프로젝트 지식 전이

```
[새 프로젝트 시작 시]

AI가 자동으로:
  1. skills DB에서 관련 스킬 검색
     "이전 프로젝트에서 auth-pattern, error-handling 스킬이 있어요"
  2. 사용자에게 물어봄:
     "이전 프로젝트의 인증 패턴을 이 프로젝트에도 적용할까요?"
  3. 선택한 스킬을 .claude/skills/에 복사
  4. CLAUDE.md에 반영
  5. mistakes DB에서 관련 주의사항 가져옴
     "이전에 Paddle webhook 서명 검증 누락으로 삽질했어요. 이번엔 미리 넣을게요."
```

---

## 4. DB 스키마 추가

### skills 테이블 (신규)
```sql
CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,           -- 스킬 마크다운 내용
  category TEXT,                   -- auth, error-handling, api, ui, ...
  source_project TEXT,             -- 어느 프로젝트에서 생성됐는지
  usage_count INTEGER DEFAULT 0,   -- 몇 번 사용됐는지
  created_at_epoch INTEGER NOT NULL,
  updated_at_epoch INTEGER
);
```

### mistakes 테이블 (신규)
```sql
CREATE TABLE mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  description TEXT NOT NULL,       -- 뭘 잘못했는지
  cause TEXT,                      -- 왜 잘못됐는지
  fix TEXT,                        -- 어떻게 고쳤는지
  prevention TEXT,                 -- 어떻게 방지하는지
  severity TEXT DEFAULT 'medium',  -- low, medium, high, critical
  files_involved TEXT DEFAULT '[]',
  created_at_epoch INTEGER NOT NULL
);
```

---

## 5. MCP 도구 추가

| 도구 | 설명 |
|------|------|
| `wiki-read` | .claude/wiki/ 페이지 읽기 |
| `wiki-write` | .claude/wiki/ 페이지 생성/업데이트 |
| `wiki-search` | wiki 내 키워드 검색 |
| `wiki-index` | wiki index.md 조회 (전체 목록) |
| `skill-save` | 스킬을 DB에 저장 (교차 프로젝트) |
| `skill-search` | DB에서 관련 스킬 검색 |
| `mistake-log` | 실수 기록 |
| `mistake-search` | 관련 실수/주의사항 검색 |
| `retrospect` | 세션 복기 실행 |

---

## 6. 자동 트리거 흐름

### SessionStart
```
1. 활성 프로젝트 확인
2. CLAUDE.md 읽기
3. wiki/index.md 읽기 (최근 변경)
4. "오늘 할 일" 제안
5. 관련 실수/주의사항 주입
```

### PostToolUse (Edit/Write 후)
```
1. 변경 내용 분석 (Haiku)
2. 패턴 감지 → skill 후보 체크
3. 실수 감지 → mistake-log + wiki 업데이트
4. 메모리 축적 (기존)
5. 관계 추론 (기존)
```

### Stop (세션 종료)
```
1. 세션 복기 자동 실행
2. 실수 크게, 성공 조용히
3. wiki 업데이트 (patterns, gotchas, decisions)
4. CLAUDE.md 규칙 업데이트 (필요시)
5. 다음 세션 TODO 설정
6. 진행률 업데이트
```

### UserPromptSubmit (사용자 입력 시)
```
1. "아니", "그거 아니야", "잘못", "틀렸" 감지 → 실수 기록 트리거
2. "이거 패턴으로 저장" 감지 → skill 저장
3. "복기해줘", "뭘 배웠지" 감지 → retrospect 실행
```

---

## 7. CLAUDE.md 자동 관리 전략

### 원칙: 작게 유지, wiki로 위임

```markdown
# 프로젝트: 할일 관리 앱

## 핵심 규칙
1. TypeScript strict mode 사용
2. API 라우트는 try-catch + Result 타입
3. 인증은 httpOnly 쿠키 (NextAuth)
4. Paddle 결제 연동 시 webhook 서명 검증 필수
5. 테스트는 vitest + testing-library

## 주의사항 (자동 업데이트)
- sql.js WASM에 FTS5 없음 → FTS4 사용
- Paddle API 타임아웃 30초 설정 필수

## 상세 지식
- 패턴: .claude/wiki/patterns.md
- 주의사항: .claude/wiki/gotchas.md
- 결정: .claude/wiki/decisions.md
- 스킬 목록: .claude/wiki/skills-catalog.md

## 현재 상태 (자동 생성)
마일스톤 2/3 완료, 다음: 결제 웹훅 처리
```

### 자동 업데이트 규칙
- CLAUDE.md는 **500줄 이내** 유지
- 새 규칙 추가 시 오래된 규칙 → wiki로 이동
- 실수 기반 규칙은 **즉시** CLAUDE.md에 추가 (재발 방지)
- 패턴 기반 규칙은 **3회 반복 후** 스킬로 승격

---

## 8. 구현 로드맵

### Phase 1: 감사 버그 수정 (즉시)
- worker.cjs CRITICAL 버그 2건 (loadSdkAgent, loadProjectManager)
- mcp-server.cjs 응답 구조 불일치 3건
- viewer.html max-width 문제
- marketplace.json 버전 불일치

### Phase 2: Wiki 시스템
- .claude/wiki/ 디렉토리 구조
- wiki MCP 도구 4개 (read, write, search, index)
- CLAUDE.md 자동 관리 로직
- Karpathy index.md 패턴

### Phase 3: 자기 학습
- mistakes DB + MCP 도구
- skills DB + MCP 도구  
- PostToolUse에서 실수/패턴 감지
- UserPromptSubmit에서 "아니" 감지
- 반복 작업 → 스킬 자동 생성

### Phase 4: 복기 시스템
- Stop 훅 복기 자동 실행
- 실수 크게 / 성공 조용히 출력
- wiki 자동 업데이트
- CLAUDE.md 규칙 자동 추가

### Phase 5: 교차 프로젝트
- 새 프로젝트 시작 시 이전 지식 검색
- 스킬 추천 + 선택적 적용
- 실수/주의사항 자동 주입

### Phase 6: 원클릭 세팅
- /fireauto-init 커맨드 (전체 자동)
- PRD → CLAUDE.md → skills → DB → 대시보드
- 초보자도 "뭘 만들 건가요?" 하나면 끝

---

## 9. 감사 버그 우선 수정 목록

v4 구현 전에 반드시 수정해야 할 감사 결과:

| # | 심각도 | 위치 | 수정 내용 |
|---|--------|------|----------|
| 1 | CRITICAL | worker.cjs:28 | `let sdkAgentMod = null` → `let sdkAgentMod` (undefined) |
| 2 | CRITICAL | worker.cjs:72 | `let projectMgrMod = null` → `let projectMgrMod` (undefined) |
| 3 | HIGH | worker.cjs:387 | `'done'` → `'completed'` |
| 4 | HIGH | harness.cjs:47,63 | `{ projectId }` → 숫자, `milestoneId` → `milestone_id` |
| 5 | HIGH | mcp-server.cjs:239 | `result.memories` → `result.graph` |
| 6 | HIGH | mcp-server.cjs:406 | `result.task.id` → `(result.task.task\|\|result.task).id` |
| 7 | HIGH | mcp-server.cjs:154 | `e.created_at` → `(e.data\|\|e).created_at` |
| 8 | HIGH | mcp-server.cjs:295 | `result.projects` → `result.project\|\|result.projects?.[0]` |
| 9 | HIGH | viewer.html:35 | `.main max-width: 760px` → 탭별 분기 |
| 10 | HIGH | marketplace.json | `1.0.0` → `2.1.0` |
