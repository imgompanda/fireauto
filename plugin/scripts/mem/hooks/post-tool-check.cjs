#!/usr/bin/env node
/**
 * fireauto-mem: 도구 사용 후 패턴 감지 + CLAUDE.md 관리
 * Cross-platform Node.js 버전 (post-tool-check.sh 대체)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { isWorkerAlive, getPluginRoot, log } = require('./hook-utils.cjs');

(async () => {
  try {
    // Worker가 안 돌면 종료
    const alive = await isWorkerAlive();
    if (!alive) process.exit(0);

    const pluginRoot = getPluginRoot();

    // ── CLAUDE.md 80줄 체크 (프로젝트 로컬 + 글로벌 둘 다) ──
    const claudeMdPaths = [
      path.join(process.cwd(), '.claude', 'CLAUDE.md'),
      path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    ];

    for (const claudeMd of claudeMdPaths) {
      try {
        if (!fs.existsSync(claudeMd)) continue;

        const content = fs.readFileSync(claudeMd, 'utf8');
        const lineCount = content.split('\n').length;

        if (lineCount > 80) {
          try {
            const gen = require(path.join(pluginRoot, 'scripts', 'mem', 'claude-md-generator.cjs'));
            const targetDir = path.dirname(claudeMd);
            gen.trimClaudeMd(path.join(targetDir, '..'), 80);
            log(`[fireauto] ${claudeMd} ${lineCount}줄 → 80줄 트리밍`);
          } catch (e) {
            log(`[fireauto] trim 실패: ${e.message}`);
          }
        }
      } catch {
        // 개별 파일 오류 무시
      }
    }

    // ── 반복 패턴 감지 (3번째 도구 사용마다 체크) ──
    const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
    const counterFile = path.join(os.tmpdir(), `fireauto-tool-counter-${sessionId}`);

    let count = 0;
    try {
      if (fs.existsSync(counterFile)) {
        count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
      }
    } catch {
      count = 0;
    }

    count += 1;

    try {
      fs.writeFileSync(counterFile, String(count), 'utf8');
    } catch {
      // 카운터 저장 실패 무시
    }

    if (count % 3 === 0) {
      try {
        const sl = require(path.join(pluginRoot, 'scripts', 'mem', 'self-learner.cjs'));
        const { initDb } = require(path.join(pluginRoot, 'scripts', 'mem', 'db.cjs'));
        const dbPath = process.env.DB_PATH || path.join(os.homedir(), '.fireauto-mem', 'fireauto-mem.db');
        const db = await initDb(dbPath);
        const project = path.basename(process.cwd());
        const candidates = sl.detectRepetitivePatterns(db, project);
        if (candidates && candidates.length > 0) {
          log(`[fireauto] 반복 패턴 ${candidates.length}건 감지 — 스킬 생성 후보`);
        }
      } catch {
        // 패턴 감지 실패 무시
      }
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
})();
