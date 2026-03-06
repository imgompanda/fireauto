---
description: "여러 AI가 동시에 일하고, 서로 대화하며 협업해요."
allowed-tools:
  - Agent
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - SendMessage
  - Read
  - Write
  - Bash
  - Glob
  - Grep
user-invocable: true
---

# /fireauto-team - 컴퍼니 모델 팀 시스템

Claude Code 빌트인 팀 기능을 활용한 멀티 에이전트 협업 시스템입니다.

## 컴퍼니 모델이란?

회사 조직처럼 동작하는 에이전트 팀 구조입니다:

- **CEO (메인 에이전트 = 당신)**: 전체 방향 설정, 태스크 승인/반려, 최종 검토
- **팀원 (서브 에이전트들)**: 각자 담당 업무 수행, 서로 `SendMessage`로 실시간 논의
- **공유 태스크 보드**: `TaskCreate/TaskUpdate`로 진행 상황 투명하게 관리

핵심 차이점:
- 기존: 파일 기반 메시지 전달 (board.md) -> 에이전트가 파일을 읽어야 소통 가능
- 지금: **SendMessage로 직접 대화** -> 에이전트끼리 자동으로 메시지 주고받으며 논의

## 1단계: 사용자로부터 정보 수집

사용자에게 다음을 확인합니다:

- **작업 목표**: 전체 프로젝트의 최종 목표
- **팀 구성**: 어떤 역할의 에이전트가 필요한지 (2~5명)
- **각 팀원 역할**: 담당할 구체적 작업 범위

사용자가 충분한 정보를 이미 제공했다면 확인 후 바로 진행합니다.

## 2단계: 팀 생성 (TeamCreate)

`TeamCreate` 도구를 사용하여 팀을 생성합니다.

```
TeamCreate 호출:
  team_name: "{프로젝트명}-team"  (예: "landing-redesign-team")
```

이렇게 하면:
- `~/.claude/teams/{team_name}/` 디렉토리가 생성됨
- 공유 태스크 보드가 자동으로 만들어짐
- 팀 내 모든 에이전트가 SendMessage로 서로 DM 가능

## 3단계: 태스크 등록 (TaskCreate)

각 팀원이 수행할 태스크를 공유 보드에 등록합니다.

```
각 워크스트림에 대해 TaskCreate 호출:
  team_name: "{team_name}"
  title: "{태스크 제목}"
  description: "{상세 설명, 산출물, 완료 조건}"
  assignee: "{팀원 이름}"  (예: "frontend-dev")
```

태스크 설계 원칙:
- 각 태스크의 **파일 수정 범위가 겹치지 않도록** 분할
- 의존성이 있으면 description에 명시 ("backend-api 태스크 완료 후 시작")
- 완료 조건을 구체적으로 작성

## 4단계: 팀원 에이전트 스폰

각 팀원을 `Agent` 도구로 생성합니다. **반드시 `team_name` 파라미터를 전달**해야 팀 기능이 활성화됩니다.

### Git Worktree 격리

코드를 수정하는 팀원은 `isolation: "worktree"` 옵션을 사용합니다.

```
Agent 호출:
  prompt: "{팀원별 상세 지시사항}"
  team_name: "{team_name}"
  isolation: "worktree"  (코드 수정이 필요한 경우)
```

**worktree란?**
Git worktree는 하나의 저장소에서 여러 브랜치를 동시에 체크아웃하는 기능입니다.
- 각 에이전트가 **별도의 작업 공간**에서 코드를 수정
- 서로의 변경사항이 충돌하지 않음
- 완료 후 메인 브랜치에 안전하게 병합 가능
- 마치 각 개발자가 자기 컴퓨터에서 독립적으로 작업하는 것과 같음

### 팀원 프롬프트 구성

각 팀원 에이전트에게 전달할 프롬프트에는 다음을 포함합니다:

```
당신은 "{팀원 이름}" 역할의 팀원입니다.

## 당신의 역할
- 담당: {구체적 업무 범위}
- 수정 가능한 파일/디렉토리: {범위}

## 협업 규칙 (중요!)

1. **다른 팀원과 적극적으로 소통하세요**
   - SendMessage로 다른 팀원에게 직접 질문하거나 정보를 공유합니다
   - 인터페이스, API 형식, 타입 정의 등은 관련 팀원과 논의 후 결정합니다
   - "이렇게 하려는데 괜찮아?" 같은 확인도 자유롭게 합니다

2. **CEO(메인 에이전트)에게 보고할 때**
   - 중요한 설계 결정이 필요할 때
   - 다른 팀원과 의견이 갈릴 때
   - 태스크 범위를 벗어나는 작업이 필요할 때

3. **태스크 상태 업데이트**
   - 작업 시작 시: TaskUpdate로 상태를 "in_progress"로 변경
   - 완료 시: TaskUpdate로 상태를 "completed"로 변경
   - 블로커 발생 시: TaskUpdate로 상태를 "blocked"로 변경하고 사유 기록

4. **금지 사항**
   - 담당 범위 외 파일 수정 금지
   - CEO 승인 없이 공유 인터페이스 변경 금지

## 구체적 태스크
{태스크 상세 내용}

## 산출물
{예상 결과물 목록}
```

## 5단계: CEO 역할 수행 + 팀 대화 관리

팀이 실행되면 당신(CEO)은 다음을 수행합니다:

### 모니터링
- `TaskList`로 전체 태스크 진행 상황 확인
- `TaskGet`으로 개별 태스크 상세 상태 확인
- 팀원들의 `SendMessage`에 응답

### 의사결정
- 팀원이 설계 결정을 요청하면 판단하여 응답
- 팀원 간 의견 충돌 시 최종 결정
- 태스크 범위 변경 승인/반려

### 검토 및 승인
- 팀원이 태스크를 완료하면 결과물 검토
- 품질 기준 충족 시 승인
- 수정 필요 시 피드백과 함께 반려

### 팀 대화 (SendMessage 활용)

팀 대화는 별도 커맨드가 아니라 팀 운영의 일부입니다.

**CEO가 할 수 있는 대화 액션:**

1. **팀원에게 직접 지시/질문**
   ```
   SendMessage to frontend-dev:
     "헤더 컴포넌트 반응형 처리 어떻게 할 건지 알려줘."
   ```

2. **팀원 간 논의 시작시키기**
   ```
   SendMessage to frontend-dev:
     "API 응답 형식을 backend-dev랑 직접 논의해서 결정해줘."
   SendMessage to backend-dev:
     "frontend-dev가 API 응답 형식 논의를 시작할 거야. 서로 맞춰줘."
   ```
   이렇게 하면 두 에이전트가 **SendMessage로 직접 대화하며** 합의합니다.

3. **전체 공지**
   모든 팀원에게 순차적으로 SendMessage를 보냅니다.

4. **에스컬레이션 응답**
   팀원이 CEO에게 결정을 요청하면 판단 후 응답합니다.

**팀원들의 자율 대화 패턴:**

```
[frontend-dev -> backend-dev]
"UserProfile에 avatarUrl 필드 추가 가능해?"

[backend-dev -> frontend-dev]
"추가했어. nullable이니 fallback 처리 부탁."

[frontend-dev -> backend-dev]
"확인. pagination은 어떻게 할 건지 같이 정하자."

[backend-dev -> CEO]
"pagination 방식을 offset vs cursor 중 CEO가 결정해주면 좋겠어."

[CEO -> backend-dev, frontend-dev]
"offset으로 가자."
```

에이전트들은 파일이 아닌 SendMessage로 **직접 대화**합니다. 유휴 상태인 에이전트도 메시지를 받으면 자동으로 깨어납니다.

## 6단계: 결과 통합

모든 태스크가 완료되면:

1. **worktree 병합**: 각 팀원의 작업을 메인 브랜치에 순차 병합
   - 병합 순서: 타입/인터페이스 -> 핵심 로직 -> UI -> 테스트
2. **충돌 해결**: 동일 파일 수정 시 내용 비교 후 병합
3. **최종 검증**: 빌드 및 테스트 실행
4. **팀 정리**: `TeamDelete`로 팀 리소스 정리

## 7단계: 최종 보고

사용자에게 다음을 보고합니다:
- 각 팀원의 완료 상태와 산출물
- 팀원 간 논의된 주요 결정 사항
- 변경된 파일 전체 목록
- 남은 작업이나 후속 조치

---

## 팀 구성 가이드

| 시나리오 | 팀 구성 | 설명 |
|---------|---------|------|
| API + 프론트 | 2명 | backend-dev, frontend-dev |
| 풀스택 기능 | 3명 | backend-dev, frontend-dev, tester |
| 대규모 리팩토링 | 4명 | type-lead, core-dev, ui-dev, test-dev |
| 랜딩페이지 | 3명 | hero-dev, features-dev, responsive-dev |

팀원 간 **파일 수정 범위가 겹치지 않도록** 분할하는 것이 핵심입니다.
