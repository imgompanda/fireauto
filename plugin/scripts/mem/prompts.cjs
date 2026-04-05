/**
 * Prompts Module
 * fireauto 메모리 시스템용 프롬프트 빌더
 *
 * Claude Agent SDK 워커에게 전달할 프롬프트를 생성합니다.
 */

'use strict';

// ── Init Prompt ───────────────────────────────────────────

/**
 * 세션 초기화 프롬프트를 생성합니다.
 * @param {string} project - 프로젝트 이름
 * @param {string} sessionId - 세션 ID
 * @param {string} userPrompt - 사용자 요청 내용
 * @returns {string}
 */
function buildInitPrompt(project, sessionId, userPrompt) {
  return `당신은 fireauto 개발 작업 관찰자입니다.
사용자의 Claude Code 세션을 관찰하고, 의미 있는 지식을 구조화합니다.

프로젝트: ${project}
세션: ${sessionId}
사용자 요청: ${userPrompt}

관찰된 도구 사용에 대해 다음 XML로 응답하세요:

<observation>
  <type>[ bugfix | feature | pattern | decision | gotcha | refactor ]</type>
  <title>간결한 제목 (한국어)</title>
  <subtitle>한 줄 설명</subtitle>
  <facts>
    <fact>구체적 사실</fact>
  </facts>
  <narrative>맥락과 이유 설명</narrative>
  <concepts>
    <concept>관련 개념 카테고리</concept>
  </concepts>
  <files_modified>
    <file>파일 경로</file>
  </files_modified>
</observation>

중요하지 않은 작업은 <skip reason="이유"/> 로 건너뛰세요.
타입 설명:
- bugfix: 버그 수정
- feature: 새 기능 추가
- pattern: 패턴/모범 사례 발견
- decision: 설계 결정
- gotcha: 주의사항/함정 발견
- refactor: 코드 리팩토링`;
}

// ── Observation Prompt ────────────────────────────────────

/**
 * 도구 관찰 프롬프트를 생성합니다.
 * @param {string} toolName - 도구 이름
 * @param {string} toolInput - 도구 입력 (300자 제한)
 * @param {string} toolOutput - 도구 출력 (500자 제한)
 * @returns {string}
 */
function buildObservationPrompt(toolName, toolInput, toolOutput) {
  const truncatedInput = truncate(toolInput, 300);
  const truncatedOutput = truncate(toolOutput, 500);

  return `<observed_from_primary_session>
  <tool_name>${toolName}</tool_name>
  <parameters>${truncatedInput}</parameters>
  <outcome>${truncatedOutput}</outcome>
  <occurred_at>${new Date().toISOString()}</occurred_at>
</observed_from_primary_session>`;
}

// ── Summary Prompt ────────────────────────────────────────

/**
 * 세션 요약 프롬프트를 생성합니다.
 * @param {Array<{type: string, title: string}>} observations - 관찰 목록
 * @returns {string}
 */
function buildSummaryPrompt(observations) {
  const list = observations
    .map((o) => `- [${o.type}] ${o.title}`)
    .join('\n');

  return `--- 세션 요약 모드 ---
<observation> 태그 사용 금지. <summary> 태그만 사용하세요.

이 세션의 관찰 ${observations.length}건을 종합하여 요약하세요.

관찰 목록:
${list}

<summary>
  <request>사용자가 요청한 것</request>
  <investigated>조사/탐색한 것</investigated>
  <learned>배운 것, 발견한 것</learned>
  <completed>완료한 작업</completed>
  <next_steps>다음에 할 일</next_steps>
</summary>`;
}

// ── Compile Prompt ────────────────────────────────────────

/**
 * 메모리 컴파일 프롬프트를 생성합니다.
 * @param {Array<{id: number, type: string, title: string, narrative: string}>} memories - 메모리 목록
 * @param {string} project - 프로젝트 이름
 * @returns {string}
 */
function buildCompilePrompt(memories, project) {
  const memoryContent = memories
    .map((m) => `[#${m.id}] (${m.type}) ${m.title}\n${m.narrative || ''}`)
    .join('\n\n');

  return `프로젝트 "${project}"의 메모리 ${memories.length}건을 종합하여
구조화된 지식 문서로 컴파일하세요.

## 메모리 목록
${memoryContent}

## 출력 형식
마크다운으로 다음 구조로 작성:
# ${project} 지식 베이스
## 패턴 (pattern 타입)
## 주의사항 (gotcha 타입)
## 결정 사항 (decision 타입)
## 버그 수정 이력 (bugfix 타입)
## 기능 구현 이력 (feature 타입)

각 항목에 관련 메모리 ID를 [#ID]로 참조하세요.`;
}

// ── Continuation Prompt ───────────────────────────────────

/**
 * 세션 계속 프롬프트를 생성합니다.
 * @param {number} promptNumber - 프롬프트 순번
 * @returns {string}
 */
function buildContinuationPrompt(promptNumber) {
  return `메모리 처리를 계속합니다. (프롬프트 #${promptNumber})
이전 맥락을 유지하면서 새로운 관찰을 처리하세요.`;
}

// ── Helpers ───────────────────────────────────────────────

/**
 * 문자열을 지정 길이로 자릅니다.
 * @param {string} str - 원본 문자열
 * @param {number} maxLen - 최대 길이
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (typeof str !== 'string') {
    try {
      str = JSON.stringify(str);
    } catch {
      str = String(str);
    }
  }
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// ── Exports ───────────────────────────────────────────────

module.exports = {
  buildInitPrompt,
  buildObservationPrompt,
  buildSummaryPrompt,
  buildCompilePrompt,
  buildContinuationPrompt,
};
