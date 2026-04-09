#!/usr/bin/env node
/**
 * fireauto-mem: 세션 종료 요약 훅 (cross-platform)
 * 세션 종료 시 요약 정보를 Worker에 전송
 */
'use strict';

const {
  isWorkerAlive,
  httpPost,
  getProject,
  getSessionId,
  log,
} = require('./hook-utils.cjs');

(async () => {
  try {
    // Worker가 응답하지 않으면 조용히 종료
    if (!(await isWorkerAlive())) process.exit(0);

    const sessionId = getSessionId();
    const project = getProject();

    // 세션 요약 전송
    await httpPost('/api/sessions/summarize', {
      session_id: sessionId,
      project,
      request: '',
      what_done: '',
      what_learned: '',
      next_steps: '',
    });

    log('[fireauto-mem] 세션 요약 저장됨');

    // 복기 실행
    await httpPost('/api/retrospect', {
      project,
      session_id: sessionId,
    });

    log('[fireauto-mem] 세션 복기 완료');
  } catch {
    // 훅은 Claude Code를 차단하면 안 됨 — 조용히 종료
  }
})();
