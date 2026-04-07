---
name: fireauto-knowledge-hierarchy-guide
description: >
  지식을 찾을 때 다음 순서로 탐색하세요:
  1. CLAUDE.md — 핵심 규칙 + 지도 (항상 로드됨)
  2. wiki-read — 상세 지식 페이지 (능동적으로 검색)
  3. skill-search — DB에 저장된 재사용 스킬 (필요할 때 검색)
  4. memory-search — 과거 작업 기록 (관련 맥락 필요할 때)
  "어떻게", "방법", "패턴", "규칙", "이전에", "참고" 등에 트리거.
---

# 지식 계층 탐색 가이드

## 탐색 순서

1. **CLAUDE.md** 확인 (이미 로드됨) — 핵심 규칙, 주의사항, Wiki/스킬 포인터
2. **wiki-read** 호출 — patterns, gotchas, decisions 등 상세 페이지
3. **skill-search** 호출 — DB에서 관련 스킬 검색
4. **memory-search** 호출 — 과거 작업 기록에서 관련 맥락

---

## 언제 뭘 쓰나

| 상황 | 탐색 대상 |
|------|-----------|
| 코딩 패턴 | `wiki-read patterns` |
| 주의사항 | `wiki-read gotchas` |
| 설계 이유 | `wiki-read decisions` |
| 재사용 코드 | `skill-search` |
| 과거 작업 | `memory-search` |

---

## 톤 & 스타일

- **문체**: 토스체 — 친근하고 간결하게
- **분량**: 핵심만 짧게. 장황하게 설명하지 않아요
- **행동 유도**: 검색 결과를 답변에 바로 반영해요
