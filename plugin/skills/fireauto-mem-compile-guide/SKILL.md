---
name: fireauto-mem-compile-guide
description: >
  "정리해줘", "요약해줘", "종합해줘", "지식 정리", "프로젝트 정리",
  "뭘 배웠지", "지금까지 한 것", "전체 요약", "지식 베이스", "컴파일",
  "knowledge base", "compile", "summarize project", "what did we learn"
  등 프로젝트 지식을 종합하거나 정리를 요청할 때 사용하세요.
---

# 지식 컴파일 가이드

프로젝트의 메모리를 종합하여 구조화된 지식 문서를 생성합니다.

## 컴파일 흐름

1. **memory-compile** MCP 도구 호출
   - project: 현재 프로젝트명
   - format: 용도에 따라 선택
     - 'wiki': 전체 지식 베이스 (패턴, 결정, 주의사항 분류)
     - 'summary': 핵심 요약만
     - 'lessons': 배운 점/교훈 중심

2. 결과를 사용자에게 제시

3. 필요시 memory-search + memory-related로 보충

## 출력 형식

### wiki 형식
패턴, 주의사항, 결정사항, 버그 수정, 기능 구현 카테고리별 정리.
각 항목에 관련 메모리 ID 참조.

### summary 형식
프로젝트 한 줄 요약 + 핵심 3-5개 포인트.

### lessons 형식
"이 프로젝트에서 배운 것" 중심.
