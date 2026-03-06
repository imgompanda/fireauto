---
description: "보안 종합점검 - API, 인증, 입력값, 의존성 취약점 감사"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
user-invocable: true
---

# /fireauto-secure - 보안 종합점검

코드베이스의 보안 취약점을 8개 카테고리로 종합 감사합니다.
실제 SaaS 프로젝트(pikome, ditfinder 등)에서 발견된 18개 취약점 패턴을 기반으로 설계되었습니다.

---

## 실행 절차

### Step 1: 프로젝트 구조 파악

프로젝트 루트를 확인하고 기술 스택을 파악합니다.

```
- package.json 읽기 (프레임워크, 의존성 확인)
- 디렉토리 구조 스캔 (src/, app/, api/, pages/, lib/, utils/)
- .env 관련 파일 목록 확인
- next.config.*, middleware.* 파일 확인
```

### Step 2: 8개 카테고리 보안 감사

각 카테고리별로 순차적으로 점검합니다. 발견된 모든 취약점을 수집합니다.

---

#### 카테고리 1: 환경변수/시크릿 노출

**점검 항목:**
- `.env`, `.env.local`, `.env.production` 파일이 `.gitignore`에 포함되어 있는지 확인
- 소스코드 내 하드코딩된 API 키, 시크릿, 토큰 검색
- `NEXT_PUBLIC_` 접두사로 노출되면 안 되는 시크릿 확인
- Supabase `service_role` 키가 클라이언트 코드에 노출되었는지 검색

**검색 패턴:**
```
Grep: "sk-", "sk_live", "sk_test" (API 키)
Grep: "password", "secret", "token" + "=" 또는 ":" (하드코딩)
Grep: "NEXT_PUBLIC_SUPABASE_SERVICE" (서비스 키 노출)
Grep: "supabaseAdmin", "createClient.*service_role" (admin 클라이언트 위치)
Glob: "**/.env*" (환경변수 파일)
```

**심각도:** CRITICAL

---

#### 카테고리 2: 인증/인가 점검

**점검 항목:**
- API 라우트(`app/api/`, `pages/api/`)에서 세션/인증 체크 누락 탐지
- admin 전용 라우트에서 권한 검증 여부
- Supabase admin 클라이언트(서비스롤)가 API 라우트 외부에서 사용되는지 확인
- RLS(Row Level Security) 우회 가능성: admin 클라이언트로 직접 DB 조작
- SECURITY DEFINER 함수에 입력값 검증이 있는지 확인
- middleware.ts/js의 보호 범위(matcher 패턴) 확인
- 인증 없이 접근 가능한 민감한 엔드포인트 탐지

**검색 패턴:**
```
Glob: "**/api/**/route.ts", "**/api/**/route.js"
Grep: "getSession", "getUser", "auth()", "getServerSession" (인증 함수)
Grep: "supabaseAdmin", "createServiceRoleClient" (admin 클라이언트)
Grep: "SECURITY DEFINER" (SQL 함수)
Read: middleware.ts (matcher 패턴 확인)
```

**심각도:** CRITICAL

---

#### 카테고리 3: Rate Limiting

**점검 항목:**
- API 엔드포인트별 rate limit 적용 여부
- AI 관련 엔드포인트(OpenAI, Anthropic 호출)에 rate limit 필수 확인
- 비용 발생 엔드포인트(이메일 발송, 결제 처리)에 rate limit 확인
- rate limit 라이브러리 사용 여부 (upstash/ratelimit, express-rate-limit 등)
- 로그인/회원가입 엔드포인트의 브루트포스 방어

**검색 패턴:**
```
Grep: "ratelimit", "rateLimiter", "rate-limit", "RateLimit"
Grep: "openai", "anthropic", "claude", "gpt" (AI 호출 위치)
Grep: "resend", "sendEmail", "sendMail" (이메일 발송 위치)
```

**심각도:** HIGH

---

#### 카테고리 4: 파일 업로드 보안

**점검 항목:**
- 파일 업로드 엔드포인트 존재 여부
- MIME 타입 서버사이드 검증 여부 (클라이언트만 검증하면 우회 가능)
- 파일 크기 제한 설정 여부
- 위험 파일 타입 차단 (.exe, .sh, .php, .svg+script)
- 업로드된 파일명 살균(sanitize) 처리 여부

**검색 패턴:**
```
Grep: "upload", "formData", "multipart", "multer"
Grep: "content-type", "mimetype", "file.type"
Grep: "maxSize", "sizeLimit", "MAX_FILE_SIZE"
```

**심각도:** HIGH

---

#### 카테고리 5: 스토리지 보안

**점검 항목:**
- Supabase Storage 퍼블릭 버킷 설정 확인
- 업로드 파일 경로에 UUID만 사용 시 URL 추측 가능성
- 스토리지 정책(RLS) 설정 여부
- 서명된 URL(signed URL) 사용 여부 확인
- CDN 캐시를 통한 민감 파일 노출 가능성

**검색 패턴:**
```
Grep: "createBucket", "storage.from", "getPublicUrl"
Grep: "signedUrl", "createSignedUrl"
Grep: "public.*bucket", "bucket.*public"
```

**심각도:** MEDIUM ~ HIGH

---

#### 카테고리 6: Prompt Injection

**점검 항목:**
- AI 프롬프트에 사용자 입력이 직접 삽입되는지 확인
- 시스템 프롬프트와 사용자 입력이 분리되어 있는지 확인
- 프롬프트 템플릿에서 이스케이프 처리 여부
- AI 응답이 코드 실행이나 DB 쿼리에 직접 사용되는지 확인

**검색 패턴:**
```
Grep: "system.*message", "role.*system" (시스템 프롬프트)
Grep: "content.*\${", "content.*\`" (템플릿 리터럴로 입력 삽입)
Grep: "chat.completions", "messages.create" (AI API 호출)
```

**심각도:** MEDIUM

---

#### 카테고리 7: 정보 노출

**점검 항목:**
- 에러 응답에 스택 트레이스, DB 쿼리, 내부 경로 노출 여부
- Content-Security-Policy(CSP) 헤더 설정 여부
- X-Frame-Options, X-Content-Type-Options 등 보안 헤더 확인
- API 응답에 불필요한 내부 정보(userId, 이메일 등) 포함 여부
- next.config에서 보안 헤더 설정 확인
- 디버그 모드가 프로덕션에서 활성화되어 있는지 확인

**검색 패턴:**
```
Grep: "console.error", "console.log" (프로덕션 로깅)
Grep: "stack", "trace", "error.message" (에러 상세 노출)
Grep: "Content-Security-Policy", "CSP"
Read: next.config.* (headers 설정 확인)
Grep: "NODE_ENV.*development" (디버그 분기)
```

**심각도:** MEDIUM

---

#### 카테고리 8: 의존성 취약점

**점검 항목:**
- `npm audit` 실행하여 알려진 CVE 확인
- 주요 패키지 버전이 최신인지 확인 (특히 보안 관련)
- `package-lock.json` 또는 lock 파일 존재 여부
- 미사용 의존성 확인

**실행:**
```bash
npm audit --json 2>/dev/null | head -100
```

**심각도:** LOW ~ HIGH (CVE에 따라 다름)

---

### Step 3: 취약점 분류 및 심각도 판정

발견된 모든 취약점을 아래 기준으로 분류합니다:

| 심각도 | 기준 | 예시 |
|--------|------|------|
| **CRITICAL** | 즉시 조치 필요. 데이터 유출, 인증 우회, 시크릿 노출 | .env 커밋, 인증 없는 admin API, service_role 키 클라이언트 노출 |
| **HIGH** | 빠른 조치 필요. 악용 시 서비스 장애 또는 비용 발생 | rate limit 없는 AI 엔드포인트, 파일 업로드 무검증, 퍼블릭 버킷 |
| **MEDIUM** | 계획적 조치. 특정 조건에서 악용 가능 | prompt injection, 에러 정보 노출, CSP 미설정 |
| **LOW** | 개선 권장. 보안 강화 목적 | 약한 웹훅 시크릿, 미사용 의존성, 보안 헤더 부재 |

---

### Step 4: 보안 감사 리포트 생성

아래 형식으로 마크다운 리포트를 작성합니다.

```markdown
# 보안 감사 리포트

**프로젝트:** [프로젝트명]
**점검일:** [날짜]
**점검 범위:** 8개 카테고리, [N]개 파일 분석

## 요약

| 심각도 | 발견 수 |
|--------|---------|
| CRITICAL | N |
| HIGH | N |
| MEDIUM | N |
| LOW | N |
| **총계** | **N** |

## 발견된 취약점

### [CRITICAL-1] 취약점 제목
- **심각도:** CRITICAL
- **카테고리:** [카테고리명]
- **위치:** `파일경로:라인번호`
- **설명:** 취약점 상세 설명
- **영향:** 악용 시 발생할 수 있는 피해
- **수정 방법:**
  ```typescript
  // 수정 전
  ...
  // 수정 후
  ...
  ```

(모든 취약점 반복)

## 우선순위 액션 아이템

심각도와 구현 난이도를 기반으로 정렬합니다:

| 순위 | 심각도 | 난이도 | 액션 | 예상 소요시간 |
|------|--------|--------|------|---------------|
| 1 | CRITICAL | 낮음 | .env를 .gitignore에 추가 | 5분 |
| 2 | CRITICAL | 중간 | API 라우트에 인증 미들웨어 추가 | 30분 |
| ... | ... | ... | ... | ... |

## 권장사항

(전반적인 보안 개선 방향)
```

리포트를 프로젝트 루트에 `SECURITY_AUDIT.md` 파일로 저장합니다.

---

## 사용 예시

```
/fireauto-secure
```

프로젝트 루트에서 실행하면 전체 코드베이스를 대상으로 보안 감사를 수행하고,
`SECURITY_AUDIT.md` 리포트를 생성합니다.
