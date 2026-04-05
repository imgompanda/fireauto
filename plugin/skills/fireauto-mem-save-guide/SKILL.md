---
name: fireauto-mem-save-guide
description: >
  "기억해둬", "저장해둬", "메모해둬", "잊지 말고", "나중에 참고",
  "패턴으로 저장", "이거 중요한", "기록해둬", "메모리에 저장",
  "remember this", "save this", "note this", "keep this"
  등 사용자가 특정 지식을 기억하거나 저장하라고 요청할 때 사용하세요.
---

# 메모리 저장 가이드

사용자가 특정 지식을 저장하라고 요청하면 memory-save MCP 도구를 사용하세요.

## 저장 흐름

1. 사용자 요청에서 **핵심 지식** 추출
2. 적절한 **type** 결정:
   - pattern: 패턴, 모범 사례, 컨벤션
   - decision: 설계 결정, 아키텍처 선택
   - gotcha: 주의사항, 함정, 삽질 기록
   - feature: 구현한 기능 설명
   - bugfix: 버그 수정 과정/원인
   - refactor: 리팩토링 이유/방법
3. **title**: 간결하고 검색하기 좋은 제목
4. **content**: 구체적 내용 (코드 예시, 이유, 맥락 포함)
5. **tags**: 나중에 검색할 키워드

## 예시

사용자: "sql.js에서 FTS5 안 되는 거 기억해둬"
→ memory-save:
  - title: "sql.js WASM에서 FTS5 미지원"
  - content: "sql.js WASM 빌드에 FTS5 모듈이 포함되지 않음. FTS4를 사용해야 함. FTS4는 fts4(title, content, tags, content='memories') 형태로 사용."
  - type: "gotcha"
  - tags: ["sql.js", "fts", "sqlite", "wasm"]
