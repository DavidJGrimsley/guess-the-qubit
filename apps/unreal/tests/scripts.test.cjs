// Regression tests for Unreal orchestration scripts and error propagation
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { verifyStructure } = require('../scripts/structural-check.cjs');
const { runHostCheck, resolveEnginePaths } = require('../scripts/host-check.cjs');
const { runAutomation } = require('../scripts/run-automation.cjs');

describe('Unreal static structural checks', () => {
  const projectRoot = path.resolve(__dirname, '..');

  it('passes on valid monorepo apps/unreal project root', () => {
    const result = verifyStructure(projectRoot);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.uproject.EngineAssociation, '5.8');
  });

  it('fails with clear error if uproject is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-struct-'));
    try {
      const result = verifyStructure(tempDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Missing uproject file')));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails if required config file is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-struct-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, 'GuessTheQubit.uproject'),
        JSON.stringify({
          EngineAssociation: '5.8',
          Plugins: [
            { Name: 'QuantumApi', Enabled: true },
            { Name: 'AllToolsets', Enabled: true },
            { Name: 'AIModuleToolset', Enabled: true },
            { Name: 'MCPClientToolset', Enabled: true },
            { Name: 'ModelContextProtocol', Enabled: true }
          ]
        })
      );
      fs.mkdirSync(path.join(tempDir, 'Content'));
      fs.mkdirSync(path.join(tempDir, 'Plugins', 'QuantumApi'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'Plugins', 'QuantumApi', 'QuantumApi.uplugin'), '{}');
      fs.mkdirSync(path.join(tempDir, 'Config'));
      // Only write DefaultEngine.ini; leave DefaultGame.ini and DefaultInput.ini missing
      fs.writeFileSync(path.join(tempDir, 'Config', 'DefaultEngine.ini'), '[Core]');

      const result = verifyStructure(tempDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('DefaultInput.ini')));
      assert.ok(result.errors.some((e) => e.includes('DefaultGame.ini')));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Unreal host verification error propagation', () => {
  it('detects missing engine when configured with non-existent path', () => {
    const origEnv = process.env.UNREAL_ENGINE_PATH;
    try {
      process.env.UNREAL_ENGINE_PATH = 'C:\\NonExistent\\Unreal\\Path';
      const engine = resolveEnginePaths();
      assert.equal(engine.editorCmd, null);
    } finally {
      if (origEnv !== undefined) {
        process.env.UNREAL_ENGINE_PATH = origEnv;
      } else {
        delete process.env.UNREAL_ENGINE_PATH;
      }
    }
  });
});

describe('Unreal automation runner error propagation and stubs', () => {
  const projectRoot = path.resolve(__dirname, '..');

  it('fails with code 1 when engine is missing (no false success)', () => {
    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: null, root: null }
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 1);
    assert.equal(result.reason, 'missing_engine');
  });

  it('propagates timeout code 124 when process times out', () => {
    const stubSpawn = () => ({
      stdout: '',
      stderr: 'timed out',
      error: Object.assign(new Error('Process timed out'), { code: 'ETIMEDOUT' }),
      status: null
    });

    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' },
      spawnSyncOverride: stubSpawn
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 124);
    assert.equal(result.reason, 'timeout');
  });

  it('propagates non-zero process exit code', () => {
    const stubSpawn = () => ({
      stdout: 'Crash during editor init',
      stderr: 'Fatal error',
      error: null,
      status: 3
    });

    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' },
      spawnSyncOverride: stubSpawn
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 3);
    assert.equal(result.reason, 'process_exit_non_zero');
  });

  it('fails when process exits 0 but output contains Result={Fail}', () => {
    const stubSpawn = () => ({
      stdout: 'Running tests...\nTest Completed. Result={Fail}\nSuccess: 0, Failed: 1',
      stderr: '',
      error: null,
      status: 0
    });

    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' },
      spawnSyncOverride: stubSpawn
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 1);
    assert.equal(result.reason, 'automation_test_failed');
  });

  it('fails when process exits 0 without explicit success indication', () => {
    const stubSpawn = () => ({
      stdout: 'Initialized engine but no tests run',
      stderr: '',
      error: null,
      status: 0
    });

    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' },
      spawnSyncOverride: stubSpawn
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 1);
    assert.equal(result.reason, 'automation_test_failed');
  });

  it('succeeds (code 0) when process exits 0 and logs Result={Success}', () => {
    const stubSpawn = () => ({
      stdout: 'Automation RunTests QuantumApi.Runtime.Transport\nTest Completed. Result={Success}\nSuccess: 1, Failed: 0',
      stderr: '',
      error: null,
      status: 0
    });

    const result = runAutomation({
      projectRoot,
      engineOverride: { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' },
      spawnSyncOverride: stubSpawn
    });
    assert.equal(result.success, true);
    assert.equal(result.code, 0);
  });
});
