---
name: fireauto-mem-save-guide
description: >
  개발 중 발견한 중요한 지식을 데이터베이스에 능동적으로 축적하세요.
  사용자가 요청하지 않아도, 버그 수정·패턴 발견·설계 결정·주의사항 등
  가치 있는 지식이 발생하면 자동으로 memory-save를 호출하세요.
  사용자가 "기억해둬", "저장해둬", "remember this" 등으로 명시할 때도 사용하세요.
---

# 지식 능동 축적 가이드

fireauto-mem은 사용자의 개발 지식 DB입니다.
**사용자가 말하지 않아도** 가치 있는 지식을 능동적으로 저장하세요.

## 언제 능동적으로 저장하나요?

자동으로 저장할 가치가 있는 상황:

| 상황 | type | 예시 |
|------|------|------|
| 버그를 찾고 해결했을 때 | bugfix | "setState 비동기 이슈 — useEffect에서 처리" |
| 반복 사용할 패턴을 발견했을 때 | pattern | "Result 타입으로 에러 흐름 통일" |
| 중요한 설계 결정을 내렸을 때 | decision | "MCP 서버를 Thin Wrapper로 구현한 이유" |
| 삽질 후 원인을 알게 됐을 때 | gotcha | "sql.js WASM에 FTS5 없음 → FTS4 사용" |
| 핵심 기능을 구현 완료했을 때 | feature | "SSE 실시간 스트리밍 + 자동 재연결" |
| 코드를 의미있게 개선했을 때 | refactor | "worker.cjs 함수명 db.cjs와 통일" |

## 저장 기준

- **재사용 가치**: 다음에 비슷한 상황에서 도움이 될까?
- **맥락 가치**: 왜 이렇게 했는지가 중요한가?
- **위험 방지**: 같은 실수를 반복하지 않으려면 기록이 필요한가?

→ 하나라도 해당하면 저장하세요.

## memory-save 호출 패턴

```
memory-save:
  title: 간결하고 검색하기 좋은 제목
  content: 구체적 내용 (코드 예시, 이유, 맥락)
  type: bugfix | feature | pattern | decision | gotcha | refactor
  tags: [관련 키워드들]
```
