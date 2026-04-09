#!/usr/bin/env node
/**
 * fireauto-mem: 세션 시작 시 프로젝트 컨텍스트를 .claude/CLAUDE.md에 자동 주입 (cross-platform)
 * Worker에서 대시보드/실수/Wiki/스킬 데이터를 가져와 마크다운으로 변환 후 주입
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isWorkerAlive, httpGet, log } = require('./hook-utils.cjs');

const PROJECT_CLAUDE_MD = path.join(process.cwd(), '.claude', 'CLAUDE.md');

/**
 * JSON 응답을 안전하게 파싱
 * @param {string} body
 * @returns {Object|null}
 */
function safeParse(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 대시보드 JSON에서 프로젝트 상태 마크다운 생성
 * @param {Object} dashboard
 * @returns {string|null}
 */
function buildProjectContext(dashboard) {
  if (!dashboard || !dashboard.project) return null;

  const p = dashboard.project;
  const pct = typeof dashboard.overall_progress === 'object'
    ? dashboard.overall_progress.progress_pct || 0
    : dashboard.overall_progress || 0;

  const ms = dashboard.milestones || [];

  // 모든 마일스톤에서 미완료 태스크 찾기
  const active = ms.find(m => m.status === 'in_progress') || ms.find(m => {
    const pending = (m.tasks || []).some(t => t.status !== 'completed');
    return pending;
  });

  let nextTask = null;
  for (const m of ms) {
    const t = (m.tasks || []).find(t => t.status !== 'completed');
    if (t) {
      nextTask = { milestone: m.title, task: t.title };
      break;
    }
  }

  let ctx = '';
  ctx += '## 현재 프로젝트 상태 (자동 생성 \u2014 수정 금지)\n\n';
  ctx += '프로젝트: ' + p.name + ' (' + pct + '% 완료)\n';
  if (active) ctx += '현재 마일스톤: ' + active.title + '\n';
  if (nextTask) ctx += '다음 태스크: ' + nextTask.task + ' (' + nextTask.milestone + ')\n';

  return ctx;
}

/**
 * 최근 주의사항(실수) 마크다운 생성
 * @param {Object} data
 * @returns {string|null}
 */
function buildMistakes(data) {
  const mistakes = (data && data.mistakes || []).slice(0, 3);
  if (!mistakes.length) return null;

  let s = '### 최근 주의사항\n';
  for (const x of mistakes) {
    const prev = x.prevention && x.prevention.trim().length > 5 ? x.prevention.trim() : null;
    const text = prev || x.description;
    if (text && text.trim().length > 5) {
      s += '- \u26A0\uFE0F ' + text.split('\n')[0].slice(0, 120) + '\n';
    }
  }
  return s;
}

/**
 * Wiki 인덱스 마크다운 생성
 * @param {Object} data
 * @returns {string|null}
 */
function buildWikiIndex(data) {
  const pages = (data && data.pages || []).filter(p => p !== 'index');
  if (!pages.length) return null;

  let s = '### 지식 Wiki (상세는 여기서 찾으세요)\n';
  for (const p of pages) {
    s += '- wiki-read: ' + p + '\n';
  }
  return s;
}

/**
 * 스킬 목록 마크다운 생성
 * @param {Object} data
 * @returns {string|null}
 */
function buildSkills(data) {
  const skills = (data && data.skills || []).slice(0, 5);
  if (!skills.length) return null;

  let out = '### 사용 가능한 스킬\n';
  for (const x of skills) {
    out += '- skill-search: ' + x.name + ' (' + x.category + ')\n';
  }
  return out;
}

/**
 * 기존 CLAUDE.md에서 자동 생성 섹션을 제거
 * @param {string} content
 * @returns {string}
 */
function removeAutoSection(content) {
  // 자동 생성 섹션 제거: ## 현재 프로젝트 상태 부터 다음 ##(레벨1-2) 전까지
  content = content.replace(
    /\n*## 현재 프로젝트 상태 \(자동 생성[\s\S]*?(?=\n## [^현]|\n# [^\n]|$)/g,
    ''
  );
  // 후행 빈줄 정리
  content = content.replace(/\n{3,}/g, '\n\n').trim();
  return content;
}

(async () => {
  try {
    // 1) Worker 헬스 체크 — 안 돌면 종료
    if (!await isWorkerAlive()) return;

    // 2) 대시보드 데이터 가져오기 (projectId 없이 -> 최신 active 프로젝트)
    let dashboardData = null;
    try {
      const res = await httpGet('/api/dashboard');
      dashboardData = safeParse(res.body);
    } catch {
      // 무시
    }

    // 3) loadProjectManager가 null 반환하면 fallback: projectId 명시
    if (!dashboardData) {
      let firstProjectId = null;
      try {
        const res = await httpGet('/api/projects');
        const j = safeParse(res.body);
        if (j) {
          const projects = j.projects || j || [];
          const active = (Array.isArray(projects) ? projects : []).find(x => x.status === 'active');
          if (active) firstProjectId = active.id;
        }
      } catch {
        // 무시
      }

      if (firstProjectId) {
        try {
          const res = await httpGet(`/api/dashboard?projectId=${firstProjectId}`);
          dashboardData = safeParse(res.body);
        } catch {
          // 무시
        }
      }
    }

    if (!dashboardData) return;

    // 4) 프로젝트 상태 마크다운 생성
    const context = buildProjectContext(dashboardData);
    if (!context) return;

    // 5) 병렬로 추가 데이터 가져오기
    const [mistakesRes, wikiRes, skillsRes] = await Promise.allSettled([
      httpGet('/api/mistakes?limit=3'),
      httpGet('/api/wiki/index'),
      httpGet('/api/skills'),
    ]);

    const mistakes = mistakesRes.status === 'fulfilled' ? buildMistakes(safeParse(mistakesRes.value.body)) : null;
    const wikiIndex = wikiRes.status === 'fulfilled' ? buildWikiIndex(safeParse(wikiRes.value.body)) : null;
    const skills = skillsRes.status === 'fulfilled' ? buildSkills(safeParse(skillsRes.value.body)) : null;

    // 6) .claude/CLAUDE.md에 주입 (기존 "자동 생성" 섹션 교체)
    let finalContent = '';

    if (fs.existsSync(PROJECT_CLAUDE_MD)) {
      // 기존 파일에서 자동 생성 섹션 제거
      const existing = fs.readFileSync(PROJECT_CLAUDE_MD, 'utf8');
      finalContent = removeAutoSection(existing) + '\n';
    } else {
      // .claude 디렉토리 생성
      const claudeDir = path.dirname(PROJECT_CLAUDE_MD);
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // 새 컨텍스트 추가
    finalContent += '\n' + context + '\n';
    if (mistakes) finalContent += mistakes + '\n';
    if (wikiIndex) finalContent += wikiIndex + '\n';
    if (skills) finalContent += skills + '\n';

    fs.writeFileSync(PROJECT_CLAUDE_MD, finalContent);

    log('[fireauto] 프로젝트 컨텍스트 주입 완료');
  } catch {
    // 훅은 Claude Code를 차단하면 안 됨 — 조용히 종료
  }
})();
