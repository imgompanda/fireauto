# fireauto 플러그인 심층 분석 리포트

> 2026-04-07 | 4개 팀 동시 분석 (코어 품질, 아키텍처, 보안, UI/UX)

---

## 전체 현황

| 영역 | CRITICAL | HIGH | MEDIUM | LOW | 합계 |
|------|----------|------|--------|-----|------|
| 코어 코드 품질 | 3 | 5 | 7 | 3 | 18 |
| 아키텍처 | 2 | 3 | 2 | 3 | 10 |
| 보안 | 3 | 4 | 3 | 3 | 13 |
| UI/UX | 2 | 5 | 6 | 3 | 16 |
| **합계** | **10** | **17** | **18** | **12** | **57** |

중복 제거 시 고유 이슈 약 40건.

---

## CRITICAL — 즉시 수정 필요 (7건)

### 1. 셸 인젝션 — session-start.sh, save-summary.sh

- **파일**: `plugin/scripts/mem/hooks/session-start.sh:37-38`, `save-summary.sh:19-28`
- **문제**: `$SESSION_ID`, `$PROJECT`를 curl JSON에 직접 삽입. 디렉터리명에 특수문자 포함 시 임의 명령 실행 가능.
- **수정**: `jq -n --arg`로 안전한 JSON 생성

```bash
# Before (취약)
-d "{\"session_id\":\"$SESSION_ID\",\"project\":\"$PROJECT\"}"

# After (안전)
PAYLOAD=$(jq -n --arg sid "$SESSION_ID" --arg proj "$PROJECT" \
  '{session_id: $sid, project: $proj}')
curl -sf -X POST "$WORKER_URL/api/sessions/init" \
  -H "Content-Type: application/json" -d "$PAYLOAD"
```

### 2. 경로 탐색 — wiki-manager.cjs

- **파일**: `plugin/scripts/mem/wiki-manager.cjs:32, 44`
- **문제**: `pageName`을 검증 없이 `path.join(dir, pageName + '.md')`로 사용. `../../.ssh/authorized_keys` 같은 경로로 임의 파일 읽기/쓰기 가능.
- **수정**: `pageName`에 `^[a-zA-Z0-9_\-]+$` 화이트리스트 적용

```javascript
function sanitizePage(name) {
  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) throw new Error('Invalid page name');
  return name;
}
```

### 3. sql.js 바인딩 무시 — relations.cjs

- **파일**: `plugin/scripts/mem/relations.cjs:168, 198, 229`
- **문제**: `db.exec(sql, params)` — sql.js의 `exec()`는 두 번째 인자를 **무시**함. 관계 추론 쿼리가 필터 없이 전체 테이블을 스캔.
- **수정**: `db.prepare(sql).bind(params)` 패턴으로 변경

```javascript
// Before (바인딩 무시됨)
db.exec('SELECT id FROM memories WHERE files_involved LIKE ?', [id, `%${file}%`])

// After
const stmt = db.prepare('SELECT id FROM memories WHERE id != ? AND files_involved LIKE ?');
stmt.bind([newMemoryId, `%${file}%`]);
const rows = [];
while (stmt.step()) rows.push(stmt.getAsObject());
stmt.free();
```

### 4. 인메모리 DB 30초 flush — 크래시 시 데이터 유실

- **파일**: `plugin/scripts/mem/worker.cjs:1186-1192`
- **문제**: sql.js 인메모리 DB를 `setInterval`로 30초마다 파일에 flush. SIGKILL 시 최대 30초치 데이터 손실.
- **수정**: write 작업 직후 즉시 `saveDb()` 호출, 또는 네이티브 SQLite(`better-sqlite3`) 전환

### 5. var 재선언 스코프 버그 — worker.cjs executeActions

- **파일**: `plugin/scripts/mem/worker.cjs:168-189`
- **문제**: `switch` case 간 `var parts`가 함수 스코프로 공유. 스킬 액션 처리 시 `parts` 파싱 결과가 이전 case의 값으로 오염됨.
- **수정**: case 블록 `{}` + `let`/`const`로 블록 스코프화

```javascript
// Before
case 'mistake':
  var parts = action.value.split('|');
  // ...
case 'skill':
  var parts = action.value.split('|');  // 같은 var 재선언

// After
case 'mistake': {
  const parts = action.value.split('|');
  // ...
  break;
}
case 'skill': {
  const parts = action.value.split('|');
  // ...
  break;
}
```

### 6. Wiki 마크다운 미렌더링 — viewer.html

- **파일**: `plugin/scripts/mem/ui/viewer.html:1010`
- **문제**: `.textContent`로 마크다운 원문을 날 문자열로 표시. Wiki 기능의 핵심 가치 훼손.
- **수정**: `marked.js` CDN + `DOMPurify`로 안전한 HTML 렌더링

### 7. Wiki/스킬 탭 에러 피드백 없음 — viewer.html

- **파일**: `viewer.html:984, 1014`
- **문제**: `fetchJSON()` 호출에 `.catch()` 핸들러 없음. API 실패 시 빈 화면만 표시.
- **수정**: 각 fetch에 `.catch()` + 에러 상태/빈 상태 UI 추가

---

## HIGH — 우선 수정 (10건)

| # | 이슈 | 파일 | 설명 | 수정 방향 |
|---|------|------|------|----------|
| 8 | CORS `*` 개방 | worker.cjs:249 | 모든 오리진에서 API 접근 가능 | Origin 검증 또는 시크릿 헤더 |
| 9 | 인증 없는 API | worker.cjs:244-254 | 인증/인가 없이 모든 엔드포인트 접근 가능 | CSRF 방어, 로컬 시크릿 토큰 |
| 10 | `addClaudeMdRule` 이중 push | self-learner.cjs:213-223 | try 블록 안팎에서 같은 항목 2번 push | try 밖 `push()` 1줄 제거 |
| 11 | `trimClaudeMd` writePage 인자 오류 | claude-md-generator.cjs:172-178 | `wikiMgr.writePage(projectRoot, 'overflow', ...)` — 인자 3개, 시그니처 2개 | `projectRoot` 인자 제거 |
| 12 | retrospection session_id 필터 버그 | retrospection.cjs:19-21 | `listMemories`가 session_id를 반환하지 않아 필터 결과가 항상 빈 배열 → **복기 기능 전체 미동작** | `listMemories`에 session_id 컬럼 추가 |
| 13 | SSE 무한 재연결 | viewer.html:481-485 | Worker 다운 시 3초마다 무한 재연결, 백오프 없음 | 지수 백오프 3s→6s→12s→60s |
| 14 | `state.loading` 공유 플래그 충돌 | viewer.html:513, 541 | 검색과 타임라인이 같은 플래그 공유, 탭 전환 시 로딩 무시됨 | 목적별 플래그 분리 |
| 15 | inject-context.sh 코드 인젝션 | inject-context.sh:98-103 | 파일 경로가 Node.js 인라인 코드에 직접 삽입 | 환경변수로 경로 전달 |
| 16 | auto-suggest camelCase 불일치 | auto-suggest.cjs | `milestoneId`(camelCase) vs `milestone_id`(snake_case) — 필터 무시됨 | `milestoneId` → `milestone_id` |
| 17 | Worker SPOF | 아키텍처 전반 | 전체 시스템이 Worker 하나에 의존, 세션 중간 장애 시 데이터 유실 | PostToolUse 훅에서 가용성 체크 + 자동 재시작 |

---

## MEDIUM (18건)

### 코어 코드 품질

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 18 | DB 외래키 미활성 | db.cjs | `PRAGMA foreign_keys = ON` 미실행 → 고아 relation 레코드 누적 |
| 19 | `getMemoryById` sync인데 await 호출 | worker.cjs:284 | 동작은 하나 의도 불일치 |
| 20 | `inferRelations` LIKE 오탐 | relations.cjs:168-190 | `%file%` 검색으로 유사 파일명 오매칭 |
| 21 | `auto-suggest.cjs` 데드코드 | mcp-server.cjs:378 | require만 하고 미사용 |
| 22 | `detectRepetitivePatterns` N+1 쿼리 | self-learner.cjs:50-87 | 200개 메모리에 대해 개별 DB 쿼리 |
| 23 | 함수 내부 require 패턴 불일치 | harness.cjs:33 외 다수 | lazy require vs 모듈 레벨 require 혼재 |
| 24 | `getSessions` stmt.free() 예외 미보호 | db.cjs:1255-1275 | try-finally 없이 prepare/step 사용 |

### 보안

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 25 | post-tool-check.sh PLUGIN_ROOT 인젝션 | hooks/post-tool-check.sh:18-23 | 싱글쿼트 안 `$PLUGIN_ROOT` 삽입 |
| 26 | LIKE 메타문자 미처리 | db.cjs:382 | `%`와 `_`가 와일드카드로 동작 |
| 27 | SSE 클라이언트 수 무제한 | worker.cjs:1131-1139 | 수천 연결 시 파일 디스크립터 고갈 |
| 28 | 태스크 status 화이트리스트 없음 | worker.cjs:651-676 | 임의 문자열이 status로 저장됨 |

### UI/UX

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 29 | 헤더 검색창과 검색 탭 역할 혼재 | viewer.html:248, 343 | 두 진입점의 차이 불명확 |
| 30 | 카드 200개 한꺼번에 DOM 삽입 | viewer.html:516, 750 | 가상화/페이지네이션 없음 |
| 31 | `loadMore` 버튼 dead code | viewer.html:1153 | offset 없이 같은 200개 재로드, 버튼도 항상 hidden |
| 32 | 프로젝트 1개만 표시 | viewer.html:822-826 | 다중 프로젝트 시 선택 UI 없음 |
| 33 | 탭패널 tabindex 미설정 | viewer.html:262-345 | 키보드 네비게이션 불가 |
| 34 | 초기 로딩 시 API 4번 중복 호출 | viewer.html:1163-1167 | SSE initial_load와 별도 fetch 중복 |
| 35 | 탭 전환마다 API 재호출 | viewer.html:470-473 | 캐싱 없이 매번 fetch |

---

## LOW (12건)

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 36 | `rowsToObjects` 4곳 중복 | db.cjs, relations.cjs, health-check.cjs, worker.cjs | types.cjs에 통합 필요 |
| 37 | `trimClaudeMd` 섹션 중간 잘림 | claude-md-generator.cjs:153-181 | 마크다운 헤더 경계 무시 |
| 38 | MCP 서버 ppid 감지 신뢰성 | mcp-server.cjs:89-99 | 중간 셸 경유 시 부모 감지 실패 |
| 39 | Stop 훅 matcher 중복 | hooks.json | 빈 matcher 2개, 하나로 합칠 것 |
| 40 | `save-summary.sh` 빈 세션 요약 | save-summary.sh:20-27 | what_done/learned/next 항상 빈 문자열 |
| 41 | 전역 카운터 파일 세션 간 공유 | post-tool-check.sh | `/tmp/fireauto-tool-counter`가 세션 ID 없이 공유됨 |
| 42 | 에러 메시지에 내부 경로 노출 | worker.cjs 전반 | `err.message`를 클라이언트에 그대로 반환 |
| 43 | detect-mistake.sh 키워드 과잉 매칭 | detect-mistake.sh:27-50 | 이미 비활성화 권장됨 (CLAUDE.md 규칙) |
| 44 | settings 모델 ID 검증 없음 | worker.cjs:971-982 | 임의 문자열이 모델 ID로 설정됨 |
| 45 | CSS 인라인 스타일 혼용 | viewer.html:862-870 | 마일스톤 칩이 JS 인라인으로 하드코딩 |
| 46 | 설정 탭 자동 저장 | viewer.html:1117-1119 | 실수 클릭 시 즉시 반영, 확인 없음 |
| 47 | viewer.html 파일 분리 필요 | viewer.html 전체 | 1,170줄 단일 파일 (CSS+HTML+JS) |

---

## 아키텍처 개선 제안

### 현재 구조

```
사용자 입력
    │
    ▼
[Claude Code 세션]
    │
    ├── SessionStart 훅 ──→ session-start.sh ──→ Worker HTTP :37888
    │                  └─→ inject-context.sh ──→ Worker HTTP :37888
    │                                              │
    │                                              ▼
    │                                        [Express Worker]
    │                                              │
    │   PostToolUse 훅 ──→ save-observation.sh ───┤
    │                  └─→ post-tool-check.sh ────┤
    │                                              │
    │   Stop 훅 ────────→ stop-hook.sh ────────────┤
    │              └────→ save-summary.sh ──────────┤
    │                                              │
    ▼                                              ▼
[MCP Server (stdio)]           [sqlite (sql.js WASM)]
    │   ──callWorker()──→       Worker HTTP :37888
    │                               │
    │                       ┌───────┼───────────────┐
    │                       ▼       ▼               ▼
    │                   db.cjs  sdk-agent.cjs   wiki-manager.cjs
    │                               │
    │                       Claude Haiku API (Agent SDK)
    │                               │
    │                       relations.cjs (관계 추론)
    │                       self-learner.cjs (패턴/규칙)
    │                       project-manager.cjs (대시보드)
    │                       retrospection.cjs (복기)
    │                       harness.cjs (컨텍스트 생성)
    ▼
Claude (MCP 도구 응답)
```

### 개선 방향

| 문제 | 개선 |
|------|------|
| 모듈 15개가 Worker에 밀집 | 관심사별 라우터 분리 (memory-router, project-router, wiki-router) |
| 셸 훅에서 `node -e` 인라인 코드 반복 | 별도 .cjs 헬퍼 스크립트로 추출 |
| `rowsToObjects` 4곳 중복 | `types.cjs`에 통합 |
| relations/db 스키마 중복 정의 | db.cjs 단일 소스로 통합, `PRAGMA foreign_keys = ON` |
| `project-manager.cjs`, `retrospection.cjs` 직접 require | lazy require 패턴 통일 |
| `save-summary.sh` 빈 데이터 전송 | 세션 요약 데이터 수집 로직 구현 또는 훅 제거 |
| 복기 모듈 중복 | `self-learner.cjs::runRetrospect()`와 `retrospection.cjs::generateRetrospect()` 통합 |

---

## 수정 우선순위 로드맵

### Phase 1 — 즉시 (보안 + 크래시 방지)

- [ ] 셸 인젝션 2건 (jq 적용)
- [ ] 경로 탐색 1건 (화이트리스트)
- [ ] `var` → `let/const` 스코프 버그
- [ ] `writePage` 인자 오류 (1줄)
- [ ] `addClaudeMdRule` 이중 push (1줄)

### Phase 2 — 이번 주 (기능 정상화)

- [ ] sql.js 바인딩 전환 (`prepare().bind()`)
- [ ] `retrospection` session_id 버그 (복기 기능 복구)
- [ ] `auto-suggest` camelCase 불일치
- [ ] CORS 제한 + Origin 검증
- [ ] Wiki 마크다운 렌더링 (marked.js + DOMPurify)

### Phase 3 — 다음 스프린트 (품질 + 성능)

- [ ] DB write-through 또는 네이티브 SQLite 전환
- [ ] SSE 지수 백오프 + 클라이언트 수 제한
- [ ] API 캐싱 + 초기 로딩 최적화
- [ ] `rowsToObjects` 통합, 스키마 중복 제거
- [ ] viewer.html 파일 분리 (CSS + JS)
- [ ] Worker 자동 재시작 로직 강화
