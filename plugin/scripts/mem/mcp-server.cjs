#!/usr/bin/env node
'use strict';

// ── fireauto-mem MCP Server ── stdio transport, delegates to Worker HTTP API ──

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const http = require('http');
const { MEM_PORT, MEMORY_TYPES, getProjectName } = require('./types.cjs');

const WORKER_URL = `http://localhost:${MEM_PORT}`;
const LOG_PREFIX = '[fireauto-mem MCP]';

// ── Worker HTTP helper ───────────────────────────────────────

/**
 * @param {'GET'|'POST'} method
 * @param {string} path - e.g. '/api/memories?q=foo'
 * @param {object} [body]
 * @returns {Promise<any>}
 */
function callWorker(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, WORKER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Worker request timed out'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Build a query string from an object, omitting undefined/null values.
 * @param {Record<string, any>} params
 * @returns {string}
 */
function qs(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Wrap a tool handler with Worker error handling.
 * Returns MCP-compliant content on success, or isError content on failure.
 */
async function safeCall(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = err.code === 'ECONNREFUSED'
      ? 'Worker 서버에 연결할 수 없습니다. `node worker.cjs start`로 Worker를 먼저 실행하세요.'
      : `Worker 오류: ${err.message}`;
    console.error(LOG_PREFIX, msg);
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
}

// ── Parent process heartbeat (zombie prevention) ──────────────

const parentPid = process.ppid;
const heartbeatTimer = setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    console.error(LOG_PREFIX, '부모 프로세스 종료 감지 — MCP 서버를 종료합니다.');
    clearInterval(heartbeatTimer);
    process.exit(0);
  }
}, 30000);
heartbeatTimer.unref();

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const server = new McpServer({
    name: 'fireauto-mem',
    version: '1.0.0',
  });

  // ── memory-search ─────────────────────────────────────────
  server.tool(
    'memory-search',
    '프로젝트 메모리를 검색합니다. 키워드, 타입, 프로젝트로 필터링 가능.',
    {
      query: z.string().describe('검색 키워드'),
      type: z.string().optional().describe('메모리 타입 필터 (decision, bugfix, feature, pattern, gotcha, refactor)'),
      project: z.string().optional().describe('프로젝트명 필터'),
      limit: z.number().optional().default(20).describe('결과 수 제한'),
    },
    async ({ query, type, project, limit }) => {
      return safeCall(async () => {
        const path = '/api/memories' + qs({ q: query, type, project, limit });
        const result = await callWorker('GET', path);

        if (!result.memories || result.memories.length === 0) {
          return { content: [{ type: 'text', text: `"${query}"에 대한 검색 결과가 없습니다.` }] };
        }

        const lines = result.memories.map((m) =>
          `[${m.id}] ${m.title} (${m.type}) — ${m.created_at || ''}`,
        );
        const text = `검색 결과 ${result.memories.length}건:\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── memory-timeline ───────────────────────────────────────
  server.tool(
    'memory-timeline',
    '최근 활동 타임라인을 조회합니다.',
    {
      days: z.number().optional().default(7).describe('조회 기간 (일)'),
      project: z.string().optional().describe('프로젝트명 필터'),
    },
    async ({ days, project }) => {
      return safeCall(async () => {
        const path = '/api/timeline' + qs({ days, project });
        const result = await callWorker('GET', path);

        if (!result.entries || result.entries.length === 0) {
          return { content: [{ type: 'text', text: `최근 ${days}일간 활동 기록이 없습니다.` }] };
        }

        const lines = result.entries.map((e) =>
          `${e.created_at || e.date || ''} | ${e.type || ''} | ${e.title || e.summary || ''}`,
        );
        const text = `최근 ${days}일 타임라인 (${result.entries.length}건):\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── memory-save ───────────────────────────────────────────
  server.tool(
    'memory-save',
    '새 메모리를 수동으로 저장합니다.',
    {
      title: z.string().describe('메모리 제목'),
      content: z.string().describe('메모리 내용'),
      type: z.enum(MEMORY_TYPES).describe('메모리 타입'),
      tags: z.array(z.string()).optional().describe('태그 목록'),
    },
    async ({ title, content, type, tags }) => {
      return safeCall(async () => {
        const body = {
          session_id: `mcp-manual-${Date.now()}`,
          project: getProjectName(),
          type,
          title,
          content,
          tags: tags || [],
        };
        const result = await callWorker('POST', '/api/memories', body);

        if (result.error) {
          return { content: [{ type: 'text', text: `저장 실패: ${result.error}` }], isError: true };
        }

        return { content: [{ type: 'text', text: `메모리 저장 완료 (ID: ${result.id})` }] };
      });
    },
  );

  // ── memory-detail ─────────────────────────────────────────
  server.tool(
    'memory-detail',
    '메모리 ID로 상세 내용을 조회합니다. memory-search 결과의 ID를 사용하세요.',
    {
      ids: z.array(z.number()).describe('조회할 메모리 ID 목록'),
    },
    async ({ ids }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/memories/batch', { ids });

        if (!result.memories || result.memories.length === 0) {
          return { content: [{ type: 'text', text: '해당 ID의 메모리를 찾을 수 없습니다.' }] };
        }

        const blocks = result.memories.map((m) =>
          [
            `── [${m.id}] ${m.title} ──`,
            `타입: ${m.type} | 프로젝트: ${m.project || '-'}`,
            `생성: ${m.created_at || '-'}`,
            m.tags ? `태그: ${Array.isArray(m.tags) ? m.tags.join(', ') : m.tags}` : null,
            '',
            m.content,
          ]
            .filter(Boolean)
            .join('\n'),
        );

        return { content: [{ type: 'text', text: blocks.join('\n\n') }] };
      });
    },
  );

  // ── Connect ───────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(LOG_PREFIX, 'MCP 서버가 시작되었습니다 (stdio)');
}

main().catch((err) => {
  console.error(LOG_PREFIX, 'Fatal:', err);
  process.exit(1);
});
