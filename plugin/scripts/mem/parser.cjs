/**
 * XML Parser Module
 * fireauto 메모리 시스템용 XML 파서
 *
 * SDK 응답에서 observation/summary XML 블록을 파싱합니다.
 * malformed XML에도 크래시 없이 동작하도록 설계되었습니다.
 */

'use strict';

// ── Constants ─────────────────────────────────────────────

/** @type {string[]} */
const VALID_TYPES = ['bugfix', 'feature', 'pattern', 'decision', 'gotcha', 'refactor'];

// ── parseObservations ─────────────────────────────────────

/**
 * SDK 응답에서 observation XML 블록들을 파싱합니다.
 * @param {string} text - SDK 응답 텍스트
 * @returns {Array<{type: string, title: string|null, subtitle: string|null, facts: string[], narrative: string|null, concepts: string[], files_modified: string[]}>}
 */
function parseObservations(text) {
  if (!text || typeof text !== 'string') return [];

  const observations = [];
  const regex = /<observation>([\s\S]*?)<\/observation>/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const content = match[1];

    const rawType = extractField(content, 'type');
    const type = rawType && VALID_TYPES.includes(rawType.trim())
      ? rawType.trim()
      : 'decision';

    observations.push({
      type,
      title: extractField(content, 'title'),
      subtitle: extractField(content, 'subtitle'),
      facts: extractArray(content, 'facts', 'fact'),
      narrative: extractField(content, 'narrative'),
      concepts: extractArray(content, 'concepts', 'concept'),
      files_modified: extractArray(content, 'files_modified', 'file'),
    });
  }

  // skip 체크: observation이 없고 skip 태그가 있으면 빈 배열 반환
  if (observations.length === 0) {
    const skipRegex = /<skip\s+reason="([^"]+)"\s*\/>/;
    const skipMatch = skipRegex.exec(text);
    if (skipMatch) {
      return [];
    }
  }

  return observations;
}

// ── parseSummary ──────────────────────────────────────────

/**
 * SDK 응답에서 summary XML 블록을 파싱합니다.
 * @param {string} text - SDK 응답 텍스트
 * @returns {{request: string|null, investigated: string|null, learned: string|null, completed: string|null, next_steps: string|null}|null}
 */
function parseSummary(text) {
  if (!text || typeof text !== 'string') return null;

  // skip_summary 체크
  const skipRegex = /<skip_summary\s+reason="([^"]+)"\s*\/>/;
  if (skipRegex.test(text)) return null;

  // summary 블록 매칭
  const summaryRegex = /<summary>([\s\S]*?)<\/summary>/;
  const summaryMatch = summaryRegex.exec(text);
  if (!summaryMatch) return null;

  const content = summaryMatch[1];

  return {
    request: extractField(content, 'request'),
    investigated: extractField(content, 'investigated'),
    learned: extractField(content, 'learned'),
    completed: extractField(content, 'completed'),
    next_steps: extractField(content, 'next_steps'),
  };
}

// ── extractField ──────────────────────────────────────────

/**
 * XML 콘텐츠에서 단일 필드 값을 추출합니다.
 * @param {string} content - XML 콘텐츠
 * @param {string} fieldName - 필드 태그 이름
 * @returns {string|null} 값 또는 null
 */
function extractField(content, fieldName) {
  try {
    const regex = new RegExp('<' + fieldName + '>([\\s\\S]*?)</' + fieldName + '>');
    const match = regex.exec(content);
    if (!match) return null;

    const trimmed = match[1].trim();
    return trimmed === '' ? null : trimmed;
  } catch {
    return null;
  }
}

// ── extractArray ──────────────────────────────────────────

/**
 * XML 콘텐츠에서 배열 요소들을 추출합니다.
 * @param {string} content - XML 콘텐츠
 * @param {string} arrayName - 배열 태그 이름 (e.g. 'facts')
 * @param {string} itemName - 개별 요소 태그 이름 (e.g. 'fact')
 * @returns {string[]}
 */
function extractArray(content, arrayName, itemName) {
  try {
    // 배열 블록 매칭
    const arrayRegex = new RegExp('<' + arrayName + '>([\\s\\S]*?)</' + arrayName + '>');
    const arrayMatch = arrayRegex.exec(content);
    if (!arrayMatch) return [];

    const arrayContent = arrayMatch[1];

    // 개별 요소 추출
    const itemRegex = new RegExp('<' + itemName + '>([\\s\\S]*?)</' + itemName + '>', 'g');
    const items = [];
    let itemMatch;
    while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
      const trimmed = itemMatch[1].trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }

    return items;
  } catch {
    return [];
  }
}

// ── Exports ───────────────────────────────────────────────

module.exports = {
  VALID_TYPES,
  parseObservations,
  parseSummary,
  extractField,
  extractArray,
};
