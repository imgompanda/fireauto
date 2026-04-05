// ── fireauto-mem Worker ── Express HTTP server for memory system ──
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
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    } catch (err) {
      console.error('[fireauto-mem] POST /api/memories error:', err.message);
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
      const { session_id, project, request, what_done, what_learned, next_steps } = req.body;
      if (!session_id || !project) {
        return res.status(400).json({ error: 'Missing required fields: session_id, project' });
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
