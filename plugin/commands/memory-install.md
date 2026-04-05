---
name: memory-install
description: 당신만의 개발 지식 데이터베이스를 자동으로 구축해요. 설치만 하면 AI가 매 작업을 능동적으로 분석하고, 패턴·결정·실수를 체계화해요.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
user-invocable: true
---

# /memory-install — fireauto 메모리 설치

fireauto 메모리 시스템을 원클릭으로 설치합니다.

## 설치 항목
1. 의존성 설치 (sql.js, express, @modelcontextprotocol/sdk)
2. 데이터베이스 초기화
3. MCP 서버 등록
4. Hook 스크립트 설정
5. 설치 확인

## 실행 순서

### Step 1: 환경 확인

Node.js 버전을 확인하세요:

```bash
node --version
```

- Node.js 18 이상이면 다음 단계로 진행하세요.
- Node.js가 없거나 18 미만이면 아래 메시지를 출력하고 **중단**하세요:

```
Node.js 18 이상이 필요해요.
설치: https://nodejs.org 에서 LTS 버전을 받아주세요.
```

환경 확인이 끝나면 유저에게 알려주세요:

```
fireauto 메모리 설치를 시작할게요.

Step 1/5 — Node.js {버전} 확인됨
```

---

### Step 2: 의존성 설치

`~/.fireauto-mem/` 디렉토리를 만들고 의존성을 설치하세요.

1. 디렉토리 생성:

```bash
mkdir -p ~/.fireauto-mem
```

2. 플러그인 루트의 `plugin/scripts/mem/package.json`을 `~/.fireauto-mem/`에 복사하세요. `{PLUGIN_ROOT}`는 이 플러그인의 실제 절대 경로로 대체하세요.

3. `~/.fireauto-mem` 디렉토리에서 `npm install`을 실행하세요.

- 설치에 성공하면 다음 단계로 진행하세요.
- 설치에 실패하면 에러 메시지를 보여주고 **중단**하세요:

```
의존성 설치에 실패했어요.
에러: {npm 에러 메시지}
네트워크 연결을 확인하고 다시 시도해주세요.
```

성공 시 유저에게 알려주세요:

```
Step 2/5 — 의존성 설치 완료 (sql.js, express, MCP SDK)
```

---

### Step 3: 데이터베이스 초기화

`db.cjs`의 `initDb()`를 호출해서 스키마를 생성하세요.

환경변수 설정:
- `DB_PATH`: `~/.fireauto-mem/fireauto-mem.db`
- `NODE_PATH`: `~/.fireauto-mem/node_modules`

node로 `{PLUGIN_ROOT}/scripts/mem/db.cjs`를 require한 뒤 `initDb()`를 호출하고, DB를 close하세요.

- `~/.fireauto-mem/fireauto-mem.db` 파일이 이미 존재하면 이 단계를 **스킵**하고 유저에게 알려주세요:

```
Step 3/5 — 데이터베이스가 이미 존재해요 (스킵)
```

- 새로 생성했으면:

```
Step 3/5 — 데이터베이스 초기화 완료
```

---

### Step 4: MCP 서버 등록

`~/.claude/settings.json`을 읽고, `mcpServers` 필드에 `fireauto-mem`을 추가하세요.

추가할 설정:

```json
{
  "mcpServers": {
    "fireauto-mem": {
      "command": "node",
      "args": ["{PLUGIN_ROOT}/scripts/mem/mcp-server.cjs"],
      "env": {
        "NODE_PATH": "~/.fireauto-mem/node_modules",
        "DB_PATH": "~/.fireauto-mem/fireauto-mem.db"
      }
    }
  }
}
```

`{PLUGIN_ROOT}`는 실제 절대 경로로 대체하세요.

**주의사항:**
- `settings.json`을 수정할 때 반드시 **기존 설정을 보존**하세요. 덮어쓰기 금지!
- 이미 `mcpServers`에 `fireauto-mem`이 있으면 **스킵**하세요:

```
Step 4/5 — MCP 서버가 이미 등록되어 있어요 (스킵)
```

- 새로 등록했으면:

```
Step 4/5 — MCP 서버 등록 완료
```

---

### Step 5: Hook 스크립트 권한 설정

Hook 스크립트에 실행 권한을 부여하세요:

```bash
chmod +x {PLUGIN_ROOT}/scripts/mem/hooks/save-observation.sh
chmod +x {PLUGIN_ROOT}/scripts/mem/hooks/save-summary.sh
chmod +x {PLUGIN_ROOT}/scripts/mem/hooks/session-start.sh
```

성공 시:

```
Step 5/5 — Hook 스크립트 설정 완료
```

---

### Step 6: 설치 확인 및 완료 메시지

DB 헬스 체크를 수행하세요. `db.cjs`를 require하고 `initDb()`로 DB를 열어서 `observations` 테이블에 count 쿼리를 실행하세요. 정상이면 DB를 close하세요.

테스트가 성공하면 최종 완료 메시지를 출력하세요:

```
설치 완료!

이제 Claude Code가 자동으로 작업 기록을 저장해요.
- 메모리 검색: Claude에게 "이전에 한 작업 찾아줘" 라고 물어보세요
- 메모리 뷰어: http://localhost:37888 에서 기록을 확인할 수 있어요
- MCP 도구: memory-search, memory-timeline, memory-save, memory-detail

Claude Code를 재시작하면 메모리 시스템이 자동으로 활성화돼요.
```

테스트가 실패하면:

```
설치는 완료됐지만, 헬스 체크에 실패했어요.
Claude Code를 재시작한 후 다시 확인해주세요.
문제가 계속되면 /memory-install 을 다시 실행해주세요.
```

---

## 주의사항

- `settings.json`을 수정할 때는 반드시 **기존 설정을 보존**하세요. 덮어쓰기 금지!
- `{PLUGIN_ROOT}`는 이 플러그인의 실제 절대 경로로 대체하세요.
- 이미 설치된 항목은 건너뛰세요 (중복 설치 방지).
- 에러 발생 시 친절한 안내 메시지와 함께 중단하세요.
- 모든 메시지는 토스체 한국어로 출력하세요 (~해요, ~할게요, ~됐어요).
