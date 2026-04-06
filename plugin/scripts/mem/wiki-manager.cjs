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
  const filePath = path.join(getWikiDir(), pageName + '.md');
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Wiki 페이지 쓰기/업데이트
 * 
 * @param {string} pageName - 페이지 이름 (.md 확장자 제외)
 * @param {string} content - 페이지 내용
 */
function writePage(pageName, content) {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, pageName + '.md'), content, 'utf8');
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
 * 
 */
function updateIndex() {
  const dir = getWikiDir();
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md');
  const lines = ['# Wiki Index\n', '자동 생성됨. 수정하지 마세요.\n'];
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const firstLine = content.split('\n').find(l => l.trim()) || file;
    const title = firstLine.replace(/^#+\s*/, '');
    lines.push(`- [${title}](${file})`);
  }
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
