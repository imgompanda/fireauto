---
name: fireauto-prd
description: >
  This skill should be used when the user asks to "PRD 작성", "기획서",
  "제품 기획", "product requirements", "아이디어 구체화", "서비스 기획",
  "feasibility", "실현 가능성", "API 조사", "기술 스택 추천",
  "경쟁사 분석", "수익 모델", or mentions turning an idea into
  a structured product requirements document.
---

# PRD 작성 가이드

아이디어 한 줄을 상세한 PRD(Product Requirements Document)로 변환하는 방법론. 실현 가능성 조사와 필요 API/서비스 조사를 포함한다.

## PRD 섹션 구조

### 1. 프로젝트 개요
- 서비스명, 한 줄 설명
- Problem Statement (해결하는 문제)
- 타겟 사용자 (ICP)

### 2. 핵심 기능
- P0 (MVP 필수): 이것 없으면 서비스가 안 됨
- P1 (있으면 좋음): 차별화 요소
- P2 (향후 확장): 성장 후 추가
- 각 기능은 사용자 스토리 형식: "~로서, ~하고 싶다, 왜냐하면 ~"

### 3. 기술 실현 가능성
- 핵심 기술 구현 가능 여부
- 난이도 평가: 쉬움/보통/어려움/매우어려움
- 기술적 위험 요소
- 대안 접근법

### 4. 필요한 외부 API/서비스
WebSearch로 실제 조사하여 각 항목 포함:
- 이름, URL, 가격 (무료 티어/유료)
- 주요 기능, 제한사항
- 대안 서비스

### 5. 경쟁사 분석
- 이름, URL, 가격, 핵심 차별점
- 포지셔닝 (가격 vs 기능)
- 우리의 차별화 전략

### 6. 기술 스택 제안
- 프론트엔드, 백엔드, DB, 인프라
- 선택 이유, 예상 월 비용

### 7. 수익 모델
- 가격 전략, 예상 단가, 시장 규모

### 8. 구현 로드맵
- Phase 1 (MVP, 2-4주)
- Phase 2 (성장, 1-2개월)
- Phase 3 (확장, 2-3개월)

### 9. 성공 지표 (KPIs)
- 1주/1개월/3개월 목표

## 좋은 PRD의 특징

1. **구체적**: "빠르게" 대신 "3초 이내"
2. **측정 가능**: 성공 기준이 숫자로 표현
3. **실행 가능**: 개발자가 바로 작업 가능한 수준
4. **우선순위 명확**: P0/P1/P2 구분

## API 선택 기준

| 기준 | 평가 방법 |
|------|----------|
| 가격 | 무료 티어 범위, 유료 단가 |
| 안정성 | uptime SLA, status page 존재 |
| 문서화 | API docs 품질, 예제 코드 |
| 커뮤니티 | GitHub stars, Stack Overflow 답변 수 |
| SDK | 사용 언어 SDK 존재 여부 |

## 커맨드

`/fireauto-prd` 실행으로 PRD 생성을 시작한다. `docs/prd/` 폴더에 저장된다.
