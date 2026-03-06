---
name: fireauto-team
description: >
  This skill should be used when the user asks to "팀 에이전트", "team agent",
  "병렬 작업", "parallel work", "워크스트림", "workstream", "여러 에이전트",
  "동시에 작업", "에이전트 팀", "에이전트 간 대화", "team chat", or
  mentions multi-agent parallel workflows or agent coordination.
---

# 팀 에이전트 패턴

복잡한 작업을 여러 워크스트림으로 분할하여 병렬로 실행하는 패턴. 각 워크스트림은 독립된 에이전트가 담당하며, 코디네이터가 전체를 조율한다.

## 병렬 vs 순차 판단

### 병렬이 적합한 경우
- 독립적인 기능 개발 (서로 다른 페이지, 컴포넌트, API)
- 프론트엔드/백엔드 분리 (인터페이스 계약 명확 시)
- 대규모 리팩토링 (모듈별 분리)
- 다국어 콘텐츠 (언어별 분산)

### 순차가 적합한 경우
- 강한 의존성 (앞선 작업의 결과가 다음의 입력)
- 동일 파일 집중 수정
- 설계 → 구현 → 테스트 단계적 진행
- 분할 오버헤드 > 작업 자체

## 워크스트림 설계 원칙

1. **경계 명확화**: "이 워크스트림은 이 디렉토리만 수정"
2. **인터페이스 선행 정의**: 공유 타입, API 스키마를 먼저 확정
3. **적절한 크기**: 2개(가장 안정) ~ 5개(대규모만)
4. **의존성 최소화**: 의존성 많으면 병렬 이점 상실

## 에이전트 격리

### Git Worktree (권장)
```bash
git worktree add .worktrees/ws-1-frontend -b fireauto/ws-1-frontend
git worktree add .worktrees/ws-2-backend -b fireauto/ws-2-backend
```

### 병합 순서
1. 인터페이스/타입 → 2. 핵심 로직 → 3. UI → 4. 테스트/문서

## 에이전트 간 대화

`.claude/team-chat/` 디렉토리를 통해 에이전트가 소통한다:
- `board.md` — 전체 메시지 보드
- `decisions.md` — 코디네이터 결정 사항

메시지 형식: `[HH:MM] @ws-{N}-{name} → @수신자: 내용`

## 실전 사례

| 사례 | 워크스트림 | 분할 |
|------|-----------|------|
| 랜딩페이지 리뉴얼 | 3개 | 히어로+네비, 가격+기능, 반응형+접근성 |
| API + 프론트 | 2개 | 백엔드 API, 프론트엔드 UI |
| 대규모 리팩토링 | 4개 | 타입, 컴포넌트, 상태관리, 테스트 |

## 커맨드

- `/fireauto-team` — 팀 구성 및 실행
- `/fireauto-team-status` — 진행 상태 확인
- `/fireauto-team-chat` — 에이전트 간 대화 확인/전송
