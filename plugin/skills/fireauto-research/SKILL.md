---
name: fireauto-research
description: >
  This skill should be used when the user asks to "레딧 리서치", "reddit research",
  "수요조사", "시장조사", "리드 스코어링", "lead scoring", "market research",
  "레딧에서 고객 찾기", "레딧 데이터 수집", "reddit lead generation", or
  mentions Reddit-based market validation or customer discovery.
---

# Reddit 기반 시장 조사

Reddit은 B2B/B2C SaaS 시장 조사에 가장 풍부한 무료 데이터 소스 중 하나이다. 사용자들이 익명으로 솔직한 의견을 공유하기 때문에 설문조사보다 진솔한 인사이트를 얻을 수 있다.

## 핵심 워크플로우

### 1. 데이터 수집

Reddit 공개 JSON/RSS 엔드포인트를 활용하여 인증 없이 데이터를 수집한다.

**주요 엔드포인트:**
- 서브레딧 검색: `reddit.com/r/{sub}/search.json?q={query}&restrict_sr=1&sort=relevance&t=month`
- 최신글: `reddit.com/r/{sub}/new.json?limit=25`
- 댓글: `reddit.com/comments/{post_id}.json`

Rate limiting: 요청 간 최소 2초 간격, 세션당 최대 100 요청.

### 2. 서브레딧 선정

좋은 서브레딧 기준: 최소 10K subscribers, 일 평균 5개 이상 포스트, 질문 비율 30% 이상.

### 3. 리드 스코어링 (1-10점)

| 차원 | 배점 | 기준 |
|------|------|------|
| 참여도 | 2.5점 | 댓글 >= 10 (+1), upvotes >= 20 (+1), 둘 다 높으면 (+0.5) |
| 콘텐츠 깊이 | 2.5점 | 500자+ (+1.5), 구체적 요구사항 (+1) |
| 긴급성 | 2.5점 | urgency 키워드 수에 비례 |
| 도움요청 | 2.5점 | 질문형 (+1), "recommend" (+1), 예산 언급 (+0.5) |

### 4. 4-Tier 분류

- **hot_lead (8-10)**: 구체적 요구사항 + 예산 + 긴급성
- **warm_lead (5-7)**: 문제 인식 + 솔루션 탐색 중
- **cold_lead (3-4)**: 관련 대화에 참여하나 구매 의향 불명확
- **not_a_lead (1-2)**: 관련 없음 또는 false positive

### 5. False Positive 필터 (12 패턴)

반드시 not_a_lead로 거부:
1. 불만토로/좌절 공유 (가장 흔한 false positive)
2. 경쟁자가 직접 만드는 사람
3. 어필리에이트/파트너십 제안
4. 일반 토론 스타터 ("How did you get your first 100 users?")
5. 이미 솔루션 찾은 사람
6. 학생/취미 프로젝트
7. 구인/구직 포스트
8. 자기홍보/스팸
9. AMA/인터뷰
10. 뉴스/트렌드 공유
11. 밈/유머
12. 플랫폼 메타 토론

### 6. Pain Point 분류

| 카테고리 | 키워드 예시 |
|----------|------------|
| Cost | "expensive", "budget", "pricing" |
| Time | "takes forever", "slow", "deadline" |
| Complexity | "complicated", "learning curve" |
| Regulation | "GDPR", "compliance", "OSHA" |
| Scale | "growing", "can't handle", "enterprise" |

## 결과물

- **CSV**: post_url, subreddit, author, title, lead_score, urgency_level, pain_points, existing_solutions 등 13컬럼
- **마크다운 리포트**: 요약 통계, Top 10 리드, Pain Point 분포, 경쟁사 언급

## 커맨드

`/fireauto-research` 실행으로 전체 파이프라인을 시작한다.

## 추가 리소스

상세 방법론은 `references/methodology.md` 참조.
