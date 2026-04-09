/**
 * fireauto Hook Utilities — cross-platform (Windows + macOS + Linux)
 * 모든 훅 스크립트가 공유하는 유틸리티
 */
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');

const WORKER_URL = 'http://localhost:37888';
const MEM_DIR = path.join(os.homedir(), '.fireauto-mem');
const PID_FILE = path.join(MEM_DIR, 'worker.pid');

/**
 * stdin 전체를 읽어 문자열로 반환
 * @returns {Promise<string>}
 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
    // stdin이 없을 경우 대비 (timeout 2s)
    setTimeout(() => resolve(data), 2000);
  });
}

/**
 * HTTP GET 요청
 * @param {string} urlPath - e.g. '/api/health'
 * @param {number} [timeout=5000]
 * @returns {Promise<{status: number, body: string}>}
 */
function httpGet(urlPath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${WORKER_URL}${urlPath}`, { timeout }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * HTTP POST 요청
 * @param {string} urlPath
 * @param {Object} data
 * @param {number} [timeout=5000]
 * @returns {Promise<{status: number, body: string}>}
 */
function httpPost(urlPath, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const opts = {
      hostname: 'localhost',
      port: 37888,
      path: urlPath,
      method: 'POST',
      timeout,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

/**
 * Worker가 살아있는지 확인
 * @returns {Promise<boolean>}
 */
async function isWorkerAlive() {
  try {
    const { status } = await httpGet('/api/health', 3000);
    return status === 200;
  } catch {
    return false;
  }
}

/**
 * PID가 살아있는 프로세스인지 확인 (cross-platform)
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = 존재 확인만
    return true;
  } catch {
    return false;
  }
}

/**
 * 프로세스 강제 종료 (cross-platform)
 * @param {number} pid
 */
function killProcess(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // 이미 죽었거나 권한 없음
  }
}

/**
 * 현재 프로젝트 이름 (cwd의 basename)
 * @returns {string}
 */
function getProject() {
  return path.basename(process.cwd());
}

/**
 * 세션 ID
 * @returns {string}
 */
function getSessionId() {
  return process.env.CLAUDE_SESSION_ID || 'unknown';
}

/**
 * 플러그인 루트 경로
 * @returns {string}
 */
function getPluginRoot() {
  // __dirname = plugin/scripts/mem/hooks → 3단계 올라가면 plugin/
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..', '..', '..');
}

/**
 * stderr에 메시지 출력
 * @param {string} msg
 */
function log(msg) {
  process.stderr.write(msg + '\n');
}

/**
 * Worker를 백그라운드로 시작 (cross-platform)
 * @returns {Promise<boolean>} 시작 성공 여부
 */
async function startWorker() {
  const pluginRoot = getPluginRoot();
  const workerPath = path.join(pluginRoot, 'scripts', 'mem', 'worker.cjs');

  if (!fs.existsSync(workerPath)) {
    log(`[fireauto-mem] worker.cjs not found: ${workerPath}`);
    return false;
  }

  // NODE_PATH 설정
  const pluginData = process.env.CLAUDE_PLUGIN_DATA || MEM_DIR;
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const nodePaths = [
    path.join(pluginData, 'node_modules'),
    path.join(MEM_DIR, 'node_modules'),
    path.join(pluginRoot, 'scripts', 'mem', 'node_modules'),
  ].filter(p => fs.existsSync(p));

  const env = {
    ...process.env,
    NODE_PATH: nodePaths.join(delimiter),
    DB_PATH: path.join(pluginData, 'fireauto-mem.db'),
  };

  // 백그라운드 시작 (detached, stdio 무시)
  const child = spawn(process.execPath, [workerPath, 'start'], {
    env,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  // 시작 대기 (최대 10초)
  for (let i = 0; i < 20; i++) {
    if (await isWorkerAlive()) {
      log('[fireauto-mem] Worker 준비됨');
      return true;
    }
    await sleep(500);
  }

  log('[fireauto-mem] Worker 시작 시간 초과');
  return false;
}

/**
 * Promise 기반 sleep
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 임시 파일 경로 생성 (cross-platform)
 * @param {string} prefix
 * @returns {string}
 */
function tempFile(prefix = 'fireauto') {
  const tmpDir = os.tmpdir();
  const name = `${prefix}-${process.pid}-${Date.now()}`;
  return path.join(tmpDir, name);
}

module.exports = {
  WORKER_URL,
  MEM_DIR,
  PID_FILE,
  readStdin,
  httpGet,
  httpPost,
  isWorkerAlive,
  isProcessAlive,
  killProcess,
  getProject,
  getSessionId,
  getPluginRoot,
  log,
  startWorker,
  sleep,
  tempFile,
};
