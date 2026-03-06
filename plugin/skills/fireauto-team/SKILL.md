---
name: fireauto-team
description: >
  This skill should be used when the user asks to "팀 에이전트", "team agent",
  "병렬 작업", "parallel work", "워크스트림", "workstream", "여러 에이전트",
  "동시에 작업", "에이전트 팀", "에이전트 간 대화", "team chat",
  "컴퍼니", "company model", or mentions multi-agent parallel workflows
  or agent coordination.
---

# 컴퍼니 모델 팀 시스템

Claude Code 빌트인 팀 기능을 활용한 멀티 에이전트 협업 패턴.

## 핵심 개념: 컴퍼니 모델

회사처럼 동작하는 에이전트 조직:

- **CEO (메인 에이전트)**: 방향 설정, 태스크 분배, 승인/반려, 최종 검토
- **팀원 (서브 에이전트)**: 각자 담당 업무 수행, **서로 SendMessage로 실시간 논의**
- **공유 태스크 보드**: TaskCreate/TaskUpdate로 진행 상황 관리

## 빌트인 도구

| 도구 | 역할 |
|------|------|
| `TeamCreate` | 팀 생성, 공유 태스크 보드 초기화 |
| `TeamDelete` | 팀 삭제 및 리소스 정리 |
| `TaskCreate` | 태스크 등록 (담당자 지정) |
| `TaskUpdate` | 태스크 상태 변경 |
| `TaskList` | 전체 태스크 조회 |
| `TaskGet` | 개별 태스크 상세 조회 |
| `SendMessage` | 에이전트 간 DM (자동 전달, 유휴 에이전트도 깨움) |
| `Agent` | 팀원 에이전트 스폰 (`team_name` 파라미터 필수) |

## Git Worktree 격리

`Agent` 호출 시 `isolation: "worktree"` 옵션을 사용하면:

- 각 에이전트가 **독립된 git 브랜치 + 작업 디렉토리**에서 작업
- 서로의 코드 변경이 충돌하지 않음
- 완료 후 메인 브랜치에 순차적으로 병합
- 마치 각 개발자가 자기 PC에서 독립적으로 개발하는 것과 같음

## 에이전트 간 대화 (SendMessage)

핵심 차별점: 에이전트들이 **파일이 아닌 SendMessage로 직접 대화**합니다.

```
frontend-dev -> backend-dev:
  "UserProfile에 avatarUrl 필드 추가해줄 수 있어?"

backend-dev -> frontend-dev:
  "추가했어. nullable이니 fallback 처리 부탁."

frontend-dev -> CEO:
  "pagination 방식을 결정해주세요. offset vs cursor."

CEO -> all:
  "offset으로 가겠습니다."
```

## 병렬 vs 순차 판단

### 병렬 (컴퍼니 모델 적합)
- 독립적인 기능/페이지/API 개발
- 프론트엔드/백엔드 분리
- 대규모 리팩토링 (모듈별)

### 순차 (단일 에이전트 적합)
- 강한 의존성 (앞선 작업 결과가 다음 입력)
- 동일 파일 집중 수정
- 분할 오버헤드 > 작업 자체

## 팀 구성 가이드

| 시나리오 | 팀원 | 분할 기준 |
|---------|------|----------|
| API + 프론트 | 2명 | backend-dev, frontend-dev |
| 풀스택 기능 | 3명 | backend, frontend, tester |
| 대규모 리팩토링 | 4명 | type-lead, core, ui, test |

## 커맨드

- `/fireauto-team` - 팀 구성, 실행, 대화 관리 (대화 기능 통합)
- `/fireauto-team-status` - 태스크 보드 및 진행 상태 확인
