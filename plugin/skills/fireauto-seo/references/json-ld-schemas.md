# JSON-LD 필수 속성 참조표

## Article / BlogPosting
```json
{
  "@type": "Article",
  "headline": "필수",
  "image": "필수",
  "datePublished": "필수",
  "dateModified": "권장",
  "author": { "@type": "Person", "name": "필수" }
}
```

## Product
```json
{
  "@type": "Product",
  "name": "필수",
  "image": "필수",
  "offers": {
    "@type": "Offer",
    "price": "필수",
    "priceCurrency": "필수",
    "availability": "권장",
    "url": "권장"
  }
}
```

## FAQPage
```json
{
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "필수 (질문 텍스트)",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "필수 (답변 텍스트)"
    }
  }]
}
```

## BreadcrumbList
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": "필수 (숫자)",
    "name": "필수",
    "item": "필수 (URL)"
  }]
}
```

## LocalBusiness / Place
```json
{
  "@type": "LocalBusiness",
  "name": "필수",
  "address": { "@type": "PostalAddress" },
  "geo": { "@type": "GeoCoordinates", "latitude": "권장", "longitude": "권장" },
  "telephone": "권장",
  "openingHoursSpecification": "권장"
}
```

## Organization
```json
{
  "@type": "Organization",
  "name": "필수",
  "url": "필수",
  "logo": "권장",
  "sameAs": "권장 (SNS 링크 배열)"
}
```

## WebSite
```json
{
  "@type": "WebSite",
  "name": "필수",
  "url": "필수",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "권장",
    "query-input": "권장"
  }
}
```
