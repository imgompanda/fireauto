---
name: fireauto-seo-guide
description: >
  "SEO 감사", "SEO audit", "기술 SEO", "technical SEO", "구조화 데이터",
  "schema markup", "JSON-LD", "robots.txt", "sitemap", "메타 태그",
  "검색엔진 최적화", "pSEO", "Rich Results", "Core Web Vitals" 등
  SEO 관련 최적화나 감사 시 사용하세요.
---

# SEO 감사 방법론

Next.js 프로젝트에 대한 포괄적 SEO 감사를 수행하기 위한 방법론. 실제 프로덕션 프로젝트 감사 경험에서 축적된 패턴 기반.

## 감사 원칙

1. **코드 기반 감사**: 소스 코드 분석으로 빌드 전 이슈 발견
2. **프레임워크 인식**: Next.js App Router 패턴에 최적화
3. **심각도 기반 우선순위**: P0(Critical) ~ P3(Low)
4. **실행 가능한 피드백**: 각 이슈에 구체적 수정 코드 제시

## 감사 순서 (의존성 기반)

1. robots.txt / sitemap — 크롤링 기반
2. 메타 태그 — 인덱싱 기반
3. JSON-LD 구조화 데이터 — Rich Results
4. pSEO 라우트 — 대량 페이지 품질
5. 리다이렉트 체인 — 크롤 버짓 낭비
6. 성능 SEO — Core Web Vitals

## 핵심 체크리스트

### robots.txt
- 파일 존재 (public/robots.txt 또는 app/robots.ts)
- 프로덕션에서 Disallow: / 아닌지 확인
- 민감 경로 차단 (admin, api, dashboard)
- Sitemap 지시자 포함

### Sitemap
- 모든 공개 라우트 포함
- lastmod 정확성
- 다국어 alternate 링크 (hreflang)

### JSON-LD 구조화 데이터
- 홈페이지: Organization + WebSite
- 블로그: Article (headline, datePublished, author, image)
- 상품: Product + Offer (name, price, availability)
- FAQ: FAQPage + Question
- 네비게이션: BreadcrumbList
- 중복 블록 없음

### 메타 태그
- title (30-60자), description (120-160자)
- og:title, og:description, og:image
- canonical URL, hreflang

### 성능 SEO
- loading.tsx 존재 (주요 라우트)
- next/image 사용
- 불필요한 "use client" 없음

## 자주 발견되는 이슈 패턴 (Next.js)

1. **metadata export 누락**: 동적 라우트에서 특히 흔함
2. **JSON-LD 중복**: layout.tsx + page.tsx 양쪽에서 렌더링
3. **sitemap에서 동적 라우트 누락**: DB 조회 없이 정적 URL만 나열
4. **canonical URL 불일치**: 다국어 사이트에서 기본 언어만 지정
5. **OG 이미지 미설정**: SNS 공유 시 이미지 없이 노출
6. **클라이언트 컴포넌트 과다**: page.tsx에 "use client" → SSR 이점 상실

## 커맨드

`/fireauto-seo` 실행으로 전체 감사를 시작한다.

## 추가 리소스

- JSON-LD 필수 속성 참조표: `references/json-ld-schemas.md`
- 도구 활용 가이드: `references/tools-guide.md`
