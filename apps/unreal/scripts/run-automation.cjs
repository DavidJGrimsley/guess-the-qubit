// Automation runner for Unreal Engine tests
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveEnginePaths } = require('./host-check.cjs');

function runAutomation(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const uprojectPath = path.join(projectRoot, 'GuessTheQubit.uproject');
  const testFilter = options.testFilter || 'QuantumApi.Runtime.Transport';
  const timeoutMs = options.timeoutMs || 120000;
  const isStubbed = typeof options.spawnSyncOverride === 'function';

  if (!fs.existsSync(uprojectPath)) {
    console.error(`ERROR: Project descriptor not found at ${uprojectPath}`);
    return { success: false, code: 1, reason: 'missing_uproject' };
  }

  const engine = options.engineOverride || resolveEnginePaths();
  if (!engine.editorCmd || (!isStubbed && !fs.existsSync(engine.editorCmd))) {
    console.error('ERROR: Unreal Engine 5.8 editor CLI not found. Cannot run native automation tests.');
    console.error('Specify UNREAL_ENGINE_PATH or install Unreal Engine 5.8 to run native tests.');
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
    timeout: timeoutMs
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
    console.error(`ERROR: Execution failed: ${result.error.message}`);
    return { success: false, code: 1, reason: 'spawn_error', error: result.error };
  }

  if (result.status !== 0) {
    console.error(`ERROR: Automation process exited with non-zero exit code: ${result.status}`);
    return { success: false, code: result.status || 1, reason: 'process_exit_non_zero' };
  }

  const stdout = result.stdout || '';
  const successMatch = stdout.includes('Result={Success}');
  const failMatch = stdout.includes('Result={Fail}') || stdout.includes('Error:');

  if (!successMatch || failMatch) {
    console.error('ERROR: Automation tests did not complete successfully in editor output.');
    return { success: false, code: 1, reason: 'automation_test_failed' };
  }

  console.log('--- Native Unreal Automation Tests Completed Successfully ---');
  return { success: true, code: 0 };
}

if (require.main === module) {
  const result = runAutomation();
  process.exit(result.code);
}

module.exports = { runAutomation };
