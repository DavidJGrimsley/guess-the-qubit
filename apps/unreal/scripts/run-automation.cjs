// Automation runner for Unreal Engine tests.
// Success is decided from the engine's structured automation result lines, never from free-form "Error:" text:
// a healthy editor log can contain unrelated LogXxx: Error: lines (for example the GameFeatures notice) while every test passes.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveEnginePaths } = require('./host-check.cjs');

// These line formats are emitted by AutomationControllerManager.cpp and parsed by Epic's Gauntlet, so they are stable:
//   Test Completed. Result={Success} Name={Transport} Path={QuantumApi.Runtime.Transport}
//   Found 1 automation tests based on 'QuantumApi.Runtime.Transport'
//   **** TEST COMPLETE. EXIT CODE: 0 ****
const TEST_COMPLETED = /Test Completed\. Result=\{([^}]*)\} Name=\{(.*?)\} Path=\{(.*)\}\s*$/;
const TESTS_FOUND = /Found (\d+) automation tests based on /;
const TEST_COMPLETE_EXIT = /\*\*\*\* TEST COMPLETE\. EXIT CODE: (-?\d+) \*\*\*\*/;

const DEFAULT_TEST_FILTER = 'QuantumApi.Runtime.Transport';
const DEFAULT_TIMEOUT_MS = 600000;
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

// Extracts structured automation results from raw editor output.
function parseAutomationOutput(output) {
  const parsed = { found: null, results: [], exitCode: null };
  for (const line of String(output || '').split(/\r?\n/)) {
    const completed = line.match(TEST_COMPLETED);
    if (completed) {
      parsed.results.push({ state: completed[1], name: completed[2], path: completed[3] });
      continue;
    }
    const found = line.match(TESTS_FOUND);
    if (found) {
      parsed.found = Number(found[1]);
      continue;
    }
    const exit = line.match(TEST_COMPLETE_EXIT);
    if (exit) {
      parsed.exitCode = Number(exit[1]);
    }
  }
  return parsed;
}

// Returns { success, reason?, message } for a successfully started (exit code 0) automation process.
function evaluateAutomationOutput(output) {
  const parsed = parseAutomationOutput(output);

  if (parsed.found === 0) {
    return { success: false, reason: 'no_tests_found', message: 'The test filter matched 0 automation tests.', parsed };
  }
  if (parsed.results.length === 0) {
    return { success: false, reason: 'no_tests_completed', message: 'No "Test Completed" results were reported.', parsed };
  }
  const notPassed = parsed.results.filter((r) => r.state !== 'Success');
  if (notPassed.length > 0) {
    const names = notPassed.map((r) => `${r.path} (${r.state})`).join(', ');
    return { success: false, reason: 'automation_test_failed', message: `Automation tests did not succeed: ${names}`, parsed };
  }
  if (parsed.found !== null && parsed.results.length < parsed.found) {
    return {
      success: false,
      reason: 'automation_incomplete',
      message: `Only ${parsed.results.length} of ${parsed.found} found automation tests reported a result.`,
      parsed
    };
  }
  if (parsed.exitCode === null) {
    return { success: false, reason: 'automation_incomplete', message: 'Editor output never reported TEST COMPLETE.', parsed };
  }
  if (parsed.exitCode !== 0) {
    return {
      success: false,
      reason: 'automation_test_failed',
      message: `Editor reported TEST COMPLETE with EXIT CODE ${parsed.exitCode}.`,
      parsed
    };
  }
  return { success: true, parsed };
}

function runAutomation(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const uprojectPath = path.join(projectRoot, 'GuessTheQubit.uproject');
  const testFilter = options.testFilter || DEFAULT_TEST_FILTER;
  const timeoutMs = options.timeoutMs || Number(process.env.UNREAL_AUTOMATION_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const isStubbed = typeof options.spawnSyncOverride === 'function';

  if (!fs.existsSync(uprojectPath)) {
    console.error(`ERROR: Project descriptor not found at ${uprojectPath}`);
    return { success: false, code: 1, reason: 'missing_uproject' };
  }

  const engine = options.engineOverride || resolveEnginePaths();
  if (!engine.editorCmd || (!isStubbed && !fs.existsSync(engine.editorCmd))) {
    console.error('ERROR: Unreal Engine 5.8 editor CLI not found. Cannot run native automation tests.');
    console.error('Set UNREAL_ENGINE_PATH to the engine root (the folder containing Engine/) or install Unreal Engine 5.8.');
    return { success: false, code: 1, reason: 'missing_engine' };
  }

  console.log(`Running Unreal Engine automation tests using: ${engine.editorCmd}`);
  console.log(`Project: ${uprojectPath}`);
  console.log(`Test filter: ${testFilter}`);

  const args = [
    uprojectPath,
    `-ExecCmds=Automation RunTests ${testFilter}; Quit`,
    '-stdout',
    '-nosplash',
    '-nullrhi',
    '-unattended'
  ];

  const spawnFn = options.spawnSyncOverride || spawnSync;
  const result = spawnFn(engine.editorCmd, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES
  });

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      console.error(`ERROR: Unreal automation tests timed out after ${timeoutMs}ms`);
      return { success: false, code: 124, reason: 'timeout' };
    }
    if (result.error.code === 'ENOBUFS') {
      console.error(`ERROR: Unreal automation output exceeded ${MAX_OUTPUT_BYTES} bytes and the editor was stopped`);
      return { success: false, code: 1, reason: 'output_overflow', error: result.error };
    }
    console.error(`ERROR: Execution failed: ${result.error.message}`);
    return { success: false, code: 1, reason: 'spawn_error', error: result.error };
  }

  if (result.status !== 0) {
    const detail = result.status === null || result.status === undefined ? `signal ${result.signal || 'unknown'}` : `exit code ${result.status}`;
    console.error(`ERROR: Automation process ended abnormally: ${detail}`);
    return { success: false, code: result.status || 1, reason: 'process_exit_non_zero' };
  }

  const evaluation = evaluateAutomationOutput(result.stdout);
  if (!evaluation.success) {
    console.error(`ERROR: ${evaluation.message}`);
    return { success: false, code: 1, reason: evaluation.reason };
  }

  for (const test of evaluation.parsed.results) {
    console.log(`PASS ${test.path}`);
  }
  console.log(`--- Native Unreal Automation Tests Completed Successfully (${evaluation.parsed.results.length} test(s)) ---`);
  return { success: true, code: 0, results: evaluation.parsed.results };
}

if (require.main === module) {
  const result = runAutomation();
  process.exit(result.code);
}

module.exports = { runAutomation, parseAutomationOutput, evaluateAutomationOutput };
