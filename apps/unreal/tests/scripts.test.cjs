// Regression tests for Unreal orchestration scripts and error propagation.
// These tests never launch Unreal Engine: engine resolution and process results are injected or stubbed, and the
// automation fixtures are real UnrealEditor-Cmd 5.8 output captured on Windows (see tests/fixtures/*.txt headers).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
  verifyStructure,
  hasExactPath,
  findApiKeyValues,
  hasGameFeatureDataAssetManagerRule,
  QUANTUM_PLUGIN_DIR,
  QUANTUM_PLUGIN_DESCRIPTOR,
  EDITOR_ONLY_PLUGINS
} = require('../scripts/structural-check.cjs');
const { runHostCheck, resolveEnginePaths } = require('../scripts/host-check.cjs');
const { runAutomation, parseAutomationOutput, evaluateAutomationOutput } = require('../scripts/run-automation.cjs');

const projectRoot = path.resolve(__dirname, '..');
const readFixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

// Silences script console output while a callback runs, returning what was printed to stderr/stdout.
function captureConsole(callback) {
  const originals = { log: console.log, warn: console.warn, error: console.error };
  const lines = [];
  for (const key of Object.keys(originals)) {
    console[key] = (...args) => lines.push(args.join(' '));
  }
  try {
    return { value: callback(), output: lines.join('\n') };
  } finally {
    Object.assign(console, originals);
  }
}

const GAME_INI_WITH_RULE = [
  '[/Script/Engine.AssetManagerSettings]',
  '+PrimaryAssetTypesToScan=(PrimaryAssetType="GameFeatureData",AssetBaseClass="/Script/GameFeatures.GameFeatureData",bHasBlueprintClasses=False,bIsEditorOnly=True,Directories=((Path="/Game/Unused")),SpecificAssets=,Rules=(Priority=-1,ChunkId=-1,bApplyRecursively=True,CookRule=AlwaysCook))',
  '',
  '[/Script/QuantumApi.QuantumApiSettings]',
  'ApiKey=',
  ''
].join('\n');

function writeProject(root, overrides = {}) {
  const plugins = overrides.plugins || [
    { Name: 'QuantumApi', Enabled: true },
    ...EDITOR_ONLY_PLUGINS.map((Name) => ({ Name, Enabled: true, TargetAllowList: ['Editor'] }))
  ];
  fs.writeFileSync(
    path.join(root, 'GuessTheQubit.uproject'),
    JSON.stringify({ EngineAssociation: '5.8', Plugins: plugins })
  );
  fs.mkdirSync(path.join(root, 'Content'), { recursive: true });
  const pluginDir = overrides.pluginDir || QUANTUM_PLUGIN_DIR;
  fs.mkdirSync(path.join(root, 'Plugins', pluginDir), { recursive: true });
  fs.writeFileSync(path.join(root, 'Plugins', pluginDir, QUANTUM_PLUGIN_DESCRIPTOR), '{}');
  fs.mkdirSync(path.join(root, 'Config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Config', 'DefaultEngine.ini'), '[Core]');
  fs.writeFileSync(path.join(root, 'Config', 'DefaultInput.ini'), '[Core]');
  fs.writeFileSync(path.join(root, 'Config', 'DefaultGame.ini'), overrides.gameIni ?? GAME_INI_WITH_RULE);
}

function withTempProject(overrides, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-struct-'));
  try {
    writeProject(tempDir, overrides);
    return callback(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('Unreal static structural checks', () => {
  it('passes on the real monorepo apps/unreal project root', () => {
    const result = verifyStructure(projectRoot);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
    assert.equal(result.uproject.EngineAssociation, '5.8');
  });

  it('resolves the plugin directory with its exact on-disk capitalization on every host', () => {
    assert.equal(QUANTUM_PLUGIN_DIR, 'QuantumAPI');
    assert.equal(hasExactPath(projectRoot, 'Plugins', 'QuantumAPI', 'QuantumApi.uplugin'), true);
    // existsSync would accept this on Windows/macOS; the exact-case check must not.
    assert.equal(hasExactPath(projectRoot, 'Plugins', 'QuantumApi', 'QuantumApi.uplugin'), false);
    assert.equal(hasExactPath(projectRoot, 'plugins', 'QuantumAPI', 'QuantumApi.uplugin'), false);
  });

  it('accepts a synthetic project that uses Plugins/QuantumAPI', () => {
    withTempProject({}, (dir) => {
      assert.deepEqual(verifyStructure(dir).errors, []);
    });
  });

  it('rejects the wrong plugin directory capitalization Plugins/QuantumApi', () => {
    withTempProject({ pluginDir: 'QuantumApi' }, (dir) => {
      const result = verifyStructure(dir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Plugins/QuantumAPI/QuantumApi.uplugin')));
    });
  });

  it('fails with a clear error if the uproject is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-struct-'));
    try {
      const result = verifyStructure(tempDir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Missing uproject file')));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails if required config files are missing', () => {
    withTempProject({}, (dir) => {
      fs.rmSync(path.join(dir, 'Config', 'DefaultInput.ini'));
      fs.rmSync(path.join(dir, 'Config', 'DefaultGame.ini'));
      const result = verifyStructure(dir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('DefaultInput.ini')));
      assert.ok(result.errors.some((e) => e.includes('DefaultGame.ini')));
    });
  });

  it('fails if a developer plugin loses its editor-only TargetAllowList', () => {
    const plugins = [
      { Name: 'QuantumApi', Enabled: true },
      ...EDITOR_ONLY_PLUGINS.map((Name) =>
        Name === 'MCPClientToolset' ? { Name, Enabled: true } : { Name, Enabled: true, TargetAllowList: ['Editor'] }
      )
    ];
    withTempProject({ plugins }, (dir) => {
      const result = verifyStructure(dir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('MCPClientToolset') && e.includes('TargetAllowList')));
    });
  });

  it('fails if a required plugin is missing or disabled', () => {
    const plugins = [{ Name: 'QuantumApi', Enabled: false }];
    withTempProject({ plugins }, (dir) => {
      const result = verifyStructure(dir);
      assert.ok(result.errors.some((e) => e.includes('"QuantumApi" is disabled')));
      assert.ok(result.errors.some((e) => e.includes('"AllToolsets" not declared')));
    });
  });

  it('keeps ApiKey empty and never echoes a committed key', () => {
    const secret = 'sk-test-0123456789';
    withTempProject({ gameIni: GAME_INI_WITH_RULE.replace('ApiKey=', `ApiKey=${secret}`) }, (dir) => {
      const result = verifyStructure(dir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('ApiKey')));
      assert.ok(!result.errors.join('\n').includes(secret));
    });
    assert.deepEqual(findApiKeyValues('ApiKey=\r\nApiKey=""\r\n'), ['', '']);
    assert.deepEqual(findApiKeyValues('; ApiKey=commented\nApiKey=abc'), ['abc']);
  });

  it('requires the GameFeatureData Asset Manager rule in the tracked DefaultGame.ini', () => {
    const withoutRule = GAME_INI_WITH_RULE.split('\n').slice(2).join('\n');
    withTempProject({ gameIni: withoutRule }, (dir) => {
      const result = verifyStructure(dir);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('GameFeatureData')));
    });
    assert.equal(hasGameFeatureDataAssetManagerRule(GAME_INI_WITH_RULE), true);
    assert.equal(hasGameFeatureDataAssetManagerRule(GAME_INI_WITH_RULE.replace(/\n/g, '\r\n')), true);
    // A commented-out rule, or the rule under another section, must not count.
    assert.equal(hasGameFeatureDataAssetManagerRule(GAME_INI_WITH_RULE.replace('+Primary', ';+Primary')), false);
    assert.equal(
      hasGameFeatureDataAssetManagerRule(
        GAME_INI_WITH_RULE.replace('[/Script/Engine.AssetManagerSettings]', '[/Script/Engine.Other]')
      ),
      false
    );
  });

  it('real tracked DefaultGame.ini keeps ApiKey empty and sets the GameFeatureData rule', () => {
    const ini = fs.readFileSync(path.join(projectRoot, 'Config', 'DefaultGame.ini'), 'utf8');
    assert.deepEqual(findApiKeyValues(ini), ['']);
    assert.equal(hasGameFeatureDataAssetManagerRule(ini), true);
  });
});

describe('Unreal engine resolution per host platform', () => {
  const existsIn = (...paths) => {
    const set = new Set(paths);
    return (candidate) => set.has(candidate);
  };

  it('Windows override: Engine/Binaries/Win64/UnrealEditor-Cmd.exe', () => {
    const exe = 'D:\\UE\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
    const engine = resolveEnginePaths({
      platform: 'win32',
      env: { UNREAL_ENGINE_PATH: 'D:\\UE\\UE_5.8' },
      existsSync: existsIn(exe)
    });
    assert.equal(engine.editorCmd, exe);
    assert.equal(engine.root, 'D:\\UE\\UE_5.8');
  });

  it('macOS override: Engine/Binaries/Mac/UnrealEditor-Cmd and the .app bundle layout', () => {
    const plain = '/Volumes/Dev/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd';
    const bundled = '/Volumes/Dev/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd.app/Contents/MacOS/UnrealEditor-Cmd';
    const env = { UNREAL_ENGINE_PATH: '/Volumes/Dev/UE_5.8' };
    assert.equal(resolveEnginePaths({ platform: 'darwin', env, existsSync: existsIn(plain) }).editorCmd, plain);
    assert.equal(resolveEnginePaths({ platform: 'darwin', env, existsSync: existsIn(bundled) }).editorCmd, bundled);
  });

  it('Linux override: Engine/Binaries/Linux/UnrealEditor-Cmd (regression: missing platform directory)', () => {
    const exe = '/opt/UnrealEngine/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd';
    const engine = resolveEnginePaths({
      platform: 'linux',
      env: { UE_5_8_PATH: '/opt/UnrealEngine/UE_5.8' },
      existsSync: existsIn(exe)
    });
    assert.equal(engine.editorCmd, exe);
    // The previous implementation looked for Engine/Binaries/UnrealEditor-Cmd without a platform directory.
    const legacy = '/opt/UnrealEngine/UE_5.8/Engine/Binaries/UnrealEditor-Cmd';
    assert.equal(
      resolveEnginePaths({
        platform: 'linux',
        env: { UE_5_8_PATH: '/opt/UnrealEngine/UE_5.8' },
        existsSync: existsIn(legacy)
      }).editorCmd,
      null
    );
  });

  it('accepts the Engine directory or a direct executable path as the override on each platform', () => {
    const win = 'C:\\UE\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
    const mac = '/Users/dev/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd';
    const linux = '/home/dev/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd';
    const cases = [
      ['win32', 'C:\\UE\\Engine', win, 'C:\\UE\\Engine'],
      ['win32', win, win, 'C:\\UE'],
      ['darwin', '/Users/dev/UE_5.8/Engine', mac, '/Users/dev/UE_5.8/Engine'],
      ['darwin', mac, mac, '/Users/dev/UE_5.8'],
      ['linux', '/home/dev/UE_5.8/Engine', linux, '/home/dev/UE_5.8/Engine'],
      ['linux', linux, linux, '/home/dev/UE_5.8']
    ];
    for (const [platform, override, exe, root] of cases) {
      const engine = resolveEnginePaths({ platform, env: { UNREAL_ENGINE_PATH: override }, existsSync: existsIn(exe) });
      assert.equal(engine.editorCmd, exe, `${platform} ${override}`);
      assert.equal(engine.root, root, `${platform} ${override}`);
    }
  });

  it('does not fall back to standard locations when an explicit override is wrong', () => {
    const standard = 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
    const engine = resolveEnginePaths({
      platform: 'win32',
      env: { UNREAL_ENGINE_PATH: 'C:\\NonExistent\\Unreal\\Path' },
      existsSync: existsIn(standard)
    });
    assert.equal(engine.editorCmd, null);
  });

  it('finds standard install locations for Windows, macOS and Linux when no override is set', () => {
    const cases = [
      ['win32', 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe'],
      ['darwin', '/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor-Cmd'],
      ['linux', '/opt/EpicGames/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd']
    ];
    for (const [platform, exe] of cases) {
      assert.equal(resolveEnginePaths({ platform, env: {}, existsSync: existsIn(exe) }).editorCmd, exe, platform);
      assert.equal(resolveEnginePaths({ platform, env: {}, existsSync: existsIn() }).editorCmd, null, platform);
    }
  });

  it('reads the engine version from Build.version when present', () => {
    const exe = '/opt/EpicGames/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd';
    const engine = resolveEnginePaths({
      platform: 'linux',
      env: {},
      existsSync: existsIn(exe),
      readFileSync: () => JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 3 })
    });
    assert.deepEqual(engine.version, { major: 5, minor: 8, patch: 3 });
  });

  it('flags unsupported platforms instead of guessing a layout', () => {
    const engine = resolveEnginePaths({ platform: 'freebsd', env: { UNREAL_ENGINE_PATH: '/anywhere' }, existsSync: () => true });
    assert.equal(engine.unsupportedPlatform, true);
    assert.equal(engine.editorCmd, null);
  });
});

describe('Unreal host check never reports native validation', () => {
  it('reports an unsupported host as unverified failure', () => {
    const { value } = captureConsole(() => runHostCheck({ projectRoot, platform: 'freebsd', env: {} }));
    assert.equal(value.success, false);
    assert.equal(value.code, 1);
    assert.equal(value.reason, 'unsupported_host');
    assert.equal(value.nativeValidated, false);
  });

  it('reports a missing engine as unverified (non-zero), not as a pass', () => {
    for (const platform of ['win32', 'darwin', 'linux']) {
      const { value, output } = captureConsole(() =>
        runHostCheck({ projectRoot, platform, env: {}, existsSync: () => false })
      );
      assert.equal(value.success, false, platform);
      assert.equal(value.code, 1, platform);
      assert.equal(value.reason, 'engine_missing', platform);
      assert.equal(value.nativeValidated, false, platform);
      assert.match(output, /UNVERIFIED/);
    }
  });

  it('reports a detected engine as detection only, with native validation still false', () => {
    const exe = '/opt/EpicGames/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd';
    const { value, output } = captureConsole(() =>
      runHostCheck({
        projectRoot,
        platform: 'linux',
        env: {},
        existsSync: (candidate) => candidate === exe,
        readFileSync: () => JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 3 })
      })
    );
    assert.equal(value.success, true);
    assert.equal(value.code, 0);
    assert.equal(value.nativeValidated, false);
    assert.match(output, /ENGINE DETECTED/);
    assert.doesNotMatch(output, /Verification Passed/);
  });

  it('fails when the detected engine is not 5.8', () => {
    const exe = '/opt/EpicGames/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd';
    const { value } = captureConsole(() =>
      runHostCheck({
        projectRoot,
        platform: 'linux',
        env: {},
        existsSync: (candidate) => candidate === exe,
        readFileSync: () => JSON.stringify({ MajorVersion: 5, MinorVersion: 7, PatchVersion: 0 })
      })
    );
    assert.equal(value.success, false);
    assert.equal(value.reason, 'engine_version_mismatch');
  });

  it('fails on structural problems before looking for an engine', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-host-'));
    try {
      const { value } = captureConsole(() => runHostCheck({ projectRoot: tempDir, platform: 'linux', env: {} }));
      assert.equal(value.success, false);
      assert.equal(value.reason, 'structural_failure');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Unreal automation result parsing (real UE 5.8 output)', () => {
  it('passes real successful output that also contains unrelated Error: lines', () => {
    const output = readFixture('automation-success-with-unrelated-errors.txt');
    assert.match(output, /LogGameFeatures: Error:/, 'fixture must contain the unrelated Error lines');
    const evaluation = evaluateAutomationOutput(output);
    assert.equal(evaluation.success, true, evaluation.message);
    assert.deepEqual(evaluation.parsed.results, [
      { state: 'Success', name: 'Transport', path: 'QuantumApi.Runtime.Transport' }
    ]);
    assert.equal(evaluation.parsed.found, 1);
    assert.equal(evaluation.parsed.exitCode, 0);
  });

  it('passes real successful output without errors', () => {
    const evaluation = evaluateAutomationOutput(readFixture('automation-success.txt'));
    assert.equal(evaluation.success, true, evaluation.message);
  });

  it('fails real failing output (Result={Fail}, EXIT CODE -1)', () => {
    const output = readFixture('automation-failure.txt');
    const evaluation = evaluateAutomationOutput(output);
    assert.equal(evaluation.success, false);
    assert.equal(evaluation.reason, 'automation_test_failed');
    assert.match(evaluation.message, /QuantumApi\.Runtime\.Transport \(Fail\)/);
    assert.equal(parseAutomationOutput(output).exitCode, -1);
  });
});

describe('Unreal automation runner error propagation and stubs', () => {
  const engineOverride = { editorCmd: 'C:\\Fake\\UnrealEditor-Cmd.exe', root: 'C:\\Fake' };
  const run = (spawnResult, extra = {}) =>
    captureConsole(() =>
      runAutomation({ projectRoot, engineOverride, spawnSyncOverride: () => spawnResult, ...extra })
    ).value;
  const ok = (stdout) => ({ stdout, stderr: '', error: null, status: 0 });

  it('fails with code 1 when engine is missing (no false success)', () => {
    const { value } = captureConsole(() =>
      runAutomation({ projectRoot, engineOverride: { editorCmd: null, root: null } })
    );
    assert.equal(value.success, false);
    assert.equal(value.code, 1);
    assert.equal(value.reason, 'missing_engine');
  });

  it('fails when the project descriptor is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-test-auto-'));
    try {
      const { value } = captureConsole(() => runAutomation({ projectRoot: tempDir, engineOverride }));
      assert.equal(value.reason, 'missing_uproject');
      assert.equal(value.success, false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('passes the real successful run even though its log contains Error: lines', () => {
    const result = run(ok(readFixture('automation-success-with-unrelated-errors.txt')));
    assert.equal(result.success, true);
    assert.equal(result.code, 0);
    assert.equal(result.results.length, 1);
  });

  it('fails the real failing run even if the process were to exit 0', () => {
    const result = run(ok(readFixture('automation-failure.txt')));
    assert.equal(result.success, false);
    assert.equal(result.code, 1);
    assert.equal(result.reason, 'automation_test_failed');
  });

  it('propagates the real editor exit code 255 for a failing run', () => {
    const result = run({ stdout: readFixture('automation-failure.txt'), stderr: '', error: null, status: 255 });
    assert.equal(result.success, false);
    assert.equal(result.code, 255);
    assert.equal(result.reason, 'process_exit_non_zero');
  });

  it('propagates timeout code 124 when the process times out', () => {
    const result = run({
      stdout: '',
      stderr: 'timed out',
      error: Object.assign(new Error('Process timed out'), { code: 'ETIMEDOUT' }),
      status: null
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 124);
    assert.equal(result.reason, 'timeout');
  });

  it('fails on output overflow instead of treating a killed editor as success', () => {
    const result = run({
      stdout: readFixture('automation-success.txt'),
      stderr: '',
      error: Object.assign(new Error('maxBuffer exceeded'), { code: 'ENOBUFS' }),
      status: null
    });
    assert.equal(result.success, false);
    assert.equal(result.reason, 'output_overflow');
  });

  it('fails when the process cannot be spawned', () => {
    const result = run({ stdout: '', stderr: '', error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }), status: null });
    assert.equal(result.success, false);
    assert.equal(result.reason, 'spawn_error');
  });

  it('fails when the editor is killed by a signal', () => {
    const result = run({ stdout: readFixture('automation-success.txt'), stderr: '', error: null, status: null, signal: 'SIGKILL' });
    assert.equal(result.success, false);
    assert.notEqual(result.code, 0);
  });

  it('propagates a non-zero process exit code even when a Success line is present', () => {
    const result = run({ stdout: readFixture('automation-success.txt'), stderr: '', error: null, status: 3 });
    assert.equal(result.success, false);
    assert.equal(result.code, 3);
  });

  it('fails when exit 0 output has Error: text but no automation results', () => {
    const result = run(ok('LogGameFeatures: Error: something unrelated\nInitialized engine but no tests run'));
    assert.equal(result.success, false);
    assert.equal(result.reason, 'no_tests_completed');
  });

  it('fails when the filter matches zero tests', () => {
    const result = run(
      ok(
        [
          "LogAutomationCommandLine: Display: Found 0 automation tests based on 'QuantumApi.Nope'",
          'LogAutomationCommandLine: Display: **** TEST COMPLETE. EXIT CODE: 0 ****'
        ].join('\n')
      )
    );
    assert.equal(result.success, false);
    assert.equal(result.reason, 'no_tests_found');
  });

  it('fails when only some found tests reported results', () => {
    const lines = [
      "LogAutomationCommandLine: Display: Found 2 automation tests based on 'QuantumApi'",
      'LogAutomationController: Display: Test Completed. Result={Success} Name={A} Path={QuantumApi.A}',
      'LogAutomationCommandLine: Display: **** TEST COMPLETE. EXIT CODE: 0 ****'
    ];
    const result = run(ok(lines.join('\n')));
    assert.equal(result.success, false);
    assert.equal(result.reason, 'automation_incomplete');
  });

  it('fails when a skipped or failed test is mixed with successes', () => {
    for (const state of ['Fail', 'Skipped', 'NotRun', 'InProcess']) {
      const lines = [
        "LogAutomationCommandLine: Display: Found 2 automation tests based on 'QuantumApi'",
        'LogAutomationController: Display: Test Completed. Result={Success} Name={A} Path={QuantumApi.A}',
        `LogAutomationController: Display: Test Completed. Result={${state}} Name={B} Path={QuantumApi.B}`,
        'LogAutomationCommandLine: Display: **** TEST COMPLETE. EXIT CODE: 0 ****'
      ];
      const result = run(ok(lines.join('\n')));
      assert.equal(result.success, false, state);
      assert.equal(result.reason, 'automation_test_failed', state);
    }
  });

  it('fails when TEST COMPLETE is missing or reports a non-zero exit code', () => {
    const base = [
      "LogAutomationCommandLine: Display: Found 1 automation tests based on 'QuantumApi.Runtime.Transport'",
      'LogAutomationController: Display: Test Completed. Result={Success} Name={Transport} Path={QuantumApi.Runtime.Transport}'
    ];
    assert.equal(run(ok(base.join('\n'))).reason, 'automation_incomplete');
    const nonZero = [...base, 'LogAutomationCommandLine: Display: **** TEST COMPLETE. EXIT CODE: 1 ****'];
    assert.equal(run(ok(nonZero.join('\n'))).reason, 'automation_test_failed');
  });

  it('handles CRLF output from Windows editors', () => {
    const result = run(ok(readFixture('automation-success.txt').replace(/\n/g, '\r\n')));
    assert.equal(result.success, true);
  });

  it('launches the editor with the filter, -nullrhi and -unattended and a generous output buffer', () => {
    let captured;
    captureConsole(() =>
      runAutomation({
        projectRoot,
        engineOverride,
        testFilter: 'QuantumApi.Runtime.Transport',
        spawnSyncOverride: (command, args, options) => {
          captured = { command, args, options };
          return ok(readFixture('automation-success.txt'));
        }
      })
    );
    assert.equal(captured.command, engineOverride.editorCmd);
    assert.ok(captured.args.includes('-ExecCmds=Automation RunTests QuantumApi.Runtime.Transport; Quit'));
    assert.ok(captured.args.includes('-nullrhi') && captured.args.includes('-unattended'));
    assert.ok(captured.options.maxBuffer >= 64 * 1024 * 1024);
    assert.ok(captured.options.timeout >= 120000);
  });
});
