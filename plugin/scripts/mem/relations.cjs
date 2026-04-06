/**
 * fireauto-mem Relations Module
 *
 * 새 메모리 저장 시 기존 메모리와의 관계를 자동 추론하고,
 * BFS 기반 관계 그래프 탐색을 제공합니다.
 *
 * @module relations
 */

// ── Helpers ──────────────────────────────────────────────

/**
 * JSON 문자열을 안전하게 파싱
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

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

// ── Relations table bootstrap ────────────────────────────

const RELATIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at_epoch INTEGER NOT NULL,
  UNIQUE(source_id, target_id, relation_type)
);
`;

/**
 * relations 테이블이 없으면 생성
 * @param {import('sql.js').Database} db
 */
function ensureRelationsTable(db) {
  try {
    db.run(RELATIONS_SCHEMA);
  } catch {
    // 이미 존재하거나 생성 불가 -- 무시
  }
}

// ── DB access with fallback ──────────────────────────────

/**
 * db.cjs의 getMemoryById를 시도, 실패 시 직접 SQL
 * @param {import('sql.js').Database} db
 * @param {number} id
 * @returns {Object|null}
 */
function getMemoryByIdSafe(db, id) {
  try {
    const { getMemoryById } = require('./db.cjs');
    return getMemoryById(db, id);
  } catch {
    const rows = rowsToObjects(db.exec('SELECT * FROM memories WHERE id = ?', [id]));
    if (!rows.length) return null;
    const obj = rows[0];
    obj.tags = safeJsonParse(obj.tags, []);
    obj.files_involved = safeJsonParse(obj.files_involved, []);
    return obj;
  }
}

/**
 * 관계 삽입 (db.cjs insertRelation 시도, 없으면 직접 SQL)
 * @param {import('sql.js').Database} db
 * @param {{ source_id: number, target_id: number, relation_type: string, confidence: number }} rel
 * @returns {number|null} 삽입된 id 또는 null (중복/실패)
 */
function insertRelationSafe(db, { source_id, target_id, relation_type, confidence }) {
  // self-reference 방지
  if (source_id === target_id) return null;

  try {
    const { insertRelation } = require('./db.cjs');
    return insertRelation(db, { source_id, target_id, relation_type, confidence });
  } catch {
    // db.cjs에 insertRelation이 없으면 직접 SQL
    try {
      ensureRelationsTable(db);
      db.run(
        `INSERT OR IGNORE INTO relations (source_id, target_id, relation_type, confidence, created_at_epoch)
         VALUES (?, ?, ?, ?, ?)`,
        [source_id, target_id, relation_type, confidence, Date.now()]
      );
      const result = db.exec('SELECT last_insert_rowid() as id');
      const id = result[0].values[0][0];
      return id || null;
    } catch {
      return null;
    }
  }
}

/**
 * 특정 메모리의 관계 조회 (db.cjs getRelations 시도, 없으면 직접 SQL)
 * @param {import('sql.js').Database} db
 * @param {number} memoryId
 * @returns {Object[]}
 */
function getRelationsSafe(db, memoryId) {
  try {
    const { getRelations } = require('./db.cjs');
    return getRelations(db, memoryId);
  } catch {
    try {
      ensureRelationsTable(db);
      return rowsToObjects(db.exec(
        `SELECT * FROM relations WHERE source_id = ? OR target_id = ?`,
        [memoryId, memoryId]
      ));
    } catch {
      return [];
    }
  }
}

// ── Core Functions ───────────────────────────────────────

/**
 * 새 메모리에 대해 기존 메모리와의 관계를 자동 추론
 *
 * 규칙:
 * 1. same_file (0.8): files_involved가 겹치는 메모리
 * 2. same_tag (0.6): tags가 겹치는 메모리
 * 3. led_to (0.7): 같은 세션에서 5분 이내 연속 메모리
 *
 * @param {import('sql.js').Database} db
 * @param {number} newMemoryId
 * @returns {Array<{ source_id: number, target_id: number, relation_type: string, confidence: number }>}
 */
function inferRelations(db, newMemoryId) {
  ensureRelationsTable(db);

  const newMem = getMemoryByIdSafe(db, newMemoryId);
  if (!newMem) return [];

  const relations = [];
  const seen = new Set(); // "sourceId-targetId-type" 중복 방지
  const newFiles = Array.isArray(newMem.files_involved) ? newMem.files_involved : safeJsonParse(newMem.files_involved, []);
  const newTags = Array.isArray(newMem.tags) ? newMem.tags : safeJsonParse(newMem.tags, []);

  // 1. same_file: 같은 파일을 참조한 메모리
  for (const file of newFiles) {
    if (!file) continue;
    try {
      const matches = rowsToObjects(db.exec(
        `SELECT id FROM memories WHERE id != ? AND files_involved LIKE ?`,
        [newMemoryId, `%${file}%`]
      ));
      for (const match of matches) {
        const key = `${newMemoryId}-${match.id}-same_file`;
        if (seen.has(key)) continue;
        seen.add(key);

        const id = insertRelationSafe(db, {
          source_id: newMemoryId,
          target_id: match.id,
          relation_type: 'same_file',
          confidence: 0.8,
        });
        if (id) {
          relations.push({ source_id: newMemoryId, target_id: match.id, relation_type: 'same_file', confidence: 0.8 });
        }
      }
    } catch {
      // 개별 파일 매칭 실패 시 다음으로
    }
  }

  // 2. same_tag: 같은 태그를 가진 메모리
  for (const tag of newTags) {
    if (!tag) continue;
    try {
      const matches = rowsToObjects(db.exec(
        `SELECT id FROM memories WHERE id != ? AND tags LIKE ?`,
        [newMemoryId, `%${tag}%`]
      ));
      for (const match of matches) {
        const key = `${newMemoryId}-${match.id}-same_tag`;
        if (seen.has(key)) continue;
        seen.add(key);

        const id = insertRelationSafe(db, {
          source_id: newMemoryId,
          target_id: match.id,
          relation_type: 'same_tag',
          confidence: 0.6,
        });
        if (id) {
          relations.push({ source_id: newMemoryId, target_id: match.id, relation_type: 'same_tag', confidence: 0.6 });
        }
      }
    } catch {
      // 개별 태그 매칭 실패 시 다음으로
    }
  }

  // 3. content_match: 제목/내용에 공통 키워드가 있는 메모리
  try {
    // 새 메모리의 제목에서 핵심 키워드 추출 (2글자 이상 단어)
    const titleWords = (newMem.title || '').split(/[\s,.:;!?(){}[\]"'`/\\|+\-=<>]+/)
      .filter(w => w.length >= 2)
      .filter(w => !/^(the|and|for|with|from|that|this|was|are|were|has|have|had|not|but|can|will|its|you|all|한|을|를|이|가|의|에|로|은|는|도|다)$/i.test(w));

    for (const word of titleWords.slice(0, 5)) { // 최대 5개 키워드
      const matches = rowsToObjects(db.exec(
        `SELECT id FROM memories WHERE id != ? AND (title LIKE ? OR content LIKE ?) LIMIT 5`,
        [newMemoryId, `%${word}%`, `%${word}%`]
      ));
      for (const match of matches) {
        const key = `${newMemoryId}-${match.id}-related`;
        if (seen.has(key)) continue;
        seen.add(key);
        const id = insertRelationSafe(db, {
          source_id: newMemoryId,
          target_id: match.id,
          relation_type: 'related',
          confidence: 0.5,
        });
        if (id) {
          relations.push({ source_id: newMemoryId, target_id: match.id, relation_type: 'related', confidence: 0.5 });
        }
      }
    }
  } catch {
    // content_match 실패 시 무시
  }

  // 4. led_to: 같은 세션, 5분(300,000ms) 이내 이전 메모리
  if (newMem.session_id && newMem.created_at_epoch) {
    try {
      const fiveMinMs = 300000;
      const matches = rowsToObjects(db.exec(
        `SELECT id FROM memories
         WHERE id != ? AND session_id = ?
           AND created_at_epoch < ?
           AND created_at_epoch > ? - ?`,
        [newMemoryId, newMem.session_id, newMem.created_at_epoch, newMem.created_at_epoch, fiveMinMs]
      ));
      for (const match of matches) {
        const key = `${match.id}-${newMemoryId}-led_to`;
        if (seen.has(key)) continue;
        seen.add(key);

        // led_to: 이전 메모리 -> 새 메모리
        const id = insertRelationSafe(db, {
          source_id: match.id,
          target_id: newMemoryId,
          relation_type: 'led_to',
          confidence: 0.7,
        });
        if (id) {
          relations.push({ source_id: match.id, target_id: newMemoryId, relation_type: 'led_to', confidence: 0.7 });
        }
      }
    } catch {
      // led_to 매칭 실패 시 무시
    }
  }

  return relations;
}

/**
 * BFS로 관계 그래프를 depth만큼 탐색
 *
 * @param {import('sql.js').Database} db
 * @param {number} memoryId - 시작 메모리 ID
 * @param {number} [depth=1] - 탐색 깊이
 * @returns {{ nodes: Array<{id: number, title: string, type: string}>, edges: Array<{source: number, target: number, relation_type: string, confidence: number}> }}
 */
function getRelationGraph(db, memoryId, depth = 1) {
  ensureRelationsTable(db);

  const nodes = [];
  const edges = [];
  const visited = new Set();
  const edgeSeen = new Set();

  // BFS queue: [memoryId, currentDepth]
  const queue = [[memoryId, 0]];
  visited.add(memoryId);

  // 시작 노드 추가
  const startMem = getMemoryByIdSafe(db, memoryId);
  if (startMem) {
    nodes.push({ id: startMem.id, title: startMem.title, type: startMem.type });
  } else {
    return { nodes: [], edges: [] };
  }

  while (queue.length > 0) {
    const [currentId, currentDepth] = queue.shift();
    if (currentDepth >= depth) continue;

    const rels = getRelationsSafe(db, currentId);

    for (const rel of rels) {
      const neighborId = rel.source_id === currentId ? rel.target_id : rel.source_id;

      // 엣지 중복 방지
      const edgeKey = `${rel.source_id}-${rel.target_id}-${rel.relation_type}`;
      if (!edgeSeen.has(edgeKey)) {
        edgeSeen.add(edgeKey);
        edges.push({
          source: rel.source_id,
          target: rel.target_id,
          relation_type: rel.relation_type,
          confidence: rel.confidence,
        });
      }

      // 방문하지 않은 노드면 큐에 추가
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        const neighborMem = getMemoryByIdSafe(db, neighborId);
        if (neighborMem) {
          nodes.push({ id: neighborMem.id, title: neighborMem.title, type: neighborMem.type });
          queue.push([neighborId, currentDepth + 1]);
        }
      }
    }
  }

  return { nodes, edges };
}

// ── Exports ──────────────────────────────────────────────

module.exports = {
  inferRelations,
  getRelationGraph,
  ensureRelationsTable,
};
