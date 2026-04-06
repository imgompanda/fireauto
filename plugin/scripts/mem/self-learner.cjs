// ── fireauto-mem Self-Learner v1 ── 자기학습 모듈 ──
// 실수 감지, 반복 패턴 감지, 세션 복기, CLAUDE.md 규칙 관리

const fs = require('fs');
const path = require('path');

// ── DB / Wiki 모듈 (lazy load) ──────────────────────────────
let dbMod;
function loadDb() {
  if (!dbMod) dbMod = require('./db.cjs');
  return dbMod;
}

let wikiMgr;
let wikiMgrLoaded = false;
function loadWikiManager() {
  if (wikiMgrLoaded) return wikiMgr;
  wikiMgrLoaded = true;
  try { wikiMgr = require('./wiki-manager.cjs'); } catch { wikiMgr = null; }
  return wikiMgr;
}

// ── 실수 감지 ────────────────────────────────────────────────

/**
 * 실수 감지: 사용자가 "아니", "잘못", "틀렸" 등을 말했을 때
 * @param {string} userMessage
 * @returns {boolean}
 */
function detectMistakeFromUserInput(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return false;
  const patterns = [
    '아니', '그거 아니', '잘못', '틀렸', '다시', '그게 아니라',
    'no not', 'wrong', 'incorrect', 'that\'s not', 'not right',
  ];
  const lower = userMessage.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

// ── 반복 패턴 감지 ──────────────────────────────────────────

/**
 * 반복 패턴 감지: 같은 파일 패턴이 3회 이상 반복되면 스킬 후보로 제안
 * @param {Object} db - sql.js Database 인스턴스
 * @param {string} [project] - 프로젝트 필터
 * @returns {Array<{pattern: string, count: number, suggestion: string}>} 스킬 후보 목록
 */
function detectRepetitivePatterns(db, project) {
  const { listMemories } = loadDb();
  const memories = listMemories(db, { project, limit: 200 });

  // files_involved 패턴 카운팅
  const fileCounts = {};
  for (const mem of memories) {
    // listMemories는 요약만 반환하므로 full 데이터 조회
    let files;
    try {
      const full = loadDb().getMemoryById(db, mem.id);
      files = full && full.files_involved ? full.files_involved : [];
    } catch {
      files = [];
    }
    if (!Array.isArray(files) || files.length === 0) continue;

    // 파일 패턴 정규화 (디렉토리 + 확장자)
    const key = files.sort().join(',');
    if (!fileCounts[key]) {
      fileCounts[key] = { pattern: key, count: 0, files };
    }
    fileCounts[key].count++;
  }

  // 3회 이상 반복된 패턴만 스킬 후보로
  const candidates = [];
  for (const entry of Object.values(fileCounts)) {
    if (entry.count >= 3) {
      candidates.push({
        pattern: entry.pattern,
        count: entry.count,
        suggestion: `이 파일 패턴(${entry.files.join(', ')})이 ${entry.count}회 반복됨 → 스킬로 추출 권장`,
      });
    }
  }

  return candidates.sort((a, b) => b.count - a.count);
}

// ── 세션 복기 ────────────────────────────────────────────────

/**
 * 세션 복기 실행
 * @param {Object} db - sql.js Database 인스턴스
 * @param {string} [project] - 프로젝트 필터
 * @returns {{mistakes: Array, successes: Array, learnings: Array, skill_candidates: Array, next_todo: string|null}}
 */
function runRetrospect(db, project) {
  const { listMemories, getMemoryById, listMistakes } = loadDb();

  // 최근 메모리 조회 (이 세션)
  const recentMemories = listMemories(db, { project, limit: 100 });
  const fullMemories = recentMemories.map(m => {
    try { return getMemoryById(db, m.id); } catch { return m; }
  }).filter(Boolean);

  // 실수 DB에서 이 프로젝트 실수 조회
  let mistakes = [];
  try {
    mistakes = listMistakes(db, { project, limit: 50 });
  } catch { /* mistakes table may not exist */ }

  // 성공 패턴: bugfix, feature 타입 메모리
  const successes = fullMemories.filter(m =>
    m.type === 'feature' || m.type === 'bugfix'
  ).map(m => ({
    id: m.id,
    title: m.title,
    type: m.type,
  }));

  // 배운 것: gotcha, pattern 타입 메모리 → wiki 업데이트 제안
  const learnings = fullMemories.filter(m =>
    m.type === 'gotcha' || m.type === 'pattern' || m.type === 'decision'
  ).map(m => ({
    id: m.id,
    title: m.title,
    type: m.type,
    content_preview: (m.content || '').substring(0, 200),
    wiki_suggestion: `wiki 페이지 "${m.title}" 생성/업데이트 권장`,
  }));

  // 반복 패턴 → 스킬 후보
  const skill_candidates = detectRepetitivePatterns(db, project);

  // 다음 TODO: 프로젝트의 다음 pending 태스크
  let next_todo = null;
  try {
    const { listTasks } = loadDb();
    const pendingTasks = listTasks(db, { project_id: undefined, status: 'pending' });
    if (pendingTasks.length > 0) {
      next_todo = `다음 태스크: [#${pendingTasks[0].id}] ${pendingTasks[0].title}`;
    }
  } catch { /* tasks table may not exist */ }

  return {
    mistakes: mistakes.map(m => ({
      id: m.id,
      description: m.description,
      cause: m.cause,
      severity: m.severity,
      _highlight: true,  // 크게 표시 플래그
    })),
    successes,
    learnings,
    skill_candidates,
    next_todo,
  };
}

// ── CLAUDE.md 규칙 관리 ─────────────────────────────────────

const CLAUDE_MD_MAX_LINES = 80;

/**
 * CLAUDE.md에 규칙 추가 (80줄 이내 유지)
 * 초과 시 오래된 규칙을 wiki로 이동
 * @param {string} projectRoot - 프로젝트 루트 경로
 * @param {string} rule - 추가할 규칙
 * @returns {{added: boolean, movedToWiki: string[]}}
 */
function addClaudeMdRule(projectRoot, rule) {
  if (!rule || typeof rule !== 'string') {
    return { added: false, movedToWiki: [] };
  }

  const claudeMdPath = path.join(projectRoot, '.claude', 'CLAUDE.md');
  const movedToWiki = [];

  // .claude 디렉토리 확인/생성
  const claudeDir = path.dirname(claudeMdPath);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // CLAUDE.md 읽기 (없으면 빈 파일)
  let content = '';
  if (fs.existsSync(claudeMdPath)) {
    content = fs.readFileSync(claudeMdPath, 'utf-8');
  }

  let lines = content.split('\n');

  // 줄 수 체크 → 초과 시 오래된 규칙을 wiki로 이동
  while (lines.length + 2 > CLAUDE_MD_MAX_LINES) {
    // 첫 번째 비-헤더, 비-빈줄 규칙 찾기
    let removedIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 헤더(#), 빈줄, 구분선(---) 건너뛰기
      if (!line || line.startsWith('#') || line === '---') continue;
      removedIdx = i;
      break;
    }
    if (removedIdx === -1) break;

    const removedLine = lines[removedIdx];
    lines.splice(removedIdx, 1);

    // wiki로 이동 시도
    const wm = loadWikiManager();
    if (wm) {
      try {
        const pageName = 'archived-rules';
        const existing = wm.readPage(pageName) || '# Archived CLAUDE.md Rules\n\n';
        const timestamp = new Date().toISOString().split('T')[0];
        wm.writePage(pageName, existing + `- [${timestamp}] ${removedLine}\n`);
        movedToWiki.push(removedLine);
      } catch { /* wiki write fail — 규칙은 여전히 제거됨 */ }
    }
    movedToWiki.push(removedLine);
  }

  // 새 규칙 추가
  lines.push(`- ${rule}`);
  lines.push('');

  fs.writeFileSync(claudeMdPath, lines.join('\n'), 'utf-8');

  return { added: true, movedToWiki };
}

module.exports = {
  detectMistakeFromUserInput,
  detectRepetitivePatterns,
  runRetrospect,
  addClaudeMdRule,
};
