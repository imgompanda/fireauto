/**
 * fireauto-mem Project Manager
 *
 * db.cjs의 프로젝트/마일스톤/태스크 CRUD를 래핑하는 고수준 매니저.
 * PRD 기반 프로젝트 생성, 대시보드, 다음 태스크 제안, 자동 완료 체크 등을 제공합니다.
 *
 * @module project-manager
 */

const db = require('./db.cjs');

/**
 * PRD에서 프로젝트를 생성하고 마일스톤/태스크를 일괄 등록
 * @param {import('sql.js').Database} database
 * @param {Object} params
 * @param {string} params.name - 프로젝트 이름
 * @param {string} [params.description] - 프로젝트 설명
 * @param {string} [params.prd_path] - PRD 파일 경로
 * @param {Array<{ title: string, description?: string, tasks: Array<{ title: string, description?: string, priority?: string }> }>} params.milestones
 * @returns {{ project_id: number, milestone_ids: number[], task_ids: number[] }}
 */
function createProjectFromPRD(database, { name, description, prd_path, milestones = [] }) {
  const projectId = db.createProject(database, { name, description, prd_path });

  const milestoneIds = [];
  const taskIds = [];

  for (let mi = 0; mi < milestones.length; mi++) {
    const m = milestones[mi];
    const milestoneId = db.createMilestone(database, {
      project_id: projectId,
      title: m.title,
      description: m.description,
      order_index: mi,
    });
    milestoneIds.push(milestoneId);

    const tasks = m.tasks || [];
    for (let ti = 0; ti < tasks.length; ti++) {
      const t = tasks[ti];
      const taskId = db.createTask(database, {
        milestone_id: milestoneId,
        project_id: projectId,
        title: t.title,
        description: t.description,
        priority: t.priority || 'P1',
        order_index: ti,
      });
      taskIds.push(taskId);
    }
  }

  return { project_id: projectId, milestone_ids: milestoneIds, task_ids: taskIds };
}

/**
 * 프로젝트 대시보드 조회 — 마일스톤별 태스크와 진행률 포함
 * @param {import('sql.js').Database} database
 * @param {number} projectId
 * @returns {{ project: Object, milestones: Array<Object>, overall_progress: Object }|null}
 */
function getProjectDashboard(database, projectId) {
  const project = db.getProject(database, projectId);
  if (!project) return null;

  const milestones = db.listMilestones(database, projectId);
  const milestonesWithTasks = milestones.map((m) => {
    const tasks = db.listTasks(database, { milestone_id: m.id });
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return {
      ...m,
      tasks,
      progress: {
        total,
        completed,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    };
  });

  const overall = db.getProjectProgress(database, projectId);

  return {
    project,
    milestones: milestonesWithTasks,
    overall_progress: overall,
  };
}

/**
 * 다음 태스크 제안 — 현재 진행 중인 마일스톤에서 pending인 첫 태스크 반환
 * @param {import('sql.js').Database} database
 * @param {number} projectId
 * @returns {{ task: Object, milestone: Object, related_memories: Object[] }|null}
 */
function getNextTask(database, projectId) {
  const milestones = db.listMilestones(database, projectId);

  // pending 또는 in_progress 마일스톤 중 order_index 순으로 탐색
  const activeMilestones = milestones.filter((m) => m.status !== 'completed');

  for (const milestone of activeMilestones) {
    const tasks = db.listTasks(database, { milestone_id: milestone.id, status: 'pending' });
    if (tasks.length > 0) {
      // 관련 메모리 조회 (task_id가 있는 메모리)
      let relatedMemories = [];
      try {
        const allMemories = db.searchMemories(database, { query: tasks[0].title, limit: 5 });
        relatedMemories = allMemories;
      } catch {
        // 검색 실패 시 빈 배열
      }

      return {
        task: tasks[0],
        milestone,
        related_memories: relatedMemories,
      };
    }
  }

  return null;
}

/**
 * 태스크 완료 처리 + 마일스톤 자동 완료 체크
 * 같은 마일스톤의 모든 태스크가 completed면 마일스톤도 completed로 변경
 * @param {import('sql.js').Database} database
 * @param {number} taskId
 * @returns {{ task_completed: boolean, milestone_completed: boolean, milestone_id: number|null }}
 */
function completeTask(database, taskId) {
  const task = db.getTask(database, taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  db.updateTaskStatus(database, taskId, 'completed');

  // 같은 마일스톤의 태스크 전체 확인
  const siblingTasks = db.listTasks(database, { milestone_id: task.milestone_id });
  const allCompleted = siblingTasks.every((t) =>
    t.id === taskId ? true : t.status === 'completed'
  );

  let milestoneCompleted = false;
  if (allCompleted) {
    db.updateMilestoneStatus(database, task.milestone_id, 'completed');
    milestoneCompleted = true;

    // 프로젝트의 모든 마일스톤이 완료되었는지도 확인
    const allMilestones = db.listMilestones(database, task.project_id);
    const allMilestonesCompleted = allMilestones.every((m) =>
      m.id === task.milestone_id ? true : m.status === 'completed'
    );
    if (allMilestonesCompleted) {
      db.updateProjectStatus(database, task.project_id, 'completed');
    }
  }

  return {
    task_completed: true,
    milestone_completed: milestoneCompleted,
    milestone_id: task.milestone_id,
  };
}

/**
 * 프로젝트 상태 요약 (세션 시작 시 사용)
 * @param {import('sql.js').Database} database
 * @param {number} projectId
 * @returns {string} 사람이 읽기 좋은 상태 요약 문자열
 */
function getProjectSummary(database, projectId) {
  const project = db.getProject(database, projectId);
  if (!project) return '프로젝트를 찾을 수 없습니다.';

  const progress = db.getProjectProgress(database, projectId);
  const next = getNextTask(database, projectId);

  let summary = `[${project.name}] `;
  summary += `마일스톤 ${progress.completed_milestones}/${progress.total_milestones} 완료, `;
  summary += `태스크 ${progress.completed_tasks}/${progress.total_tasks} 완료 (${progress.progress_pct}%)`;

  if (next) {
    summary += `, 다음 태스크: ${next.task.title}`;
  } else if (progress.progress_pct === 100) {
    summary += ' — 프로젝트 완료!';
  }

  return summary;
}

module.exports = {
  createProjectFromPRD,
  getProjectDashboard,
  getNextTask,
  completeTask,
  getProjectSummary,
};
