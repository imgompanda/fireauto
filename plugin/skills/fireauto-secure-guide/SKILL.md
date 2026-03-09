---
name: fireauto-secure-guide
description: >
  "보안 점검", "security check", "security audit", "취약점 분석",
  "vulnerability scan", "보안 감사", "시크릿 노출", "API 보안", "인증 점검",
  "rate limit" 등 보안 관련 코드 리뷰나 취약점 감사 시 사용하세요.
---

# 보안 감사 방법론

실제 SaaS 프로젝트에서 총 18개 취약점을 발견한 패턴을 기반으로 한 보안 감사 방법론.

## 감사 8개 카테고리

1. **환경변수/시크릿 노출** — .env 파일, 하드코딩된 키, NEXT_PUBLIC_ 오용
2. **인증/인가** — 미인증 API, admin 클라이언트 남용, RLS 우회
3. **Rate Limiting** — AI/비용 발생 엔드포인트 보호
4. **파일 업로드** — MIME 검증, 크기 제한, 위험 파일 차단
5. **스토리지 보안** — 퍼블릭 버킷, URL 추측
6. **Prompt Injection** — 사용자 입력 직접 삽입
7. **정보 노출** — 에러 상세, CSP 헤더
8. **의존성 취약점** — npm audit, CVE

## 심각도 분류

| 심각도 | 기준 |
|--------|------|
| CRITICAL | 즉시 조치. 데이터 유출, 인증 우회, 시크릿 노출 |
| HIGH | 빠른 조치. 서비스 장애, 비용 발생 가능 |
| MEDIUM | 계획적 조치. 특정 조건에서 악용 가능 |
| LOW | 개선 권장. 보안 강화 목적 |

## 핵심 검색 패턴

### 시크릿 노출
```
"sk-", "sk_live", "sk_test"           → API 키
"password.*=", "secret.*=", "token.*=" → 하드코딩
"NEXT_PUBLIC_.*SERVICE"                → 서비스 키 클라이언트 노출
```

### 인증 누락
```
API 라우트에서 아래 패턴이 없으면 인증 미적용:
"getSession", "getUser", "auth()", "cookies()"
```

### Rate Limit 누락
```
AI 호출: "openai", "anthropic", "claude", "gpt"
같은 파일에 "ratelimit"이 없으면 취약
```

### Prompt Injection
```
content: `...${userInput}...`
→ 시스템 프롬프트와 사용자 메시지가 분리되어야 함
```

## 우선순위 산정

**우선순위 = 심각도 점수 × 구현 용이성**
- 심각도: CRITICAL(4), HIGH(3), MEDIUM(2), LOW(1)
- 구현 용이성: 쉬움(3), 보통(2), 어려움(1)

## 커맨드

`/fireauto-secure` 실행으로 전체 보안 감사를 시작한다.

## 추가 리소스

상세 검색 패턴과 수정 가이드: `references/patterns.md`
