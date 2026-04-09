#!/usr/bin/env node
/**
 * fireauto-mem: 세션 시작 훅 (cross-platform)
 * Worker 서버가 실행 중이 아니면 시작하고, 세션 초기화
 */
'use strict';

const fs = require('fs');
const {
  PID_FILE,
  isWorkerAlive,
  isProcessAlive,
  killProcess,
  startWorker,
  httpPost,
  getProject,
  getSessionId,
  log,
  sleep,
} = require('./hook-utils.cjs');

(async () => {
  try {
    let workerAlive = false;

    // 1) PID 파일로 빠른 확인
    if (fs.existsSync(PID_FILE)) {
      const storedPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (storedPid && isProcessAlive(storedPid)) {
        if (await isWorkerAlive()) {
          log(`[fireauto-mem] Worker 재사용 (PID ${storedPid})`);
          workerAlive = true;
        }
      }
    }

    // 2) PID 파일 없거나 stale → health 체크 fallback
    if (!workerAlive && await isWorkerAlive()) {
      log('[fireauto-mem] Worker 이미 실행 중 — 재사용');
      workerAlive = true;
    }

    // 3) Worker가 없으면 시작
    if (!workerAlive) {
      log('[fireauto-mem] Worker 시작 중...');

      // stale PID 파일 정리
      if (fs.existsSync(PID_FILE)) {
        const stalePid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
        if (stalePid) {
          log(`[fireauto-mem] 좀비 Worker(PID ${stalePid}) 정리`);
          killProcess(stalePid);
          await sleep(1000);
        }
      }

      await startWorker();
    }

    // 세션 초기화
    const sessionId = getSessionId();
    const project = getProject();

    await httpPost('/api/sessions/init', {
      session_id: sessionId,
      project,
    });

    log(`[fireauto-mem] 세션 초기화 완료: ${project}`);
  } catch {
    // 훅은 Claude Code를 차단하면 안 됨 — 조용히 종료
  }
})();
