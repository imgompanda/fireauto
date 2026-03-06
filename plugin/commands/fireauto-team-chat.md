---
description: "팀 에이전트 간 메시지 전달 및 대화"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
user-invocable: true
---

# /fireauto-team-chat - 에이전트 간 대화 시스템

팀 에이전트들이 서로 메시지를 주고받으며 협업할 수 있는 대화 시스템입니다.

## 메시지 보드 구조

모든 에이전트 간 대화는 `.claude/team-chat/` 디렉토리에 저장됩니다.

### 파일 구조

```
.claude/team-chat/
├── board.md              # 전체 메시지 보드 (모든 에이전트가 읽고 쓰기)
├── ws-1-to-ws-2.md       # WS-1 → WS-2 다이렉트 메시지
├── ws-2-to-ws-1.md       # WS-2 → WS-1 다이렉트 메시지
└── decisions.md          # 코디네이터 결정 사항 기록
```

## 사용 방법

사용자에게 다음 중 하나를 선택하도록 합니다:

1. **메시지 보드 확인** — 현재 팀 대화 내용 조회
2. **메시지 보내기** — 특정 워크스트림에 메시지 전달
3. **전체 공지** — 모든 워크스트림에 공지 전달
4. **결정 사항 기록** — 코디네이터 레벨 결정 사항 기록

## 메시지 보드 (board.md) 형식

```markdown
# Team Chat Board

## 규칙
- 새 메시지는 항상 맨 아래에 추가합니다
- 메시지 형식: `[시간] @발신자 → @수신자: 내용`
- 전체 공지: `[시간] @발신자 → @all: 내용`
- 응답: `[시간] @발신자 → @수신자 (RE: 원문요약): 내용`

## Messages

[14:30] @coordinator → @all: 공유 타입 파일은 src/types/shared.ts에 정의합니다. 이 파일은 WS-1만 수정 권한이 있습니다.

[14:35] @ws-2-frontend → @ws-1-backend: UserProfile 타입에 avatarUrl 필드 추가 가능한가요? UI에서 프로필 이미지를 표시해야 합니다.

[14:40] @ws-1-backend → @ws-2-frontend (RE: avatarUrl): 추가했습니다. src/types/shared.ts에서 확인해주세요. nullable이니 fallback 처리 부탁합니다.

[14:45] @ws-3-test → @coordinator: 테스트 환경 설정에서 DATABASE_URL 모킹 방식을 결정해야 합니다. MSW vs jest.mock 중 어느 것을 사용할까요?

[14:50] @coordinator → @ws-3-test: MSW를 사용합니다. 프로젝트에 이미 msw가 설치되어 있고, 다른 프로젝트에서도 MSW 패턴을 사용하고 있습니다.
```

## 다이렉트 메시지 형식

워크스트림 간 1:1 메시지가 필요한 경우 별도 파일을 사용합니다.

```markdown
# DM: WS-1 (Backend) ↔ WS-2 (Frontend)

[14:35] @ws-2: API 응답 형식이 { data: T, error?: string } 맞나요?
[14:38] @ws-1: 네, 맞습니다. 에러 시에는 { data: null, error: "message" } 형식입니다. HTTP 상태 코드도 함께 보내니 참고해주세요.
[14:40] @ws-2: 확인. pagination은 어떻게 되나요?
[14:42] @ws-1: { data: T[], meta: { total, page, limit } } 형식입니다. meta 타입은 shared.ts에 PaginationMeta로 정의해두겠습니다.
```

## 결정 사항 기록 (decisions.md) 형식

```markdown
# Team Decisions

코디네이터가 내린 결정 사항을 기록합니다. 모든 워크스트림은 이 파일을 정기적으로 확인해야 합니다.

## DEC-001: MSW 사용 결정
- 일시: 2026-03-06 14:50
- 요청자: WS-3
- 결정: 테스트 모킹에 MSW 사용
- 사유: 프로젝트에 이미 설치됨, 팀 표준 패턴
- 영향: WS-3 (테스트), WS-1 (API 핸들러 작성 시 참고)

## DEC-002: 상태 관리 라이브러리
- 일시: 2026-03-06 15:10
- 요청자: WS-2
- 결정: Zustand 사용
- 사유: 이미 프로젝트에서 사용 중, 러닝커브 최소화
- 영향: WS-2 (프론트엔드 상태 관리)
```

## 에이전트 프롬프트에 추가할 대화 규칙

각 워크스트림 에이전트를 스폰할 때, 다음 대화 규칙을 프롬프트에 포함합니다:

```
## 팀 대화 규칙

당신은 다른 워크스트림 에이전트와 메시지 보드를 통해 소통합니다.

### 메시지 확인
- 작업 시작 전 `.claude/team-chat/board.md`를 읽어 최신 공지와 결정 사항을 확인합니다.
- `.claude/team-chat/decisions.md`에 새로운 결정이 있으면 반드시 반영합니다.
- 자신에게 온 다이렉트 메시지가 있으면 확인하고 응답합니다.

### 메시지 발신
- 다른 워크스트림에 질문이나 요청이 있으면 board.md에 메시지를 추가합니다.
- 형식: `[HH:MM] @ws-{N}-{name} → @ws-{M}-{name}: 내용`
- 전체 공지가 필요하면: `[HH:MM] @ws-{N}-{name} → @all: 내용`
- 코디네이터에게 결정 요청: `[HH:MM] @ws-{N}-{name} → @coordinator: 내용`

### 대화 원칙
1. 메시지는 구체적이고 간결하게 작성합니다.
2. 질문에는 맥락(왜 필요한지)을 포함합니다.
3. 응답에는 결정 사항과 관련 파일 경로를 포함합니다.
4. 인터페이스 변경 요청은 반드시 coordinator를 통해 합니다.
5. 긴급하지 않은 요청은 배치하여 한 번에 보냅니다.
```

## 실행 흐름

사용자가 `/fireauto-team-chat`을 실행하면:

1. `.claude/team-chat/` 디렉토리 존재 여부 확인
2. 존재하면 → 메시지 보드 내용을 보여주고 다음 액션 선택 요청
3. 존재하지 않으면 → "활성 팀이 없습니다. `/fireauto-team`으로 팀을 먼저 생성해주세요." 안내
4. 사용자가 메시지를 보내면 → 해당 메시지를 board.md에 추가
5. 사용자가 결정 사항을 기록하면 → decisions.md에 추가
