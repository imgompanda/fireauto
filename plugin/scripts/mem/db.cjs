/**
 * fireauto-mem SQLite Database Layer
 *
 * sql.js (WASM-based, no native build required) 를 사용한 동기식 DB 레이어.
 * 메모리, 세션, 요약의 CRUD + FTS4 전문 검색을 제공합니다.
 *
 * @module db
 */

const fs = require('fs');
const path = require('path');

// types.cjs 참조 (없을 수 있으므로 fallback)
let types;
try {
  types = require('./types.cjs');
} catch {
  types = {
    MEMORY_TYPES: ['decision', 'bugfix', 'feature', 'pattern', 'gotcha', 'refactor'],
    nowEpoch: () => Date.now(),
    formatEpoch: (epoch) => {
      const d = new Date(epoch);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },
    safeJsonParse: (str, fallback) => {
      try { return JSON.parse(str); } catch { return fallback; }
    },
  };
}

const { MEMORY_TYPES, nowEpoch, formatEpoch, safeJsonParse } = types;

// ── Schema ────────────────────────────────────────────────

const SCHEMA_SQL = `
-- 메모리 테이블
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('decision','bugfix','feature','pattern','gotcha','refactor')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  files_involved TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL
);

-- FTS4 전문 검색 (sql.js WASM은 FTS5 미지원, FTS4 사용)
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts4(
  title, content, tags,
  content="memories"
);

-- FTS 동기화 트리거
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(docid, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, docid, title, content, tags) VALUES('delete', old.id, old.title, old.content, old.tags);
END;

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at_epoch INTEGER NOT NULL,
  completed_at TEXT,
  status TEXT DEFAULT 'active'
);

-- 요약 테이블
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  request TEXT,
  what_done TEXT,
  what_learned TEXT,
  next_steps TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL
);
`;

// ── Helper: rows to objects ───────────────────────────────

/**
 * sql.js exec 결과를 객체 배열로 변환
 * @param {Array} results - db.exec() 결과
 * @returns {Object[]}
 */
function rowsToObjects(results) {
  if (!results.length || !results[0].values.length) return [];
  const columns = results[0].columns;
  return results[0].values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ── DB Initialization ─────────────────────────────────────

/**
 * DB 초기화 (sql.js WASM 로드 + 스키마 생성)
 * @param {string} dbPath - DB 파일 경로
 * @returns {Promise<import('sql.js').Database>} db 인스턴스
 */
async function initDb(dbPath) {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  let db;
  try {
    if (dbPath && fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    // 파일이 손상된 경우 새 DB 생성
    db = new SQL.Database();
  }

  // 스키마 생성
  try {
    db.run(SCHEMA_SQL);
  } catch (err) {
    throw new Error(`Schema initialization failed: ${err.message}`);
  }

  return db;
}

// ── Memory CRUD ───────────────────────────────────────────

/**
 * 메모리 레코드 삽입
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} params.session_id
 * @param {string} params.project
 * @param {string} params.type - MEMORY_TYPES 중 하나
 * @param {string} params.title
 * @param {string} params.content
 * @param {string[]|string} [params.tags=[]]
 * @param {string[]|string} [params.files_involved=[]]
 * @returns {number} 삽입된 레코드의 id
 */
function insertMemory(db, { session_id, project, type, title, content, tags = [], files_involved = [] }) {
  if (!MEMORY_TYPES.includes(type)) {
    throw new Error(`Invalid memory type: "${type}". Must be one of: ${MEMORY_TYPES.join(', ')}`);
  }
  if (!session_id || !project || !title || !content) {
    throw new Error('Required fields: session_id, project, title, content');
  }

  const epoch = nowEpoch();
  const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);
  const filesStr = typeof files_involved === 'string' ? files_involved : JSON.stringify(files_involved);

  try {
    db.run(
      `INSERT INTO memories (session_id, project, type, title, content, tags, files_involved, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session_id, project, type, title, content, tagsStr, filesStr, formatEpoch(epoch), epoch]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to insert memory: ${err.message}`);
  }
}

/**
 * FTS4 전문 검색으로 메모리 검색
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} params.query - 검색어
 * @param {string} [params.type] - 필터할 메모리 타입
 * @param {string} [params.project] - 필터할 프로젝트
 * @param {number} [params.limit=20] - 결과 제한
 * @returns {Array<{id: number, title: string, type: string, project: string, created_at_epoch: number}>}
 */
function searchMemories(db, { query, type, project, limit = 20 }) {
  if (!query || !query.trim()) {
    return [];
  }

  try {
    // FTS4 쿼리용으로 특수문자 이스케이프
    const safeQuery = query.replace(/['"]/g, '').trim();
    if (!safeQuery) return [];

    let sql = `
      SELECT m.id, m.title, m.type, m.project, m.created_at_epoch
      FROM memories_fts f
      JOIN memories m ON f.docid = m.id
      WHERE memories_fts MATCH ?`;
    const params = [safeQuery];

    if (type) {
      sql += ' AND m.type = ?';
      params.push(type);
    }
    if (project) {
      sql += ' AND m.project = ?';
      params.push(project);
    }

    sql += ' ORDER BY m.created_at_epoch DESC LIMIT ?';
    params.push(limit);

    return rowsToObjects(db.exec(sql, params));
  } catch {
    // FTS 매치 실패 시 LIKE fallback
    try {
      let sql = `
        SELECT id, title, type, project, created_at_epoch
        FROM memories
        WHERE (title LIKE ? OR content LIKE ?)`;
      const likePattern = `%${query}%`;
      const params = [likePattern, likePattern];

      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      if (project) {
        sql += ' AND project = ?';
        params.push(project);
      }

      sql += ' ORDER BY created_at_epoch DESC LIMIT ?';
      params.push(limit);

      return rowsToObjects(db.exec(sql, params));
    } catch (fallbackErr) {
      throw new Error(`Failed to search memories: ${fallbackErr.message}`);
    }
  }
}

/**
 * ID로 메모리 조회
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @returns {Object|null} full memory object
 */
function getMemoryById(db, id) {
  try {
    const rows = rowsToObjects(db.exec('SELECT * FROM memories WHERE id = ?', [id]));
    if (!rows.length) return null;

    const obj = rows[0];
    obj.tags = safeJsonParse(obj.tags, []);
    obj.files_involved = safeJsonParse(obj.files_involved, []);
    return obj;
  } catch (err) {
    throw new Error(`Failed to get memory by id ${id}: ${err.message}`);
  }
}

/**
 * 여러 ID로 메모리 조회
 * @param {import('sql.js').Database} db
 * @param {number[]} ids
 * @returns {Object[]} full memory objects
 */
function getMemoriesByIds(db, ids) {
  if (!ids || !ids.length) return [];

  try {
    const placeholders = ids.map(() => '?').join(',');
    const rows = rowsToObjects(db.exec(`SELECT * FROM memories WHERE id IN (${placeholders})`, ids));

    return rows.map((obj) => {
      obj.tags = safeJsonParse(obj.tags, []);
      obj.files_involved = safeJsonParse(obj.files_involved, []);
      return obj;
    });
  } catch (err) {
    throw new Error(`Failed to get memories by ids: ${err.message}`);
  }
}

/**
 * 최근 N일간의 메모리 + 요약을 시간순으로 조회
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {number} [params.days=7] - 조회 범위 (일)
 * @param {string} [params.project] - 프로젝트 필터
 * @returns {Array<{source: 'memory'|'summary', data: Object}>}
 */
function getTimeline(db, { days = 7, project } = {}) {
  const cutoff = nowEpoch() - days * 24 * 60 * 60 * 1000;

  try {
    // 메모리 조회
    let memSql = 'SELECT * FROM memories WHERE created_at_epoch >= ?';
    const memParams = [cutoff];
    if (project) {
      memSql += ' AND project = ?';
      memParams.push(project);
    }

    const memRows = rowsToObjects(db.exec(memSql, memParams));
    const memories = memRows.map((obj) => {
      obj.tags = safeJsonParse(obj.tags, []);
      obj.files_involved = safeJsonParse(obj.files_involved, []);
      return { source: 'memory', data: obj, epoch: obj.created_at_epoch };
    });

    // 요약 조회
    let sumSql = 'SELECT * FROM summaries WHERE created_at_epoch >= ?';
    const sumParams = [cutoff];
    if (project) {
      sumSql += ' AND project = ?';
      sumParams.push(project);
    }

    const sumRows = rowsToObjects(db.exec(sumSql, sumParams));
    const summaries = sumRows.map((obj) => ({
      source: 'summary', data: obj, epoch: obj.created_at_epoch,
    }));

    // 시간순 정렬 (최신 먼저)
    const combined = [...memories, ...summaries];
    combined.sort((a, b) => b.epoch - a.epoch);

    return combined.map(({ source, data }) => ({ source, data }));
  } catch (err) {
    throw new Error(`Failed to get timeline: ${err.message}`);
  }
}

// ── Session CRUD ──────────────────────────────────────────

/**
 * 세션 초기화 (이미 존재하면 기존 레코드 반환)
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} params.session_id
 * @param {string} params.project
 * @returns {Object} session record
 */
function initSession(db, { session_id, project }) {
  if (!session_id || !project) {
    throw new Error('Required fields: session_id, project');
  }

  try {
    // 기존 세션 확인
    const existing = rowsToObjects(db.exec('SELECT * FROM sessions WHERE session_id = ?', [session_id]));
    if (existing.length) return existing[0];

    // 새 세션 생성
    const epoch = nowEpoch();
    db.run(
      `INSERT INTO sessions (session_id, project, started_at, started_at_epoch, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [session_id, project, formatEpoch(epoch), epoch]
    );

    const rows = rowsToObjects(db.exec('SELECT * FROM sessions WHERE session_id = ?', [session_id]));
    return rows[0];
  } catch (err) {
    throw new Error(`Failed to init session: ${err.message}`);
  }
}

/**
 * 세션 완료 처리
 * @param {import('sql.js').Database} db
 * @param {string} session_id
 * @returns {boolean} 업데이트 성공 여부
 */
function completeSession(db, session_id) {
  if (!session_id) {
    throw new Error('Required field: session_id');
  }

  try {
    const now = formatEpoch(nowEpoch());
    db.run(
      `UPDATE sessions SET status = 'completed', completed_at = ? WHERE session_id = ?`,
      [now, session_id]
    );
    return db.getRowsModified() > 0;
  } catch (err) {
    throw new Error(`Failed to complete session: ${err.message}`);
  }
}

// ── Summary CRUD ──────────────────────────────────────────

/**
 * 요약 레코드 삽입
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} params.session_id
 * @param {string} params.project
 * @param {string} [params.request]
 * @param {string} [params.what_done]
 * @param {string} [params.what_learned]
 * @param {string} [params.next_steps]
 * @returns {number} 삽입된 레코드의 id
 */
function insertSummary(db, { session_id, project, request, what_done, what_learned, next_steps }) {
  if (!session_id || !project) {
    throw new Error('Required fields: session_id, project');
  }

  try {
    const epoch = nowEpoch();
    db.run(
      `INSERT INTO summaries (session_id, project, request, what_done, what_learned, next_steps, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session_id, project, request || null, what_done || null, what_learned || null, next_steps || null, formatEpoch(epoch), epoch]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to insert summary: ${err.message}`);
  }
}

/**
 * 요약 목록 조회
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} [params.project] - 프로젝트 필터
 * @param {number} [params.limit=20] - 결과 제한
 * @returns {Object[]} summary objects
 */
function getSummaries(db, { project, limit = 20 } = {}) {
  try {
    let sql = 'SELECT * FROM summaries';
    const params = [];

    if (project) {
      sql += ' WHERE project = ?';
      params.push(project);
    }

    sql += ' ORDER BY created_at_epoch DESC LIMIT ?';
    params.push(limit);

    return rowsToObjects(db.exec(sql, params));
  } catch (err) {
    throw new Error(`Failed to get summaries: ${err.message}`);
  }
}

// ── Stats ─────────────────────────────────────────────────

/**
 * DB 통계 조회
 * @param {import('sql.js').Database} db
 * @returns {{ total_memories: number, total_sessions: number, total_summaries: number }}
 */
function getStats(db) {
  try {
    const memResult = db.exec('SELECT COUNT(*) FROM memories');
    const sesResult = db.exec('SELECT COUNT(*) FROM sessions');
    const sumResult = db.exec('SELECT COUNT(*) FROM summaries');

    return {
      total_memories: memResult.length ? memResult[0].values[0][0] : 0,
      total_sessions: sesResult.length ? sesResult[0].values[0][0] : 0,
      total_summaries: sumResult.length ? sumResult[0].values[0][0] : 0,
    };
  } catch (err) {
    throw new Error(`Failed to get stats: ${err.message}`);
  }
}

// ── DB Persistence ────────────────────────────────────────

/**
 * DB를 파일에 저장 (sql.js는 인메모리이므로 주기적으로 flush 필요)
 * @param {import('sql.js').Database} db
 * @param {string} dbPath - 저장할 파일 경로
 */
function saveDb(db, dbPath) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    throw new Error(`Failed to save DB to ${dbPath}: ${err.message}`);
  }
}

// ── Exports ───────────────────────────────────────────────

module.exports = {
  initDb,
  insertMemory,
  searchMemories,
  getMemoryById,
  getMemoriesByIds,
  getTimeline,
  initSession,
  completeSession,
  insertSummary,
  getSummaries,
  getStats,
  saveDb,
};
