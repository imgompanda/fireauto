// ── fireauto-mem Worker v2 ── Express HTTP server for memory system ──
// Usage: node worker.cjs start | stop

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const {
  MEM_PORT,
  getDbPath,
  nowEpoch,
} = require('./types.cjs');

const PORT = MEM_PORT; // 37888

let db = null;
let dbPath = null;
const sseClients = new Set();

// ── DB module (loaded at runtime) ─────────────────────────────
let dbMod = null;
function loadDbModule() {
  if (!dbMod) dbMod = require('./db.cjs');
  return dbMod;
}

// ── SDK Agent module (lazy, graceful if absent) ───────────────
let sdkAgentMod;
let sdkAgentLoaded = false;
function loadSdkAgent() {
  if (sdkAgentLoaded) return sdkAgentMod;
  sdkAgentLoaded = true;
  try {
    sdkAgentMod = require('./sdk-agent.cjs');
    return sdkAgentMod;
  } catch {
    sdkAgentMod = null;
    return null;
  }
}

// ── Relations module (lazy, graceful if absent) ───────────────
let relationsMod = null;
let relationsModLoaded = false;
function loadRelations() {
  if (relationsModLoaded) return relationsMod;
  relationsModLoaded = true;
  try {
    relationsMod = require('./relations.cjs');
  } catch {
    relationsMod = null;
  }
  return relationsMod;
}

// ── Health-check module (lazy, graceful if absent) ────────────
let healthCheckMod = null;
let healthCheckModLoaded = false;
function loadHealthCheck() {
  if (healthCheckModLoaded) return healthCheckMod;
  healthCheckModLoaded = true;
  try {
    healthCheckMod = require('./health-check.cjs');
  } catch {
    healthCheckMod = null;
  }
  return healthCheckMod;
}

// ── Project Manager module (lazy, graceful if absent) ─────────
let projectMgrMod;
let projectMgrLoaded = false;
function loadProjectManager() {
  if (projectMgrLoaded) return projectMgrMod;
  projectMgrLoaded = true;
  try {
    projectMgrMod = require('./project-manager.cjs');
    return projectMgrMod;
  } catch {
    projectMgrMod = null;
    return null;
  }
}

// ── Wiki Manager module (lazy, graceful if absent) ────────────
let wikiMgrLoaded = false;
let wikiMgr;
function loadWikiManager() {
  if (wikiMgrLoaded) return wikiMgr;
  wikiMgrLoaded = true;
  try { wikiMgr = require('./wiki-manager.cjs'); } catch { wikiMgr = null; }
  return wikiMgr;
}

// ── Self-Learner module (lazy, graceful if absent) ────────────
let selfLearnerMod;
let selfLearnerLoaded = false;
function loadSelfLearner() {
  if (selfLearnerLoaded) return selfLearnerMod;
  selfLearnerLoaded = true;
  try { selfLearnerMod = require('./self-learner.cjs'); } catch { selfLearnerMod = null; }
  return selfLearnerMod;
}

// ── AI-enriched memory update ─────────────────────────────────
function updateMemoryWithAI(db, id, aiResult) {
  try {
    db.run(
      `UPDATE memories SET
        subtitle = COALESCE(?, subtitle),
        narrative = COALESCE(?, narrative),
        facts = COALESCE(?, facts),
        concepts = COALESCE(?, concepts),
        type = COALESCE(?, type)
      WHERE id = ?`,
      [
        aiResult.subtitle || null,
        aiResult.narrative || null,
        JSON.stringify(aiResult.facts || []),
        JSON.stringify(aiResult.concepts || []),
        aiResult.type || null,
        id,
      ]
    );
    // 관계 추론 (fire-and-forget)
    try {
      const relations = loadRelations();
      if (relations && relations.inferRelations) {
        relations.inferRelations(db, id);
      }
    } catch {}
  } catch (err) {
    console.error('[fireauto-mem] updateMemoryWithAI error:', err.message);
  }
}

// ── SSE ───────────────────────────────────────────────────────
function broadcast(event) {
  const data = JSON.stringify(event);
  const msg = `data: ${data}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── Server ────────────────────────────────────────────────────
async function startServer() {
  const {
    initDb,
    saveDb,
    insertMemory,
    getMemoryById,
    searchMemories,
    listMemories,
    getMemoriesByIds,
    initSession,
    completeSession,
    insertSummary,
    getSessions,
    getSummaries,
    getTimeline,
    getStats,
  } = loadDbModule();

  dbPath = getDbPath();
  console.error(`[fireauto-mem] DB path: ${dbPath}`);

  db = await initDb(dbPath);
  console.error('[fireauto-mem] DB initialized');

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── GET /api/health ───────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ── GET /api/memories ─────────────────────────────────────
  app.get('/api/memories', async (req, res) => {
    try {
      const { q, type, project, limit } = req.query;
      const lim = parseInt(limit, 10) || 50;
      let memories;
      if (q) {
        memories = searchMemories(db, { query: q, type, project, limit: lim });
      } else {
        memories = listMemories(db, { type, project, limit: lim });
      }
      res.json({ memories });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/memories error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/memories/:id ─────────────────────────────────
  app.get('/api/memories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const memory = await getMemoryById(db, id);
      if (!memory) return res.status(404).json({ error: 'Not found' });
      res.json({ memory });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/memories/:id error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/memories ────────────────────────────────────
  app.post('/api/memories', async (req, res) => {
    try {
      const { session_id, project, type, title, content, tags, files_involved } = req.body;
      if (!session_id || !project || !type || !title || !content) {
        return res.status(400).json({ error: 'Missing required fields: session_id, project, type, title, content' });
      }
      // 1. raw 데이터 즉시 DB 저장 (v1 호환)
      const id = await insertMemory(db, {
        session_id,
        project,
        type,
        title,
        content,
        tags: tags || [],
        files_involved: files_involved || [],
      });
      broadcast({
        event: 'new_memory',
        data: { id, session_id, project, type, title, created_at_epoch: nowEpoch() },
      });
      res.json({ id });

      // 1.5 관계 추론 (SDK와 별개로 즉시 실행)
      try {
        const rels = loadRelations();
        if (rels && rels.inferRelations) {
          const inferred = rels.inferRelations(db, id);
          if (inferred.length > 0) {
            console.error('[fireauto-mem] 관계 ' + inferred.length + '건 추론 (메모리 #' + id + ')');
          }
        }
      } catch (e) { console.error('[fireauto-mem] 관계 추론 에러:', e.message); }

      // 2. 비동기로 SDK Agent에 구조화 요청 (fire-and-forget)
      try {
        const sdkAgent = loadSdkAgent();
        if (sdkAgent) {
          const result = await sdkAgent.processObservation({
            tool_name: title?.split(':')[0] || 'unknown',
            tool_input: content,
            tool_output: '',
            session_id,
            project,
          });
          // AI가 구조화한 결과로 메모리 업데이트
          if (result.observations?.length > 0) {
            const obs = result.observations[0];
            updateMemoryWithAI(db, id, obs);
            // AI 필드 포함하여 SSE 업데이트 브로드캐스트
            broadcast({
              event: 'memory_enriched',
              data: { id, subtitle: obs.subtitle, narrative: obs.narrative, type: obs.type },
            });
          }
        }
      } catch (err) {
        console.error('[fireauto-mem] SDK 처리 실패 (무시):', err.message);
      }
    } catch (err) {
      console.error('[fireauto-mem] POST /api/memories error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/memories/:id/related ─────────────────────────
  app.get('/api/memories/:id/related', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const depth = parseInt(req.query.depth, 10) || 1;
      const relations = loadRelations();
      if (!relations || !relations.getRelationGraph) {
        return res.json({ graph: [], message: 'relations module not available' });
      }
      const graph = relations.getRelationGraph(db, id, depth);
      res.json({ graph });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/memories/:id/related error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/compile ────────────────────────────────────
  app.post('/api/compile', async (req, res) => {
    try {
      const { project, format } = req.body;
      if (!project) {
        return res.status(400).json({ error: 'Missing required field: project' });
      }
      const sdkAgent = loadSdkAgent();
      if (!sdkAgent) {
        return res.status(503).json({ error: 'SDK Agent not available' });
      }
      // 해당 프로젝트의 메모리 조회
      const memories = listMemories(db, { project, limit: 200 });
      if (!memories.length) {
        return res.json({ markdown: `# ${project}\n\nNo memories found.` });
      }
      // 풀 메모리 데이터 조회
      const fullMemories = await getMemoriesByIds(db, memories.map(m => m.id));
      const result = await sdkAgent.generateSummary(fullMemories);
      if (result.summary) {
        const md = [
          `# ${project} — Compiled Summary`,
          '',
          `## Request`,
          result.summary.request || 'N/A',
          '',
          `## Completed`,
          result.summary.completed || 'N/A',
          '',
          `## Learned`,
          result.summary.learned || 'N/A',
          '',
          `## Next Steps`,
          result.summary.next_steps || 'N/A',
        ].join('\n');
        return res.json({ markdown: md, format: format || 'markdown' });
      }
      res.json({ markdown: `# ${project}\n\nCompilation produced no results.` });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/compile error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════
  // ── Project Management API ─────────────────────────────
  // ══════════════════════════════════════════════════════════

  // ── Helper: rowsToObjects for raw db.exec results ──────
  function _rows(results) {
    if (!results.length || !results[0].values.length) return [];
    const cols = results[0].columns;
    return results[0].values.map((row) => {
      const obj = {};
      cols.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
  }

  // ── GET /api/projects ─────────────────────────────────
  app.get('/api/projects', async (_req, res) => {
    try {
      const pm = loadProjectManager();
      if (pm && pm.listProjects) {
        return res.json({ projects: pm.listProjects(db) });
      }
      // fallback: direct DB query
      const projects = _rows(db.exec(
        'SELECT * FROM projects ORDER BY created_at_epoch DESC'
      ));
      res.json({ projects });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/projects error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/projects/:id ─────────────────────────────
  app.get('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

      const pm = loadProjectManager();
      if (pm && pm.getProjectDetail) {
        const detail = pm.getProjectDetail(db, id);
        if (!detail) return res.status(404).json({ error: 'Not found' });
        return res.json(detail);
      }
      // fallback: direct DB query with milestones + tasks + progress
      const projects = _rows(db.exec('SELECT * FROM projects WHERE id = ?', [id]));
      if (!projects.length) return res.status(404).json({ error: 'Not found' });
      const project = projects[0];

      const milestones = _rows(db.exec(
        'SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, id ASC', [id]
      ));
      const tasks = _rows(db.exec(
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY id ASC', [id]
      ));

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      res.json({ project, milestones, tasks, progress });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/projects/:id error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/projects ────────────────────────────────
  app.post('/api/projects', async (req, res) => {
    try {
      const { name, description, prd_path, milestones } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing required field: name' });

      const pm = loadProjectManager();

      // milestones가 있고 project-manager가 있으면 createProjectFromPRD 사용
      if (milestones && pm && pm.createProjectFromPRD) {
        const result = pm.createProjectFromPRD(db, { name, description, prd_path, milestones });
        broadcast({ event: 'project_updated', data: { id: result.id, name, action: 'created' } });
        return res.json(result);
      }

      if (pm && pm.createProject) {
        const result = pm.createProject(db, { name, description, prd_path });
        broadcast({ event: 'project_updated', data: { id: result.id, name, action: 'created' } });
        return res.json(result);
      }

      // fallback: direct DB insert
      const epoch = nowEpoch();
      db.run(
        `INSERT INTO projects (name, description, prd_path, status, created_at_epoch)
         VALUES (?, ?, ?, 'active', ?)`,
        [name, description || null, prd_path || null, epoch]
      );
      const result = db.exec('SELECT last_insert_rowid() as id');
      const id = result[0].values[0][0];

      broadcast({ event: 'project_updated', data: { id, name, action: 'created' } });
      res.json({ id });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/projects error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/projects/:id ───────────────────────────
  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Missing required field: status' });

      const pm = loadProjectManager();
      if (pm && pm.updateProjectStatus) {
        pm.updateProjectStatus(db, id, status);
      } else {
        db.run('UPDATE projects SET status = ? WHERE id = ?', [status, id]);
        if (db.getRowsModified() === 0) return res.status(404).json({ error: 'Not found' });
      }

      broadcast({ event: 'project_updated', data: { id, status, action: 'status_changed' } });
      res.json({ ok: true });
    } catch (err) {
      console.error('[fireauto-mem] PATCH /api/projects/:id error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/projects/:projectId/milestones ───────────
  app.get('/api/projects/:projectId/milestones', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

      const pm = loadProjectManager();
      if (pm && pm.listMilestones) {
        return res.json({ milestones: pm.listMilestones(db, projectId) });
      }
      const milestones = _rows(db.exec(
        'SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, id ASC',
        [projectId]
      ));
      res.json({ milestones });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/projects/:projectId/milestones error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/milestones/:id ─────────────────────────
  app.patch('/api/milestones/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Missing required field: status' });

      const pm = loadProjectManager();
      if (pm && pm.updateMilestoneStatus) {
        pm.updateMilestoneStatus(db, id, status);
      } else {
        db.run('UPDATE milestones SET status = ? WHERE id = ?', [status, id]);
        if (db.getRowsModified() === 0) return res.status(404).json({ error: 'Not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[fireauto-mem] PATCH /api/milestones/:id error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/projects/:projectId/tasks ────────────────
  app.get('/api/projects/:projectId/tasks', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

      const pm = loadProjectManager();
      if (pm && pm.listTasks) {
        return res.json({ tasks: pm.listTasks(db, projectId) });
      }
      const tasks = _rows(db.exec(
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY id ASC',
        [projectId]
      ));
      res.json({ tasks });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/projects/:projectId/tasks error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/tasks/next ───────────────────────────────
  app.get('/api/tasks/next', async (req, res) => {
    try {
      const { projectId } = req.query;

      const pm = loadProjectManager();
      if (pm && pm.getNextTask) {
        const task = pm.getNextTask(db, projectId ? parseInt(projectId, 10) : undefined);
        return res.json({ task: task || null });
      }
      // fallback: first pending task ordered by id
      let sql = "SELECT * FROM tasks WHERE status = 'pending'";
      const params = [];
      if (projectId) {
        sql += ' AND project_id = ?';
        params.push(parseInt(projectId, 10));
      }
      sql += ' ORDER BY id ASC LIMIT 1';
      const tasks = _rows(db.exec(sql, params));
      res.json({ task: tasks[0] || null });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/tasks/next error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/tasks/:id ──────────────────────────────
  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const { status, assignee } = req.body;
      if (!status && !assignee) {
        return res.status(400).json({ error: 'At least one of status or assignee required' });
      }

      const pm = loadProjectManager();
      if (pm && pm.updateTask) {
        pm.updateTask(db, id, { status, assignee });
      } else {
        // fallback: direct DB update
        const sets = [];
        const params = [];
        if (status) { sets.push('status = ?'); params.push(status); }
        if (assignee) { sets.push('assignee = ?'); params.push(assignee); }
        params.push(id);
        db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
        if (db.getRowsModified() === 0) return res.status(404).json({ error: 'Not found' });
      }

      broadcast({ event: 'task_updated', data: { id, status, assignee, action: 'updated' } });
      res.json({ ok: true });
    } catch (err) {
      console.error('[fireauto-mem] PATCH /api/tasks/:id error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/dashboard ────────────────────────────────
  app.get('/api/dashboard', async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId, 10) : null;

      // project-manager 시도
      const pm = loadProjectManager();
      if (pm && pm.getProjectDashboard) {
        const dashboard = pm.getProjectDashboard(db, projectId);
        return res.json(dashboard);
      }

      // fallback: 직접 SQL로 마일스톤-태스크 중첩 구조 생성
      // 1. 프로젝트 조회
      const projects = _rows(db.exec(
        projectId
          ? 'SELECT * FROM projects WHERE id = ?'
          : "SELECT * FROM projects WHERE status = 'active' ORDER BY created_at_epoch DESC LIMIT 1",
        projectId ? [projectId] : []
      ));
      if (!projects.length) return res.json({ error: 'No project found' });
      const project = projects[0];

      // 2. 마일스톤 + 태스크 중첩
      const milestones = _rows(db.exec(
        'SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, id ASC',
        [project.id]
      ));
      let totalTasks = 0, completedTasks = 0;

      for (const m of milestones) {
        m.tasks = _rows(db.exec(
          'SELECT * FROM tasks WHERE milestone_id = ? ORDER BY order_index ASC, id ASC',
          [m.id]
        ));
        const done = m.tasks.filter(t => t.status === 'completed').length;
        m.progress = m.tasks.length ? Math.round(done / m.tasks.length * 100) : 0;
        totalTasks += m.tasks.length;
        completedTasks += done;
      }

      res.json({
        project,
        overall_progress: totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0,
        milestones,
      });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/dashboard error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════
  // ── Wiki API ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  // ── GET /api/wiki/index ──────────────────────────────────
  app.get('/api/wiki/index', async (_req, res) => {
    try {
      const wm = loadWikiManager();
      if (!wm) return res.status(503).json({ error: 'wiki-manager module not available' });
      const pages = wm.listPages();
      const index = wm.readPage('index');
      res.json({ pages, index });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/wiki/index error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/wiki/search ─────────────────────────────────
  app.get('/api/wiki/search', async (req, res) => {
    try {
      const wm = loadWikiManager();
      if (!wm) return res.status(503).json({ error: 'wiki-manager module not available' });
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: 'Missing query parameter: q' });
      const results = wm.searchWiki(q);
      res.json({ results });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/wiki/search error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/wiki/:page ──────────────────────────────────
  app.get('/api/wiki/:page', async (req, res) => {
    try {
      const wm = loadWikiManager();
      if (!wm) return res.status(503).json({ error: 'wiki-manager module not available' });
      const content = wm.readPage(req.params.page);
      if (content === null || content === undefined) {
        return res.status(404).json({ error: 'Page not found' });
      }
      res.json({ page: req.params.page, content });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/wiki/:page error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/wiki ───────────────────────────────────────
  app.post('/api/wiki', async (req, res) => {
    try {
      const wm = loadWikiManager();
      if (!wm) return res.status(503).json({ error: 'wiki-manager module not available' });
      const { page, content } = req.body;
      if (!page || !content) return res.status(400).json({ error: 'Missing required fields: page, content' });
      wm.writePage(page, content);
      broadcast({ event: 'wiki_updated', data: { page } });
      res.json({ ok: true, page });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/wiki error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════
  // ── Skills API ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  // ── GET /api/skills ──────────────────────────────────────
  app.get('/api/skills', async (req, res) => {
    try {
      const { q, category } = req.query;
      const { searchSkills: dbSearchSkills } = loadDbModule();
      const skills = dbSearchSkills(db, { query: q, category, limit: 50 });
      // 검색 결과가 있으면 사용 횟수 증가
      if (q && skills.length > 0) {
        try {
          const { incrementSkillUsage } = loadDbModule();
          skills.forEach(s => incrementSkillUsage(db, s.id));
        } catch {}
      }
      res.json({ skills });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/skills error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/skills ─────────────────────────────────────
  app.post('/api/skills', async (req, res) => {
    try {
      const { name, description, content, category } = req.body;
      if (!name || !content) return res.status(400).json({ error: 'Missing required fields: name, content' });

      // 1. DB에 저장
      const { saveSkill: dbSaveSkill } = loadDbModule();
      const id = dbSaveSkill(db, { name, description, content, category });

      // 2. 글로벌 스킬 파일도 생성 (~/.claude/skills/{name}/SKILL.md)
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const safeName = name.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const skillDir = path.join(os.homedir(), '.claude', 'skills', safeName);
        if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
        const skillContent = [
          '---',
          'name: ' + safeName,
          'description: >',
          '  ' + (description || name) + '.',
          '  "' + name + '", "' + (category || '') + '" 등에 트리거.',
          '---',
          '',
          '# ' + name,
          '',
          description ? description + '\n' : '',
          content,
          '',
        ].join('\n');
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');
        console.error('[fireauto-mem] 스킬 파일 생성: ~/.claude/skills/' + safeName + '/SKILL.md');
      } catch (fileErr) {
        console.error('[fireauto-mem] 스킬 파일 생성 실패 (DB 저장은 성공):', fileErr.message);
      }

      broadcast({ event: 'skill_saved', data: { id, name, category } });
      res.json({ id });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/skills error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════
  // ── Mistakes API ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  // ── GET /api/mistakes ────────────────────────────────────
  app.get('/api/mistakes', async (req, res) => {
    try {
      const { q, project } = req.query;
      const { searchMistakes: dbSearchMistakes, listMistakes: dbListMistakes } = loadDbModule();
      let mistakes;
      if (q) {
        mistakes = dbSearchMistakes(db, { query: q, project, limit: 50 });
      } else {
        mistakes = dbListMistakes(db, { project, limit: 50 });
      }
      res.json({ mistakes });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/mistakes error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/mistakes ───────────────────────────────────
  app.post('/api/mistakes', async (req, res) => {
    try {
      const { description, cause, fix, prevention, severity, project } = req.body;
      if (!description || !project) return res.status(400).json({ error: 'Missing required fields: description, project' });
      const { logMistake: dbLogMistake } = loadDbModule();
      const id = dbLogMistake(db, { project, description, cause, fix, prevention, severity });
      broadcast({ event: 'mistake_logged', data: { id, project, severity } });
      res.json({ id });

      // 후처리: Wiki gotchas.md 업데이트 + CLAUDE.md 규칙 추가 (fire-and-forget)
      try {
        const wm = loadWikiManager();
        if (wm) {
          const existing = wm.readPage('gotchas') || '# 주의사항\n';
          const entry = '\n## ' + (description || '').slice(0, 50) + '\n'
            + (cause ? '- 원인: ' + cause + '\n' : '')
            + (fix ? '- 수정: ' + fix + '\n' : '')
            + (prevention ? '- 방지: ' + prevention + '\n' : '')
            + '- 심각도: ' + (severity || 'medium') + '\n';
          wm.writePage('gotchas', existing + entry);
          console.error('[fireauto-mem] gotchas.md 업데이트 완료');
        }
      } catch (wikiErr) { console.error('[fireauto-mem] gotchas wiki 실패:', wikiErr.message); }

      // CLAUDE.md에 방지 규칙 추가
      if (prevention) {
        try {
          const sl = loadSelfLearner();
          if (sl && sl.addClaudeMdRule) {
            sl.addClaudeMdRule(process.cwd(), '- ⚠️ ' + prevention);
            console.error('[fireauto-mem] CLAUDE.md 규칙 추가: ' + prevention);
          }
        } catch (clErr) { console.error('[fireauto-mem] CLAUDE.md 규칙 추가 실패:', clErr.message); }
      }
    } catch (err) {
      console.error('[fireauto-mem] POST /api/mistakes error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════
  // ── Retrospect API ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  // ── POST /api/retrospect ─────────────────────────────────
  app.post('/api/retrospect', async (req, res) => {
    try {
      const sl = loadSelfLearner();
      if (!sl) return res.status(503).json({ error: 'self-learner module not available' });
      const { project } = req.body;
      const result = sl.runRetrospect(db, project);
      broadcast({ event: 'retrospect_done', data: { project, learnings: result.learnings?.length || 0 } });
      res.json(result);
    } catch (err) {
      console.error('[fireauto-mem] POST /api/retrospect error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════

  // ── GET /api/health-check ────────────────────────────────
  app.get('/api/health-check', async (req, res) => {
    try {
      const { project } = req.query;
      const healthCheck = loadHealthCheck();
      if (!healthCheck || !healthCheck.runHealthCheck) {
        return res.json({ issues: [], message: 'health-check module not available' });
      }
      const issues = healthCheck.runHealthCheck(db, project);
      res.json({ issues });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/health-check error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/memories/batch ──────────────────────────────
  app.post('/api/memories/batch', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
      const memories = await getMemoriesByIds(db, ids);
      res.json({ memories });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/memories/batch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/sessions ─────────────────────────────────────
  app.get('/api/sessions', async (req, res) => {
    try {
      const { project, limit } = req.query;
      const sessions = await getSessions(db, { project, limit: parseInt(limit, 10) || 50 });
      res.json({ sessions });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/sessions error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/sessions/init ───────────────────────────────
  app.post('/api/sessions/init', async (req, res) => {
    try {
      const { session_id, project } = req.body;
      if (!session_id || !project) {
        return res.status(400).json({ error: 'Missing required fields: session_id, project' });
      }
      const session = await initSession(db, { session_id, project });
      res.json({ session });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/sessions/init error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/sessions/summarize ──────────────────────────
  app.post('/api/sessions/summarize', async (req, res) => {
    try {
      let { session_id, project, request, what_done, what_learned, next_steps } = req.body;
      if (!session_id || !project) {
        return res.status(400).json({ error: 'Missing required fields: session_id, project' });
      }

      // SDK Agent로 AI 요약 생성 (v2)
      try {
        const sdkAgent = loadSdkAgent();
        if (sdkAgent) {
          const memories = listMemories(db, { project, limit: 100 });
          if (memories.length > 0) {
            const fullMemories = await getMemoriesByIds(db, memories.map(m => m.id));
            const result = await sdkAgent.generateSummary(fullMemories);
            if (result.summary) {
              request = result.summary.request || request;
              what_done = result.summary.completed || what_done;
              what_learned = result.summary.learned || what_learned;
              next_steps = result.summary.next_steps || next_steps;
            }
          }
        }
      } catch (err) {
        console.error('[fireauto-mem] 요약 생성 실패:', err.message);
      }

      // Complete the session
      await completeSession(db, session_id);
      // Insert summary
      const id = await insertSummary(db, {
        session_id,
        project,
        request: request || '',
        what_done: what_done || '',
        what_learned: what_learned || '',
        next_steps: next_steps || '',
      });
      broadcast({
        event: 'new_summary',
        data: { id, session_id, project, created_at_epoch: nowEpoch() },
      });
      res.json({ id });
    } catch (err) {
      console.error('[fireauto-mem] POST /api/sessions/summarize error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/summaries ────────────────────────────────────
  app.get('/api/summaries', async (req, res) => {
    try {
      const { project, limit } = req.query;
      const summaries = await getSummaries(db, { project, limit: parseInt(limit, 10) || 50 });
      res.json({ summaries });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/summaries error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/timeline ─────────────────────────────────────
  app.get('/api/timeline', async (req, res) => {
    try {
      const { days, project } = req.query;
      const entries = await getTimeline(db, {
        days: parseInt(days, 10) || 7,
        project,
      });
      res.json({ entries });
    } catch (err) {
      console.error('[fireauto-mem] GET /api/timeline error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/stats ────────────────────────────────────────
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await getStats(db);
      res.json(stats);
    } catch (err) {
      console.error('[fireauto-mem] GET /api/stats error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /stream (SSE) ─────────────────────────────────────
  app.get('/stream', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    sseClients.add(res);

    // Send initial load event
    try {
      const stats = await getStats(db);
      const sessions = await getSessions(db, { limit: 10 });
      const projects = [...new Set(sessions.map((s) => s.project).filter(Boolean))];
      res.write(`data: ${JSON.stringify({ event: 'initial_load', data: { projects, stats } })}\n\n`);
    } catch (err) {
      console.error('[fireauto-mem] SSE initial_load error:', err.message);
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ── GET / (UI) ────────────────────────────────────────────
  app.get('/', (_req, res) => {
    const viewerPath = path.join(__dirname, 'ui', 'viewer.html');
    fs.readFile(viewerPath, 'utf-8', (err, html) => {
      if (err) {
        console.error('[fireauto-mem] UI file not found:', viewerPath);
        return res.status(404).send('UI not found. Place viewer.html in ui/ directory.');
      }
      res.type('html').send(html);
    });
  });

  // ── POST /api/shutdown (internal) ─────────────────────────
  app.post('/api/shutdown', (_req, res) => {
    res.json({ status: 'shutting_down' });
    gracefulShutdown();
  });

  // ── Periodic DB save ──────────────────────────────────────
  const saveInterval = setInterval(() => {
    try {
      saveDb(db, dbPath);
    } catch (err) {
      console.error('[fireauto-mem] Periodic save error:', err.message);
    }
  }, 30000);

  // ── Graceful shutdown ─────────────────────────────────────
  function gracefulShutdown() {
    console.error('[fireauto-mem] Shutting down...');
    clearInterval(saveInterval);
    // Close all SSE clients
    for (const client of sseClients) {
      try { client.end(); } catch { /* ignore */ }
    }
    sseClients.clear();
    // SDK Agent cleanup
    try {
      const sdkAgent = loadSdkAgent();
      if (sdkAgent && sdkAgent.shutdown) sdkAgent.shutdown();
    } catch { /* ignore */ }
    // Final save
    try {
      saveDb(db, dbPath);
      console.error('[fireauto-mem] Final DB save complete');
    } catch (err) {
      console.error('[fireauto-mem] Final save error:', err.message);
    }
    process.exit(0);
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // ── Start listening ───────────────────────────────────────
  app.listen(PORT, () => {
    console.error(`[fireauto-mem] Worker running on http://localhost:${PORT}`);
  });
}

// ── CLI: stop ─────────────────────────────────────────────────
function stopServer() {
  const postData = JSON.stringify({});
  const req = http.request(
    {
      hostname: 'localhost',
      port: PORT,
      path: '/api/shutdown',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 3000,
    },
    (res) => {
      console.error(`[fireauto-mem] Shutdown response: ${res.statusCode}`);
      process.exit(0);
    },
  );
  req.on('error', (err) => {
    console.error(`[fireauto-mem] Could not reach worker (already stopped?): ${err.message}`);
    process.exit(1);
  });
  req.write(postData);
  req.end();
}

// ── CLI entrypoint ────────────────────────────────────────────
const cmd = process.argv[2];
if (cmd === 'start') {
  startServer().catch((err) => {
    console.error('[fireauto-mem] Failed to start:', err.message);
    process.exit(1);
  });
} else if (cmd === 'stop') {
  stopServer();
} else {
  console.error('Usage: node worker.cjs <start|stop>');
  process.exit(1);
}
