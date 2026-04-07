/**
 * fireauto-mem Wiki Manager
 *
 * 글로벌 Wiki 디렉토리(`~/.fireauto-mem/wiki/`)를 관리하는 모듈.
 * 모든 프로젝트에서 동일한 Wiki에 접근 가능.
 * Karpathy 패턴의 자동 index 갱신을 지원합니다.
 *
 * @module wiki-manager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** 글로벌 Wiki 경로 */
const GLOBAL_WIKI_DIR = path.join(process.env.MEM_DIR || path.join(os.homedir(), '.fireauto-mem'), 'wiki');

/**
 * pageName 검증 — 경로 탐색 방지
 * @param {string} name
 * @returns {string} 검증된 이름
 */
function sanitizePage(name) {
  if (!name || !/^[a-zA-Z0-9_\-]+$/.test(name)) throw new Error('Invalid page name: ' + name);
  return name;
}

/**
 * Wiki 루트 경로 반환 (글로벌)
 * @returns {string} wiki 디렉토리 경로
 */
function getWikiDir() {
  return GLOBAL_WIKI_DIR;
}

/**
 * Wiki 페이지 읽기
 * 
 * @param {string} pageName - 페이지 이름 (.md 확장자 제외)
 * @returns {string|null} 페이지 내용 또는 null
 */
function readPage(pageName) {
  pageName = sanitizePage(pageName);
  const filePath = path.join(getWikiDir(), pageName + '.md');
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 페이지 카테고리 추정
 * @param {string} pageName
 * @returns {string}
 */
function guessCategory(pageName) {
  const map = {
    patterns: 'knowledge', gotchas: 'knowledge', decisions: 'knowledge',
    'skills-catalog': 'catalog', retrospective: 'retrospective',
  };
  return map[pageName] || 'knowledge';
}

/**
 * 페이지 태그 추정
 * @param {string} pageName
 * @returns {string[]}
 */
function guessTags(pageName) {
  const map = {
    patterns: ['coding', 'pattern', 'best-practice'],
    gotchas: ['bug', 'gotcha', 'warning'],
    decisions: ['design', 'decision', 'architecture'],
    'skills-catalog': ['skill', 'automation', 'catalog'],
    retrospective: ['retro', 'learning', 'review'],
  };
  return map[pageName] || ['general'];
}

/**
 * YAML frontmatter 생성
 * @param {string} pageName
 * @param {string} content - 본문 (제목 추출용)
 * @returns {string}
 */
function buildFrontmatter(pageName, content) {
  const titleLine = content.split('\n').find(l => l.startsWith('#'));
  const title = titleLine ? titleLine.replace(/^#+\s*/, '') : pageName;
  const category = guessCategory(pageName);
  const tags = guessTags(pageName);
  const today = new Date().toISOString().split('T')[0];
  return [
    '---',
    `title: ${title}`,
    `category: ${category}`,
    `tags: [${tags.join(', ')}]`,
    `updated: ${today}`,
    '---',
    '',
  ].join('\n');
}

/**
 * Wiki 페이지 쓰기/업데이트
 * 새 페이지 생성 시 YAML frontmatter 자동 추가.
 * 기존 페이지 업데이트 시 frontmatter의 updated 필드만 갱신.
 *
 * @param {string} pageName - 페이지 이름 (.md 확장자 제외)
 * @param {string} content - 페이지 내용
 */
function writePage(pageName, content) {
  pageName = sanitizePage(pageName);
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, pageName + '.md');
  const isNew = !fs.existsSync(filePath);
  const today = new Date().toISOString().split('T')[0];

  if (isNew && !content.startsWith('---')) {
    // 새 페이지: frontmatter 추가
    content = buildFrontmatter(pageName, content) + content;
  } else if (!isNew && content.startsWith('---')) {
    // 기존 페이지 + frontmatter 있음: updated 날짜 갱신
    content = content.replace(/^(---[\s\S]*?updated:\s*)\S+([\s\S]*?---)/, `$1${today}$2`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  updateIndex();
}

/**
 * Wiki 검색 (파일 내용에서 키워드 검색)
 * 
 * @param {string} query - 검색 키워드
 * @returns {Array<{page: string, preview: string}>} 검색 결과
 */
function searchWiki(query) {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md');
  const results = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        page: file.replace('.md', ''),
        preview: content.slice(0, 200),
      });
    }
  }
  return results;
}

/**
 * index.md 자동 갱신 (Karpathy 패턴)
 * content-oriented 카탈로그: 요약 + 수정일 + 크기
 */
function updateIndex() {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md');

  const lines = [
    '# 지식 Wiki Index',
    '',
    '> AI가 지식을 찾을 때 이 인덱스를 먼저 참고합니다.',
    '> 상세 내용은 wiki-read MCP로 해당 페이지를 읽으세요.',
    '',
    '| 페이지 | 요약 | 수정일 | 크기 |',
    '|--------|------|--------|------|',
  ];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const name = file.replace('.md', '');
    const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---')) || '';
    const summary = firstLine.slice(0, 60).replace(/\|/g, '\\|');
    const stat = fs.statSync(filePath);
    const date = stat.mtime.toISOString().split('T')[0];
    const size = Math.round(content.length / 1024) + 'KB';

    lines.push(`| ${name} | ${summary} | ${date} | ${size} |`);
  }

  lines.push('');
  lines.push('총 ' + files.length + '개 페이지');

  fs.writeFileSync(path.join(dir, 'index.md'), lines.join('\n'), 'utf8');
}

/**
 * Wiki 페이지 목록 반환
 * 
 * @returns {string[]} 페이지 이름 배열 (.md 확장자 제외)
 */
function listPages() {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}

/**
 * 초기 Wiki 구조 생성
 * 
 */
function initWiki() {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, 'patterns.md'))) {
    writePage('patterns', '# 패턴\n\n발견된 코딩 패턴과 모범 사례.\n');
  }
  if (!fs.existsSync(path.join(dir, 'gotchas.md'))) {
    writePage('gotchas', '# 주의사항\n\n삽질 기록과 함정.\n');
  }
  if (!fs.existsSync(path.join(dir, 'decisions.md'))) {
    writePage('decisions', '# 설계 결정\n\n왜 이렇게 결정했는지 기록.\n');
  }
  if (!fs.existsSync(path.join(dir, 'skills-catalog.md'))) {
    writePage('skills-catalog', '# 스킬 카탈로그\n\n자동 생성된 스킬 목록.\n');
  }
  if (!fs.existsSync(path.join(dir, 'retrospective.md'))) {
    writePage('retrospective', '# 복기 기록\n\n세션별 복기.\n');
  }
  updateIndex();
}

module.exports = { readPage, writePage, searchWiki, updateIndex, listPages, initWiki, getWikiDir };
