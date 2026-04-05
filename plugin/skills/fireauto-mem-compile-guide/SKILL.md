---
name: fireauto-mem-compile-guide
description: >
  축적된 개발 지식을 구조화된 문서로 종합하세요.
  프로젝트 마무리, 인수인계, 회고, 또는 지식이 충분히 쌓였을 때
  memory-compile로 패턴·결정·주의사항을 체계적으로 정리하세요.
  "정리해줘", "요약해줘", "지식 정리", "프로젝트 정리", "뭘 배웠지",
  "compile", "summarize project" 등 요청 시에도 사용하세요.
---

# 지식 컴파일 가이드

축적된 개발 지식을 구조화된 문서로 종합합니다.
Andrej Karpathy의 LLM Knowledge Base 워크플로우에서 영감을 받았어요.

## 언제 컴파일하나요?

- 프로젝트 **마일스톤 완료** 시
- **인수인계**나 문서화가 필요할 때
- **회고**(retrospective) 시
- 사용자가 **명시적으로 요청**할 때
- 지식이 **20건 이상** 쌓였을 때

## 컴파일 형식

| 형식 | 용도 |
|------|------|
| `wiki` | 전체 지식 베이스 — 패턴, 결정, 주의사항, 버그 이력 카테고리별 |
| `summary` | 핵심 요약 — 프로젝트 한 줄 요약 + 핵심 포인트 |
| `lessons` | 교훈 중심 — "이 프로젝트에서 배운 것" |

## memory-compile 호출

```
memory-compile:
  project: 현재 프로젝트명
  format: wiki | summary | lessons
```

## Health Check 활용

컴파일 전에 지식 DB의 건강 상태를 확인하면 좋아요:
- 고아 메모리 (관계 없는 메모리)
- 중복 메모리
- 내용이 빈약한 메모리

Worker API: `GET /api/health-check?project={project}`
