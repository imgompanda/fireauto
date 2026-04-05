---
name: fireauto-mem-search-guide
description: >
  "이전에", "지난번에", "예전에", "기억", "한 적 있", "했었는데",
  "찾아줘", "검색해줘", "히스토리", "기록", "작업 내역", "작업 기록",
  "뭐 했었지", "어디서 봤는데", "이전 세션", "저번에",
  "previously", "remember", "history", "last time", "search memory"
  등 과거 작업을 참조하거나 이전 기록을 찾을 때 자동으로 사용하세요.
---

# 메모리 검색 가이드

사용자가 과거 작업을 참조할 때 fireauto-mem MCP 도구를 사용하여 검색하세요.

## 검색 흐름

1. **memory-search**로 키워드 검색
   - 사용자 메시지에서 핵심 키워드 추출
   - type 필터 활용: bugfix, feature, pattern, decision, gotcha, refactor

2. **memory-detail**로 상세 조회
   - search 결과에서 관련성 높은 ID 선택
   - 전체 내용 (subtitle, narrative, facts) 확인

3. **memory-related**로 관련 메모리 탐색
   - 찾은 메모리와 연결된 다른 메모리 확인
   - depth=2로 2촌 관계까지 탐색

4. 결과를 자연스럽게 답변에 통합
   - "이전에 이런 작업을 했었어요: ..."
   - 관련 메모리가 있으면 함께 제시

## 예시

사용자: "지난번에 인증 관련 작업했던 거 뭐였지?"
→ memory-search: query="인증"
→ memory-detail: ids=[3, 7]
→ memory-related: id=3, depth=1
→ "이전에 인증 토큰 갱신 버그를 수정했어요. (메모리 #3) 관련해서 ..."
