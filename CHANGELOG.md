# Changelog

## v1.2.0 (2026-04-05)

### 새로운 기능

- **MCP 메모리 시스템** — 작업 기록이 자동으로 저장되고, 다음 세션에서 검색 가능
  - SQLite(sql.js WASM) 기반 로컬 데이터베이스 — 네이티브 빌드 불필요
  - MCP 서버 4개 도구: `memory-search`, `memory-timeline`, `memory-save`, `memory-detail`
  - FTS4 전문 검색으로 한국어 키워드 검색 지원
  - Express Worker HTTP 서버 (포트 37888) + SSE 실시간 스트리밍
  - Hook 자동 기록: SessionStart(Worker 시작), PostToolUse(도구 사용 기록), Stop(세션 요약)

- **`/memory-install` 커맨드** — 메모리 시스템 원클릭 설치
  - 의존성 자동 설치 (sql.js, express, @modelcontextprotocol/sdk)
  - DB 초기화, MCP 서버 등록, Hook 설정 한 번에 완료

- **한국어 메모리 뷰어** — `http://localhost:37888`
  - 단일 HTML 파일 (20KB, 외부 의존성 없음)
  - 다크/라이트 테마 (시스템 설정 자동 감지)
  - SSE 실시간 업데이트, 검색, 프로젝트 필터
  - 메모리 타입별 아이콘/색상 (bugfix, feature, pattern, decision, gotcha, refactor)

### 기술 설계

- claude-mem 아키텍처 참고, 경량화 설계
- Agent SDK 미사용 → 토큰 비용 0원, Hook에서 직접 구조화
- Chroma 벡터 DB 대신 SQLite FTS4 → 의존성 85% 감소
- sql.js(WASM) 사용 → 네이티브 빌드 실패 가능성 0%

## v1.1.1 (2026-03-09)

### 새로운 기능

- **`/freainer` 커맨드** — Claude Code 원클릭 세팅
  - Context7 MCP 자동 설치 (라이브러리 최신 문서 실시간 참조)
  - Playwright MCP 자동 설치 (브라우저 자동화 + E2E 테스트)
  - Draw.io MCP 자동 설치 (아키텍처도, 플로우차트, ERD 자동 생성)
  - LSP 설정 (카테고리 선택 → 원클릭 설치)
  - macOS 알림 훅 설정 (작업 완료 시 알림 + 소리)
  - 에이전트 팀 활성화
  - 전부 무료, API 키 불필요

### 개선

- **스킬 이름 정리** — 커맨드와 구분되도록 `-guide` 접미사 추가
  - `fireauto-lsp` → `fireauto-lsp-guide` (8개 전체 적용)
- **`/lsp` → `/lsp-install`** — 설치 커맨드임을 명확하게 구분
- **README 전면 재작성** — 커맨드 vs 스킬 구분 설명 추가, 구조 정리

## v1.1.0 (2026-03-09)

### 새로운 기능

- **`/lsp` 커맨드** — Claude Code에 LSP를 원클릭으로 연결해요
  - 초보자 친화적 카테고리 선택 (웹 개발, 백엔드, iOS, 안드로이드 등)
  - Language Server 바이너리 자동 설치
  - `ENABLE_LSP_TOOL` 환경변수 + 플러그인 자동 설정
  - 설치 후 AI가 자동으로 LSP 우선 사용 (fireauto-lsp 스킬)

- **`/fireship-install` 멀티 결제 프로바이더 지원**
  - Paddle, Toss Payments 결제 연동 선택지 추가
  - MCP 서버 자동 설정 가이드 (Paddle MCP, Toss Payments MCP)
  - 결제 프로바이더별 환경변수 자동 구성

### 개선

- **fireauto-lsp 스킬** — LSP 설치 후 코드 탐색 시 LSP를 자동으로 우선 사용하도록 가이드
  - 정의로 이동, 참조 찾기, 심볼 검색, 호출 계층 등 LSP 연산 자동 매핑
  - 버그 수정, 리팩토링, 코드 이해 등 실전 패턴 포함

## v1.0.0

- 초기 릴리즈
- `/planner`, `/researcher`, `/team`, `/seo-manager`, `/security-guard`, `/designer`, `/uiux-upgrade`, `/video-maker`, `/loop`, `/fireship-install` 커맨드 제공
