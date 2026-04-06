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
 * @param {'GET'|'POST'|'PATCH'} method
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

        const lines = result.entries.map((e) => {
          const d = e.data || e;
          return `${d.created_at || d.date || ''} | ${d.type || ''} | ${d.title || d.summary || ''}`;
        });
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

  // ── memory-related ────────────────────────────────────────
  server.tool(
    'memory-related',
    '특정 메모리와 관련된 메모리를 조회합니다. 메모리 간 관계 그래프를 탐색해요.',
    {
      id: z.number().describe('메모리 ID'),
      depth: z.number().optional().default(1).describe('탐색 깊이 (기본 1, 최대 3)'),
    },
    async ({ id, depth }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', `/api/memories/${id}/related${qs({ depth: Math.min(depth, 3) })}`);

        const graph = result.graph || {};
        const nodes = graph.nodes || [];
        if (!nodes.length) {
          return { content: [{ type: 'text', text: `메모리 #${id}와 관련된 메모리가 없습니다.` }] };
        }

        const lines = nodes.map((m) =>
          `[${m.id}] ${m.title} (${m.type}) — 관련도: ${m.relevance || '-'}`,
        );
        const text = `메모리 #${id} 관련 ${nodes.length}건 (깊이 ${depth}):\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── memory-compile ───────────────────────────────────────
  server.tool(
    'memory-compile',
    '프로젝트의 메모리를 종합하여 구조화된 지식 문서로 컴파일합니다.',
    {
      project: z.string().optional().describe('프로젝트명 (생략시 현재 프로젝트)'),
      format: z.enum(['wiki', 'summary', 'lessons']).optional().default('wiki').describe('출력 형식'),
    },
    async ({ project, format }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/compile', {
          project: project || getProjectName(),
          format,
        });

        if (result.error) {
          return { content: [{ type: 'text', text: `컴파일 실패: ${result.error}` }], isError: true };
        }

        const text = result.document || result.content || JSON.stringify(result, null, 2);
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── project-status ──────────────────────────────────────
  server.tool(
    'project-status',
    '현재 프로젝트 진행 상황을 보여줍니다. 마일스톤, 태스크, 진행률을 한눈에.',
    {
      projectId: z.number().optional().describe('프로젝트 ID (생략시 최근 활성 프로젝트)'),
    },
    async ({ projectId }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/dashboard' + qs({ projectId }));

        if (result.error) {
          return { content: [{ type: 'text', text: `조회 실패: ${result.error}` }], isError: true };
        }

        const lines = [];

        // 프로젝트 정보
        const proj = result.project || (result.projects && result.projects[0]);
        if (proj) {
          const p = proj;
          lines.push(`## ${p.name}${p.description ? ' — ' + p.description : ''}`);
          lines.push(`상태: ${p.status || '-'} | 진행률: ${result.progress || 0}%`);
          lines.push('');
        } else if (!projectId) {
          // 전체 프로젝트 목록
          if (result.projects && result.projects.length > 0) {
            lines.push('## 프로젝트 목록');
            for (const p of result.projects) {
              lines.push(`- [${p.id}] ${p.name} (${p.status || '-'})`);
            }
          } else {
            lines.push('등록된 프로젝트가 없습니다.');
          }
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }

        // 마일스톤
        if (result.milestones && result.milestones.length > 0) {
          lines.push('### 마일스톤');
          for (const m of result.milestones) {
            const icon = m.status === 'completed' ? '[x]' : m.status === 'active' ? '[~]' : '[ ]';
            lines.push(`${icon} M${m.sort_order || m.id}: ${m.title} (${m.status})`);
          }
          lines.push('');
        }

        // 태스크
        if (result.tasks && result.tasks.length > 0) {
          lines.push('### 태스크');
          for (const t of result.tasks) {
            const icon = t.status === 'completed' || t.status === 'done' ? '[x]'
              : t.status === 'in_progress' ? '[~]'
              : t.status === 'blocked' ? '[!]' : '[ ]';
            lines.push(`${icon} #${t.id}: ${t.title} (${t.status})`);
          }
          lines.push('');
        }

        // 관련 메모리
        if (result.relatedMemories && result.relatedMemories.length > 0) {
          lines.push('### 관련 메모리');
          for (const m of result.relatedMemories.slice(0, 5)) {
            lines.push(`- [${m.id}] ${m.title} (${m.type})`);
          }
        }

        const text = lines.length > 0 ? lines.join('\n') : '프로젝트 데이터가 없습니다.';
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── project-task-update ────────────────────────────────────
  server.tool(
    'project-task-update',
    '태스크 상태를 변경합니다.',
    {
      taskId: z.number().describe('태스크 ID'),
      status: z.enum(['pending', 'in_progress', 'blocked', 'completed']).describe('변경할 상태'),
      note: z.string().optional().describe('상태 변경 사유'),
    },
    async ({ taskId, status, note }) => {
      return safeCall(async () => {
        const result = await callWorker('PATCH', `/api/tasks/${taskId}`, { status });

        if (result.error) {
          return { content: [{ type: 'text', text: `변경 실패: ${result.error}` }], isError: true };
        }

        let text = `태스크 #${taskId} 상태가 "${status}"(으)로 변경되었습니다.`;
        if (note) {
          text += `\n사유: ${note}`;
        }

        // 태스크 완료 시 자동 제안
        if (status === 'completed') {
          try {
            const autoSuggest = require('./auto-suggest.cjs');
            const nextResult = await callWorker('GET', '/api/tasks/next' + qs({ projectId: undefined }));
            if (nextResult.task) {
              text += `\n\n다음 태스크 제안: #${nextResult.task.id} ${nextResult.task.title}`;
            }
          } catch { /* auto-suggest 없어도 무방 */ }
        }

        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── project-next ──────────────────────────────────────────
  server.tool(
    'project-next',
    '다음에 해야 할 태스크를 제안합니다. 관련 메모리도 함께 보여줘요.',
    {
      projectId: z.number().optional().describe('프로젝트 ID (생략시 최근 활성 프로젝트)'),
    },
    async ({ projectId }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/tasks/next' + qs({ projectId }));

        if (result.error) {
          return { content: [{ type: 'text', text: `조회 실패: ${result.error}` }], isError: true };
        }

        if (!result.task) {
          return { content: [{ type: 'text', text: '다음 태스크가 없습니다. 모든 태스크가 완료되었거나 프로젝트가 없습니다.' }] };
        }

        const t = result.task?.task || result.task;
        const lines = [
          `## 다음 태스크`,
          `#${t.id}: ${t.title}`,
          t.description ? `설명: ${t.description}` : null,
          t.milestone_id ? `마일스톤: M${t.milestone_id}` : null,
          `상태: ${t.status}`,
        ].filter(Boolean);

        // 관련 메모리 검색
        try {
          const memResult = await callWorker('GET', '/api/memories' + qs({ q: t.title, limit: 5 }));
          if (memResult.memories && memResult.memories.length > 0) {
            lines.push('');
            lines.push('### 관련 메모리');
            for (const m of memResult.memories) {
              lines.push(`- [${m.id}] ${m.title} (${m.type})`);
            }
          }
        } catch { /* 메모리 검색 실패해도 태스크 정보는 반환 */ }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      });
    },
  );

  // ── wiki-read ──────────────────────────────────────────────
  server.tool(
    'wiki-read',
    '프로젝트 Wiki 페이지를 읽습니다.',
    {
      page: z.string().describe('페이지 이름 (예: patterns, gotchas, decisions)'),
    },
    async ({ page }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/wiki/' + encodeURIComponent(page));

        if (result.error) {
          return { content: [{ type: 'text', text: `Wiki 읽기 실패: ${result.error}` }], isError: true };
        }

        const text = result.content || result.body || JSON.stringify(result, null, 2);
        return { content: [{ type: 'text', text: `## Wiki: ${page}\n\n${text}` }] };
      });
    },
  );

  // ── wiki-write ────────────────────────────────────────────
  server.tool(
    'wiki-write',
    'Wiki 페이지를 생성하거나 업데이트합니다.',
    {
      page: z.string().describe('페이지 이름'),
      content: z.string().describe('페이지 내용 (Markdown)'),
    },
    async ({ page, content }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/wiki', { page, content });

        if (result.error) {
          return { content: [{ type: 'text', text: `Wiki 저장 실패: ${result.error}` }], isError: true };
        }

        return { content: [{ type: 'text', text: `Wiki 페이지 "${page}" 저장 완료.` }] };
      });
    },
  );

  // ── wiki-search ───────────────────────────────────────────
  server.tool(
    'wiki-search',
    'Wiki 내에서 키워드로 검색합니다.',
    {
      query: z.string().describe('검색 키워드'),
    },
    async ({ query }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/wiki/search' + qs({ q: query }));

        if (!result.results || result.results.length === 0) {
          return { content: [{ type: 'text', text: `Wiki에서 "${query}"에 대한 검색 결과가 없습니다.` }] };
        }

        const lines = result.results.map((r) =>
          `- **${r.page || r.title || r.name}**${r.snippet ? ': ' + r.snippet : ''}`,
        );
        const text = `Wiki 검색 결과 ${result.results.length}건:\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── wiki-index ────────────────────────────────────────────
  server.tool(
    'wiki-index',
    'Wiki 전체 페이지 목록을 조회합니다.',
    {},
    async () => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/wiki/index');

        if (!result.pages || result.pages.length === 0) {
          return { content: [{ type: 'text', text: 'Wiki 페이지가 없습니다.' }] };
        }

        const lines = result.pages.map((p) => {
          const name = typeof p === 'string' ? p : (p.page || p.name || p.title);
          const updated = (typeof p === 'object' && p.updated_at) ? ` (${p.updated_at})` : '';
          return `- ${name}${updated}`;
        });
        const text = `Wiki 페이지 목록 (${result.pages.length}건):\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── skill-save ────────────────────────────────────────────
  server.tool(
    'skill-save',
    '재사용 가능한 스킬을 DB에 저장합니다.',
    {
      name: z.string().describe('스킬 이름'),
      description: z.string().describe('스킬 설명'),
      content: z.string().describe('스킬 내용 (프롬프트, 코드 등)'),
      category: z.string().describe('카테고리 (예: coding, debugging, testing, devops)'),
    },
    async ({ name, description, content, category }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/skills', { name, description, content, category });

        if (result.error) {
          return { content: [{ type: 'text', text: `스킬 저장 실패: ${result.error}` }], isError: true };
        }

        return { content: [{ type: 'text', text: `스킬 "${name}" 저장 완료 (ID: ${result.id || '-'}).` }] };
      });
    },
  );

  // ── skill-search ──────────────────────────────────────────
  server.tool(
    'skill-search',
    'DB에서 관련 스킬을 검색합니다.',
    {
      query: z.string().describe('검색 키워드'),
      category: z.string().optional().describe('카테고리 필터'),
    },
    async ({ query, category }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/skills' + qs({ q: query, category }));

        if (!result.skills || result.skills.length === 0) {
          return { content: [{ type: 'text', text: `"${query}"에 해당하는 스킬이 없습니다.` }] };
        }

        const lines = result.skills.map((s) =>
          `- **${s.name}** [${s.category || '-'}]: ${s.description || ''}`,
        );
        const text = `스킬 검색 결과 ${result.skills.length}건:\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── mistake-log ───────────────────────────────────────────
  server.tool(
    'mistake-log',
    '실수를 기록합니다. 원인, 해결법, 예방법을 함께 저장하세요.',
    {
      description: z.string().describe('실수 설명'),
      cause: z.string().optional().describe('원인'),
      fix: z.string().optional().describe('해결 방법'),
      prevention: z.string().optional().describe('예방법'),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('심각도'),
    },
    async ({ description, cause, fix, prevention, severity }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/mistakes', {
          description,
          cause,
          fix,
          prevention,
          severity,
          project: getProjectName(),
        });

        if (result.error) {
          return { content: [{ type: 'text', text: `실수 기록 실패: ${result.error}` }], isError: true };
        }

        return { content: [{ type: 'text', text: `실수 기록 완료 (ID: ${result.id || '-'}).` }] };
      });
    },
  );

  // ── mistake-search ────────────────────────────────────────
  server.tool(
    'mistake-search',
    '과거 실수와 주의사항을 검색합니다. 같은 실수를 반복하지 않도록.',
    {
      query: z.string().optional().describe('검색 키워드'),
      project: z.string().optional().describe('프로젝트명 필터'),
    },
    async ({ query, project }) => {
      return safeCall(async () => {
        const result = await callWorker('GET', '/api/mistakes' + qs({ q: query, project }));

        if (!result.mistakes || result.mistakes.length === 0) {
          return { content: [{ type: 'text', text: '관련 실수 기록이 없습니다.' }] };
        }

        const lines = result.mistakes.map((m) => {
          const parts = [`- [${m.id}] ${m.description}`];
          if (m.severity) parts[0] += ` (${m.severity})`;
          if (m.cause) parts.push(`  원인: ${m.cause}`);
          if (m.prevention) parts.push(`  예방: ${m.prevention}`);
          return parts.join('\n');
        });
        const text = `실수 기록 ${result.mistakes.length}건:\n\n` + lines.join('\n');
        return { content: [{ type: 'text', text }] };
      });
    },
  );

  // ── retrospect ────────────────────────────────────────────
  server.tool(
    'retrospect',
    '세션 복기를 실행합니다. 축적된 메모리와 실수를 종합 분석합니다.',
    {
      project: z.string().optional().describe('프로젝트명 (생략시 현재 프로젝트)'),
    },
    async ({ project }) => {
      return safeCall(async () => {
        const result = await callWorker('POST', '/api/retrospect', {
          project: project || getProjectName(),
        });

        if (result.error) {
          return { content: [{ type: 'text', text: `복기 실패: ${result.error}` }], isError: true };
        }

        const text = result.report || result.content || JSON.stringify(result, null, 2);
        return { content: [{ type: 'text', text }] };
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

// 부모 프로세스 heartbeat — 좀비 방지
const parentPid = process.ppid;
const heartbeat = setInterval(() => {
  try { process.kill(parentPid, 0); }
  catch { clearInterval(heartbeat); process.exit(0); }
}, 30000);
heartbeat.unref();
