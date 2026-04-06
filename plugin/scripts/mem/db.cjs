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

-- 관계 테이블 (v2)
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL CHECK(
    relation_type IN ('related', 'caused_by', 'led_to', 'same_file', 'same_tag')
  ),
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY (source_id) REFERENCES memories(id),
  FOREIGN KEY (target_id) REFERENCES memories(id),
  UNIQUE(source_id, target_id, relation_type)
);

-- 프로젝트 테이블 (v3)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  prd_path TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL,
  updated_at_epoch INTEGER
);

-- 마일스톤 테이블 (v3)
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  completed_at_epoch INTEGER,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 태스크 테이블 (v3)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'P1',
  assignee TEXT,
  order_index INTEGER DEFAULT 0,
  blocked_by TEXT,
  completed_at_epoch INTEGER,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
`;

// ── v2 Migration ─────────────────────────────────────────

/**
 * v2 마이그레이션: memories에 컬럼 추가 + summaries에 investigated 추가
 * 이미 존재하는 컬럼은 에러 무시
 * @param {import('sql.js').Database} db
 */
function migrateV2(db) {
  const newColumns = [
    { table: 'memories', column: 'subtitle', type: 'TEXT' },
    { table: 'memories', column: 'narrative', type: 'TEXT' },
    { table: 'memories', column: 'facts', type: "TEXT DEFAULT '[]'" },
    { table: 'memories', column: 'concepts', type: "TEXT DEFAULT '[]'" },
    { table: 'summaries', column: 'investigated', type: 'TEXT' },
    { table: 'memories', column: 'task_id', type: 'INTEGER' },
  ];
  for (const { table, column, type } of newColumns) {
    try {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (e) {
      /* 이미 존재 — 무시 */
    }
  }
}

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

/**
 * 메모리 행의 JSON 필드를 파싱
 * @param {Object} obj - raw memory row
 * @returns {Object} parsed memory object
 */
function parseMemoryRow(obj) {
  obj.tags = safeJsonParse(obj.tags, []);
  obj.files_involved = safeJsonParse(obj.files_involved, []);
  obj.facts = safeJsonParse(obj.facts, []);
  obj.concepts = safeJsonParse(obj.concepts, []);
  return obj;
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

  // v2 마이그레이션 (기존 DB 점진 업그레이드)
  migrateV2(db);

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
function insertMemory(db, { session_id, project, type, title, content, tags = [], files_involved = [], subtitle, narrative, facts = [], concepts = [] }) {
  if (!MEMORY_TYPES.includes(type)) {
    throw new Error(`Invalid memory type: "${type}". Must be one of: ${MEMORY_TYPES.join(', ')}`);
  }
  if (!session_id || !project || !title || !content) {
    throw new Error('Required fields: session_id, project, title, content');
  }

  const epoch = nowEpoch();
  const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);
  const filesStr = typeof files_involved === 'string' ? files_involved : JSON.stringify(files_involved);
  const factsStr = typeof facts === 'string' ? facts : JSON.stringify(facts);
  const conceptsStr = typeof concepts === 'string' ? concepts : JSON.stringify(concepts);

  try {
    db.run(
      `INSERT INTO memories (session_id, project, type, title, content, tags, files_involved, subtitle, narrative, facts, concepts, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session_id, project, type, title, content, tagsStr, filesStr, subtitle || null, narrative || null, factsStr, conceptsStr, formatEpoch(epoch), epoch]
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
/**
 * 메모리 목록 조회 (검색 없이)
 * @param {import('sql.js').Database} db
 * @param {{ type?: string, project?: string, limit?: number }} options
 * @returns {Array<Object>}
 */
function listMemories(db, { type, project, limit = 20 } = {}) {
  try {
    let sql = 'SELECT id, title, type, project, created_at_epoch FROM memories WHERE 1=1';
    const params = [];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (project) { sql += ' AND project = ?'; params.push(project); }
    sql += ' ORDER BY created_at_epoch DESC LIMIT ?';
    params.push(limit);
    return rowsToObjects(db.exec(sql, params));
  } catch (err) {
    throw new Error(`Failed to list memories: ${err.message}`);
  }
}

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

    return parseMemoryRow(rows[0]);
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

    return rows.map(parseMemoryRow);
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
      const parsed = parseMemoryRow(obj);
      return { source: 'memory', data: parsed, epoch: parsed.created_at_epoch };
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

// ── Relation CRUD ────────────────────────────────────────

/**
 * 관계 레코드 삽입 (중복 무시)
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {number} params.source_id
 * @param {number} params.target_id
 * @param {string} params.relation_type - 'related'|'caused_by'|'led_to'|'same_file'|'same_tag'
 * @param {number} [params.confidence=1.0]
 * @returns {number|null} 삽입된 레코드의 id 또는 중복 시 null
 */
function insertRelation(db, { source_id, target_id, relation_type, confidence = 1.0 }) {
  if (!source_id || !target_id || !relation_type) {
    throw new Error('Required fields: source_id, target_id, relation_type');
  }

  const epoch = nowEpoch();
  try {
    db.run(
      `INSERT OR IGNORE INTO relations (source_id, target_id, relation_type, confidence, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [source_id, target_id, relation_type, confidence, formatEpoch(epoch), epoch]
    );
    const modified = db.getRowsModified();
    if (modified === 0) return null;
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to insert relation: ${err.message}`);
  }
}

/**
 * 특정 메모리의 모든 관계 조회
 * @param {import('sql.js').Database} db
 * @param {number} memoryId
 * @returns {Object[]} relation records
 */
function getRelations(db, memoryId) {
  try {
    const rows = rowsToObjects(db.exec(
      `SELECT * FROM relations WHERE source_id = ? OR target_id = ? ORDER BY created_at_epoch DESC`,
      [memoryId, memoryId]
    ));
    return rows;
  } catch (err) {
    throw new Error(`Failed to get relations for memory ${memoryId}: ${err.message}`);
  }
}

/**
 * depth 단계까지 관련 메모리 + 관계 정보 반환
 * @param {import('sql.js').Database} db
 * @param {number} memoryId
 * @param {number} [depth=1] - 1: 직접 연결만, 2: 1촌 + 2촌
 * @returns {{ memories: Object[], relations: Object[] }}
 */
function getRelatedMemories(db, memoryId, depth = 1) {
  try {
    const visitedIds = new Set([memoryId]);
    const allRelations = [];
    let currentIds = [memoryId];

    for (let d = 0; d < depth; d++) {
      if (!currentIds.length) break;

      const placeholders = currentIds.map(() => '?').join(',');
      const relations = rowsToObjects(db.exec(
        `SELECT * FROM relations WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
        [...currentIds, ...currentIds]
      ));

      const nextIds = [];
      for (const rel of relations) {
        allRelations.push(rel);
        for (const id of [rel.source_id, rel.target_id]) {
          if (!visitedIds.has(id)) {
            visitedIds.add(id);
            nextIds.push(id);
          }
        }
      }
      currentIds = nextIds;
    }

    // 자기 자신 제외
    visitedIds.delete(memoryId);
    const memoryIds = [...visitedIds];
    const memories = memoryIds.length ? getMemoriesByIds(db, memoryIds) : [];

    // 중복 관계 제거
    const uniqueRelations = [];
    const relKeys = new Set();
    for (const rel of allRelations) {
      const key = `${rel.source_id}-${rel.target_id}-${rel.relation_type}`;
      if (!relKeys.has(key)) {
        relKeys.add(key);
        uniqueRelations.push(rel);
      }
    }

    return { memories, relations: uniqueRelations };
  } catch (err) {
    throw new Error(`Failed to get related memories for ${memoryId}: ${err.message}`);
  }
}

/**
 * 프로젝트의 모든 메모리를 컴파일용으로 반환 (전체 필드)
 * @param {import('sql.js').Database} db
 * @param {string} project
 * @returns {Object[]} full memory objects
 */
function getMemoriesForCompile(db, project) {
  if (!project) {
    throw new Error('Required field: project');
  }

  try {
    const rows = rowsToObjects(db.exec(
      'SELECT * FROM memories WHERE project = ? ORDER BY created_at_epoch ASC',
      [project]
    ));
    return rows.map(parseMemoryRow);
  } catch (err) {
    throw new Error(`Failed to get memories for compile: ${err.message}`);
  }
}

// ── Project CRUD ─────────────────────────────────────────

/**
 * 프로젝트 생성
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {string} params.name - 프로젝트 이름
 * @param {string} [params.description] - 설명
 * @param {string} [params.prd_path] - PRD 파일 경로
 * @returns {number} 생성된 프로젝트 id
 */
function createProject(db, { name, description, prd_path }) {
  if (!name) throw new Error('Required field: name');
  const epoch = nowEpoch();
  try {
    db.run(
      `INSERT INTO projects (name, description, prd_path, status, created_at, created_at_epoch, updated_at_epoch)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      [name, description || null, prd_path || null, formatEpoch(epoch), epoch, epoch]
    );
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to create project: ${err.message}`);
  }
}

/**
 * ID로 프로젝트 조회
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @returns {Object|null}
 */
function getProject(db, id) {
  try {
    const rows = rowsToObjects(db.exec('SELECT * FROM projects WHERE id = ?', [id]));
    return rows.length ? rows[0] : null;
  } catch (err) {
    throw new Error(`Failed to get project ${id}: ${err.message}`);
  }
}

/**
 * 프로젝트 목록 조회
 * @param {import('sql.js').Database} db
 * @param {{ status?: string, limit?: number }} options
 * @returns {Object[]}
 */
function listProjects(db, { status, limit = 50 } = {}) {
  try {
    let sql = 'SELECT * FROM projects WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at_epoch DESC LIMIT ?';
    params.push(limit);
    return rowsToObjects(db.exec(sql, params));
  } catch (err) {
    throw new Error(`Failed to list projects: ${err.message}`);
  }
}

/**
 * 프로젝트 상태 변경
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @param {string} status - 'active'|'completed'|'archived'
 * @returns {boolean}
 */
function updateProjectStatus(db, id, status) {
  try {
    const epoch = nowEpoch();
    db.run('UPDATE projects SET status = ?, updated_at_epoch = ? WHERE id = ?', [status, epoch, id]);
    return db.getRowsModified() > 0;
  } catch (err) {
    throw new Error(`Failed to update project status: ${err.message}`);
  }
}

// ── Milestone CRUD ───────────────────────────────────────

/**
 * 마일스톤 생성
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {number} params.project_id
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {number} [params.order_index=0]
 * @param {string} [params.due_date]
 * @returns {number} 생성된 마일스톤 id
 */
function createMilestone(db, { project_id, title, description, order_index = 0, due_date }) {
  if (!project_id || !title) throw new Error('Required fields: project_id, title');
  const epoch = nowEpoch();
  try {
    db.run(
      `INSERT INTO milestones (project_id, title, description, order_index, status, due_date, created_at_epoch)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [project_id, title, description || null, order_index, due_date || null, epoch]
    );
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to create milestone: ${err.message}`);
  }
}

/**
 * ID로 마일스톤 조회
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @returns {Object|null}
 */
function getMilestone(db, id) {
  try {
    const rows = rowsToObjects(db.exec('SELECT * FROM milestones WHERE id = ?', [id]));
    return rows.length ? rows[0] : null;
  } catch (err) {
    throw new Error(`Failed to get milestone ${id}: ${err.message}`);
  }
}

/**
 * 프로젝트의 마일스톤 목록 조회
 * @param {import('sql.js').Database} db
 * @param {number} projectId
 * @param {{ status?: string }} options
 * @returns {Object[]}
 */
function listMilestones(db, projectId, { status } = {}) {
  try {
    let sql = 'SELECT * FROM milestones WHERE project_id = ?';
    const params = [projectId];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY order_index ASC';
    return rowsToObjects(db.exec(sql, params));
  } catch (err) {
    throw new Error(`Failed to list milestones: ${err.message}`);
  }
}

/**
 * 마일스톤 상태 변경
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @param {string} status - 'pending'|'in_progress'|'completed'
 * @returns {boolean}
 */
function updateMilestoneStatus(db, id, status) {
  try {
    const completedEpoch = status === 'completed' ? nowEpoch() : null;
    db.run(
      'UPDATE milestones SET status = ?, completed_at_epoch = ? WHERE id = ?',
      [status, completedEpoch, id]
    );
    return db.getRowsModified() > 0;
  } catch (err) {
    throw new Error(`Failed to update milestone status: ${err.message}`);
  }
}

// ── Task CRUD ────────────────────────────────────────────

/**
 * 태스크 생성
 * @param {import('sql.js').Database} db
 * @param {Object} params
 * @param {number} params.milestone_id
 * @param {number} params.project_id
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {string} [params.priority='P1']
 * @param {string} [params.assignee]
 * @param {number} [params.order_index=0]
 * @param {string} [params.blocked_by] - 차단 태스크 ID (JSON 문자열)
 * @returns {number} 생성된 태스크 id
 */
function createTask(db, { milestone_id, project_id, title, description, priority = 'P1', assignee, order_index = 0, blocked_by }) {
  if (!milestone_id || !project_id || !title) throw new Error('Required fields: milestone_id, project_id, title');
  const epoch = nowEpoch();
  try {
    db.run(
      `INSERT INTO tasks (milestone_id, project_id, title, description, status, priority, assignee, order_index, blocked_by, created_at_epoch)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [milestone_id, project_id, title, description || null, priority, assignee || null, order_index, blocked_by || null, epoch]
    );
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0];
  } catch (err) {
    throw new Error(`Failed to create task: ${err.message}`);
  }
}

/**
 * ID로 태스크 조회
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @returns {Object|null}
 */
function getTask(db, id) {
  try {
    const rows = rowsToObjects(db.exec('SELECT * FROM tasks WHERE id = ?', [id]));
    return rows.length ? rows[0] : null;
  } catch (err) {
    throw new Error(`Failed to get task ${id}: ${err.message}`);
  }
}

/**
 * 태스크 목록 조회 (마일스톤 또는 프로젝트 기준)
 * @param {import('sql.js').Database} db
 * @param {{ milestone_id?: number, project_id?: number, status?: string }} options
 * @returns {Object[]}
 */
function listTasks(db, { milestone_id, project_id, status } = {}) {
  try {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    if (milestone_id) { sql += ' AND milestone_id = ?'; params.push(milestone_id); }
    if (project_id) { sql += ' AND project_id = ?'; params.push(project_id); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY order_index ASC';
    return rowsToObjects(db.exec(sql, params));
  } catch (err) {
    throw new Error(`Failed to list tasks: ${err.message}`);
  }
}

/**
 * 태스크 상태 변경
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @param {string} status - 'pending'|'in_progress'|'completed'|'skipped'
 * @returns {boolean}
 */
function updateTaskStatus(db, id, status) {
  try {
    const completedEpoch = status === 'completed' ? nowEpoch() : null;
    db.run(
      'UPDATE tasks SET status = ?, completed_at_epoch = ? WHERE id = ?',
      [status, completedEpoch, id]
    );
    return db.getRowsModified() > 0;
  } catch (err) {
    throw new Error(`Failed to update task status: ${err.message}`);
  }
}

/**
 * 프로젝트 진행률 계산
 * @param {import('sql.js').Database} db
 * @param {number} projectId
 * @returns {{ total_tasks: number, completed_tasks: number, progress_pct: number, total_milestones: number, completed_milestones: number }}
 */
function getProjectProgress(db, projectId) {
  try {
    const taskResult = db.exec(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM tasks WHERE project_id = ?`,
      [projectId]
    );
    const milestoneResult = db.exec(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM milestones WHERE project_id = ?`,
      [projectId]
    );

    const totalTasks = taskResult.length ? taskResult[0].values[0][0] : 0;
    const completedTasks = taskResult.length ? (taskResult[0].values[0][1] || 0) : 0;
    const totalMilestones = milestoneResult.length ? milestoneResult[0].values[0][0] : 0;
    const completedMilestones = milestoneResult.length ? (milestoneResult[0].values[0][1] || 0) : 0;

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones,
    };
  } catch (err) {
    throw new Error(`Failed to get project progress: ${err.message}`);
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

/**
 * 세션 목록 조회
 * @param {import('sql.js').Database} db
 * @param {{ project?: string, limit?: number }} options
 * @returns {Array<Object>}
 */
function getSessions(db, { project, limit = 50 } = {}) {
  try {
    let sql = 'SELECT * FROM sessions';
    const params = [];
    if (project) {
      sql += ' WHERE project = ?';
      params.push(project);
    }
    sql += ' ORDER BY started_at_epoch DESC LIMIT ?';
    params.push(limit);
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    throw new Error(`Failed to get sessions: ${err.message}`);
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
  listMemories,
  searchMemories,
  getMemoryById,
  getMemoriesByIds,
  getTimeline,
  initSession,
  completeSession,
  insertSummary,
  getSessions,
  getSummaries,
  getStats,
  saveDb,
  // v2
  insertRelation,
  getRelations,
  getRelatedMemories,
  getMemoriesForCompile,
  // v3 — project management
  createProject,
  getProject,
  listProjects,
  updateProjectStatus,
  createMilestone,
  getMilestone,
  listMilestones,
  updateMilestoneStatus,
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  getProjectProgress,
};
