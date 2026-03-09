# SEO 감사 도구 활용 가이드

## 감사 영역별 도구 매핑

| 감사 영역 | 주요 도구 | 사용 방법 |
|-----------|-----------|-----------|
| robots.txt | Glob, Read | 파일 찾기 + 내용 분석 |
| sitemap | Glob, Read, Grep | 파일 + 라우트 비교 |
| JSON-LD | Grep, Read | 패턴 검색 + 속성 검증 |
| 메타 태그 | Grep, Read | metadata export 검색 |
| pSEO | Glob, Read, Grep | 동적 라우트 구조 분석 |
| 리다이렉트 | Read, Grep | config + middleware 분석 |
| 성능 | Glob, Grep | 파일 존재 + 패턴 검색 |

## 검색 패턴

### robots.txt 찾기
```
Glob: **/robots.{txt,ts,js}
```

### sitemap 찾기
```
Glob: **/sitemap.{xml,ts,js}
```

### JSON-LD 검색
```
Grep: "application/ld+json" 또는 "@type"
```

### metadata export 검색
```
Grep: "export const metadata" 또는 "generateMetadata"
```

### OG 이미지 검색
```
Glob: **/opengraph-image.{tsx,jsx,png,jpg}
Grep: "openGraph"
```

### 클라이언트 컴포넌트 확인
```
Grep: "use client" (page.tsx 파일에서)
```

### loading.tsx 존재 확인
```
Glob: **/loading.tsx
```

### next/image 사용 확인
```
Grep: "<img " (next/image 대신 raw img 사용 위치)
```
