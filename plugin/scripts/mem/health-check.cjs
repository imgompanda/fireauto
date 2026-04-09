/**
 * fireauto-mem Health Check Module
 *
 * Karpathy의 lint 패턴을 차용한 메모리 건강 검사.
 * 7가지 검사로 메모리 시스템의 품질을 진단합니다.
 *
 * @module health-check
 */

const { ensureRelationsTable } = require('./relations.cjs');

// ── Helpers ──────────────────────────────────────────────

/**
 * sql.js prepare/bind 패턴으로 파라미터 바인딩된 SELECT 쿼리 실행.
 * db.exec(sql, params)는 params를 무시하므로 반드시 이 함수를 사용할 것.
 * @param {import('sql.js').Database} db
 * @param {string} sql
 * @param {Array} params
 * @returns {Object[]}
 */
function queryWithParams(db, sql, params) {
  const stmt = db.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

// ── Health Check ─────────────────────────────────────────

/**
 * 메모리 시스템 건강 검사 실행
 *
 * 7가지 검사:
 * 1. orphan_memories   - 관계가 0개인 고아 메모리 (warning)
 * 2. duplicate_titles  - 제목이 같은 메모리 (warning)
 * 3. stale_sessions    - 24시간 이상 active 상태인 세션 (critical)
 * 4. empty_summaries   - 요약 필드가 모두 비어있는 요약 (info)
 * 5. type_imbalance    - 특정 타입에 80%+ 집중 (info)
 * 6. missing_files     - files_involved가 비어있는 코드 변경 메모리 (warning)
 * 7. sparse_memories   - content가 50자 미만인 메모리 (info)
 *
 * @param {import('sql.js').Database} db
 * @param {string} project - 프로젝트 이름
 * @returns {{ project: string, checked_at: string, total_issues: number, issues: Array<{ severity: string, type: string, message: string, affected_ids: number[] }> }}
 */
function runHealthCheck(db, project) {
  const issues = [];

  // relations 테이블이 없을 수 있으므로 보장
  ensureRelationsTable(db);

  // 1. orphan_memories: 관계가 0개인 메모리
  try {
    const orphans = queryWithParams(db,
      `SELECT m.id, m.title
       FROM memories m
       LEFT JOIN relations r ON m.id = r.source_id OR m.id = r.target_id
       WHERE r.id IS NULL AND m.project = ?`,
      [project]
    );
    if (orphans.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'orphan_memories',
        message: `${orphans.length}개의 메모리가 다른 메모리와 연결되지 않았습니다.`,
        ids: orphans.map((o) => o.id),
      });
    }
  } catch {
    // relations 테이블 조인 실패 시 건너뜀
  }

  // 2. duplicate_titles: 제목이 같은 메모리
  try {
    const dupes = queryWithParams(db,
      `SELECT title, COUNT(*) as cnt
       FROM memories
       WHERE project = ?
       GROUP BY title
       HAVING cnt > 1`,
      [project]
    );
    if (dupes.length > 0) {
      const dupeIds = [];
      for (const d of dupes) {
        const rows = queryWithParams(db,
          `SELECT id FROM memories WHERE project = ? AND title = ?`,
          [project, d.title]
        );
        dupeIds.push(...rows.map((r) => r.id));
      }
      issues.push({
        severity: 'warning',
        type: 'duplicate_titles',
        message: `${dupes.length}개의 중복 제목이 발견되었습니다: ${dupes.map((d) => `"${d.title}" (${d.cnt}개)`).join(', ')}`,
        ids: dupeIds,
      });
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  // 3. stale_sessions: 24시간 이상 'active' 상태인 세션
  try {
    const staleThreshold = Date.now() - 86400000; // 24시간 (ms)
    const stale = queryWithParams(db,
      `SELECT id, session_id
       FROM sessions
       WHERE status = 'active' AND started_at_epoch < ?`,
      [staleThreshold]
    );
    if (stale.length > 0) {
      issues.push({
        severity: 'critical',
        type: 'stale_sessions',
        message: `${stale.length}개의 세션이 24시간 이상 active 상태입니다.`,
        ids: stale.map((s) => s.id),
      });
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  // 4. empty_summaries: 요약 필드가 모두 비어있는 요약
  try {
    const empty = queryWithParams(db,
      `SELECT id
       FROM summaries
       WHERE project = ?
         AND (request IS NULL OR request = '')
         AND (what_done IS NULL OR what_done = '')
         AND (what_learned IS NULL OR what_learned = '')
         AND (next_steps IS NULL OR next_steps = '')`,
      [project]
    );
    if (empty.length > 0) {
      issues.push({
        severity: 'info',
        type: 'empty_summaries',
        message: `${empty.length}개의 요약에 내용이 없습니다.`,
        ids: empty.map((e) => e.id),
      });
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  // 5. type_imbalance: 특정 타입에 80%+ 집중 (최소 5개 이상일 때)
  try {
    const typeCounts = queryWithParams(db,
      `SELECT type, COUNT(*) as cnt
       FROM memories
       WHERE project = ?
       GROUP BY type`,
      [project]
    );
    if (typeCounts.length > 0) {
      const total = typeCounts.reduce((sum, t) => sum + t.cnt, 0);
      for (const tc of typeCounts) {
        const ratio = tc.cnt / total;
        if (ratio >= 0.8 && total >= 5) {
          issues.push({
            severity: 'info',
            type: 'type_imbalance',
            message: `"${tc.type}" 타입이 전체의 ${Math.round(ratio * 100)}% (${tc.cnt}/${total})를 차지합니다.`,
            ids: [],
          });
        }
      }
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  // 6. missing_files: files_involved가 비어있는 코드 변경 관련 메모리
  try {
    const missing = queryWithParams(db,
      `SELECT id
       FROM memories
       WHERE project = ?
         AND (files_involved IS NULL OR files_involved = '[]' OR files_involved = '')
         AND (type IN ('bugfix', 'feature', 'refactor')
              OR content LIKE '%Edit%' OR content LIKE '%Write%'
              OR title LIKE '%수정%' OR title LIKE '%추가%' OR title LIKE '%리팩%')`,
      [project]
    );
    if (missing.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'missing_files',
        message: `${missing.length}개의 코드 변경 관련 메모리에 files_involved가 비어있습니다.`,
        ids: missing.map((m) => m.id),
      });
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  // 7. sparse_memories: content가 50자 미만인 메모리
  try {
    const sparse = queryWithParams(db,
      `SELECT id
       FROM memories
       WHERE project = ? AND LENGTH(content) < 50`,
      [project]
    );
    if (sparse.length > 0) {
      issues.push({
        severity: 'info',
        type: 'sparse_memories',
        message: `${sparse.length}개의 메모리 content가 50자 미만입니다.`,
        ids: sparse.map((s) => s.id),
      });
    }
  } catch {
    // 검사 실패 시 건너뜀
  }

  return {
    project,
    checked_at: new Date().toISOString(),
    total_issues: issues.length,
    issues: issues.map((i) => ({
      severity: i.severity,
      type: i.type,
      message: i.message,
      affected_ids: i.ids || [],
    })),
  };
}

// ── Exports ──────────────────────────────────────────────

module.exports = {
  runHealthCheck,
};
