---
description: "지금 AI 팀이 뭐 하고 있는지 한눈에 확인해요."
allowed-tools:
  - TaskList
  - TaskGet
  - Read
  - Glob
  - Bash
user-invocable: true
---

# /fireauto-team-status - 팀 상태 대시보드

실행 중인 컴퍼니 모델 팀의 현재 상태를 확인합니다.

## 확인 절차

### 1. 태스크 보드 조회

`TaskList`를 사용하여 팀의 모든 태스크를 조회합니다.

각 태스크에 대해 `TaskGet`으로 상세 정보를 확인:
- 담당자 (assignee)
- 현재 상태 (pending / in_progress / completed / blocked)
- 설명 및 완료 조건

### 2. Worktree 상태 확인 (코드 작업인 경우)

git worktree가 사용 중이면 각 worktree의 상태를 확인합니다:

```bash
git worktree list
```

각 worktree의 변경사항:
```bash
git -C {worktree_path} log --oneline -3
git -C {worktree_path} diff --stat
```

### 3. 상태 리포트 출력

다음 형식으로 보고합니다:

```
============================================
  컴퍼니 팀 상태 리포트
============================================

팀: {team_name}
전체 진행률: {완료}/{전체} 태스크

--------------------------------------------
태스크 보드
--------------------------------------------

  [완료] 타입 정의 (type-lead)
    src/types/ 디렉토리 4개 파일 생성

  [진행] API 엔드포인트 구현 (backend-dev)
    src/app/api/ 3/5 엔드포인트 완료
    브랜치: worktree-backend-dev-xxxxx
    변경: 8개 파일, +342/-12

  [진행] UI 컴포넌트 (frontend-dev)
    src/components/ 2/4 컴포넌트 완료
    브랜치: worktree-frontend-dev-xxxxx
    변경: 5개 파일, +228/-0

  [대기] 통합 테스트 (tester)
    backend-dev, frontend-dev 완료 대기

--------------------------------------------
팀원 간 논의 현황
--------------------------------------------
  backend-dev <-> frontend-dev: API 응답 형식 합의 완료
  frontend-dev -> CEO: 디자인 시안 승인 요청 대기

============================================
```

### 4. 충돌 사전 감지

worktree를 사용 중인 경우, 여러 팀원이 동일 파일을 수정했는지 확인:

```bash
# 각 worktree의 변경 파일 목록을 비교
git -C {worktree_path} diff --name-only main
```

교집합이 발견되면 충돌 가능성을 경고합니다.

### 5. 추천 액션

상태에 따라 다음을 안내합니다:

- **모든 태스크 완료**: "모든 작업이 완료되었습니다. 병합을 진행할까요?"
- **블로커 발생**: "{팀원}이 블로킹되었습니다. CEO 개입이 필요합니다."
- **논의 요청 대기**: "{팀원}이 CEO의 결정을 기다리고 있습니다."
- **충돌 감지**: "다음 파일에서 충돌이 예상됩니다: {목록}"
