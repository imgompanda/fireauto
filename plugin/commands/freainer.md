---
name: freainer
description: Claude Code 원클릭 세팅. 추천 MCP + LSP + 알림 훅을 한번에 설치해요.
---

# FreAiner 원클릭 세팅

Claude Code를 처음 쓰는 사람도 커맨드 하나로 프로급 환경을 만들 수 있어요.

---

## Step 1: 추천 MCP 자동 설치

아래 3개 MCP를 자동으로 설치하세요. 전부 **무료**이고 **API 키가 필요 없어요**.

### 1-1. Context7 (최신 문서 참조)

라이브러리/프레임워크의 **최신 공식 문서**를 실시간으로 가져와요.
AI가 오래된 정보 대신 정확한 최신 문서를 참고해요.

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

설치 후 확인:
```bash
claude mcp list
```
`context7`이 목록에 있으면 성공이에요.

### 1-2. Playwright (브라우저 자동화)

AI가 브라우저를 직접 조작해요. 웹 테스트, 스크린샷, 페이지 조작이 가능해요.

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

### 1-3. Draw.io (다이어그램 생성)

AI가 아키텍처도, 플로우차트, ERD를 직접 그려줘요. 브라우저에서 바로 편집 가능해요.

```bash
claude mcp add drawio -- npx -y @drawio/mcp
```

**3개 모두 설치한 후** `claude mcp list`로 확인하세요.
context7, playwright, drawio가 모두 보이면 완료예요.

---

## Step 2: LSP 설치 (코드 탐색 강화)

LSP를 켜면 AI가 코드를 **텍스트 검색 대신 구조를 이해하면서** 탐색해요.

유저에게 물어보세요:

> 어떤 개발을 주로 하세요?
> 1. 웹 개발 (React, Next.js, Vue 등)
> 2. 백엔드 개발 (Node.js, Python, Go 등)
> 3. iOS 개발 (Swift, SwiftUI)
> 4. 안드로이드 개발 (Kotlin, Java)
> 5. 시스템 개발 (Rust, C, C++)
> 6. 게임 개발 (Unity C#, Unreal C++)
> 7. 자동 감지 (프로젝트 파일 보고 판단)

선택에 따라 아래 Language Server를 설치하세요:

| 카테고리 | 설치할 Language Server |
|----------|----------------------|
| 웹 개발 | TypeScript (`typescript-language-server`), CSS (`vscode-css-languageserver-bin`) |
| 백엔드 (Node) | TypeScript (`typescript-language-server`) |
| 백엔드 (Python) | Python (`pyright`) |
| 백엔드 (Go) | Go (`gopls`) |
| iOS | Swift (`sourcekit-lsp`) — Xcode와 함께 설치됨 |
| 안드로이드 | Kotlin (`kotlin-language-server`) |
| 시스템 (Rust) | Rust (`rust-analyzer`) |
| 시스템 (C/C++) | C/C++ (`clangd`) |
| 게임 (Unity) | C# (`omnisharp`) |
| 자동 감지 | 프로젝트의 package.json, requirements.txt, go.mod 등을 확인하고 적절한 것을 설치 |

### 웹 개발 예시 (가장 흔한 케이스):

```bash
npm install -g typescript typescript-language-server
```

### LSP 환경변수 설정:

유저의 `~/.claude/settings.json`을 읽고, `env` 필드에 아래를 추가하세요:

```json
{
  "env": {
    "ENABLE_LSP_TOOL": "1"
  }
}
```

이미 `env` 필드가 있으면 기존 값을 유지하고 `ENABLE_LSP_TOOL`만 추가하세요.

### LSP 플러그인 활성화:

선택한 카테고리에 맞는 LSP 플러그인을 `enabledPlugins`에 추가하세요:

| 카테고리 | 플러그인 |
|----------|---------|
| 웹 개발 / 백엔드 (Node) | `typescript-lsp@claude-plugins-official` |
| 백엔드 (Python) | `pyright-lsp@claude-plugins-official` |
| iOS | `swift-lsp@claude-plugins-official` |

### LSP 자동 사용 규칙 추가:

유저의 `~/.claude/CLAUDE.md`를 읽고, 아래 내용이 없으면 추가하세요:

```markdown
- 코드 탐색 시 LSP 도구를 Grep/Glob보다 먼저 사용할 것. 정의 찾기(goToDefinition), 참조 찾기(findReferences), 심볼 검색(workspaceSymbol), 호출 추적(incomingCalls/outgoingCalls)은 LSP로 먼저 시도하고, 텍스트/패턴 검색만 Grep 사용.
```

이미 비슷한 내용이 있으면 건너뛰세요.
`~/.claude/CLAUDE.md` 파일이 없으면 새로 만드세요.
기존 내용이 있으면 **맨 아래에 추가**하세요. 절대 기존 내용을 덮어쓰지 마세요.

---

## Step 3: 알림 훅 설정

작업이 끝나면 macOS 알림으로 알려줘요. 다른 일 하다가도 놓치지 않아요.

유저의 `~/.claude/settings.json`을 읽고, `hooks` 필드에 아래를 추가하세요:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"작업이 완료됐어요!\" with title \"Claude Code\" sound name \"Ping\"'"
          }
        ]
      }
    ]
  }
}
```

이미 `hooks` 필드가 있으면 기존 훅을 유지하고 `Notification`만 추가하세요.
이미 `Notification` 훅이 있으면 건너뛰세요.

---

## Step 4: 에이전트 팀 활성화

여러 AI가 동시에 작업하는 팀 기능을 켜요.

유저의 `~/.claude/settings.json`의 `env` 필드에 추가하세요:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

---

## Step 5: fireauto 스킬 자동 트리거 설정

fireauto 플러그인의 스킬들이 특정 상황에서 자동으로 활성화되도록 CLAUDE.md에 규칙을 추가해요.

### 유저에게 범위를 물어보세요:

> fireauto 스킬 자동 트리거를 어디에 적용할까요?
> 1. **전체** — 모든 프로젝트에서 자동 트리거 (`~/.claude/CLAUDE.md`)
> 2. **이 프로젝트만** — 현재 프로젝트에서만 자동 트리거 (`.claude/CLAUDE.md`)
> 3. **건너뛰기** — 나중에 설정할게요

### 선택에 따라 해당 CLAUDE.md에 아래 내용을 추가하세요:

```markdown
## fireauto 자동 트리거 규칙

### 메모리 시스템 (fireauto-mem)
- 코드를 수정하거나 새 기능을 구현할 때, 해당 파일/주제에 관련된 과거 지식이 있는지 memory-search MCP 도구로 능동적으로 확인하고 답변에 반영할 것.
- 버그 수정, 패턴 발견, 설계 결정, 주의사항 등 가치 있는 지식이 발생하면 memory-save MCP 도구로 능동적으로 저장할 것. 사용자가 요청하지 않아도 자동으로 저장.
- 프로젝트 마일스톤 완료, 인수인계, 회고 시 memory-compile MCP 도구로 축적된 지식을 종합할 것.

### SEO/보안 점검
- 웹 프로젝트에서 배포 전이나 기능 완성 시 SEO 관련 이슈가 없는지 fireauto-seo-guide 스킬을 참고할 것.
- 인증, API, 파일 업로드 등 보안 민감 코드를 수정할 때 fireauto-secure-guide 스킬을 참고할 것.

### UI 개발
- DaisyUI 컴포넌트를 사용하거나 UI를 구축할 때 fireauto-ui-guide 스킬을 참고할 것.

### 프로젝트 하네스 (자동 진행)
- 세션 시작 시 project-status MCP로 현재 프로젝트 상태를 확인하고, 사용자에게 "오늘 할 일"을 자동으로 알려줄 것.
- 태스크를 완료하면 project-task-update MCP로 상태를 변경하고, project-next MCP로 다음 태스크를 자동 제안할 것.
- 마일스톤의 모든 태스크가 완료되면 자동으로 다음 마일스톤 시작을 제안할 것.

### 자기 학습 (실수 → 규칙 → 스킬)
- 사용자가 수정을 요청하면 mistake-log MCP로 실수를 기록하고, wiki-write로 gotchas.md를 업데이트할 것.
- 같은 패턴이 3회 이상 반복되면 skill-save MCP로 스킬을 생성할 것.
- 실수 기반 규칙은 즉시 CLAUDE.md에 추가할 것 (80줄 이내 유지).

### 복기 (세션 종료 시)
- 세션이 끝나기 전에 retrospect MCP로 복기를 실행할 것.
- 복기에서 발견된 패턴은 memory-save로, 실수는 mistake-log로 기록할 것.
- 복기 결과를 바탕으로 CLAUDE.md 또는 프로젝트 스킬을 업데이트할 것.

### Wiki 관리
- 중요한 지식은 wiki-write MCP로 해당 페이지에 기록할 것 (patterns/gotchas/decisions/skills-catalog).
- 코드 작업 전 wiki-read로 관련 지식 페이지를 능동적으로 확인할 것.
- CLAUDE.md가 80줄을 넘으면 오래된 규칙을 wiki로 이동할 것.

### 지식 탐색 순서 (필수)
- 지식이 필요할 때: CLAUDE.md 확인 → wiki-read → skill-search → memory-search 순서로 탐색.
- 이전 프로젝트 경험이 필요할 때: skill-search와 mistake-search로 능동적으로 검색할 것.

### 자동 린트 + 자가 치유
- 코드 수정 후 린트 에러가 감지되면 사용자에게 묻기 전에 최대 3회 자동 수정 시도할 것.
- 성공하면 조용히 넘어가고, 3회 실패 시에만 사용자에게 보고할 것.
```

### 적용 위치:

| 선택 | 파일 경로 | 효과 |
|------|----------|------|
| 전체 | `~/.claude/CLAUDE.md` | 모든 프로젝트에서 자동 트리거 |
| 이 프로젝트만 | `.claude/CLAUDE.md` (프로젝트 루트) | 이 프로젝트에서만 |

### 주의:
- 파일이 없으면 새로 만드세요.
- **기존 내용을 절대 덮어쓰지 마세요.** 맨 아래에 추가하세요.
- 이미 비슷한 내용이 있으면 건너뛰세요.

---

## Step 6: 메모리 시스템 설치

개발 지식 데이터베이스를 자동으로 구축하는 메모리 시스템을 설치해요.

유저에게 물어보세요:

> 메모리 시스템을 설치할까요? AI가 작업 기록을 자동으로 축적하고, 다음 세션에서 참고해요.
> 1. **설치** — 지금 바로 설치
> 2. **건너뛰기** — 나중에 /memory-install로 설치

"설치"를 선택하면 /memory-install 커맨드의 절차를 실행하세요:
1. `~/.fireauto-mem/` 디렉토리 생성
2. `plugin/scripts/mem/package.json`을 복사하고 `npm install`
3. DB 초기화
4. Hook 스크립트 chmod +x

---

## Step 7: 프로젝트 세팅 (선택)

유저에게 물어보세요:

> 지금 바로 프로젝트를 시작할까요?
> 1. **시작** — PRD, CLAUDE.md, Wiki, 마일스톤을 자동 생성
> 2. **나중에** — 나중에 `/project new`로 시작

"시작"을 선택하면:

### 7-1: 프로젝트 파악
> "어떤 프로젝트를 만들 건가요? 한 줄로 설명해주세요."

### 7-2: PRD 생성
/planner를 참고하여 간단한 PRD를 생성하세요.

### 7-3: CLAUDE.md 자동 생성
`claude-md-generator.cjs`를 활용하여:
- 기술 스택 자동 감지 (package.json, requirements.txt 등)
- 프로젝트에 맞는 CLAUDE.md 생성 (60~80줄 이내)
- 이전 프로젝트 실수/스킬 참고 (skill-search, mistake-search MCP)

### 7-4: Wiki 초기화
`.claude/wiki/` 디렉토리 생성:
- patterns.md, gotchas.md, decisions.md, skills-catalog.md, retrospective.md, index.md

### 7-5: 마일스톤/태스크 분해
PRD에서 마일스톤과 태스크를 자동 추출하여 DB에 저장.

### 7-6: 이전 프로젝트 지식 참고
`skill-search`, `mistake-search` MCP로 이전 프로젝트의 스킬/주의사항 검색.
있으면 "이전 프로젝트에서 이런 스킬/주의사항이 있어요. 적용할까요?" 물어보기.

---

## Step 8: 최종 확인

설치가 끝나면 유저에게 아래 내용을 보여주세요:

```
✅ FreAiner 세팅 완료!

📦 설치된 MCP:
  • context7 — 라이브러리 최신 문서 자동 참조
  • playwright — 브라우저 자동화 + 테스트
  • drawio — 다이어그램 자동 생성

🔧 설정 완료:
  • LSP — 코드 탐색 극대화
  • 알림 훅 — 작업 완료 시 macOS 알림
  • 에이전트 팀 — 멀티 에이전트 협업
  • 스킬 자동 트리거 — 상황에 맞게 자동 활성화
  • 메모리 시스템 — 개발 지식 자동 축적
  • 자기학습 — 실수에서 배우고 스킬 자동 생성
  • 복기 시스템 — 세션마다 자동 복기

이제 AI가 알아서:
  → 작업 기록을 자동으로 축적해요
  → 실수하면 자동으로 규칙을 업데이트해요
  → 세션 끝나면 자동으로 복기해요
  → 다음 세션에 "오늘 할 일"을 알려줘요

⚠️ Claude Code를 재시작해야 모든 설정이 적용돼요!
```

---

## 주의사항

- `settings.json`을 수정할 때는 반드시 **기존 설정을 보존**하세요. 덮어쓰기 금지!
- MCP 설치는 `claude mcp add` 명령어를 Bash로 실행하세요.
- 이미 설치된 MCP가 있으면 건너뛰세요 (`claude mcp list`로 확인).
- 이미 설정된 환경변수나 훅이 있으면 건너뛰세요.
