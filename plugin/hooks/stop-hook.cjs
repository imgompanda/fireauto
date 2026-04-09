#!/usr/bin/env node
/**
 * fireauto loop Stop Hook
 * 루프가 활성화되어 있으면 세션 종료를 막고 같은 프롬프트를 다시 전달
 * Cross-platform Node.js 버전 (stop-hook.sh 대체)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.claude', 'fireauto-loop.local.md');

/**
 * YAML-like frontmatter 파싱 (--- 구분자 사이의 key: value 쌍)
 * @param {string} content - 파일 전체 내용
 * @returns {{ frontmatter: Record<string, string>, body: string }}
 */
function parseFrontmatter(content) {
  const parts = content.split('---');
  // parts[0] = 빈 문자열 (--- 앞), parts[1] = frontmatter, parts[2...] = body
  const frontmatter = {};
  if (parts.length < 3) return { frontmatter, body: content };

  const fmBlock = parts[1];
  for (const line of fmBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // 따옴표 제거
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  // body = --- 두 번째 이후 모든 내용
  const body = parts.slice(2).join('---');
  return { frontmatter, body };
}

/**
 * 상태 파일 삭제
 */
function deleteStateFile() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // 이미 없거나 권한 없음
  }
}

/**
 * stdin 전체 읽기
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(data), 2000);
  });
}

(async () => {
  try {
    // stdin에서 hook input 읽기
    const hookRaw = await readStdin();
    let hookInput = {};
    try {
      hookInput = JSON.parse(hookRaw);
    } catch {
      // JSON 파싱 실패 시 빈 객체
    }

    // 상태 파일 확인
    if (!fs.existsSync(STATE_FILE)) {
      process.exit(0);
    }

    const stateContent = fs.readFileSync(STATE_FILE, 'utf8');
    const { frontmatter, body } = parseFrontmatter(stateContent);

    const iteration = frontmatter.iteration;
    const maxIterations = frontmatter.max_iterations;
    const completionPromise = frontmatter.completion_promise || '';
    const stateSession = frontmatter.session_id || '';

    // 세션 격리
    const hookSession = hookInput.session_id || '';
    if (stateSession && stateSession !== hookSession) {
      process.exit(0);
    }

    // 숫자 검증
    if (!/^\d+$/.test(iteration)) {
      process.stderr.write('fireauto loop: 상태 파일이 손상됐어요. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    if (!/^\d+$/.test(maxIterations)) {
      process.stderr.write('fireauto loop: 상태 파일이 손상됐어요. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    const iterNum = parseInt(iteration, 10);
    const maxNum = parseInt(maxIterations, 10);

    // 최대 반복 횟수 도달
    if (maxNum > 0 && iterNum >= maxNum) {
      process.stdout.write(`fireauto loop: 최대 반복 횟수(${maxNum})에 도달했어요.\n`);
      deleteStateFile();
      process.exit(0);
    }

    // 트랜스크립트에서 마지막 어시스턴트 메시지 추출
    const transcriptPath = hookInput.transcript_path || '';

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      process.stderr.write('fireauto loop: 트랜스크립트를 찾을 수 없어요. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');
    const transcriptLines = transcriptContent.split('\n');
    const assistantLines = transcriptLines.filter((line) => line.includes('"role":"assistant"'));

    if (assistantLines.length === 0) {
      process.stderr.write('fireauto loop: 어시스턴트 메시지를 찾을 수 없어요. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    // 마지막 100줄만 사용
    const lastLines = assistantLines.slice(-100);

    // 마지막 어시스턴트 메시지에서 텍스트 추출
    let lastOutput = '';
    try {
      // 각 줄을 JSON 파싱하여 텍스트 수집, 마지막 것 사용
      for (const line of lastLines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message && Array.isArray(parsed.message.content)) {
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) {
                lastOutput = block.text;
              }
            }
          }
        } catch {
          // 개별 줄 파싱 실패 무시
        }
      }
    } catch {
      process.stderr.write('fireauto loop: JSON 파싱 실패. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    // 완료 조건 확인
    if (completionPromise && completionPromise !== 'null') {
      const promiseMatch = lastOutput.match(/<promise>([\s\S]*?)<\/promise>/);
      const promiseText = promiseMatch ? promiseMatch[1].trim().replace(/\s+/g, ' ') : '';

      if (promiseText && promiseText === completionPromise) {
        process.stdout.write(`fireauto loop: 완료 조건 달성! <promise>${completionPromise}</promise>\n`);
        deleteStateFile();
        process.exit(0);
      }
    }

    // 다음 반복으로 진행
    const nextIteration = iterNum + 1;

    // body에서 프롬프트 추출 (frontmatter 이후의 내용)
    // body는 두 번째 --- 이후의 모든 텍스트 (첫 줄이 빈 줄일 수 있으므로 trim)
    const promptText = body.replace(/^\n/, '');

    if (!promptText.trim()) {
      process.stderr.write('fireauto loop: 프롬프트를 찾을 수 없어요. 루프를 중단할게요.\n');
      deleteStateFile();
      process.exit(0);
    }

    // 상태 파일 업데이트 (iteration 값만 변경)
    const updatedContent = stateContent.replace(
      /^iteration:\s*.*/m,
      `iteration: ${nextIteration}`
    );
    fs.writeFileSync(STATE_FILE, updatedContent, 'utf8');

    // 시스템 메시지 구성
    let systemMsg;
    if (completionPromise && completionPromise !== 'null') {
      systemMsg = `fireauto loop ${nextIteration}번째 반복 | 완료하려면: <promise>${completionPromise}</promise> (진짜 완료됐을 때만!)`;
    } else {
      systemMsg = `fireauto loop ${nextIteration}번째 반복 | 완료 조건 없음 - 무한 반복 중`;
    }

    // JSON 결과를 stdout으로 출력 (이것이 Claude Code에 전달됨)
    const result = {
      decision: 'block',
      reason: promptText,
      systemMessage: systemMsg,
    };

    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  } catch {
    process.exit(0);
  }
})();
