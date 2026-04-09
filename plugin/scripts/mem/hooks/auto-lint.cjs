#!/usr/bin/env node
/**
 * fireauto: 자동 린트 — 성공은 조용히, 실패만 시끄럽게 (cross-platform)
 *
 * NOTE: execSync is used intentionally here for lint checks on local files.
 * All file paths come from Claude's tool_input (not user-supplied strings),
 * and the commands are hardcoded (node -c, bash -n, python3 -m py_compile).
 * This is safe — equivalent to the original auto-lint.sh.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readStdin, log } = require('./hook-utils.cjs');

/**
 * 주어진 커맨드가 PATH에 존재하는지 확인 (cross-platform)
 * @param {string} cmd
 * @returns {boolean}
 */
function commandExists(cmd) {
  try {
    const check = process.platform === 'win32' ? 'where' : 'command';
    const args = process.platform === 'win32' ? [cmd] : ['-v', cmd];
    execFileSync(check, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 파일 확장자에 따른 린트 실행
 * @param {string} filePath
 * @returns {string} 에러 메시지 (없으면 빈 문자열)
 */
function lintFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();

  try {
    switch (ext) {
      case 'js':
      case 'cjs':
      case 'mjs':
      case 'jsx': {
        // Node.js 문법 체크 — process.execPath로 현재 node 바이너리 사용
        execFileSync(process.execPath, ['-c', filePath], { stdio: 'pipe' });
        return '';
      }
      case 'ts':
      case 'tsx': {
        // TypeScript — npx tsc가 있으면 실행
        if (commandExists('npx')) {
          execFileSync('npx', ['tsc', '--noEmit', filePath], {
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 30000,
          });
        }
        return '';
      }
      case 'py': {
        // Python 문법 체크
        if (commandExists('python3')) {
          execFileSync('python3', ['-m', 'py_compile', filePath], { stdio: 'pipe' });
        }
        return '';
      }
      case 'sh':
      case 'bash': {
        if (commandExists('bash')) {
          execFileSync('bash', ['-n', filePath], { stdio: 'pipe' });
        }
        return '';
      }
      case 'json': {
        // JSON 파싱 — Node.js 내장으로 체크 (외부 프로세스 불필요)
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return '';
      }
      default:
        return '';
    }
  } catch (err) {
    // execFileSync 실패 시 stderr 또는 에러 메시지 반환
    const output = (err.stderr && err.stderr.toString())
      || (err.stdout && err.stdout.toString())
      || err.message
      || '';
    return output;
  }
}

(async () => {
  try {
    // stdin에서 JSON 읽기
    const raw = await readStdin();
    if (!raw) process.exit(0);

    let input;
    try { input = JSON.parse(raw); } catch { process.exit(0); }

    const toolName = input.tool_name || '';

    // Edit/Write만 체크
    if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

    // 수정된 파일 경로 추출
    const toolInput = typeof input.tool_input === 'object'
      ? input.tool_input
      : (() => { try { return JSON.parse(input.tool_input || '{}'); } catch { return {}; } })();

    const filePath = toolInput.file_path || '';
    if (!filePath) process.exit(0);
    if (!fs.existsSync(filePath)) process.exit(0);

    // 린트 실행
    const errors = lintFile(filePath);

    // 성공은 조용히 — 에러만 시끄럽게
    if (errors && /error|SyntaxError|unexpected|bad control|unterminated|invalid/i.test(errors)) {
      // 에러 출력을 최대 5줄로 제한
      const lines = errors.split('\n').filter(Boolean).slice(0, 5).join('\n');
      log(`[fireauto-lint] ⚠️ ${filePath} 에러 발견:`);
      log(lines);
      log('[fireauto-lint] 위 에러를 수정해주세요.');
    }
  } catch {
    // 훅은 Claude Code를 차단하면 안 됨 — 조용히 종료
  }
})();
