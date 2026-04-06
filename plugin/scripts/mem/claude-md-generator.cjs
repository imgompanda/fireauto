/**
 * fireauto CLAUDE.md Generator
 *
 * 프로젝트 컨텍스트를 분석하여 CLAUDE.md를 자동 생성하는 모듈.
 * Anthropic 권장: Claude가 추측할 수 없는 것만 포함, 80줄 이내.
 *
 * @module claude-md-generator
 */

const fs = require('fs');
const path = require('path');

/**
 * 프로젝트에 맞는 CLAUDE.md 내용 생성
 * @param {Object} options
 * @param {string} options.projectName
 * @param {string} options.description
 * @param {string[]} options.techStack - 감지된 기술 스택
 * @param {Array} [options.previousMistakes] - 이전 프로젝트 실수
 * @returns {string} CLAUDE.md 내용 (80줄 이내)
 */
function generateClaudeMd(options) {
  const lines = [];

  lines.push('# ' + options.projectName);
  lines.push('');
  lines.push(options.description || '');
  lines.push('');

  // 핵심 규칙 (Anthropic 권장: Claude가 추측할 수 없는 것만)
  lines.push('## 핵심 규칙');
  lines.push('');

  // 기술 스택 기반 규칙
  const stack = options.techStack || [];
  if (stack.includes('typescript')) {
    lines.push('- TypeScript strict mode 사용');
  }
  if (stack.includes('next')) {
    lines.push('- Next.js App Router 사용 (pages 아님)');
  }
  if (stack.includes('react')) {
    lines.push('- React Server Components 우선');
  }
  if (stack.includes('tailwind')) {
    lines.push('- Tailwind CSS 사용, 인라인 스타일 금지');
  }
  if (stack.includes('prisma')) {
    lines.push('- Prisma ORM, raw SQL 지양');
  }
  if (stack.includes('vue')) {
    lines.push('- Vue 3 Composition API 사용');
  }
  if (stack.includes('express')) {
    lines.push('- Express.js REST API');
  }
  if (stack.includes('python')) {
    lines.push('- Python 3.10+ 사용');
  }
  if (stack.includes('go')) {
    lines.push('- Go modules 사용');
  }
  if (stack.includes('rust')) {
    lines.push('- Cargo workspace 사용');
  }

  // 스택이 비어있으면 기본 규칙
  if (stack.length === 0) {
    lines.push('- 한국어 주석, 영어 코드');
    lines.push('- 코드 변경 전 기존 패턴 확인');
  }

  // 이전 프로젝트 실수에서 가져온 주의사항
  if (options.previousMistakes && options.previousMistakes.length > 0) {
    lines.push('');
    lines.push('## 주의사항 (이전 프로젝트에서 배운 것)');
    lines.push('');
    options.previousMistakes.slice(0, 5).forEach(function (m) {
      lines.push('- ' + (m.prevention || m.description || String(m)));
    });
  }

  // 커맨드 안내
  lines.push('');
  lines.push('## 커맨드');
  lines.push('');
  lines.push('- `/next` — 다음 태스크 시작');
  lines.push('- `/project` — 프로젝트 대시보드');
  lines.push('- `/planner` — PRD 작성/수정');

  // 상세 지식 위임
  lines.push('');
  lines.push('## 상세 지식');
  lines.push('');
  lines.push('- 패턴: @.claude/wiki/patterns.md');
  lines.push('- 주의사항: @.claude/wiki/gotchas.md');
  lines.push('- 결정: @.claude/wiki/decisions.md');
  lines.push('- 스킬: @.claude/wiki/skills-catalog.md');

  return lines.join('\n');
}

/**
 * 프로젝트 기술 스택 자동 감지
 * @param {string} projectRoot
 * @returns {string[]}
 */
function detectTechStack(projectRoot) {
  const stack = [];

  // package.json 분석
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    if (deps.typescript) stack.push('typescript');
    if (deps.next) stack.push('next');
    if (deps.react) stack.push('react');
    if (deps.tailwindcss) stack.push('tailwind');
    if (deps['@prisma/client'] || deps.prisma) stack.push('prisma');
    if (deps.express) stack.push('express');
    if (deps.vue) stack.push('vue');
    if (deps.svelte || deps['@sveltejs/kit']) stack.push('svelte');
    if (deps.supabase || deps['@supabase/supabase-js']) stack.push('supabase');
  } catch (e) {
    // package.json이 없는 경우
  }

  // 기타 파일 존재 확인
  if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
      fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
    stack.push('python');
  }
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    stack.push('go');
  }
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
    stack.push('rust');
  }
  if (fs.existsSync(path.join(projectRoot, 'build.gradle')) ||
      fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))) {
    stack.push('java');
  }

  return stack;
}

/**
 * CLAUDE.md가 maxLines를 초과하면 오래된 규칙을 wiki로 이동
 * @param {string} projectRoot
 * @param {number} [maxLines=80]
 */
function trimClaudeMd(projectRoot, maxLines) {
  maxLines = maxLines || 80;
  const claudeMdPath = path.join(projectRoot, '.claude', 'CLAUDE.md');

  if (!fs.existsSync(claudeMdPath)) return;
  const content = fs.readFileSync(claudeMdPath, 'utf8');
  const lines = content.split('\n');

  if (lines.length <= maxLines) return;

  // 초과분을 wiki/overflow.md로 이동
  const keep = lines.slice(0, maxLines);
  const overflow = lines.slice(maxLines);

  fs.writeFileSync(claudeMdPath, keep.join('\n'), 'utf8');

  try {
    const wikiMgr = require('./wiki-manager.cjs');
    const existing = wikiMgr.readPage('overflow') ||
      '# CLAUDE.md 오버플로우\n\n80줄 초과 규칙이 여기로 이동돼요.\n';
    wikiMgr.writePage(
      projectRoot,
      'overflow',
      existing + '\n---\n' + overflow.join('\n')
    );
  } catch (e) {
    // wiki-manager가 없는 경우 무시
  }
}

/**
 * CLAUDE.md 생성 후 파일로 저장
 * @param {string} projectRoot
 * @param {Object} options - generateClaudeMd와 같은 옵션
 * @returns {{ path: string, lineCount: number }}
 */
function saveClaudeMd(projectRoot, options) {
  const content = generateClaudeMd(options);
  const dir = path.join(projectRoot, '.claude');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const claudeMdPath = path.join(dir, 'CLAUDE.md');

  // 기존 파일이 있으면 백업
  if (fs.existsSync(claudeMdPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(dir, 'CLAUDE.md.backup-' + timestamp);
    fs.copyFileSync(claudeMdPath, backupPath);
  }

  fs.writeFileSync(claudeMdPath, content, 'utf8');
  const lineCount = content.split('\n').length;

  // 80줄 초과 시 trim
  trimClaudeMd(projectRoot, 80);

  return { path: claudeMdPath, lineCount: Math.min(lineCount, 80) };
}

// CLI 실행 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = function (name) {
    const idx = args.indexOf('--' + name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const projectRoot = getArg('project-root') || process.cwd();
  const projectName = getArg('project-name') || path.basename(projectRoot);
  const description = getArg('description') || '';

  const techStack = detectTechStack(projectRoot);
  const result = saveClaudeMd(projectRoot, {
    projectName: projectName,
    description: description,
    techStack: techStack,
    previousMistakes: [],
  });

  console.log(JSON.stringify({
    path: result.path,
    lineCount: result.lineCount,
    techStack: techStack,
  }));
}

module.exports = { generateClaudeMd, detectTechStack, trimClaudeMd, saveClaudeMd };
