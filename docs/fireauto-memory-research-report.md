# fireauto 메모리 시스템 구현 조사 보고서

> **작성일**: 2026-04-05
> **목적**: fireauto 플러그인에 지식 관리 메모리 시스템을 추가하기 위한 기술 조사
> **참고 대상**: claude-mem (thedotmack) 플러그인 v10.6.3

---

## 1. 요약 (Executive Summary)

fireauto에 MCP 기반 메모리 시스템을 구현하기 위해 claude-mem의 전체 아키텍처를 분석했다.
핵심 발견: claude-mem은 **Hook → Worker HTTP → SQLite + Chroma → MCP Server → SSE UI** 구조로 동작하며, Agent SDK를 사용해 AI가 관찰 데이터를 자동 압축한다.

fireauto 메모리 시스템은 이 구조를 **경량화**하여 구현할 수 있다:
- Agent SDK 의존성 제거 (비용/복잡성 감소)
- Chroma 벡터 DB 제거 (SQLite FTS5로 대체)
- React 번들 대신 단일 HTML + vanilla JS로 한국어 UI 구현
- 플러그인 커맨드(`/memory-install`)로 원클릭 설치

---

## 2. claude-mem 아키텍처 분석

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────┐
│            Claude Code (사용자 세션)               │
└────────┬────────────────────────────────────────┘
         │
    5개 Hook 트리거
         │
         ├─→ beforeSubmitPrompt: session-init.sh (세션 초기화)
         ├─→ afterMCPExecution: save-observation.sh (MCP 도구 사용 기록)
         ├─→ afterShellExecution: save-observation.sh (쉘 명령 기록)
         ├─→ afterFileEdit: save-file-edit.sh (파일 수정 기록)
         └─→ stop: session-summary.sh (세션 요약 생성)
                │
                └─→ HTTP 요청 (localhost:37777)
                    │
                    └─→ Worker Service (Express.js)
                        │
                        ├─→ SDKAgent (Agent SDK로 Claude 서브프로세스 생성)
                        │   └─→ 관찰 데이터 → XML 파싱 → 구조화
                        │
                        ├─→ SQLite Database
                        │   ├─ sessions (세션 정보)
                        │   ├─ observations (관찰 기록)
                        │   ├─ summaries (세션 요약)
                        │   └─ user_prompts (사용자 입력)
                        │
                        ├─→ Chroma (벡터 DB, 의미론적 검색)
                        │
                        ├─→ MCP Server (stdio, 6개 도구)
                        │   ├─ search (인덱스 검색)
                        │   ├─ timeline (시간순 탐색)
                        │   ├─ get_observations (상세 조회)
                        │   ├─ smart_search (AST 기반 코드 검색)
                        │   ├─ smart_unfold (심볼 펼치기)
                        │   └─ smart_outline (구조 보기)
                        │
                        └─→ SSE Stream → React UI (localhost:37777)
```

### 2.2 MCP 서버 구현 상세

**프로토콜**: `@modelcontextprotocol/sdk` v1.25.1, stdio transport
**패턴**: Thin HTTP Wrapper — MCP 서버는 비즈니스 로직 없이 Worker HTTP API로 위임

```
MCP Tool 호출 → callWorkerAPI() → HTTP GET/POST → Worker 처리 → JSON 응답
```

**핵심 설계 결정**:
- MCP 서버와 Worker 분리 → Worker 핫리로드 가능
- 부모 프로세스 heartbeat (30초) → 좀비 프로세스 방지
- `.mcp.json`에 stdio 타입으로 등록

```json
{
  "mcpServers": {
    "mcp-search": {
      "type": "stdio",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.cjs"
    }
  }
}
```

### 2.3 3계층 토큰 효율 검색

claude-mem의 가장 영리한 설계:

| 단계 | 반환 | 토큰 비용 |
|------|------|----------|
| 1. `search` | ID + 제목 인덱스 | ~50-100/건 |
| 2. `timeline` | 시간순 컨텍스트 | ~100-200/건 |
| 3. `get_observations` | 전체 상세 | ~500-1000/건 |

→ 필요한 것만 단계적으로 가져와서 **토큰 10배 절감**

### 2.4 Agent SDK 사용 방식

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Claude 서브프로세스 생성
const queryResult = query({
  model: modelId,
  cwd: OBSERVER_SESSIONS_DIR,
  resume: memorySessionId,       // 세션 재개용
  disallowedTools: [...],        // Bash, Read, Write 등 차단
  abortController,
  claudePath,
  spawnClaudeCodeProcess: createPidCapturingSpawn(sessionId),
  env: buildIsolatedEnv(),
});

// 비동기 이벤트 루프
for await (const message of queryResult) {
  // session_id 캡처, 토큰 추적, XML 파싱
}
```

**XML 응답 파싱**:
```xml
<observation>
  <type>bugfix</type>
  <title>인증 버그 수정</title>
  <facts><fact>하드코딩된 토큰 제거</fact></facts>
  <narrative>...</narrative>
</observation>
```

**CLAIM-CONFIRM 패턴** (크래시 복구):
1. DB에 먼저 저장 (CLAIM)
2. DB 트랜잭션 성공 후 큐에서 제거 (CONFIRM)
→ 중간에 크래시해도 데이터 유실 없음

### 2.5 UI 뷰어 구현

**프레임워크**: React 18 + TypeScript
**렌더링**: `react-dom/client` createRoot, 단일 HTML 템플릿에 번들 임베드
**실시간 업데이트**: SSE (Server-Sent Events) via `/stream` 엔드포인트
**다국어**: UI 자체에 i18n 없음 (모드 프롬프트만 30개 언어 지원)

**컴포넌트 구조**:
```
App.tsx
├── Header (연결 상태, 프로젝트 필터, 테마 토글)
├── Feed (무한 스크롤)
│   ├── ObservationCard (관찰 카드 — type, title, facts, narrative)
│   ├── SummaryCard (세션 요약)
│   └── PromptCard (사용자 프롬프트)
├── ContextSettingsModal (설정)
└── LogsDrawer (콘솔 로그)
```

**데이터 흐름**:
```
useSSE() hook → EventSource('/stream') → 실시간 데이터 수신
usePagination() hook → REST API → 과거 데이터 페이지네이션
두 소스를 mergeAndDeduplicateByProject()로 병합
```

**CSS**: viewer-template.html에 2800+ 줄 인라인 CSS (다크/라이트 테마, CSS 변수 기반)

### 2.6 자동 설치 메커니즘

**claude-mem의 설치 흐름**:
```
플러그인 활성화
  → SessionStart 훅 → smart-install.js 실행
    → Bun 런타임 확인/설치 (curl | bash)
    → uv (Python) 확인/설치
    → node_modules 설치 (bun install, npm 폴백)
    → .install-version 마커 파일 생성
    → CLI 별칭 등록 (~/.zshrc)
    → Worker 서비스 시작 (bun run worker-service.cjs start)
```

**핵심 패턴**:
- `.install-version` 마커로 중복 설치 방지
- stderr로 상태 출력, stdout으로 JSON 제어 신호
- 300초 타임아웃 (설치), 60초 타임아웃 (서비스 시작)
- 설치 실패 시 graceful fallback (bun → npm)

---

## 3. fireauto 메모리 시스템 설계 제안

### 3.1 설계 원칙

| 원칙 | claude-mem | fireauto (제안) |
|------|-----------|----------------|
| **AI 압축** | Agent SDK (Claude 서브프로세스) | 제거 — Hook에서 직접 구조화 |
| **벡터 검색** | Chroma DB | SQLite FTS5 (전문 검색) |
| **런타임** | Bun + Node.js | Node.js only (범용성) |
| **UI** | React 번들 | 단일 HTML (vanilla JS) |
| **언어** | 영어 (30개 프롬프트 언어) | **한국어** UI + 영어 지원 |
| **설치** | smart-install.js (Bun, uv, Chroma) | `/memory-install` 커맨드 |

### 3.2 제안 아키텍처

```
┌─────────────────────────────────────────────────┐
│            Claude Code (사용자 세션)               │
└────────┬────────────────────────────────────────┘
         │
    Hook 트리거 (3개로 축소)
         │
         ├─→ PostToolUse: 도구 사용 기록
         ├─→ Stop: 세션 요약 생성
         └─→ SessionStart: Worker 시작
                │
                └─→ HTTP 요청 (localhost:37888)
                    │
                    └─→ fireauto-mem Worker (Express.js, Node.js)
                        │
                        ├─→ SQLite Database (better-sqlite3)
                        │   ├─ memories (지식 기록)
                        │   │   - id, session_id, project
                        │   │   - type (decision/bugfix/feature/pattern/gotcha)
                        │   │   - title, content, tags
                        │   │   - files_involved
                        │   │   - created_at
                        │   │   + FTS5 전문 검색 인덱스
                        │   │
                        │   ├─ sessions (세션 추적)
                        │   └─ summaries (세션 요약)
                        │
                        ├─→ MCP Server (stdio)
                        │   ├─ memory-search (키워드/전문 검색)
                        │   ├─ memory-timeline (시간순 조회)
                        │   ├─ memory-save (수동 저장)
                        │   └─ memory-detail (상세 조회)
                        │
                        └─→ SSE → 한국어 UI (localhost:37888)
```

### 3.3 MCP 도구 설계

```json
{
  "mcpServers": {
    "fireauto-mem": {
      "type": "stdio",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/mem-server.cjs"
    }
  }
}
```

**제공 도구 4개**:

| 도구 | 설명 | 입력 | 출력 |
|------|------|------|------|
| `memory-search` | 키워드/태그로 메모리 검색 | `query`, `type?`, `project?`, `limit?` | ID + 제목 인덱스 |
| `memory-timeline` | 최근 N일간 활동 | `days?`, `project?` | 시간순 요약 |
| `memory-save` | 수동으로 메모리 저장 | `title`, `content`, `type`, `tags[]` | 저장된 ID |
| `memory-detail` | ID로 상세 조회 | `ids[]` | 전체 내용 |

### 3.4 Hook 설계

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|clear|compact",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/mem-worker.cjs start",
        "timeout": 60
      }]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/save-observation.sh",
        "timeout": 10
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/save-summary.sh",
        "timeout": 30
      }]
    }]
  }
}
```

### 3.5 DB 스키마

```sql
-- 메모리 테이블
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('decision','bugfix','feature','pattern','gotcha','refactor')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',        -- JSON array
  files_involved TEXT DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL
);

-- 전문 검색 인덱스
CREATE VIRTUAL TABLE memories_fts USING fts5(
  title, content, tags,
  content='memories',
  content_rowid='id'
);

-- 세션 테이블
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT DEFAULT 'active'
);

-- 요약 테이블
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  request TEXT,
  what_done TEXT,
  what_learned TEXT,
  next_steps TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
```

### 3.6 한국어 UI 설계

**단일 HTML 파일** (viewer-template.html) — React 번들 대신 vanilla JS:

```
┌─────────────────────────────────────────────────┐
│  🔥 fireauto 메모리 뷰어          🔍 검색  ☀️/🌙  │
├─────────────────────────────────────────────────┤
│  프로젝트: [전체 ▼]  타입: [전체 ▼]              │
├─────────────────────────────────────────────────┤
│                                                  │
│  📋 세션 요약 — 2026-04-05                        │
│  ┌──────────────────────────────────────────┐    │
│  │ 요청: 로그인 페이지 리팩토링                  │    │
│  │ 완료: 인증 로직 분리, 에러 핸들링 추가         │    │
│  │ 배운 점: NextAuth v5 마이그레이션 패턴        │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  🐛 bugfix — 토큰 갱신 타이밍 이슈               │
│  ┌──────────────────────────────────────────┐    │
│  │ refresh token이 만료 5분 전이 아닌              │    │
│  │ 만료 후에 갱신되던 문제 수정                    │    │
│  │ 📁 src/auth/token.ts                        │    │
│  │ 🏷️ auth, token, bugfix                      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  💡 pattern — API 에러 핸들링 패턴                │
│  ┌──────────────────────────────────────────┐    │
│  │ try-catch 대신 Result 타입 사용                │    │
│  │ { ok: true, data } | { ok: false, error }  │    │
│  │ 📁 src/utils/result.ts                      │    │
│  │ 🏷️ pattern, error-handling                  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [더 보기...]                                    │
├─────────────────────────────────────────────────┤
│  연결됨 ● | 메모리 42개 | 세션 8개               │
└─────────────────────────────────────────────────┘
```

**기술 스택**:
- 단일 HTML 파일 (~1500줄)
- CSS 변수 기반 다크/라이트 테마
- SSE로 실시간 업데이트
- fetch API로 REST 호출
- 한국어 기본, 영어 전환 가능

### 3.7 설치 커맨드 (`/memory-install`)

```markdown
---
name: memory-install
description: fireauto 메모리 시스템을 설치해요. 작업 기록이 자동으로 저장되고, 다음 세션에서 검색할 수 있어요.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---

## 설치 단계:
1. Node.js 확인 (v18+)
2. better-sqlite3 의존성 설치
3. ~/.fireauto-mem/ 디렉토리 생성
4. DB 초기화 (스키마 마이그레이션)
5. MCP 서버 등록 (.mcp.json 수정)
6. Hook 등록 (hooks.json 수정)
7. 설치 완료 확인
```

---

## 4. claude-mem과의 차별점

| 항목 | claude-mem | fireauto-mem (제안) |
|------|-----------|-------------------|
| **의존성** | Bun + uv + Chroma + Agent SDK | Node.js + better-sqlite3 only |
| **설치 시간** | 2-5분 (여러 런타임 설치) | 30초 이내 |
| **토큰 비용** | Agent SDK가 관찰마다 Claude API 호출 | 0 (Hook에서 직접 구조화) |
| **검색** | Chroma 벡터 + SQLite | SQLite FTS5 전문 검색 |
| **UI 언어** | 영어 only | **한국어** 기본 |
| **UI 크기** | React 번들 (수백 KB) | 단일 HTML (~50KB) |
| **대상 사용자** | 영어권 개발자 | 한국어 사용자, 초보자 포함 |
| **설치 방식** | smart-install (자동, 복잡) | `/memory-install` 커맨드 (명시적, 단순) |

---

## 5. 구현 우선순위 (로드맵)

### Phase 1: 코어 (MVP)
1. SQLite DB + 스키마 설정 스크립트
2. Worker HTTP 서버 (Express, 포트 37888)
3. MCP 서버 (stdio, 4개 도구)
4. Hook 스크립트 3개 (SessionStart, PostToolUse, Stop)
5. `/memory-install` 커맨드

### Phase 2: UI
6. 한국어 HTML 뷰어 (SSE 실시간)
7. 검색 + 필터 + 페이지네이션
8. 다크/라이트 테마

### Phase 3: 고도화
9. `/memory` 커맨드 (대화형 메모리 관리)
10. 프로젝트별 메모리 격리
11. 메모리 내보내기/가져오기 (JSON)
12. 자동 태깅 (파일 경로 → 도메인 추론)

---

## 6. 리스크 및 고려사항

### 6.1 Agent SDK 없이 품질 유지
- **리스크**: claude-mem은 AI가 관찰을 요약/구조화. 없으면 raw 데이터가 쌓임
- **대안**: Hook에서 tool_name, input 핵심부, output 요약을 템플릿 기반으로 구조화
- **판단**: MVP에서는 구조화된 로깅으로 충분. 추후 AI 요약 레이어 추가 가능

### 6.2 FTS5 vs 벡터 검색
- **리스크**: 의미론적 검색 불가 ("인증 관련" → "로그인", "JWT" 못 찾음)
- **대안**: 태그 시스템 + FTS5 조합이면 실용적으로 충분
- **판단**: 초보자 타겟이므로 정확한 키워드 검색이 더 직관적

### 6.3 비개발자 설치 경험
- **리스크**: better-sqlite3가 native addon이라 빌드 실패 가능
- **대안**: better-sqlite3 대신 sql.js (순수 JS, WebAssembly) 사용 고려
- **판단**: sql.js로 가면 네이티브 빌드 완전 제거 가능 (설치 실패 0%)

### 6.4 포트 충돌
- **리스크**: claude-mem이 37777 사용 중이면 fireauto-mem은 다른 포트 필요
- **대안**: 37888 사용, 충돌 시 자동 포트 탐색
- **판단**: 설치 시 포트 사용 여부 확인 로직 추가

---

## 7. 웹 조사 추가 발견 (Plugin MCP 모범 사례)

### 7.1 `${CLAUDE_PLUGIN_DATA}` — 영속 데이터 디렉토리

플러그인 업데이트에도 유지되는 디렉토리: `~/.claude/plugins/data/{plugin-id}/`
- DB 파일, node_modules, 캐시를 여기에 저장
- `${CLAUDE_PLUGIN_ROOT}`는 업데이트 시 변경되므로 데이터 저장 금지

```json
{
  "mcpServers": {
    "fireauto-mem": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/mem-server.cjs"],
      "env": {
        "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules",
        "DB_PATH": "${CLAUDE_PLUGIN_DATA}/fireauto-mem.db"
      }
    }
  }
}
```

### 7.2 의존성 설치 패턴 (SessionStart 훅)

```json
{
  "SessionStart": [{
    "hooks": [{
      "type": "command",
      "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install)",
      "timeout": 120
    }]
  }]
}
```
→ package.json이 변경된 경우에만 재설치. 매 세션 불필요한 설치 방지.

### 7.3 MCP SDK 현재 상태

- **v1.x** 안정 (권장), **v2** 프리알파 (2026 Q1 예정)
- v2에서 `@modelcontextprotocol/server` + `@modelcontextprotocol/client`로 분리
- Zod v4, Valibot, ArkType 등 Standard Schema 지원

### 7.4 도구 결과 포맷 (에러 처리)

```typescript
// 성공
{ content: [{ type: "text", text: "result" }] }

// 에러 (Claude가 자동 재시도 가능)
{ content: [{ type: "text", text: "Error: ..." }], isError: true }
```

### 7.5 stdout/stderr 규칙

- **stdout**: JSON-RPC 프로토콜 메시지만 (MCP 통신)
- **stderr**: 모든 로그, 디버그, 상태 메시지
→ 이 규칙 위반 시 MCP 통신 깨짐

---

## 8. 핵심 의존성 목록

| 패키지 | 용도 | 버전 |
|--------|------|------|
| `@modelcontextprotocol/sdk` | MCP 서버 프레임워크 | ^1.25.0 |
| `express` | Worker HTTP 서버 | ^4.18.0 |
| `sql.js` | SQLite (순수 JS, WASM) | ^1.10.0 |
| _(또는 `better-sqlite3`)_ | _(SQLite 네이티브, 더 빠름)_ | _^11.0.0_ |

**총 핵심 의존성: 3개** (claude-mem의 ~20개 대비)

---

## 9. 참고 ��료

- [Claude Code MCP 공식 문서](https://code.claude.com/docs/en/mcp)
- [Claude Code 플러그인 생성 가이드](https://code.claude.com/docs/en/plugins)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [claude-mem 플러그인](https://github.com/thedotmack/claude-mem)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [MCP 서버 빌드 공식 가이드](https://modelcontextprotocol.io/docs/develop/build-server)

---

## 10. 결론

fireauto 메모리 시스템은 claude-mem의 검증된 아키텍처를 **경량화**하여 구현할 수 있다.

핵심 전략:
1. **Agent SDK 제거** → 토큰 비용 0, 설치 복잡성 감소
2. **Chroma 제거** → SQLite FTS5로 대체, 의존성 최소화
3. **sql.js 사용** → 네이티브 빌드 없이 모든 환경에서 동작
4. **한국어 UI** → 단일 HTML 파일로 경량 구현
5. **`/memory-install`** → fireauto 스타일의 원클릭 설치

이 접근은 claude-mem 대비 **설치 시간 10배 단축**, **의존성 85% 감소**, **토큰 비용 0**을 달성하면서도 핵심 기능(자동 기록, MCP 검색, 실시간 UI)을 모두 제공한다.
