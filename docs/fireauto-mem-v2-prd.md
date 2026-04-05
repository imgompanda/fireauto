# fireauto-mem v2 기획문서 (PRD)

> **작성일**: 2026-04-05
> **버전**: v2.0.0 (목표)
> **현재 버전**: v1.2.0 (기본 기록/검색/뷰어)
> **참고**: claude-mem v10.6.3, Karpathy LLM Knowledge Bases, Claudesidian

---

## 1. 프로젝트 개요

### 1.1 한 줄 요약
fireauto-mem v2는 **Agent SDK(Haiku)로 AI가 자동 요약**하고, **메모리 간 관계를 자동으로 연결**하며, **자동 트리거 스킬**로 사용자가 의식하지 않아도 작동하는 지식 관리 시스템이다.

### 1.2 v1.2.0의 한계
| 한계 | 영향 |
|------|------|
| AI 요약 없음 | 세션 종료 시 빈 요약만 저장, 사용자에게 유용한 정보 없음 |
| 메모리 간 관계 없음 | 개별 기록만 있고, "이 버그 수정이 어떤 패턴과 관련있는지" 알 수 없음 |
| 수동 검색만 가능 | MCP 도구를 직접 호출해야 함, 자동 트리거 없음 |
| Hook에서 raw 데이터 저장 | 도구 이름 + 입출력만 저장, 의미 있는 구조화 안 됨 |

### 1.3 v2 목표
1. **AI 요약**: Agent SDK + Haiku로 관찰 데이터를 의미 있는 지식으로 압축
2. **관계형 메모리**: 메모리 간 자동 링크 + 지식 그래프
3. **자동 트리거 스킬**: 상황에 맞게 자동 활성화
4. **Karpathy 워크플로우**: 지식 컴파일 + 건강 검사 패턴
5. **더 나은 UI**: 세션별 그룹핑, 요약 카드, 관계 시각화

---

## 2. 시스템 아키텍처

### 2.1 전체 구조 (v2)

```
                    Claude Code (사용자 세션)
                              |
                         Hook 트리거
                              |
         +--------------------+--------------------+
         |                    |                    |
    SessionStart         PostToolUse             Stop
    (Worker 시작)        (관찰 수집)          (세션 요약)
         |                    |                    |
         +--------------------+--------------------+
                              |
                    Worker Service (Express.js)
                         port 37888
                              |
         +--------------------+--------------------+
         |                    |                    |
    SDK Agent            SQLite DB           MCP Server
    (Haiku)              (sql.js)            (stdio)
    - 관찰 구조화        - memories           - memory-search
    - 세션 요약          - sessions           - memory-timeline
    - 관계 추론          - summaries          - memory-save
    - XML 파싱           - relations          - memory-detail
                         - FTS4               - memory-related
                              |               - memory-compile
                              |
                    SSE Stream --> UI (한국어)
                    - 세션별 그룹핑
                    - AI 요약 카드
                    - 관계 그래프 뷰
```

### 2.2 v1 vs v2 변경 사항

| 컴포넌트 | v1 (현재) | v2 (목표) |
|----------|----------|----------|
| **요약 생성** | Hook에서 빈 필드 전송 | Agent SDK + Haiku가 AI 요약 |
| **관찰 처리** | raw 도구 입출력 저장 | Haiku가 의미 구조화 (type, title, narrative) |
| **메모리 관계** | 없음 | relations 테이블 + 자동 링크 |
| **MCP 도구** | 4개 | 6개 (+related, +compile) |
| **스킬** | 가이드만 | 자동 트리거 스킬 |
| **UI** | 단순 카드 목록 | 세션 그룹핑 + 요약 + 관계 뷰 |
| **의존성** | sql.js, express, MCP SDK | + claude-agent-sdk |

---

## 3. Agent SDK 통합 (핵심 신규)

### 3.1 claude-mem 패턴 차용

claude-mem의 SDKAgent 패턴을 경량화하여 적용:

```
query({
  prompt: messageGenerator,
  options: {
    model: 'claude-haiku-4-5-20251001',
    cwd: observerDir,
    disallowedTools: [
      'Bash', 'Read', 'Write', 'Edit',
      'Grep', 'Glob', 'WebFetch', 'WebSearch',
      'Task', 'NotebookEdit', 'AskUserQuestion'
    ],
    abortController
  }
})
```

핵심 패턴:
- **AsyncIterableIterator 메시지 생성기**: init prompt -> observation/summary prompt 스트리밍
- **세션 재개**: memorySessionId + promptNumber > 1이면 resume
- **CLAIM-CONFIRM**: DB 저장 먼저 -> 큐 확인 후 제거 (크래시 복구)
- **Fire-and-Forget**: DB 저장 후 SSE broadcast, 관계 추론은 비동기

### 3.2 프롬프트 설계

**관찰 프롬프트 (PostToolUse 시):**

```
당신은 개발 작업 관찰자입니다.
다음 도구 사용을 관찰하고, 의미 있는 지식으로 구조화하세요.

<observed_from_primary_session>
  <tool_name>{tool}</tool_name>
  <parameters>{input}</parameters>
  <outcome>{output}</outcome>
</observed_from_primary_session>

다음 XML 형식으로 응답하세요:

<observation>
  <type>[ bugfix | feature | pattern | decision | gotcha | refactor ]</type>
  <title>간결한 제목</title>
  <subtitle>한 줄 설명</subtitle>
  <facts>
    <fact>구체적 사실</fact>
  </facts>
  <narrative>왜 이 작업을 했는지 서술</narrative>
  <files_modified>
    <file>파일 경로</file>
  </files_modified>
</observation>

중요하지 않은 작업이면 <skip reason="이유"/> 로 건너뛰세요.
```

**세션 요약 프롬프트 (Stop 시):**

```
이 세션의 모든 관찰을 종합하여 요약하세요.
<observation> 태그 사용 금지. <summary> 태그만 사용하세요.

<summary>
  <request>사용자가 요청한 것</request>
  <investigated>조사/탐색한 것</investigated>
  <learned>배운 것, 발견한 것</learned>
  <completed>완료한 작업</completed>
  <next_steps>다음에 할 일</next_steps>
</summary>
```

### 3.3 XML 파서

claude-mem의 검증된 패턴:
- `/<observation>([\s\S]*?)<\/observation>/g` 로 블록 추출
- `extractField(content, name)` — 비탐욕 매칭으로 필드 추출
- `extractArray(content, arrayName, itemName)` — 배열 요소 추출
- 타입 유효성 검사 + fallback (잘못된 타입이면 첫 번째 타입으로)

### 3.4 토큰 비용 추정

| 항목 | 입력 토큰 | 출력 토큰 | 비용/건 |
|------|----------|----------|--------|
| 관찰 구조화 | ~500 | ~200 | ~$0.00005 |
| 세션 요약 | ~2,000 | ~500 | ~$0.0002 |

하루 50건 관찰 + 3개 세션 = **~$0.003/일** (거의 무료)

---

## 4. 관계형 메모리 시스템

### 4.1 DB 스키마 변경

기존 memories 테이블에 필드 추가:
- subtitle TEXT
- narrative TEXT
- facts TEXT DEFAULT '[]' (JSON array)
- concepts TEXT DEFAULT '[]' (JSON array)

신규 relations 테이블:
- source_id, target_id (FK -> memories)
- relation_type: 'related', 'caused_by', 'led_to', 'same_file', 'same_tag'
- confidence: 0.0~1.0
- UNIQUE(source_id, target_id, relation_type)

### 4.2 자동 관계 추론 규칙

| 규칙 | 관계 타입 | 신뢰도 |
|------|----------|--------|
| 같은 파일 수정 | same_file | 0.8 |
| 같은 태그 보유 | same_tag | 0.6 |
| Haiku가 관련성 판단 | related | AI 결정 |
| 시간적 연속 (5분 이내) | led_to | 0.7 |
| 버그수정의 원인 메모리 | caused_by | AI 결정 |

### 4.3 MCP 도구 추가

**memory-related** — 특정 메모리와 관련된 메모리 조회
- 입력: id (필수), depth (기본 1, 최대 3)
- 출력: 관련 메모리 트리

**memory-compile** — Karpathy 스타일 지식 컴파일
- 입력: project, format ('wiki' | 'summary' | 'lessons')
- 출력: 구조화된 지식 문서

---

## 5. Karpathy 워크플로우 통합

### 5.1 3단계 지식 파이프라인

```
[Stage 1: Ingest]
  Hook이 수집한 raw 관찰 데이터

[Stage 2: Compile]
  Haiku가 구조화 (observation -> structured memory)
  자동 관계 링크 생성
  세션 요약 생성

[Stage 3: Health Check]
  /memory-compile 실행 시:
  - 고아 메모리 감지 (관계 없는 메모리)
  - 중복 메모리 감지
  - 불일치 감지 (같은 파일에 대한 상충 기록)
  - 누락 감지 ("이 패턴에 대한 예시가 없음")
```

### 5.2 memory-compile 출력 예시

```markdown
# fireauto 프로젝트 지식 베이스

## 패턴
### API 에러 핸들링
Result 타입으로 통일. { ok: true, data } | { ok: false, error }
-> 관련: [메모리 #5], [메모리 #12]

### 인증 토큰 갱신
만료 5분 전 자동 갱신. refresh token 로테이션 적용.
-> 관련: [버그 #3], [결정 #8]

## 주의사항 (Gotchas)
### sql.js FTS5 미지원
sql.js WASM 빌드에 FTS5 없음. FTS4 사용 필요.
-> 발견 세션: 2026-04-05

## 최근 결정
### MCP 서버 아키텍처
Thin Wrapper 패턴 -- MCP 서버는 Worker HTTP API로 위임.
-> 이유: Worker 핫리로드 가능
```

---

## 6. 자동 트리거 스킬

### 6.1 스킬 설계

**fireauto-mem-auto-search** (자동 검색):
- 트리거 키워드: "이전에", "지난번에", "예전에", "기억", "한 적 있", "했었는데", "찾아줘", "검색해줘", "히스토리", "기록", "작업 내역"
- 동작: memory-search -> memory-detail 자동 연결

**fireauto-mem-auto-save** (자동 저장):
- 트리거 키워드: "기억해둬", "저장해둬", "메모해둬", "잊지 말고", "나중에 쓸", "패턴으로 저장", "이거 중요한"
- 동작: memory-save로 적절한 type/tags와 함께 저장

**fireauto-mem-auto-compile** (자동 컴파일):
- 트리거 키워드: "정리해줘", "요약해줘", "지식 정리", "프로젝트 정리", "뭘 배웠지", "지금까지 한 것", "종합해줘"
- 동작: memory-compile로 지식 문서 생성

### 6.2 claude-mem과의 차별점

| | claude-mem | fireauto-mem v2 |
|---|---|---|
| 언어 | 영어 | **한국어** 키워드 매칭 |
| 트리거 | MCP 직접 호출 | **스킬이 자동 트리거** |
| 검색 흐름 | search -> detail 수동 | 스킬이 자동 연결 |
| 컴파일 | 없음 | **Karpathy 스타일** |

---

## 7. UI 개선

### 7.1 세션별 그룹핑 뷰

```
+----------------------------------------------------+
|  fireauto 메모리       검색  프로젝트 v  테마 토글    |
+----------------------------------------------------+
|                                                      |
|  +-- 세션: 메모리 시스템 구현 ---- 4/5 14:00 ------+ |
|  |                                                  | |
|  |  AI 요약:                                        | |
|  |  요청: fireauto에 MCP 메모리 시스템 추가         | |
|  |  완료: 8개 에이전트 병렬 구현                    | |
|  |  배운 점: sql.js WASM에 FTS5 없음               | |
|  |  다음: Agent SDK 통합                            | |
|  |                                                  | |
|  |  [feature] MCP 서버 구현 (3건)                   | |
|  |  [bugfix] 함수명 불일치 수정 (1건)               | |
|  |  [pattern] FTS4 패턴 발견 (1건)                  | |
|  |                                                  | |
|  |  [펼치기...]                                     | |
|  +--------------------------------------------------+ |
|                                                      |
|  [관계 그래프 보기]                                   |
+------------------------------------------------------+
```

### 7.2 관계 그래프 뷰
- Canvas API 또는 SVG로 노드/엣지 시각화
- 노드: 메모리 (타입별 색상)
- 엣지: 관계 (타입별 선 스타일)
- 클릭: 상세 보기
- 필터: 타입, 프로젝트, 기간

---

## 8. 구현 로드맵

### Phase 1: Agent SDK 통합 (핵심)
1. Agent SDK 의존성 추가 (package.json)
2. SDK Agent 모듈 구현 (sdk-agent.cjs)
3. 프롬프트 빌더 구현 (prompts.cjs)
4. XML 파서 구현 (parser.cjs)
5. Worker에 SDK 연동 (worker.cjs 수정)
6. Hook 스크립트 업데이트 (hooks/*.sh 수정)

### Phase 2: 관계형 메모리
7. relations 테이블 + 마이그레이션 (db.cjs 수정)
8. 자동 관계 추론 로직 (relations.cjs)
9. memory-related MCP 도구 (mcp-server.cjs 수정)
10. Worker 관계 API 추가 (worker.cjs 수정)

### Phase 3: Karpathy 컴파일
11. memory-compile MCP 도구 (mcp-server.cjs 수정)
12. 컴파일 프롬프트 설계 (prompts.cjs 수정)
13. Health check 로직 (health-check.cjs)

### Phase 4: 스킬 + UI
14. 자동 트리거 스킬 3개 (skills/fireauto-mem-*.md)
15. UI 세션 그룹핑 (viewer.html 수정)
16. UI 요약 카드 (viewer.html 수정)
17. UI 관계 그래프 뷰 (viewer.html 수정)

### Phase 5: 설치 + 마무리
18. /memory-install 업데이트 (commands/memory-install.md)
19. 통합 테스트
20. CHANGELOG + 릴리즈

---

## 9. 의존성

### 신규 추가
| 패키지 | 용도 | 비용 |
|--------|------|------|
| claude-agent-sdk | AI 요약/구조화 | Haiku ~$0.003/일 |

### 기존 유지
| 패키지 | 용도 |
|--------|------|
| sql.js | SQLite WASM |
| express | Worker HTTP |
| @modelcontextprotocol/sdk | MCP 서버 |
| zod | 스키마 검증 |

---

## 10. 성공 지표

| 지표 | 목표 |
|------|------|
| 세션 요약 품질 | 사용자가 "맞아, 이거 했지" 하는 수준 |
| 자동 관계 정확도 | 연결된 메모리의 80%+ 가 실제 관련 |
| 검색 만족도 | "이전에 한 작업 찾아줘" -> 1번에 원하는 결과 |
| 토큰 비용 | 하루 $0.01 이하 |
| 설치 시간 | /memory-install 30초 이내 |

---

## 11. 리스크 및 대안

### Agent SDK 의존성
- 리스크: Claude Code 환경에서만 동작
- 대안: Anthropic Messages API HTTP 직접 호출로 폴백

### Haiku 응답 품질
- 리스크: 한국어 요약 품질 부족 가능
- 대안: 프롬프트에 한국어 예시 포함, Sonnet 옵션 제공

### Hook 성능
- 리스크: PostToolUse마다 Haiku 호출 시 지연
- 대안: 비동기 큐 + 배치 처리 (5건 모이면 또는 5분마다)

### 관계 그래프 복잡도
- 리스크: 메모리 많아지면 그래프 복잡
- 대안: depth=1 기본, 신뢰도 임계값 필터
