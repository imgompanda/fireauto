// ── fireauto-mem SDK Agent ── Agent SDK integration for memory observation ──
// Calls Claude Haiku via Agent SDK query() to process observations and summaries.

const { safeJsonParse } = require('./types.cjs');

/** @type {string} */
const MODEL = process.env.FIREAUTO_MEM_MODEL || 'claude-haiku-4-5-20251001';

/** @type {number} Timeout in ms for each query call */
const QUERY_TIMEOUT_MS = 30_000;

// ── Lazy-loaded dependencies ─────────────────────────────────

/** @type {typeof import('@anthropic-ai/claude-agent-sdk').query | null} */
let _query = null;

/**
 * Lazy-load the Agent SDK query function.
 * @returns {typeof import('@anthropic-ai/claude-agent-sdk').query}
 */
function getQuery() {
  if (!_query) {
    try {
      const sdk = require('@anthropic-ai/claude-agent-sdk');
      _query = sdk.query;
    } catch (err) {
      console.error('[sdk-agent] Failed to load @anthropic-ai/claude-agent-sdk:', err.message);
      throw err;
    }
  }
  return _query;
}

/**
 * @typedef {Object} Prompts
 * @property {(toolName: string, toolInput: string, toolOutput: string) => string} buildObservationPrompt
 * @property {(observations: Array<*>) => string} buildSummaryPrompt
 */

/**
 * @typedef {Object} Parser
 * @property {(text: string) => Array<ParsedObservation>} parseObservations
 * @property {(text: string) => ParsedSummary | null} parseSummary
 */

/**
 * @typedef {Object} ParsedObservation
 * @property {string} type
 * @property {string} title
 * @property {string} [subtitle]
 * @property {Array<string>} [facts]
 * @property {string} [narrative]
 * @property {Array<string>} [files_modified]
 */

/**
 * @typedef {Object} ParsedSummary
 * @property {string} request
 * @property {string} investigated
 * @property {string} learned
 * @property {string} completed
 * @property {string} next_steps
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} input
 * @property {number} output
 */

/** @type {Prompts | null} */
let _prompts = null;

/** @type {Parser | null} */
let _parser = null;

/**
 * Load prompts module with fallback.
 * @returns {Prompts}
 */
function loadPrompts() {
  if (!_prompts) {
    try {
      _prompts = require('./prompts.cjs');
    } catch {
      console.error('[sdk-agent] prompts.cjs not found — using fallback prompts');
      _prompts = {
        buildObservationPrompt(toolName, toolInput, toolOutput) {
          return [
            `Analyze this tool usage and extract key observations:`,
            `Tool: ${toolName}`,
            `Input: ${truncate(toolInput, 2000)}`,
            `Output: ${truncate(toolOutput, 2000)}`,
            ``,
            `Respond with JSON: {"observations": [{"type": "...", "title": "...", "subtitle": "...", "facts": [], "narrative": "...", "files_modified": []}]}`,
            `If this tool call is not worth remembering, respond with: {"skip": true}`,
          ].join('\n');
        },
        buildSummaryPrompt(observations) {
          return [
            `Summarize this session based on the following observations:`,
            JSON.stringify(observations, null, 2),
            ``,
            `Respond with JSON: {"request": "...", "investigated": "...", "learned": "...", "completed": "...", "next_steps": "..."}`,
          ].join('\n');
        },
      };
    }
  }
  return _prompts;
}

/**
 * Load parser module with fallback.
 * @returns {Parser}
 */
function loadParser() {
  if (!_parser) {
    try {
      _parser = require('./parser.cjs');
    } catch {
      console.error('[sdk-agent] parser.cjs not found — using fallback parser');
      _parser = {
        parseObservations(text) {
          const json = extractJson(text);
          if (!json) return [];
          if (json.skip) return [];
          return Array.isArray(json.observations) ? json.observations : [];
        },
        parseSummary(text) {
          const json = extractJson(text);
          if (!json) return null;
          if (json.request || json.investigated || json.learned || json.completed || json.next_steps) {
            return {
              request: json.request || '',
              investigated: json.investigated || '',
              learned: json.learned || '',
              completed: json.completed || '',
              next_steps: json.next_steps || '',
            };
          }
          return null;
        },
      };
    }
  }
  return _parser;
}

// ── Internal helpers ─────────────────────────────────────────

/**
 * Truncate string to max length.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max) {
  if (!str) return '';
  if (typeof str !== 'string') str = String(str);
  return str.length > max ? str.slice(0, max) + '...' : str;
}

/**
 * Extract first JSON object from text (handles markdown code fences).
 * @param {string} text
 * @returns {Object | null}
 */
function extractJson(text) {
  if (!text) return null;
  // Try stripping markdown code fences first
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  // Find first { ... } block
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === '{') depth++;
    else if (candidate[i] === '}') depth--;
    if (depth === 0) {
      return safeJsonParse(candidate.slice(start, i + 1), null);
    }
  }
  return null;
}

/**
 * Call Haiku model via Agent SDK query().
 * @param {string} promptText - The prompt to send
 * @returns {Promise<{text: string, tokens: TokenUsage}>}
 */
async function callHaiku(promptText) {
  const queryFn = getQuery();

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), QUERY_TIMEOUT_MS);

  try {
    // Claude-mem pattern: use a promise-based message generator that waits
    // for the assistant's response before ending the generator.
    // This prevents the session from closing before Claude responds.
    let resolveWaiting;
    const waitingForResponse = new Promise((resolve) => { resolveWaiting = resolve; });
    let gotResponse = false;

    async function* messageGenerator() {
      // Yield the user prompt
      yield {
        type: 'user',
        message: { role: 'user', content: promptText },
      };
      // Wait until we've received the assistant's response
      // before letting the generator end (which closes the session)
      await waitingForResponse;
    }

    const queryResult = queryFn({
      prompt: messageGenerator(),
      options: {
        model: MODEL,
        cwd: process.env.HOME || process.env.USERPROFILE || require('os').homedir(),
        disallowedTools: [
          'Bash', 'Read', 'Write', 'Edit',
          'Grep', 'Glob', 'WebFetch', 'WebSearch',
          'Task', 'NotebookEdit', 'AskUserQuestion', 'TodoWrite',
        ],
        abortController,
      },
    });

    let responseText = '';
    /** @type {TokenUsage} */
    const tokens = { input: 0, output: 0 };

    for await (const message of queryResult) {
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'text') responseText += block.text;
        }
        if (message.message.usage) {
          tokens.input += message.message.usage.input_tokens || 0;
          tokens.output += message.message.usage.output_tokens || 0;
        }
        // Signal that we got a response — generator can end now
        if (!gotResponse) {
          gotResponse = true;
          resolveWaiting();
        }
      }
    }

    // In case no assistant message was received, unblock the generator
    if (!gotResponse) resolveWaiting();

    return { text: responseText, tokens };
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Process a single tool observation through Haiku.
 *
 * @param {Object} observation
 * @param {string} observation.tool_name - Name of the tool used
 * @param {*} observation.tool_input - Tool input data
 * @param {*} observation.tool_output - Tool output data
 * @param {string} [observation.session_id] - Session identifier
 * @param {string} [observation.project] - Project name
 * @returns {Promise<{observations: Array<ParsedObservation>, tokens: TokenUsage}>}
 */
async function processObservation(observation) {
  const { tool_name, tool_input, tool_output } = observation;

  try {
    const prompts = loadPrompts();
    const parser = loadParser();

    const inputStr = typeof tool_input === 'string' ? tool_input : JSON.stringify(tool_input);
    const outputStr = typeof tool_output === 'string' ? tool_output : JSON.stringify(tool_output);

    // Init prompt (XML 응답 형식 지시) + Observation prompt (실제 데이터)를 합쳐서 전송
    const initPrompt = prompts.buildInitPrompt
      ? prompts.buildInitPrompt(observation.project || 'unknown', observation.session_id || '', '')
      : '';
    const obsPrompt = prompts.buildObservationPrompt(tool_name, inputStr, outputStr);
    const prompt = initPrompt + '\n\n' + obsPrompt;
    const { text, tokens } = await callHaiku(prompt);

    if (!text || !text.trim()) {
      return { observations: [], tokens };
    }

    const observations = parser.parseObservations(text);
    const actions = parser.parseActions ? parser.parseActions(text) : [];
    return { observations, actions, tokens };
  } catch (err) {
    console.error('[sdk-agent] processObservation failed:', err.message);
    return { observations: [], actions: [], tokens: { input: 0, output: 0 } };
  }
}

/**
 * Generate a session summary from collected observations.
 *
 * @param {Array<ParsedObservation>} sessionObservations - All observations from the session
 * @returns {Promise<{summary: ParsedSummary | null, tokens: TokenUsage}>}
 */
async function generateSummary(sessionObservations) {
  try {
    const prompts = loadPrompts();
    const parser = loadParser();

    const prompt = prompts.buildSummaryPrompt(sessionObservations);
    const { text, tokens } = await callHaiku(prompt);

    if (!text || !text.trim()) {
      return { summary: null, tokens };
    }

    const summary = parser.parseSummary(text);
    return { summary, tokens };
  } catch (err) {
    console.error('[sdk-agent] generateSummary failed:', err.message);
    return { summary: null, tokens: { input: 0, output: 0 } };
  }
}

/**
 * Clean up resources (AbortControllers, cached modules).
 * Safe to call multiple times.
 */
function shutdown() {
  _query = null;
  _prompts = null;
  _parser = null;
  console.error('[sdk-agent] Shutdown complete');
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  processObservation,
  generateSummary,
  shutdown,
};
