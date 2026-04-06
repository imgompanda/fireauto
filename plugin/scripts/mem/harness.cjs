'use strict';

/**
 * fireauto-mem Session Harness
 *
 * 세션 시작 시 프로젝트 컨텍스트를 자동 생성하여 Claude에게 주입합니다.
 * SessionStart 훅에서 호출되며, 활성 프로젝트 상태를 마크다운으로 반환합니다.
 *
 * @module harness
 */

const { getProjectName } = require('./types.cjs');

// ── Status emoji map ────────────────────────────────────────

const STATUS_ICON = {
  pending: '[ ]',
  in_progress: '[~]',
  blocked: '[!]',
  completed: '[x]',
  active: '[~]',
};

/**
 * 활성 프로젝트의 현재 상태를 마크다운으로 생성
 * @param {import('sql.js').Database} db - sql.js DB 인스턴스
 * @param {Object} [options]
 * @param {number} [options.projectId] - 특정 프로젝트 ID (생략시 최근 활성 프로젝트)
 * @param {number} [options.memoryLimit=5] - 관련 메모리 표시 개수
 * @returns {string} 마크다운 형식의 세션 컨텍스트
 */
function generateSessionContext(db, options = {}) {
  const dbMod = require('./db.cjs');
  const { memoryLimit = 5 } = options;

  // 1. 활성 프로젝트 조회
  const project = getActiveProject(db, dbMod, options.projectId);
  if (!project) {
    return `## 세션 컨텍스트

활성 프로젝트가 없습니다. \`project-status\` 도구로 프로젝트를 확인하세요.
`;
  }

  // 2. 마일스톤 목록 조회
  const milestones = safeCall(() =>
    dbMod.listMilestones(db, { projectId: project.id }),
  ) || [];

  // 3. 진행률 계산
  const progress = safeCall(() =>
    dbMod.getProjectProgress(db, project.id),
  ) || { percentage: 0, completed: 0, total: 0 };

  // 4. 현재 활성 마일스톤 찾기
  const activeMilestone = milestones.find(m => m.status === 'active' || m.status === 'in_progress')
    || milestones.find(m => m.status === 'pending')
    || milestones[0];

  // 5. 현재 마일스톤의 태스크 목록
  let tasks = [];
  if (activeMilestone) {
    tasks = safeCall(() =>
      dbMod.listTasks(db, { milestoneId: activeMilestone.id }),
    ) || [];
  }

  // 6. 다음 태스크 (pending 또는 in_progress 중 첫번째)
  const nextTask = tasks.find(t => t.status === 'in_progress')
    || tasks.find(t => t.status === 'pending');

  // 7. 최근 메모리 (프로젝트 관련)
  const recentMemories = getRecentMemories(db, dbMod, project.name, memoryLimit);

  // 8. 마크다운 생성
  return formatContext({
    project,
    progress,
    milestones,
    activeMilestone,
    tasks,
    nextTask,
    recentMemories,
  });
}

/**
 * 활성 프로젝트를 찾는다
 * @param {import('sql.js').Database} db
 * @param {Object} dbMod - db.cjs 모듈
 * @param {number} [projectId] - 특정 프로젝트 ID
 * @returns {Object|null}
 */
function getActiveProject(db, dbMod, projectId) {
  if (projectId) {
    return safeCall(() => dbMod.getProject(db, projectId));
  }
  // 활성 프로젝트 중 최근 것
  const projects = safeCall(() => dbMod.listProjects(db, { status: 'active', limit: 1 }));
  if (projects && projects.length > 0) {
    return projects[0];
  }
  // 활성이 없으면 아무거나
  const all = safeCall(() => dbMod.listProjects(db, { limit: 1 }));
  return (all && all.length > 0) ? all[0] : null;
}

/**
 * 최근 메모리 조회 (프로젝트 기준)
 * @param {import('sql.js').Database} db
 * @param {Object} dbMod
 * @param {string} projectName
 * @param {number} limit
 * @returns {Object[]}
 */
function getRecentMemories(db, dbMod, projectName, limit) {
  const project = projectName || getProjectName();
  return safeCall(() =>
    dbMod.listMemories(db, { project, limit }),
  ) || [];
}

/**
 * 컨텍스트 데이터를 마크다운으로 포맷팅
 * @param {Object} data
 * @returns {string}
 */
function formatContext({ project, progress, milestones, activeMilestone, tasks, nextTask, recentMemories }) {
  const lines = [];

  lines.push(`## 현재 프로젝트 상태 (자동 생성)`);
  lines.push('');
  lines.push(`프로젝트: ${project.name}${project.description ? ' — ' + project.description : ''}`);

  // 진행률
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  lines.push(`진행률: ${progress.percentage}% (마일스톤 ${completedMilestones}/${milestones.length} 완료)`);
  lines.push('');

  // 현재 마일스톤
  if (activeMilestone) {
    lines.push(`### 현재 마일스톤: ${activeMilestone.title}`);
    if (tasks.length > 0) {
      for (const t of tasks) {
        const icon = STATUS_ICON[t.status] || '[ ]';
        lines.push(`- ${icon} ${t.title}`);
      }
    } else {
      lines.push('- (태스크 없음)');
    }
    lines.push('');
  }

  // 다음 태스크
  if (nextTask) {
    lines.push(`### 다음 태스크`);
    lines.push(`${nextTask.title}${nextTask.description ? ': ' + nextTask.description : ''}`);
    lines.push('');
  }

  // 최근 지식
  if (recentMemories.length > 0) {
    lines.push(`### 최근 지식`);
    for (const m of recentMemories) {
      lines.push(`- ${m.title} (${m.type})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 안전한 DB 호출 래퍼
 * @param {Function} fn
 * @returns {*} 결과 또는 null
 */
function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

module.exports = { generateSessionContext };
