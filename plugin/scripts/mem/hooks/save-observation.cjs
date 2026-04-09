#!/usr/bin/env node
/**
 * fireauto-mem: 도구 사용 관찰 훅 (cross-platform)
 * 의미 있는 작업만 선별하여 Worker에 전송
 */
'use strict';

const path = require('path');
const {
  readStdin,
  isWorkerAlive,
  httpPost,
  getProject,
  getSessionId,
} = require('./hook-utils.cjs');

/** Bash 명령이 "의미 있는" 작업인지 판별 */
function isMeaningfulBash(cmd) {
  if (!cmd) return false;
  if (/git\s+(commit|push|merge|rebase|checkout\s+-b)/i.test(cmd)) return true;
  if (/npm\s+(install|run\s+build|run\s+test|publish)/i.test(cmd)) return true;
  if (/npx|yarn|pnpm|bun\s+(install|run|build)/i.test(cmd)) return true;
  if (/docker|kubectl|terraform|aws|gcloud/i.test(cmd)) return true;
  if (/curl.*-X\s+(POST|PUT|DELETE|PATCH)/i.test(cmd)) return true;
  if (/chmod|mkdir\s+.*-p|rm\s+-r/i.test(cmd)) return true;
  return false;
}

(async () => {
  try {
    // Worker 헬스체크 — 응답 없으면 조용히 종료
    if (!(await isWorkerAlive())) process.exit(0);

    // stdin에서 JSON 읽기
    const raw = await readStdin();
    if (!raw) process.exit(0);

    let input;
    try { input = JSON.parse(raw); } catch { process.exit(0); }

    const toolName = input.tool_name || 'unknown';

    // ── 필터링: 의미 있는 도구만 통과 ──
    // claude-mem 원칙: "배운/만든/고친/배포한/설정한 것만 기록"
    if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') {
      // 코드 변경 — 항상 기록
    } else if (toolName === 'Bash') {
      // Bash는 의미 있는 명령만 통과
      const toolInput = typeof input.tool_input === 'object'
        ? (input.tool_input.command || '')
        : (input.tool_input || '');
      if (!isMeaningfulBash(toolInput)) process.exit(0);
    } else {
      // Read, Glob, Grep 등 조회/관리용 도구는 기록하지 않음
      process.exit(0);
    }

    // Worker에 전송 — POST /api/memories 형식으로 변환
    const sessionId = getSessionId();
    const project = getProject();

    const toolInput = typeof input.tool_input === 'object'
      ? JSON.stringify(input.tool_input)
      : (input.tool_input || '');
    const toolOutput = typeof input.tool_output === 'object'
      ? JSON.stringify(input.tool_output)
      : (input.tool_output || '');
    const filePath = (input.tool_input && input.tool_input.file_path)
      || (input.tool_input && input.tool_input.command)
      || '';

    const payload = {
      session_id: sessionId,
      project,
      type: 'pattern',
      title: toolName + ': ' + (filePath ? path.basename(filePath) : '').slice(0, 80),
      content: toolName + ' on ' + filePath
        + '\n\nInput: ' + toolInput.slice(0, 500)
        + '\nOutput: ' + toolOutput.slice(0, 500),
      tags: [toolName],
      files_involved: filePath ? [filePath] : [],
    };

    await httpPost('/api/memories', payload);
  } catch {
    // 훅은 Claude Code를 차단하면 안 됨 — 조용히 종료
  }
})();
