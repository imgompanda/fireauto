---
name: init
description: "프로젝트를 시작해요. AI가 PRD, CLAUDE.md, 스킬, 마일스톤을 자동으로 만들어줘요."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
user-invocable: true
---

# /init — 프로젝트 원클릭 세팅

AI가 대화하면서 프로젝트를 자동으로 세팅해요.
모든 출력은 **한국어(토스체)**로 작성하고, 기술 용어는 영어를 병기해요.

---

## 실행 흐름

### Step 1: 프로젝트 파악

사용자에게 물어보세요:

> 어떤 프로젝트를 만들 건가요? 한 줄로 설명해주세요.

사용자가 이미 아이디어를 제공한 경우, 추가 질문 없이 바로 Step 2로 진행해요.

---

### Step 2: PRD 생성

/planner를 참고하여 간단한 PRD를 생성하세요.
전체 PRD가 아닌, 핵심 3가지만 빠르게 정리해요:

- **프로젝트 개요**: 서비스명, 한 줄 설명, 해결하는 문제
- **핵심 기능**: P0(MVP 필수) / P1(있으면 좋은) / P2(향후 확장) 분류
- **기술 스택**: 프론트엔드, 백엔드, DB, 인프라 추천

PRD는 `docs/prd/{서비스명-kebab-case}.md` 경로에 저장해요.

---

### Step 3: CLAUDE.md 자동 생성

`claude-md-generator.cjs`를 Bash로 실행하여 프로젝트에 맞는 CLAUDE.md를 생성하세요.

```bash
node /Users/browoo/Documents/fireauto/plugin/scripts/mem/claude-md-generator.cjs --project-root "$(pwd)" --project-name "{프로젝트명}" --description "{한줄설명}"
```

생성 규칙:
- 60~80줄 이내
- Claude가 추측할 수 없는 핵심 규칙만 포함
- 상세 지식은 `.claude/wiki/`로 위임
- 기술 스택은 자동 감지 (package.json, requirements.txt 등)

스크립트가 실행 불가능한 환경이면, 직접 CLAUDE.md를 작성해요:

1. 프로젝트 루트의 `.claude/` 디렉토리 확인/생성
2. 기술 스택 기반 핵심 규칙 작성
3. `.claude/wiki/` 참조 링크 추가

---

### Step 4: Wiki 초기화

`.claude/wiki/` 디렉토리를 생성하고 초기 페이지를 만드세요:

| 페이지 | 용도 |
|--------|------|
| `patterns.md` | 발견된 코딩 패턴과 모범 사례 |
| `gotchas.md` | 삽질 기록과 함정 |
| `decisions.md` | 설계 결정 기록 |
| `skills-catalog.md` | 자동 생성된 스킬 목록 |
| `retrospective.md` | 세션별 복기 기록 |
| `index.md` | 자동 생성되는 목차 (수정 금지) |

`wiki-manager.cjs`의 `initWiki()` 함수를 활용하면 돼요:
```bash
node -e "require('/Users/browoo/Documents/fireauto/plugin/scripts/mem/wiki-manager.cjs').initWiki('$(pwd)')"
```

---

### Step 5: 마일스톤/태스크 분해

PRD에서 마일스톤과 태스크를 자동 분해하여 DB에 저장하세요.

1. PRD의 P0/P1/P2 기능을 마일스톤으로 매핑해요
2. 각 마일스톤 아래 구체적인 태스크를 생성해요
3. `project-status` MCP 도구로 프로젝트 대시보드를 보여주세요

---

### Step 6: 이전 프로젝트 지식 참고

`memory-search` MCP 도구로 관련 지식이 있는지 검색하세요.

검색 키워드:
- 프로젝트의 기술 스택 (React, Next.js, Supabase 등)
- 도메인 키워드 (인증, 결제, 대시보드 등)
- 비슷한 프로젝트 패턴

관련 지식이 있으면 사용자에게 물어보세요:

> 이전 프로젝트에서 이런 지식이 있어요. 적용할까요?
> - {관련 지식 1}
> - {관련 지식 2}

없으면 이 Step은 건너뛰세요.

---

### Step 7: 완료 메시지

모든 세팅이 끝나면 아래 형식으로 보여주세요:

```
프로젝트 세팅 완료!

PRD: docs/prd/{project}.md
CLAUDE.md: 생성됨 ({줄수}줄)
Wiki: .claude/wiki/ ({페이지수}개 페이지)
마일스톤: {count}개
태스크: {count}개

/next 로 첫 태스크를 시작하세요!
대시보드: http://localhost:37888
```

---

## 주의사항

- CLAUDE.md는 **80줄 이내** 엄수. 초과 시 wiki로 이동해요.
- 기존 CLAUDE.md가 있으면 **덮어쓰지 말고** 백업 후 병합해요.
- PRD 생성 시 WebSearch는 사용하지 않아요 (빠른 세팅이 목적).
- 사용자가 기술 스택을 직접 지정하면 자동 감지보다 우선해요.

---

## 톤 & 스타일 가이드

- **언어**: 한국어 (기술 용어는 영어 병기)
- **문체**: 토스체 — 친근하고 명확하게
- **구조**: 표, 리스트를 적극 활용해요
- **속도**: 질문은 최소화하고, 가능한 자동으로 판단해요
