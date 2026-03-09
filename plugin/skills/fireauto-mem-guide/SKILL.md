---
name: fireauto-mem-guide
description: >
  "메모리 관리", "memory", "기억", "컨텍스트 저장", "세션 간 기억",
  "히스토리", "작업 기록", "claude-mem", "remember", "이전 작업 불러오기"
  등 세션 간 컨텍스트 관리나 작업 기록 추적에 관한 질문일 때 사용하세요.
---

# 메모리 관리 가이드 (claude-mem 연동)

## claude-mem이란?

[claude-mem](https://github.com/thedotmack/claude-mem)은 Claude Code에서 세션 간 기억을 관리하는 플러그인이다. 대화가 끝나도 중요한 정보를 기억하고, 다음 세션에서 불러올 수 있다.

## 설치 방법

```bash
# Claude Code 안에서
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem@claude-mem
```

## 기본 기능

- **자동 저장**: 중요한 발견, 결정, 패턴을 자동으로 메모리에 저장
- **검색**: 메모리에서 키워드로 검색
- **타임라인**: 시간순 작업 히스토리 추적
- **수동 저장**: `save_memory`로 직접 저장

## fireauto와 함께 쓰기

### /fireauto-research + 메모리
수요조사 결과를 저장 → 다음 조사 시 이전 결과와 비교 가능.

### /fireauto-prd + 메모리
이전에 조사한 API, 경쟁사 정보를 자동 참조.

### /fireauto-seo + 메모리
정기 감사 시 이전 결과와 비교하여 개선/악화 추적.

### /fireauto-secure + 메모리
반복되는 취약점 패턴 발견.

### /fireauto-team + 메모리
효과적이었던 워크스트림 분할 패턴 기억.

## 메모리 베스트 프랙티스

### 저장할 것
- 프로젝트 아키텍처 결정사항
- 반복 패턴 (코드 스타일, 네이밍 규칙)
- 버그 원인과 해결 방법
- 외부 서비스 연동 방법

### 저장하지 않을 것
- 임시 디버깅 로그
- 환경변수 값이나 시크릿
- 확정되지 않은 추측
