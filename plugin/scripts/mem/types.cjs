const path = require('path');
const os = require('os');

// ── Constants ──────────────────────────────────────────────

const MEM_PORT = 37888;
const MEM_DB_NAME = 'fireauto-mem.db';
const MEM_DIR_NAME = '.fireauto-mem';

// ── API Endpoints ──────────────────────────────────────────

/** @type {Record<string, string>} */
const API = {
  HEALTH: '/api/health',
  MEMORIES: '/api/memories',
  SESSIONS: '/api/sessions',
  SUMMARIES: '/api/summaries',
  TIMELINE: '/api/timeline',
  STATS: '/api/stats',
  STREAM: '/stream',
};

// ── Memory Types ───────────────────────────────────────────

/**
 * @typedef {'decision' | 'bugfix' | 'feature' | 'pattern' | 'gotcha' | 'refactor'} MemoryType
 */

/** @type {MemoryType[]} */
const MEMORY_TYPES = ['decision', 'bugfix', 'feature', 'pattern', 'gotcha', 'refactor'];

// ── Helper Functions ───────────────────────────────────────

/** @returns {string} DB file path */
function getDbPath() {
  return process.env.DB_PATH || path.join(os.homedir(), MEM_DIR_NAME, MEM_DB_NAME);
}

/** @returns {string} Memory directory path */
function getMemDir() {
  return process.env.MEM_DIR || path.join(os.homedir(), MEM_DIR_NAME);
}

/** @returns {string} Current project name */
function getProjectName() {
  return process.env.PROJECT || path.basename(process.cwd());
}

/**
 * Convert epoch ms to 'YYYY-MM-DD HH:mm:ss'
 * @param {number} epoch - Epoch in milliseconds
 * @returns {string}
 */
function formatEpoch(epoch) {
  const d = new Date(epoch);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** @returns {number} Current epoch in milliseconds */
function nowEpoch() {
  return Date.now();
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string
 * @param {*} fallback - Fallback value on parse failure
 * @returns {*}
 */
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** @returns {string} Worker base URL */
function getWorkerUrl() {
  return `http://localhost:${MEM_PORT}`;
}

// ── Exports ────────────────────────────────────────────────

module.exports = {
  MEM_PORT,
  MEM_DB_NAME,
  MEM_DIR_NAME,
  API,
  MEMORY_TYPES,
  getDbPath,
  getMemDir,
  getProjectName,
  formatEpoch,
  nowEpoch,
  safeJsonParse,
  getWorkerUrl,
};
