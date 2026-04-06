'use strict';

/**
 * fireauto-mem Auto-Suggest
 *
 * 현재 상황에 맞는 제안을 자동 생성합니다.
 * 태스크 완료, 마일스톤 완료, 장시간 태스크, 배포 전 점검 등
 * 컨텍스트에 따라 적절한 제안 메시지를 반환합니다.
 *
 * @module auto-suggest
 */

// ── 장시간 태스크 임계값 (ms) ────────────────────────────────
const LONG_TASK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2시간

/**
 * 현재 상황에 맞는 제안 생성
 * @param {import('sql.js').Database} db - sql.js DB 인스턴스
 * @param {Object} context - 현재 상황 정보
 * @param {string} [context.action] - 방금 수행된 액션 ('task_completed', 'task_started', 'milestone_completed', 'deploy', 'session_start')
 * @param {number} [context.taskId] - 관련 태스크 ID
 * @param {number} [context.projectId] - 관련 프로젝트 ID
 * @param {string} [context.toolName] - 호출된 도구명
 * @returns {string|null} 제안 메시지 또는 null
 */
function getSuggestion(db, context = {}) {
  const dbMod = safeRequire('./db.cjs');
  if (!dbMod) return null;

  const { action, taskId, projectId, toolName } = context;

  // 제안 체인: 첫 번째 매칭되는 제안 반환
  const strategies = [
    () => suggestOnTaskCompleted(db, dbMod, action, taskId, projectId),
    () => suggestOnMilestoneCompleted(db, dbMod, action, projectId),
    () => suggestOnLongTask(db, dbMod, action, taskId),
    () => suggestOnDeploy(db, dbMod, action, projectId),
    () => suggestRelatedMemory(db, dbMod, action, taskId, toolName),
  ];

  for (const strategy of strategies) {
    const suggestion = safeCall(strategy);
    if (suggestion) return suggestion;
  }

  return null;
}

/**
 * 태스크 완료 시 다음 태스크 제안
 * @returns {string|null}
 */
function suggestOnTaskCompleted(db, dbMod, action, taskId, projectId) {
  if (action !== 'task_completed') return null;

  // 같은 마일스톤의 다음 태스크 찾기
  let nextTask = null;
  if (taskId) {
    const completedTask = safeCall(() => dbMod.getTask(db, taskId));
    if (completedTask && completedTask.milestone_id) {
      const tasks = safeCall(() =>
        dbMod.listTasks(db, { milestone_id: completedTask.milestone_id }),
      ) || [];

      nextTask = tasks.find(t => t.status === 'pending');
    }
  }

  // 마일스톤 내 다음 태스크가 없으면 프로젝트 전체에서 찾기
  if (!nextTask && projectId) {
    const tasks = safeCall(() =>
      dbMod.listTasks(db, { project_id: projectId }),
    ) || [];
    nextTask = tasks.find(t => t.status === 'pending');
  }

  if (!nextTask) return null;

  // 관련 gotcha 메모리 검색
  const gotcha = findRelatedGotcha(db, dbMod, nextTask.title);
  const gotchaNote = gotcha ? ` 관련 주의사항: ${gotcha.title}` : '';

  return `다음: ${nextTask.title}.${gotchaNote}`;
}

/**
 * 마일스톤 완료 시 다음 마일스톤 제안
 * @returns {string|null}
 */
function suggestOnMilestoneCompleted(db, dbMod, action, projectId) {
  if (action !== 'milestone_completed') return null;
  if (!projectId) return null;

  const milestones = safeCall(() =>
    dbMod.listMilestones(db, projectId),
  ) || [];

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const nextMilestone = milestones.find(m => m.status === 'pending' || m.status === 'active');

  if (nextMilestone) {
    return `M${completedCount} 완료! 다음 마일스톤: ${nextMilestone.title}`;
  }

  // 모든 마일스톤 완료
  if (completedCount === milestones.length && milestones.length > 0) {
    return `모든 마일스톤 완료! 프로젝트를 마무리할 준비가 되었어요.`;
  }

  return null;
}

/**
 * 장시간 진행 중인 태스크 감지
 * @returns {string|null}
 */
function suggestOnLongTask(db, dbMod, action, taskId) {
  if (action !== 'task_started' && action !== 'session_start') return null;

  // in_progress 태스크 중 오래된 것 찾기
  const tasks = safeCall(() =>
    dbMod.listTasks(db, { status: 'in_progress' }),
  ) || [];

  const now = Date.now();
  const longRunning = tasks.filter(t => {
    const started = t.updated_at_epoch || t.created_at_epoch || 0;
    return (now - started) > LONG_TASK_THRESHOLD_MS;
  });

  if (longRunning.length === 0) return null;

  const task = longRunning[0];
  const hours = Math.floor((now - (task.updated_at_epoch || task.created_at_epoch)) / (60 * 60 * 1000));

  return `"${task.title}" 태스크가 ${hours}시간째 진행 중이에요. 하위 태스크로 분할할까요?`;
}

/**
 * 배포 전 점검 제안
 * @returns {string|null}
 */
function suggestOnDeploy(db, dbMod, action, projectId) {
  if (action !== 'deploy') return null;

  // 미완료 태스크 확인
  let pendingCount = 0;
  if (projectId) {
    const tasks = safeCall(() =>
      dbMod.listTasks(db, { project_id: projectId }),
    ) || [];
    pendingCount = tasks.filter(t => t.status !== 'completed').length;
  }

  const warnings = [];
  if (pendingCount > 0) {
    warnings.push(`미완료 태스크 ${pendingCount}건`);
  }
  warnings.push('SEO 점검');
  warnings.push('보안 점검');

  return `배포 전 확인: ${warnings.join(', ')} 먼저 할까요?`;
}

/**
 * 관련 메모리 제안 (gotcha, bugfix 등)
 * @returns {string|null}
 */
function suggestRelatedMemory(db, dbMod, action, taskId, toolName) {
  if (!taskId && !toolName) return null;

  let searchQuery = toolName || '';
  if (taskId) {
    const task = safeCall(() => dbMod.getTask(db, taskId));
    if (task) searchQuery = task.title;
  }

  if (!searchQuery) return null;

  // gotcha 또는 bugfix 메모리 검색
  const memories = safeCall(() =>
    dbMod.searchMemories(db, { query: searchQuery, limit: 3 }),
  ) || [];

  const relevant = memories.filter(m =>
    m.type === 'gotcha' || m.type === 'bugfix' || m.type === 'pattern',
  );

  if (relevant.length === 0) return null;

  return `참고: 비슷한 이슈 해결 기록이 있어요 — "${relevant[0].title}"`;
}

/**
 * gotcha 타입 메모리 검색 헬퍼
 * @param {import('sql.js').Database} db
 * @param {Object} dbMod
 * @param {string} query
 * @returns {Object|null}
 */
function findRelatedGotcha(db, dbMod, query) {
  const memories = safeCall(() =>
    dbMod.searchMemories(db, { query, type: 'gotcha', limit: 1 }),
  ) || [];
  return memories.length > 0 ? memories[0] : null;
}

/**
 * 안전한 require
 * @param {string} mod
 * @returns {Object|null}
 */
function safeRequire(mod) {
  try {
    return require(mod);
  } catch {
    return null;
  }
}

/**
 * 안전한 함수 호출 래퍼
 * @param {Function} fn
 * @returns {*}
 */
function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

module.exports = { getSuggestion };
