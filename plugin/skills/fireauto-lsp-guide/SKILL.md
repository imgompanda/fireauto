---
name: fireauto-lsp-guide
description: >
  "정의로 이동", "참조 찾기", "심볼 검색", "타입 확인", "호출 계층",
  "코드 찾기", "함수 찾기", "어디서 쓰이는지", "어디에 정의된",
  "구현체 찾기", "인터페이스 구현", "코드 추적", "코드 탐색" 등
  코드 탐색이나 심볼 검색이 필요할 때 자동으로 LSP 도구를 우선 사용하세요.
---

# LSP 우선 사용 가이드

LSP(Language Server Protocol) 도구가 활성화되어 있으면, 코드 탐색 시 Grep/Glob 대신 **LSP를 먼저 사용**하세요.

## 핵심 원칙

**코드를 찾을 때 이 순서를 따르세요:**

1. **LSP** (가장 빠르고 정확) → 정의, 참조, 심볼, 호출 계층
2. **Glob/Grep** (LSP로 안 되는 경우) → 파일 패턴 검색, 텍스트 검색
3. **Read** (내용 확인) → LSP로 위치를 찾은 후 해당 파일 읽기

## LSP 도구 활용 매핑

| 사용자가 이렇게 말하면 | LSP 연산 | 설명 |
|----------------------|----------|------|
| "이 함수 어디에 정의돼있어?" | `goToDefinition` | 심볼이 선언된 위치로 이동 |
| "이거 어디서 쓰이고 있어?" | `findReferences` | 모든 참조 위치를 찾음 |
| "이 타입이 뭐야?" | `hover` | 타입 정보, 문서 표시 |
| "이 파일에 뭐가 있어?" | `documentSymbol` | 파일 내 모든 함수/클래스/변수 목록 |
| "프로젝트에서 OO 찾아줘" | `workspaceSymbol` | 워크스페이스 전체 심볼 검색 |
| "이 인터페이스 구현체 찾아줘" | `goToImplementation` | 인터페이스/추상 메서드의 구현체 |
| "이 함수를 누가 호출해?" | `incomingCalls` | 이 함수를 호출하는 모든 곳 |
| "이 함수가 뭘 호출해?" | `outgoingCalls` | 이 함수가 호출하는 모든 것 |

## 실전 패턴

### 버그 수정 요청
```
사용자: "결제 로직에 버그가 있어"

1. workspaceSymbol → "payment", "checkout" 등으로 관련 심볼 검색
2. goToDefinition → 핵심 함수 위치 확인
3. incomingCalls → 어디서 호출되는지 추적
4. findReferences → 관련 타입/변수가 어디서 쓰이는지 파악
5. Read → 찾은 파일의 실제 코드 확인 후 수정
```

### 리팩토링 요청
```
사용자: "PaymentProvider 인터페이스 수정해줘"

1. goToDefinition → 인터페이스 정의 위치
2. goToImplementation → 모든 구현체 (Lemon, Paddle, Toss)
3. findReferences → 인터페이스를 사용하는 모든 곳
4. 영향 범위 파악 후 안전하게 수정
```

### 코드 이해 요청
```
사용자: "이 프로젝트 구조 설명해줘"

1. documentSymbol → 주요 파일들의 심볼 목록
2. workspaceSymbol → 핵심 타입/함수 전체 조회
3. incomingCalls/outgoingCalls → 호출 흐름 파악
```

## 주의사항

- LSP는 **코드 구조** 탐색에 최적화돼 있어요. 문자열 검색(에러 메시지, 설정값 등)은 여전히 Grep이 나아요.
- LSP 서버가 없는 언어 파일은 자동으로 Grep/Glob으로 폴백하세요.
- `line`과 `character`는 **1-based** (1부터 시작)예요.
