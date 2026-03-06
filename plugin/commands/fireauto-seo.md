---
description: "SEO 종합점검 - 기술 SEO, 구조화 데이터, pSEO 감사"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - WebFetch
  - Write
  - Agent
user-invocable: true
---

# fireauto-seo: SEO 종합 감사

현재 프로젝트의 SEO 상태를 7개 영역에 걸쳐 종합적으로 감사합니다.
Next.js 프로젝트에 최적화되어 있으며, 실제 nomadfast, FireShipLanding, ditfinder 프로젝트 감사 경험을 바탕으로 합니다.

## 실행 절차

### 1단계: 프로젝트 구조 파악

먼저 프로젝트의 기본 구조를 파악합니다:

- `package.json`을 읽어 프레임워크 확인 (Next.js 버전, 관련 패키지)
- `next.config.*` 파일 확인
- `src/app/` 또는 `app/` 디렉토리 구조 파악
- `public/` 디렉토리 내 정적 파일 확인

### 2단계: 7개 영역 감사 수행

각 영역을 순차적으로 감사합니다. seo-auditor 에이전트를 호출하여 상세 감사를 수행합니다.

---

## 감사 영역 1: robots.txt 검증

**점검 항목:**
- `public/robots.txt` 또는 `app/robots.ts` (동적 생성) 존재 여부
- `User-agent` 규칙 적절성
- `Disallow` 규칙으로 민감 경로 차단 여부 (admin, api, dashboard 등)
- `Sitemap:` 지시자로 sitemap URL 참조 여부
- 프로덕션 환경에서 전체 차단(`Disallow: /`) 여부 점검

**패턴 검색:**
```
Glob: **/robots.{txt,ts,js}
Grep: "robots" in next.config.*
```

---

## 감사 영역 2: Sitemap 구조 분석

**점검 항목:**
- `public/sitemap.xml` 또는 `app/sitemap.ts` (동적 생성) 존재 여부
- sitemap index 사용 시 하위 sitemap 참조 유효성
- 모든 공개 라우트가 sitemap에 포함되어 있는지 비교
- `lastmod` 값의 정확성 (실제 콘텐츠 업데이트와 일치 여부)
- `changefreq`, `priority` 설정 적절성
- 다국어 사이트의 경우 `xhtml:link` hreflang alternate 포함 여부

**패턴 검색:**
```
Glob: **/sitemap.{xml,ts,js}
Grep: "sitemap" in app/ directory
```

---

## 감사 영역 3: JSON-LD 구조화 데이터 감사

**점검 항목:**
- `@type` 적절성 검증:
  - `Organization` / `WebSite` - 홈페이지
  - `Article` / `BlogPosting` - 블로그/콘텐츠
  - `Product` / `Offer` - 상품/가격
  - `FAQPage` / `Question` - FAQ 섹션
  - `BreadcrumbList` - 네비게이션
  - `Place` / `LocalBusiness` - 장소 기반 페이지
  - `HowTo`, `Review`, `Event` 등 특수 타입
- 필수 속성 누락 검증 (각 @type별 required properties)
- Google Rich Results 호환성 (https://search.google.com/test/rich-results 기준)
- 동일 페이지 내 중복/충돌 JSON-LD 블록 감지
- `@id` 참조 일관성
- 이미지, URL 등 속성값 유효성

**패턴 검색:**
```
Grep: "application/ld+json" in all tsx/jsx/ts/js files
Grep: "jsonLd" or "JsonLd" or "structured" in components
Grep: "@type" in lib/ or utils/ directories
```

---

## 감사 영역 4: 메타 태그 점검

**점검 항목:**
- `<title>` 태그: 존재, 길이(30-60자), 고유성
- `<meta name="description">`: 존재, 길이(120-160자), 고유성
- Open Graph 태그: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- Twitter Card 태그: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Canonical URL: `<link rel="canonical">` 존재 및 정확성
- `hreflang` 태그: 다국어 사이트 필수, 상호 참조 일관성
- `viewport` 메타 태그
- Next.js `metadata` / `generateMetadata` 사용 패턴 검증

**패턴 검색:**
```
Grep: "metadata" or "generateMetadata" in page.tsx/layout.tsx files
Grep: "openGraph" or "twitter" in metadata objects
Grep: "alternates" in metadata (hreflang)
```

---

## 감사 영역 5: pSEO (프로그래매틱 SEO) 라우트 감사

**점검 항목:**
- 동적 라우트 (`[slug]`, `[id]`, `[...params]`) 식별
- `generateStaticParams` 구현 여부 (SSG 대상 페이지)
- 대량 생성 페이지의 콘텐츠 품질:
  - Thin content 감지 (템플릿만 있고 고유 콘텐츠 부족)
  - 중복 콘텐츠 패턴 감지
  - 동적 데이터 소스 확인
- `noindex` 처리가 필요한 저품질 페이지 식별
- 내부 링크 구조 (pSEO 페이지 간 상호 연결)

**패턴 검색:**
```
Glob: **/\[*\]/**/page.tsx
Grep: "generateStaticParams" in all page files
Grep: "noindex" in metadata
```

---

## 감사 영역 6: 리다이렉트 체인 분석

**점검 항목:**
- `next.config.*` 내 `redirects` 설정
- `middleware.ts` 내 리다이렉트 로직
- 301 (영구) vs 302 (임시) 구분 적절성
- 리다이렉트 체인 감지 (A -> B -> C, 2홉 이상)
- 자기 참조 리다이렉트 (무한 루프 가능성)
- trailing slash 처리 일관성
- www vs non-www 리다이렉트
- HTTP -> HTTPS 리다이렉트

**패턴 검색:**
```
Grep: "redirect" in next.config.*, middleware.*
Grep: "permanentRedirect" or "redirect" in app/ directory
Grep: "NextResponse.redirect" in middleware
```

---

## 감사 영역 7: 성능 SEO

**점검 항목:**
- `loading.tsx` 파일 존재 여부 (주요 라우트별)
- `next/image` 사용 여부 (`<img>` 태그 직접 사용 감지)
- 이미지 최적화: `width`, `height`, `alt` 속성, WebP/AVIF 포맷
- `next/font` 사용 여부 (웹 폰트 최적화)
- 불필요한 클라이언트 컴포넌트 (`"use client"`) 감지
- `Suspense` 경계 적절성
- `dynamic import` / `lazy loading` 패턴
- 번들 크기에 영향을 주는 대형 라이브러리 감지

**패턴 검색:**
```
Glob: **/loading.tsx
Grep: "<img " in tsx/jsx files (next/image 미사용)
Grep: "use client" in page.tsx files
Grep: "next/font" in layout files
```

---

## 3단계: 감사 리포트 생성

모든 감사 결과를 종합하여 심각도별로 분류합니다:

### 심각도 기준

| 등급 | 의미 | 기준 |
|------|------|------|
| **P0 Critical** | 즉시 수정 필요 | 인덱싱 차단, 크롤링 불가, 심각한 구조 오류 |
| **P1 High** | 빠른 수정 권장 | Rich Results 누락, 메타 태그 미설정, 중복 콘텐츠 |
| **P2 Medium** | 개선 권장 | 최적화 미흡, 부분적 누락, 성능 저하 요소 |
| **P3 Low** | 참고 사항 | 모범 사례 미준수, 미세 최적화 기회 |

### 리포트 형식

감사 결과를 다음 형식으로 출력합니다:

```markdown
# SEO 감사 리포트

## 요약
- 점검 일시: {날짜}
- 프로젝트: {프로젝트명}
- 프레임워크: {Next.js 버전}
- 총 이슈: {N}건 (P0: {n}, P1: {n}, P2: {n}, P3: {n})

## P0 Critical 이슈
### [영역] 이슈 제목
- **현재 상태**: 구체적 문제 설명
- **영향**: SEO에 미치는 영향
- **수정 방법**: 코드 예시 포함한 구체적 수정 방법
- **참조 파일**: 관련 파일 경로

## P1 High 이슈
...

## P2 Medium 이슈
...

## P3 Low 이슈
...

## 권장 조치 순서
1. ...
2. ...
```

리포트는 터미널에 직접 출력합니다. 사용자가 파일 저장을 요청한 경우에만 파일로 저장합니다.
