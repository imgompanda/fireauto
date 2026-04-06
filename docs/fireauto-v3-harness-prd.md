# fireauto v3 — AI 개발 하네스 시스템 PRD

> **작성일**: 2026-04-06
> **목표 버전**: v3.0.0
> **현재**: v2.0.1 (메모리 시스템 + MCP + 한국어 UI)
> **참고**: GSD (48K), vibe-kanban (24K), Superpowers (99K), gstack (64K), chief (434)

---

## 1. 한 줄 요약

fireauto v3는 **PRD → 마일스톤 → 태스크 → 자동 실행 → 진행률 추적 → 다음 세션 복원**을 하나의 흐름으로 연결하는 **AI 개발 하네스**다. 초보자도 그냥 쓰면 알아서 방향을 잡아주고, 경험자는 생산성이 극대화된다.

---

## 2. 왜 만드는가

### 현재 fireauto의 한계

| 기능 | 현재 상태 | 문제 |
|------|----------|------|
| `/planner` | PRD 마크다운 파일 생성 후 끝 | 실행으로 이어지지 않음 |
| `/team` | 그때그때 팀 구성 | PRD/태스크와 연결 안 됨 |
| 메모리 | 독립적 지식 축적 | 작업 맥락과 분리됨 |
| 세션 간 | 연결 없음 | 어제 뭘 했는지 수동으로 파악 |

### 경쟁 생태계 분석

| 프로젝트 | 강점 | fireauto가 차용할 것 |
|----------|------|-------------------|
| **GSD** (48K) | 스펙 → 작은 계획 → fresh context 실행 | 마일스톤 → 태스크 자동 분해 |
| **vibe-kanban** (24K) | 칸반 UI + 멀티 에이전트 | 프로젝트 대시보드 UI |
| **Superpowers** (99K) | 브레인스토밍 → 계획 → TDD → 리뷰 체인 | 단계별 자동 가이드 |
| **gstack** (64K) | 역할별 페르소나 (CEO, Designer, Engineer) | 상황별 자동 제안 |
| **chief** (434) | PRD → 태스크 → 루프 실행 → 완료 | PRD 기반 자동 실행 |

### fireauto v3의 차별점

**위 프로젝트들은 각각 한 가지만 잘 함.** fireauto는 **전부 통합**:
- GSD의 스펙 분해 + vibe-kanban의 UI + Superpowers의 가이드 + chief의 자동 실행 + 메모리 시스템

---

## 3. 핵심 흐름

```
사용자: "할일 관리 앱 만들어줘"
         |
    [1. /planner]
         |
    PRD 자동 생성 (9개 섹션)
         |
    [2. 자동 분해]
         |
    마일스톤 3개 + 태스크 12개 (DB에 저장)
         |
    [3. 대시보드]
         |
    http://localhost:37888 — 진행률, 마일스톤, 태스크 시각화
         |
    [4. /team 또는 /loop]
         |
    태스크별 자동 실행 (팀 병렬 or 순차 루프)
         |
    [5. 작업 중 — 메모리 자동 축적]
         |
    버그 수정, 패턴 발견, 결정 사항 → 태스크에 연결됨
         |
    [6. 세션 종료]
         |
    진행률 업데이트 + AI 요약
         |
    [7. 다음 세션 시작]
         |
    하네스가 자동으로:
    "어제 마일스톤 1 완료했어요. 오늘은 마일스톤 2의 첫 태스크 시작하면 돼요."
    "참고: 어제 Paddle API 타임아웃 이슈 발견했어요."
```

---

## 4. 기능 상세

### 4.1 프로젝트 관리 (신규)

#### DB 스키마

```sql
-- 프로젝트
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  prd_path TEXT,           -- PRD 마크다운 경로
  status TEXT DEFAULT 'active',  -- active, paused, completed
  created_at_epoch INTEGER NOT NULL,
  updated_at_epoch INTEGER
);

-- 마일스톤
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed
  due_date TEXT,
  completed_at_epoch INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 태스크
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, blocked, completed
  priority TEXT DEFAULT 'P1',     -- P0, P1, P2, P3
  assignee TEXT,                  -- 팀원 이름 (team 사용 시)
  order_index INTEGER DEFAULT 0,
  blocked_by TEXT,                -- 블로커 설명
  completed_at_epoch INTEGER,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 기존 memories 테이블에 task_id 추가
ALTER TABLE memories ADD COLUMN task_id INTEGER REFERENCES tasks(id);
```

#### /planner 통합

기존 `/planner`가 PRD를 생성한 후:
1. PRD에서 마일스톤/태스크를 **자동 추출**
2. DB에 저장
3. 대시보드에 즉시 반영

```
/planner "할일 관리 앱"
  → PRD 생성 (docs/prd/todo-app.md)
  → 마일스톤 자동 분해:
    M1: 기본 CRUD (P0)
      - 태스크: DB 스키마 설계
      - 태스크: API 라우트 구현
      - 태스크: 프론트엔드 UI
    M2: 인증 + 결제 (P1)
      - 태스크: NextAuth 연동
      - 태스크: Paddle 결제
    M3: 배포 + SEO (P2)
      - 태스크: Vercel 배포
      - 태스크: SEO 점검
  → 대시보드에 표시
```

#### /team 통합

`/team` 실행 시 **현재 마일스톤의 태스크를 기반으로** 팀 자동 구성:

```
/team
  → "현재 마일스톤 2 (인증 + 결제)에 태스크 2개 있어요."
  → "backend-dev: NextAuth 연동, frontend-dev: 결제 UI"
  → 자동 팀 구성 + 태스크 할당
```

### 4.2 하네스 (세션 가이드)

#### SessionStart 훅에서 자동 실행

```
세션 시작 시 하네스가 자동으로:

1. 활성 프로젝트 확인
2. 현재 마일스톤 + 진행률 표시
3. 다음 해야 할 태스크 제안
4. 관련 메모리 (이전 세션의 맥락) 주입
5. 위험 요소 알림 (보안, 성능 등)
```

#### 컨텍스트 복원 (CLAUDE.md 자동 생성)

세션 시작 시 프로젝트의 `.claude/CLAUDE.md`에 자동으로 현재 상태를 주입:

```markdown
## 현재 프로젝트 상태 (자동 생성, 수정 금지)

프로젝트: 할일 관리 앱
진행률: 40% (마일스톤 1/3 완료)

### 현재 마일스톤: M2 - 인증 + 결제
- [x] NextAuth 연동 (완료)
- [ ] Paddle 결제 연동 (진행 중)
- [ ] 결제 웹훅 처리 (대기)

### 최근 지식
- Paddle API 타임아웃: 30초 설정 필요 (2시간 전)
- 인증 토큰은 httpOnly 쿠키에 저장하기로 결정 (어제)

### 주의사항
- Paddle webhook 서명 검증 필수
- test 환경에서 sandbox API 사용할 것
```

#### 초보자 모드

초보자가 처음 프로젝트를 시작할 때:

```
"어떤 서비스를 만들고 싶으세요?"
  → 사용자 입력
"PRD를 만들어드릴게요. /planner로 시작할까요?"
  → PRD 생성
"마일스톤 3개로 나눴어요. 첫 번째부터 시작할까요?"
  → 태스크 표시
"DB 스키마부터 만들면 돼요. 시작할게요."
  → 자동 시작
"완료했어요! 다음 태스크는 API 라우트예요. 계속할까요?"
  → 가이드 연속
```

### 4.3 대시보드 UI (통합)

```
┌─ fireauto ─────────────────────────────────────────┐
│  📋 프로젝트 | 🔥 지식 DB | 📊 그래프              │
├────────────────────────────────────────────────────┤
│                                                     │
│  할일 관리 앱                                       │
│  ████████░░░░░░░ 40%   마감: 2026-04-30             │
│                                                     │
│  ── M1: 기본 CRUD ── ✅ 완료 ──────────────────── │
│                                                     │
│  ── M2: 인증 + 결제 ── 🔄 진행 중 ────────────── │
│  │                                                  │
│  │  ✅ NextAuth 연동                                │
│  │     └ 💡 httpOnly 쿠키 결정 (메모리 #45)         │
│  │                                                  │
│  │  🔄 Paddle 결제 연동                             │
│  │     └ ⚠️ API 타임아웃 주의 (메모리 #52)         │
│  │     └ [/team으로 병렬 작업]                      │
│  │                                                  │
│  │  ⬜ 결제 웹훅 처리                               │
│  │     └ 🔒 서명 검증 필수 (보안 가이드)            │
│  │                                                  │
│  ── M3: 배포 + SEO ── ⬜ 대기 ─────────────────── │
│                                                     │
│  [다음 태스크 시작]  [팀 작업]  [PRD 보기]           │
└────────────────────────────────────────────────────┘
```

기존 지식 DB 뷰와 **탭으로 전환**:
- 📋 **프로젝트** — 마일스톤/태스크/진행률 (신규)
- 🔥 **지식 DB** — 기존 메모리 피드 (claude-mem 스타일)
- 📊 **그래프** — 관계 그래프 (기존)

### 4.4 MCP 도구 추가

| 도구 | 설명 |
|------|------|
| `project-status` | 현재 프로젝트 진행률, 마일스톤, 다음 태스크 |
| `project-task-update` | 태스크 상태 변경 (시작/완료/블록) |
| `project-next` | 다음 해야 할 태스크 제안 + 관련 메모리 |

### 4.5 자동 제안 스킬

| 상황 | 자동 제안 |
|------|----------|
| 세션 시작 | "오늘 할 태스크: Paddle 결제 연동" |
| 태스크 완료 | "다음: 결제 웹훅 처리. 관련 주의사항 있어요." |
| 막힐 때 | "비슷한 이슈 해결 기록: 메모리 #52" |
| 마일스톤 완료 | "M2 완료! 축하해요. M3 시작할까요?" |
| 배포 전 | "SEO 점검 + 보안 점검 먼저 할까요?" |
| 장시간 태스크 | "이 태스크가 2시간째예요. /team으로 분할할까요?" |

---

## 5. 커맨드 변경

### 신규 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/project` | 프로젝트 대시보드 열기 / 프로젝트 생성 |
| `/milestone` | 마일스톤 관리 (추가/수정/완료) |
| `/next` | 다음 태스크 시작 (하네스 자동 가이드) |

### 기존 커맨드 통합

| 커맨드 | 현재 | v3 |
|--------|------|-----|
| `/planner` | PRD 파일 생성 | PRD → 마일스톤 → 태스크 자동 분해 + DB 저장 |
| `/team` | 수동 팀 구성 | 현재 마일스톤 태스크 기반 자동 팀 구성 |
| `/loop` | 프롬프트 반복 | 태스크 기반 반복 (완료까지) |
| 메모리 | 독립 축적 | 태스크에 연결된 맥락 (task_id) |

---

## 6. 기술 설계

### 아키텍처

```
SessionStart 훅
    ↓
하네스 컨텍스트 주입
(프로젝트 상태 → CLAUDE.md)
    ↓
사용자 작업
    ↓
PostToolUse 훅
    ↓
메모리 축적 + 태스크 상태 추적
    ↓
Stop 훅
    ↓
세션 요약 + 진행률 업데이트
    ↓
대시보드 실시간 반영 (SSE)
```

### 파일 구조 (신규)

```
plugin/scripts/mem/
  project-manager.cjs    (프로젝트/마일스톤/태스크 CRUD)
  harness.cjs            (세션 시작 시 컨텍스트 주입)
  auto-suggest.cjs       (상황별 자동 제안 로직)

plugin/commands/
  project.md             (프로젝트 대시보드)
  milestone.md           (마일스톤 관리)
  next.md                (다음 태스크 시작)

plugin/skills/
  fireauto-harness-guide/ (하네스 자동 가이드)
  fireauto-project-guide/ (프로젝트 관리 가이드)
```

---

## 7. 구현 로드맵

### Phase 1: 프로젝트 관리 코어
1. DB 스키마 (projects, milestones, tasks)
2. project-manager.cjs (CRUD 함수)
3. Worker API 추가 (프로젝트/마일스톤/태스크)
4. MCP 도구 3개 (project-status, project-task-update, project-next)
5. /planner 통합 (PRD → 자동 분해)

### Phase 2: 하네스
6. harness.cjs (세션 시작 컨텍스트 주입)
7. auto-suggest.cjs (상황별 자동 제안)
8. SessionStart 훅 업데이트
9. /next 커맨드

### Phase 3: 대시보드 UI
10. 프로젝트 탭 (마일스톤/태스크 시각화)
11. 진행률 바 + 태스크 상태
12. 메모리-태스크 연결 표시
13. 기존 지식 DB 탭과 통합

### Phase 4: 통합
14. /team 자동 태스크 할당
15. 메모리 → task_id 연결
16. 초보자 온보딩 가이드
17. README + CHANGELOG 업데이트

---

## 8. 성공 지표

| 지표 | 목표 |
|------|------|
| 세션 시작 시 컨텍스트 복원 | 3초 이내에 "오늘 할 일" 표시 |
| PRD → 태스크 분해 정확도 | 사용자가 80%+ 동의 |
| 초보자 첫 프로젝트 완료율 | 가이드 따라 하면 완주 가능 |
| 대시보드 사용률 | 매 세션 시작 시 자동 표시 |
| 메모리-태스크 연결 | "이 태스크 할 때 참고" 자동 제시 |

---

## 9. 리스크

### CLAUDE.md 자동 생성 충돌
- 리스크: 사용자가 작성한 CLAUDE.md와 충돌
- 대안: 별도 섹션 `## 자동 생성 (수정 금지)` 으로 분리
- 또는: `.claude/project-state.md` 별도 파일 사용

### 과도한 자동 제안
- 리스크: 너무 많은 제안이 사용자를 방해
- 대안: "조용한 모드" 옵션 (요청 시에만 제안)

### 프로젝트 규모 확장
- 리스크: 태스크 100개+ 시 DB 성능
- 대안: sql.js로 충분, 필요 시 인덱스 추가

---

## 10. v2 → v3 마이그레이션

- 기존 메모리 시스템 **100% 유지** (하위 호환)
- 프로젝트/마일스톤/태스크는 **추가 기능** (optional)
- 기존 사용자: 아무것도 안 해도 됨
- 새 기능 사용: `/project` 또는 `/planner` 실행하면 자동 활성화
