/**
 * fireauto-mem: 세션 복기 보고서
 * 원칙: 실수는 크게, 성공은 조용히
 *
 * @module retrospection
 */

const db = require('./db.cjs');

/**
 * 세션 복기 보고서 생성
 * @param {import('sql.js').Database} database
 * @param {string} project
 * @param {string} sessionId
 * @returns {Object} report
 */
function generateRetrospect(database, project, sessionId) {
  // 1. 이 세션의 메모리 조회
  const memories = db.listMemories(database, { project, limit: 100 });
  const sessionMemories = memories.filter(m => m.session_id === sessionId);

  // 2. 실수 조회 (최근 1시간)
  const mistakes = db.listMistakes(database, { project, limit: 20 });
  const sessionMistakes = mistakes.filter(m => {
    return m.created_at_epoch > Date.now() - 3600000;
  });

  // 3. 다음 할 일 조회
  const nextTodo = getNextTasks(database, project);

  // 4. 보고서 생성
  const report = {
    session_id: sessionId,
    project,
    timestamp: new Date().toISOString(),

    // 실수 (크게)
    mistakes: sessionMistakes.map(m => ({
      description: m.description,
      cause: m.cause,
      fix: m.fix,
      prevention: m.prevention,
      severity: m.severity,
    })),

    // 완료한 작업 (조용히)
    completed: sessionMemories
      .filter(m => m.type === 'feature' || m.type === 'bugfix')
      .map(m => m.title),

    // 배운 것
    learnings: sessionMemories
      .filter(m => m.type === 'pattern' || m.type === 'gotcha' || m.type === 'decision')
      .map(m => ({ type: m.type, title: m.title, content: m.content })),

    // 다음 할 일
    next_todo: nextTodo,
  };

  return report;
}

/**
 * 프로젝트의 다음 pending 태스크 조회
 * @param {import('sql.js').Database} database
 * @param {string} project
 * @returns {string|null}
 */
function getNextTasks(database, project) {
  try {
    const projects = db.listProjects(database);
    const proj = projects.find(p => p.name === project && p.status === 'active');
    if (!proj) return null;

    const tasks = db.listTasks(database, { project_id: proj.id, status: 'pending' });
    if (!tasks.length) return null;

    return tasks.slice(0, 3).map(t => t.title).join(', ');
  } catch {
    return null;
  }
}

/**
 * 복기 보고서를 마크다운으로 포맷
 * @param {Object} report
 * @returns {string}
 */
function formatRetrospect(report) {
  const lines = [];
  lines.push('═══════════════════════════════');
  lines.push('세션 복기 • ' + report.timestamp.split('T')[0]);
  lines.push('');

  // 실수 (크게!)
  if (report.mistakes.length > 0) {
    lines.push('⚠️ 실수 (' + report.mistakes.length + '건):');
    report.mistakes.forEach((m, i) => {
      lines.push((i + 1) + '. ' + m.description);
      if (m.fix) lines.push('   → 수정: ' + m.fix);
      if (m.prevention) lines.push('   → 방지: ' + m.prevention);
    });
    lines.push('');
  }

  // 배운 것
  if (report.learnings.length > 0) {
    lines.push('💡 배운 것:');
    report.learnings.forEach(l => lines.push('- [' + l.type + '] ' + l.title));
    lines.push('');
  }

  // 완료 (조용히)
  if (report.completed.length > 0) {
    lines.push('✓ 완료: ' + report.completed.join(', '));
    lines.push('');
  }

  // 다음
  if (report.next_todo) {
    lines.push('📝 다음: ' + report.next_todo);
  }

  lines.push('═══════════════════════════════');
  return lines.join('\n');
}

/**
 * Wiki에 복기 기록 추가
 * @param {string} projectRoot
 * @param {Object} report
 */
function saveRetrospectToWiki(projectRoot, report) {
  try {
    const wikiMgr = require('./wiki-manager.cjs');
    const existing = wikiMgr.readPage('retrospective') || '# 복기 기록\n';
    const entry = '\n## ' + report.timestamp.split('T')[0] + '\n' + formatRetrospect(report) + '\n';
    wikiMgr.writePage('retrospective', existing + entry);
  } catch {
    // wiki-manager가 없으면 조용히 무시
  }
}

module.exports = { generateRetrospect, formatRetrospect, saveRetrospectToWiki };
