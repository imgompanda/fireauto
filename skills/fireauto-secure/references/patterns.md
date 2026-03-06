# 보안 감사 상세 검색 패턴

## CAT-1: 환경변수/시크릿 노출

### 검색 대상
```
Glob: **/.env, **/.env.*, **/.env.production
Grep: "sk-", "sk_live", "sk_test", "AKIA", "ghp_"
Grep: "password\s*=\s*['\"]", "secret\s*=\s*['\"]"
Grep: "NEXT_PUBLIC_.*KEY", "NEXT_PUBLIC_.*SECRET"
```

### 판정 기준
- .env.production이 git에 포함 → CRITICAL
- API 키가 소스에 하드코딩 → CRITICAL
- NEXT_PUBLIC_에 서비스 키 노출 → HIGH

## CAT-2: 인증/인가

### 검색 대상
```
Glob: **/app/api/**/route.{ts,js}
각 API 라우트에서 검색:
- "getSession", "getUser", "auth()", "cookies()", "getServerSession"
- "createAdminClient", "supabaseAdmin" (RLS 우회)
```

### 판정 기준
- API 라우트에 인증 없음 → CRITICAL (비용 발생 시) / HIGH (일반)
- admin 클라이언트 무분별 사용 → HIGH
- 미들웨어가 API 라우트 미보호 → MEDIUM

## CAT-3: Rate Limiting

### 검색 대상
```
AI 호출 위치:
Grep: "openai", "anthropic", "claude", "gpt", "gemini"

이메일 발송:
Grep: "resend", "sendEmail", "sendgrid"

같은 파일에서 rate limit 확인:
Grep: "ratelimit", "rateLimiter", "Ratelimit"
```

### 판정 기준
- AI 엔드포인트에 rate limit 없음 → HIGH
- 이메일/SMS 발송에 rate limit 없음 → MEDIUM

## CAT-4: 파일 업로드

### 검색 대상
```
Grep: "upload", "formData", "multipart"
확인: MIME 타입 검증, 파일 크기 제한, 확장자 화이트리스트
```

### 판정 기준
- MIME 검증 없음 → HIGH
- 파일 크기 제한 없음 → MEDIUM
- 위험 확장자 미차단 (.exe, .sh, .php) → HIGH

## CAT-5: 스토리지 보안

### 검색 대상
```
Grep: "public.*bucket", "publicUrl", "getPublicUrl"
Supabase: storage.from("bucket").getPublicUrl(path)
```

### 판정 기준
- 사용자 파일이 퍼블릭 버킷 → HIGH
- UUID 기반 URL 추측 가능 → MEDIUM

## CAT-6: Prompt Injection

### 검색 대상
```
Grep: "content.*\$\{", "content.*\`.*\$\{"
AI 메시지 배열에서 사용자 입력 직접 삽입 확인
```

### 판정 기준
- 사용자 입력이 시스템 프롬프트에 직접 삽입 → MEDIUM
- 사용자 입력이 user 메시지에만 포함 → 정상

## CAT-7: 정보 노출

### 검색 대상
```
Grep: "stack", "trace", "err.message" (API 응답에서)
헤더 검색: "Content-Security-Policy", "X-Content-Type-Options"
```

### 판정 기준
- 스택 트레이스가 클라이언트에 노출 → MEDIUM
- CSP 헤더 누락 → LOW

## CAT-8: 의존성 취약점

### 실행
```bash
npm audit --json
```

### 판정 기준
- critical 취약점 → HIGH
- high 취약점 → MEDIUM
- moderate 이하 → LOW
