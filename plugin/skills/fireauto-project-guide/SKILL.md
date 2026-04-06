---
name: fireauto-project-guide
description: >
  프로젝트 생성, 마일스톤 관리, 태스크 추적이 필요할 때 사용하세요.
  "프로젝트 만들어", "마일스톤 추가", "태스크 완료",
  "진행률 확인", "project", "milestone", "task" 등 키워드에 트리거.
---

# 프로젝트 관리 가이드

프로젝트 생성부터 마일스톤 관리, 태스크 추적까지. fireauto의 프로젝트 관리 MCP 도구를 활용하는 방법을 안내하는 가이드.

---

## 언제 트리거되나요?

다음 키워드나 상황에서 이 가이드를 참고하세요:

- **프로젝트 관련**: "프로젝트 만들어", "프로젝트 생성", "project create", "새 프로젝트"
- **마일스톤 관련**: "마일스톤 추가", "마일스톤 만들어", "milestone", "단계 나누기"
- **태스크 관련**: "태스크 추가", "태스크 완료", "task", "할 일 추가", "완료 처리"
- **진행률 관련**: "진행률 확인", "얼마나 했어?", "프로젝트 상태", "progress"

---

## 사용 가능한 MCP 도구

### 프로젝트 관리

| 도구 | 설명 | 주요 파라미터 |
|------|------|-------------|
| `project-create` | 새 프로젝트 생성 | name, description |
| `project-status` | 프로젝트 상태/진행률 조회 | projectId (선택) |
| `project-list` | 전체 프로젝트 목록 | status (선택) |
| `project-update` | 프로젝트 정보 수정 | projectId, name, description, status |

### 마일스톤 관리

| 도구 | 설명 | 주요 파라미터 |
|------|------|-------------|
| `project-milestone-create` | 마일스톤 생성 | projectId, name, description, order |
| `project-milestone-update` | 마일스톤 수정 | milestoneId, name, status |
| `project-milestone-list` | 마일스톤 목록 | projectId |

### 태스크 관리

| 도구 | 설명 | 주요 파라미터 |
|------|------|-------------|
| `project-task-create` | 태스크 생성 | milestoneId, name, description, order |
| `project-task-update` | 태스크 상태 변경 | taskId, status, name |
| `project-task-list` | 태스크 목록 | milestoneId, status (선택) |
| `project-next` | 다음 해야 할 태스크 조회 | projectId (선택) |

---

## 프로젝트 생성 플로우

### 1. PRD가 있는 경우

PRD 문서를 분석해서 자동으로 마일스톤과 태스크를 생성해요.

```
1. project-create → 프로젝트 생성
2. PRD에서 Phase/로드맵 추출 → project-milestone-create
3. 각 Phase의 작업 항목 추출 → project-task-create
```

### 2. PRD가 없는 경우

빈 프로젝트를 먼저 만들고, 나중에 마일스톤/태스크를 추가해요.

```
1. project-create → 빈 프로젝트 생성
2. 사용자가 마일스톤을 정의하면 → project-milestone-create
3. 각 마일스톤에 태스크 추가 → project-task-create
```

### 3. /planner 연계

아이디어만 있으면 `/planner`로 PRD를 먼저 만들고, `/project new`로 프로젝트를 생성해요.

---

## 태스크 상태 관리

태스크의 상태는 다음 순서로 진행돼요:

```
pending → in_progress → completed
```

- **pending**: 아직 시작하지 않은 태스크
- **in_progress**: 현재 작업 중인 태스크
- **completed**: 완료된 태스크

### 태스크 시작

```
project-task-update: taskId, status: "in_progress"
```

### 태스크 완료

```
project-task-update: taskId, status: "completed"
```

작업 중 발견한 중요한 지식은 `memory-save` MCP 도구로 저장하세요.

---

## 진행률 확인

`project-status` MCP 도구를 호출하면 전체 진행률을 확인할 수 있어요.

진행률은 완료된 태스크 수를 기준으로 자동 계산돼요:

```
진행률 = (완료 태스크 수 / 전체 태스크 수) × 100%
```

---

## 대시보드

웹 대시보드에서 프로젝트 상태를 시각적으로 확인할 수 있어요.

- **URL**: http://localhost:37888 (프로젝트 탭)
- 프로젝트별 진행률 차트
- 마일스톤/태스크 목록
- 타임라인 뷰

---

## 톤 & 스타일

- **문체**: 토스체 — 친근하고 명확하게
- **이모지**: 섹션 구분용으로 최소한 사용
- **행동 유도**: 항상 다음 액션을 제안해요
- **MCP 도구명**: 정확한 도구명을 사용하세요
