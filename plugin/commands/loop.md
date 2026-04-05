---
description: "AI가 알아서 반복하며 작업을 완성해요. 프롬프트 하나면 충분해요."
argument-hint: "할 일을 자연어로 설명하세요"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh:*)", "AskUserQuestion"]
hide-from-slash-command-tool: "true"
user-invocable: true
---

# fireauto loop

사용자가 자연어로 작성한 요청에서 루프 설정을 추출하세요.

## 1단계: 자연어 파싱

사용자의 `$ARGUMENTS`를 분석해서 3가지를 추출하세요:

- **할 일** (필수): 실제 작업 내용
- **최대 반복 횟수**: 숫자가 있으면 추출, 없으면 0 (무제한)
- **완료 조건**: 완료/목표/조건에 해당하는 부분, 없으면 null

### 파싱 예시

| 입력 | 할 일 | 최대 횟수 | 완료 조건 |
|------|-------|----------|----------|
| "최대 20번 반복해서 TODO API 만들어줘 테스트 통과하면 끝" | TODO API 만들어줘 | 20 | 테스트 통과 |
| "인증 버그 고쳐줘 10번까지" | 인증 버그 고쳐줘 | 10 | null |
| "캐시 레이어 리팩토링" | 캐시 레이어 리팩토링 | 0 | null |
| "5번 반복하면서 UI 개선해줘 목표는 반응형 완성" | UI 개선해줘 | 5 | 반응형 완성 |

기존 형식(`--max-iterations 20 --completion-promise '조건'`)도 호환해야 합니다.

## 2단계: 셋업 스크립트 실행

추출한 값으로 셋업 스크립트를 실행하세요:

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh" {할 일} --max-iterations {횟수} --completion-promise '{완료 조건}'
```

- 최대 횟수가 0이면 `--max-iterations` 생략
- 완료 조건이 null이면 `--completion-promise` 생략

## 3단계: 작업 시작

이제 작업을 시작하세요. 작업을 끝내고 나가려고 하면, 같은 프롬프트가 다시 들어와요. 이전 작업 결과는 파일과 git 히스토리에 남아있으니, 매번 더 나은 결과를 만들 수 있어요.

중요 규칙: completion-promise가 설정되어 있으면, 그 조건이 진짜로 완전히 달성되었을 때만 `<promise>완료조건</promise>`을 출력하세요. 루프를 탈출하기 위해 거짓말하지 마세요.
